
def get_experiment(firebase_db, experiment_id: str) -> dict:
    if firebase_db is None or not experiment_id:
        return {}
    snap = firebase_db.collection('notification_routing_experiments').document(experiment_id).get()
    return snap.to_dict() or {}


def apply_experiment_weights(base_weights: dict[str, float], experiment: dict) -> dict[str, float]:
    if not experiment or experiment.get('enabled') is not True:
        return base_weights
    overrides = experiment.get('provider_weight_overrides') or {}
    out = dict(base_weights)
    for p, w in overrides.items():
        out[str(p)] = float(w)
    return out
