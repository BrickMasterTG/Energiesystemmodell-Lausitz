const int buttonPin = 21;  // Dein Taster-Pin
const int ledPin = 3;     // Optional: LED zum Anzeigen

void setup() {
  Serial.begin(115200);              // Serieller Monitor starten
  pinMode(buttonPin, INPUT_PULLUP);  // Taster mit internem Pullup
  pinMode(ledPin, OUTPUT);           // LED als Ausgang
}

void loop() {
  int buttonState = digitalRead(buttonPin);

  if (buttonState == LOW) {
    Serial.println("Button gedrückt");
    digitalWrite(ledPin, HIGH);  // LED an
  } else {
    Serial.println("Button losgelassen");
    digitalWrite(ledPin, LOW);   // LED aus
  }

  delay(200);  // Kurze Pause zur besseren Lesbarkeit
}
