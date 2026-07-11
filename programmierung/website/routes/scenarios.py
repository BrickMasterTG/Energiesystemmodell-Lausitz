#!/usr/bin/env python3
# routes/scenarios.py — Blueprint for scenario listing and execution

import time
from flask import Blueprint, jsonify, request
from config import RELAY_CONFIG, load_scenarios
from esp_client import host_get, host_forward

scenarios_bp = Blueprint('scenarios', __name__)

# Module-level scenarios dict, reloaded on each request
_scenarios = load_scenarios()


@scenarios_bp.route("/api/scenarios")
def api_scenarios():
    """Returns all available scenarios. Reloads scenarios.json on every call."""
    global _scenarios
    _scenarios = load_scenarios()
    return jsonify({"scenarios": _scenarios})


@scenarios_bp.route("/api/scenario/execute", methods=["POST"])
def api_scenario_execute():
    """Executes a scenario synchronously so errors are reported immediately."""
    global _scenarios
    _scenarios = load_scenarios()

    j = request.get_json(force=True)
    scenario_name = j.get("scenario")

    if not scenario_name:
        return jsonify({"error": "Kein Szenario angegeben"}), 400

    if scenario_name not in _scenarios:
        # Legacy fallback: forward directly to Host-ESP
        state = int(j.get("state", 0))
        print(f"[INFO] Fallback executing legacy scenario: {scenario_name}, state: {state}")
        try:
            path = f"/scenario?name={scenario_name}&state={state}"
            result = host_get(path, timeout=10)
            return jsonify({"success": True, "scenario": scenario_name, "state": state, "host_response": result})
        except Exception as e:
            return jsonify({"error": str(e)}), 502

    scenario_data = _scenarios[scenario_name]
    actions = scenario_data.get("actions", [])

    print("\n" + "="*50)
    print(f"[SCENARIO START] '{scenario_name}' ({len(actions)} Aktionen)")
    print("="*50)

    def resolve_relay_action(a):
        """Resolve relay action to (device, idx). Supports (device, idx) or relay by name."""
        if a.get("device") is not None and a.get("idx") is not None:
            dev = a.get("device")
            try:
                ridx = int(a.get("idx"))
            except Exception:
                return None
            if dev in RELAY_CONFIG and isinstance(RELAY_CONFIG.get(dev), dict) and ridx in RELAY_CONFIG[dev]:
                return dev, ridx
            return None

        name = a.get("name") or a.get("relay")
        if not name:
            return None
        name_l = str(name).lower()
        for dev, relays in RELAY_CONFIG.items():
            if not isinstance(relays, dict):
                continue
            for ridx, cfg in relays.items():
                if isinstance(cfg, dict) and str(cfg.get("name", "")).lower() == name_l:
                    return dev, int(ridx)
        return None

    for idx, action in enumerate(actions):
        try:
            atype = action.get("type")
            prefix = f"[Aktion {idx+1}/{len(actions)} - {atype.upper()}]"

            if atype == "delay":
                ms = int(action.get("ms", 1000))
                print(f"{prefix} Warte {ms}ms ... ", end="", flush=True)
                time.sleep(ms / 1000.0)
                print("OK")

            elif atype == "relay":
                val = 1 if int(action.get("val")) else 0
                state_str = "AN" if val else "AUS"
                resolved = resolve_relay_action(action)
                ident = action.get("name") or action.get("relay") or f'{action.get("device")}:{action.get("idx")}'
                print(f"{prefix} Schalte '{ident}' -> {state_str} ... ", end="", flush=True)

                if resolved is None:
                    print("FEHLER")
                    raise Exception(f"Relay mapping not found for '{ident}'.")

                device, dev_idx = resolved
                path = f"/set?idx={dev_idx}&val={val}"
                host_forward(device, "GET", path, timeout=10)
                print("OK")

            elif atype == "wind":
                val_w = 1 if int(action.get("val", 0)) else 0
                state_str = "AN" if val_w else "AUS"
                print(f"{prefix} Wind -> {state_str} ... ", end="", flush=True)
                host_forward("esp3", "GET", f"/set?val={val_w}", timeout=10)
                print("OK")

            elif atype == "train":
                pwm = int(action.get("pwm", 0))
                dir_val = int(action.get("dir", 1))
                print(f"{prefix} Zug -> PWM:{pwm} DIR:{dir_val} ... ", end="", flush=True)
                host_forward("esp3", "GET", f"/train?pwm={pwm}&dir={dir_val}", timeout=10)
                print("OK")

            elif atype == "wait_sensor":
                sensor_id = int(action.get("sensor_id"))
                target_val = float(action.get("value"))
                condition = action.get("condition", ">")
                timeout_ms = int(action.get("timeout_ms", 60000))

                print(f"{prefix} Warte auf Sensor {sensor_id} {condition} {target_val} (Timeout: {timeout_ms}ms) ... ", end="", flush=True)

                from config import SENSOR_CONFIG
                from routes.relays import get_device_state_dict

                # Find sensor config
                sensor_cfg = None
                target_device = None
                for dev, sensors in SENSOR_CONFIG.items():
                    if sensor_id in sensors:
                        sensor_cfg = sensors[sensor_id]
                        target_device = dev
                        break

                if not sensor_cfg:
                    print("FEHLER")
                    raise Exception(f"Sensor {sensor_id} not found in SENSOR_CONFIG")

                start_time = time.time()
                timeout_s = timeout_ms / 1000.0
                success = False

                while (time.time() - start_time) < timeout_s:
                    state_res = get_device_state_dict(target_device)
                    body = state_res.get("body", {}) if isinstance(state_res, dict) else state_res
                    if isinstance(body, str):
                        try:
                            import json
                            body = json.loads(body)
                        except Exception:
                            body = {}

                    val = body
                    for p in sensor_cfg["state_path"].split("."):
                        if isinstance(val, dict):
                            val = val.get(p)
                        elif isinstance(val, list) and p.isdigit():
                            try:
                                val = val[int(p)]
                            except IndexError:
                                val = None
                                break
                        else:
                            val = None
                            break

                    if val is not None:
                        try:
                            val = float(val)
                            if condition == ">" and val > target_val: success = True
                            elif condition == "<" and val < target_val: success = True
                            elif condition == ">=" and val >= target_val: success = True
                            elif condition == "<=" and val <= target_val: success = True
                            elif condition == "==" and abs(val - target_val) < 0.01: success = True

                            if success:
                                break
                        except ValueError:
                            pass

                    time.sleep(1.0)

                if not success:
                    print("FEHLER (Timeout)")
                    raise Exception(f"Timeout ({timeout_ms}ms) waiting for sensor {sensor_id} {condition} {target_val}")
                print("OK")

        except Exception as e:
            err_msg = f"Failed at action {idx}: {e}"
            print(f"FEHLER: {str(e)}")
            print(f"[SCENARIO ERROR] Abbruch bei Aktion {idx+1}.")
            return jsonify({"error": err_msg, "scenario": scenario_name}), 502

    print(f"[SCENARIO ERFOLG] '{scenario_name}' abgeschlossen.\n")
    return jsonify({
        "success": True,
        "scenario": scenario_name,
        "actions_count": len(actions)
    })
