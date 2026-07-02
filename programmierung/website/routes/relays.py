#!/usr/bin/env python3
# routes/relays.py — Blueprint for all relay-related API endpoints

import time
from flask import Blueprint, jsonify, request
from config import RELAY_CONFIG, SENSOR_CONFIG, ESP4_SENSOR_CALIBRATION, VERBOSE
from config import report_status
from esp_client import host_forward

relays_bp = Blueprint('relays', __name__)

# Cache for relay meta data (names don't change at runtime)
_meta_cache = {}
_meta_cache_time = {}


@relays_bp.route("/api/sensors/meta")
def api_sensors_meta():
    """Returns the central sensor configuration for frontend dynamic rendering."""
    return jsonify(SENSOR_CONFIG)
@relays_bp.route("/api/device_meta/<device>")
def api_device_meta(device):
    if VERBOSE: print(f"\n[INFO] === Request: /api/device_meta/{device} ===")

    # Build fallback meta from RELAY_CONFIG
    fallback_meta = {"count": 0, "names": []}
    device_relays = RELAY_CONFIG.get(device, {})
    if isinstance(device_relays, dict) and device_relays:
        max_idx = max(device_relays.keys())
        fallback_meta["count"] = int(max_idx) + 1
        names = ["Unbelegt"] * (int(max_idx) + 1)
        for idx, cfg in device_relays.items():
            if isinstance(cfg, dict):
                names[int(idx)] = cfg.get("name", "Unbelegt")
        fallback_meta["names"] = names

    try:
        now = time.time()
        if device in _meta_cache and (now - _meta_cache_time.get(device, 0)) < 60:
            return jsonify(_meta_cache[device])

        res = {"code": 200, "body": fallback_meta}
        _meta_cache[device] = res
        _meta_cache_time[device] = now
        return jsonify(res)

    except Exception as e:
        report_status(device, False, str(e))
        return jsonify({"code": 200, "body": fallback_meta, "offline": True})


@relays_bp.route("/api/device_state/<device>")
def api_device_state(device):
    if VERBOSE: print(f"[INFO] Request: /api/device_state/{device}")

    # Fallback states per device
    fallback_state = {}
    if device == "esp1":
        fallback_state = {"r0":0,"r1":0,"r2":0,"r3":0,"r4":0,"r5":0,"r6":0,"r7":0,"temp":None,"rntc":None}
    elif device == "esp2":
        fallback_state = {"r0":0,"r1":0,"r2":0,"r3":0,"temp":None,"rntc":None}
    elif device == "esp3":
        fallback_state = {"running": False, "pwm": 0, "relays": [0, 0, 0, 0]}
    elif device == "esp4":
        fallback_state = {
            "relays": [0,0,0,0,0,0,0],
            "sensors": [
                {"current":0,"pressure":0},
                {"current":0,"pressure":0},
                {"current":0,"pressure":0},
                {"current":0,"distance":0},
                {"current":0,"distance":0},
            ],
            "flow": 0
        }

    try:
        res = host_forward(device, "GET", "/state", timeout=10)
        if res.get("code") == 200:
            report_status(device, True)

            # --- ESP4 Sensor Calibration ---
            from typing import Dict, Any, List, cast
            body_obj = res.get("body")
            if device == "esp4" and isinstance(body_obj, dict):
                body_dict = cast(Dict[str, Any], body_obj)
                sensors_obj = body_dict.get("sensors")

                if isinstance(sensors_obj, list):
                    sensors = cast(List[Dict[str, Any]], sensors_obj)
                    for i in range(min(5, len(sensors))):
                        cal = ESP4_SENSOR_CALIBRATION[i]
                        cal_i_zero = float(cal.get("i_zero", 3.19))
                        cal_i_full = float(cal.get("i_full", 20.0))

                        sensor_data = sensors[i]
                        if isinstance(sensor_data, dict):
                            current_mA = float(sensor_data.get("current", 0))

                            if current_mA <= cal_i_zero:
                                pct = 0.0
                            elif current_mA >= cal_i_full:
                                pct = 1.0
                            else:
                                pct = (current_mA - cal_i_zero) / (cal_i_full - cal_i_zero)

                            if cal.get("type") == "pressure":
                                max_val = float(cal.get("max_val", 4.0))
                                sensor_data["pressure"] = round(pct * max_val, 2)
                            elif cal.get("type") == "ultrasonic":
                                max_val = float(cal.get("max_val", 30.0))
                                min_val = float(cal.get("min_val", 2.0))
                                sensor_data["pressure"] = round((pct * (max_val - min_val)) + min_val, 2)

            if VERBOSE: print(f"[INFO] State response for {device}: {res}")
            return jsonify(res)
        else:
            raise Exception(f"Device returned code {res.get('code')}")

    except Exception as e:
        report_status(device, False, str(e))
        return jsonify({"code": 200, "body": fallback_state, "offline": True})


@relays_bp.route("/api/relay/set", methods=["POST"])
def api_relay_set():
    j = request.get_json(force=True)
    device = j.get("device")
    idx_raw = j.get("idx")
    if not device or idx_raw is None:
        return jsonify({"error": "missing device or idx"}), 400

    try:
        idx = int(idx_raw)
    except Exception:
        return jsonify({"error": "invalid idx"}), 400

    val = 1 if int(j.get("val")) else 0

    device_relays = RELAY_CONFIG.get(device, {})
    if not isinstance(device_relays, dict) or idx not in device_relays:
        return jsonify({"error": "invalid device or idx"}), 400

    path = f"/set?idx={idx}&val={val}"
    print(f"[INFO] Relay set: device={device}, idx={idx}, val={val}")
    try:
        res = host_forward(device, "GET", path, timeout=10)
        code = res.get("code", -1)
        if code == 200:
            return jsonify(res)
        # 504 = ESP did not acknowledge (offline/no ACK), -1 = send failed
        body = res.get("body", {})
        err_msg = body.get("error", "ESP hat nicht geantwortet") if isinstance(body, dict) else str(body)
        print(f"[WARN] Relay set failed for {device} idx={idx}: code={code}, err={err_msg}")
        return jsonify({"error": err_msg, "code": code}), 502
    except Exception as e:
        print(f"[ERROR] /api/relay/set: {str(e)}")
        return jsonify({"error": str(e)}), 502
