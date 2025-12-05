/*
  # Remove company_id from integration settings

  1. Changes
    - Drop yclients_company_id column from integration_settings table
    - Drop yclients_company_id column from branches table
    
  2. Notes
    - Only yclients_branch_id is needed for API integration
    - This simplifies the integration setup
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'yclients_company_id'
  ) THEN
    ALTER TABLE integration_settings DROP COLUMN yclients_company_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'yclients_company_id'
  ) THEN
    ALTER TABLE branches DROP COLUMN yclients_company_id;
  END IF;
END $$;
