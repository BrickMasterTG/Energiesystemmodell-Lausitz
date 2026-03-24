
#include <FastLED.h>
#include <WiFi.h>
#include <esp_mac.h>
#include <esp_now.h>

// ==========================
// KONFIGURATION
// ==========================

#define PIN_0 23 // Elektro
#define PIN_1 22 // solar-dorf
#define PIN_2 21 // wind
#define PIN_3 19 // wärmepumpe
#define PIN_4 18 // kreis
#define PIN_5 5  // außen
#define PIN_6 4  // kohle
#define PIN_7 16 // gas

#define LEDS_0 216 // done
#define LEDS_1 174 // done
#define LEDS_2 30  // done
#define LEDS_3 133 // done
#define LEDS_4 366 // done
#define LEDS_5 134 // done
#define LEDS_6 250 // funktioniert nicht
#define LEDS_7 156 // done

#define BRIGHTNESS 30

CRGB leds0[LEDS_0];
CRGB leds1[LEDS_1];
CRGB leds2[LEDS_2];
CRGB leds3[LEDS_3];
CRGB leds4[LEDS_4];
CRGB leds5[LEDS_5];
CRGB leds6[LEDS_6];
CRGB leds7[LEDS_7];

struct StripPtr {
  CRGB *leds;
  int count;
};

StripPtr strips[8] = {{leds0, LEDS_0}, {leds1, LEDS_1}, {leds2, LEDS_2},
                      {leds3, LEDS_3}, {leds4, LEDS_4}, {leds5, LEDS_5},
                      {leds6, LEDS_6}, {leds7, LEDS_7}};

// ==========================
// STATE
// ==========================

struct Segment {
  bool active;
  int start;
  int end;
  CRGB color;
  bool rev;
};

// Max 4 segments per strip for now
Segment segments[8][4];

float phasePower = 0;

// ==========================
// ESP-NOW
// ==========================

typedef struct __attribute__((packed)) {
  char cmd[12];
  int16_t idx;
  int16_t val;
  int16_t extra;
  char payload[64];
} CmdMsg;

typedef struct __attribute__((packed)) {
  char device[8];
  int16_t relays[8];
  float sensors[5];
  float temp;
  float flow;
  int16_t pwm;
  int8_t forward;
  int8_t running;
  int8_t relay_count;
  int8_t sensor_count;
  uint8_t rs232_seq;
  char last_rs232_res[64];
} StatusMsg;

uint8_t HOST_MAC[6] = {0xFF, 0xFF, 0xFF,
                       0xFF, 0xFF, 0xFF}; // Broadcast by default

void sendStatus() {
  StatusMsg sm;
  memset(&sm, 0, sizeof(sm));
  strcpy(sm.device, "esp5");
  sm.relay_count = 0;
  sm.sensor_count = 0;
  sm.temp = NAN;

  esp_now_send(HOST_MAC, (uint8_t *)&sm, sizeof(sm));
}

void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(CmdMsg))
    return;

  CmdMsg msg;
  memcpy(&msg, data, sizeof(msg));

  if (strcmp(msg.cmd, "CLR") == 0) {
    for (int s = 0; s < 8; s++) {
      for (int seg = 0; seg < 4; seg++) {
        segments[s][seg].active = false;
      }
    }
    Serial.println("GLOBAL LED CLEAR");
    sendStatus();
    return;
  }

  if (strcmp(msg.cmd, "LED") == 0) {
    // Payload: strip|start|end|val|r|g|b
    int s = 0, start = 0, end = 0, val = 0, r = 0, g = 0, b = 0;
    sscanf(msg.payload, "%d|%d|%d|%d|%d|%d|%d", &s, &start, &end, &val, &r, &g,
           &b);

    if (s >= 0 && s < 8) {
      bool range_rev = (start > end);
      if (range_rev) {
        int tmp = start;
        start = end;
        end = tmp;
      }

      // Find empty slot or matching range
      int slot = -1;
      for (int i = 0; i < 4; i++) {
        if (segments[s][i].start == start && segments[s][i].end == end && segments[s][i].rev == range_rev) {
          slot = i;
          break;
        }
      }
      if (slot == -1) {
        for (int i = 0; i < 4; i++) {
          if (!segments[s][i].active) {
            slot = i;
            break;
          }
        }
      }

      if (slot != -1) {
        segments[s][slot].active = (val > 0);
        segments[s][slot].start = start;
        segments[s][slot].end = end;
        segments[s][slot].color = CRGB(r, g, b);
        segments[s][slot].rev = range_rev;
      }
    }
    // Acknowledgement via status update
    sendStatus();
  }
}

// ==========================
// RENDER
// ==========================

void updateStrips() {
  for (int s = 0; s < 8; s++) {
    fadeToBlackBy(strips[s].leds, strips[s].count, 40);

    for (int seg = 0; seg < 4; seg++) {
      if (!segments[s][seg].active)
        continue;

      int start = segments[s][seg].start;
      int end = segments[s][seg].end;
      CRGB color = segments[s][seg].color;

      for (int i = start; i < end && i < strips[s].count; i++) {
        float wave =
            sin((i * 0.20) + (segments[s][seg].rev ? -phasePower : phasePower));
        int brightness = max(0, int(wave * 200));

        CRGB finalColor = color;
        finalColor.nscale8_video(brightness);

        strips[s].leds[i] += finalColor;
      }
    }
  }
}

// ==========================
// SETUP
// ==========================

void setup() {
  Serial.begin(115200);
  delay(500); // Give serial monitor time
  Serial.println("\n--- ESP5 LED Controller Start ---");

  // WiFi & MAC
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);
  Serial.printf("ESP-NOW MAC: %02X:%02X:%02X:%02X:%02X:%02X\n", mac[0], mac[1],
                mac[2], mac[3], mac[4], mac[5]);

  // ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  esp_now_register_recv_cb(onReceive);

  // Peer Registration (Broadcast)
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, HOST_MAC, 6);
  peer.channel = 1; // Standard channel
  peer.encrypt = false;
  esp_now_add_peer(&peer);

  // FastLED Setup
  FastLED.addLeds<WS2812B, PIN_0, GRB>(leds0, LEDS_0);
  FastLED.addLeds<WS2812B, PIN_1, GRB>(leds1, LEDS_1);
  FastLED.addLeds<WS2812B, PIN_2, GRB>(leds2, LEDS_2);
  FastLED.addLeds<WS2812B, PIN_3, GRB>(leds3, LEDS_3);
  FastLED.addLeds<WS2812B, PIN_4, GRB>(leds4, LEDS_4);
  FastLED.addLeds<WS2812B, PIN_5, GRB>(leds5, LEDS_5);
  FastLED.addLeds<WS2812B, PIN_6, GRB>(leds6, LEDS_6);
  FastLED.addLeds<WS2812B, PIN_7, GRB>(leds7, LEDS_7);
  FastLED.setBrightness(BRIGHTNESS);

  // Clear segments
  for (int s = 0; s < 8; s++) {
    for (int seg = 0; seg < 4; seg++) {
      segments[s][seg].active = false;
    }
  }

  Serial.println("ESP5 setup complete");
}

void loop() {
  updateStrips();
  phasePower += 0.18;
  FastLED.show();
  delay(20);

  // Heartbeat status to host every 2 seconds
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 2000) {
    lastStatus = millis();
    sendStatus();
  }
}
