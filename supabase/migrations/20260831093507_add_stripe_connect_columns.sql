-- Add stripe_account_id to builders table for Stripe Connect transfers
ALTER TABLE builders ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Create vendor_stripe_accounts table to map store names to Stripe connected accounts
CREATE TABLE IF NOT EXISTS vendor_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL UNIQUE,
  stripe_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendor_stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vendor_stripe_accounts" ON vendor_stripe_accounts;
CREATE POLICY "anon_select_vendor_stripe_accounts" ON vendor_stripe_accounts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vendor_stripe_accounts" ON vendor_stripe_accounts;
CREATE POLICY "anon_insert_vendor_stripe_accounts" ON vendor_stripe_accounts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vendor_stripe_accounts" ON vendor_stripe_accounts;
CREATE POLICY "anon_update_vendor_stripe_accounts" ON vendor_stripe_accounts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vendor_stripe_accounts" ON vendor_stripe_accounts;
CREATE POLICY "anon_delete_vendor_stripe_accounts" ON vendor_stripe_accounts FOR DELETE
  TO anon, authenticated USING (true);

-- Seed placeholder vendor accounts (would be real Stripe account IDs in production)
INSERT INTO vendor_stripe_accounts (store_name, stripe_account_id) VALUES
('GetFPV', 'acct_placeholder_getfpv'),
('Banggood', 'acct_placeholder_banggood'),
('PyroDrone', 'acct_placeholder_pyrodrone'),
('EMAX', 'acct_placeholder_emax'),
('Hobbywing', 'acct_placeholder_hobbywing'),
('SpeedyBee', 'acct_placeholder_speedybee'),
('Holybro', 'acct_placeholder_holybro'),
('BetaFPV', 'acct_placeholder_betafpv'),
('CNHL', 'acct_placeholder_cnhl'),
('RunCam', 'acct_placeholder_runcam'),
('Foxeer', 'acct_placeholder_foxeer'),
('TBS', 'acct_placeholder_tbs'),
('DJI', 'acct_placeholder_dji'),
('FrSky', 'acct_placeholder_frsky')
ON CONFLICT (store_name) DO NOTHING;