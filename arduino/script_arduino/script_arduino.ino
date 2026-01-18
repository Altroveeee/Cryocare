#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

Servo servo;
WebServer server(80);

// ---- CONFIGURA LA TUA WIFI ----
const char* ssid = "TIM-29033219";
const char* password = "Jm5OgoQustxqNZ7N75FhZ6i0";

// Static IP configuration
IPAddress staticIP(192, 168, 1, 118); // ESP32 static IP
IPAddress gateway(192, 168, 1, 1);    // IP Address of your network gateway (router)
IPAddress subnet(255, 255, 255, 0);   // Subnet mask
IPAddress primaryDNS(192, 168, 1, 1); // Primary DNS (optional)
IPAddress secondaryDNS(0, 0, 0, 0);   // Secondary DNS (optional)

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

  // Configuring static IP
  Serial.println("Configuring static IP");
  if(!WiFi.config(staticIP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("Failed to configure Static IP");
  } else {
    Serial.println("Static IP configured!");
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
