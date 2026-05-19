# Phase 7 AI Opportunity + Safety Report

## AI opportunity map
- Moderation triage assistance with confidence + priority ranking.
- LMS lesson/quiz assistive summarization and explanation drafts.
- Operational insight summaries for admins from aggregated metrics.

## Hallucination risk analysis
- High-risk domains: moderation enforcement and grading authority.
- Mitigation: AI outputs are assistive-only and never auto-enforce.

## AI safety classification
- **Critical**: moderation actions (human authority required).
- **High**: LMS educational guidance (must avoid answer leakage/cheating).
- **Medium**: operational insight summarization.

## Inference cost analysis
- Cached moderation classification to reduce duplicate costs.
- Lightweight deterministic fallback summarizers for degraded mode.
- Feature-gated frontend requests to avoid uncontrolled inference spam.

## Rollout priority matrix
1. Moderation assistance (internal moderator-only).
2. LMS summaries/explanations (student/teacher optional).
3. Ops insight summaries (admin dashboard optional).
