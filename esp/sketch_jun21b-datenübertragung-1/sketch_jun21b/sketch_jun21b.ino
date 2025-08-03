#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "Fritz-Box-SG";
const char* password = "floppy1905Frettchen";
const char* mqtt_server = "192.168.178.46";

WiFiClient espClient;
PubSubClient client(espClient);

long lastMsg = 0;
#define ledPin 2

void blink_led(unsigned int times, unsigned int duration){
  for (int i = 0; i < times; i++) {
    digitalWrite(ledPin, HIGH);
    delay(duration);
    digitalWrite(ledPin, LOW); 
    delay(200);
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("🔌 Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int c = 0;
  while (WiFi.status() != WL_CONNECTED) {
    blink_led(2, 200);
    delay(1000);
    Serial.print(".");
    c++;
    if (c > 15) {
      Serial.println("❌ WiFi connection timeout – restarting...");
      ESP.restart();
    }
  }

  Serial.println("");
  Serial.println("✅ WiFi connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void connect_mqttServer() {
  while (!client.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      setup_wifi();
    }

    Serial.print("🔄 Attempting MQTT connection... ");
    if (client.connect("ESP32_Client_1","modelltisch1","strukturwandel")) {
      Serial.println("✅ connected!");
      client.subscribe("rpi/broadcast");
    } else {
      Serial.print("❌ failed, rc=");
      Serial.print(client.state());
      Serial.println(" trying again in 2 seconds");
      blink_led(3, 150);
      delay(2000);
    }
  }
}

void callback(char* topic, byte* message, unsigned int length) {
  //Serial.print("📨 Message arrived on topic: ");
  //Serial.println(topic);

  String msg;
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  Serial.println("📨 Message arrived: " + msg);

  if (String(topic) == "rpi/broadcast") {
    if (msg == "10") {
      Serial.println("💡 Action: Blink LED");
      blink_led(1, 1000);
    }
  }
}

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(115200);
  randomSeed(analogRead(0)); // Initialisierung für Zufallszahlen
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    connect_mqttServer();
  }

  client.loop();

  long now = millis();
  if (now - lastMsg > 1000) {
    lastMsg = now;

    int sensorValue = random(50, 101); // Zufallswert von 50 bis 100
    String msg = String(sensorValue);
    Serial.print("📤 Sending sensor1 value: ");
    Serial.println(msg);
    client.publish("esp32/sensor1", msg.c_str());
  }
}
