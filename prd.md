# Product Requirements Document (PRD)

## Judul Proyek

Sistem Monitoring Tinggi Air Berbasis IoT Menggunakan ESP32, SIM800C, dan Dashboard Web

## 1. Latar Belakang

Banjir dan kenaikan muka air sering terjadi tanpa peringatan yang memadai. Dibutuhkan sistem pemantauan tinggi air yang dapat bekerja secara mandiri menggunakan tenaga surya dan mengirimkan data secara real-time ke dashboard web sehingga kondisi dapat dipantau dari mana saja.

---

## 2. Tujuan Produk

Membangun perangkat IoT yang mampu:

* Mengukur tinggi muka air secara berkala.
* Mengirim data ke server menggunakan jaringan GSM/GPRS.
* Menampilkan data secara real-time pada dashboard web.
* Memberikan peringatan ketika tinggi air melewati batas tertentu.
* Beroperasi mandiri menggunakan panel surya dan baterai LiFePO4.

---

## 3. Target Pengguna

* Masyarakat sekitar daerah rawan banjir.
* Pemerintah desa atau kelurahan.
* Peneliti dan akademisi.
* Instansi pengelola sumber daya air.

---

## 4. Komponen Hardware

### Sensor

* JSN-SR04T Waterproof Ultrasonic Sensor

### Mikrokontroler

* ESP32

### Komunikasi

* SIM800C GSM/GPRS Module

### Sistem Daya

* Panel surya 100W
* Solar Charge Controller PWM
* Baterai LiFePO4 12V
* LM2596 Step Down Converter

---

## 5. Fitur Utama

### 5.1 Monitoring Tinggi Air

* Sensor mengukur tinggi air setiap interval tertentu.
* Data dikonversi menjadi tinggi muka air aktual.

### 5.2 Pengiriman Data

* Data dikirim melalui jaringan GSM menggunakan GPRS.
* Interval pengiriman dapat diatur.

### 5.3 Dashboard Web

Dashboard menampilkan:

* Tinggi air terkini.
* Grafik histori tinggi air.
* Status kondisi air.
* Waktu pembaruan terakhir.
* Tegangan baterai perangkat.
* Kualitas sinyal GSM.

### 5.4 Notifikasi

Jika tinggi air melewati ambang tertentu:

* Status berubah otomatis.
* Sistem dapat mengirim SMS peringatan.

---

## 6. Status Ketinggian Air

| Tinggi Air | Status  |
| ---------- | ------- |
| 0 - 30 cm  | Aman    |
| 31 - 60 cm | Waspada |
| > 60 cm    | Bahaya  |

Nilai ambang dapat diubah sesuai kondisi lapangan.

---

## 7. Data yang Dikirim ke Server

```json
{
  "device_id": "flood-node-01",
  "water_level_cm": 42,
  "battery_voltage": 13.1,
  "signal_strength": 14,
  "status": "WASPADA",
  "timestamp": "2026-06-27T12:30:00Z"
}
```

---

## 8. Struktur Database

### Tabel: water_monitoring

| Field           | Tipe Data |
| --------------- | --------- |
| id              | bigint    |
| device_id       | text      |
| water_level_cm  | float     |
| battery_voltage | float     |
| signal_strength | integer   |
| status          | text      |
| created_at      | timestamp |

---

## 9. Arsitektur Sistem

Sensor JSN-SR04T
↓
ESP32
↓
SIM800C (GPRS)
↓
API Backend
↓
Database PostgreSQL
↓
Dashboard Web

---

## 10. Non Functional Requirements

* Sistem berjalan 24 jam.
* Konsumsi daya rendah.
* Tahan terhadap kondisi luar ruangan.
* Data tersimpan minimal selama 1 tahun.
* Dashboard dapat diakses melalui perangkat mobile dan desktop.

---

## 11. Tahapan Pengembangan

### Fase 1

* Pengujian sensor ultrasonik.
* Pengujian komunikasi GSM.
* Pengujian SMS.

### Fase 2

* Pengiriman data menggunakan GPRS.
* Pembuatan API backend.
* Integrasi database.

### Fase 3

* Pembuatan dashboard web.
* Pengujian lapangan.
* Optimasi konsumsi daya.

---

## 12. Kriteria Keberhasilan

* Data tinggi air berhasil dikirim ke server minimal 95%.
* Dashboard menampilkan data kurang dari 30 detik setelah pengukuran.
* Sistem dapat beroperasi secara mandiri menggunakan tenaga surya.
* Notifikasi terkirim saat kondisi bahaya terjadi.
