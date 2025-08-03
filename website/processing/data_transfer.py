import paho.mqtt.client as mqtt
import time

# Globale Variablen
client = None
flag_connected = 0
counter = 0

def on_connect(client, userdata, flags, rc):
    global flag_connected
    if rc == 0:
        flag_connected = 1
        print("✅ Connected to MQTT server")
        client_subscriptions(client)
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    global flag_connected
    flag_connected = 0
    print(f"⚠️ Disconnected from MQTT server, return code: {rc}")

# Callback-Funktionen für Topics
def callback_esp32_sensor1(client, userdata, msg):
    print('? ESP sensor1 data:', msg.payload.decode('utf-8'))

def callback_esp32_sensor2(client, userdata, msg):
    print('? ESP sensor2 data:', msg.payload.decode('utf-8'))

def callback_rpi_broadcast(client, userdata, msg):
    print('? RPi Broadcast message:', msg.payload.decode('utf-8'))

def client_subscriptions(client):
    client.subscribe("esp32/#")
    client.subscribe("rpi/broadcast")

def loading():
    global client, flag_connected, counter

    flag_connected = 0
    counter = 0

    client = mqtt.Client("rpi_client1")
    client.username_pw_set("modelltisch1", "strukturwandel")  # Username & Passwort VOR connect setzen

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.message_callback_add('esp32/sensor1', callback_esp32_sensor1)
    client.message_callback_add('esp32/sensor2', callback_esp32_sensor2)
    client.message_callback_add('rpi/broadcast', callback_rpi_broadcast)

    try:
        client.connect("127.0.0.1", 1883)
    except Exception as e:
        print(f"! MQTT connection failed: {e}")
        exit(1)

    client.loop_start()
    print("? ......client setup complete............")

def send(message):
    global client, counter, flag_connected

    if flag_connected != 1:
        print("? Not connected to MQTT server. Cannot send message.")
        return

    try:
        client.publish("rpi/broadcast", f"{message} #{counter}")
        print(f"? Published: {message} #{counter}")
        counter += 1
    except Exception as e:
        print(f"! Failed to publish MQTT message: {e}")

# Beispiel: So rufst du das auf
if __name__ == "__main__":
    loading()
    time.sleep(2)  # Zeit zum Verbinden
    #send("Hello MQTT!")
    time.sleep(5)  # Zeit um Nachrichten zu senden bevor das Programm beendet wird
