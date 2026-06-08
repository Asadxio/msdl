# Email Deliverability & Firebase Auth Audit

Audit date: 2026-06-08

## Executive scores

- **Deliverability score: 62/100.** The app uses Firebase Auth's default verification flow successfully, but the codebase does not define custom `ActionCodeSettings`, a custom sending domain, a verified reply-to address, or a branded verification template that can be reviewed in source control.
- **Spam-risk score: 38/100.** The app copy itself is low-risk, but shared/default Firebase sender reputation, incomplete sender branding, and limited delivery telemetry create moderate Spam/Junk risk.
- **Production sufficiency:** Firebase Auth emails are acceptable for early production or low-volume transactional verification if the Firebase Console template is fully branded and the sender/reply-to settings are correct. They are not ideal for mature production deliverability because Firebase Auth does not provide per-message delivery, bounce, open, complaint, or mailbox-provider placement events.
- **Migration recommendation:** Recommended once signups are material to business outcomes, once support tickets cite missing verification emails, or once custom domain reputation/monitoring is required.

## Firebase configuration findings

| Area | Finding | Risk | Recommendation |
| --- | --- | --- | --- |
| Email verification send call | The app calls `sendEmailVerification(cred.user)` during signup and `sendEmailVerification(auth.currentUser)` during resend. No custom `ActionCodeSettings` are passed. | Medium | Add a reviewed action settings object when the desired continue URL, deep link, and authorized domain are finalized. Keep it aligned with Firebase Authorized domains and any mobile action handler. |
| Authorized domains | The repository exposes `authDomain: "madrasa-app-50d6c.firebaseapp.com"`, but Firebase Console Authorized domains cannot be fully audited from this repository. | Medium | In Firebase Console, verify only approved domains are authorized: Firebase hosting domain, production web domain, development localhost entries only if needed, and no stale preview domains. |
| Sender address | Source control does not contain the Firebase Console sender address. If unchanged, Firebase commonly sends from a project-scoped no-reply Firebase domain; the UX now tells users to search for `noreply@madrasa-app-50d6c.firebaseapp.com`. | Medium | Prefer a verified branded sender such as `Madrasa <no-reply@yourdomain.com>` with SPF, DKIM, and DMARC aligned if Firebase Console / Identity Platform custom sender support is configured. |
| Reply-to address | Source control does not contain a configured reply-to address. | Low-Medium | Configure a monitored reply-to/support mailbox in Firebase Console so users can recognize the sender and support can receive misdirected replies. |
| Verification template | Firebase Console templates are not stored in this repo, so the exact subject/body cannot be verified here. | Medium | Use a short branded subject and body; avoid urgency, all-caps, and multiple links. Include the app name, recipient context, and one clear verification CTA. |
| Custom domain for auth emails | No custom authentication email domain is visible in source control. | Medium | Use a custom auth email domain where possible so links and sender identity look related to the app rather than a generic Firebase project domain. |
| Monitoring | Before this audit, app analytics did not include verification-specific attempts or verification completion estimates. | Medium | Added client-side events for delivery attempts, estimated opens, and estimated link-click/completion. Dedicated ESP webhooks are still needed for true delivery and open/click tracking. |

## Verification email template review

The actual Firebase Auth email template is configured in Firebase Console and is not available in this repository. Review it manually against this checklist:

### Recommended subject lines

- `Verify your Madrasa email address`
- `Confirm your email for Madrasa`
- `Madrasa account verification`

### Avoid

- Excessive capitalization: `VERIFY YOUR EMAIL NOW`
- Urgent/spammy terms: `free`, `winner`, `act now`, `limited time`, `urgent`, repeated exclamation marks, money/prize language
- Vague identity: `Verify your account` without the app name
- Long subjects with timestamps unless Firebase requires them for threading behavior

### Recommended body

- Open with clear branding: `You created a Madrasa account using %EMAIL%.`
- Use one primary CTA: `Verify email address`.
- Include one fallback link only if Firebase supports it cleanly.
- Add safety copy: `If you did not create this account, you can ignore this email.`
- Keep the footer simple with app/support identity.

## Deliverability analysis

### Likely reasons for Spam/Junk/Promotions/Updates placement

1. **Shared/default sender reputation.** Default Firebase sender domains are convenient but do not give the app direct control over sender reputation, dedicated monitoring, bounce handling, or mailbox-provider feedback loops.
2. **Weak brand recognition.** Users may overlook an email if it appears to come from Firebase/no-reply instead of Madrasa or a known domain.
3. **Domain/link mismatch.** If the From domain, action-link domain, and app brand do not align, providers and users may trust the email less.
4. **Template not visibly app-specific.** Generic verification copy can be treated as lower-priority or ignored by users.
5. **User engagement.** New domains or low-volume transactional streams may have little positive engagement history.
6. **Mailbox tabs/categories.** Gmail can place transactional messages in Updates; brand-like HTML can drift toward Promotions.
7. **Rate-limit behavior.** Repeated user clicks on resend can trigger Firebase throttling and make users think delivery failed.

### Mailbox-provider risk estimate

| Provider | Risk | Notes |
| --- | --- | --- |
| Gmail | Medium | Often accepts Firebase Auth messages, but may categorize into Updates/Promotions. User recognition is the main risk. |
| Outlook/Hotmail | Medium-High | More sensitive to sender reputation, authentication alignment, and shared IP/domain reputation. |
| Yahoo/AOL | Medium | Reputation and user engagement matter; messages can land in Spam if sender identity is generic. |
| iCloud | Medium-High | Can be strict with authentication and reputation; users often report silent filtering or Junk placement for unfamiliar senders. |

## UX improvements implemented

- The pending verification screen now shows the recipient email address and opens a `mailto:` link if tapped.
- The screen now instructs users to search for the sender address, open Spam/Junk, and check Gmail Promotions/Updates.
- The resend success alert now includes the target email and folders to check.
- The UI uses the inferred Firebase sender address `noreply@madrasa-app-50d6c.firebaseapp.com`; update this constant if the Firebase Console sender address differs.

## Resend logic audit

### Previous behavior

- Resend was available immediately and repeatedly from the pending screen.
- Firebase's server-side `auth/too-many-requests` error was handled, but the app had no client cooldown or daily cap.

### Implemented behavior

- Added a **60-second client-side cooldown** between verification resend requests per user.
- Added a **5 verification-email sends/day client-side cap** per user, counting the initial signup email when it is sent from this client.
- Firebase server-side rate limiting remains the authoritative backstop.
- Blocked attempts and successful attempts are tracked with the same analytics event and a status payload.

### Residual risks

- Client-side limits can be bypassed by clearing local storage or using another device.
- For stronger abuse protection, move resend orchestration to a backend endpoint that verifies auth, stores counters in Firestore/Redis, and generates/sends links server-side.

## Delivery monitoring

### Implemented app analytics events

- `verification_email_delivery_attempt`
  - Emitted for signup send requests, signup send success/error, resend request, resend success/error, cooldown-blocked, and daily-limit-blocked states.
- `verification_email_open_estimated`
  - Emitted when an unverified user views the pending verification screen with an email address.
- `verification_email_link_clicked_estimated`
  - Emitted when the client observes `emailVerified` transition from false to true.

### Limitations

Firebase Auth does **not** expose true per-message delivery, bounce, mailbox placement, open, or click webhooks for default verification emails. The two estimated events are behavioral proxies, not proof that an email was opened or the link was clicked at a specific time.

### Alternatives

- Use a dedicated ESP with webhooks for delivered, bounced, deferred, complained, opened, clicked, and suppressed events.
- Use Firebase Admin SDK to generate email verification links server-side and send them through an ESP.
- Add a custom action handler/deep link page that records the action-code landing before applying the Firebase action code.
- Track support outcomes: user requested resend, user changed email, user manually verified, support ticket created.

## Future provider migration path

### Common migration architecture

1. Backend receives authenticated request to send verification email.
2. Backend validates cooldown/abuse limits.
3. Backend calls Firebase Admin SDK `generateEmailVerificationLink(email, actionCodeSettings)`.
4. Backend sends a branded transactional email through the ESP.
5. ESP webhooks write delivery/bounce/open/click/suppression events to analytics.
6. Verification link returns through a custom action handler that applies the Firebase action code and redirects/deep-links into the app.

### Provider comparison and current public pricing references

Pricing changes frequently; re-check before purchasing. Sources reviewed on 2026-06-08:

| Provider | Pros | Cons | Approximate cost signal | Deliverability improvement |
| --- | --- | --- | --- | --- |
| SendGrid | Mature API, dynamic templates, event webhooks, broad integrations, deliverability tooling. | Shared IP reputation can vary on lower tiers; support/detail improves on higher tiers. | Official pricing page lists Email API Essentials starting at about **$19.95/month**, Pro around **$89.95/month**, and a time-limited free trial. Source: https://sendgrid.com/en-us/pricing | Medium-High if using authenticated custom domain and webhooks. |
| Amazon SES | Very low cost, strong AWS integration, full control over authentication and reputation. | More operational work: sandbox exit, DKIM/SPF/DMARC, bounce/complaint handling, templates, dashboards. | Official SES pricing commonly lists outbound email around **$0.10 per 1,000 emails** plus extras such as dedicated IPs or data/attachments. Source: https://aws.amazon.com/ses/pricing/ | High if configured well; poor if operated without reputation discipline. |
| Mailgun | Developer-friendly API/SMTP, logs, analytics, webhooks, inbound routes, suppression handling. | More expensive than SES; plan/log retention varies by tier. | Official pages mention **100 emails/day free** and paid packages starting around **$15/month**; localized pricing showed Basic/10k, Foundation/50k, Scale/100k tiers. Sources: https://www.mailgun.com/features/email-api/ and https://www.mailgun.com/products/send/ | Medium-High with custom domain, suppression handling, and webhooks. |
| Resend | Modern developer experience, React email support, simple API, generous starter volume. | Newer ecosystem than SES/SendGrid/Mailgun; advanced enterprise deliverability may require higher tiers. | Official docs list Free **3,000 emails/month**, Pro **$20/month for 50,000**, Pro **$35/month for 100,000**, with overages from about **$0.90/1,000** on Pro. Source: https://resend.com/docs/knowledge-base/what-is-resend-pricing | Medium-High for branded transactional email; good fit for early-stage apps. |

## Final recommendation

Firebase Auth default emails are sufficient only if signups are low volume, support impact is low, and Firebase Console settings are carefully branded. For production where missed verification blocks learning access or enrollment, migrate verification email sending to a dedicated provider using Firebase Admin-generated action links. Start with Resend or Mailgun for fastest implementation, SendGrid if the team wants a large mature platform, or SES if lowest cost matters and the team can own deliverability operations.

## Change email address production flow

A dedicated correction flow is now available from the verification pending screen for users who misspelled their email, used an old address, or lost access to the mailbox.

### Firebase methods used

- `updateEmail(currentUser, normalizedEmail)` updates the Firebase Auth account email.
- `sendEmailVerification(currentUser)` sends a fresh verification email to the updated address.
- `reload(currentUser)` refreshes the local Firebase Auth user after the update.
- `EmailAuthProvider.credential(previousEmail, currentPassword)` and `reauthenticateWithCredential(currentUser, credential)` are used when Firebase requires recent login.
- Firestore `setDoc(..., { merge: true })` updates the app profile email so pending/profile screens display the new address immediately.

### Validation and security behavior

- New email is required.
- Input is trimmed and lowercased before submission.
- Invalid email formats are blocked before Firebase calls.
- Reusing the current email is blocked.
- `auth/requires-recent-login` prompts for the current password and retries with reauthentication.
- `auth/invalid-email`, `auth/email-already-in-use`, `auth/wrong-password`, `auth/invalid-credential`, `auth/too-many-requests`, and `auth/network-request-failed` return friendly messages.

### UX behavior

- The pending screen now includes a `Wrong email address?` prompt and `Change Email Address` button below resend.
- The change email screen displays the current email address and a new email input.
- After a successful change, resend cooldown/count storage is cleared, the local user/profile are refreshed, and the user returns to the verification screen after the success alert.

### Analytics

The flow emits:

- `verification_change_email_opened`
- `verification_change_email_submitted`
- `verification_change_email_success`
- `verification_change_email_failed`

Each event includes a timestamp and platform; failure events also include the Firebase error code when available.

### Production readiness score

- **Production readiness score: 84/100.** The flow supports correction without creating a new account, validates input, handles recent-login requirements for email/password users, refreshes local state, clears resend counters, and adds analytics. Remaining risk: stronger abuse protection should eventually move resend/change-email counters to a backend service, and non-password provider reauthentication may need provider-specific handling if social login is enabled.
