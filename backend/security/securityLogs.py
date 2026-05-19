import time

def log_security_event(firebase_db, logger, event: str, payload: dict):
    record = {
        'event': event,
        'payload': payload,
        'created_at_ms': int(time.time() * 1000),
    }
    logger.warning('SECURITY_EVENT %s %s', event, payload)
    if firebase_db is not None:
        firebase_db.collection('security_events_immutable').add(record)
