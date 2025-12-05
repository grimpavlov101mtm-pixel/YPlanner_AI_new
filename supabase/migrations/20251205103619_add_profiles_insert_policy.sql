/*
  # Add INSERT policy for profiles table

  1. Changes
    - Add INSERT policy for profiles table to allow users to create their own profile
    
  2. Security
    - Users can only insert their own profile (id must match auth.uid())
    - This is required for user registration and initial profile creation
*/

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
