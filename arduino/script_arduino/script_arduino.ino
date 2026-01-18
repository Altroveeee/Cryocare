#include <WiFi.h>
// #include <WebServer.h>
#include <ESP32Servo.h>
#include <FirebaseClient.h>

Servo servo;
// WebServer server(80);

// ---- CONFIGURA LA TUA WIFI ----
const char* ssid = "TIM-29033219";
const char* password = "Jm5OgoQustxqNZ7N75FhZ6i0";

#define API_KEY "AIzaSyDm_V5mxoagUzTBZPc7COPWz_iw_X_ADdM"
#define USER_EMAIL "crmgrl57@gmail.com"
#define USER_PASSWORD "crmgrl05072001"
#define DATABASE_URL "https://cryocare-8f6e4-default-rtdb.europe-west1.firebasedatabase.app/"

SSL_CLIENT ssl_client;

using AsyncClient = AsyncClientClass;
AsyncClient aClient(ssl_client);

UserAuth user_auth(API_KEY, USER_EMAIL, USER_PASSWORD, 3000 /* expire period in seconds (<3600) */);
FirebaseApp app;
RealtimeDatabase Database;
AsyncResult databaseResult;

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
  Firebase.printf("Firebase Client v%s\n", FIREBASE_CLIENT_VERSION);

  set_ssl_client_insecure_and_buffer(ssl_client);

  Serial.println("Initializing app...");
  initializeApp(aClient, app, getAuth(user_auth), auth_debug_print, "🔐 authTask");

  // Or intialize the app and wait.
  // initializeApp(aClient, app, getAuth(user_auth), 120 * 1000, auth_debug_print);

  app.getApp<RealtimeDatabase>(Database);

  Database.url(DATABASE_URL);
}

void loop() {
  // server.handleClient();
  app.loop();
  if (app.ready()) {
    
    // 1. READ the Trigger Status
    bool res = Database.get<bool>(aClient, triggerPath);
    if (res) {
      Serial.println("Trigger received! Starting Task...");

      handleServo();

      Serial.println("Task Finished. Resetting Trigger.");

      // 3. RESET TRIGGER TO FALSE (The Handshake)
      // This stops it from running again until the webapp is clicked again
      Database.set<bool>(aClient, triggerPath, false, processData, "setBoolTask");
    }
  }
  
  // Add a small delay to avoid spamming the database
  delay(1000);
}
