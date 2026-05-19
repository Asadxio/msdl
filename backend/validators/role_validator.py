APP_ROLES = {'super_admin','admin','moderator','teacher','assistant_teacher','student'}


def normalize_role(role: str | None) -> str:
    r = str(role or '').strip().lower()
    return r if r in APP_ROLES else 'student'
