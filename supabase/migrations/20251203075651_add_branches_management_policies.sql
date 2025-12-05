/*
  # Add RLS policies for branch management

  1. New Policies
    - Allow org admins to insert new branches
    - Allow org admins to update branches in their org
    - Allow org admins to delete branches in their org
    
  2. Security
    - Only ORG_ADMIN can create, update, or delete branches
    - All operations check that the branch belongs to the admin's organization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branches' AND policyname = 'Org admins can insert branches'
  ) THEN
    CREATE POLICY "Org admins can insert branches"
      ON branches
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.org_id = branches.org_id
          AND profiles.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branches' AND policyname = 'Org admins can update branches'
  ) THEN
    CREATE POLICY "Org admins can update branches"
      ON branches
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.org_id = branches.org_id
          AND profiles.role = 'ORG_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.org_id = branches.org_id
          AND profiles.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'branches' AND policyname = 'Org admins can delete branches'
  ) THEN
    CREATE POLICY "Org admins can delete branches"
      ON branches
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.org_id = branches.org_id
          AND profiles.role = 'ORG_ADMIN'
        )
      );
  END IF;
END $$;
