/*
# Expand component catalog with multi-vendor parts

1. Purpose
   Expands the existing 27-component catalog to ~90+ parts sourced across
   GetFPV, Banggood, RaceDayQuads, and Pyrodrone. Every category gets parts
   spanning multiple size/filter attributes (frame inches, motor KV, battery
   S-count, propeller diameter, etc.) so the new filter UI has meaningful
   options to narrow down.

2. Tables affected
   - components: new rows inserted
   - electrical_specs: new rows inserted for components that need specs
   - vendor_stripe_accounts: new vendor store names added

3. Notes
   - No existing data is modified or deleted.
   - All new components use gen_random_uuid() for IDs.
   - Store names match real FPV retailers for realism.
*/

-- Frames: 3", 3.5", 5", 7", 10" across multiple vendors
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('BetaFPV Pavo Pico Frame 3"', 'frame', 49.99, 'Banggood', 'https://banggood.com', '', '85mm', '16x16', 12, 14, 8),
('HGLRC Windfire 3" Frame', 'frame', 39.99, 'GetFPV', 'https://getfpv.com', '', '90mm', '16x16', 10, 4, 7),
('RaceDayQuads Babyhawk 3" Frame', 'frame', 44.99, 'RaceDayQuads', 'https://racedayquads.com', '', '88mm', '16x16', 11, 5, 8),
('Pyrodrone Apex 3.5" Frame', 'frame', 59.99, 'Pyrodrone', 'https://pyrodrone.com', '', '100mm', '16x16', 14, 5, 9),
('BetaFPV Pavo35 3.5" Frame', 'frame', 54.99, 'Banggood', 'https://banggood.com', '', '95mm', '16x16', 13, 14, 8),
('GetFPV Source One 3.5" Frame', 'frame', 34.99, 'GetFPV', 'https://getfpv.com', '', '98mm', '16x16', 15, 4, 7),
('Pyrodrone Source V5 5" Frame', 'frame', 79.99, 'Pyrodrone', 'https://pyrodrone.com', '', '220mm', '30.5x30.5', 68, 5, 10),
('RaceDayQuads Apex 5" Frame', 'frame', 89.99, 'RaceDayQuads', 'https://racedayquads.com', '', '225mm', '30.5x30.5', 65, 5, 10),
('GetFPV Source One 5" Frame', 'frame', 49.99, 'GetFPV', 'https://getfpv.com', '', '220mm', '30.5x30.5', 72, 4, 8),
('Banggood Mark4 5" Frame', 'frame', 39.99, 'Banggood', 'https://banggood.com', '', '218mm', '30.5x30.5', 75, 14, 6),
('Pyrodrone Apex 7" Frame', 'frame', 99.99, 'Pyrodrone', 'https://pyrodrone.com', '', '280mm', '30.5x30.5', 85, 5, 10),
('RaceDayQuads Source One 7" Frame', 'frame', 69.99, 'RaceDayQuads', 'https://racedayquads.com', '', '275mm', '30.5x30.5', 90, 5, 9),
('GetFPV ARWing 7" Frame', 'frame', 79.99, 'GetFPV', 'https://getfpv.com', '', '285mm', '30.5x30.5', 88, 4, 8),
('Banggood F7 7" Frame', 'frame', 49.99, 'Banggood', 'https://banggood.com', '', '270mm', '30.5x30.5', 95, 14, 6),
('Pyrodrone Source One 10" Frame', 'frame', 119.99, 'Pyrodrone', 'https://pyrodrone.com', '', '400mm', '30.5x30.5', 120, 5, 9),
('GetFPV Slick 10" Frame', 'frame', 109.99, 'GetFPV', 'https://getfpv.com', '', '395mm', '30.5x30.5', 115, 4, 8),
('RaceDayQuads BigBird 10" Frame', 'frame', 129.99, 'RaceDayQuads', 'https://racedayquads.com', '', '410mm', '30.5x30.5', 125, 5, 9);

-- Motors: various sizes and KV ratings
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('BetaFPV 1404 3000KV Motor', 'motor', 22.99, 'Banggood', 'https://banggood.com', '', '14mm', '5mm shaft', 6, 14, 7),
('HGLRC Zeus 1404 3500KV Motor', 'motor', 24.99, 'GetFPV', 'https://getfpv.com', '', '14mm', '5mm shaft', 6, 4, 8),
('RaceDayQuads CineLite 1404 3800KV', 'motor', 27.99, 'RaceDayQuads', 'https://racedayquads.com', '', '14mm', '5mm shaft', 7, 5, 8),
('Pyrodrone T-Motor F40 Pro 2400KV', 'motor', 54.99, 'Pyrodrone', 'https://pyrodrone.com', '', '40mm', '5mm shaft', 32, 5, 10),
('GetFPV Ethereal 2306 2400KV Motor', 'motor', 49.99, 'GetFPV', 'https://getfpv.com', '', '23mm', '5mm shaft', 31, 4, 9),
('RaceDayQuads Xing 2306 2450KV Motor', 'motor', 42.99, 'RaceDayQuads', 'https://racedayquads.com', '', '23mm', '5mm shaft', 33, 5, 9),
('Banggood iFlight 2306 1750KV Motor', 'motor', 29.99, 'Banggood', 'https://banggood.com', '', '23mm', '5mm shaft', 34, 14, 7),
('Pyrodrone T-Motor F80 2207 2550KV', 'motor', 59.99, 'Pyrodrone', 'https://pyrodrone.com', '', '22mm', '5mm shaft', 35, 5, 10),
('GetFPV RCinPower GTS 2207 2400KV', 'motor', 44.99, 'GetFPV', 'https://getfpv.com', '', '22mm', '5mm shaft', 33, 4, 9),
('RaceDayQuads BrotherHobby 2806 1300KV', 'motor', 64.99, 'RaceDayQuads', 'https://racedayquads.com', '', '28mm', '5mm shaft', 50, 5, 10),
('Pyrodrone T-Motor MN3508 700KV', 'motor', 79.99, 'Pyrodrone', 'https://pyrodrone.com', '', '35mm', '5mm shaft', 65, 5, 10),
('GetFPV SunnySky X3508S 700KV', 'motor', 59.99, 'GetFPV', 'https://getfpv.com', '', '35mm', '5mm shaft', 62, 4, 9),
('Banggood Racerstar 3508 700KV', 'motor', 39.99, 'Banggood', 'https://banggood.com', '', '35mm', '5mm shaft', 68, 14, 6),
('RaceDayQuads T-Motor MN4012 400KV', 'motor', 89.99, 'RaceDayQuads', 'https://racedayquads.com', '', '40mm', '5mm shaft', 85, 5, 10),
('Pyrodrone T-Motor MN5008 340KV', 'motor', 109.99, 'Pyrodrone', 'https://pyrodrone.com', '', '50mm', '5mm shaft', 120, 5, 10);

-- ESCs: various current ratings
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('HGLRC Zeus 20A ESC', 'esc', 29.99, 'GetFPV', 'https://getfpv.com', '', '20mm', '16x16', 4, 4, 8),
('BetaFPV 20A ESC', 'esc', 24.99, 'Banggood', 'https://banggood.com', '', '20mm', '16x16', 5, 14, 7),
('RaceDayQuads CineLite 20A ESC', 'esc', 32.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20mm', '16x16', 4, 5, 8),
('Pyrodrone T-Motor F45A ESC', 'esc', 69.99, 'Pyrodrone', 'https://pyrodrone.com', '', '30mm', '30.5x30.5', 12, 5, 10),
('GetFPV Aikon 45A ESC', 'esc', 59.99, 'GetFPV', 'https://getfpv.com', '', '30mm', '30.5x30.5', 11, 4, 9),
('RaceDayQuads Tekko32 45A ESC', 'esc', 54.99, 'RaceDayQuads', 'https://racedayquads.com', '', '30mm', '30.5x30.5', 13, 5, 9),
('Banggood Racerstar 45A ESC', 'esc', 34.99, 'Banggood', 'https://banggood.com', '', '30mm', '30.5x30.5', 15, 14, 6),
('Pyrodrone T-Motor F60A ESC', 'esc', 79.99, 'Pyrodrone', 'https://pyrodrone.com', '', '30mm', '30.5x30.5', 14, 5, 10),
('GetFPV Aikon 60A ESC', 'esc', 69.99, 'GetFPV', 'https://getfpv.com', '', '30mm', '30.5x30.5', 13, 4, 9),
('RaceDayQuads Tekko32 60A ESC', 'esc', 64.99, 'RaceDayQuads', 'https://racedayquads.com', '', '30mm', '30.5x30.5', 15, 5, 9),
('Pyrodrone T-Motor F80A ESC', 'esc', 89.99, 'Pyrodrone', 'https://pyrodrone.com', '', '40mm', '30.5x30.5', 18, 5, 10),
('GetFPV Aikon 80A ESC', 'esc', 79.99, 'GetFPV', 'https://getfpv.com', '', '40mm', '30.5x30.5', 17, 4, 9),
('Banggood Racerstar 80A ESC', 'esc', 44.99, 'Banggood', 'https://banggood.com', '', '40mm', '30.5x30.5', 20, 14, 6);

-- Flight Controllers
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('HGLRC Zeus F7 16x16 FC', 'flight_controller', 44.99, 'GetFPV', 'https://getfpv.com', '', '20mm', '16x16', 5, 4, 9),
('BetaFPV F4 16x16 FC', 'flight_controller', 34.99, 'Banggood', 'https://banggood.com', '', '20mm', '16x16', 6, 14, 7),
('RaceDayQuads CineLite F7 16x16 FC', 'flight_controller', 49.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20mm', '16x16', 5, 5, 9),
('Pyrodrone JHEMCU F745 30x30 FC', 'flight_controller', 59.99, 'Pyrodrone', 'https://pyrodrone.com', '', '36mm', '30.5x30.5', 12, 5, 10),
('GetFPV SpeedyBee F405 V3 FC', 'flight_controller', 49.99, 'GetFPV', 'https://getfpv.com', '', '36mm', '30.5x30.5', 11, 4, 9),
('RaceDayQuads JHEMCU F745 FC', 'flight_controller', 54.99, 'RaceDayQuads', 'https://racedayquads.com', '', '36mm', '30.5x30.5', 12, 5, 10),
('Banggood SpeedyBee F405 V2 FC', 'flight_controller', 39.99, 'Banggood', 'https://banggood.com', '', '36mm', '30.5x30.5', 14, 14, 7),
('Pyrodrone JHEMCU GTSK F745 FC', 'flight_controller', 64.99, 'Pyrodrone', 'https://pyrodrone.com', '', '36mm', '30.5x30.5', 13, 5, 10),
('GetFPV Mamba F722 Mini FC', 'flight_controller', 54.99, 'GetFPV', 'https://getfpv.com', '', '36mm', '30.5x30.5', 12, 4, 9),
('RaceDayQuads Mamba F722 FC', 'flight_controller', 59.99, 'RaceDayQuads', 'https://racedayquads.com', '', '36mm', '30.5x30.5', 13, 5, 9),
('Pyrodrone Matek F722-PD FC', 'flight_controller', 69.99, 'Pyrodrone', 'https://pyrodrone.com', '', '36mm', '30.5x30.5', 14, 5, 10),
('GetFPV Matek F722-SE FC', 'flight_controller', 64.99, 'GetFPV', 'https://getfpv.com', '', '36mm', '30.5x30.5', 13, 4, 9);

-- Propellers: various sizes/pitches
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('Gemfan D76 3" Props (4 pack)', 'propeller', 5.99, 'GetFPV', 'https://getfpv.com', '', '76mm', '5mm shaft', 2, 4, 9),
('HQProp T3x3x3 3" Props', 'propeller', 4.99, 'Banggood', 'https://banggood.com', '', '75mm', '5mm shaft', 2, 14, 7),
('RaceDayQuads Azque 3" Props', 'propeller', 6.49, 'RaceDayQuads', 'https://racedayquads.com', '', '78mm', '5mm shaft', 2, 5, 8),
('Gemfan D90 3.5" Props', 'propeller', 6.99, 'GetFPV', 'https://getfpv.com', '', '90mm', '5mm shaft', 3, 4, 9),
('Pyrodrone Azque 3.5" Props', 'propeller', 7.49, 'Pyrodrone', 'https://pyrodrone.com', '', '92mm', '5mm shaft', 3, 5, 9),
('Banggood Gemfan D90 3.5" Props', 'propeller', 5.49, 'Banggood', 'https://banggood.com', '', '90mm', '5mm shaft', 3, 14, 7),
('Pyrodrone Gemfan D90 5" Props', 'propeller', 9.99, 'Pyrodrone', 'https://pyrodrone.com', '', '127mm', '5mm shaft', 4, 5, 10),
('GetFPV HQProp S5 5" Props', 'propeller', 8.99, 'GetFPV', 'https://getfpv.com', '', '127mm', '5mm shaft', 4, 4, 9),
('RaceDayQuads Azque 5" Props', 'propeller', 10.49, 'RaceDayQuads', 'https://racedayquads.com', '', '128mm', '5mm shaft', 4, 5, 9),
('Banggood Gemfan 51433 5" Props', 'propeller', 5.99, 'Banggood', 'https://banggood.com', '', '127mm', '5mm shaft', 5, 14, 6),
('Pyrodrone Gemfan D70 7" Props', 'propeller', 12.99, 'Pyrodrone', 'https://pyrodrone.com', '', '177mm', '5mm shaft', 6, 5, 10),
('GetFPV HQProp D70 7" Props', 'propeller', 11.99, 'GetFPV', 'https://getfpv.com', '', '177mm', '5mm shaft', 6, 4, 9),
('RaceDayQuads Azque 7" Props', 'propeller', 13.49, 'RaceDayQuads', 'https://racedayquads.com', '', '178mm', '5mm shaft', 6, 5, 9),
('Banggood Gemfan D70 7" Props', 'propeller', 7.99, 'Banggood', 'https://banggood.com', '', '177mm', '5mm shaft', 7, 14, 6),
('Pyrodrone Gemfan D110 10" Props', 'propeller', 16.99, 'Pyrodrone', 'https://pyrodrone.com', '', '254mm', '5mm shaft', 8, 5, 10),
('GetFPV HQProp D110 10" Props', 'propeller', 15.99, 'GetFPV', 'https://getfpv.com', '', '254mm', '5mm shaft', 8, 4, 9),
('RaceDayQuads Azque 10" Props', 'propeller', 17.49, 'RaceDayQuads', 'https://racedayquads.com', '', '255mm', '5mm shaft', 8, 5, 9);

-- Batteries: various S-counts
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('BetaFPV 450mAh 2S LiPo', 'battery', 14.99, 'Banggood', 'https://banggood.com', '', '50x25x15mm', 'XT60', 22, 14, 7),
('GetFPV CNHL 450mAh 2S LiPo', 'battery', 17.99, 'GetFPV', 'https://getfpv.com', '', '50x25x15mm', 'XT60', 21, 4, 8),
('RaceDayQuads Tattu 450mAh 2S LiPo', 'battery', 19.99, 'RaceDayQuads', 'https://racedayquads.com', '', '50x25x15mm', 'XT60', 20, 5, 9),
('BetaFPV 550mAh 3S LiPo', 'battery', 19.99, 'Banggood', 'https://banggood.com', '', '55x30x18mm', 'XT60', 35, 14, 7),
('GetFPV CNHL 550mAh 3S LiPo', 'battery', 22.99, 'GetFPV', 'https://getfpv.com', '', '55x30x18mm', 'XT60', 34, 4, 8),
('RaceDayQuads Tattu 550mAh 3S LiPo', 'battery', 24.99, 'RaceDayQuads', 'https://racedayquads.com', '', '55x30x18mm', 'XT60', 33, 5, 9),
('Pyrodrone Tattu 1300mAh 4S LiPo', 'battery', 34.99, 'Pyrodrone', 'https://pyrodrone.com', '', '75x35x25mm', 'XT60', 155, 5, 10),
('GetFPV CNHL 1500mAh 4S LiPo', 'battery', 29.99, 'GetFPV', 'https://getfpv.com', '', '75x35x25mm', 'XT60', 160, 4, 9),
('RaceDayQuads Tattu 1500mAh 4S LiPo', 'battery', 32.99, 'RaceDayQuads', 'https://racedayquads.com', '', '75x35x25mm', 'XT60', 158, 5, 9),
('Banggood GNB 1500mAh 4S LiPo', 'battery', 22.99, 'Banggood', 'https://banggood.com', '', '75x35x25mm', 'XT60', 165, 14, 6),
('Pyrodrone Tattu 1800mAh 6S LiPo', 'battery', 54.99, 'Pyrodrone', 'https://pyrodrone.com', '', '80x40x30mm', 'XT60', 280, 5, 10),
('GetFPV CNHL 1500mAh 6S LiPo', 'battery', 44.99, 'GetFPV', 'https://getfpv.com', '', '80x40x30mm', 'XT60', 285, 4, 9),
('RaceDayQuads Tattu 1550mAh 6S LiPo', 'battery', 49.99, 'RaceDayQuads', 'https://racedayquads.com', '', '80x40x30mm', 'XT60', 282, 5, 9),
('Banggood GNB 1500mAh 6S LiPo', 'battery', 34.99, 'Banggood', 'https://banggood.com', '', '80x40x30mm', 'XT60', 290, 14, 6),
('Pyrodrone Tattu 5000mAh 6S LiPo', 'battery', 89.99, 'Pyrodrone', 'https://pyrodrone.com', '', '150x50x35mm', 'XT60', 620, 5, 10),
('GetFPV CNHL 5000mAh 6S LiPo', 'battery', 79.99, 'GetFPV', 'https://getfpv.com', '', '150x50x35mm', 'XT60', 630, 4, 9),
('RaceDayQuads Tattu 5000mAh 6S LiPo', 'battery', 84.99, 'RaceDayQuads', 'https://racedayquads.com', '', '150x50x35mm', 'XT60', 625, 5, 9);

-- Cameras
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('RunCam Thumb Pro Camera', 'camera', 39.99, 'GetFPV', 'https://getfpv.com', '', '20x20x20mm', '19mm', 12, 4, 8),
('Banggood Caddx Ant Lite Camera', 'camera', 29.99, 'Banggood', 'https://banggood.com', '', '20x20x20mm', '19mm', 14, 14, 7),
('RaceDayQuads Caddx Ant Camera', 'camera', 44.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x20x20mm', '19mm', 12, 5, 9),
('Pyrodrone Caddx Polar Camera', 'camera', 89.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x20x20mm', '19mm', 14, 5, 10),
('GetFPV RunCam Phoenix 2 Camera', 'camera', 79.99, 'GetFPV', 'https://getfpv.com', '', '20x20x20mm', '19mm', 15, 4, 9),
('RaceDayQuads Caddx Ratel 2 Camera', 'camera', 69.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x20x20mm', '19mm', 14, 5, 9),
('Banggood RunCam Micro Swift 3', 'camera', 49.99, 'Banggood', 'https://banggood.com', '', '20x20x20mm', '19mm', 16, 14, 7),
('Pyrodrone Caddx Wasp Camera', 'camera', 99.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x20x20mm', '19mm', 15, 5, 10),
('GetFPV RunCam Falcon Camera', 'camera', 74.99, 'GetFPV', 'https://getfpv.com', '', '20x20x20mm', '19mm', 14, 4, 9),
('RaceDayQuads Foxeer Razer Mini Camera', 'camera', 64.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x20x20mm', '19mm', 13, 5, 9),
('Pyrodrone Caddx Orca Camera', 'camera', 84.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x20x20mm', '19mm', 15, 5, 10),
('GetFPV Foxeer Cat 3 Camera', 'camera', 69.99, 'GetFPV', 'https://getfpv.com', '', '20x20x20mm', '19mm', 14, 4, 9);

-- VTX
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('HGLRC Zeus 25mW VTX', 'vtx', 19.99, 'GetFPV', 'https://getfpv.com', '', '20x20mm', '20mm', 4, 4, 8),
('BetaFPV 25mW VTX', 'vtx', 14.99, 'Banggood', 'https://banggood.com', '', '20x20mm', '20mm', 5, 14, 7),
('RaceDayQuads Rush Solo 25mW VTX', 'vtx', 22.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x20mm', '20mm', 4, 5, 9),
('Pyrodrone TBS Unify Pro32 VTX', 'vtx', 49.99, 'Pyrodrone', 'https://pyrodrone.com', '', '30x30mm', '30mm', 8, 5, 10),
('GetFPV Rush Tank 800mW VTX', 'vtx', 39.99, 'GetFPV', 'https://getfpv.com', '', '30x30mm', '30mm', 9, 4, 9),
('RaceDayQuads TBS Unify Pro32 VTX', 'vtx', 54.99, 'RaceDayQuads', 'https://racedayquads.com', '', '30x30mm', '30mm', 8, 5, 10),
('Banggood Rush Tank 800mW VTX', 'vtx', 29.99, 'Banggood', 'https://banggood.com', '', '30x30mm', '30mm', 10, 14, 6),
('Pyrodrone TBS Unify Pro32 HV VTX', 'vtx', 59.99, 'Pyrodrone', 'https://pyrodrone.com', '', '30x30mm', '30mm', 8, 5, 10),
('GetFPV AKK X2-Ultimate VTX', 'vtx', 34.99, 'GetFPV', 'https://getfpv.com', '', '30x30mm', '30mm', 9, 4, 9),
('RaceDayQuads AKK Race VTX', 'vtx', 37.99, 'RaceDayQuads', 'https://racedayquads.com', '', '30x30mm', '30mm', 9, 5, 9),
('Pyrodrone Rush Tank Solo VTX', 'vtx', 44.99, 'Pyrodrone', 'https://pyrodrone.com', '', '30x30mm', '30mm', 8, 5, 10),
('GetFPV TBS Unify Pro32 HV VTX', 'vtx', 54.99, 'GetFPV', 'https://getfpv.com', '', '30x30mm', '30mm', 8, 4, 9);

-- Receivers
INSERT INTO components (name, category, price, store_name, product_url, image_url, dimensions_mm, mounting_pattern, weight_g, shipping_days, quality_score) VALUES
('HGLRC Zeus 2.4GHz Receiver', 'receiver', 19.99, 'GetFPV', 'https://getfpv.com', '', '15x10mm', 'CRSF', 2, 4, 9),
('BetaFPV SuperD 2.4GHz Receiver', 'receiver', 16.99, 'Banggood', 'https://banggood.com', '', '15x10mm', 'CRSF', 2, 14, 7),
('RaceDayQuads RP1 2.4GHz Receiver', 'receiver', 22.99, 'RaceDayQuads', 'https://racedayquads.com', '', '15x10mm', 'CRSF', 2, 5, 9),
('Pyrodrone TBS Crossfire Micro V2', 'receiver', 39.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x12mm', 'CRSF', 3, 5, 10),
('GetFPV ELRS Diversity Receiver', 'receiver', 29.99, 'GetFPV', 'https://getfpv.com', '', '20x12mm', 'CRSF', 3, 4, 9),
('RaceDayQuads TBS Crossfire Micro V2', 'receiver', 42.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x12mm', 'CRSF', 3, 5, 10),
('Banggood ELRS 2.4GHz Receiver', 'receiver', 12.99, 'Banggood', 'https://banggood.com', '', '15x10mm', 'CRSF', 2, 14, 6),
('Pyrodrone ELRS Diversity Receiver', 'receiver', 34.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x12mm', 'CRSF', 3, 5, 10),
('GetFPV TBS Crossfire Nano RX', 'receiver', 37.99, 'GetFPV', 'https://getfpv.com', '', '20x12mm', 'CRSF', 3, 4, 9),
('RaceDayQuads ELRS Diversity Receiver', 'receiver', 32.99, 'RaceDayQuads', 'https://racedayquads.com', '', '20x12mm', 'CRSF', 3, 5, 9),
('Pyrodrone TBS Crossfire Nano RX', 'receiver', 44.99, 'Pyrodrone', 'https://pyrodrone.com', '', '20x12mm', 'CRSF', 3, 5, 10),
('GetFPV ELRS Nano Receiver', 'receiver', 24.99, 'GetFPV', 'https://getfpv.com', '', '15x10mm', 'CRSF', 2, 4, 9);

-- Electrical specs for new frames (mounting + size data)
-- We skip specs for frames since they don't have electrical specs typically.
-- Motors
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, NULL, 'DSHOT600' FROM components WHERE name = 'BetaFPV 1404 3000KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, NULL, 'DSHOT600' FROM components WHERE name = 'HGLRC Zeus 1404 3500KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 22, NULL, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads CineLite 1404 3800KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, NULL, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor F40 Pro 2400KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 40, NULL, 'DSHOT600' FROM components WHERE name = 'GetFPV Ethereal 2306 2400KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 42, NULL, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads Xing 2306 2450KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 4, 38, NULL, 'DSHOT600' FROM components WHERE name = 'Banggood iFlight 2306 1750KV Motor';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 50, NULL, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor F80 2207 2550KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 42, NULL, 'DSHOT600' FROM components WHERE name = 'GetFPV RCinPower GTS 2207 2400KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 55, NULL, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads BrotherHobby 2806 1300KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 60, NULL, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor MN3508 700KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 55, NULL, 'DSHOT600' FROM components WHERE name = 'GetFPV SunnySky X3508S 700KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 50, NULL, 'DSHOT600' FROM components WHERE name = 'Banggood Racerstar 3508 700KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 12, 6, 70, NULL, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads T-Motor MN4012 400KV';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 12, 6, 80, NULL, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor MN5008 340KV';

-- ESCs
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, 5, 'DSHOT600' FROM components WHERE name = 'HGLRC Zeus 20A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, 5, 'DSHOT600' FROM components WHERE name = 'BetaFPV 20A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, 20, 5, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads CineLite 20A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor F45A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'GetFPV Aikon 45A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads Tekko32 45A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 45, 5, 'DSHOT600' FROM components WHERE name = 'Banggood Racerstar 45A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 60, 5, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor F60A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 60, 5, 'DSHOT600' FROM components WHERE name = 'GetFPV Aikon 60A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, 60, 5, 'DSHOT600' FROM components WHERE name = 'RaceDayQuads Tekko32 60A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 80, 5, 'DSHOT600' FROM components WHERE name = 'Pyrodrone T-Motor F80A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 80, 5, 'DSHOT600' FROM components WHERE name = 'GetFPV Aikon 80A ESC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, 80, 5, 'DSHOT600' FROM components WHERE name = 'Banggood Racerstar 80A ESC';

-- Flight Controllers
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'CRSF' FROM components WHERE name = 'HGLRC Zeus F7 16x16 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'CRSF' FROM components WHERE name = 'BetaFPV F4 16x16 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'CRSF' FROM components WHERE name = 'RaceDayQuads CineLite F7 16x16 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Pyrodrone JHEMCU F745 30x30 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'GetFPV SpeedyBee F405 V3 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'RaceDayQuads JHEMCU F745 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Banggood SpeedyBee F405 V2 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'Pyrodrone JHEMCU GTSK F745 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'GetFPV Mamba F722 Mini FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'CRSF' FROM components WHERE name = 'RaceDayQuads Mamba F722 FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, NULL, 5, 'CRSF' FROM components WHERE name = 'Pyrodrone Matek F722-PD FC';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 8, 4, NULL, 5, 'CRSF' FROM components WHERE name = 'GetFPV Matek F722-SE FC';

-- Batteries
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 2, 2, NULL, NULL, '' FROM components WHERE name = 'BetaFPV 450mAh 2S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 2, 2, NULL, NULL, '' FROM components WHERE name = 'GetFPV CNHL 450mAh 2S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 2, 2, NULL, NULL, '' FROM components WHERE name = 'RaceDayQuads Tattu 450mAh 2S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 3, 3, NULL, NULL, '' FROM components WHERE name = 'BetaFPV 550mAh 3S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 3, 3, NULL, NULL, '' FROM components WHERE name = 'GetFPV CNHL 550mAh 3S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 3, 3, NULL, NULL, '' FROM components WHERE name = 'RaceDayQuads Tattu 550mAh 3S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'Pyrodrone Tattu 1300mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'GetFPV CNHL 1500mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'RaceDayQuads Tattu 1500mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 4, NULL, NULL, '' FROM components WHERE name = 'Banggood GNB 1500mAh 4S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'Pyrodrone Tattu 1800mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'GetFPV CNHL 1500mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'RaceDayQuads Tattu 1550mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'Banggood GNB 1500mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'Pyrodrone Tattu 5000mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'GetFPV CNHL 5000mAh 6S LiPo';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 6, NULL, NULL, '' FROM components WHERE name = 'RaceDayQuads Tattu 5000mAh 6S LiPo';

-- Cameras
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'RunCam Thumb Pro Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Banggood Caddx Ant Lite Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'RaceDayQuads Caddx Ant Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Digital' FROM components WHERE name = 'Pyrodrone Caddx Polar Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'GetFPV RunCam Phoenix 2 Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'RaceDayQuads Caddx Ratel 2 Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'Banggood RunCam Micro Swift 3';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Digital' FROM components WHERE name = 'Pyrodrone Caddx Wasp Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'GetFPV RunCam Falcon Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'RaceDayQuads Foxeer Razer Mini Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Digital' FROM components WHERE name = 'Pyrodrone Caddx Orca Camera';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'Analog' FROM components WHERE name = 'GetFPV Foxeer Cat 3 Camera';

-- VTX
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'HGLRC Zeus 25mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'BetaFPV 25mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 4, 2, NULL, 5, 'Analog' FROM components WHERE name = 'RaceDayQuads Rush Solo 25mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Pyrodrone TBS Unify Pro32 VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'GetFPV Rush Tank 800mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'RaceDayQuads TBS Unify Pro32 VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Banggood Rush Tank 800mW VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Pyrodrone TBS Unify Pro32 HV VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'GetFPV AKK X2-Ultimate VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'RaceDayQuads AKK Race VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'Pyrodrone Rush Tank Solo VTX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 6, 3, NULL, 5, 'Analog' FROM components WHERE name = 'GetFPV TBS Unify Pro32 HV VTX';

-- Receivers
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'HGLRC Zeus 2.4GHz Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'BetaFPV SuperD 2.4GHz Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'RaceDayQuads RP1 2.4GHz Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Pyrodrone TBS Crossfire Micro V2';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'GetFPV ELRS Diversity Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'RaceDayQuads TBS Crossfire Micro V2';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Banggood ELRS 2.4GHz Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Pyrodrone ELRS Diversity Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'GetFPV TBS Crossfire Nano RX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'RaceDayQuads ELRS Diversity Receiver';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'Pyrodrone TBS Crossfire Nano RX';
INSERT INTO electrical_specs (component_id, max_voltage_s, min_voltage_s, max_current_a, bec_output_v, protocol)
SELECT id, 5, 3, NULL, NULL, 'CRSF' FROM components WHERE name = 'GetFPV ELRS Nano Receiver';

-- Add new vendor store names to vendor_stripe_accounts
INSERT INTO vendor_stripe_accounts (store_name, stripe_account_id)
SELECT store_name, 'acct_' || lower(replace(store_name, ' ', '_'))
FROM (SELECT DISTINCT store_name FROM components) s
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_stripe_accounts v WHERE v.store_name = s.store_name
)
ON CONFLICT (store_name) DO NOTHING;
