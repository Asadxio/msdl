# MSLB Historical Archived Scripts

This directory contains historical, one-off migration, seeding, and diagnostic scripts that were previously stored in the repository root.

## Script Catalog & Safety Classification

| Script Name | Original Purpose | Why Archived | Safety Status |
| :--- | :--- | :--- | :---: |
| audit.py / audit_assets.py | Initial repository asset & code audit | Replaced by automated Phase audits | Safe to read; Do not run in prod |
| check_storage.py | Storage bucket connectivity check | Replaced by Firebase Admin SDK in Functions | Safe to read; Read-only |
| check_categories.py / check_live_classes.py | Firestore schema inspection during initial setup | One-off manual inspection tool | Safe to read; Read-only |
| clean_quizzes.js / audit_quizzes.js | One-off quiz formatting normalization | Replaced by functions/src/quiz/ | DO NOT RUN (Data mutation) |
| import_quizzes.py / import_quizzes.js / insert_quizzes.js | Initial quiz seeding scripts | Initial dataset has already been seeded | DO NOT RUN (Duplicate insertion risk) |
| replace_quiz.js / replace.js / reset_curriculum.js | Curriculum reset utilities | Initial development only | DANGEROUS (Destructive reset) |
| reset_production.js | Complete production wipe & reset tool | Initial development only | DANGEROUS (DO NOT EXECUTE) |
| fix_last_seen.py / patch_chat.py / patch_styles.py | One-off bugfix patches for legacy chat | Fixed permanently in React Native components | Obsolete |
| print_first_5.js / test_token.py / wait_for_health.py | Local debugging helpers | Superseded by test suites | Obsolete |

---
NOTE: None of the scripts in this directory should be executed in production. They are retained strictly for archival history and audit traceability.