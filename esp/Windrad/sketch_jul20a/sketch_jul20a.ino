const int ledPins[] = {26, 27};
const int motorPin = 22;
const int buttonPin = 21;

bool isRunning = false;
bool lastStableButtonState = HIGH;
bool lastReadButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

const unsigned long blinkOnTime = 300;
const unsigned long blinkOffTime = 1000;

unsigned long lastBlinkTime = 0;
bool ledState = false;

void setup() {
  Serial.begin(115200);

  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(motorPin, OUTPUT);
  digitalWrite(motorPin, LOW);

  for (int i = 0; i < sizeof(ledPins) / sizeof(ledPins[0]); i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
}

void loop() {
  // --- Button-Handling ---
  bool reading = digitalRead(buttonPin);

  if (reading != lastReadButtonState) {
    lastDebounceTime = millis();  // reset debounce timer
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != lastStableButtonState) {
      lastStableButtonState = reading;

      if (reading == LOW) {
        // nur bei Wechsel auf gedrückt
        isRunning = !isRunning;
        Serial.println(isRunning ? "Anlage EIN" : "Anlage AUS");
      }
    }
  }

  lastReadButtonState = reading;

  // --- Windradsteuerung ---
  if (isRunning) {
    digitalWrite(motorPin, HIGH);

    // Synchrones Blinken
    unsigned long now = millis();
    unsigned long interval = ledState ? blinkOnTime : blinkOffTime;

    if (now - lastBlinkTime >= interval) {
      lastBlinkTime = now;
      ledState = !ledState;

      for (int i = 0; i < sizeof(ledPins) / sizeof(ledPins[0]); i++) {
        digitalWrite(ledPins[i], ledState ? HIGH : LOW);
      }
    }

  } else {
    // Alles aus
    digitalWrite(motorPin, LOW);
    for (int i = 0; i < sizeof(ledPins) / sizeof(ledPins[0]); i++) {
      digitalWrite(ledPins[i], LOW);
    }
  }
}
