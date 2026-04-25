-- Enable pgcrypto extension required by generate_gateway_api_key function
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;