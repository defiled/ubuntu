-- PostgreSQL 15+ requires explicit schema ownership grant
-- This script runs automatically when the container is first created

-- Grant public schema ownership to app_user
ALTER SCHEMA public OWNER TO app_user;
GRANT ALL ON SCHEMA public TO app_user;

-- Grant database-level privileges
GRANT ALL PRIVILEGES ON DATABASE payment_demo TO app_user;
