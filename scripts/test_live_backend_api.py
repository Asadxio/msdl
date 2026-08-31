import urllib.request, json

BASE_URL = "https://msdl-production-9afb.up.railway.app/api"

def check_endpoint(endpoint):
    url = f"{BASE_URL}{endpoint}"
    print(f"\n--- Checking Endpoint: {url} ---")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8")
            print(f"HTTP {resp.status}")
            try:
                parsed = json.loads(data)
                print("Response Body:", json.dumps(parsed, indent=2)[:500])
            except:
                print("Response Text:", data[:300])
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        try:
            print("Error Body:", e.read().decode("utf-8")[:300])
        except: pass
    except Exception as e:
        print("Error:", e)

check_endpoint("/health")
check_endpoint("/quizzes")
check_endpoint("/courses")
check_endpoint("/payments/create-order")
check_endpoint("/push/send")
