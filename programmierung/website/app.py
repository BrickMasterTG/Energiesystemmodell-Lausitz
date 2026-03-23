#!/usr/bin/env python3
# app.py — Flask application entry point
# All logic is split into: config.py, esp_client.py, routes/

import os
from flask import Flask, render_template

from routes.relays    import relays_bp
from routes.scenarios import scenarios_bp
from routes.esp3      import esp3_bp
from routes.debug     import debug_bp
from routes.leds      import leds_bp

# ============================================================================
# FLASK APP
# ============================================================================

base_dir     = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.join(base_dir, 'templates')
static_dir   = os.path.join(base_dir, 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# Register all blueprints
app.register_blueprint(relays_bp)
app.register_blueprint(scenarios_bp)
app.register_blueprint(esp3_bp)
app.register_blueprint(debug_bp)
app.register_blueprint(leds_bp)

# ============================================================================
# FRONTEND ROUTES
# ============================================================================

@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/dashboard")
def dashboard():
    from config import HOST
    return render_template("dashboard.html", host=HOST)

@app.route("/fluesse")
def fluesse():
    return render_template("fluesse.html")

@app.route("/systemsteuerung")
def systemsteuerung():
    from config import HOST
    return render_template("systemsteuerung.html", host=HOST)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    from config import HOST
    print("=" * 60)
    print("Flask UI gestartet")
    print("=" * 60)
    print(f"Host ESP: {HOST}")
    print(f"Debug Endpoint: http://localhost:8000/api/debug/host")
    print("=" * 60)
    app.run(host="0.0.0.0", port=8000, debug=True)