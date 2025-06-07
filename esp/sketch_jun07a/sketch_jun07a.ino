// Pin-Definition für die LED
const int ledPin = 23; // GPIO 2 (oft auch die eingebaute LED beim ESP32)

void setup() {
  // LED-Pin als Ausgang definieren
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH); // LED einschalten
  delay(500);                 // 500 Millisekunden warten
  digitalWrite(ledPin, LOW);  // LED ausschalten
  delay(500);                 // 500 Millisekunden warten
}
