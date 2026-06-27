/**
 * ============================================================
 * Dashboard Water Monitoring - Application Logic
 * ============================================================
 * Handles data fetching, DOM updates, chart rendering,
 * and real-time auto-refresh functionality.
 * ============================================================
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  // API Base URL - ubah sesuai server backend
  API_BASE_URL: 'https://alternate-wetting-and-drying-intern.vercel.app/api',

  // Device ID
  DEVICE_ID: 'flood-node-01',

  // Auto-refresh interval (ms)
  REFRESH_INTERVAL: 30000, // 30 detik

  // Chart history hours
  DEFAULT_HISTORY_HOURS: 24,

  // Thresholds (cm)
  THRESHOLD_WASPADA: 30,
  THRESHOLD_BAHAYA: 60,
  MAX_LEVEL: 100,  // Untuk gauge calculation

  // Demo mode - gunakan data demo jika true (untuk testing tanpa backend)
  DEMO_MODE: false,
};

// ==================== STATE ====================

let state = {
  currentData: null,
  historyData: [],
  chart: null,
  refreshTimer: null,
  isLoading: true,
  isOnline: false,
  selectedHours: CONFIG.DEFAULT_HISTORY_HOURS,
  demoIndex: 0,
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

async function initDashboard() {
  // Initialize chart
  initChart();

  // Setup event listeners
  setupEventListeners();

  // Initial data fetch
  await fetchAllData();

  // Start auto-refresh
  startAutoRefresh();
}

// ==================== DATA FETCHING ====================

async function fetchAllData() {
  setLoading(true);

  try {
    if (CONFIG.DEMO_MODE) {
      // Use demo data
      const demoLatest = generateDemoLatest();
      const demoHistory = generateDemoHistory();

      updateDashboard(demoLatest);
      updateChart(demoHistory);
      setOnlineStatus(true);
    } else {
      // Fetch from real API
      const [latestRes, historyRes] = await Promise.all([
        fetch(`${CONFIG.API_BASE_URL}/data/latest?device_id=${CONFIG.DEVICE_ID}`),
        fetch(`${CONFIG.API_BASE_URL}/data/history?device_id=${CONFIG.DEVICE_ID}&hours=${state.selectedHours}`)
      ]);

      if (!latestRes.ok || !historyRes.ok) {
        throw new Error('API request failed');
      }

      const latestData = await latestRes.json();
      const historyData = await historyRes.json();

      if (latestData.success && latestData.data) {
        updateDashboard(latestData.data);
      }

      if (historyData.success && historyData.data) {
        updateChart(historyData.data);
      }

      setOnlineStatus(true);
    }
  } catch (err) {
    console.error('[Dashboard] Fetch error:', err);
    setOnlineStatus(false);

    // If first load fails, show demo data as fallback
    if (!state.currentData) {
      const demoLatest = generateDemoLatest();
      const demoHistory = generateDemoHistory();
      updateDashboard(demoLatest);
      updateChart(demoHistory);
    }
  } finally {
    setLoading(false);
  }
}

// ==================== DASHBOARD UPDATE ====================

function updateDashboard(data) {
  state.currentData = data;

  // Update water level display
  updateWaterLevel(data.water_level_cm, data.status);

  // Update status badge
  updateStatusBadge(data.status);

  // Update gauge
  updateGauge(data.water_level_cm, data.status);

  // Update info cards
  updateBattery(data.battery_voltage);
  updateSignal(data.signal_strength);
  updateLastUpdate(data.created_at || new Date().toISOString());

  // Update body status class for global theming
  document.body.className = `status-${data.status.toLowerCase()}`;
}

// ==================== WATER LEVEL ====================

function updateWaterLevel(level, status) {
  const valueEl = document.getElementById('water-level-value');
  const unitEl = document.getElementById('water-level-unit');

  if (valueEl) {
    // Animate number change
    animateNumber(valueEl, parseFloat(level), 1);
  }
}

function animateNumber(el, target, decimals = 1) {
  const current = parseFloat(el.textContent) || 0;
  const diff = target - current;
  const duration = 800;
  const start = performance.now();

  function step(timestamp) {
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out-cubic)
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = current + diff * eased;

    el.textContent = value.toFixed(decimals);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// ==================== STATUS BADGE ====================

function updateStatusBadge(status) {
  const badge = document.getElementById('status-badge');
  if (!badge) return;

  const statusLower = status.toLowerCase();
  badge.className = `status-badge badge-${statusLower}`;

  const textEl = badge.querySelector('.badge-text');
  if (textEl) textEl.textContent = status;
}

// ==================== GAUGE ====================

function updateGauge(level, status) {
  const gaugeEl = document.getElementById('gauge-fill');
  const percentEl = document.getElementById('gauge-percentage');

  if (!gaugeEl || !percentEl) return;

  const percentage = Math.min((level / CONFIG.MAX_LEVEL) * 100, 100);
  const circumference = 2 * Math.PI * 70; // radius = 70
  const offset = circumference - (percentage / 100) * circumference;

  gaugeEl.style.strokeDasharray = circumference;
  gaugeEl.style.strokeDashoffset = offset;

  // Color based on status
  const colors = {
    'AMAN': '#22c55e',
    'WASPADA': '#f59e0b',
    'BAHAYA': '#ef4444'
  };
  gaugeEl.style.stroke = colors[status] || colors['AMAN'];

  // Update percentage text
  percentEl.textContent = `${Math.round(percentage)}%`;
  percentEl.style.color = colors[status] || colors['AMAN'];
}

// ==================== BATTERY ====================

function updateBattery(voltage) {
  const valueEl = document.getElementById('battery-value');
  const barEl = document.getElementById('battery-bar');
  const detailEl = document.getElementById('battery-detail');

  if (!valueEl) return;

  const v = parseFloat(voltage) || 0;
  valueEl.textContent = `${v.toFixed(1)}V`;

  // LiFePO4 12V: 10V = 0%, 14.6V = 100%
  const minV = 10.0;
  const maxV = 14.6;
  const percent = Math.max(0, Math.min(100, ((v - minV) / (maxV - minV)) * 100));

  if (barEl) barEl.style.width = `${percent}%`;

  if (detailEl) {
    let label = 'Normal';
    if (percent > 80) label = 'Terisi Penuh';
    else if (percent > 50) label = 'Baik';
    else if (percent > 20) label = 'Rendah';
    else label = 'Kritis';
    detailEl.textContent = `${Math.round(percent)}% • ${label}`;
  }
}

// ==================== SIGNAL STRENGTH ====================

function updateSignal(rssi) {
  const valueEl = document.getElementById('signal-value');
  const barEl = document.getElementById('signal-bar');
  const detailEl = document.getElementById('signal-detail');

  if (!valueEl) return;

  const s = parseInt(rssi) || 0;
  valueEl.textContent = s;

  // GSM signal quality: 0-31 (31 = best)
  const percent = Math.min(100, (s / 31) * 100);

  if (barEl) barEl.style.width = `${percent}%`;

  if (detailEl) {
    let label = 'Tidak Ada';
    if (s >= 20) label = 'Sangat Kuat';
    else if (s >= 15) label = 'Kuat';
    else if (s >= 10) label = 'Sedang';
    else if (s >= 5) label = 'Lemah';
    else label = 'Sangat Lemah';
    detailEl.textContent = `${Math.round(percent)}% • ${label}`;
  }
}

// ==================== LAST UPDATE ====================

function updateLastUpdate(timestamp) {
  const valueEl = document.getElementById('update-value');
  const detailEl = document.getElementById('update-detail');

  if (!valueEl) return;

  const date = new Date(timestamp);
  valueEl.textContent = formatRelativeTime(date);

  if (detailEl) {
    detailEl.textContent = date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return date.toLocaleDateString('id-ID');
}

// ==================== CHART ====================

function initChart() {
  const ctx = document.getElementById('history-chart');
  if (!ctx) return;

  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Tinggi Air (cm)',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: createGradient(ctx),
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#3b82f6',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: {
            family: "'Inter', sans-serif",
            size: 13,
            weight: '600',
          },
          bodyFont: {
            family: "'JetBrains Mono', monospace",
            size: 12,
          },
          callbacks: {
            title: function (items) {
              const date = new Date(items[0].label);
              return date.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });
            },
            label: function (item) {
              const level = item.raw;
              let status = 'AMAN';
              if (level > CONFIG.THRESHOLD_BAHAYA) status = 'BAHAYA';
              else if (level > CONFIG.THRESHOLD_WASPADA) status = 'WASPADA';
              return ` ${level.toFixed(1)} cm • ${status}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            displayFormats: {
              hour: 'HH:mm',
              minute: 'HH:mm',
            },
            tooltipFormat: 'yyyy-MM-dd HH:mm',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: {
              family: "'JetBrains Mono', monospace",
              size: 10,
            },
            maxTicksLimit: 12,
          },
          border: {
            display: false,
          }
        },
        y: {
          min: 0,
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: {
              family: "'JetBrains Mono', monospace",
              size: 10,
            },
            callback: (value) => `${value} cm`,
          },
          border: {
            display: false,
          }
        }
      },
      // Threshold annotation lines
      annotation: {
        annotations: {
          waspada: {
            type: 'line',
            yMin: CONFIG.THRESHOLD_WASPADA,
            yMax: CONFIG.THRESHOLD_WASPADA,
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            borderDash: [5, 5],
          },
          bahaya: {
            type: 'line',
            yMin: CONFIG.THRESHOLD_BAHAYA,
            yMax: CONFIG.THRESHOLD_BAHAYA,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderWidth: 1,
            borderDash: [5, 5],
          }
        }
      }
    }
  });
}

function createGradient(ctx) {
  const canvas = ctx.getContext ? ctx : ctx.canvas;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
  gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.1)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
  return gradient;
}

function updateChart(historyData) {
  if (!state.chart) return;

  state.historyData = historyData;

  const labels = historyData.map(d => d.created_at || d.timestamp);
  const values = historyData.map(d => d.water_level_cm);

  state.chart.data.labels = labels;
  state.chart.data.datasets[0].data = values;

  // Dynamic color segments based on value
  const colors = values.map(v => {
    if (v > CONFIG.THRESHOLD_BAHAYA) return '#ef4444';
    if (v > CONFIG.THRESHOLD_WASPADA) return '#f59e0b';
    return '#3b82f6';
  });

  state.chart.update('none');
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Chart period buttons
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hours = parseInt(e.target.dataset.hours);
      if (hours) {
        state.selectedHours = hours;

        // Update active button
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Refetch with new time range
        fetchAllData();
      }
    });
  });

  // Retry button
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', fetchAllData);
  }
}

// ==================== AUTO-REFRESH ====================

function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);

  state.refreshTimer = setInterval(() => {
    fetchAllData();
  }, CONFIG.REFRESH_INTERVAL);

  // Update the countdown display
  updateRefreshCountdown();
}

function updateRefreshCountdown() {
  const el = document.getElementById('next-refresh');
  if (!el) return;

  let seconds = CONFIG.REFRESH_INTERVAL / 1000;

  setInterval(() => {
    seconds--;
    if (seconds <= 0) seconds = CONFIG.REFRESH_INTERVAL / 1000;
    el.textContent = `Refresh in ${seconds}s`;
  }, 1000);
}

// ==================== UI HELPERS ====================

function setLoading(isLoading) {
  state.isLoading = isLoading;
  // Could toggle skeleton loaders here
}

function setOnlineStatus(isOnline) {
  state.isOnline = isOnline;

  const dot = document.getElementById('connection-dot');
  const text = document.getElementById('connection-text');

  if (dot) {
    dot.className = `status-dot ${isOnline ? '' : 'offline'}`;
  }
  if (text) {
    text.textContent = isOnline ? 'Terhubung' : 'Terputus';
  }
}

// ==================== DEMO DATA GENERATOR ====================

function generateDemoLatest() {
  // Simulate changing water levels
  state.demoIndex++;
  const time = state.demoIndex * 0.3;

  // Create a wave pattern
  const baseLevel = 35 + 25 * Math.sin(time * 0.5) + 5 * Math.sin(time * 1.3);
  const level = Math.max(5, Math.min(85, baseLevel + (Math.random() - 0.5) * 8));

  let status = 'AMAN';
  if (level > CONFIG.THRESHOLD_BAHAYA) status = 'BAHAYA';
  else if (level > CONFIG.THRESHOLD_WASPADA) status = 'WASPADA';

  return {
    device_id: CONFIG.DEVICE_ID,
    water_level_cm: parseFloat(level.toFixed(1)),
    battery_voltage: 12.5 + Math.random() * 1.5,
    signal_strength: Math.floor(10 + Math.random() * 18),
    status: status,
    created_at: new Date().toISOString(),
  };
}

function generateDemoHistory() {
  const data = [];
  const now = new Date();
  const hours = state.selectedHours;
  const points = Math.min(hours * 6, 200); // ~1 point per 10 min

  for (let i = 0; i < points; i++) {
    const timestamp = new Date(now.getTime() - (points - i) * (hours * 3600000 / points));
    const t = i / points;

    // Create realistic water level pattern
    const baseLevel = 20 + 15 * Math.sin(t * Math.PI * 2)
      + 10 * Math.sin(t * Math.PI * 4.7)
      + 5 * Math.sin(t * Math.PI * 8.3);
    const level = Math.max(5, Math.min(80, baseLevel + (Math.random() - 0.5) * 6));

    let status = 'AMAN';
    if (level > CONFIG.THRESHOLD_BAHAYA) status = 'BAHAYA';
    else if (level > CONFIG.THRESHOLD_WASPADA) status = 'WASPADA';

    data.push({
      water_level_cm: parseFloat(level.toFixed(1)),
      status: status,
      created_at: timestamp.toISOString(),
    });
  }

  return data;
}
