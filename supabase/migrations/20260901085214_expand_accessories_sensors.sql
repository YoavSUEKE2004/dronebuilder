/*
# Expand Accessories Catalog with Sensors

## Overview
Adds sensor and module products to the `receiver` category (labeled "Accessories" in the UI) to expand the accessory catalog with LiDAR, GPS, optical flow, and current/power sensors.

## New Products
1. TFmini Plus LiDAR Sensor — LiDAR / Rangefinder for altitude hold
2. Matek Optical Flow & Lidar Sensor — Optical flow + LiDAR combo
3. Matek M10Q-5883 GPS Module — GPS / rescue module
4. Matek Current & Power Sensor — current/power monitoring

## Modified Tables
- `components`: new rows inserted into existing `receiver` category
- `electrical_specs`: new rows for sensor electrical protocols

## Security
- No policy changes — existing anon+authenticated CRUD policies cover new rows.
*/

INSERT INTO components (name, category, price, shipping_cost, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('TFmini Plus LiDAR Sensor', 'receiver', 39.99, 4.99, 'GetFPV', 'https://getfpv.com/tfmini-plus', '', '45x20x15mm', '20x20', 5.0, 3, 9),
('Matek Optical Flow & Lidar', 'receiver', 59.99, 3.99, 'Matek', 'https://mateksys.com/optical-flow-lidar', '', '40x40x12mm', '30.5x30.5', 8.0, 7, 9),
('Matek M10Q-5883 GPS Module', 'receiver', 49.99, 3.99, 'Matek', 'https://mateksys.com/m10q-5883', '', '35x35x8mm', '30.5x30.5', 12.0, 7, 10),
('Matek Current & Power Sensor', 'receiver', 24.99, 3.99, 'Matek', 'https://mateksys.com/current-power-sensor', '', '30x20x6mm', '30.5x30.5', 4.0, 7, 8)
ON CONFLICT DO NOTHING;

-- Electrical specs for sensors
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 5, 3, NULL, NULL, 'I2C' FROM components c WHERE c.name = 'TFmini Plus LiDAR Sensor'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 5, 3, NULL, NULL, 'I2C' FROM components c WHERE c.name = 'Matek Optical Flow & Lidar'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 5, 3, NULL, NULL, 'UART' FROM components c WHERE c.name = 'Matek M10Q-5883 GPS Module'
ON CONFLICT (component_id) DO NOTHING;
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT c.id, 6, 2, 90, NULL, 'ADC' FROM components c WHERE c.name = 'Matek Current & Power Sensor'
ON CONFLICT (component_id) DO NOTHING;
