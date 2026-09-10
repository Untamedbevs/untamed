-- Allow resort venues and seed Lee's next retail + on-premise doors.

ALTER TABLE retail_locations DROP CONSTRAINT IF EXISTS retail_locations_location_type_check;
ALTER TABLE retail_locations ADD CONSTRAINT retail_locations_location_type_check
  CHECK (location_type IN (
    'liquor_store', 'bar', 'restaurant', 'grocery', 'resort', 'other'
  ));

INSERT INTO retail_locations (
  name, chain, location_type,
  address_line1, address_line2, city, state, postal_code,
  latitude, longitude, published
)
SELECT
  v.name, v.chain, v.location_type,
  v.address_line1, v.address_line2, v.city, v.state, v.postal_code,
  v.latitude, v.longitude, true
FROM (
  VALUES
    (
      '806 Liquor Express',
      NULL,
      'liquor_store',
      '806 E Wade St',
      'Unit E',
      'Trenton',
      'FL',
      '32693',
      29.61335549032,
      -82.810660960015
    ),
    (
      '14th Street Liquor',
      NULL,
      'liquor_store',
      '1033 NE 14th St',
      NULL,
      'Ocala',
      'FL',
      '34470',
      29.2005109,
      -82.1265709
    ),
    (
      'Nick and Moe''s Liquor',
      NULL,
      'liquor_store',
      '4418 Kathleen Rd',
      NULL,
      'Lakeland',
      'FL',
      '33810',
      28.099369972566,
      -82.007203101697
    ),
    (
      'La Rosas',
      NULL,
      'restaurant',
      '2898 NW 7th Ave',
      NULL,
      'Miami',
      'FL',
      '33127',
      25.803549552004,
      -80.207362941677
    ),
    (
      'Swizzle Rum Bar',
      NULL,
      'bar',
      '1120 Collins Ave',
      NULL,
      'Miami Beach',
      'FL',
      '33139',
      25.782036394338,
      -80.131454147557
    ),
    (
      'Innisbrook Golf Resort',
      NULL,
      'resort',
      '36750 U.S. Highway 19 North',
      NULL,
      'Palm Harbor',
      'FL',
      '34684',
      28.1149291,
      -82.7510341
    )
) AS v(
  name, chain, location_type,
  address_line1, address_line2, city, state, postal_code,
  latitude, longitude
)
WHERE NOT EXISTS (
  SELECT 1
  FROM retail_locations existing
  WHERE existing.name = v.name
    AND existing.postal_code = v.postal_code
);
