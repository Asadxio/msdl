import firebase_admin
from firebase_admin import credentials, firestore

firebase_admin.initialize_app()
db = firestore.client()

users = db.collection("users").get()
c = 0
t = 0
for u in users:
    d = u.to_dict() or {}
    tk = d.get("expo_push_tokens") or []
    if tk:
        c += 1
        t += len(tk)

print(f"Users with tokens: {c}, Total tokens: {t}")
