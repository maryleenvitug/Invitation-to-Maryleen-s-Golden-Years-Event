# Deployment notes

1. Back up the Google Sheet currently used by the RSVP website.
2. Open the Apps Script project currently deployed at the URL configured in `assets/script.js`.
3. Replace/update its `Code.gs` with the `Code.gs` included in this ZIP. Do not create a new spreadsheet or a second RSVP database.
4. Save the Apps Script project and run `setup()` once. This adds the new registration columns and updates the event settings while retaining existing rows. The setup also creates one 15-minute time-driven trigger for `processReminders` (if one does not already exist). Authorize Google Sheets, MailApp, and trigger permissions when prompted.
5. In **Deploy → Manage deployments**, edit the existing web-app deployment and deploy a new version. Retain the existing deployment URL if Apps Script permits it, because the frontend is configured to use that URL.
6. Confirm deployment access remains appropriate for public RSVP submissions (the previous setup instructions used “Execute as: Me” and “Who has access: Anyone”).
7. Publish the updated website files together, keeping the `assets/` directory and its relative paths intact.
8. Submit one test RSVP for each attendance option using an email address you control. Confirm the `Guests` and `RSVP_Submissions` sheets show attendee counts of 1 and 2 respectively, the email address is saved, and the `Email_Log` sheet records the confirmation attempt. Remove test records only if desired and safe to do so.
9. In Apps Script > Triggers, verify exactly one `processReminders` trigger is enabled. Reminders are sent to confirmed attendees with an email address at the configured event-relative times.

The included backend extends the existing sheet structure rather than creating a new database. Do not delete the old guest rows or old columns during deployment.


## Email deliverability note
The site sends confirmation and reminder messages through the Google account that owns/runs the Apps Script deployment. The script records whether Google accepted each send request, but it cannot guarantee inbox placement or prevent Gmail/other providers from classifying a message as spam. For best deliverability, deploy from a reputable, secured Google account, keep the subject and message factual and transactional, use accurate recipient addresses, and ask guests to add the sender account to their contacts or mark the first message as “Not spam” if needed. Do not promise that email will never enter spam.


## RSVP connection fix (latest update)
- All internal RSVP/navigation anchors now use page-relative fragment links (`#rsvp`, `#top`, etc.) rather than root-relative paths. This prevents GitHub Pages project sites or other subpath deployments from navigating to the domain root and returning a 404.
- RSVP submissions now use a hidden iframe + standard HTML form POST to the existing Apps Script `/exec` URL. The Apps Script returns a small HTML response that posts the actual server result back to the invitation page. This avoids relying on a cross-origin `fetch()` response after Apps Script redirects.
- IMPORTANT: This transport change requires replacing the deployed `Code.gs` with the version in this ZIP and deploying a **new Web App version**. Keep the existing Apps Script project, spreadsheet, and deployment URL. Do not create a new spreadsheet or a second database.
- After redeployment, test with a controlled email address and verify one row in `RSVP_Submissions`, the corresponding row in `Guests`, and an `Email_Log` entry. Check the sheet before repeating a test because the server may have saved a submission even if the browser did not receive the response.


## Additional iframe response correction
- The Apps Script HTML response now posts the correlated result to `window.top`, not `window.parent`. HtmlService can introduce an intermediate iframe; `window.parent` may therefore message Google's wrapper rather than the invitation page.
- This change is in `Code.gs` only. It must be saved and deployed as a new version in the same existing Apps Script Web App deployment. The website files also need to be republished from this ZIP.


## Database connection and RSVP response hardening (this build)
- `doPost` now accepts the hidden HTML-form parameters and URL-encoded POST bodies, correlates the request ID from both the form and JSON payload, and returns a `postMessage` response for iframe submissions even when parsing/database errors occur.
- Spreadsheet access now uses the explicitly configured `MVB_SPREADSHEET_ID` Script Property when present, with a container-bound spreadsheet fallback. If the project is standalone, edit `configureDatabaseSpreadsheet()` and replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with the ID from your existing Google Sheet URL, then run that function once and authorize it. Do not create a new sheet.
- RSVP rows are flushed to Sheets before confirmation email processing. Confirmation messages are queued and sent by `processPendingConfirmations` on a 5-minute trigger, so Gmail latency cannot hold the RSVP request open. Run `setup()` once after deploying to create the trigger.
- After replacing `Code.gs`, deploy a **new version** of the existing Web App and keep the same `/exec` URL. Publish the matching website `assets/script.js`.
- Check Apps Script > Executions for `doPost` and `processPendingConfirmations`; `doPost` now logs the actual error message and returns it to the page.


## Your spreadsheet connection
Your existing spreadsheet ID is already filled into `configureDatabaseSpreadsheet()` in this package. In the same Apps Script project, run `configureDatabaseSpreadsheet()` once and authorize access, then run `setup()` once. Keep the spreadsheet private; do not change its sharing settings to public.


## Important backend reliability patch
This ZIP includes an additional fix for existing Sheets whose columns are not in the exact order expected by the website code. The backend now writes and reads RSVP fields by matching header names, so it preserves custom/reordered columns and historical rows. It also protects against formula-like submitted text. **You must replace the deployed `Code.gs` with this ZIP's version and deploy a new Web App version** for the fix to take effect. Keep the same spreadsheet ID and `/exec` URL. Then submit one controlled test RSVP and verify its matching rows in `Guests` and `RSVP_Submissions`.


## Timeout diagnosis and response-delivery patch
- The website waits for a correlated `MVB_RSVP_RESULT` browser message from the Apps Script HTML response. A timeout means the page did not receive that acknowledgement; it does **not** prove that the sheet write failed. Before retrying, inspect `RSVP_Submissions` to avoid creating a duplicate.
- The latest `Code.gs` response sends the acknowledgement to the top-level page and, when applicable, the intermediate parent frame, with short retries to tolerate the HtmlService iframe wrapper.
- The website timeout is now 70 seconds to allow slower Apps Script cold starts and spreadsheet operations. The UI still reports failure if no server acknowledgement arrives; it never falsely claims a save.
- After updating both website assets and `Code.gs`, save the Apps Script project and deploy a **new version** of the existing Web App. The `/exec` URL must remain the same and access must be set to **Anyone** (execute as the deployment owner).
- Verify the deployment by opening the configured `/exec` URL directly in a browser. It should return JSON containing `{"status":"ok","message":"RSVP API is live."}`. If it shows a Google sign-in page, access-denied page, old output, or an Apps Script error, the public deployment is not correctly published.
- Then submit one controlled test RSVP and immediately inspect Apps Script **Executions**. A `doPost` execution should appear. If no `doPost` execution appears, the website is pointing to a wrong/old URL or the public deployment is inaccessible. If `doPost` appears with an error, use that execution's error details to correct the spreadsheet permission/property or sheet issue. If the sheet row is saved but the page times out, the remaining problem is response delivery, not the sheet write.


## Dedicated response sheet and lost-acknowledgement recovery (2026-10-30)
- The updated `setup()` creates `RSVP_Responses` without deleting or rewriting existing sheets. Its exact header order is `Timestamp | Full Name | Email | Attendance | Number of Attendees | Submission ID`.
- New submissions write `Alone` with attendee count `1`, or `With a Plus One` with attendee count `2`. The count and timestamp are generated/derived server-side.
- After saving, the backend flushes the spreadsheet and verifies that the Submission ID can be read back from `RSVP_Responses` before it reports success.
- If the iframe acknowledgement is lost, the website checks `?action=status` for that same Submission ID. The endpoint returns only a saved/not-saved status and does not return guest data. If the guest retries with the same unchanged form details in the same browser session, the original Submission ID is reused to prevent a duplicate.
- After deployment, run `configureDatabaseSpreadsheet()` if the script property has not yet been configured, then run `setup()`. Deploy a new version of the existing Web App and republish the website files from this ZIP. Keep the existing spreadsheet ID and `/exec` URL.
- Verify the `RSVP_Responses` row in addition to the existing `Guests`, `RSVP_Submissions`, and `Email_Log` entries. A local test cannot prove that the live Google deployment, permissions, or spreadsheet are working.


## Reliability repair update (2026-10-30)

This package includes an additional email-state and recovery repair:

- Confirmation status is now reported from the matching `Guests` row for duplicate submissions and status checks. A saved RSVP is no longer mislabeled as "Previously processed" when its email is still Pending, Sending, or Failed.
- `Guests` gains internal tracking columns for confirmation attempts, last attempt time, and last error. The required `RSVP_Responses` worksheet remains exactly six columns and is not changed.
- The confirmation worker processes Pending messages and retries explicit MailApp failures up to three attempts, at least five minutes apart. It records `Sending` before calling MailApp, then `Sent` or `Failed`.
- A stale `Sending` state is intentionally not retried automatically. If Apps Script stops after Google accepts a message but before the status update, automatically retrying could send a duplicate. Inspect Apps Script executions and the email log before manually intervening.
- `doGet?action=status` returns only saved/not-saved and the confirmation processing state; it does not return guest details.
- A repeated Submission ID returns the actual email processing state and never inserts another response row.
- If a previous execution wrote the legacy Guests row but stopped before creating `RSVP_Responses`, a retry reconstructs only the missing response row from the existing guest record.
- `setup()` now keeps one trigger per confirmation/reminder worker and removes accidental duplicate triggers for those same handlers.

After deploying this version, run `setup()` once so the new internal tracking columns and both triggers are present. Then check Apps Script > Triggers for exactly one `processPendingConfirmations` trigger and one `processReminders` trigger. Use a controlled test address and inspect `RSVP_Responses`, `Guests`, `RSVP_Submissions`, and `Email_Log`.

Important: Apps Script's `MailApp.sendEmail()` acceptance is not proof of inbox delivery. The `Sent` state means Google accepted the send request. The live spreadsheet, live web-app deployment, trigger execution, and real inbox delivery still require owner-authorized verification.
