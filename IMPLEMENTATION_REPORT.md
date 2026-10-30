# Maryleen's 50th Birthday Invitation Website
## Implementation report

### Updated event information
- Date: Saturday, November 7, 2026
- Time: 4:30 PM Philippine Standard Time (Asia/Manila, UTC+8)
- Venue: Ednalizamon Event Place
- Address: B8 L7, Purok 5, Barangay Pampang, Angeles City
- Attire: Red, Yellow Gold, and Red
- Added a live countdown targeting 2026-11-07 16:30 Asia/Manila (08:30 UTC).
- Updated the Apps Script event settings and reminder schedule. Running `setup()` updates the corresponding Settings sheet values without clearing RSVP history.

### Honorary Court
Replaced the displayed Honorary Court with the five requested categories and all 25 names, in the supplied order and spelling. The rendering script clears the court container before inserting cards, preventing duplicate cards. Responsive styles allow the cards and names to wrap on narrow screens.

### RSVP changes
- Replaced multiple guest cards, guest removal/addition, email fields, and per-guest attendance toggles with one required Full Name field and exactly two attendance choices.
- `Attending Alone` stores an attendee count of 1; `Attending with a Plus-One` stores an attendee count of 2.
- The client trims and collapses extra whitespace, validates both required fields, disables the submit button while saving, and shows a detailed confirmation.
- The Apps Script backend validates the attendance choice and attendee count, uses the existing script lock and submission ID for idempotency, and stores the representative name, selection, and attendee count in the existing Google Sheets architecture.
- New columns are appended to the existing Guests and RSVP_Submissions sheets. Existing rows and legacy records are not deleted or rewritten. The backend retains compatibility with the old guest-array payload for older clients.
- The existing sheet's `Number of Guests` field is populated with the actual attendee count for new registrations, not simply one per RSVP.

### Video and audio
- Preserved `assets/invitation-video.mp4` and its original media path.
- The supplied MP4 has an AAC audio stream. The project ZIP does not contain a separate background music file or a separate audio source, so the video's embedded soundtrack is used as the single audio source. No second audio player or replacement track was introduced.
- The video has `autoplay`, `playsinline`, and `preload="auto"`, and is not forced muted.
- Playback with sound is attempted on page load. If the browser blocks it, an invitation-styled “Tap to Open Invitation” prompt appears; the visitor's interaction retries playback. A sound toggle remains available.
- Audible autoplay cannot be guaranteed on browsers/devices that require user interaction. This is a browser policy limitation, not something the site can safely bypass.

### Validation performed
- JavaScript syntax check: passed (`node --check`).
- Apps Script source syntax check: passed after checking a `.js` copy of `Code.gs` (`node --check`).
- HTML parser check: passed.
- Chromium-based in-page functional test using a mocked Apps Script response: passed for five court cards, 25 names, countdown population, required-field validation, whitespace normalization, plus-one attendee count, and confirmation content.
- Responsive width check at 1365, 1024, 768, 390, and 320 pixels: no horizontal overflow after the final responsive adjustment.
- Mocked backend test: passed for plus-one count 2, alone count 1, repeated submission ID deduplication, and rejection of a blank representative name.
- Verified the supplied video has both video and AAC audio streams and that the existing profile image and video assets remain in the project.

### Remaining deployment checks
- The real Google Apps Script service, live spreadsheet permissions, and production web deployment cannot be verified from the ZIP alone. Replace/update the deployed Apps Script code with the included `Code.gs`, run `setup()` once, and update the existing web-app deployment to a new version before using the new RSVP form publicly. Keep the same spreadsheet and existing deployment URL where possible.
- The test browser used a mocked Apps Script response; it did not write to the live spreadsheet or send email.
- The event video playback fallback is implemented, but actual audible autoplay depends on each visitor's browser policy and user settings.


## Email field, confirmations, and reminders (added)
- The representative RSVP now requires a valid email address and saves it in the existing `Guests` sheet.
- After the RSVP is saved, the Apps Script sends a transactional confirmation email with the attendance selection, attendee total, date, time, venue, address, attire, and map link.
- Email attempts and failures are recorded in `Email_Log`; confirmation status is saved on the RSVP row. A failed email does not invalidate the saved RSVP.
- A single 15-minute time-driven `processReminders` trigger is created by `setup()` if missing. It sends the configured one-day, three-hour, and one-hour reminders to attending guests with email addresses and avoids resending reminders marked Sent.
- Spam-folder placement cannot be guaranteed by Apps Script. The implementation records Google send acceptance, not final inbox delivery.


## RSVP 404 and submission transport correction (latest update)
- Replaced root-relative internal navigation links (for example, `/#rsvp`) with page-relative fragment links (`#rsvp`). This corrects the 404 behavior when the site is hosted under a project/subdirectory path.
- Replaced the browser `fetch()` submission path with a hidden-iframe form POST and a request-ID-correlated `postMessage` response from Apps Script. This is intended to avoid CORS failures when Apps Script ContentService redirects responses.
- Updated `Code.gs` `doPost` to accept the form payload and return the structured response through an HtmlService page. The existing JSON POST path remains supported for compatibility.
- JavaScript syntax checks passed for `assets/script.js` and `Code.gs`; verified no `href="/#..."` links remain.
- The live Apps Script deployment and actual browser-to-Google-Sheets write still require deployment and testing by the site owner. Do not claim live submission is verified until a test RSVP is confirmed in the existing spreadsheet.


### Follow-up transport correction
- Updated the Apps Script iframe response target from `window.parent` to `window.top` so the response can reach the top-level invitation page even when HtmlService introduces an intermediate iframe. This is a source-level correction; live Google Apps Script delivery and spreadsheet writes still require a production test.


## RSVP diagnostic hardening
The previous backend caught exceptions and returned a generic save failure, which made a completed Apps Script execution appear successful even if the database operation had failed. The updated backend logs stack traces and returns a diagnostic message, resolves the spreadsheet explicitly when configured, handles both form parameters and URL-encoded POST bodies, and decouples confirmation email sending from the synchronous RSVP save. These changes require deployment and a real test against the user's existing spreadsheet; live service behavior has not been independently verified.


## Additional reliability audit (2026-10-30)
- Corrected a backend data-integrity issue: the previous writer assumed the existing Google Sheet columns were in the exact order of the current code headers. Existing sheets with reordered/custom columns could receive values under the wrong headings. New RSVP, submission, and email-log rows are now written by matching header names, preserving existing column order and extra columns.
- Duplicate-submission lookup and guest email-status updates now locate columns by header name instead of assuming the ID/status columns are at fixed positions.
- Confirmation and reminder workers now read the full used row width and resolve fields through the sheet header row, avoiding shifted data when a sheet contains custom columns.
- Added spreadsheet formula-injection protection for submitted text that begins with formula-like characters.
- Rechecked JavaScript and Apps Script syntax with Node.js; both passed. Checked the HTML for duplicate element IDs; none found.
- The live Google Apps Script deployment and real spreadsheet write remain unverified from this local ZIP. The included backend must be deployed as a new version to the existing Web App before the website can use these fixes.


## RSVP timeout and spreadsheet schema repair (2026-10-30)
- Added a dedicated `RSVP_Responses` worksheet with the exact columns: `Timestamp`, `Full Name`, `Email`, `Attendance`, `Number of Attendees`, and `Submission ID`. Existing `Guests`, `RSVP_Submissions`, `Email_Log`, `Settings`, and historical rows are retained for compatibility with existing confirmation and reminder workflows.
- The backend derives the attendee count on the server (1 for `Alone`, 2 for `With a Plus One`) and does not trust a browser-supplied attendee count. It writes the dedicated response row, flushes the spreadsheet, and reads the matching Submission ID back before returning success.
- Added a privacy-limited `doGet?action=status` endpoint. It returns only whether the supplied Submission ID exists; it never exposes the guest list or personal details. It supports a validated JSONP callback for cross-origin browser verification.
- The frontend now checks the status endpoint if the iframe acknowledgement is lost or delayed. It retains the same Submission ID and payload signature in session storage after an uncertain result, so a retry with unchanged form details uses the original ID and is deduplicated.
- The existing hidden-iframe POST remains the primary submission transport. The status check is a recovery/verification path; it does not assume that a missing `postMessage` means the sheet write failed.
- Existing email confirmation and reminder processing remains in place through the legacy supporting sheets and queued triggers. Email delivery is not part of the synchronous save operation.
- Local checks performed for this package: Node.js syntax checks for frontend JavaScript and Apps Script source (as a JavaScript syntax check), HTML parser check, and ZIP integrity check. Live Google Apps Script execution, spreadsheet permissions, trigger behavior, and real email delivery still require the owner's Google account and deployment.


## Follow-up hotfix (2026-10-30)

Fixed a Google Apps Script runtime error in `handleSubmitRsvp_`: `sheetAttendance` was declared with block scope inside the representative-format validation branch but was subsequently used when constructing the `RSVP_Responses` row outside that block. It is now declared in the enclosing function scope and assigned inside the branch. This preserves the existing attendance mapping (`Alone` = 1; `With a Plus One` = 2) and avoids changing the website UI or submission flow. `Code.gs` passed a JavaScript syntax check with Node.js. A live Google Apps Script / Google Sheets test still requires deployment and authorization in the owner's Google account.
