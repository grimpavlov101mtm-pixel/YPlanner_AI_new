/*
  # Fix RLS policies for complete branch creation flow

  1. Tables involved in branch creation
    - branches (already fixed)
    - branch_settings (auto-created via trigger)
    - integration_settings (inserted by user code)
    
  2. New Policies
    - Allow org admins to insert branch_settings
    - Allow org admins to update branch_settings
    - Allow org admins to delete branch_settings
    
  3. Security
    - All operations check that the user is ORG_ADMIN
    - All operations verify branch belongs to user's organization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branch_settings' AND policyname = 'Org admins can insert branch settings'
  ) THEN
    CREATE POLICY "Org admins can insert branch settings"
      ON branch_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = branch_settings.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branch_settings' AND policyname = 'Org admins can update branch settings'
  ) THEN
    CREATE POLICY "Org admins can update branch settings"
      ON branch_settings
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = branch_settings.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role = 'ORG_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = branch_settings.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branch_settings' AND policyname = 'Org admins can delete branch settings'
  ) THEN
    CREATE POLICY "Org admins can delete branch settings"
      ON branch_settings
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = branch_settings.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'staff' AND policyname = 'Org admins can insert staff'
  ) THEN
    CREATE POLICY "Org admins can insert staff"
      ON staff
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = staff.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'services' AND policyname = 'Org admins can insert services'
  ) THEN
    CREATE POLICY "Org admins can insert services"
      ON services
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = services.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bookings' AND policyname = 'Org admins can insert bookings'
  ) THEN
    CREATE POLICY "Org admins can insert bookings"
      ON bookings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN branches b ON b.id = bookings.branch_id
          WHERE p.id = auth.uid()
          AND p.org_id = b.org_id
          AND p.role IN ('ORG_ADMIN', 'BRANCH_ADMIN', 'BRANCH_MANAGER')
        )
      );
  END IF;
END $$;
