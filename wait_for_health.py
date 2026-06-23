import time
import requests

url = "https://msdl-production-9afb.up.railway.app/health"
print(f"Waiting for {url} to become healthy...")

start = time.time()
while time.time() - start < 300: # Wait up to 5 minutes
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print("Backend is healthy!")
            print(response.json())
            break
        else:
            print(f"Status code: {response.status_code}, Retrying...")
    except Exception as e:
        print(f"Error: {type(e).__name__}, Retrying...")
    time.sleep(5)
else:
    print("Timeout waiting for backend to become healthy.")
