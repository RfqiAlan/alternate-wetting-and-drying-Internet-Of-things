-- ============================================================
-- Sistem Monitoring Tinggi Air - Database Schema
-- ============================================================
-- Jalankan script ini di PostgreSQL untuk membuat tabel.
--
-- Cara menjalankan:
--   1. Buat database:  CREATE DATABASE water_monitoring;
--   2. Jalankan file:  psql -d water_monitoring -f schema.sql
-- ============================================================

-- Buat tabel utama
CREATE TABLE IF NOT EXISTS water_monitoring (
    id              BIGSERIAL PRIMARY KEY,
    device_id       TEXT NOT NULL,
    water_level_cm  FLOAT NOT NULL,
    battery_voltage FLOAT,
    signal_strength INTEGER,
    status          TEXT NOT NULL CHECK (status IN ('AMAN', 'WASPADA', 'BAHAYA')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query berdasarkan device dan waktu (descending untuk data terbaru)
CREATE INDEX IF NOT EXISTS idx_wm_device_created
    ON water_monitoring (device_id, created_at DESC);

-- Index untuk query berdasarkan status (untuk filtering alert)
CREATE INDEX IF NOT EXISTS idx_wm_status
    ON water_monitoring (status);

-- ============================================================
-- Contoh data untuk testing (opsional, hapus di production)
-- ============================================================
INSERT INTO water_monitoring (device_id, water_level_cm, battery_voltage, signal_strength, status, created_at)
VALUES
    ('flood-node-01', 15.2, 13.2, 18, 'AMAN',    NOW() - INTERVAL '4 hours'),
    ('flood-node-01', 18.7, 13.1, 16, 'AMAN',    NOW() - INTERVAL '3 hours 30 minutes'),
    ('flood-node-01', 22.4, 13.0, 17, 'AMAN',    NOW() - INTERVAL '3 hours'),
    ('flood-node-01', 28.9, 12.9, 15, 'AMAN',    NOW() - INTERVAL '2 hours 30 minutes'),
    ('flood-node-01', 35.1, 12.8, 14, 'WASPADA', NOW() - INTERVAL '2 hours'),
    ('flood-node-01', 42.6, 12.7, 13, 'WASPADA', NOW() - INTERVAL '1 hour 30 minutes'),
    ('flood-node-01', 55.3, 12.6, 12, 'WASPADA', NOW() - INTERVAL '1 hour'),
    ('flood-node-01', 63.8, 12.5, 11, 'BAHAYA',  NOW() - INTERVAL '30 minutes'),
    ('flood-node-01', 58.2, 12.6, 13, 'WASPADA', NOW() - INTERVAL '15 minutes'),
    ('flood-node-01', 45.0, 12.7, 14, 'WASPADA', NOW());
