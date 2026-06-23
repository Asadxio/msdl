import requests

url = "https://msdl-production-9afb.up.railway.app/api/live-class/token"
response = requests.post(url, json={"live_class_id": "test"}, headers={"Authorization": "Bearer invalid_token"})

print(f"Status: {response.status_code}")
print(response.json())
