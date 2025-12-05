/*
  # Rename yclients_branch_id to yclients_company_id

  1. Changes
    - Rename yclients_branch_id column to yclients_company_id in branches table
    
  2. Notes
    - This reflects the correct yClients API terminology
    - Company ID is used for API endpoints, not branch ID
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'yclients_branch_id'
  ) THEN
    ALTER TABLE branches RENAME COLUMN yclients_branch_id TO yclients_company_id;
  END IF;
END $$;
