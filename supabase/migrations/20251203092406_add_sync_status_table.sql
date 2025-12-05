/*
  # Add sync status tracking table

  1. New Tables
    - `sync_status`
      - `id` (uuid, primary key)
      - `branch_id` (uuid, foreign key to branches)
      - `sync_type` (text: 'bookings', 'staff', 'services')
      - `status` (text: 'success', 'error')
      - `synced_count` (integer)
      - `error_message` (text, nullable)
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on `sync_status` table
    - Add policy for authenticated users to read their branch sync status
*/

CREATE TABLE IF NOT EXISTS sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  status text NOT NULL,
  synced_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync status for their branches"
  ON sync_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      JOIN profiles p ON p.org_id = b.org_id
      WHERE b.id = sync_status.branch_id
      AND p.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_sync_status_branch_created 
  ON sync_status(branch_id, created_at DESC);
