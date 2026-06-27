/*
 * ============================================================
 * TEST SCRIPT: SIM800C + ESP32 (Serial Passthrough & Basic Info)
 * ============================================================
 * Gunakan kode ini HANYA untuk mengetes apakah modul GSM SIM800C 
 * Anda berfungsi normal, merespons AT Commands, dan mendapat sinyal.
 *
 * Wiring (ESP32 -> SIM800C):
 *   TX2 (GPIO 17) -> RX SIM800C
 *   RX2 (GPIO 16) -> TX SIM800C
 *   GND           -> GND (Wajib digabung!)
 *
 * PENTING: SIM800C butuh power supply 5V yang kuat (minimal 2A). 
 * Jangan ambil daya 5V langsung dari pin ESP32 jika sering restart.
 * ============================================================
 */

#define SIM800_TX_PIN 17
#define SIM800_RX_PIN 16

void setup() {
  // Mulai komunikasi Serial Monitor (ke laptop)
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=========================================");
  Serial.println("   Memulai Test Komunikasi SIM800C");
  Serial.println("=========================================");
  Serial.println("Sedang menyalakan modul GSM, mohon tunggu 3 detik...");
  
  // Mulai komunikasi Hardware Serial 2 (ke SIM800C)
  Serial2.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(3000);

  // Tes awal AT Command otomatis
  Serial.println("\n[1] Mengirim AT Command Dasar...");
  Serial2.println("AT");
  delay(500);
  readGSM();

  Serial.println("\n[2] Cek Kualitas Sinyal (CSQ)...");
  Serial2.println("AT+CSQ");
  delay(500);
  readGSM();

  Serial.println("\n[3] Cek Registrasi Jaringan (CREG)...");
  // 0,1 atau 0,5 artinya sukses terhubung ke jaringan
  Serial2.println("AT+CREG?");
  delay(500);
  readGSM();
  
  Serial.println("\n[4] Cek Info Provider & Versi Modem...");
  Serial2.println("ATI");
  delay(500);
  readGSM();

  Serial.println("\n=========================================");
  Serial.println(" MODE MANUAL AKTIF");
  Serial.println(" Silakan ketik perintah AT (misal: AT+CCID) di kotak Serial Monitor di atas lalu tekan Enter.");
  Serial.println("=========================================");
}

void loop() {
  // Jika ada balasan dari SIM800C, tampilkan di Serial Monitor
  if (Serial2.available()) {
    Serial.write(Serial2.read());
  }
  
  // Jika Anda mengetik sesuatu di Serial Monitor laptop, kirim ke SIM800C
  if (Serial.available()) {
    Serial2.write(Serial.read());
  }
}

// Fungsi bantuan untuk membaca balasan otomatis
void readGSM() {
  while (Serial2.available()) {
    Serial.write(Serial2.read());
  }
}
