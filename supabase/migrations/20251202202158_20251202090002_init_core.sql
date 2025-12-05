/*
  # YPlanner AI - Core Schema Initialization

  1. New Types
    - `role_enum` - User roles (ORG_ADMIN, BRANCH_ADMIN, BRANCH_MANAGER, BRANCH_ANALYST)
    - `recommendation_status` - Status of AI recommendations
    - `route_status` - Status of route optimization
    - `time_grain` - Aggregation level for analytics
    - `horizon_enum` - Time horizon for forecasting

  2. New Tables
    - `organizations` - Top-level organizations/companies
    - `profiles` - User profiles linked to auth.users
    - `branches` - Physical locations/branches
    - `branch_settings` - Configuration per branch

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read their org data
    - Service role has full access for Edge Functions

  4. Important Notes
    - All timestamps stored in UTC
    - Unique constraints on yClients IDs to prevent duplicates
    - Auto-update triggers for updated_at fields
*/

DO $$ BEGIN
  CREATE TYPE role_enum AS ENUM ('ORG_ADMIN','BRANCH_ADMIN','BRANCH_MANAGER','BRANCH_ANALYST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recommendation_status AS ENUM ('pending','applied','rejected','failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE route_status AS ENUM ('planned','sent','completed','cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE time_grain AS ENUM ('day','week','month');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE horizon_enum AS ENUM ('week','month','quarter','year');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  full_name text,
  role role_enum NOT NULL DEFAULT 'BRANCH_MANAGER',
  telegram_chat_id bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
      ON profiles FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Users can read own organization'
  ) THEN
    CREATE POLICY "Users can read own organization"
      ON organizations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.org_id = organizations.id
          AND profiles.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  yclients_company_id integer NOT NULL,
  yclients_branch_id integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, yclients_company_id, yclients_branch_id)
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'branches' 
    AND policyname = 'Users can read branches in their org'
  ) THEN
    CREATE POLICY "Users can read branches in their org"
      ON branches FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.org_id = branches.org_id
          AND profiles.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id uuid PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  primary_tz text NOT NULL DEFAULT 'Europe/Moscow',
  default_horizon horizon_enum NOT NULL DEFAULT 'week',
  default_time_grain time_grain NOT NULL DEFAULT 'day',
  sync_interval_minutes int NOT NULL DEFAULT 15,
  overload_threshold int NOT NULL DEFAULT 85,
  mobile_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'branch_settings' 
    AND policyname = 'Users can read branch settings in their org'
  ) THEN
    CREATE POLICY "Users can read branch settings in their org"
      ON branch_settings FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = branch_settings.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_branch_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_branch_settings_updated_at
      BEFORE UPDATE ON branch_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_default_branch_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO branch_settings (branch_id)
  VALUES (NEW.id)
  ON CONFLICT (branch_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_branch_settings_on_branch_insert'
  ) THEN
    CREATE TRIGGER create_branch_settings_on_branch_insert
      AFTER INSERT ON branches
      FOR EACH ROW
      EXECUTE FUNCTION create_default_branch_settings();
  END IF;
END $$;