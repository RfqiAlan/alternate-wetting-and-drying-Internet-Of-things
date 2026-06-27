/*
 * ============================================================
 * Sistem Monitoring Tinggi Air Berbasis IoT
 * ============================================================
 * Hardware:
 *   - ESP32 DevKit
 *   - JSN-SR04T Waterproof Ultrasonic Sensor
 *   - SIM800C GSM/GPRS Module
 *   - Panel Surya 100W + LiFePO4 12V + LM2596
 *
 * Wiring:
 *   JSN-SR04T:
 *     Trigger -> GPIO 13
 *     Echo    -> GPIO 12
 *     VCC     -> 5V
 *     GND     -> GND
 *
 *   SIM800C (via HardwareSerial2):
 *     TX (SIM800C) -> GPIO 16 (RX2 ESP32)
 *     RX (SIM800C) -> GPIO 17 (TX2 ESP32)
 *     VCC          -> 5V/2A dedicated supply
 *     GND          -> Common GND
 *
 *   Battery Voltage Divider:
 *     GPIO 34 (ADC) <- voltage divider from 12V battery
 *     R1 = 30kΩ, R2 = 10kΩ (ratio 4:1, max ~3.3V at ADC)
 *
 * Libraries:
 *   - TinyGSM (https://github.com/vshymanskyy/TinyGSM)
 *   - ArduinoHttpClient
 *   - ArduinoJson
 * ============================================================
 */

// ==================== CONFIGURATION ====================

// -- Modem Configuration --
#define TINY_GSM_MODEM_SIM800
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>

// -- Pin Definitions --
#define TRIGGER_PIN       5     // D5       
#define ECHO_PIN          18    // D18
#define BATTERY_ADC_PIN   34
#define SIM800_TX_PIN     17    // ESP32 TX -> SIM800C RX
#define SIM800_RX_PIN     16    // ESP32 RX <- SIM800C TX

// -- Serial Configuration --
#define SerialMon         Serial
#define SerialAT          Serial2
#define GSM_BAUD          9600
#define MONITOR_BAUD      115200

// -- Network Configuration --
const char APN[]          = "internet";          // Ganti sesuai provider (Telkomsel: "internet", Indosat: "indosatgprs")
const char APN_USER[]     = "";
const char APN_PASS[]     = "";

// -- Server Configuration --
const char SERVER_HOST[]  = "3835e71d5b6265.lhr.life"; // Tunnel HTTP khusus agar bisa masuk ke laptop Anda
const int  SERVER_PORT    = 80; 
const char API_ENDPOINT[] = "/api/data";

// -- Device Configuration --
const char DEVICE_ID[]    = "flood-node-01";

// -- SMS Alert Configuration --
const char ALERT_PHONE[]  = "+62812XXXXXXXX";    // Ganti dengan nomor HP tujuan
bool smsAlertSent         = false;               // Flag agar SMS tidak dikirim berulang

// -- Sensor Configuration --
const float SENSOR_HEIGHT_CM  = 200.0;           // Tinggi sensor dari dasar (cm)
const float SPEED_OF_SOUND    = 0.0343;          // cm/µs (at ~20°C)
const int   NUM_READINGS      = 5;               // Jumlah pembacaan untuk rata-rata
const float MIN_VALID_DIST    = 25.0;            // Jarak minimum valid JSN-SR04T (cm)
const float MAX_VALID_DIST    = 450.0;           // Jarak maksimum valid (cm)

// -- Threshold (cm) --
const float THRESHOLD_WASPADA = 30.0;
const float THRESHOLD_BAHAYA  = 60.0;

// -- Timing --
const unsigned long SEND_INTERVAL_MS = 5 * 60 * 1000;  // 5 menit
const unsigned long DEEP_SLEEP_US    = 5 * 60 * 1000000ULL;  // 5 menit (deep sleep)
const bool USE_DEEP_SLEEP            = false;    // Set true untuk hemat daya

// -- Battery ADC --
const float VOLTAGE_DIVIDER_RATIO = 4.0;         // R1=30k, R2=10k => (30+10)/10 = 4
const float ADC_REFERENCE         = 3.3;
const int   ADC_RESOLUTION        = 4095;

// ==================== GLOBAL OBJECTS ====================

TinyGsm modem(SerialAT);
// Kembali menggunakan koneksi HTTP biasa
TinyGsmClient gsmClient(modem);
HttpClient http(gsmClient, SERVER_HOST, SERVER_PORT);

// ==================== SETUP ====================

void setup() {
  // Initialize Serial Monitor
  SerialMon.begin(MONITOR_BAUD);
  delay(100);

  SerialMon.println();
  SerialMon.println(F("========================================"));
  SerialMon.println(F(" Sistem Monitoring Tinggi Air v1.0"));
  SerialMon.println(F("========================================"));

  // Initialize sensor pins
  pinMode(TRIGGER_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BATTERY_ADC_PIN, INPUT);

  // Initialize SIM800C Serial
  SerialAT.begin(GSM_BAUD, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(3000);  // Wait for SIM800C to boot

  // Initialize modem
  SerialMon.println(F("[MODEM] Initializing..."));
  if (!modem.restart()) {
    SerialMon.println(F("[MODEM] Restart failed, trying init..."));
    modem.init();
  }

  String modemInfo = modem.getModemInfo();
  SerialMon.print(F("[MODEM] Info: "));
  SerialMon.println(modemInfo);

  // Wait for network
  SerialMon.println(F("[MODEM] Waiting for network..."));
  if (!modem.waitForNetwork(60000L)) {
    SerialMon.println(F("[MODEM] Network connection failed!"));
    handleError();
    return;
  }
  SerialMon.println(F("[MODEM] Network connected."));

  // Connect GPRS
  SerialMon.print(F("[GPRS] Connecting to APN: "));
  SerialMon.println(APN);
  if (!modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    SerialMon.println(F("[GPRS] Connection failed!"));
    handleError();
    return;
  }
  SerialMon.println(F("[GPRS] Connected."));
}

// ==================== MAIN LOOP ====================

void loop() {
  // 1. Read sensor data
  float waterLevel = readWaterLevel();
  float batteryVoltage = readBatteryVoltage();
  int signalStrength = modem.getSignalQuality();
  String status = determineStatus(waterLevel);

  // 2. Log to Serial Monitor
  printData(waterLevel, batteryVoltage, signalStrength, status);

  // 3. Send data to server
  bool sent = sendDataToServer(waterLevel, batteryVoltage, signalStrength, status);

  if (sent) {
    SerialMon.println(F("[HTTP] Data sent successfully."));
  } else {
    SerialMon.println(F("[HTTP] Failed to send data."));
    reconnectGPRS();
  }

  // 4. Handle SMS alerts
  handleSMSAlert(waterLevel, status);

  // 5. Sleep or delay
  if (USE_DEEP_SLEEP) {
    SerialMon.println(F("[POWER] Entering deep sleep..."));
    modem.gprsDisconnect();
    esp_deep_sleep_start();
  } else {
    delay(SEND_INTERVAL_MS);
  }
}

// ==================== SENSOR FUNCTIONS ====================

/**
 * Mengukur tinggi air menggunakan JSN-SR04T
 * Melakukan beberapa pembacaan dan menghitung rata-rata
 * Return: tinggi air dalam cm (0 jika error)
 */
float readWaterLevel() {
  float totalDistance = 0;
  int validReadings = 0;

  for (int i = 0; i < NUM_READINGS; i++) {
    float distance = measureDistance();

    if (distance >= MIN_VALID_DIST && distance <= MAX_VALID_DIST) {
      totalDistance += distance;
      validReadings++;
    }

    delay(100);  // Interval antar pembacaan
  }

  if (validReadings == 0) {
    SerialMon.println(F("[SENSOR] No valid readings!"));
    return 0;
  }

  float avgDistance = totalDistance / validReadings;
  float waterLevel = SENSOR_HEIGHT_CM - avgDistance;

  // Clamp to non-negative
  if (waterLevel < 0) waterLevel = 0;

  return waterLevel;
}

/**
 * Mengukur jarak menggunakan ultrasonic sensor
 * Return: jarak dalam cm
 */
float measureDistance() {
  // Send trigger pulse
  digitalWrite(TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGGER_PIN, LOW);

  // Read echo pulse
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // Timeout 30ms

  if (duration == 0) {
    return 0;  // No echo received
  }

  // Calculate distance
  float distance = (duration * SPEED_OF_SOUND) / 2.0;

  return distance;
}

/**
 * Membaca tegangan baterai melalui voltage divider
 * Return: tegangan dalam volt
 */
float readBatteryVoltage() {
  int adcValue = 0;

  // Rata-rata 10 pembacaan ADC
  for (int i = 0; i < 10; i++) {
    adcValue += analogRead(BATTERY_ADC_PIN);
    delay(10);
  }
  adcValue /= 10;

  float voltage = (adcValue / (float)ADC_RESOLUTION) * ADC_REFERENCE * VOLTAGE_DIVIDER_RATIO;

  return voltage;
}

// ==================== STATUS FUNCTIONS ====================

/**
 * Menentukan status berdasarkan tinggi air
 */
String determineStatus(float waterLevel) {
  if (waterLevel > THRESHOLD_BAHAYA) {
    return "BAHAYA";
  } else if (waterLevel > THRESHOLD_WASPADA) {
    return "WASPADA";
  } else {
    return "AMAN";
  }
}

// ==================== NETWORK FUNCTIONS ====================

/**
 * Mengirim data ke server via HTTP POST
 */
bool sendDataToServer(float waterLevel, float batteryVoltage, int signalStrength, String status) {
  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["water_level_cm"]   = round(waterLevel * 10.0) / 10.0;  // 1 decimal
  doc["battery_voltage"]  = round(batteryVoltage * 100.0) / 100.0;  // 2 decimals
  doc["signal_strength"]  = signalStrength;
  doc["status"]           = status;

  String payload;
  serializeJson(doc, payload);

  SerialMon.print(F("[HTTP] Sending: "));
  SerialMon.println(payload);

  // Check GPRS connection
  if (!modem.isGprsConnected()) {
    SerialMon.println(F("[GPRS] Not connected, reconnecting..."));
    if (!reconnectGPRS()) {
      return false;
    }
  }

  // Send HTTP POST
  http.beginRequest();
  http.post(API_ENDPOINT);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("Content-Length", payload.length());
  http.beginBody();
  http.print(payload);
  http.endRequest();

  // Check response
  int statusCode = http.responseStatusCode();
  String response = http.responseBody();

  SerialMon.print(F("[HTTP] Response code: "));
  SerialMon.println(statusCode);
  SerialMon.print(F("[HTTP] Response: "));
  SerialMon.println(response);

  return (statusCode >= 200 && statusCode < 300);
}

/**
 * Reconnect GPRS jika terputus
 */
bool reconnectGPRS() {
  SerialMon.println(F("[GPRS] Attempting reconnection..."));

  modem.gprsDisconnect();
  delay(1000);

  if (!modem.waitForNetwork(30000L)) {
    SerialMon.println(F("[MODEM] Network reconnection failed."));
    return false;
  }

  if (!modem.gprsConnect(APN, APN_USER, APN_PASS)) {
    SerialMon.println(F("[GPRS] Reconnection failed."));
    return false;
  }

  SerialMon.println(F("[GPRS] Reconnected."));
  return true;
}

// ==================== SMS ALERT FUNCTIONS ====================

/**
 * Mengirim SMS peringatan saat status BAHAYA
 * Hanya mengirim sekali sampai status kembali normal
 */
void handleSMSAlert(float waterLevel, String status) {
  if (status == "BAHAYA" && !smsAlertSent) {
    String message = "⚠️ PERINGATAN BANJIR!\n\n";
    message += "Device: " + String(DEVICE_ID) + "\n";
    message += "Tinggi Air: " + String(waterLevel, 1) + " cm\n";
    message += "Status: BAHAYA\n\n";
    message += "Segera lakukan evakuasi!";

    SerialMon.println(F("[SMS] Sending alert..."));

    if (modem.sendSMS(ALERT_PHONE, message)) {
      SerialMon.println(F("[SMS] Alert sent successfully."));
      smsAlertSent = true;
    } else {
      SerialMon.println(F("[SMS] Failed to send alert."));
    }
  }

  // Reset flag jika status kembali normal
  if (status == "AMAN") {
    smsAlertSent = false;
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Print data ke Serial Monitor
 */
void printData(float waterLevel, float batteryVoltage, int signalStrength, String status) {
  SerialMon.println(F("----------------------------------------"));
  SerialMon.print(F("[DATA] Water Level : "));
  SerialMon.print(waterLevel, 1);
  SerialMon.println(F(" cm"));
  SerialMon.print(F("[DATA] Battery     : "));
  SerialMon.print(batteryVoltage, 2);
  SerialMon.println(F(" V"));
  SerialMon.print(F("[DATA] Signal      : "));
  SerialMon.println(signalStrength);
  SerialMon.print(F("[DATA] Status      : "));
  SerialMon.println(status);
  SerialMon.println(F("----------------------------------------"));
}

/**
 * Handle error - restart modem dan coba lagi
 */
void handleError() {
  SerialMon.println(F("[ERROR] Critical error, restarting in 30s..."));
  delay(30000);
  ESP.restart();
}
