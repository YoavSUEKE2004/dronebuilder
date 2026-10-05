/*
# Create cached_nexar_parts table

1. Purpose
   The app is transitioning from a hardcoded component catalog to sourcing all
   part data from the Nexar GraphQL API. To avoid burning Nexar API tokens on
   every request, we cache Nexar responses in this table. The API route checks
   this table first; if a fresh cached row exists (updated within 7 days) it
   returns that row directly. Otherwise it calls Nexar live and upserts the
   result here.

2. New Table: cached_nexar_parts
   - id            (uuid, PK, default gen_random_uuid())
   - mpn           (text, not null) — manufacturer part number, the natural key for upserts
   - category      (text, not null) — FPV drone category (frame, motor, esc, etc.)
   - search_term   (text) — the original query that produced this row
   - name          (text, not null) — display name from Nexar
   - manufacturer  (text) — manufacturer name
   - description   (text) — part description from Nexar
   - brand         (text) — brand name (for local fallback compatibility)
   - image_url     (text) — best image URL from Nexar
   - datasheet_url (text) — datasheet URL from Nexar
   - price         (numeric, default null) — median price from Nexar
   - currency      (text, default 'USD')
   - specs         (jsonb) — full electrical specs object (voltage, current, protocol, etc.)
   - offers        (jsonb) — array of seller offers (seller, url, stock, price)
   - quality_score (integer, default 5) — derived quality rating 1-10
   - stock_status  (text, default 'unknown') — in_stock / low_stock / out_of_stock / unknown
   - updated_at    (timestamptz, default now()) — last refresh from Nexar; used for staleness check
   - created_at    (timestamptz, default now())

   Unique constraint on (mpn, category) so upserts replace stale rows cleanly.

3. Indexes
   - idx_cached_nexar_parts_mpn       on mpn           — fast MPN lookups
   - idx_cached_nexar_parts_category  on category      — fast category filtering
   - idx_cached_nexar_parts_search    on search_term   — fast re-query by search term
   - idx_cached_nexar_parts_updated   on updated_at    — fast staleness filtering

4. Security
   - RLS enabled.
   - This is a single-tenant app with no sign-in screen, so all four CRUD
     policies use TO anon, authenticated with USING (true) / WITH CHECK (true)
     — the cached catalog is intentionally public/shared.
*/

CREATE TABLE IF NOT EXISTS cached_nexar_parts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mpn           text NOT NULL,
  category      text NOT NULL,
  search_term   text,
  name          text NOT NULL,
  manufacturer  text,
  description   text,
  brand         text,
  image_url     text,
  datasheet_url text,
  price         numeric DEFAULT NULL,
  currency      text DEFAULT 'USD',
  specs         jsonb DEFAULT '{}'::jsonb,
  offers        jsonb DEFAULT '[]'::jsonb,
  quality_score integer DEFAULT 5,
  stock_status  text DEFAULT 'unknown',
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

-- Unique constraint for clean upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_cached_nexar_parts_mpn_category'
  ) THEN
    ALTER TABLE cached_nexar_parts
      ADD CONSTRAINT uq_cached_nexar_parts_mpn_category UNIQUE (mpn, category);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cached_nexar_parts_mpn      ON cached_nexar_parts (mpn);
CREATE INDEX IF NOT EXISTS idx_cached_nexar_parts_category ON cached_nexar_parts (category);
CREATE INDEX IF NOT EXISTS idx_cached_nexar_parts_search   ON cached_nexar_parts (search_term);
CREATE INDEX IF NOT EXISTS idx_cached_nexar_parts_updated  ON cached_nexar_parts (updated_at);

-- RLS
ALTER TABLE cached_nexar_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cached_nexar_parts" ON cached_nexar_parts;
CREATE POLICY "anon_select_cached_nexar_parts"
  ON cached_nexar_parts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_cached_nexar_parts" ON cached_nexar_parts;
CREATE POLICY "anon_insert_cached_nexar_parts"
  ON cached_nexar_parts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_cached_nexar_parts" ON cached_nexar_parts;
CREATE POLICY "anon_update_cached_nexar_parts"
  ON cached_nexar_parts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_cached_nexar_parts" ON cached_nexar_parts;
CREATE POLICY "anon_delete_cached_nexar_parts"
  ON cached_nexar_parts FOR DELETE
  TO anon, authenticated USING (true);
