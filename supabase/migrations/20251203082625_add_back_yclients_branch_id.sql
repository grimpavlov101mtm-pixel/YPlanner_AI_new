/*
  # Add back yclients_branch_id to branches table

  1. Changes
    - Add yclients_branch_id column back to branches table
    
  2. Notes
    - Branch ID is needed for yClients API integration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'yclients_branch_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN yclients_branch_id integer;
  END IF;
END $$;
