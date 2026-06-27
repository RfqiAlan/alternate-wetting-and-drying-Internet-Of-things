/**
 * ============================================================
 * HTTP → HTTPS Relay untuk SIM800C
 * ============================================================
 * Script kecil ini menjembatani SIM800C (yang hanya bisa HTTP)
 * dengan server Vercel (yang membutuhkan HTTPS).
 *
 * Alur:
 *   SIM800C → HTTP → Ngrok → Relay ini → HTTPS → Vercel → Supabase
 *
 * Cara pakai:
 *   1. Jalankan: node relay.js
 *   2. Buka terminal baru, jalankan: ngrok http 4001
 *   3. Masukkan link ngrok (http) ke firmware ESP32
 * ============================================================
 */

const http = require('http');
const https = require('https');

const RELAY_PORT = 4001;
const VERCEL_URL = 'https://alternate-wetting-and-drying-intern.vercel.app/api/data';

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'relay running', target: VERCEL_URL }));
    return;
  }

  // Hanya terima POST ke /api/data
  if (req.method === 'POST' && req.url === '/api/data') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 📥 Data diterima dari ESP32:`);
      console.log(`   ${body}`);
      console.log(`[${timestamp}] 📤 Meneruskan ke Vercel...`);

      // Forward ke Vercel via HTTPS
      const url = new URL(VERCEL_URL);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';
        proxyRes.on('data', chunk => {
          responseBody += chunk.toString();
        });
        proxyRes.on('end', () => {
          console.log(`[${timestamp}] ✅ Vercel response: ${proxyRes.statusCode}`);
          console.log(`   ${responseBody}`);
          console.log('');

          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(responseBody);
        });
      });

      proxyReq.on('error', (err) => {
        console.error(`[${timestamp}] ❌ Gagal meneruskan ke Vercel:`, err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Relay failed to reach Vercel' }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(RELAY_PORT, () => {
  console.log('');
  console.log('========================================');
  console.log(' 🔄 HTTP → HTTPS Relay Server');
  console.log('========================================');
  console.log(`  Relay berjalan di: http://localhost:${RELAY_PORT}`);
  console.log(`  Target Vercel   : ${VERCEL_URL}`);
  console.log('');
  console.log('  Langkah selanjutnya:');
  console.log('  1. Buka terminal BARU');
  console.log('  2. Jalankan: ngrok http 4001');
  console.log('  3. Copy link HTTP ngrok ke firmware ESP32');
  console.log('========================================');
  console.log('');
});
