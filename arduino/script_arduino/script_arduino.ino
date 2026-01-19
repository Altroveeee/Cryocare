#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

Servo servo;
WebServer server(80);

// ---- CONFIGURA LA TUA WIFI ----
// COMMENTA LA SEZIONE CHE NON USI

// // Home WiFi settings
// const char* ssid = "TIM-29033219";
// const char* password = "Jm5OgoQustxqNZ7N75FhZ6i0";

// // Static IP configuration
// IPAddress staticIP(192, 168, 1, 118); // ESP32 static IP
// IPAddress gateway(192, 168, 1, 1);    // IP Address of your network gateway (router)
// IPAddress subnet(255, 255, 255, 0);   // Subnet mask
// IPAddress primaryDNS(192, 168, 1, 1); // Primary DNS (optional)
// IPAddress secondaryDNS(0, 0, 0, 0);   // Secondary DNS (optional)

// // Iphone Hotspot settings
const char* ssid = "gaiasiphone";
const char* password = "heissspot";

// Static IP configuration for iPhone Hotspot
// Note: iPhone hotspot allows a very small range of IPs (usually .2 to .14)
IPAddress staticIP(172, 20, 10, 4);      // Selected IP (Must be between 2 and 14)
IPAddress gateway(172, 20, 10, 1);       // iPhone Default Gateway
IPAddress subnet(255, 255, 255, 240);    // iPhone uses a /28 subnet (Important!)
IPAddress primaryDNS(172, 20, 10, 1);    // Point DNS to the gateway
IPAddress secondaryDNS(8, 8, 8, 8);      // Optional: Google DNS as backup

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
