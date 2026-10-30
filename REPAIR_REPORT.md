# MVB RSVP Reliability Repair Report

## Scope and preservation

The existing invitation page, HTML structure, styling, fonts, profile image, video, event copy, navigation, and responsive layout were preserved. Changes are limited to the Apps Script RSVP/email lifecycle, the RSVP client recovery/status display, and deployment documentation.

## Source-level findings

1. The confirmation worker selected only rows whose `Confirmation Email Status` was `Pending`. When `MailApp.sendEmail()` threw, the worker marked the row `Failed`; subsequent scheduled runs never selected that row again. This made the failed confirmation permanently ineligible for retry.
2. The duplicate-submission path returned `Previously processed` whenever `RSVP_Responses` contained the ID, without looking up the actual email state in `Guests`.
3. The public status endpoint returned only `saved: true/false`. If the iframe acknowledgement was lost after a successful save, the frontend could verify the RSVP but could not recover the actual email-processing state.
4. The write sequence appended the legacy `Guests` and `RSVP_Submissions` records before appending `RSVP_Responses`. If execution stopped between those writes, a retry could be rejected as an orphaned submission even though the guest row already existed.
5. The previously reported `sheetAttendance` scope error was already corrected in the supplied source; it was not the only remaining reliability issue.

The ZIP alone cannot establish why the live Google deployment stopped executing, whether its deployment URL is current, whether the spreadsheet ID is accessible to the deployment owner, or whether its triggers are enabled. Those require Google-account authorization and live execution logs.

## Changes made

### `Code.gs`
- Added internal confirmation tracking columns to `Guests`: attempts, last attempt time, and last error. The required `RSVP_Responses` six-column schema is unchanged.
- Added a three-attempt retry policy for explicit MailApp failures, with at least five minutes between attempts.
- Records `Sending` before the email API call. A stale `Sending` state is not automatically retried because the message may have been accepted before an interrupted status write; this avoids a blind duplicate send.
- Returns actual confirmation state for duplicate submissions.
- Expands the privacy-limited status response to include email state and attempt count, but no guest PII.
- Recovers an interrupted write when the matching `Guests` row exists but the dedicated `RSVP_Responses` row is missing.
- Ensures one trigger per confirmation/reminder worker and removes accidental duplicate triggers for those handlers.
- Validates the Submission ID format and length.

### `assets/script.js`
- Uses the email state returned by the status-recovery endpoint instead of fabricating `Previously processed`.
- Displays accurate confirmation processing language: Google accepted, queued/processing, failed with retry, or unknown.
- Keeps the existing hidden-iframe POST and Submission ID recovery architecture.

### `DEPLOYMENT_NOTES.md`
- Added the new deployment and verification procedure for the email state/retry repair.

## Data and email behavior

- `RSVP_Responses` remains exactly: `Timestamp`, `Full Name`, `Email`, `Attendance`, `Number of Attendees`, `Submission ID`.
- Server-side attendee counts remain `Alone = 1` and `With a Plus One = 2`.
- Email status is tracked separately in `Guests`; email failures do not undo the RSVP.
- Explicit send failures are retried up to three times. A stale `Sending` state needs manual review because exactly-once email delivery cannot be guaranteed across a crash between send acceptance and status persistence.
- `Sent` means Google Apps Script's MailApp accepted the send request. It does not prove inbox placement or that the guest read the message.

## Local validation performed

- `node --check assets/script.js`: passed.
- `node --check Code.gs` (as JavaScript source): passed.
- In-memory Apps Script/Sheets simulation: passed for `Alone` count 1, `With a Plus One` count 2, six-column response layout, duplicate Submission ID suppression, invalid email rejection, successful email-state transition, explicit email failure recording, three-attempt retry eligibility, no additional email after an already-Sent duplicate, and exactly one trigger per worker after repeated setup.
- Python HTML parser check: passed; 29 IDs found and no duplicate IDs.
- ZIP integrity check: passed with all 10 required project files present.

## Tests not completed locally

- Live lost-acknowledgement behavior in the browser, actual simultaneous Apps Script executions, and real reminder scheduling were not exercised against Google's services.
- The local in-memory simulation is not a substitute for Apps Script's real `LockService`, Sheets service, MailApp, deployment redirects, or browser iframe origin behavior.

## Live tests still requiring the owner's Google account

The following cannot be honestly marked passed from a local ZIP:
- Live `SpreadsheetApp.openById()` access and write/read verification.
- Actual public Web App `/exec` deployment and iframe `postMessage` delivery.
- Real trigger creation/execution in the deployed Apps Script project.
- Actual MailApp authorization/quota and email acceptance to a controlled mailbox.
- Full live concurrent submissions and network interruption test.

Deploy the included `Code.gs` as a new version of the existing Web App, run `configureDatabaseSpreadsheet()` only if the existing Script Property is not configured, then run `setup()`. Republish the matching website files. Do not create a new spreadsheet or change the existing spreadsheet's public sharing settings.
