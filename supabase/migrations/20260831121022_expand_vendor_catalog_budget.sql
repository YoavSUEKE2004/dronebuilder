/*
# Expand vendor catalog with budget-friendly global retailers
Adds AliExpress, Temu, and Amazon parts across every category.
*/

-- Frames
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress Mark4 5" Frame Kit', 'frame', 17.99, 'AliExpress', 'https://aliexpress.com', '', '220mm', '30.5x30.5', 78, 21, 5),
('Temu CineLog35 3.5" Frame', 'frame', 14.99, 'Temu', 'https://temu.com', '', '100mm', '16x16', 16, 14, 4),
('Amazon HGLRC Windfire 3" Frame', 'frame', 22.99, 'Amazon', 'https://amazon.com', '', '90mm', '16x16', 11, 3, 7),
('AliExpress Source One 5" Clone', 'frame', 12.99, 'AliExpress', 'https://aliexpress.com', '', '220mm', '30.5x30.5', 80, 21, 4),
('Temu F4 7" Frame Kit', 'frame', 19.99, 'Temu', 'https://temu.com', '', '275mm', '30.5x30.5', 92, 14, 5),
('Amazon Apex 5" Clone Frame', 'frame', 29.99, 'Amazon', 'https://amazon.com', '', '225mm', '30.5x30.5', 70, 3, 6),
('AliExpress Pavo Pico 3" Clone', 'frame', 11.99, 'AliExpress', 'https://aliexpress.com', '', '85mm', '16x16', 14, 21, 4),
('Temu Babyhawk 3" Frame', 'frame', 13.99, 'Temu', 'https://temu.com', '', '88mm', '16x16', 12, 14, 5),
('Amazon ARWing 7" Frame', 'frame', 34.99, 'Amazon', 'https://amazon.com', '', '285mm', '30.5x30.5', 90, 3, 7);

-- Motors
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress 1404 3000KV Brushless Motor', 'motor', 9.99, 'AliExpress', 'https://aliexpress.com', '', '14mm', '5mm shaft', 7, 21, 5),
('Temu 2207 2400KV Motor', 'motor', 8.99, 'Temu', 'https://temu.com', '', '22mm', '5mm shaft', 34, 14, 4),
('Amazon Racerstar 2306 2450KV Motor', 'motor', 12.99, 'Amazon', 'https://amazon.com', '', '23mm', '5mm shaft', 33, 3, 6),
('AliExpress T-Motor F40 Clone 2400KV', 'motor', 14.99, 'AliExpress', 'https://aliexpress.com', '', '40mm', '5mm shaft', 33, 21, 5),
('Temu iFlight 2306 1750KV Motor', 'motor', 7.99, 'Temu', 'https://temu.com', '', '23mm', '5mm shaft', 35, 14, 4),
('Amazon HGLRC Zeus 1404 3500KV', 'motor', 15.99, 'Amazon', 'https://amazon.com', '', '14mm', '5mm shaft', 6, 3, 7),
('AliExpress 2806 1300KV Motor', 'motor', 16.99, 'AliExpress', 'https://aliexpress.com', '', '28mm', '5mm shaft', 52, 21, 5),
('Temu SunnySky X3508 700KV Clone', 'motor', 13.99, 'Temu', 'https://temu.com', '', '35mm', '5mm shaft', 66, 14, 4),
('Amazon Racerstar 3508 700KV', 'motor', 18.99, 'Amazon', 'https://amazon.com', '', '35mm', '5mm shaft', 68, 3, 6);

-- ESCs
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress 45A 4-in-1 ESC', 'esc', 16.99, 'AliExpress', 'https://aliexpress.com', '', '30mm', '30.5x30.5', 14, 21, 5),
('Temu 20A Brushless ESC', 'esc', 7.99, 'Temu', 'https://temu.com', '', '20mm', '16x16', 5, 14, 4),
('Amazon Racerstar 45A ESC', 'esc', 22.99, 'Amazon', 'https://amazon.com', '', '30mm', '30.5x30.5', 15, 3, 6),
('AliExpress 60A BLHeli32 ESC', 'esc', 19.99, 'AliExpress', 'https://aliexpress.com', '', '30mm', '30.5x30.5', 16, 21, 5),
('Temu 30A 4-in-1 ESC', 'esc', 9.99, 'Temu', 'https://temu.com', '', '25mm', '20x20', 8, 14, 4),
('Amazon Aikon 45A ESC', 'esc', 24.99, 'Amazon', 'https://amazon.com', '', '30mm', '30.5x30.5', 11, 3, 7);

-- Flight Controllers
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress F4 30x30 Flight Controller', 'flight_controller', 19.99, 'AliExpress', 'https://aliexpress.com', '', '36mm', '30.5x30.5', 14, 21, 5),
('Temu F7 16x16 FC Board', 'flight_controller', 12.99, 'Temu', 'https://temu.com', '', '20mm', '16x16', 6, 14, 4),
('Amazon SpeedyBee F405 V2 FC', 'flight_controller', 29.99, 'Amazon', 'https://amazon.com', '', '36mm', '30.5x30.5', 14, 3, 7),
('AliExpress Mamba F722 Mini FC', 'flight_controller', 24.99, 'AliExpress', 'https://aliexpress.com', '', '36mm', '30.5x30.5', 13, 21, 5),
('Temu JHEMCU F745 Clone FC', 'flight_controller', 15.99, 'Temu', 'https://temu.com', '', '36mm', '30.5x30.5', 12, 14, 4),
('Amazon Mamba F722 FC', 'flight_controller', 34.99, 'Amazon', 'https://amazon.com', '', '36mm', '30.5x30.5', 13, 3, 7);

-- Propellers
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress Gemfan 51433 5" Props (8 pack)', 'propeller', 2.99, 'AliExpress', 'https://aliexpress.com', '', '127mm', '5mm shaft', 5, 21, 5),
('Temu HQProp 5" Props (4 pack)', 'propeller', 1.99, 'Temu', 'https://temu.com', '', '127mm', '5mm shaft', 4, 14, 4),
('Amazon Gemfan D76 3" Props', 'propeller', 4.99, 'Amazon', 'https://amazon.com', '', '76mm', '5mm shaft', 2, 3, 7),
('AliExpress Gemfan D90 3.5" Props', 'propeller', 3.49, 'AliExpress', 'https://aliexpress.com', '', '90mm', '5mm shaft', 3, 21, 5),
('Temu Azque 5" Props (4 pack)', 'propeller', 2.49, 'Temu', 'https://temu.com', '', '128mm', '5mm shaft', 4, 14, 4),
('Amazon Gemfan D70 7" Props', 'propeller', 7.99, 'Amazon', 'https://amazon.com', '', '177mm', '5mm shaft', 6, 3, 7),
('AliExpress Gemfan D110 10" Props', 'propeller', 5.99, 'AliExpress', 'https://aliexpress.com', '', '254mm', '5mm shaft', 8, 21, 5),
('Temu HQProp 3" Props (4 pack)', 'propeller', 1.49, 'Temu', 'https://temu.com', '', '75mm', '5mm shaft', 2, 14, 4);

-- Batteries
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress 1500mAh 4S LiPo', 'battery', 12.99, 'AliExpress', 'https://aliexpress.com', '', '75x35x25mm', 'XT60', 162, 21, 5),
('Temu 550mAh 3S LiPo', 'battery', 8.99, 'Temu', 'https://temu.com', '', '55x30x18mm', 'XT60', 35, 14, 4),
('Amazon GNB 1500mAh 4S LiPo', 'battery', 16.99, 'Amazon', 'https://amazon.com', '', '75x35x25mm', 'XT60', 165, 3, 6),
('AliExpress 1500mAh 6S LiPo', 'battery', 19.99, 'AliExpress', 'https://aliexpress.com', '', '80x40x30mm', 'XT60', 290, 21, 5),
('Temu 450mAh 2S LiPo', 'battery', 6.99, 'Temu', 'https://temu.com', '', '50x25x15mm', 'XT60', 22, 14, 4),
('Amazon CNHL 1500mAh 6S LiPo', 'battery', 29.99, 'Amazon', 'https://amazon.com', '', '80x40x30mm', 'XT60', 285, 3, 7),
('AliExpress 5000mAh 6S LiPo', 'battery', 39.99, 'AliExpress', 'https://aliexpress.com', '', '150x50x35mm', 'XT60', 630, 21, 5),
('Temu 1300mAh 4S LiPo', 'battery', 10.99, 'Temu', 'https://temu.com', '', '75x35x25mm', 'XT60', 158, 14, 4);

-- Cameras
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress Caddx Ant Clone Camera', 'camera', 12.99, 'AliExpress', 'https://aliexpress.com', '', '20x20x20mm', '19mm', 14, 21, 5),
('Temu RunCam Micro Clone Camera', 'camera', 9.99, 'Temu', 'https://temu.com', '', '20x20x20mm', '19mm', 16, 14, 4),
('Amazon RunCam Thumb Pro Camera', 'camera', 29.99, 'Amazon', 'https://amazon.com', '', '20x20x20mm', '19mm', 12, 3, 7),
('AliExpress Foxeer Razer Clone Camera', 'camera', 14.99, 'AliExpress', 'https://aliexpress.com', '', '20x20x20mm', '19mm', 13, 21, 5),
('Temu Caddx Ratel Clone Camera', 'camera', 11.99, 'Temu', 'https://temu.com', '', '20x20x20mm', '19mm', 14, 14, 4),
('Amazon Foxeer Cat 3 Camera', 'camera', 39.99, 'Amazon', 'https://amazon.com', '', '20x20x20mm', '19mm', 14, 3, 7);

-- VTX
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress AKK X2 VTX Clone 25mW', 'vtx', 8.99, 'AliExpress', 'https://aliexpress.com', '', '20x20mm', '20mm', 5, 21, 5),
('Temu Rush Tank Clone 800mW VTX', 'vtx', 12.99, 'Temu', 'https://temu.com', '', '30x30mm', '30mm', 10, 14, 4),
('Amazon AKK Race VTX 25mW', 'vtx', 19.99, 'Amazon', 'https://amazon.com', '', '20x20mm', '20mm', 4, 3, 7),
('AliExpress TBS Unify Clone VTX', 'vtx', 14.99, 'AliExpress', 'https://aliexpress.com', '', '30x30mm', '30mm', 9, 21, 5),
('Temu 25mW Mini VTX', 'vtx', 5.99, 'Temu', 'https://temu.com', '', '20x20mm', '20mm', 5, 14, 4),
('Amazon Rush Tank 800mW VTX', 'vtx', 24.99, 'Amazon', 'https://amazon.com', '', '30x30mm', '30mm', 9, 3, 7);

-- Receivers
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('AliExpress ELRS 2.4GHz Receiver', 'receiver', 6.99, 'AliExpress', 'https://aliexpress.com', '', '15x10mm', 'CRSF', 2, 21, 5),
('Temu ELRS Clone Receiver', 'receiver', 4.99, 'Temu', 'https://temu.com', '', '15x10mm', 'CRSF', 2, 14, 4),
('Amazon ELRS Diversity Receiver', 'receiver', 14.99, 'Amazon', 'https://amazon.com', '', '20x12mm', 'CRSF', 3, 3, 7),
('AliExpress TBS Crossfire Clone RX', 'receiver', 9.99, 'AliExpress', 'https://aliexpress.com', '', '20x12mm', 'CRSF', 3, 21, 5),
('Temu SuperD 2.4GHz Clone Receiver', 'receiver', 5.99, 'Temu', 'https://temu.com', '', '15x10mm', 'CRSF', 2, 14, 4),
('Amazon TBS Crossfire Nano RX', 'receiver', 24.99, 'Amazon', 'https://amazon.com', '', '20x12mm', 'CRSF', 3, 3, 7);

-- Electrical specs for budget motors
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, NULL, 'DSHOT600' FROM components WHERE name = 'AliExpress 1404 3000KV Brushless Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 40, NULL, 'DSHOT600' FROM components WHERE name = 'Temu 2207 2400KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 42, NULL, 'DSHOT600' FROM components WHERE name = 'Amazon Racerstar 2306 2450KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, NULL, 'DSHOT600' FROM components WHERE name = 'AliExpress T-Motor F40 Clone 2400KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 4, 38, NULL, 'DSHOT600' FROM components WHERE name = 'Temu iFlight 2306 1750KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, NULL, 'DSHOT600' FROM components WHERE name = 'Amazon HGLRC Zeus 1404 3500KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 55, NULL, 'DSHOT600' FROM components WHERE name = 'AliExpress 2806 1300KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 55, NULL, 'DSHOT600' FROM components WHERE name = 'Temu SunnySky X3508 700KV Clone';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 50, NULL, 'DSHOT600' FROM components WHERE name = 'Amazon Racerstar 3508 700KV';

-- ESC specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'AliExpress 45A 4-in-1 ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, 5, 'DSHOT600' FROM components WHERE name = 'Temu 20A Brushless ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'Amazon Racerstar 45A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 60, 5, 'DSHOT600' FROM components WHERE name = 'AliExpress 60A BLHeli32 ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 30, 5, 'DSHOT600' FROM components WHERE name = 'Temu 30A 4-in-1 ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'Amazon Aikon 45A ESC';

-- FC specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'AliExpress F4 30x30 Flight Controller';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'CRSF' FROM components WHERE name = 'Temu F7 16x16 FC Board';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Amazon SpeedyBee F405 V2 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'AliExpress Mamba F722 Mini FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Temu JHEMCU F745 Clone FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Amazon Mamba F722 FC';

-- Battery specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'AliExpress 1500mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 3, 3, NULL, NULL, '' FROM components WHERE name = 'Temu 550mAh 3S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'Amazon GNB 1500mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'AliExpress 1500mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 2, 2, NULL, NULL, '' FROM components WHERE name = 'Temu 450mAh 2S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'Amazon CNHL 1500mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'AliExpress 5000mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'Temu 1300mAh 4S LiPo';

-- Camera specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'AliExpress Caddx Ant Clone Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Temu RunCam Micro Clone Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Amazon RunCam Thumb Pro Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'AliExpress Foxeer Razer Clone Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Temu Caddx Ratel Clone Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Amazon Foxeer Cat 3 Camera';

-- VTX specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'AliExpress AKK X2 VTX Clone 25mW';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Temu Rush Tank Clone 800mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'Amazon AKK Race VTX 25mW';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'AliExpress TBS Unify Clone VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'Temu 25mW Mini VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Amazon Rush Tank 800mW VTX';

-- Receiver specs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'AliExpress ELRS 2.4GHz Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Temu ELRS Clone Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Amazon ELRS Diversity Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'AliExpress TBS Crossfire Clone RX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Temu SuperD 2.4GHz Clone Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Amazon TBS Crossfire Nano RX';

-- Register new vendors
INSERT INTO vendor_stripe_accounts (store_name, stripe_account_id)
SELECT store_name, 'acct_' || lower(replace(store_name, ' ', '_'))
FROM (SELECT DISTINCT store_name FROM components WHERE store_name IN ('AliExpress', 'Temu', 'Amazon')) s
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_stripe_accounts v WHERE v.store_name = s.store_name
)
ON CONFLICT (store_name) DO NOTHING;
