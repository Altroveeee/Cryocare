#include <ESP32Servo.h>

Servo servo;

void setup() {
  Serial.begin(115200);
  while(!Serial);
  servo.attach(25);

  Serial.println("Posizione iniziale del servo: 0");
  servo.write(0); // Posizione iniziale
}

void loop() {
  Serial.println("Muovo il servo a 180 gradi");
  servo.write(180);
  delay(2000); // Attendi 2 secondi

  Serial.println("Riporto il servo a 0 gradi");
  servo.write(0);
  delay(2000); // Attendi 2 secondi
}