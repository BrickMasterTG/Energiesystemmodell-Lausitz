/*
 * ESP3 — 4x Relay + Motor (Zug) + Wind-Pin
 * Kommunikation: ESP-NOW (kein WiFi-Stack nötig)
 *
 * Beim ersten Start: Serial Monitor öffnen und die Zeile
 * "ESP-NOW MAC: AA:BB:CC:DD:EE:FF" ablesen → in ESP_Host.ino eintragen!
 */

#include <WiFi.h>
#include <esp_now.h>
#include <esp_mac.h>

// ============================================================================
// RELAY KONFIGURATION
// ============================================================================
struct RelayConfig { uint8_t pin; const char* name; bool activeLow; };
const int RELAY_COUNT = 5;
RelayConfig RELAYS[RELAY_COUNT] = {
  {19, "Relais 2", true},
  {21, "Relais 3", true},
  {22, "Relais 4", true},
  {23, "Relais 5", true},
  {27, "Wind", false},
};

inline int logicalToPhys(int v, bool al) { return al ? (v ? LOW : HIGH) : (v ? HIGH : LOW); }
inline int physToLogical(int v, bool al) { return al ? (v == LOW ? 1 : 0) : (v == HIGH ? 1 : 0); }

// ============================================================================
// MOTOR (Zug) — L298N oder vergleichbar
// ============================================================================
#define ENA 32
#define IN1 25
#define IN2 26
#define PWM_FREQ 1000
#define PWM_RES  8

int  pwmValue    = 0;
bool motorForward = true;

void setMotor(int speed, bool forward) {
  pwmValue    = constrain(speed, 0, (1 << PWM_RES) - 1);
  motorForward = forward;
  digitalWrite(IN1, forward ? HIGH : LOW);
  digitalWrite(IN2, forward ? LOW  : HIGH);
  ledcWrite(ENA, pwmValue);
  Serial.printf("Motor %s, speed: %d/255\n", forward ? "VORWÄRTS" : "RÜCKWÄRTS", pwmValue);
}

void stopMotor() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  ledcWrite(ENA, 0);
  pwmValue = 0;
  Serial.println("Motor STOP");
}


// ============================================================================
// TEMPERATUR (NTC)
// ============================================================================
const int adcPin1 = 34;
const int adcPin2 = 35;
const float Vcc = 3.3, Rf = 10000.0, R0 = 10000.0, T0_K = 298.15, beta = 3950.0;
float cachedTemp1 = NAN, cachedTemp2 = NAN;
unsigned long lastTempMillis = 0;

float readR_NTC(int pin) {
  float v = (analogRead(pin) / 4095.0f) * Vcc;
  if (v <= 0.0001f) return 1e9f;
  if (v >= Vcc - 0.0001f) return 1e-6f;
  return Rf * (v / (Vcc - v));
}
float ntcToCelsius(float R) { return 1.0f / ((1.0f / T0_K) + (1.0f / beta) * logf(R / R0)) - 273.15f; }

// ============================================================================
// ESP-NOW STRUKTUREN
// ============================================================================
typedef struct __attribute__((packed)) {
  char    cmd[12];
  int16_t idx;
  int16_t val;
  int16_t extra;
  char    payload[64];
} CmdMsg;

typedef struct __attribute__((packed)) {
  char    device[8];
  int16_t relays[8];
  float   sensors[5];
  float   temp;
  float   flow;
  int16_t pwm;
  int8_t  forward;
  int8_t  running;
  int8_t  relay_count;
  int8_t  sensor_count;
  uint8_t rs232_seq;
  char    last_rs232_res[64];
} StatusMsg;

uint8_t BROADCAST[6] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};

// ============================================================================
// STATUS SENDEN
// ============================================================================
void sendStatus() {
  StatusMsg msg;
  memset(&msg, 0, sizeof(msg));
  strlcpy(msg.device, "esp3", sizeof(msg.device));
  msg.relay_count  = RELAY_COUNT;
  msg.sensor_count = 2;
  for (int i = 0; i < RELAY_COUNT; i++)
    msg.relays[i] = physToLogical(digitalRead(RELAYS[i].pin), RELAYS[i].activeLow);
  msg.pwm     = (int16_t)pwmValue;
  msg.forward = motorForward ? 1 : 0;
  msg.running = 0;
  
  msg.sensors[0] = cachedTemp1;
  msg.sensors[1] = cachedTemp2;
  msg.temp = cachedTemp1; // Fallback for general temp field

  esp_now_send(BROADCAST, (uint8_t*)&msg, sizeof(msg));
}

// ============================================================================
// BEFEHLE EMPFANGEN
// ============================================================================
void onReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (len != sizeof(CmdMsg)) return;
  CmdMsg msg;
  memcpy(&msg, data, sizeof(msg));

  if (strcmp(msg.cmd, "RELAY") == 0) {
    int idx = msg.idx, val = msg.val;
    Serial.printf("[CMD] RELAY Received: idx=%d, val=%d\n", idx, val);
    if (idx >= 0 && idx < RELAY_COUNT) {
      digitalWrite(RELAYS[idx].pin, logicalToPhys(val, RELAYS[idx].activeLow));
      Serial.printf("Relay %d (%s) → %s\n", idx, RELAYS[idx].name, val ? "AN" : "AUS");
      sendStatus();
    }

  } else if (strcmp(msg.cmd, "TRAIN") == 0) {
    // val = PWM, extra = Richtung (1=vorwärts, 0=rückwärts)
    Serial.printf("[CMD] TRAIN Received: pwm=%d, dir=%d\n", msg.val, msg.extra);
    setMotor(msg.val, msg.extra != 0);
    sendStatus();

  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  // Relais — alle AUS
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAYS[i].pin, OUTPUT);
    digitalWrite(RELAYS[i].pin, logicalToPhys(0, RELAYS[i].activeLow));
  }

  // Motor-Pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);

  if (!ledcAttach(ENA, PWM_FREQ, PWM_RES)) {
    Serial.println("ledcAttach fehlgeschlagen!");
  }
  stopMotor();

  // ADC Setup
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);
  Serial.printf("ESP-NOW MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] Init fehlgeschlagen!");
    return;
  }
  esp_now_register_recv_cb(onReceive);

  // Broadcast-Peer
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BROADCAST, 6);
  peer.channel = 1;
  peer.encrypt = false;
  esp_now_add_peer(&peer);

  Serial.println("ESP3 bereit (ESP-NOW)");
}

// ============================================================================
// LOOP
// ============================================================================
void loop() {
  unsigned long now = millis();

  // Temperatur alle 1 Sekunde
  if (now - lastTempMillis >= 1000) {
    lastTempMillis = now;
    cachedTemp1 = ntcToCelsius(readR_NTC(adcPin1));
    cachedTemp2 = ntcToCelsius(readR_NTC(adcPin2));
    
    // Debug output periodically
    static unsigned long lastDebug = 0;
    if (now - lastDebug >= 5000) {
      lastDebug = now;
      Serial.printf("Temp1: %.2f C, Temp2: %.2f C\n", cachedTemp1, cachedTemp2);
    }
  }

  // Heartbeat alle 2 Sekunden
  static unsigned long lastHeartbeat = 0;
  if (now - lastHeartbeat >= 2000) {
    lastHeartbeat = now;
    sendStatus();
  }

  // Periodic Logging alle 1 Sekunde
  static unsigned long lastLog = 0;
  if (now - lastLog >= 1000) {
    lastLog = now;
    Serial.print("[LOG] Relais: ");
    for (int i=0; i<RELAY_COUNT; i++) Serial.print(physToLogical(digitalRead(RELAYS[i].pin), RELAYS[i].activeLow));
    Serial.printf(" | Temp1: %.2f C | Temp2: %.2f C | PWM: %d\n", cachedTemp1, cachedTemp2, pwmValue);
  }
}

