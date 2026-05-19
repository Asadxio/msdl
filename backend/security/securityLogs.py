import time
from observability import log_structured_event, record_failure_event

def log_security_event(firebase_db, logger, event: str, payload: dict):
    record = {
        'event': event,
        'payload': payload,
        'created_at_ms': int(time.time() * 1000),
    }
    logger.warning('SECURITY_EVENT %s %s', event, payload)
    log_structured_event("security_event", "security", "warn", metadata={"event": event, "payload": payload})
    if "abuse" in str(event).lower() or "denied" in str(event).lower():
        record_failure_event("abuse_security", "warn", retryable=False, recoverable=True, metadata={"event": event})
    if firebase_db is not None:
        firebase_db.collection('security_events_immutable').add(record)
