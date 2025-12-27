#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

Servo servo;
WebServer server(80);

// ---- CONFIGURA LA TUA WIFI ----
const char* ssid = "TIM-29033219";
const char* password = "Jm5OgoQustxqNZ7N75FhZ6i0";

void handleServo() {
  Serial.println("Comando ricevuto: muovi servo");

  servo.write(180);
  delay(5000);      // 5 secondi
  servo.write(0);

  server.send(200, "text/plain", "Servo attivato");
}

void setup() {
  Serial.begin(115200);
  while(!Serial);

  servo.attach(25);

  // --- AVVIO WIFI ---
  WiFi.begin(ssid, password);
  Serial.println("Connessione alla WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.println(".");
  }
  Serial.println("\nConnesso!");
  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());

  // --- ENDPOINT ---
  server.on("/servo", handleServo);

  server.begin();
}

void loop() {
  server.handleClient();
}
