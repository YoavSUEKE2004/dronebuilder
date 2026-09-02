/*
# Drone Configurator Schema

## Overview
Creates the full database schema for a custom drone configurator app.
No sign-in screen, so all tables are single-tenant / public-read with anon+authenticated CRUD access.

## New Tables
1. `components` — catalog of drone parts (frame, motor, esc, flight_controller, propeller, battery, camera, vtx, receiver).
2. `electrical_specs` — 1:1 with components that have electrical properties.
3. `builders` — assembly professionals users can hire.
4. `builds` — saved orders (kit or builder-assembled).

## Security
- RLS enabled on all tables.
- All tables allow anon+authenticated full CRUD (no-auth, public catalog app).

## Notes
1. Seed data includes realistic components across all 9 categories with electrical specs.
2. Three sample builders are seeded.
*/

-- ============================================================
-- COMPONENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('frame','motor','esc','flight_controller','propeller','battery','camera','vtx','receiver')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  store_name text NOT NULL DEFAULT '',
  product_url text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  dimensions_mm text NOT NULL DEFAULT '',
  mounting_pattern text NOT NULL DEFAULT '',
  weight_g numeric(8,2) NOT NULL DEFAULT 0,
  shipping_days int NOT NULL DEFAULT 7,
  quality_score int NOT NULL DEFAULT 5 CHECK (quality_score BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_components" ON components;
CREATE POLICY "anon_select_components" ON components FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_components" ON components;
CREATE POLICY "anon_insert_components" ON components FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_components" ON components;
CREATE POLICY "anon_update_components" ON components FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_components" ON components;
CREATE POLICY "anon_delete_components" ON components FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);

-- ============================================================
-- ELECTRICAL SPECS
-- ============================================================
CREATE TABLE IF NOT EXISTS electrical_specs (
  component_id uuid PRIMARY KEY REFERENCES components(id) ON DELETE CASCADE,
  max_voltage_s numeric(4,1),
  min_voltage_s numeric(4,1),
  max_current_a numeric(8,1),
  bec_output_v numeric(4,1),
  protocol text NOT NULL DEFAULT ''
);

ALTER TABLE electrical_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_electrical_specs" ON electrical_specs;
CREATE POLICY "anon_select_electrical_specs" ON electrical_specs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_electrical_specs" ON electrical_specs;
CREATE POLICY "anon_insert_electrical_specs" ON electrical_specs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_electrical_specs" ON electrical_specs;
CREATE POLICY "anon_update_electrical_specs" ON electrical_specs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_electrical_specs" ON electrical_specs;
CREATE POLICY "anon_delete_electrical_specs" ON electrical_specs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- BUILDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  bio text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  subscription_status text NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free','pro','elite')),
  assembly_fee numeric(10,2) NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE builders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_builders" ON builders;
CREATE POLICY "anon_select_builders" ON builders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_builders" ON builders;
CREATE POLICY "anon_insert_builders" ON builders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_builders" ON builders;
CREATE POLICY "anon_update_builders" ON builders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_builders" ON builders;
CREATE POLICY "anon_delete_builders" ON builders FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- BUILDS
-- ============================================================
CREATE TABLE IF NOT EXISTS builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid,
  builder_id uuid REFERENCES builders(id) ON DELETE SET NULL,
  selected_parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_type text NOT NULL DEFAULT 'kit' CHECK (fulfillment_type IN ('kit','builder')),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  platform_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  build_status text NOT NULL DEFAULT 'draft' CHECK (build_status IN ('draft','ordered','assembling','shipped','delivered')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_builds" ON builds;
CREATE POLICY "anon_select_builds" ON builds FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_builds" ON builds;
CREATE POLICY "anon_insert_builds" ON builds FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_builds" ON builds;
CREATE POLICY "anon_update_builds" ON builds FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_builds" ON builds;
CREATE POLICY "anon_delete_builds" ON builds FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- SEED: COMPONENTS
-- ============================================================
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('Apex 5" Carbon Frame', 'frame', 119.99, 'GetFPV', 'https://getfpv.com/apex5', '', '220mm wheelbase', '30.5x30.5', 82.0, 3, 10),
('Martian II 5" Frame', 'frame', 59.99, 'Banggood', 'https://banggood.com/martian2', '', '220mm wheelbase', '30.5x30.5', 95.0, 14, 7),
('Source One 7" Frame', 'frame', 49.99, 'PyroDrone', 'https://pyrodrone.com/source1', '', '280mm wheelbase', '30.5x30.5', 130.0, 5, 8),
('T-Motor F40 Pro IV 2400KV', 'motor', 32.90, 'GetFPV', 'https://getfpv.com/f40pro', '', '28x28mm', '16x19', 8.2, 3, 10),
('EMAX RSII 2306 2400KV', 'motor', 24.99, 'EMAX', 'https://emax.com/rsii', '', '28x28mm', '16x19', 7.5, 7, 8),
('BrotherHobby 2207 2500KV', 'motor', 19.99, 'Banggood', 'https://banggood.com/bh2207', '', '28x28mm', '16x19', 6.8, 14, 6),
('Hobbywing XRotor 60A 4-in-1', 'esc', 69.99, 'Hobbywing', 'https://hobbywing.com/xrotor60', '', '36x36mm', '30.5x30.5', 12.0, 5, 10),
('BLHeli32 50A 4-in-1', 'esc', 39.99, 'Banggood', 'https://banggood.com/blheli32', '', '36x36mm', '30.5x30.5', 10.0, 14, 7),
('T-Motor F55A Pro II 4-in-1', 'esc', 89.99, 'GetFPV', 'https://getfpv.com/f55a', '', '36x36mm', '30.5x30.5', 11.5, 3, 10),
('SpeedyBee F405 V4', 'flight_controller', 49.99, 'SpeedyBee', 'https://speedybee.com/f405v4', '', '36x36mm', '30.5x30.5', 8.0, 7, 8),
('Holybro Kakute H7', 'flight_controller', 79.99, 'Holybro', 'https://holybro.com/kakuteh7', '', '36x36mm', '30.5x30.5', 9.0, 5, 10),
('BetaFPV F4 2-6S AIO', 'flight_controller', 34.99, 'BetaFPV', 'https://betafpv.com/f4aio', '', '25x25mm', '20x20', 5.0, 10, 7),
('Gemfan 51466 Tri-Blade', 'propeller', 8.99, 'GetFPV', 'https://getfpv.com/gemfan51466', '', '5.1 inch', '5mm shaft', 4.0, 3, 9),
('HQProp T5x4x3', 'propeller', 6.49, 'PyroDrone', 'https://pyrodrone.com/hqt54', '', '5.0 inch', '5mm shaft', 3.5, 5, 9),
('DALProp Cyclone 5045', 'propeller', 5.99, 'Banggood', 'https://banggood.com/dal5045', '', '5.0 inch', '5mm shaft', 4.2, 14, 6),
('Tattu R-Line 1500mAh 6S', 'battery', 44.99, 'GetFPV', 'https://getfpv.com/tattu1500', '', '75x35x28mm', 'XT60', 230.0, 3, 10),
('CNHL Black 1300mAh 6S', 'battery', 29.99, 'CNHL', 'https://cnhl.com/black1300', '', '70x35x26mm', 'XT60', 210.0, 10, 7),
('Gens Ace 1100mAh 4S', 'battery', 24.99, 'Banggood', 'https://banggood.com/gensace1100', '', '65x30x22mm', 'XT60', 160.0, 14, 6),
('Caddx Ratel 2', 'camera', 39.99, 'GetFPV', 'https://getfpv.com/ratel2', '', '19x19mm', '19x19', 4.5, 3, 9),
('RunCam Phoenix 2', 'camera', 44.99, 'RunCam', 'https://runcam.com/phoenix2', '', '19x19mm', '19x19', 5.0, 7, 9),
('Foxeer Razer Micro', 'camera', 34.99, 'Foxeer', 'https://foxeer.com/razer', '', '19x19mm', '19x19', 4.0, 10, 7),
('Analog VTX Whoop 800mW', 'vtx', 29.99, 'GetFPV', 'https://getfpv.com/vtx800', '', '20x20mm', '20x20', 3.0, 3, 8),
('TBS Unify Pro32', 'vtx', 54.99, 'TBS', 'https://tbs.com/unify32', '', '28x28mm', '20x20', 5.5, 5, 10),
('HDO O3 Air Unit', 'vtx', 129.99, 'DJI', 'https://dji.com/o3', '', '32x32mm', '20x20', 12.0, 7, 10),
('ExpressLRS Diversity RX', 'receiver', 19.99, 'GetFPV', 'https://getfpv.com/elrsrx', '', '20x12mm', '20x20', 1.0, 3, 10),
('FrSky R-XSR', 'receiver', 24.99, 'FrSky', 'https://frsky.com/rxsr', '', '16x11mm', '20x20', 1.5, 7, 7),
('FlySky FS-A8S', 'receiver', 14.99, 'Banggood', 'https://banggood.com/a8s', '', '16x11mm', '20x20', 1.2, 14, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: ELECTRICAL SPECS
-- ============================================================
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, NULL, '' FROM components c WHERE c.name = 'T-Motor F40 Pro IV 2400KV'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, NULL, '' FROM components c WHERE c.name = 'EMAX RSII 2306 2400KV'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, NULL, '' FROM components c WHERE c.name = 'BrotherHobby 2207 2500KV'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, 60, 5, 'DSHOT600' FROM components c WHERE c.name = 'Hobbywing XRotor 60A 4-in-1'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, 50, 5, 'DSHOT600' FROM components c WHERE c.name = 'BLHeli32 50A 4-in-1'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, 55, 5, 'DSHOT600' FROM components c WHERE c.name = 'T-Motor F55A Pro II 4-in-1'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, 5, 'CRSF' FROM components c WHERE c.name = 'SpeedyBee F405 V4'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 8, 3, NULL, 9, 'CRSF' FROM components c WHERE c.name = 'Holybro Kakute H7'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 2, NULL, 5, 'CRSF' FROM components c WHERE c.name = 'BetaFPV F4 2-6S AIO'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, NULL, NULL, NULL, '' FROM components c WHERE c.name = 'Tattu R-Line 1500mAh 6S'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, NULL, NULL, NULL, '' FROM components c WHERE c.name = 'CNHL Black 1300mAh 6S'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 4, NULL, NULL, NULL, '' FROM components c WHERE c.name = 'Gens Ace 1100mAh 4S'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Analog' FROM components c WHERE c.name = 'Caddx Ratel 2'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Analog' FROM components c WHERE c.name = 'RunCam Phoenix 2'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Analog' FROM components c WHERE c.name = 'Foxeer Razer Micro'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, 5, 'Analog' FROM components c WHERE c.name = 'Analog VTX Whoop 800mW'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, 5, 'SmartAudio' FROM components c WHERE c.name = 'TBS Unify Pro32'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 3, NULL, 5, 'Digital' FROM components c WHERE c.name = 'HDO O3 Air Unit'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 2, NULL, NULL, 'CRSF' FROM components c WHERE c.name = 'ExpressLRS Diversity RX'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 2, NULL, NULL, 'FrSky' FROM components c WHERE c.name = 'FrSky R-XSR'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 2, NULL, NULL, 'IBUS' FROM components c WHERE c.name = 'FlySky FS-A8S'
ON CONFLICT (component_id) DO NOTHING;

-- ============================================================
-- SEED: BUILDERS
-- ============================================================
INSERT INTO builders (bio, location, subscription_status, assembly_fee, rating) VALUES
('FAA-certified drone builder with 8 years of FPV racing experience. Specializes in 5-inch freestyle builds.', 'Austin, TX', 'elite', 75.00, 4.9),
('Professional cinematography drone builder. DJI and custom long-range expert.', 'Los Angeles, CA', 'pro', 55.00, 4.7),
('Hobbyist turned pro. Quick turnaround on budget kits and beginner builds.', 'Denver, CO', 'free', 30.00, 4.3)
ON CONFLICT DO NOTHING;