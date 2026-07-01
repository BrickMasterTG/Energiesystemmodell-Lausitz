# Energiesystemmodell Lausitz

An interactive, distributed control system for modeling and operating an energy system in the Lausitz region. The system enables real-time control of relays, sensors, motors, and actuators across multiple ESP32 microcontrollers through a Flask-based web interface.

---

## Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Features](#features)
- [Hardware Components](#hardware-components)
- [Software Stack](#software-stack)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [API Overview](#api-overview)
- [Project Structure](#project-structure)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Project Overview

The Energiesystemmodell Lausitz is a physical scale model of an energy system designed for educational and demonstration purposes. It simulates multiple energy sources and components — including a coal power plant, gas plant, electrolyzer, wind turbine, and model railway — all of which can be controlled and monitored in real time via a web-based dashboard.

The system consists of:
- **Multiple ESP32 client devices** that directly control relays, read sensors, and drive actuators
- **One ESP32 Host device** that acts as a central wireless gateway, receiving commands from the web server and forwarding them to the appropriate client via ESP-NOW
- **A Flask web server** (running on a Raspberry Pi or laptop) that exposes a REST API and serves the web UI

Users interact with the system through two frontend interfaces:
- A **landing page** with thematic system cards, scenario buttons, and live sensor values
- A **technical dashboard** for direct relay control, RS232 communication, and device diagnostics

---

## System Architecture

```
┌────────────────────────┐
│   Browser / User       │
│   (Landing / Dashboard)│
└──────────┬─────────────┘
           │ HTTP
┌──────────▼─────────────┐
│   Flask Server         │
│   (Raspberry Pi/Laptop)│
│   app.py + routes/     │
└──────────┬─────────────┘
           │ HTTP (WiFi AP)
┌──────────▼─────────────┐
│   ESP Host             │
│   (WiFi Access Point + │
│    ESP-NOW Gateway)    │
└──┬──────┬──────┬───┬───┘
   │      │      │   │
   │   ESP-NOW   │   │
┌──▼─┐ ┌──▼─┐ ┌─▼─┐ ┌▼──┐ ┌─▼─┐
│ESP1│ │ESP2│ │ESP3│ │ESP4│ │ESP5│
│8x  │ │4x  │ │4x  │ │5x  │ │7x  │
│Relay│ │Relay│ │Relay│ │Relay│ │Strip│
│NTC │ │NTC │ │Motor│ │5x  │ │    │
│RS232│ │    │ │Wind │ │Sensor│ │    │
└────┘ └────┘ └────┘ └────┘ └────┘
```

### Communication Flow

1. The **Flask server** receives HTTP requests from the browser.
2. It forwards commands to the **ESP Host** via HTTP (the Host runs a WebServer over its WiFi AP).
3. The **ESP Host** relays commands to the appropriate **ESP client** using **ESP-NOW** (a connectionless, peer-to-peer protocol that does not require a full TCP/IP stack).
4. Client ESPs send back **status messages** (heartbeats every 2 seconds + immediate ACKs on relay changes) to the Host via ESP-NOW broadcast.
5. The Host caches device states and serves them to the Flask server on demand.

### Why ESP-NOW?

ESP-NOW allows direct peer-to-peer communication between ESP32 devices without requiring a traditional WiFi connection on the client side. This reduces latency, eliminates the need for TCP/IP stack management on clients, and makes the system more robust against network instability.

---

## Features

- **Real-time relay control** — Toggle individual relays on any client ESP via the web UI
- **Scenario execution** — Execute multi-step action sequences (with delays) defined in `scenarios.json`
- **Sensor monitoring** — Live readings from 4–20 mA current-loop sensors calibrated to bar/cm values
- **Temperature monitoring** — NTC thermistor readings from ESP1 and ESP2
- **Flow measurement** — Pulse-counting flow meter on ESP4 (L/min)
- **Motor PWM control** — Variable-speed and direction control of a DC motor on ESP3
- **Wind pin control** — Digital on/off control of a wind output on ESP3
- **RS232 communication** — Send raw serial commands to an MFC (Mass Flow Controller) via ESP1
- **LED flow visualization** — Physical LED strips on ESP5 dynamically mirror website energy flows
- **ACK-based relay confirmation** — The Host waits up to 1500 ms for a relay state acknowledgment from the client before confirming success
- **Device online/offline tracking** — Automatic offline detection after 10 seconds without heartbeat
- **Two UI modes** — Thematic landing page for operators; technical dashboard for developers/engineers
- **Selective polling** — Frontend only polls devices that have previously been seen online, reducing unnecessary requests

---

## Hardware Components

### ESP32 Devices

| Device   | Role                     | Relays | Special Functions              |
|----------|--------------------------|--------|-------------------------------|
| ESP Host | Central gateway / HTTP server | —  | WiFi AP, ESP-NOW hub           |
| ESP1     | Gas plant controller     | 8      | NTC temperature, RS232 (MFC)  |
| ESP2     | Coal plant controller    | 4      | NTC temperature               |
| ESP3     | Wind / Train controller  | 4      | DC motor (L298N), wind pin    |
| ESP4     | Electrolyzer controller  | 6      | 5× 4–20 mA sensors, flow meter |
| ESP5     | LED Strip controller     | —      | 7× WS2812B strips for flows    |

### Relays

- **ESP1:** Ventil-1, Ventil-2, Heizstab, Zünder, Gasventil, Kühler, MFC, (Unbelegt)
- **ESP2:** Kühler-Kohle, Ventil Turbine, Ventil-Kohle, Heizstab-Kohle
- **ESP3:** Relais 2–5 (general purpose)
- **ESP4:** Elektrolyseur (High-Trigger), Tank füllen, Tank leeren, Durchschalten, Lüfter, Elekrolyseur-Pumpe

### Sensors & Actuators

| Component         | Device | Interface     | Notes                                      |
|-------------------|--------|---------------|--------------------------------------------|
| NTC Thermistors   | ESP1, ESP2 | ADC (GPIO34) | β=3950, R₀=10kΩ, voltage divider with 10kΩ |
| 4–20 mA Sensors   | ESP4   | ADC (5× pins) | 165Ω shunt resistor, calibrated per sensor |
| Pressure Sensors  | ESP4   | 4–20 mA      | Sensors 0–2: pressure (bar)                |
| Ultrasonic Sensors| ESP4   | 4–20 mA      | Sensors 3–4: distance (cm)                 |
| Flow Meter        | ESP4   | GPIO17 (interrupt) | Pulse-counting, NPN output, FALLING edge |
| DC Motor          | ESP3   | L298N (PWM)  | ENA=GPIO32, IN1=GPIO25, IN2=GPIO26        |
| Wind Output       | ESP3   | GPIO27        | Digital on/off                             |
| RS232 / MFC       | ESP1   | UART2 (38400 baud) | RX=GPIO16, TX=GPIO17                  |
| Standalone Pressure Sensors | External | ADC (GPIO 33–35) | 3× sensors, shared zero point |

---

## Software Stack

### Backend
- **Python 3** with **Flask 3.0**
- **Requests 2.31** for HTTP communication with the ESP Host
- Blueprint-based modular routing (`routes/relays.py`, `routes/scenarios.py`, `routes/leds.py`, `routes/esp3.py`, `routes/debug.py`)

### Frontend
- Vanilla **HTML5 / CSS3 / JavaScript** (no framework dependencies)
- Two pages: `landing.html` (operator UI) + `dashboard.html` (technical UI)
- Polling-based state updates (default: 3–5 second intervals)
- Google Fonts (Inter)

### ESP Firmware
- **Arduino framework** for ESP32 (Arduino IDE / PlatformIO)
- Libraries: `WiFi.h`, `esp_now.h`, `WebServer.h`, `esp_mac.h`

### Communication Protocols

| Layer              | Protocol       | Used Between                        |
|--------------------|----------------|-------------------------------------|
| Browser → Flask    | HTTP REST      | Browser and Flask server            |
| Flask → ESP Host   | HTTP (port 80) | Flask server and ESP Host WiFi AP   |
| ESP Host → Clients | ESP-NOW        | ESP Host and ESP1–5 (peer-to-peer)  |
| ESP1 ↔ MFC         | RS232 / UART2  | ESP1 and Mass Flow Controller       |

---

## Installation & Setup

### Prerequisites

- Python 3.9+
- Arduino IDE (2.x recommended) or PlatformIO with ESP32 board support
- ESP32 boards flashed with the appropriate firmware

### 1. Flash the ESP Firmware

#### Step 1 — Flash client ESPs first

Flash each client ESP (`ESP_1`, `ESP_2`, `ESP_3`, `ESP_4`) with its corresponding `.ino` sketch. After flashing, open the Serial Monitor at **115200 baud** and note the MAC address printed on boot:

```
ESP-NOW MAC: AA:BB:CC:DD:EE:FF
```

#### Step 2 — Configure the Host

Open `ESP_Host/ESP_Host.ino` and enter the MAC addresses you recorded:

```cpp
uint8_t MAC_ESP1[6] = {0x84, 0x1F, 0xE8, 0x26, 0x58, 0xD8};
uint8_t MAC_ESP2[6] = {0x20, 0x43, 0xA8, 0x6A, 0xFB, 0xDC};
uint8_t MAC_ESP3[6] = {0x20, 0xE7, 0xC8, 0x6B, 0x4F, 0x18};
uint8_t MAC_ESP4[6] = {0x8C, 0x4F, 0x00, 0x2E, 0x59, 0xE8};
uint8_t MAC_ESP5[6] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}; // Update with ESP5 MAC
```

Then flash the Host ESP.

#### ESP Host WiFi AP Credentials (default)

```
SSID:     ESP-HOST
Password: espHostPass
Channel:  1
```

> **Important:** ESP-NOW and the WiFi AP must operate on the same channel (channel 1 by default). All client ESPs must also use channel 1.

### 2. Set Up the Flask Server

#### Connect to the ESP Host's WiFi AP

Connect your Raspberry Pi or laptop to the `ESP-HOST` WiFi network.

#### Install Python dependencies

```bash
cd programmierung/website
pip install -r requirements.txt
```

#### Configure the host IP (if needed)

The default host IP is `http://192.168.4.1` (the ESP Host's AP address). Edit `config.py` if your setup differs:

```python
HOST = "http://192.168.4.1"
```

#### Run the Flask server

```bash
python app.py
```

The server starts on `http://0.0.0.0:8000`. Open a browser and navigate to `http://<raspberry-pi-ip>:8000`.

---

## Usage

### Web Interface

| URL          | Description                                              |
|--------------|----------------------------------------------------------|
| `/`          | Landing page — thematic system cards, scenarios, sensors |
| `/dashboard` | Technical dashboard — direct relay/motor/RS232 control   |

### Scenario Execution

Scenarios are defined in `scenarios.json` as ordered lists of actions. Available action types:

| Type    | Fields                    | Description                        |
|---------|---------------------------|------------------------------------|
| `relay` | `global_idx` or `name`, `val` | Switch a relay on (1) or off (0) |
| `delay` | `ms`                      | Wait for the given milliseconds    |
| `wind`  | `val`                     | Turn wind output on or off         |
| `train` | `pwm`, `dir`              | Set motor speed and direction      |

Example scenario definition:

```json
"kohlekraftwerk_startup": {
  "name": "Kohlekraftwerk Start",
  "actions": [
    { "type": "relay", "global_idx": 9, "val": 1 },
    { "type": "delay", "ms": 1500 },
    { "type": "relay", "global_idx": 10, "val": 1 }
  ]
}
```

### Global Relay Index Mapping

| Global Index | Device | Device Index | Name               |
|-------------|--------|--------------|--------------------|
| 1–8         | ESP1   | 0–7          | Ventil-1 … Unbelegt |
| 9–12        | ESP2   | 0–3          | Kühler-Kohle … Heizstab-Kohle |
| 13–18       | ESP4   | 0–5          | Elektrolyseur … Elekrolyseur-Pumpe |
| 19–22       | ESP3   | 0–3          | Relais 2–5         |

---

## API Overview

All endpoints are served by the Flask server on port 8000.

### Relay Control

| Method | Endpoint         | Body / Params                            | Description                        |
|--------|------------------|------------------------------------------|------------------------------------|
| POST   | `/api/relay/set` | `{ "global_idx": 1, "val": 1 }`          | Set a relay on or off              |

### Device State

| Method | Endpoint                     | Description                            |
|--------|------------------------------|----------------------------------------|
| GET    | `/api/device_state/<device>` | Get last known state of `esp1`–`esp4`  |
| GET    | `/api/device_meta/<device>`  | Get relay count and names for a device |

**Example response for `esp4`:**
```json
{
  "code": 200,
  "body": {
    "relays": [0, 1, 0, 0, 1],
    "sensors": [
      { "current": 8.45, "pressure": 1.23 },
      ...
    ],
    "flow": 3.5
  },
  "offline": false
}
```

### Scenarios

| Method | Endpoint                  | Body                                        | Description                      |
|--------|---------------------------|---------------------------------------------|----------------------------------|
| GET    | `/api/scenarios`          | —                                           | List all available scenarios     |
| POST   | `/api/scenario/execute`   | `{ "scenario": "kohlekraftwerk_startup" }`  | Execute a scenario by key        |

### ESP3 Controls

| Method | Endpoint              | Body                              | Description              |
|--------|-----------------------|-----------------------------------|--------------------------|
| GET    | `/api/esp3/state`     | —                                 | Get wind and motor state |
| POST   | `/api/esp3/set_wind`  | `{ "val": 1 }`                    | Turn wind on or off      |
| POST   | `/api/esp3/set_pwm`   | `{ "pwm": 128, "dir": 1 }`        | Set motor speed/direction|

### RS232

| Method | Endpoint      | Body                                   | Description                       |
|--------|---------------|----------------------------------------|-----------------------------------|
| POST   | `/api/rs232`  | `{ "cmd": ":06030101213E80", "timeout": 500 }` | Send raw RS232 command via ESP1 |
| POST   | `/api/leds/sync` | `{ "flows": { "coal": [true], ... } }` | Sync flows with ESP5 strips |
| POST   | `/api/leds/test` | `{ "mode": "green" }` | Hardware test for all LEDs |

### Debug / Status

| Method | Endpoint             | Description                               |
|--------|----------------------|-------------------------------------------|
| GET    | `/api/debug/host`    | Check if the Host ESP is reachable        |
| GET    | `/api/clients`       | Get online/offline status of all clients  |
| GET    | `/api/sensors/meta`  | Get sensor configuration for the frontend |

---

## Project Structure

```
.
├── README.md
└── programmierung/
    ├── esp code/
    │   ├── ESP_Host/
    │   │   └── ESP_Host.ino         # Central gateway: WiFi AP + ESP-NOW hub + HTTP server
    │   ├── ESP_1/
    │   │   └── ESP_1.ino            # 8× relay, NTC temp, RS232 (MFC)
    │   ├── ESP_2/
    │   │   └── ESP_2.ino            # 4× relay, NTC temp
    │   ├── ESP_3/
    │   │   └── ESP_3.ino            # 4× relay, DC motor, wind output
    │   ├── ESP_4/
    │   │   └── ESP_4.ino            # 5× relay, 5× 4–20mA sensors, flow meter
    │   ├── ESP_5/
    │   │   └── ESP_5.ino            # 7× LED strip controller
    │   ├── Drucksensoren/
    │   │   └── Drucksensoren.ino    # Standalone pressure sensor test sketch
    │   ├── Ralays-4/
    │   │   └── Ralays-4.ino         # Simple 4-relay cycling test sketch
    │   └── tests/
    │       ├── layout.html          # Standalone HTML UI prototype
    │       └── test/
    │           └── test.ino         # Flow meter calibration sketch
    └── website/
        ├── app.py                   # Flask application entry point
        ├── config.py                # Central config: HOST, relay map, sensor calibration, scenarios
        ├── esp_client.py            # Low-level HTTP client for ESP Host communication
        ├── requirements.txt
        ├── scenarios.json           # Scenario definitions (actions, delays)
        ├── routes/
        │   ├── __init__.py
        │   ├── relays.py            # /api/relay/set, /api/device_state, /api/device_meta
        │   ├── scenarios.py         # /api/scenarios, /api/scenario/execute
        │   ├── esp3.py              # /api/esp3/*, /api/rs232
        │   └── debug.py             # /api/debug/host, /api/clients
        ├── static/
        │   ├── app.js               # Dashboard page JavaScript
        │   ├── landing.js           # Landing page JavaScript
        │   ├── style.css            # Dashboard styles
        │   └── landing.css          # Landing page styles
        └── templates/
            ├── dashboard.html       # Technical control dashboard
            └── landing.html         # Operator-facing landing page
```

---

## Future Improvements

- [ ] **WebSocket / Server-Sent Events** — Replace HTTP polling with push-based updates for lower latency and reduced server load
- [ ] **Authentication** — Add basic auth or token-based access control to the Flask API
- [ ] **Persistent state storage** — Log relay states and sensor readings to a database (e.g. SQLite or InfluxDB) for historical analysis
- [ ] **Flow meter calibration UI** — Allow the K_FACTOR to be set from the web UI without reflashing firmware
- [ ] **RS232 command library** — Build a structured command library for the MFC instead of raw hex input
- [ ] **Sensor calibration UI** — Allow `i_zero`, `i_full`, and `max_val` to be adjusted at runtime via the dashboard
- [ ] **ESP4 pressure display on landing page** — Wire up the existing sensor cards to show live pressure bar graphs
- [ ] **Scenario editor** — UI for creating and editing scenarios without manually editing `scenarios.json`
- [ ] **Multi-language support** — Currently the UI is in German; adding English would increase accessibility
- [ ] **OTA firmware updates** — Enable over-the-air updates for the ESP devices

---

## License

This project is currently unlicensed. Add a `LICENSE` file to define usage terms.

---

*Energiesystemmodell Lausitz — Interaktive Steuerung für erneuerbare Energiesysteme*
