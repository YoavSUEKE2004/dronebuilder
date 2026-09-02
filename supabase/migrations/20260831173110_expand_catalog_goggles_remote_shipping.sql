/*
# Expand Catalog: Goggles, Remote, Shipping Cost, New Cameras

## Overview
1. Adds `shipping_cost` column to `components` table (numeric, default 0).
2. Expands the `category` CHECK constraint to include 'goggles' and 'remote'.
3. Seeds 5 new cameras with product image URLs (Caddx Ratel 2, RunCam Phoenix 2, DJI O3 Air Unit, Walksnail Avatar HD, Foxeer Toothless 2).
4. Seeds goggles options (DJI Goggles 2, Fat Shark Dominator, HDZero Goggles).
5. Seeds remote/controller options (RadioMaster TX16S, RadioMaster Boxer, TBS Tango 2).
6. Adds shipping_cost to all existing components.
7. Adds electrical_specs for new cameras, goggles, and remotes.

## Modified Tables
- `components`: added `shipping_cost` column; expanded category CHECK.

## Security
- No policy changes — existing anon+authenticated CRUD policies cover new rows.
*/

-- 1. Add shipping_cost column
ALTER TABLE components ADD COLUMN IF NOT EXISTS shipping_cost numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Expand category CHECK constraint to include goggles and remote
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'components_category_check'
      AND conrelid = 'components'::regclass
  ) THEN
    ALTER TABLE components DROP CONSTRAINT components_category_check;
  END IF;
END $$;

ALTER TABLE components ADD CONSTRAINT components_category_check
  CHECK (category IN ('frame','motor','esc','flight_controller','propeller','battery','camera','vtx','receiver','goggles','remote'));

-- 3. Set shipping_cost on existing components (based on store/typical shipping)
UPDATE components SET shipping_cost = 4.99 WHERE store_name = 'GetFPV' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 2.99 WHERE store_name = 'Banggood' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.99 WHERE store_name = 'PyroDrone' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 0.00 WHERE store_name = 'EMAX' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.49 WHERE store_name = 'Hobbywing' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 0.00 WHERE store_name = 'SpeedyBee' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 4.50 WHERE store_name = 'Holybro' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 0.00 WHERE store_name = 'BetaFPV' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.99 WHERE store_name = 'CNHL' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.99 WHERE store_name = 'RunCam' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.99 WHERE store_name = 'Foxeer' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 4.99 WHERE store_name = 'TBS' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 0.00 WHERE store_name = 'DJI' AND shipping_cost = 0;
UPDATE components SET shipping_cost = 3.99 WHERE store_name = 'FrSky' AND shipping_cost = 0;

-- 4. Update existing cameras with image URLs
UPDATE components SET image_url = '/caddx-ratel-2.webp' WHERE name = 'Caddx Ratel 2';
UPDATE components SET image_url = '/runcam-phoenix-2.webp' WHERE name = 'RunCam Phoenix 2';

-- 5. Insert new cameras
INSERT INTO components (name, category, price, shipping_cost, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('DJI O3 Air Unit', 'camera', 229.99, 0.00, 'DJI', 'https://dji.com/o3-air-unit', '/dji-o3-air-unit.webp', '32x32mm', '20x20', 12.0, 5, 10),
('Walksnail Avatar HD', 'camera', 119.99, 4.99, 'GetFPV', 'https://getfpv.com/walksnail-avatar', '/walksnail-avatar-hd.webp', '19x19mm', '19x19', 6.0, 3, 9),
('Foxeer Toothless 2', 'camera', 49.99, 3.99, 'Foxeer', 'https://foxeer.com/toothless-2', '/foxeer-toothless-2.webp', '19x19mm', '19x19', 4.5, 7, 8)
ON CONFLICT DO NOTHING;

-- 6. Insert goggles
INSERT INTO components (name, category, price, shipping_cost, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('DJI Goggles 2', 'goggles', 499.99, 0.00, 'DJI', 'https://dji.com/goggles-2', '', '180x130x110mm', 'N/A', 290.0, 5, 10),
('Fat Shark Dominator HD', 'goggles', 329.99, 4.99, 'GetFPV', 'https://getfpv.com/fatshark-dominator-hd', '', '170x120x100mm', 'N/A', 220.0, 3, 9),
('HDZero Goggles', 'goggles', 399.99, 0.00, 'HDZero', 'https://hdzero.com/goggles', '', '175x125x105mm', 'N/A', 250.0, 7, 9),
('Walksnail VRX Module', 'goggles', 79.99, 4.99, 'GetFPV', 'https://getfpv.com/walksnail-vrx', '', '40x40x15mm', 'N/A', 25.0, 3, 8)
ON CONFLICT DO NOTHING;

-- 7. Insert remotes (radio controllers)
INSERT INTO components (name, category, price, shipping_cost, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('RadioMaster TX16S', 'remote', 199.99, 0.00, 'RadioMaster', 'https://radiomasterrc.com/tx16s', '', '170x130x70mm', 'N/A', 430.0, 5, 10),
('RadioMaster Boxer', 'remote', 129.99, 0.00, 'RadioMaster', 'https://radiomasterrc.com/boxer', '', '150x110x60mm', 'N/A', 320.0, 5, 9),
('TBS Tango 2', 'remote', 179.99, 4.99, 'TBS', 'https://tbs.com/tango2', '', '160x120x65mm', 'N/A', 380.0, 5, 8)
ON CONFLICT DO NOTHING;

-- 8. Electrical specs for new cameras
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Digital' FROM components c WHERE c.name = 'DJI O3 Air Unit'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Digital' FROM components c WHERE c.name = 'Walksnail Avatar HD'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Analog' FROM components c WHERE c.name = 'Foxeer Toothless 2'
ON CONFLICT (component_id) DO NOTHING;

-- 9. Electrical specs for goggles (protocol = video link type)
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Digital' FROM components c WHERE c.name = 'DJI Goggles 2'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Analog' FROM components c WHERE c.name = 'Fat Shark Dominator HD'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Digital' FROM components c WHERE c.name = 'HDZero Goggles'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'Digital' FROM components c WHERE c.name = 'Walksnail VRX Module'
ON CONFLICT (component_id) DO NOTHING;

-- 10. Electrical specs for remotes (protocol = radio link protocol)
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'ELRS' FROM components c WHERE c.name = 'RadioMaster TX16S'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'ELRS' FROM components c WHERE c.name = 'RadioMaster Boxer'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, NULL, NULL, NULL, NULL, 'CRSF' FROM components c WHERE c.name = 'TBS Tango 2'
ON CONFLICT (component_id) DO NOTHING;
