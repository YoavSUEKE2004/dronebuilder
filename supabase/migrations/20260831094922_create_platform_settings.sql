CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_percentage numeric DEFAULT 5.0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO platform_settings (commission_percentage)
VALUES (5.0)
ON CONFLICT DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_platform_settings" ON platform_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "update_platform_settings" ON platform_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "insert_platform_settings" ON platform_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
