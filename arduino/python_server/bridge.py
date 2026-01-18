import time
import requests
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db

# --- CONFIGURATION ---
CREDENTIAL_PATH = "serviceAccountKey.json"
DATABASE_URL = "https://cryocare-46397-default-rtdb.europe-west1.firebasedatabase.app"
TARGET_URL = "http://192.168.1.118/servo"
TRIGGER_FIELD_PATH = 'device/trigger' 
# ---------------------

def initialize_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(CREDENTIAL_PATH)
        firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})
        print("✅ Connected to Firebase.")

def on_snapshot(event):
    """
    This function runs automatically whenever data at the path changes.
    """
    current_value = event.data

    # Only act if value is explicitly True
    if current_value is True:
        print("\n⚡ Trigger detected (Value became True).")
        
        # 1. Send the Ping with a 10-second timeout
        try:
            # timeout=10 means it will wait 10 seconds for a response before giving up
            response = requests.get(TARGET_URL, timeout=10)
            print(f"   -> Ping Sent! Status: {response.status_code}")
        except requests.exceptions.Timeout:
            print("   -> Ping Failed: Request timed out after 10 seconds.")
        except requests.exceptions.RequestException as e:
            # Catches other connection errors (e.g., device offline)
            print(f"   -> Ping Failed: {e}")
        except Exception as e:
            print(f"   -> Unexpected Error: {e}")

        # 2. Reset the field to False regardless of success/failure
        try:
            ref = db.reference(TRIGGER_FIELD_PATH)
            ref.set(False)
            print("   -> Database field reset to False.")
        except Exception as e:
            print(f"   -> Failed to reset Firebase field: {e}")
        
    elif current_value is False:
        print(f"   (System returned to idle state: {TRIGGER_FIELD_PATH} is False)")

def start_listening():
    ref = db.reference(TRIGGER_FIELD_PATH)
    
    print(f"🎧 Listening for changes on '{TRIGGER_FIELD_PATH}'...")
    ref.listen(on_snapshot)

    # Keep the main thread alive indefinitely
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping listener...")

if __name__ == "__main__":
    initialize_firebase()
    start_listening()