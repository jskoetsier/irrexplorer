-- Bootstrap schema for irrexplorer's go-backend.
-- This file is idempotent: safe to re-run on every helm upgrade.
--
-- Reconstructed 2026-05-12 after a fresh DB had to be provisioned (the original
-- schema was implicit, created by the legacy Python codebase that no longer
-- ships migrations).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- BGP routes (populated by importer; rpki_status currently always NULL).
-- asn is bigint so it can hold 4-byte ASNs (>2^31).
CREATE TABLE IF NOT EXISTS bgp (
    prefix      cidr   NOT NULL,
    asn         bigint NOT NULL,
    rpki_status text
);
CREATE INDEX IF NOT EXISTS ix_bgp_staging_prefix ON bgp USING GIST (prefix inet_ops);
CREATE INDEX IF NOT EXISTS idx_bgp_asn           ON bgp (asn);

-- Staging table for the BGP importer's atomic swap (importer/bgp.go).
CREATE TABLE IF NOT EXISTS bgp_staging (LIKE bgp INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

-- Heal pre-existing deployments where asn was int4.
ALTER TABLE bgp         ALTER COLUMN asn TYPE bigint;
ALTER TABLE bgp_staging ALTER COLUMN asn TYPE bigint;

-- RIR enum: keys must match importer/rirstats.go rirURLs map.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rir') THEN
        CREATE TYPE rir AS ENUM ('RIPENCC', 'ARIN', 'AFRINIC', 'LACNIC', 'APNIC', 'REGISTROBR');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS rirstats (
    prefix cidr NOT NULL,
    rir    rir  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rirstats_prefix ON rirstats USING GIST (prefix inet_ops);

-- Single-row table tracking the last successful importer run.
CREATE TABLE IF NOT EXISTS last_data_import (
    last_data_import timestamp with time zone NOT NULL
);
