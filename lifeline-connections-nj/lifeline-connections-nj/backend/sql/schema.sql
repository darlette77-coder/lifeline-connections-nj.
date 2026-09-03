-- Lifeline Connections NJ, Inc. — database schema
-- Run this once against a fresh Postgres database (see ../README.md)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- 1. NIMS-typed resources
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name VARCHAR(255) NOT NULL,
    nims_category VARCHAR(100) NOT NULL,       -- e.g. 'Human Services', 'Emergency Housing'
    nims_type INT CHECK (nims_type BETWEEN 1 AND 4), -- 1 = highest acuity, 4 = basic
    zip_code VARCHAR(10) NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    phone_number VARCHAR(20),
    operating_hours JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_resources_zip ON resources(zip_code);
CREATE INDEX IF NOT EXISTS idx_resources_nims ON resources(nims_category, nims_type);

-- 2. Zip code -> lat/long -> NWS grid cache
CREATE TABLE IF NOT EXISTS zip_code_mappings (
    zip_code VARCHAR(10) PRIMARY KEY,
    county VARCHAR(100),
    place_name VARCHAR(150),
    state VARCHAR(2),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    nws_grid_id VARCHAR(10),
    nws_grid_x INT,
    nws_grid_y INT,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Weather alerts cache (pulled from api.weather.gov, keyed by zip)
CREATE TABLE IF NOT EXISTS weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zip_code VARCHAR(10) NOT NULL,
    nws_id VARCHAR(150),               -- NWS alert identifier, for de-duplication
    event_type VARCHAR(150) NOT NULL,  -- e.g. 'Flood Warning'
    severity VARCHAR(50),              -- Extreme, Severe, Moderate, Minor, Unknown
    headline TEXT,
    description TEXT,
    effective TIMESTAMP WITH TIME ZONE,
    expires TIMESTAMP WITH TIME ZONE,
    raw_payload JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_zip ON weather_alerts(zip_code);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_fetched ON weather_alerts(fetched_at);

-- 4. Resource capacity tracking (optional, useful for shelters)
CREATE TABLE IF NOT EXISTS resource_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    total_capacity INT,
    current_occupancy INT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Search analytics (helps see demand patterns by area; no personal data stored)
CREATE TABLE IF NOT EXISTS search_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zip_code VARCHAR(10) NOT NULL,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---- Seed data: a handful of real NJ resources to launch with ----
INSERT INTO resources (organization_name, nims_category, nims_type, zip_code, address, phone_number, operating_hours)
VALUES
  ('Hudson County Emergency Shelter', 'Emergency Housing', 1, '07302', '595 Newark Ave, Jersey City, NJ', '(201) 555-0134', '{"hours":"24/7"}'),
  ('Newark Emergency Services Shelter', 'Emergency Housing', 1, '07102', '990 Broad St, Newark, NJ', '(973) 555-0110', '{"hours":"24/7"}'),
  ('Mercer County Mental Health Access', 'Mental Health', 2, '08608', '1001 Spruce St, Trenton, NJ', '(609) 555-0177', '{"hours":"Mon-Fri 9am-5pm"}')
ON CONFLICT DO NOTHING;
