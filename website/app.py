from flask import Flask, render_template, request, redirect, url_for, send_from_directory
import threading
import time
import processing.data_transfer as data_transfer
from processing.data_transfer import sensor1_data, sensor2_data
from flask import jsonify

app = Flask(__name__)

# MQTT in eigenem Thread starten
def mqtt_thread():
    data_transfer.loading()  # startet MQTT-Client und loop_start
    while True:
        # Hier ggf. Reconnect-Logik, wenn benötigt
        time.sleep(1)

@app.route('/models/<path:filename>') 
def models(filename):
    print("Serving model file:", filename)
    return send_from_directory('models', filename)

@app.route('/api/sensors')
def get_sensor_data():
    return jsonify({
        "sensor1": list(sensor1_data),
        "sensor2": list(sensor2_data)
    })

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/windpark')
def windpark():
    return render_template('windpark.html')

@app.route('/layout')
def layout():
    return render_template('layout-main.html')

@app.route('/button1', methods=['POST'])
def button1():
    print("Button 1 clicked")
    data_transfer.send("Button Clicked")
    return redirect(url_for('windpark'))

@app.route('/button2', methods=['POST'])
def button2():
    print("Button 2 clicked")
    data_transfer.send("10")
    return redirect(url_for('windpark'))

if __name__ == '__main__':
    # MQTT Thread als Daemon starten, damit er beim Programmende automatisch stoppt
    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()

    # Flask starten ohne debug=True (oder mit debug=False), damit kein Reload läuft
    app.run(debug=False, port=5001)
