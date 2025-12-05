/*
  # Staff, Services, and Bookings Tables

  1. New Tables
    - `staff` - Employees/specialists
    - `services` - Services offered
    - `bookings` - Client appointments

  2. Security
    - Enable RLS on all tables
    - Users can read data from branches in their org

  3. Important Constraints
    - Prevent double-booking via EXCLUDE constraint on overlapping time ranges
    - Unique constraints on yClients IDs per branch
    - Enable btree_gist extension for UUID + time range overlap detection
*/

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('booked','cancelled','completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  yclients_staff_id integer NOT NULL,
  name text NOT NULL,
  skills jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, yclients_staff_id)
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'staff' 
    AND policyname = 'Users can read staff in their org'
  ) THEN
    CREATE POLICY "Users can read staff in their org"
      ON staff FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = staff.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  yclients_service_id integer NOT NULL,
  name text NOT NULL,
  duration_minutes int NOT NULL,
  is_mobile boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, yclients_service_id)
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'services' 
    AND policyname = 'Users can read services in their org'
  ) THEN
    CREATE POLICY "Users can read services in their org"
      ON services FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = services.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  yclients_record_id bigint NOT NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  starts_at_utc timestamptz NOT NULL,
  ends_at_utc timestamptz NOT NULL,
  status booking_status NOT NULL DEFAULT 'booked',
  is_mobile boolean NOT NULL DEFAULT false,
  client_name text,
  client_phone text,
  address text,
  latitude numeric,
  longitude numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, yclients_record_id)
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'bookings' 
    AND policyname = 'Users can read bookings in their org'
  ) THEN
    CREATE POLICY "Users can read bookings in their org"
      ON bookings FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = bookings.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(starts_at_utc, ends_at_utc) WITH &&
      )
      WHERE (status = 'booked');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_bookings_updated_at'
  ) THEN
    CREATE TRIGGER update_bookings_updated_at
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at_utc);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_staff_branch_id ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_services_branch_id ON services(branch_id);