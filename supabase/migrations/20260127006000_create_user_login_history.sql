-- User login history for admin "Time Spent" section: track login/logout and session duration.
CREATE TABLE IF NOT EXISTS user_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  duration_seconds numeric
);

COMMENT ON TABLE user_login_history IS 'Tracks user logins and session duration for admin Time Spent / login history.';
CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON user_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_history_login_at ON user_login_history(login_at DESC);

ALTER TABLE user_login_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all login history
CREATE POLICY "Admins can view all login history"
  ON user_login_history FOR SELECT
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');

-- Authenticated users can insert their own row (on login)
CREATE POLICY "Users can insert own login"
  ON user_login_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own rows (set logout_at on sign out)
CREATE POLICY "Users can update own login"
  ON user_login_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
