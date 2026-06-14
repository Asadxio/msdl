# User Roles & Permissions Matrix

| Capability | Student | Teacher | Assistant teacher | Moderator | Admin | Super admin |
|---|---:|---:|---:|---:|---:|---:|
| Sign in after approval | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read own profile/payment/progress | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own push/profile metadata | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Browse eligible courses/library/teachers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit quiz/progress/submissions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Join eligible live classes/calls | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create teacher status/live class | ❌ | ✅ | ✅* | ✅* | ✅ | ✅ |
| Mark attendance | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderate live class participants | ❌ | own/assigned | own/assigned | ✅* | ✅ | ✅ |
| Read/respond to moderation reports | own reports only | own reports only | own reports only | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assign admin/super_admin roles | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage academic content/library | ❌ | limited audio own | limited audio own | ❌ | ✅ | ✅ |
| Review payments | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View analytics/security/privacy admin screens | ❌ | ❌ | ❌ | limited moderation | ✅ | ✅ |
| Send global/broadcast push | ❌ | limited | limited | ❌ | ✅ | ✅ |

`*` Rules include moderator in `isTeacherOrAdmin()` for some operational reads/writes; UI should still hide unrelated teacher functions unless intentionally enabled.
