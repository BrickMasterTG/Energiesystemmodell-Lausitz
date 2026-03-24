#!/usr/bin/env python3
# config.py — Central configuration for all devices, relays, sensors and scenarios

import os
import json

# ============================================================================
# GLOBAL SETTINGS
# ============================================================================

HOST = "http://192.168.4.1"   # Host-ESP
HTTP_TIMEOUT = 10              # Default timeout in seconds
USE_MOCK_DATA = False
VERBOSE = False

# ============================================================================
# STATUS TRACKING
# ============================================================================

OFFLINE_DEVICES = set()

def report_status(device, is_online, error_msg=None):
    """Prints status only when it changes to avoid terminal spam."""
    if is_online:
        if device in OFFLINE_DEVICES:
            print(f"[ONLINE] {device} is back online")
            OFFLINE_DEVICES.remove(device)
    else:
        if device not in OFFLINE_DEVICES:
            print(f"[OFFLINE] {device} is missing/unreachable: {error_msg}")
            OFFLINE_DEVICES.add(device)

# ============================================================================
# RELAY CONFIG
# ============================================================================

RELAY_CONFIG = {
    1: {"device": "esp1", "idx": 0, "name": "Ventil - 1"},
    2: {"device": "esp1", "idx": 1, "name": "Ventil - 2"},
    3: {"device": "esp1", "idx": 2, "name": "Heizstab"},
    4: {"device": "esp1", "idx": 3, "name": "Zünder"},
    5: {"device": "esp1", "idx": 4, "name": "Gasventil"},
    6: {"device": "esp1", "idx": 5, "name": "Kühler"},
    7: {"device": "esp1", "idx": 6, "name": "MFC"},
    8: {"device": "esp1", "idx": 7, "name": "Unbelegt"},

    9:  {"device": "esp2", "idx": 0, "name": "Kühler-Kohle"},
    10: {"device": "esp2", "idx": 1, "name": "Ventil Turbine"},
    11: {"device": "esp2", "idx": 2, "name": "Ventil-Kohle"},
    12: {"device": "esp2", "idx": 3, "name": "Heizstab-Kohle"},

    13: {"device": "esp4", "idx": 0, "name": "Elekrolyseur"},
    14: {"device": "esp4", "idx": 1, "name": "Tank füllen"},
    15: {"device": "esp4", "idx": 2, "name": "Tank leeren"},
    16: {"device": "esp4", "idx": 3, "name": "Durchschalten"},
    17: {"device": "esp4", "idx": 4, "name": "Lüfter"},

    18: {"device": "esp3", "idx": 0, "name": "Relais 2"},
    19: {"device": "esp3", "idx": 1, "name": "Relais 3"},
    20: {"device": "esp3", "idx": 2, "name": "Relais 4"},
    21: {"device": "esp3", "idx": 3, "name": "Relais 5"},
}

# Flat mapping: global relay index -> (device, device_idx)
GLOBAL_MAP = {k: (v["device"], v["idx"]) for k, v in RELAY_CONFIG.items()}

def get_relay_id(identifier):
    """Resolve a relay name, number string, or integer to a global relay id."""
    if isinstance(identifier, int):
        return identifier
    if isinstance(identifier, str):
        if identifier.isdigit():
            return int(identifier)
        for k, v in RELAY_CONFIG.items():
            if str(v["name"]).lower() == str(identifier).lower():
                return k
    return None

# ============================================================================
# SENSOR CONFIG
# ============================================================================

SENSOR_CONFIG = {
    101: {"device": "esp1", "state_path": "temp",               "name": "Temperatur",    "unit": "°C",   "target_card": "gas"},
    102: {"device": "esp2", "state_path": "temp",               "name": "Temperatur",    "unit": "°C",   "target_card": "coal"},

    #103: {"device": "esp3", "state_path": "sensors.0.pressure", "name": "Druck 1",       "unit": "bar",  "target_card": "wind"},
    #104: {"device": "esp3", "state_path": "sensors.1.pressure", "name": "Druck 2",       "unit": "bar",  "target_card": "wind"},

    105: {"device": "esp4", "state_path": "sensors.0.pressure", "name": "Systemdruck 1", "unit": "bar",  "target_card": "electro"},
    106: {"device": "esp4", "state_path": "sensors.1.pressure", "name": "Systemdruck 2", "unit": "bar",  "target_card": "electro"},
    107: {"device": "esp4", "state_path": "sensors.2.pressure", "name": "Speicherdruck",  "unit": "bar",  "target_card": "electro"},
    108: {"device": "esp4", "state_path": "sensors.3.pressure", "name": "Abstand 1",      "unit": "cm",   "target_card": "electro"},
    109: {"device": "esp4", "state_path": "sensors.4.pressure", "name": "Abstand 2",      "unit": "cm",   "target_card": "electro"},
    110: {"device": "esp4", "state_path": "flow",               "name": "Durchfluss",     "unit": "L/min","target_card": "electro"},
    111: {"device": "esp3", "state_path": "sensors.0",          "name": "temp1",          "unit": "°C",   "target_card": "lake"},
    112: {"device": "esp3", "state_path": "sensors.1",          "name": "temp2",          "unit": "°C",   "target_card": "lake"},
}

# ============================================================================
# ESP4 SENSOR CALIBRATION
# ============================================================================
# Formula: ((current_mA - I_ZERO) / (I_FULL - I_ZERO)) * MAX_VAL

ESP4_SENSOR_CALIBRATION = [
    {"type": "pressure",   "i_zero": 2.88, "i_full": 18.88, "max_val": 4.0},                        # Sensor 0
    {"type": "pressure",   "i_zero": 3.00, "i_full": 19.19, "max_val": 4.0},                        # Sensor 1
    {"type": "pressure",   "i_zero": 2.98, "i_full": 18.98, "max_val": 6.0},                        # Sensor 2
    {"type": "ultrasonic", "i_zero": 4.00, "i_full": 20.0,  "min_val": 2.0, "max_val": 30.0},      # Sensor 3
    {"type": "ultrasonic", "i_zero": 3.08, "i_full": 20.0,  "min_val": 2.0, "max_val": 30.0},      # Sensor 4
]

# ============================================================================
# SCENARIOS
# ============================================================================

def load_scenarios():
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenarios.json')
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Loading scenarios.json failed: {e}")
        return {}

# ============================================================================
# LED MAPPING (ESP5)
# ============================================================================
# Maps flow identifiers to (strip, start, end, color_rgb)
LED_MAPPING = {
    "coal":     [{"strip": 6, "range": (0, 134),  "color": (100, 100, 100)}], #length
    "wind":     {"strip": 2, "range": (0, 22),  "color": (0, 255, 0)}, #done
    "solar":    {"strip": 1, "range": (0, 58),  "color": (150, 150, 150)}, #done
    #"gas":      {"strip": 0, "range": (0, 40),  "color": (255, 100, 0)}, #later

    "village":  {"strip": 4, "range": (0, 40),  "color": (0, 0, 255)}, #length
    "gridToExternal": [{"strip": 5, "range": (0, 134), "color": (0, 255, 255)}], #done
    "heatpump": [{"strip": 3, "range": (0, 120),  "color": (255, 0, 0)},], #done
    "elektro":  {"strip": 0, "range": (0, 68), "color": (0, 255, 255)}, #done
}

SCENARIOS = load_scenarios()
