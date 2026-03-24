/*
 * ESP_Host — ESP-NOW Gateway + WiFi AP für Raspberry Pi
 *
 * Kommunikation:
 *   - Raspberry Pi  →  HTTP (WiFi AP, unverändert)
 *   - ESP1–ESP4    →  ESP-NOW (direkt, kein TCP/IP)
 *
 * SETUP (einmalig):
 *   1. Flashe jeden ESP1–4 und lese im Serial Monitor die Zeile:
 *      "ESP-NOW MAC: AA:BB:CC:DD:EE:FF"
 *   2. Trage die MACs unten in MAC_ESP1 bis MAC_ESP4 ein.
 *   3. Flashe diesen Host-Code.
 */

#include "secrets.h" // WiFi credentials — NOT in git, see secrets.h.example
#include <WebServer.h>
#include <WiFi.h>
#include <esp_now.h>


// ============================================================================
// MAC-ADRESSEN DER CLIENTS — hier eintragen nach erstem Flashen!
// ============================================================================
uint8_t MAC_ESP1[6] = {0x84, 0x1F, 0xE8, 0x26, 0x58, 0xD8};
uint8_t MAC_ESP2[6] = {0x20, 0x43, 0xA8, 0x6A, 0xFB, 0xDC};
uint8_t MAC_ESP3[6] = {0x20, 0xE7, 0xC8, 0x6B, 0x4F, 0x18};
uint8_t MAC_ESP4[6] = {0x8C, 0x4F, 0x00, 0x2E, 0x59, 0xE8};
uint8_t MAC_ESP5[6] = {0x20, 0xE7, 0xC8, 0x6B, 0x5D, 0x28};
// ============================================================================
// WIFI AP
// ============================================================================
// AP_SSID and AP_PASSWORD are defined in secrets.h (gitignored)
const int AP_CHANNEL = 1; // ESP-NOW + AP müssen denselben Kanal nutzen!

WebServer server(80);

// ============================================================================
// ESP-NOW NACHRICHTENSTRUKTUREN
// ============================================================================

// Host → Client: Befehl
typedef struct __attribute__((packed)) {
  char cmd[12]; // "RELAY", "TRAIN", "WIND", "RS232"
  int16_t idx;
  int16_t val;
  int16_t extra;    // z.B. Richtung für Motor
  char payload[64]; // Neu für RS232-Kommandos
} CmdMsg;

// Client → Host: Status-Antwort
typedef struct __attribute__((packed)) {
  char device[8];          // "esp1", "esp2", usw.
  int16_t relays[8];       // Relay-Zustände (bis zu 8)
  float sensors[5];        // Sensor-Rohwerte (mA)
  float temp;              // Temperatur (NAN wenn nicht vorhanden)
  float flow;              // Durchfluss (nur ESP4)
  int16_t pwm;             // Motor-PWM (nur ESP3)
  int8_t forward;          // Motor-Richtung (nur ESP3)
  int8_t running;          // Wind-Status (nur ESP3)
  int8_t relay_count;      // Anzahl verfügbarer Relais
  int8_t sensor_count;     // Anzahl gültiger Sensoren
  uint8_t rs232_seq;       // Sequenznummer für RS232-Antworten
  char last_rs232_res[64]; // Letzte RS232-Antwort
} StatusMsg;

// Gespeicherter Zustand pro Client
struct ClientState {
  bool online;
  unsigned long lastSeen;
  StatusMsg status;
  // Pending acknowledgment
  volatile bool ackPending;      // true = warte auf Quittung
  volatile bool ackReceived;     // true = Quittung eingetroffen
  volatile int ackRelayIdx;      // erwarteter Relay-Index
  volatile int ackRelayVal;      // erwarteter Wert
  volatile uint8_t rs232WaitSeq; // Sequenznummer auf die wir warten
};

ClientState clientStates[5]; // Index: 0=esp1, 1=esp2, 2=esp3, 3=esp4, 4=esp5

// Hilfsfunktion: Index eines Clients anhand des Namens
int clientIndex(const char *name) {
  if (strcmp(name, "esp1") == 0)
    return 0;
  if (strcmp(name, "esp2") == 0)
    return 1;
  if (strcmp(name, "esp3") == 0)
    return 2;
  if (strcmp(name, "esp4") == 0)
    return 3;
  if (strcmp(name, "esp5") == 0)
    return 4;
  return -1;
}

uint8_t *clientMAC(int idx) {
  switch (idx) {
  case 0:
    return MAC_ESP1;
  case 1:
    return MAC_ESP2;
  case 2:
    return MAC_ESP3;
  case 3:
    return MAC_ESP4;
  case 4:
    return MAC_ESP5;
  default:
    return nullptr;
  }
}

// Eindeutiger Bezeichner pro Client
const char *CLIENT_NAMES[5] = {"esp1", "esp2", "esp3", "esp4", "esp5"};

// ============================================================================
// ESP-NOW CALLBACKS
// ============================================================================

void onSendCallback(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  // Optional: Fehlerlogging wenn Paket nicht ankam
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[ESP-NOW] Send FAILED to %02X:%02X:%02X:%02X:%02X:%02X\n",
                  info->des_addr[0], info->des_addr[1], info->des_addr[2],
                  info->des_addr[3], info->des_addr[4], info->des_addr[5]);
  }
}

void onReceiveCallback(const esp_now_recv_info_t *info, const uint8_t *data,
                       int len) {
  if (len != sizeof(StatusMsg))
    return;

  StatusMsg msg;
  memcpy(&msg, data, sizeof(msg));

  int idx = clientIndex(msg.device);
  if (idx < 0) {
    Serial.printf("[ESP-NOW] Unbekannter Client: %s\n", msg.device);
    return;
  }

  clientStates[idx].online = true;
  clientStates[idx].lastSeen = millis();
  memcpy(&clientStates[idx].status, &msg, sizeof(msg));

  if (clientStates[idx].ackPending) {
    if (clientStates[idx].ackRelayIdx >= 0) {
      // Relay ACK
      int ri = clientStates[idx].ackRelayIdx;
      int rv = clientStates[idx].ackRelayVal;
      if (ri < msg.relay_count && msg.relays[ri] == rv) {
        clientStates[idx].ackReceived = true;
      }
    } else if (clientStates[idx].ackRelayIdx == -1) {
      // RS232 ACK: Warte auf neue Sequenznummer
      if (msg.rs232_seq != clientStates[idx].rs232WaitSeq) {
        clientStates[idx].ackReceived = true;
      }
    }
  }
}

// ============================================================================
// ESP-NOW SENDEN
// ============================================================================

bool sendCmd(const char *target, const char *cmd, int idx, int val,
             int extra = 0, const char *payload = "") {
  int ci = clientIndex(target);
  if (ci < 0) {
    Serial.printf("[CMD] Unbekanntes Ziel: %s\n", target);
    return false;
  }
  uint8_t *mac = clientMAC(ci);

  CmdMsg msg;
  memset(&msg, 0, sizeof(msg));
  strlcpy(msg.cmd, cmd, sizeof(msg.cmd));
  msg.idx = (int16_t)idx;
  msg.val = (int16_t)val;
  msg.extra = (int16_t)extra;
  strlcpy(msg.payload, payload, sizeof(msg.payload));

  esp_err_t result = esp_now_send(mac, (uint8_t *)&msg, sizeof(msg));
  if (result != ESP_OK) {
    Serial.printf("[CMD] esp_now_send Fehler: %d\n", result);
    return false;
  }
  return true;
}

// ============================================================================
// SZENARIEN
// ============================================================================

void scenario_kohlekraftwerk(int state) {
  if (state == 0) {
    Serial.println("[Scenario] Kohlekraftwerk AUS");
    sendCmd("esp1", "RELAY", 0, 0);
    sendCmd("esp1", "RELAY", 1, 0);
    sendCmd("esp1", "RELAY", 4, 0);
    sendCmd("esp2", "RELAY", 0, 0);
  } else {
    Serial.println("[Scenario] Kohlekraftwerk EIN");
    sendCmd("esp1", "RELAY", 0, 1);
    sendCmd("esp1", "RELAY", 1, 1);
    sendCmd("esp1", "RELAY", 4, 1);
    sendCmd("esp2", "RELAY", 0, 1);
    delay(5000);
    sendCmd("esp1", "RELAY", 1, 0);
  }
}

void scenario_alles(int state) {
  int v = (state == 1) ? 1 : 0;
  for (int i = 0; i < 8; i++)
    sendCmd("esp1", "RELAY", i, v);
  for (int i = 0; i < 4; i++)
    sendCmd("esp2", "RELAY", i, v);
}

// ============================================================================
// HTTP SERVER HANDLER
// ============================================================================

// GET /clients — Verbindungsstatus aller Clients
void handleClients() {
  unsigned long now = millis();
  String json = "{\"clients\":[";
  int first = true;
  for (int i = 0; i < 5; i++) {
    // Client als offline markieren wenn > 10s kein Heartbeat
    if (clientStates[i].online && (now - clientStates[i].lastSeen > 10000)) {
      clientStates[i].online = false;
    }
    if (!first)
      json += ",";
    json += "{\"name\":\"" + String(CLIENT_NAMES[i]) + "\",";
    json +=
        "\"online\":" + String(clientStates[i].online ? "true" : "false") + ",";
    json += "\"lastSeen\":" + String(clientStates[i].lastSeen) + "}";
    first = false;
  }
  json += "]}";
  server.send(200, "application/json", json);
}

// POST /forward — Relay/Motor-Befehl weiterleiten
void handleForward() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No body\"}");
    return;
  }
  String body = server.arg("plain");

  // Einfacher JSON-Parser für:
  // {"target":"espX","method":"GET","path":"/set?idx=0&val=1"}
  auto extractStr = [&](const String &key) -> String {
    String search = "\"" + key + "\":\"";
    int pos = body.indexOf(search);
    if (pos < 0)
      return "";
    int start = pos + search.length();
    int end = body.indexOf("\"", start);
    return (end > start) ? body.substring(start, end) : "";
  };

  String target = extractStr("target");
  String path = extractStr("path");

  if (target.length() == 0 || path.length() == 0) {
    server.send(400, "application/json",
                "{\"error\":\"Missing target or path\"}");
    return;
  }

  // Befehle aus dem Pfad extrahieren
  // Unterstützt: /set?idx=X&val=Y  /train?pwm=X&dir=Y  /set?val=X (wind)
  bool success = false;

  if (path.startsWith("/set?idx=")) {
    // Relay: /set?idx=X&val=Y
    int idxPos = path.indexOf("idx=") + 4;
    int valPos = path.indexOf("val=") + 4;
    int idx = path.substring(idxPos).toInt();
    int val = path.substring(valPos).toInt();
    success = sendCmd(target.c_str(), "RELAY", idx, val);

  } else if (path.startsWith("/train?")) {
    // Motor (ESP3): /train?pwm=X&dir=Y
    int pwmPos = path.indexOf("pwm=") + 4;
    int dirPos = path.indexOf("dir=") + 4;
    int pwm = path.substring(pwmPos).toInt();
    int dir = (dirPos > 4) ? path.substring(dirPos).toInt() : 1;
    success = sendCmd(target.c_str(), "TRAIN", 0, pwm, dir);

  } else if (path.startsWith("/set?val=")) {
    // Wind (ESP3): /set?val=X
    int valPos = path.indexOf("val=") + 4;
    int val = path.substring(valPos).toInt();
    success = sendCmd(target.c_str(), "WIND", 0, val);

  } else if (path.startsWith("/send")) {
    // RS232-Befehl: Extrahiere cmd und timeout aus dem Pfad
    // (/send?cmd=CMD&timeout=MS)
    int cmdPos = path.indexOf("cmd=") + 4;
    int timeoutPos = path.indexOf("timeout=") + 8;
    String cmd = "";
    int timeoutMs = 500;

    if (cmdPos >= 4) {
      int nextAmp = path.indexOf('&', cmdPos);
      cmd = (nextAmp > 0) ? path.substring(cmdPos, nextAmp)
                          : path.substring(cmdPos);
    }
    if (timeoutPos >= 8) {
      int nextAmp = path.indexOf('&', timeoutPos);
      String tStr = (nextAmp > 0) ? path.substring(timeoutPos, nextAmp)
                                  : path.substring(timeoutPos);
      timeoutMs = tStr.toInt();
    }

    if (cmd.length() == 0) {
      server.send(400, "application/json",
                  "{\"error\":\"Missing cmd in path\"}");
      return;
    }

    Serial.printf("[RS232] Forwarding to ESP1: cmd=%s, timeout=%d\n",
                  cmd.c_str(), timeoutMs);
    int ci = clientIndex(target.c_str());
    clientStates[ci].ackRelayIdx = -1; // Kennung für RS232-Wait
    success = sendCmd(target.c_str(), "RS232", 0, timeoutMs, 0, cmd.c_str());

  } else if (path.startsWith("/led?")) {
    // LED: /led?strip=S&start=A&end=B&val=V&r=R&g=G&b=B
    // Forward as raw payload "S|A|B|V|R|G|B"
    int stripPos = path.indexOf("strip=") + 6;
    int startPos = path.indexOf("start=") + 6;
    int endPos = path.indexOf("end=") + 4;
    int valPos = path.indexOf("val=") + 4;
    int rPos = path.indexOf("r=") + 2;
    int gPos = path.indexOf("g=") + 2;
    int bPos = path.indexOf("b=") + 2;

    String payload = "";
    auto getPart = [&](int pos) {
      if (pos < 2)
        return String("0");
      int nextAmp = path.indexOf('&', pos);
      return (nextAmp > 0) ? path.substring(pos, nextAmp) : path.substring(pos);
    };

    payload = getPart(stripPos) + "|" + getPart(startPos) + "|" +
              getPart(endPos) + "|" + getPart(valPos) + "|" + getPart(rPos) +
              "|" + getPart(gPos) + "|" + getPart(bPos);

    Serial.printf("[LED] Forwarding to %s: %s\n", target.c_str(),
                  payload.c_str());
    success = sendCmd(target.c_str(), "LED", 0, 0, 0, payload.c_str());

  } else if (path.startsWith("/clear")) {
    // Global LED clear command for ESP5
    Serial.println("[LED] Sending GLOBAL CLEAR to ESP5");
    success = sendCmd("esp5", "CLR", 0, 0);

  } else {
    server.send(400, "application/json", "{\"error\":\"Unknown path\"}");
    return;
  }

  if (!success) {
    server.send(502, "application/json",
                "{\"code\":-1,\"body\":{\"error\":\"ESP-NOW send failed\"}}");
    return;
  }

  // -----------------------------------------------------------------------
  // RELAY-Befehle: Warte auf Quittung vom Ziel-ESP (max. 1500 ms)
  // -----------------------------------------------------------------------
  bool isRelayCmd = path.startsWith("/set?idx=");
  if (isRelayCmd) {
    int idxPos = path.indexOf("idx=") + 4;
    int valPos = path.indexOf("val=") + 4;
    int relayIdx = path.substring(idxPos).toInt();
    int relayVal = path.substring(valPos).toInt();
    int ci = clientIndex(target.c_str());

    clientStates[ci].ackRelayIdx = relayIdx;
    clientStates[ci].ackRelayVal = relayVal;
    clientStates[ci].ackReceived = false;
    clientStates[ci].ackPending = true;

    const unsigned long TIMEOUT_MS = 1500;
    unsigned long start = millis();
    while (!clientStates[ci].ackReceived && (millis() - start) < TIMEOUT_MS) {
      server.handleClient(); // HTTP-Loop am Laufen halten
      delay(10);
    }

    clientStates[ci].ackPending = false;

    if (clientStates[ci].ackReceived) {
      server.send(200, "application/json", "{\"code\":200,\"body\":\"ok\"}");
    } else {
      Serial.printf("[CMD] Quittung von %s ausgeblieben (Relay %d → %d)\n",
                    target.c_str(), relayIdx, relayVal);
      server.send(504, "application/json",
                  "{\"code\":504,\"body\":{\"error\":\"No ACK from ESP\"}}");
    }
  } else if (path.startsWith("/send")) {
    // RS232-Befehl: Warte auf Antwort
    int ci = clientIndex(target.c_str());
    clientStates[ci].ackRelayIdx = -1;
    clientStates[ci].rs232WaitSeq =
        clientStates[ci].status.rs232_seq; // Alte Seq merken
    clientStates[ci].ackReceived = false;
    clientStates[ci].ackPending = true;

    unsigned long start = millis();
    while (!clientStates[ci].ackReceived && (millis() - start) < 3000) {
      server.handleClient();
      delay(10);
    }
    clientStates[ci].ackPending = false;

    if (clientStates[ci].ackReceived) {
      String res = String(clientStates[ci].status.last_rs232_res);
      if (res.length() == 0)
        res = "(leere Antwort)";
      server.send(200, "application/json",
                  "{\"code\":200,\"body\":\"" + res + "\"}");
    } else {
      server.send(504, "application/json",
                  "{\"code\":504,\"body\":{\"error\":\"RS232 Timeout\"}}");
    }
  } else {
    // Motor/Wind-Befehle: kein Ack-Wait nötig
    server.send(200, "application/json", "{\"code\":200,\"body\":\"ok\"}");
  }
}

// GET /state/<device> — Letzten bekannten Zustand abrufen
void handleDeviceState() {
  String uri = server.uri(); // z.B. /state/esp1
  String device = uri.substring(uri.lastIndexOf('/') + 1);
  int idx = clientIndex(device.c_str());

  if (idx < 0) {
    server.send(404, "application/json", "{\"error\":\"Unknown device\"}");
    return;
  }

  ClientState &cs = clientStates[idx];
  StatusMsg &s = cs.status;

  String json = "{";

  if (device == "esp1") {
    for (int i = 0; i < s.relay_count; i++) {
      json += "\"r" + String(i) + "\":" + String(s.relays[i]);
      json += ",";
    }
    json += "\"temp\":" + (isnan(s.temp) ? String("null") : String(s.temp, 2));

  } else if (device == "esp2") {
    for (int i = 0; i < s.relay_count; i++) {
      json += "\"r" + String(i) + "\":" + String(s.relays[i]);
      json += ",";
    }
    json += "\"temp\":" + (isnan(s.temp) ? String("null") : String(s.temp, 2));

  } else if (device == "esp3") {
    json += "\"running\":" + String(s.running ? "true" : "false") + ",";
    json += "\"pwm\":" + String(s.pwm) + ",";
    json += "\"forward\":" + String(s.forward ? "true" : "false") + ",";
    json += "\"temp\":" + (isnan(s.temp) ? String("null") : String(s.temp, 2)) +
            ",";
    json += "\"sensors\":[";
    for (int i = 0; i < s.sensor_count; i++) {
      json += String(s.sensors[i], 2);
      if (i < s.sensor_count - 1)
        json += ",";
    }
    json += "],\"relays\":[";
    for (int i = 0; i < s.relay_count; i++) {
      json += String(s.relays[i]);
      if (i < s.relay_count - 1)
        json += ",";
    }
    json += "]";

  } else if (device == "esp4") {
    json += "\"sensors\":[";
    for (int i = 0; i < s.sensor_count; i++) {
      json += "{\"current\":" + String(s.sensors[i], 2) + ",\"pressure\":0.00}";
      if (i < s.sensor_count - 1)
        json += ",";
    }
    json += "],\"relays\":[";
    for (int i = 0; i < s.relay_count; i++) {
      json += String(s.relays[i]);
      if (i < s.relay_count - 1)
        json += ",";
    }
    json += "],\"flow\":" + String(s.flow, 1);
  }

  json += "}";

  // app.py erwartet {code:200, body:{...}}
  server.send(200, "application/json",
              "{\"code\":200,\"body\":" + json +
                  ",\"offline\":" + String(cs.online ? "false" : "true") + "}");
}

// GET /scenario?name=X&state=Y
void handleScenario() {
  if (!server.hasArg("name") || !server.hasArg("state")) {
    server.send(400, "application/json", "{\"error\":\"Missing parameters\"}");
    return;
  }
  String name = server.arg("name");
  int state = server.arg("state").toInt();

  if (name == "kohlekraftwerk") {
    scenario_kohlekraftwerk(state);
  } else if (name == "alles") {
    scenario_alles(state);
  } else {
    server.send(404, "application/json", "{\"error\":\"Unknown scenario\"}");
    return;
  }
  server.send(200, "application/json",
              "{\"success\":true,\"scenario\":\"" + name +
                  "\",\"state\":" + String(state) + "}");
}

void handleRoot() {
  String html = "<html><body><h1>ESP-Host</h1>";
  html +=
      "<p>AP: " + String(AP_SSID) + " | Kanal: " + String(AP_CHANNEL) + "</p>";
  html += "<h2>Client Status:</h2><ul>";
  for (int i = 0; i < 5; i++) {
    html += "<li>" + String(CLIENT_NAMES[i]) + ": ";
    html += clientStates[i].online ? "ONLINE" : "OFFLINE";
    if (clientStates[i].online) {
      unsigned long age = (millis() - clientStates[i].lastSeen) / 1000;
      html += " (vor " + String(age) + "s)";
    }
    html += "</li>";
  }
  html += "</ul></body></html>";
  server.send(200, "text/html", html);
}

// ============================================================================
// SETUP
// ============================================================================

void registerPeer(uint8_t *mac) {
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = AP_CHANNEL;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.printf("[ESP-NOW] Peer hinzufügen fehlgeschlagen: "
                  "%02X:%02X:%02X:%02X:%02X:%02X\n",
                  mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP-Host startet ===");

  // Clients initialisieren
  for (int i = 0; i < 5; i++) {
    memset(&clientStates[i], 0, sizeof(ClientState));
    clientStates[i].status.temp = NAN;
  }

  // WiFi: AP+STA Modus — AP für Pi, STA-Modus nötig für ESP-NOW
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASSWORD, AP_CHANNEL, 0, 4);
  WiFi.setSleep(false);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());

  // ESP-NOW initialisieren
  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] FEHLER: Initialisierung fehlgeschlagen!");
    return;
  }
  esp_now_register_send_cb(onSendCallback);
  esp_now_register_recv_cb(onReceiveCallback);

  // Peers registrieren
  registerPeer(MAC_ESP1);
  registerPeer(MAC_ESP2);
  registerPeer(MAC_ESP3);
  registerPeer(MAC_ESP4);
  registerPeer(MAC_ESP5);
  Serial.println("[ESP-NOW] Peers registriert");

  // HTTP Server (für Raspberry Pi — unveränderte API)
  server.on("/", HTTP_GET, handleRoot);
  server.on("/clients", HTTP_GET, handleClients);
  server.on("/forward", HTTP_POST, handleForward);
  server.on("/scenario", HTTP_GET, handleScenario);
  // Direkter State-Abruf (optional, zusätzlich zu /forward)
  server.on("/state/esp1", HTTP_GET, handleDeviceState);
  server.on("/state/esp2", HTTP_GET, handleDeviceState);
  server.on("/state/esp3", HTTP_GET, handleDeviceState);
  server.on("/state/esp4", HTTP_GET, handleDeviceState);
  server.on("/state/esp5", HTTP_GET, handleDeviceState);
  server.begin();

  Serial.println("=== ESP-Host bereit ===\n");
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {
  server.handleClient();

  // Timeout-Check: Client als offline markieren wenn > 10s kein Heartbeat
  unsigned long now = millis();
  for (int i = 0; i < 5; i++) {
    if (clientStates[i].online && (now - clientStates[i].lastSeen > 10000)) {
      clientStates[i].online = false;
      Serial.printf("[TIMEOUT] %s offline\n", CLIENT_NAMES[i]);
    }
  }
}