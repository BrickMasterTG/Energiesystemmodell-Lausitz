/*
 * ESP4 — 5x Relay + 5x Stromsensor (4-20mA) + Flowmeter
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
const uint8_t RELAY_COUNT = 6;
RelayConfig RELAYS[RELAY_COUNT] = {
  {18, "Elektrolyseur", true}, // High-Trigger
  {19, "Außen Relay",   true},
  {21, "Mitte Relay",   true},
  {22, "Innen Relay",   true},
  {23, "Lüfter",        true},
  {5, "Elektrolyseur-Pumpe", true},
};

inline int logicalToPhys(int v, bool al) { return al ? (v ? LOW : HIGH) : (v ? HIGH : LOW); }
inline int physToLogical(int v, bool al) { return al ? (v == LOW ? 1 : 0) : (v == HIGH ? 1 : 0); }

void applySafeDefaults() {
  for (int i = 0; i < RELAY_COUNT; i++)
    digitalWrite(RELAYS[i].pin, logicalToPhys(0, RELAYS[i].activeLow));
}

// ============================================================================
// SENSOREN (4–20mA, Shunt 165Ω)
// ============================================================================
const int   SENSOR_PINS[5]  = {36, 39, 34, 35, 32};
const float SHUNT_RESISTOR  = 165.0f;
float currentValues[5]      = {0};

void readSensors() {
  for (int i = 0; i < 5; i++) {
    float voltage    = (analogRead(SENSOR_PINS[i]) / 4095.0f) * 3.3f;
    currentValues[i] = (voltage / SHUNT_RESISTOR) * 1000.0f; // mA
  }
}

// ============================================================================
// FLOWMETER
// ============================================================================
#define FLOW_PIN 17
float    K_FACTOR         = 1.0f; // Pulse pro Liter
volatile uint32_t pulseCount = 0;
float    flow_L_per_min   = 0.0f;
unsigned long lastFlowMillis = 0;

void IRAM_ATTR onPulse() { pulseCount++; }

void updateFlow() {
  unsigned long now = millis();
  if (now - lastFlowMillis >= 1000) {
    uint32_t dur = now - lastFlowMillis;
    lastFlowMillis = now;
    noInterrupts();
    uint32_t p = pulseCount;
    pulseCount  = 0;
    interrupts();
    flow_L_per_min = (p / (dur / 1000.0f) * 60.0f) / K_FACTOR;
  }
}

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
  strlcpy(msg.device, "esp4", sizeof(msg.device));
  msg.relay_count  = RELAY_COUNT;
  msg.sensor_count = 5;
  for (int i = 0; i < RELAY_COUNT; i++)
    msg.relays[i] = physToLogical(digitalRead(RELAYS[i].pin), RELAYS[i].activeLow);
  for (int i = 0; i < 5; i++)
    msg.sensors[i] = currentValues[i];
  msg.flow = flow_L_per_min;
  msg.temp = NAN;

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
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Flowmeter
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onPulse, FALLING);
  lastFlowMillis = millis();

  // Relais — sichere Defaults sofort setzen
  for (int i = 0; i < RELAY_COUNT; i++)
    pinMode(RELAYS[i].pin, OUTPUT);
  applySafeDefaults();

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

  Serial.println("ESP4 bereit (ESP-NOW)");
}

// ============================================================================
// LOOP
// ============================================================================
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat  = 0;

void loop() {
  unsigned long now = millis();

  // Sensoren alle 200ms
  if (now - lastSensorRead >= 200) {
    lastSensorRead = now;
    readSensors();
    updateFlow();
  }

  // Heartbeat/Log alle 1 Sekunde (Logging angepasst)
  static unsigned long lastLog = 0;
  if (now - lastLog >= 1000) {
    lastLog = now;
    Serial.print("[LOG] Relais: ");
    for (int i=0; i<RELAY_COUNT; i++) Serial.print(physToLogical(digitalRead(RELAYS[i].pin), RELAYS[i].activeLow));
    Serial.printf(" | Flow: %.1f L/min | I0: %.1f mA | I4: %.1f mA\n", flow_L_per_min, currentValues[0], currentValues[4]);
  }

  if (now - lastHeartbeat >= 2000) {
    lastHeartbeat = now;
    sendStatus();
  }
}
