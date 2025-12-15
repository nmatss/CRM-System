-- ZippiCRM Database Initialization
-- This script runs automatically when the PostgreSQL container starts

-- Enable UUID extension (used for user IDs)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant all privileges to the zippcrm user
GRANT ALL PRIVILEGES ON DATABASE zippcrm TO zippcrm;

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO zippcrm;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'ZippiCRM database initialized successfully!';
END $$;
