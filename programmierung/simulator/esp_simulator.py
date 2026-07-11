#!/usr/bin/env python3
"""
ESP_Host simulator — mimics the HTTP API of ESP_Host.ino for offline development.

Run:  python esp_simulator.py
      Dashboard: http://localhost:8001/
      Point Flask config HOST to http://localhost:8001
"""

import json
import os
import random
import threading
import time
from collections import deque

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

PORT = 8001
CLIENT_NAMES = ["esp1", "esp2", "esp3", "esp4", "esp5"]
RELAY_COUNTS = {"esp1": 8, "esp2": 4, "esp3": 5, "esp4": 8, "esp5": 0}

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

_lock = threading.Lock()
_start_ms = int(time.time() * 1000)
_command_log = deque(maxlen=200)


def _now_ms():
    return int(time.time() * 1000) - _start_ms


class DeviceState:
    def __init__(self, name):
        self.name = name
        self.online = True
        self.last_seen = _now_ms()
        count = RELAY_COUNTS[name]
        self.relays = [0] * count
        if name == "esp1" and count > 6:
            self.relays[6] = 1  # MFC default on (matches Flask fallback)
        self.temp = 22.0 if name == "esp1" else (45.0 if name == "esp2" else None)
        self.running = False
        self.pwm = 0
        self.forward = True
        # ESP4: 5 sensors as mA current; ESP3: 2 lake temps
        if name == "esp4":
            self.sensor_currents = [8.0, 8.5, 9.0, 12.0, 12.5]
            self.flow = 0.0
        elif name == "esp3":
            self.sensor_currents = [15.0, 16.0]
        else:
            self.sensor_currents = []
        self.last_rs232_res = "ACK"
        self.mfc_setpoint = 16000  # Default 50% für MFC

    def touch(self):
        self.last_seen = _now_ms()


_devices = {name: DeviceState(name) for name in CLIENT_NAMES}


def _log(method, path, target="", code=200, detail=""):
    entry = {
        "ts": time.strftime("%H:%M:%S"),
        "method": method,
        "path": path,
        "target": target,
        "code": code,
        "detail": detail,
    }
    with _lock:
        _command_log.appendleft(entry)


def _drift_value(val, lo, hi, step=0.05):
    val += random.uniform(-step, step)
    return max(lo, min(hi, val))


def _sensor_drift_loop():
    """Option B: slowly drifting sensor values."""
    while True:
        time.sleep(2.0)
        with _lock:
            for d in _devices.values():
                if not d.online:
                    continue
                if d.name == "esp1" and d.temp is not None:
                    d.temp = round(_drift_value(d.temp, 18.0, 28.0), 2)
                elif d.name == "esp2" and d.temp is not None:
                    d.temp = round(_drift_value(d.temp, 40.0, 55.0), 2)
                elif d.name == "esp3":
                    d.sensor_currents = [
                        round(_drift_value(v, 12.0, 20.0)) for v in d.sensor_currents
                    ]
                elif d.name == "esp4":
                    ranges = [(4.0, 16.0)] * 3 + [(8.0, 16.0)] * 2
                    d.sensor_currents = [
                        round(_drift_value(v, lo, hi), 2)
                        for v, (lo, hi) in zip(d.sensor_currents, ranges)
                    ]
                    d.flow = round(_drift_value(d.flow, 0.0, 3.0, 0.1), 1)
                d.last_seen = _now_ms()


threading.Thread(target=_sensor_drift_loop, daemon=True).start()


# ---------------------------------------------------------------------------
# State JSON builders (match ESP_Host.ino handleDeviceState)
# ---------------------------------------------------------------------------


def _build_body(device):
    d = _devices[device]

    if device == "esp1":
        parts = {f"r{i}": d.relays[i] for i in range(len(d.relays))}
        parts["temp"] = d.temp
        return parts

    if device == "esp2":
        parts = {f"r{i}": d.relays[i] for i in range(len(d.relays))}
        parts["temp"] = d.temp
        return parts

    if device == "esp3":
        return {
            "running": d.running,
            "pwm": d.pwm,
            "forward": d.forward,
            "temp": d.temp,
            "sensors": d.sensor_currents[:],
            "relays": d.relays[:],
        }

    if device == "esp4":
        sensors = [
            {"current": d.sensor_currents[i], "pressure": 0.0}
            for i in range(len(d.sensor_currents))
        ]
        return {
            "sensors": sensors,
            "relays": d.relays[:],
            "flow": d.flow,
        }

    # esp5 — Host returns empty object
    return {}


def _parse_forward_body(raw):
    try:
        data = json.loads(raw)
        return (
            data.get("target", ""),
            data.get("path", ""),
            data.get("method", "GET"),
        )
    except json.JSONDecodeError:
        return "", "", ""


def _parse_query_int(path, key, default=0):
    marker = f"{key}="
    pos = path.find(marker)
    if pos < 0:
        return default
    start = pos + len(marker)
    end = path.find("&", start)
    chunk = path[start:] if end < 0 else path[start:end]
    try:
        return int(chunk)
    except ValueError:
        return default


def _apply_relay(target, idx, val):
    d = _devices.get(target)
    if not d or idx < 0 or idx >= len(d.relays):
        return False
    d.relays[idx] = 1 if val else 0
    d.touch()
    return True


# ---------------------------------------------------------------------------
# HTTP routes — ESP_Host API
# ---------------------------------------------------------------------------


@app.route("/clients")
def handle_clients():
    with _lock:
        clients = []
        for name in CLIENT_NAMES:
            d = _devices[name]
            clients.append({
                "name": name,
                "online": d.online,
                "lastSeen": d.last_seen,
            })
    return jsonify({"clients": clients})


@app.route("/state/<device>")
def handle_device_state(device):
    if device not in _devices:
        return jsonify({"error": "Unknown device"}), 404

    with _lock:
        d = _devices[device]
        body = _build_body(device)
        offline = not d.online
        if d.online:
            d.touch()

    return jsonify({"code": 200, "body": body, "offline": offline})


@app.route("/forward", methods=["POST"])
def handle_forward():
    raw = request.get_data(as_text=True)
    target, path, method = _parse_forward_body(raw)

    if not target or not path:
        _log("POST", "/forward", target, 400, "missing target/path")
        return jsonify({"error": "Missing target or path"}), 400

    detail = f"{method} {path}"
    d = _devices.get(target)

    if path.startswith("/set?idx="):
        idx = _parse_query_int(path, "idx")
        val = _parse_query_int(path, "val")

        with _lock:
            if not d or not d.online:
                _log("POST", path, target, 504, f"relay {idx}→{val} (offline)")
                return jsonify({"code": 504, "body": {"error": "No ACK from ESP"}}), 504

            ok = _apply_relay(target, idx, val)
            if not ok:
                _log("POST", path, target, 400, f"invalid relay idx={idx}")
                return jsonify({"error": "Invalid relay index"}), 400

        # Option A: instant ACK
        _log("POST", path, target, 200, f"relay {idx}→{val}")
        return jsonify({"code": 200, "body": "ok"})

    if path.startswith("/train?"):
        pwm = _parse_query_int(path, "pwm")
        direction = _parse_query_int(path, "dir", 1)
        with _lock:
            if d:
                d.pwm = max(0, min(255, pwm))
                d.forward = bool(direction)
                d.touch()
        _log("POST", path, target, 200, f"pwm={pwm} dir={direction}")
        return jsonify({"code": 200, "body": "ok"})

    if path.startswith("/set?val="):
        val = _parse_query_int(path, "val")
        with _lock:
            if d:
                d.running = bool(val)
                d.touch()
        _log("POST", path, target, 200, f"wind running={val}")
        return jsonify({"code": 200, "body": "ok"})

    if path.startswith("/send"):
        cmd_marker = "cmd="
        cmd_pos = path.find(cmd_marker)
        cmd = ""
        if cmd_pos >= 0:
            start = cmd_pos + len(cmd_marker)
            end = path.find("&", start)
            cmd = path[start:] if end < 0 else path[start:end]
            import urllib.parse
            cmd = urllib.parse.unquote(cmd)

        res = "ACK"
        with _lock:
            if d:
                if cmd.startswith(":06030401210120"): # Read flow command
                    import random
                    jitter = random.randint(-200, 200)
                    sim_val = max(0, min(32000, getattr(d, 'mfc_setpoint', 16000) + jitter))
                    hex_val = f"{int(sim_val):04X}"
                    res = f":0603020121{hex_val}\r\n"
                elif cmd.startswith(":0603010121"): # Write flow setpoint
                    try:
                        hex_val = cmd[11:15]
                        d.mfc_setpoint = int(hex_val, 16)
                    except ValueError:
                        pass
                    res = cmd + "\r\n" # mock ACK for write
                d.last_rs232_res = res
                d.touch()

        _log("POST", path, target, 200, f"rs232 cmd={cmd[:40]}")
        return jsonify({"code": 200, "body": res})

    if path.startswith("/led?"):
        # Option A: silently accept + log
        _log("POST", path, target, 200, "LED command")
        return jsonify({"code": 200, "body": "ok"})

    if path.startswith("/clear"):
        _log("POST", path, target, 200, "LED clear")
        return jsonify({"code": 200, "body": "ok"})

    _log("POST", path, target, 400, "unknown path")
    return jsonify({"error": "Unknown path"}), 400


# ---------------------------------------------------------------------------
# Simulator dashboard API
# ---------------------------------------------------------------------------


@app.route("/")
def dashboard():
    here = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(here, "sim_dashboard.html")


@app.route("/api/sim/status")
def sim_status():
    with _lock:
        devices = {}
        for name, d in _devices.items():
            devices[name] = {
                "online": d.online,
                "state": _build_body(name),
                "last_seen": d.last_seen,
            }
        log = list(_command_log)
    return jsonify({"devices": devices, "log": log})


@app.route("/api/sim/toggle", methods=["POST"])
def sim_toggle():
    data = request.get_json(force=True)
    device = data.get("device", "")
    online = bool(data.get("online", True))
    if device not in _devices:
        return jsonify({"error": "unknown device"}), 400
    with _lock:
        _devices[device].online = online
        if online:
            _devices[device].touch()
    _log("TOGGLE", f"online={online}", device, 200)
    return jsonify({"ok": True, "device": device, "online": online})


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"ESP Simulator running at http://localhost:{PORT}")
    print("Set Flask config HOST = 'http://localhost:8001' to use simulation mode.")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
