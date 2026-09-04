-- Consumer store locator: published retail doors with coordinates.
-- Public reads go through the API (published rows only). Admin uses service role.

CREATE TABLE IF NOT EXISTS retail_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  chain TEXT,
  location_type TEXT NOT NULL DEFAULT 'liquor_store' CHECK (location_type IN (
    'liquor_store', 'bar', 'restaurant', 'grocery', 'other'
  )),
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  phone TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retail_locations_published
  ON retail_locations(published, state, city);

CREATE INDEX IF NOT EXISTS idx_retail_locations_geo
  ON retail_locations(latitude, longitude)
  WHERE published = true;

ALTER TABLE retail_locations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS retail_locations_updated_at ON retail_locations;
CREATE TRIGGER retail_locations_updated_at
  BEFORE UPDATE ON retail_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO retail_locations (
  name, chain, location_type,
  address_line1, city, state, postal_code,
  latitude, longitude, published
) VALUES
  (
    'Total Wine & More',
    'Total Wine & More',
    'liquor_store',
    '13711 S. Tamiami Trail',
    'Fort Myers',
    'FL',
    '33912',
    26.5442615,
    -81.8687949,
    true
  ),
  (
    'Total Wine & More',
    'Total Wine & More',
    'liquor_store',
    '2712 E. Colonial Drive',
    'Orlando',
    'FL',
    '32803',
    28.5527675,
    -81.3485958,
    true
  ),
  (
    'Total Wine & More',
    'Total Wine & More',
    'liquor_store',
    '11221 Legacy Avenue',
    'Palm Beach Gardens',
    'FL',
    '33410',
    26.8404085,
    -80.0932074,
    true
  ),
  (
    'Total Wine & More',
    'Total Wine & More',
    'liquor_store',
    '8539 Cooper Creek Boulevard',
    'Bradenton',
    'FL',
    '34201',
    27.3899574,
    -82.4538927,
    true
  );
