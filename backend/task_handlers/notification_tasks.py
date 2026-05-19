from services.fanout_worker import process_queue_once


def handle_notification_delivery(firebase_db, logger, payload: dict) -> dict:
    return process_queue_once(firebase_db, logger)
