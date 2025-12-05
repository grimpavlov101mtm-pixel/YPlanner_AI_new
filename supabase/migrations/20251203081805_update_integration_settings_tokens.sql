/*
  # Update integration settings to use partner and user tokens

  1. Changes
    - Remove yclients_token column (old single token field)
    - Remove yclients_branch_id column (not needed)
    - Add yclients_partner_token column (required for API auth)
    - Add yclients_user_token column (optional for API auth)
    
  2. Notes
    - Partner token is required for all API requests
    - User token is optional and used for user-specific operations
    - Follows yClients API authorization requirements
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'yclients_token'
  ) THEN
    ALTER TABLE integration_settings DROP COLUMN yclients_token;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'yclients_branch_id'
  ) THEN
    ALTER TABLE integration_settings DROP COLUMN yclients_branch_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'yclients_partner_token'
  ) THEN
    ALTER TABLE integration_settings ADD COLUMN yclients_partner_token text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'yclients_user_token'
  ) THEN
    ALTER TABLE integration_settings ADD COLUMN yclients_user_token text;
  END IF;
END $$;
