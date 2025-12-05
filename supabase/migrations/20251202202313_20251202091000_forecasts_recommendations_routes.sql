/*
  # Forecasts, Recommendations, and Routes Tables

  1. New Tables
    - `demand_forecasts` - AI-generated demand predictions
      - `id` (uuid, primary key)
      - `branch_id` (uuid, references branches)
      - `service_id` (uuid, references services, nullable for branch-level)
      - `bucket_start` (timestamptz)
      - `bucket_end` (timestamptz)
      - `time_grain` (time_grain enum)
      - `expected_bookings` (numeric)
      - `expected_load_percent` (integer)
      - `created_at` (timestamptz)
    
    - `ai_recommendations` - AI-generated recommendations for optimization
      - `id` (uuid, primary key)
      - `branch_id` (uuid, references branches)
      - `type` (text - e.g., 'shift_rebalance', 'staff_replacement', 'add_slot')
      - `status` (recommendation_status enum)
      - `payload` (jsonb - recommendation details)
      - `effect_estimate` (jsonb - estimated impact)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `routes` - Optimized routes for mobile services
      - `id` (uuid, primary key)
      - `branch_id` (uuid, references branches)
      - `date` (date)
      - `status` (route_status enum)
      - `summary` (jsonb - total distance, time, etc.)
      - `created_at` (timestamptz)
    
    - `route_stops` - Individual stops in optimized routes
      - `id` (uuid, primary key)
      - `route_id` (uuid, references routes)
      - `staff_id` (uuid, references staff)
      - `booking_id` (uuid, references bookings)
      - `seq` (integer - stop sequence)
      - `eta` (timestamptz - estimated time of arrival)
      - `yandex_link` (text - deeplink to Yandex Maps)

  2. Security
    - Enable RLS on all tables
    - Users can read data from branches in their org

  3. Important Notes
    - Unique constraint on forecasts per time bucket
    - Unique constraint on routes per branch per date
    - Composite primary key on route_stops for route_id + seq
*/

CREATE TABLE IF NOT EXISTS demand_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  bucket_end timestamptz NOT NULL,
  time_grain time_grain NOT NULL,
  expected_bookings numeric NOT NULL,
  expected_load_percent int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, service_id, bucket_start, bucket_end, time_grain)
);

ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'demand_forecasts' 
    AND policyname = 'Users can read forecasts in their org'
  ) THEN
    CREATE POLICY "Users can read forecasts in their org"
      ON demand_forecasts FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = demand_forecasts.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type text NOT NULL,
  status recommendation_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  effect_estimate jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_recommendations' 
    AND policyname = 'Users can read recommendations in their org'
  ) THEN
    CREATE POLICY "Users can read recommendations in their org"
      ON ai_recommendations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = ai_recommendations.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ai_recommendations_updated_at'
  ) THEN
    CREATE TRIGGER update_ai_recommendations_updated_at
      BEFORE UPDATE ON ai_recommendations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date date NOT NULL,
  status route_status NOT NULL DEFAULT 'planned',
  summary jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, date)
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'routes' 
    AND policyname = 'Users can read routes in their org'
  ) THEN
    CREATE POLICY "Users can read routes in their org"
      ON routes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM branches b
          JOIN profiles p ON p.org_id = b.org_id
          WHERE b.id = routes.branch_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS route_stops (
  id uuid DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  seq int NOT NULL,
  eta timestamptz,
  yandex_link text,
  PRIMARY KEY (route_id, seq)
);

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'route_stops' 
    AND policyname = 'Users can read route stops in their org'
  ) THEN
    CREATE POLICY "Users can read route stops in their org"
      ON route_stops FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM routes r
          JOIN branches b ON b.id = r.branch_id
          JOIN profiles p ON p.org_id = b.org_id
          WHERE r.id = route_stops.route_id
          AND p.id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_branch_id ON demand_forecasts(branch_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_bucket_start ON demand_forecasts(bucket_start);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_branch_id ON ai_recommendations(branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_routes_branch_id ON routes(branch_id);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(date);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);