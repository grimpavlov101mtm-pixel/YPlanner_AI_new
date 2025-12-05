/*
  # Remove yclients_branch_id from branches table

  1. Changes
    - Drop yclients_branch_id column from branches table
    
  2. Notes
    - Branch ID is not needed for yClients API integration
    - Only Partner Token and User Token are required
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'yclients_branch_id'
  ) THEN
    ALTER TABLE branches DROP COLUMN yclients_branch_id;
  END IF;
END $$;
