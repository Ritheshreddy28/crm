-- Users must be able to SELECT their own login_history rows so recordLogout can find the session to update (logout_at, duration_seconds).
CREATE POLICY "Users can view own login history"
  ON user_login_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
