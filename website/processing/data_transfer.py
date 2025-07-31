import paho.mqtt.client as mqtt
from paho.mqtt import client as mqtt_client
#from paho.mqtt.client import CallbackAPIVersion


import time

# Global variables
client = None
flag_connected = 0
counter = 0

def on_connect(client, userdata, flags, reasonCode, properties):
    global flag_connected
    flag_connected = 1
    client_subscriptions(client)
    print("? Connected to MQTT server")


def on_disconnect(client, userdata, reasonCode, properties):
    global flag_connected
    flag_connected = 0
    print("? Disconnected from MQTT server")


# Callback functions for each topic
def callback_esp32_sensor1(client, userdata, msg):
    print('? ESP sensor1 data:', msg.payload.decode('utf-8'))

def callback_esp32_sensor2(client, userdata, msg):
    print('? ESP sensor2 data:', msg.payload.decode('utf-8'))

def callback_rpi_broadcast(client, userdata, msg):
    print('? RPi Broadcast message:', msg.payload.decode('utf-8'))

def client_subscriptions(client):
    client.subscribe("esp32/#")
    client.subscribe("rpi/broadcast")

#global client, counter, flag_connected

# Korrekte Initialisierung für paho-mqtt 2.x
    
#client = mqtt.Client("rpi_client1")
client = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION2, "rpi_client1")

def loading():
    flag_connected = 0
    counter = 0

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.message_callback_add('esp32/sensor1', callback_esp32_sensor1)
    client.message_callback_add('esp32/sensor2', callback_esp32_sensor2)
    client.message_callback_add('rpi/broadcast', callback_rpi_broadcast)

    try:
        client.connect('127.0.0.1', 1883)
    except Exception as e:
        print(f"! MQTT connection failed: {e}")
        exit(1)  # oder return, wenn in Funktion

    client.loop_start()  # <- muss immer gestartet werden, damit callbacks funktionieren
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

# Initialisieren und Nachricht senden
#loading()
#time.sleep(1)  # kurz warten bis MQTT verbunden ist

