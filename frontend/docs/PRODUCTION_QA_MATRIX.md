# Production QA Matrix (Expo + Firebase + Agora)

## Test scope

Run this matrix only after install/lint/typecheck/build baseline is green.

| Area | Scenario | Android | iOS | Pass Criteria | Evidence |
|---|---|---:|---:|---|---|
| Auth | Login/logout session recovery | ☐ | ☐ | No stale session, navigation stable | Video + logs |
| Realtime | Firestore listener cleanup on screen exit | ☐ | ☐ | No duplicate updates after re-entry | Debug logs |
| Realtime | Background → foreground state re-sync | ☐ | ☐ | State refreshes once, no loop | Video + logs |
| Agora | Join/leave call repeatedly (10 cycles) | ☐ | ☐ | No leaked participants or stuck engine | Memory + logs |
| Agora | Network drop/reconnect mid-session | ☐ | ☐ | Reconnect recovers media and UI state | Video + logs |
| Agora | App background/resume during active call | ☐ | ☐ | Media restores, no black screen/audio loss | Video + logs |
| Audio | Speaker/earpiece switch during call | ☐ | ☐ | Correct route change each time | Video |
| Audio | Bluetooth headset connect/disconnect | ☐ | ☐ | Route follows device changes without crash | Video |
| Uploads | Assignment/file upload success + retry | ☐ | ☐ | Progress updates, metadata persisted | DB snapshot |
| Uploads | Invalid/empty/oversize file handling | ☐ | ☐ | User-safe error, no partial writes | Video + logs |
| Notifications | Push token registration + receipt | ☐ | ☐ | Token saved, notification opens target screen | Logs |
| Attendance | Live attendance sync under reconnect | ☐ | ☐ | Single attendance record per user/session | DB query |
| Recordings | Recording metadata create/read path | ☐ | ☐ | Recording appears in UI and DB consistently | Screenshot + DB |
| Low network | 2G/packet loss profile | ☐ | ☐ | Graceful retry states, no infinite spinner | Video |
| Stability | 45+ minute session memory behavior | ☐ | ☐ | No OOM, no degraded UI responsiveness | Perf capture |

## Execution notes

- Use at least 2 Android models + 2 iOS models with different OS versions.
- Include one low-memory Android device and one older iPhone baseline.
- Capture logs for every failed case, including timestamps and screen names.
