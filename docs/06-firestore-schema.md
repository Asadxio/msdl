# Firestore Schema Documentation

Firestore is the primary application database. The following table lists collections used by rules, frontend modules, and backend services.

| Collection | Fields | Relationships | Read permissions | Write permissions |
|---|---|---|---|---|
| `users` | name,email,role,status,created_at,updated_at,fcm_tokens,expo_push_tokens,photo_url,avatar,referral fields,last_login_at | Parent user profile; owns compliance subcollection; referenced by payments, enrollments, chats, attendance | self get; admins/teachers list by rules | self create pending; admin update; self metadata updates |
| `users/{uid}/compliance` | legal_acceptance fields, timestamps, policy versions | Per-user legal acceptance | self/admin | self legal acceptance; admin delete |
| `public_profiles` | uid,name,role,status,searchable,is_active,photo_url,avatar,updated_at | Public mirror of user profile for discovery | approved users | self/admin |
| `courses` | name, teacher_name, schedule/time, description, class links, created_at, updated_at | Referenced by enrollments, live_classes, modules/lessons | approved users with course access | admin only |
| `teachers` | name,title,courses,assigned_courses,photo_url,timestamps | Teacher directory mapped to courses/users | approved users | admin only |
| `library` | title,description,file_url/pdf_url,pdfUrl,category,category_id,deleted,timestamps | Book/PDF library | approved users | admin only |
| `attendance` | user_id,user_name,user_email,date,status,marked_by,marked_by_uid,live_class_id,course_id,duration_seconds,timestamps | Student attendance, often from live class events | teacher/admin or owner | teacher/admin create/update; admin delete |
| `notifications` | title,message,user_id,target_roles,target_user_ids,category,sound,read,hidden_by,created_at | In-app notification center and push source | recipient/broadcast/role-targeted | admin; teachers for allowed class notifications; user read/hidden updates |
| `user_notification_settings` | enabled categories, quiet hours, token preferences | Per-user notification preferences | self/admin | self/admin |
| `chats` | type,name,participants,participant_names,last_message,created_by,typing,unread_counts,pinned_by,hidden_by,muted_by,blocked_pairs,timestamps | Chat container for messages | participants; broadcasts to approved users | participants for state; admin for groups/broadcasts/delete |
| `messages / chat_messages` | chat_id,text,sender_id,sender_name,created_at,read_by,client_id,media fields,status,deleted/unsent fields,push_dedupe_id | Message records under top-level alias collections | chat participants/broadcast readers | participants create/update limited metadata; no delete |
| `message_reports` | reporter_id,target_user_id,target_message_id,reason,created_at | Chat moderation reports | reporter/admin | reporter create; admin update/delete |
| `status_updates` | user_id,user_name,role,text,media_url,media_type,likes,comments,audience,hidden_user_ids,muted_by,reaction_counts,expires_at_ms,created_at | Teacher/admin social status feed | approved users | teacher/admin create; students interaction update; owner/admin delete |
| `status_updates subcollections comments/reactions/views` | comment text/reaction/view metadata | Interactions on status updates | approved users with owner/admin visibility for views | creator creates/updates own interaction |
| `status_reports` | reporter_id,status_id,owner_id,reason,created_at | Moderation reports for statuses | reporter/admin | signed-in reporter create; admin update/delete |
| `payments` | user_id,user_name,amount,payment_ref,transaction_ref,state,status,provider,type,currency,review fields,reconciliation,entitlement fields,timestamps | Payment lifecycle and entitlements | owner/admin | owner create/submit; admin transitions/review |
| `payment_gateway_events` | provider event payload, ids, signature state,timestamps | Immutable webhook event log | admin | server only |
| `payment_processor_audit_logs / payment_audit_logs` | actor/action/payment_id/from/to/reason, timestamps | Payment audit trail | admin | server/admin only |
| `payment_verification_queue` | payment_id,user_id,state,next_attempts,lease fields | Async payment verification | admin | server only |
| `categories/modules/lessons/assignments` | course_id,title,description,order,visibility,published fields, assignment submission fields | Learning content hierarchy | eligible learners/teachers/admins | admin only |
| `lesson_progress` | user_id,lesson_id,course_id,module_id,completed,quiz_completed,completed_at,last_opened_at,updated_at | Per-user progress | owner/admin | owner/admin |
| `submissions` | assignment_id,user_id,file_url,file_name,mime_type,text_answer,status,timestamps | Assignment submissions | owner or teacher/admin | owner submit/update submitted; teacher/admin |
| `quizzes` | course_id/module_id/title/questions/options/answers/visibility | Quiz definitions | eligible learners | admin only |
| `quiz_results` | user_id,score,total_questions,created_at | Quiz attempt result | owner/admin | owner create; admin update/delete |
| `quiz_attempt_locks` | uid,quiz_id,nonce,started_at,expires_at | Server-side anti-replay/idempotency | server/admin | server only |
| `certificates` | user_id,course_id,certificate_url/number,issued_at,metadata | Generated completion certificates | owner/admin | server create; admin update/delete |
| `learning_state` | state document keyed by uid | User learning preferences/state | self/admin | self/admin |
| `audio_lessons` | course_id,teacher_id,title,description,audio_url,storage_path,file_size,upload_date,visibility,timestamps | Recorded audio lessons | eligible learners | admin/own teacher manage |
| `recordings` | live_class_id,course_id,teacher_id,recording_url,status,metadata,timestamps | Live class recording index | eligible class users | admin/server |
| `live_classes` | title,course_id,teacher_id,teacher_name,status,start/end,participant_count,recording,timestamps | Live class sessions | eligible course/class users | teacher/admin create/update; participant count updates |
| `live_classes/{id}/participants` | user_id,role,joined_at,last_seen,muted/removed state | Live session presence/moderation | class readers | self writes presence; teacher/admin moderation |
| `live_classes/{id}/attendance_events` | user_id,event,duration_seconds,at | Immutable join/leave audit | teacher/admin | self create join/leave only |
| `live_classes/{id}/moderation_events` | actor_uid,target_uid,action,reason,timestamps | Live moderation audit | teacher/admin for class | teacher/admin create only |
| `calls` | type,participants,created_by,status,channel_name,timestamps,cleanup | Agora call sessions | participants | participants create/update; admin delete |
| `calls/{id}/participants` | uid,status,joined_at,left_at,muted state | Call presence | call participants | self participant writes |
| `privacy_requests` | user_id,type,state,details,created_at,updated_at | Data/privacy requests | owner/admin | owner create; admin state update |
| `legal_audit_events` | user_id,event,policy_version,accepted_at,metadata | Legal acceptance audit | owner/admin | validated create only |
| `feedback` | user_id,user_name,message,rating,created_at | Feedback submissions | approved users | approved users create; admin update/delete |
| `app_settings` | fees/social links/notice/profile.about_madrasa,updated_at | Platform configuration | approved users | admin; validated platform fields |
| `security_events_immutable` | event,severity,payload,created_at | Security audit sink | admin | server only |
| `moderation_reports/evidence/actions/analytics_daily` | report details,evidence URLs,action state,priority,review fields | UGC moderation workflow | moderator/admin, reporter for own report | reporter create reports/evidence; moderator/admin actions; admin analytics |
| `analytics_daily_summary / analytics_dashboards / analytics_alerts` | metric aggregates, dimensions, date, alert state | Operational analytics | admin | server/admin jobs |
| `notification_dispatch_queue / notification_provider_receipts / notification_token_registry / provider_circuit_breakers / push_dedupe` | queue state, provider receipts, token health, provider circuit state, dedupe keys | Push delivery pipeline | admin/server | server/job endpoints |
| `async_jobs / dead_letter_jobs / worker_metrics / operation_dedupe` | job payload,state,lease,dedupe,metrics | Async worker framework | admin/server | server/jobs only |
