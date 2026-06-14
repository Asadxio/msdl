# Future Improvement Suggestions

1. Generate Firestore TypeScript types and backend Pydantic models from a shared schema.
2. Add full Firebase Emulator integration tests for users, payments, live classes, chat, learning, and moderation rules.
3. Split FastAPI routes into domain routers: auth/users, live, calls, push, payments, analytics, AI, jobs.
4. Add OpenAPI examples and publish API docs with CI.
5. Add admin audit dashboards for role changes, payment decisions, moderation decisions, and security events.
6. Add in-app diagnostics for push token health and live class connection quality.
7. Add content versioning for courses/modules/lessons/quizzes.
8. Implement stronger certificate verification with public certificate IDs/QR verification.
9. Add privacy export/delete automation workflows.
10. Add queue dashboards for async jobs, dead letters, retries, leases, and provider circuit breakers.
11. Improve offline support for learning content, progress sync, and chat message retry.
12. Add automated dependency update checks tied to Expo SDK compatibility.
13. Reduce duplicate chat collections once all clients use a single message collection.
14. Add analytics privacy classification and event governance.
15. Create onboarding/admin training docs from this technical documentation set.
