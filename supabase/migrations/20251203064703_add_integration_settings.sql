/*
  # Add Integration Settings

  1. New Tables
    - `integration_settings`
      - `id` (uuid, primary key)
      - `branch_id` (uuid, foreign key to branches)
      - `telegram_bot_token` (text, encrypted)
      - `yclients_company_id` (bigint)
      - `yclients_branch_id` (bigint)
      - `yclients_token` (text, encrypted)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `integration_settings` table
    - Add policy for branch admins and org admins to manage their integration settings
*/

CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  telegram_bot_token text,
  yclients_company_id bigint,
  yclients_branch_id bigint,
  yclients_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id)
);

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch and org admins can view integration settings"
  ON integration_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN branches b ON b.org_id = p.org_id
      WHERE p.id = auth.uid()
      AND b.id = integration_settings.branch_id
      AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "Branch and org admins can insert integration settings"
  ON integration_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN branches b ON b.org_id = p.org_id
      WHERE p.id = auth.uid()
      AND b.id = integration_settings.branch_id
      AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
    )
  );

CREATE POLICY "Branch and org admins can update integration settings"
  ON integration_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN branches b ON b.org_id = p.org_id
      WHERE p.id = auth.uid()
      AND b.id = integration_settings.branch_id
      AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN branches b ON b.org_id = p.org_id
      WHERE p.id = auth.uid()
      AND b.id = integration_settings.branch_id
      AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
    )
  );

CREATE POLICY "Branch and org admins can delete integration settings"
  ON integration_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN branches b ON b.org_id = p.org_id
      WHERE p.id = auth.uid()
      AND b.id = integration_settings.branch_id
      AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
    )
  );
