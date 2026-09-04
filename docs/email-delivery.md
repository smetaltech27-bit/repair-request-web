# Repair Request Email Delivery

## Recipient rules

- A newly created request sends a receipt to the requester and sends the actionable notification to exactly one responsible approver.
- Supervisors and department managers are resolved by active role plus the request department.
- Factory managers and purchasing are company-wide roles.
- A workflow transition is rejected when its next stage has zero or more than one active matching approver. The system never selects an arbitrary first row.
- Purchasing acknowledgement, rejection, and completion notify the requester and people who participated before the current action. The actor performing the current action does not receive a redundant copy unless that actor is also the requester.
- Missing notification email, inactive recipients, deleted requests, obsolete workflow events, and the pre-dispatcher backlog are marked `skipped`.

## Delivery components

1. `enqueue_request_notifications` creates one in-app row and one email outbox row per intended recipient in the workflow transaction.
2. `repair_email_dispatch_on_insert` wakes the dispatcher immediately through `pg_net`; its credential is read at runtime from Supabase Vault rather than embedded in SQL.
3. The five-minute Supabase Cron job is the recovery path for pending/failed rows if an immediate call is delayed or missed.
4. `repair-email-dispatcher` claims up to 25 pending/failed email rows with a 15-minute stale-lock timeout.
5. The dispatcher renders escaped HTML and sends a timestamped HMAC-signed payload to the Apps Script adapter.
6. `EmailAdapter.js` verifies the signature, checks `MailApp` quota, prevents short-term duplicate delivery by Notification ID, and sends the message.
7. The dispatcher records `sent` or `failed`. Failed attempts use 1, 5, 15, and 60-minute delays and stop after five claims. Quota failures wait six hours.

## Email content

- The six main workflow messages preserve the legacy Repair Request wording for new requests, department-manager approval, factory-manager approval, purchasing handoff, purchasing acknowledgement, and job closure.
- Each message contains the request code, department, requester, machine/location, issue, and the approval or acknowledgement history available at that stage.
- Closure messages also contain the closer, closure note and time, repair cost, and Before/After image links when attachments exist.
- Email buttons and image links deep-link to the matching request after login. Attachments remain private and are never converted to public URLs for email delivery.

### Temporary test routing

- Set `REPAIR_EMAIL_TEST_MODE=true` together with a complete `REPAIR_EMAIL_TEST_ROUTING` JSON object to redirect every outgoing message to controlled test mailboxes without changing `repair_profiles.email`.
- Required routing keys are `employee_machine`, `employee_other`, `supervisor`, `department_manager`, `factory_manager`, and `purchasing`.
- Test mode fails closed when the routing JSON or intended recipient profile cannot be resolved; it never falls back to a production recipient.
- Clear the two test settings after acceptance testing so delivery resumes from each active profile's configured notification email.

## Production activation checklist

Production activation changes external systems and must be approved separately before running these steps.

1. Confirm there is exactly one active profile for every required role/scope:
   - one supervisor per requesting department;
   - one department manager for each department that uses that stage;
   - one active factory manager company-wide;
   - one active purchasing user company-wide.
2. Review pending email rows, then apply `202609040001_repair_email_delivery.sql`. The migration intentionally skips the old backlog.
3. Add a long random `REPAIR_EMAIL_SHARED_SECRET` to Apps Script Properties.
4. Push `EmailAdapter.js` and deploy a new Apps Script Web App version that executes as the approved Workspace sender account.
5. Add these Supabase Edge Function secrets without committing their values:
   - `REPAIR_EMAIL_DISPATCH_SECRET`
   - `REPAIR_EMAIL_GAS_URL`
   - `REPAIR_EMAIL_SHARED_SECRET`
   - `REPAIR_APP_URL`
6. Deploy `repair-email-dispatcher` with JWT verification disabled. The function performs its own constant-time secret check; callers must provide `x-repair-dispatch-secret` or a matching Bearer value.
7. Store the dispatch secret in Supabase Vault as `repair_email_dispatch_secret`, then apply `202609040002_repair_email_dispatch_trigger.sql` to call the dispatcher immediately when a pending email row is inserted.
8. Create an active Supabase Cron recovery call named `repair-email-dispatcher-recovery` every five minutes. Its SQL must read the same dispatch secret from Vault; do not embed the secret in the Cron command.
9. Send test jobs through every route before enabling real recipients.

## Required verification

- Employee-created Machine request: requester receipt plus only the Machine supervisor.
- Supervisor-created Machine request: requester receipt plus only the Machine department manager.
- Supervisor-created non-Machine request: requester receipt plus only the factory manager.
- Factory-manager-created request: requester receipt plus only purchasing.
- Approval at every stage: only the next responsible approver.
- Purchasing acknowledgement: requester and prior approvers; no unrelated employee in the department.
- Rejection: requester and prior approvers; no copy to unrelated employees or the rejecting actor.
- Completion: requester and prior participants; no unrelated employee in the department.
- Missing email: workflow remains valid when the active responsible profile exists, and email is recorded as skipped.
- Missing/duplicate active approver: workflow transaction fails with a configuration error and sends nothing.
- Adapter timeout after send: the stale lock plus Apps Script Notification-ID cache prevents the immediate retry from sending another copy.
- Quota exhaustion: email remains retryable and the workflow data remains committed.
