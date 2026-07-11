#!/usr/bin/env python3
# routes/esp3.py — Blueprint for ESP3 specific endpoints (Wind, Train, RS232)

import json
from flask import Blueprint, jsonify, request
from config import report_status
from esp_client import host_forward

esp3_bp = Blueprint('esp3', __name__)


@esp3_bp.route("/api/esp3/state")
def api_esp3_state():
    try:
        res = host_forward("esp3", "GET", "/state", timeout=10)
        if res.get("code") == 200:
            report_status("esp3", True)
            return jsonify(res)
        else:
            raise Exception(f"ESP3 returned code {res.get('code')}")
    except Exception as e:
        report_status("esp3", False, str(e))
        return jsonify({"code": 200, "body": {"running": False, "pwm": 0}, "offline": True})





@esp3_bp.route("/api/esp3/set_pwm", methods=["POST"])
def api_esp3_set_pwm():
    j = request.get_json(force=True)
    pwm = max(0, min(255, int(j.get("pwm", 0))))
    direction = int(j.get("dir", 1))
    try:
        return jsonify(host_forward("esp3", "GET", f"/train?pwm={pwm}&dir={direction}", timeout=10))
    except Exception as e:
        print(f"[ERROR] /api/esp3/set_pwm: {str(e)}")
        return jsonify({"error": str(e)}), 502


@esp3_bp.route("/api/rs232", methods=["POST"])
def api_rs232():
    j = request.get_json(force=True)
    cmd = j.get("cmd", "")
    timeout = int(j.get("timeout", 500))
    if not cmd:
        return jsonify({"error": "no cmd"}), 400
    # Pass RS232 command as URL parameters (easier to parse on ESP)
    path = f"/send?cmd={cmd}&timeout={timeout}"
    print(f"[INFO] RS232 command: {cmd}")
    try:
        res = host_forward("esp1", "GET", path, timeout=5)
        return jsonify(res)
    except Exception as e:
        print(f"[ERROR] /api/rs232: {str(e)}")
        return jsonify({"error": str(e)}), 502
