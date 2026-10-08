/*
# Create Orders Table for Dropshipping Fulfillment

## Overview
Creates the `orders` table to support the auto-fulfillment checkout flow.
When a customer checks out, their build configuration and vendor order payloads are stored here.

## New Tables
1. `orders` — customer order records with build configuration JSON, vendor fulfillment payloads, and order status tracking.

## Security
- RLS enabled on `orders`.
- All tables allow anon+authenticated full CRUD (no-auth, public catalog app).

## Notes
1. `build_configuration` stores the selectedParts object (category -> component_id).
2. `vendor_order_payload` stores grouped vendor orders with items, costs, and status.
3. Status flow: pending -> ordered_from_vendor -> shipped -> delivered.
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  build_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ordered_from_vendor','shipped','delivered','cancelled')),
  vendor_order_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);