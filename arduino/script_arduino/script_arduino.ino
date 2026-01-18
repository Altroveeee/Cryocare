#include <WiFi.h>
// #include <WebServer.h>
#include <ESP32Servo.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

Servo servo;
WebServer server(80);

// ---- CONFIGURA LA TUA WIFI ----
const char* ssid = "TIM-29033219";
const char* password = "Jm5OgoQustxqNZ7N75FhZ6i0";

const char* firebase_api_key = "AIzaSyDm_V5mxoagUzTBZPc7COPWz_iw_X_ADdM";
const char* firebase_database_url = "https://cryocare-8f6e4-default-rtdb.europe-west1.firebasedatabase.app/";

// Define Firebase Data objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;
String triggerPath = "/device/trigger";

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
  // server.on("/servo", handleServo);

  // server.begin();

  // Assign the api key (required)
  config.api_key = API_KEY;
  // Assign the RTDB URL (required)
  config.database_url = DATABASE_URL;

  // Sign up anonymously
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("ok");
    signupOK = true;
  } else {
    Serial.printf("%s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Set the trigger to false initially to be safe
  if (signupOK) {
     Firebase.RTDB.setBool(&fbdo, triggerPath, false);
  }
}

void loop() {
  // server.handleClient();

  if (Firebase.ready() && signupOK) {
    
    // 1. READ the Trigger Status
    if (Firebase.RTDB.getBool(&fbdo, triggerPath)) {
      if (fbdo.dataType() == "boolean") {
        bool shouldRun = fbdo.boolData();

        // 2. IF TRIGGER IS TRUE -> DO THE TASK
        if (shouldRun == true) {
          Serial.println("Trigger received! Starting Task...");

          handleServo();

          Serial.println("Task Finished. Resetting Trigger.");

          // 3. RESET TRIGGER TO FALSE (The Handshake)
          // This stops it from running again until the webapp is clicked again
          if (Firebase.RTDB.setBool(&fbdo, triggerPath, false)) {
            Serial.println("System Ready for next command.");
          } else {
            Serial.println("Failed to reset trigger (Check internet connection)");
          }
        }
      }
    } else {
      // Failed to get data (Print error reason)
      Serial.println(fbdo.errorReason());
    }
  }
  
  // Add a small delay to avoid spamming the database
  delay(1000);
}
