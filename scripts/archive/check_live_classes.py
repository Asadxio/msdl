import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.Certificate('serviceAccountKey.json')
    app = firebase_admin.initialize_app(cred)
except ValueError:
    app = firebase_admin.get_app()

db = firestore.client()
classes = db.collection('live_classes').get()

print(f"Total live classes found: {len(classes)}")
for c in classes:
    data = c.to_dict()
    print(f"ID: {c.id}, Course: {data.get('course_id')}, Status: {data.get('status')}")
