/**
 * Monitoring Routes
 * 
 * API endpoints untuk menerima dan menyajikan data monitoring tinggi air.
 * 
 * Endpoints:
 *   POST  /api/data          - Menerima data dari ESP32
 *   GET   /api/data/latest   - Data terbaru per device
 *   GET   /api/data/history  - Histori data (query params: hours, device_id)
 *   GET   /api/data/stats    - Statistik (min, max, avg)
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ==================== POST /api/data ====================
// Menerima data dari perangkat IoT (ESP32)
router.post('/data', async (req, res) => {
  try {
    const { device_id, water_level_cm, battery_voltage, signal_strength, status } = req.body;

    // Validasi field required
    if (!device_id || water_level_cm === undefined || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, water_level_cm, status'
      });
    }

    // Validasi status
    const validStatuses = ['AMAN', 'WASPADA', 'BAHAYA'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Insert ke database
    const query = `
      INSERT INTO water_monitoring (device_id, water_level_cm, battery_voltage, signal_strength, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, device_id, water_level_cm, battery_voltage, signal_strength, status, created_at
    `;
    const values = [device_id, water_level_cm, battery_voltage || null, signal_strength || null, status];
    const result = await pool.query(query, values);

    console.log(`[API] Data received from ${device_id}: ${water_level_cm}cm (${status})`);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error('[API] POST /data error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ==================== GET /api/data/latest ====================
// Mengambil data terbaru untuk setiap device
router.get('/data/latest', async (req, res) => {
  try {
    const { device_id } = req.query;

    let query;
    let values = [];

    if (device_id) {
      // Data terbaru untuk device tertentu
      query = `
        SELECT id, device_id, water_level_cm, battery_voltage, signal_strength, status, created_at
        FROM water_monitoring
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      values = [device_id];
    } else {
      // Data terbaru untuk semua device (menggunakan DISTINCT ON)
      query = `
        SELECT DISTINCT ON (device_id)
          id, device_id, water_level_cm, battery_voltage, signal_strength, status, created_at
        FROM water_monitoring
        ORDER BY device_id, created_at DESC
      `;
    }

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: device_id ? (result.rows[0] || null) : result.rows
    });

  } catch (err) {
    console.error('[API] GET /data/latest error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ==================== GET /api/data/history ====================
// Mengambil histori data dengan filter waktu
router.get('/data/history', async (req, res) => {
  try {
    const device_id = req.query.device_id || 'flood-node-01';
    const hours = parseInt(req.query.hours) || 24;
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);

    const query = `
      SELECT id, device_id, water_level_cm, battery_voltage, signal_strength, status, created_at
      FROM water_monitoring
      WHERE device_id = $1
        AND created_at >= NOW() - INTERVAL '1 hour' * $2
      ORDER BY created_at ASC
      LIMIT $3
    `;
    const values = [device_id, hours, limit];
    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      device_id,
      period_hours: hours,
      data: result.rows
    });

  } catch (err) {
    console.error('[API] GET /data/history error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ==================== GET /api/data/stats ====================
// Mengambil statistik data (min, max, avg) dalam periode tertentu
router.get('/data/stats', async (req, res) => {
  try {
    const device_id = req.query.device_id || 'flood-node-01';
    const hours = parseInt(req.query.hours) || 24;

    const query = `
      SELECT
        COUNT(*)::int AS total_readings,
        ROUND(MIN(water_level_cm)::numeric, 1) AS min_level,
        ROUND(MAX(water_level_cm)::numeric, 1) AS max_level,
        ROUND(AVG(water_level_cm)::numeric, 1) AS avg_level,
        ROUND(MIN(battery_voltage)::numeric, 2) AS min_voltage,
        ROUND(MAX(battery_voltage)::numeric, 2) AS max_voltage,
        ROUND(AVG(battery_voltage)::numeric, 2) AS avg_voltage,
        MIN(created_at) AS first_reading,
        MAX(created_at) AS last_reading
      FROM water_monitoring
      WHERE device_id = $1
        AND created_at >= NOW() - INTERVAL '1 hour' * $2
    `;
    const values = [device_id, hours];
    const result = await pool.query(query, values);

    res.json({
      success: true,
      device_id,
      period_hours: hours,
      stats: result.rows[0]
    });

  } catch (err) {
    console.error('[API] GET /data/stats error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
