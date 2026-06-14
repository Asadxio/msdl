# Environment Variables Documentation

## Frontend (`frontend/.env.example`)
| Variable | Required | Purpose |
|---|---:|---|
| `EXPO_PUBLIC_APP_ENV` | yes | `development`, `staging`, or `production`; controls environment config. |
| `EXPO_PUBLIC_API_BASE_URL` | yes | Backend API origin or `/api` URL; app normalizes either form. |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | yes | Firebase project id used by release checks/config. |
| `EXPO_PUBLIC_LIVE_API_URL` | optional | Live class backend base URL if different from API URL. |
| `EXPO_PUBLIC_PUSH_API_URL` | optional | Push backend base URL if different from API URL. |
| `EXPO_PUBLIC_AGORA_APP_ID` | optional | Agora app id; safer to rely on token endpoint when possible. |

## Backend (`backend/.env.example`)
| Variable | Required | Purpose |
|---|---:|---|
| `MONGO_URL` | legacy/status required | MongoDB connection for status checks. |
| `DB_NAME` | legacy/status required | Mongo database name. |
| `CORS_ALLOW_ORIGINS` | production yes | Comma-separated allowed origins. |
| `CORS_ALLOW_METHODS` | yes | Allowed HTTP methods. |
| `CORS_ALLOW_HEADERS` | yes | Allowed request headers. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | production yes | Firebase Admin service account JSON. |
| `GOOGLE_APPLICATION_CREDENTIALS` | alternative | Path to service account file for local/non-Railway. |
| `AGORA_APP_ID` | live classes yes | Agora app id. |
| `AGORA_APP_CERTIFICATE` | live classes yes | Agora certificate for token generation. |
| `AGORA_RTC_TOKEN_TTL_SECONDS` | recommended | RTC token lifetime. |
| `AGORA_CUSTOMER_ID` / `AGORA_CUSTOMER_SECRET` | recording yes | Agora cloud recording credentials. |
| `AGORA_RECORDING_*` | recording yes | Cloud recording UID/storage vendor/region/bucket/access keys. |

## Operational guidance
- Never commit production secrets.
- Use Railway/Firebase secret managers for backend values.
- Expo public values are embedded in client bundles and must not contain secrets.
