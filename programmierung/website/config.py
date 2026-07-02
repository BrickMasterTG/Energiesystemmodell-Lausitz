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
    "esp1": {
        0: {"name": "Ventil - 1"},
        1: {"name": "Ventil - 2"},
        2: {"name": "Heizstab"},
        3: {"name": "Zünder"},
        4: {"name": "Gasventil"},
        5: {"name": "Kühler"},
        6: {"name": "MFC"},
        7: {"name": "Unbelegt"},
    },
    "esp2": {
        0: {"name": "Kühler-Kohle"},
        1: {"name": "Ventil Turbine"},
        2: {"name": "Ventil-Kohle"},
        3: {"name": "Heizstab-Kohle"},
    },
    "esp4": {
        0: {"name": "Elekrolyseur"},
        1: {"name": "Tank füllen"},
        2: {"name": "Tank leeren"},
        3: {"name": "Durchschalten"},
        4: {"name": "Lüfter"},
        5: {"name": "Windrad-LED"},
        6: {"name": "Windrad-Motor"},
    },
    "esp3": {
        0: {"name": "Pumpe 1"},
        1: {"name": "Pumpe 2"},
        2: {"name": "Ventil 1"},
        3: {"name": "Ventil 2"},
    },
}

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
color_export_power = (245, 195, 29)
color_import_power = (0, 255, 0)
heat_import_power = (255, 0, 0)
heat_export_power = (0, 0, 255)

LED_MAPPING = {   
    "elektro_consume":  [{"strip": 0, "range": (179, 0), "color": color_export_power}], 
    "elektro_fuelcell": [{"strip": 0, "range": (0, 97), "color": color_import_power},
                         {"strip": 0, "range": (216, 180), "color": color_import_power}], 
    "solar":            [{"strip": 1, "range": (0, 112),  "color": color_import_power}],
    "village_power":    [{"strip": 1, "range": (174, 112),  "color": color_export_power}, #done
                         {"strip": 4, "range": (200, 0),  "color": color_export_power}], #done
    "village_heat":     [{"strip": 1, "range": (112, 174),  "color": heat_import_power},
                         {"strip": 1, "range": (174, 112),  "color": heat_import_power}],
    "wind":             {"strip": 2, "range": (0, 30),  "color": color_import_power}, #done
    "heatpump_power":   {"strip": 3, "range": (133, 0),  "color": color_export_power}, # Electricity: Only red
    "heatpump_heat":    [{"strip": 3, "range": (0, 133),  "color": heat_import_power},
                         {"strip": 3, "range": (133, 0),  "color": heat_export_power}], # Heat: Dual
    "heatBus":  [{"strip": 4, "range": (0, 366),  "color": heat_import_power},
                 {"strip": 4, "range": (366, 0),  "color": heat_export_power}, # opposing blue
                 {"strip": 0, "range": (102, 0),  "color": heat_import_power},
                 {"strip": 0, "range": (0, 102),  "color": heat_export_power}], # opposing blue
    "gridToExternal_import": {"strip": 5, "range": (0, 134), "color": color_import_power},
    "gridToExternal_export": {"strip": 5, "range": (134, 0), "color": color_export_power},
    "gridToExternal_heat":   [{"strip": 5, "range": (0, 134), "color": heat_import_power},
                              {"strip": 5, "range": (134, 0), "color": heat_export_power}],
    "coal_power": {"strip": 6, "range": (0, 200),  "color": color_import_power},
    "coal_heat":  [{"strip": 6, "range": (0, 200),  "color": heat_import_power},
                   {"strip": 6, "range": (200, 0),  "color": heat_export_power}],
    "gas_power": {"strip": 7, "range": (0, 156),  "color": color_import_power}, #done
    "gas_heat":  [{"strip": 7, "range": (0, 156),  "color": heat_import_power},
                  {"strip": 7, "range": (156, 0),  "color": heat_export_power}],
    "houses":   {"strip": 4, "range": (200, 250), "color": (255, 255, 255)},
}

SCENARIOS = load_scenarios()
