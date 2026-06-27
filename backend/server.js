/**
 * Water Monitoring API Server
 * 
 * Express server untuk menerima data dari ESP32
 * dan menyajikan data ke dashboard web.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { testConnection } = require('./db');
const monitoringRoutes = require('./routes/monitoring');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration (Izinkan dari mana saja untuk mempermudah test)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

// JSON body parser
app.use(express.json({ limit: '1kb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'Water Monitoring API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Monitoring API routes
app.use('/api', monitoringRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ==================== START SERVER ====================

async function start() {
  console.log('');
  console.log('========================================');
  console.log(' Water Monitoring API Server');
  console.log('========================================');

  // Test database connection
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.warn('[SERVER] ⚠️  Database not connected. Server will start but API calls requiring DB will fail.');
    console.warn('[SERVER] Make sure PostgreSQL is running and .env is configured correctly.');
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Running on http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');
    console.log('');
    console.log('Available endpoints:');
    console.log(`  GET  http://localhost:${PORT}/              - Server info`);
    console.log(`  GET  http://localhost:${PORT}/health        - Health check`);
    console.log(`  POST http://localhost:${PORT}/api/data      - Submit sensor data`);
    console.log(`  GET  http://localhost:${PORT}/api/data/latest  - Latest readings`);
    console.log(`  GET  http://localhost:${PORT}/api/data/history - Historical data`);
    console.log(`  GET  http://localhost:${PORT}/api/data/stats   - Statistics`);
    console.log('');
  });
}

start();
