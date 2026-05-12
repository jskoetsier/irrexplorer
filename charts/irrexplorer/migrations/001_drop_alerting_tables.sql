-- Drop user/alerting tables that were scaffolded but never fully implemented.
-- These are not used by any remaining Go endpoint.

DROP TABLE IF EXISTS bgp_alert_events CASCADE;
DROP TABLE IF EXISTS alert_configurations CASCADE;
DROP TABLE IF EXISTS user_monitored_asns CASCADE;
DROP TABLE IF EXISTS user_emails CASCADE;
DROP TABLE IF EXISTS bgp_users CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
