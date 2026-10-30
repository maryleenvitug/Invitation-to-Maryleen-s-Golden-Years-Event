/**
 * ============================================================
 * Maryleen B. Vitug's Golden 50th Birthday — RSVP Backend
 * Google Apps Script (bound or standalone, using Google Sheets
 * as the database).
 *
 * SETUP:
 *   1. Create or open the Google Sheet you want to use as the
 *      database.
 *   2. Extensions > Apps Script. Paste this file in as Code.gs.
 *   3. Run `setup()` once from the Apps Script editor (Run menu)
 *      to create all required sheets/headers. Grant permissions
 *      when prompted.
 *   4. Deploy > New deployment > Web app.
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Copy the generated /exec URL into js/script.js as
 *      APPS_SCRIPT_URL.
 *   5. In the Apps Script editor, open Triggers (clock icon) and
 *      add a time-driven trigger for `processReminders` to run
 *      every 15–30 minutes. This drives Emails 2–4.
 * ============================================================
 */

/* ===================== CONFIG ===================== */

const EVENT_CONFIG = {
  celebrantName: "Maryleen",
  occasion: "Golden 50th Birthday Celebration",
  venue: "Ednalizamon Event Place",
  venueAddress: "B8 L7, Purok 5, Barangay Pampang, Angeles City",
  eventDateDisplay: "Saturday, November 7, 2026",
  eventTimeDisplay: "4:30 PM (Philippine Standard Time)",
  timeZone: "Asia/Manila",
  mapUrl: "https://maps.app.goo.gl/w9zNegShTh3TfAin6",
  colorTheme: "Red, Yellow Gold, and Red",
  // ISO-like strings interpreted in the event time zone.
  eventDateTime: "2026-11-07T16:30:00",
  reminder1At: "2026-11-06T16:30:00", // 1 day before
  reminder2At: "2026-11-07T13:30:00", // 3 hours before
  reminder3At: "2026-11-07T15:30:00"  // 1 hour before
};

// Minutes of tolerance: a reminder becomes eligible at its
// target time and stays eligible (if unsent) rather than being
// skipped, to tolerate trigger execution delay.
const REMINDER_GRACE_MINUTES = 0;
// Reminders already more than this many hours late are logged
// as "missed" and skipped automatically (see processReminders).
const REMINDER_MAX_LATE_HOURS = 20;

// Set to true while testing to log emails instead of sending them.
const TEST_MODE_NO_EMAIL = false;

const SHEET_NAMES = {
  GUESTS: "Guests",
  SUBMISSIONS: "RSVP_Submissions",
  EMAIL_LOG: "Email_Log",
  SETTINGS: "Settings",
  RESPONSES: "RSVP_Responses"
};

const GUEST_HEADERS = [
  "Guest ID", "Submission ID", "Last Name", "First Name", "Middle Name",
  "Email Address", "Attendance", "Submitted At", "Updated At",
  "Confirmation Email Status", "Confirmation Email Attempts", "Confirmation Email Last Attempt At", "Confirmation Email Last Error", "Reminder 1 Status", "Reminder 2 Status", "Reminder 3 Status",
  "Registration Type", "Attendee Count", "Representative Full Name"
];
const SUBMISSION_HEADERS = ["Submission ID", "Submitted At", "Number of Guests", "Submission Status", "Representative Full Name", "Attendance Selection", "Attendee Count"];
const EMAIL_LOG_HEADERS = ["Email Log ID", "Guest ID", "Email Address", "Email Type", "Attempted At", "Status", "Error Details"];
const SETTINGS_HEADERS = ["Key", "Value"];
const RESPONSE_HEADERS = ["Timestamp", "Full Name", "Email", "Attendance", "Number of Attendees", "Submission ID"];

/* ===================== DATABASE CONNECTION ===================== */

/**
 * Uses an explicitly configured spreadsheet ID when available. This is
 * reliable for standalone Apps Script deployments. If no ID is configured,
 * it falls back to the container-bound active spreadsheet.
 *
 * To configure: copy the ID between /d/ and /edit in the Google Sheet URL,
 * paste it into configureDatabaseSpreadsheet() below, and run that function
 * once from the Apps Script editor.
 */
function getDatabaseSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("MVB_SPREADSHEET_ID");
  let ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No RSVP spreadsheet is connected. Run configureDatabaseSpreadsheet() with your Google Sheet ID, then run setup().");
  }
  return ss;
}

function configureDatabaseSpreadsheet() {
  const spreadsheetId = "10EFXxWKf1RM5owx2Pn6A3Z5PjQtTwZCfKaxNThPphcI";
  if (!spreadsheetId || spreadsheetId === "PASTE_YOUR_GOOGLE_SHEET_ID_HERE") {
    throw new Error("Edit configureDatabaseSpreadsheet() and paste your Google Sheet ID first.");
  }
  const ss = SpreadsheetApp.openById(spreadsheetId); // validates access and ID
  PropertiesService.getScriptProperties().setProperty("MVB_SPREADSHEET_ID", ss.getId());
  Logger.log("RSVP database connected: " + ss.getName() + " (" + ss.getId() + ")");
}

/* ===================== SETUP ===================== */

/**
 * Run once manually. Creates missing sheets/headers without
 * touching existing guest data. Safe to re-run at any time.
 */
function setup() {
  const ss = getDatabaseSpreadsheet_();

  ensureSheet_(ss, SHEET_NAMES.GUESTS, GUEST_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.SUBMISSIONS, SUBMISSION_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.EMAIL_LOG, EMAIL_LOG_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.SETTINGS, SETTINGS_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.RESPONSES, RESPONSE_HEADERS);

  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  const existingRows = settingsSheet.getLastRow() > 1
    ? settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues()
    : [];

  const defaults = [
    ["Celebrant Name", EVENT_CONFIG.celebrantName],
    ["Venue", EVENT_CONFIG.venue],
    ["Venue Address", EVENT_CONFIG.venueAddress],
    ["Attire", EVENT_CONFIG.colorTheme],
    ["Event Date", EVENT_CONFIG.eventDateDisplay],
    ["Event Start Time", EVENT_CONFIG.eventTimeDisplay],
    ["Time Zone", EVENT_CONFIG.timeZone],
    ["Map URL", EVENT_CONFIG.mapUrl],
    ["Color Theme", EVENT_CONFIG.colorTheme]
  ];
  defaults.forEach(([key, value]) => {
    const existingIndex = existingRows.findIndex(row => row[0] === key);
    if (existingIndex === -1) settingsSheet.appendRow([key, value]);
    else if (existingRows[existingIndex][1] !== value) settingsSheet.getRange(existingIndex + 2, 2).setValue(value);
  });

  ensureReminderTrigger_();
  ensureConfirmationTrigger_();
  Logger.log("Setup complete. Sheets ready: " + Object.values(SHEET_NAMES).join(", "));
}

function ensureReminderTrigger_() {
  ensureSingleTimeTrigger_("processReminders", 15);
}

function ensureConfirmationTrigger_() {
  ensureSingleTimeTrigger_("processPendingConfirmations", 5);
}

function ensureSingleTimeTrigger_(handlerName, minutes) {
  const matching = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handlerName;
  });
  // Keep one existing trigger and remove accidental duplicates.
  matching.slice(1).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  if (!matching.length) {
    ScriptApp.newTrigger(handlerName).timeBased().everyMinutes(minutes).create();
  }
}

/** Sends queued confirmation emails independently of the RSVP save request. */
function processPendingConfirmations() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const ss = getDatabaseSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_NAMES.GUESTS);
    if (!sheet || sheet.getLastRow() < 2) return;
    const columns = headerMap_(sheet);
    const required = ["Guest ID", "Submission ID", "Representative Full Name", "First Name",
      "Last Name", "Email Address", "Attendance", "Registration Type", "Attendee Count",
      "Confirmation Email Status", "Confirmation Email Attempts", "Confirmation Email Last Attempt At",
      "Confirmation Email Last Error"];
    required.forEach(name => { if (!columns[name]) throw new Error('Guests sheet is missing "' + name + '". Run setup().'); });
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const now = new Date();
    data.forEach(function(row, i) {
      const status = String(row[columns["Confirmation Email Status"] - 1] || "");
      const attempts = Number(row[columns["Confirmation Email Attempts"] - 1] || 0);
      const lastAttempt = row[columns["Confirmation Email Last Attempt At"] - 1];
      // Retry explicit MailApp failures up to three times, no sooner than five minutes apart.
      // A stale "Sending" state is not retried automatically: Google may already have accepted it.
      if (status !== "Pending" && status !== "Failed") return;
      if (attempts >= 3) return;
      if (lastAttempt && now.getTime() - new Date(lastAttempt).getTime() < 5 * 60 * 1000) return;
      const guest = {
        guestId: row[columns["Guest ID"] - 1],
        submissionId: row[columns["Submission ID"] - 1],
        firstName: row[columns["Representative Full Name"] - 1] || row[columns["First Name"] - 1],
        lastName: row[columns["Last Name"] - 1],
        email: row[columns["Email Address"] - 1],
        attendance: row[columns["Attendance"] - 1],
        attendanceChoice: row[columns["Registration Type"] - 1],
        attendeeCount: row[columns["Attendee Count"] - 1]
      };
      const rowNum = i + 2;
      sheet.getRange(rowNum, columns["Confirmation Email Status"]).setValue("Sending");
      sheet.getRange(rowNum, columns["Confirmation Email Attempts"]).setValue(attempts + 1);
      sheet.getRange(rowNum, columns["Confirmation Email Last Attempt At"]).setValue(new Date());
      sheet.getRange(rowNum, columns["Confirmation Email Last Error"]).setValue("");
      SpreadsheetApp.flush();
      if (!guest.email) {
        const error = "No email address on record.";
        updateGuestEmailStatus_(sheet, guest.guestId, "Confirmation Email Status", "Failed");
        sheet.getRange(rowNum, columns["Confirmation Email Last Error"]).setValue(error);
        logEmailAttempt_(guest.guestId, "", "Confirmation", false, error);
        return;
      }
      const result = sendConfirmationEmail_(guest);
      updateGuestEmailStatus_(sheet, guest.guestId, "Confirmation Email Status", result.ok ? "Sent" : "Failed");
      sheet.getRange(rowNum, columns["Confirmation Email Last Error"]).setValue(result.error || "");
      logEmailAttempt_(guest.guestId, guest.email, "Confirmation", result.ok, result.error);
    });
  } catch (err) {
    Logger.log("processPendingConfirmations ERROR: " + (err && err.stack ? err.stack : err));
  } finally {
    lock.releaseLock();
  }
}

/** Returns only delivery state for a Submission ID; never returns guest data. */
function getConfirmationState_(submissionId) {
  const sheet = getDatabaseSpreadsheet_().getSheetByName(SHEET_NAMES.GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return {status: "Pending", attempts: 0, error: ""};
  const columns = headerMap_(sheet);
  if (!columns["Submission ID"] || !columns["Confirmation Email Status"]) {
    return {status: "Pending", attempts: 0, error: ""};
  }
  const ids = sheet.getRange(2, columns["Submission ID"], sheet.getLastRow() - 1, 1).getValues().flat();
  const offset = ids.indexOf(submissionId);
  if (offset < 0) return {status: "Pending", attempts: 0, error: ""};
  const rowNum = offset + 2;
  return {
    status: String(sheet.getRange(rowNum, columns["Confirmation Email Status"]).getValue() || "Pending"),
    attempts: columns["Confirmation Email Attempts"] ? Number(sheet.getRange(rowNum, columns["Confirmation Email Attempts"]).getValue() || 0) : 0,
    error: columns["Confirmation Email Last Error"] ? String(sheet.getRange(rowNum, columns["Confirmation Email Last Error"]).getValue() || "").slice(0, 300) : ""
  };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    // Add newly required columns at the end; never overwrite historical records.
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    headers.forEach(header => {
      if (existing.indexOf(header) === -1) {
        const col = sheet.getLastColumn() + 1;
        sheet.getRange(1, col).setValue(header).setFontWeight("bold");
        existing.push(header);
      }
    });
  }
  return sheet;
}

/* ===================== WEB APP ENTRY POINTS ===================== */

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.action === "status") {
    const id = sanitizeText_(params.submissionId);
    const callback = String(params.callback || "");
    if (!id || id.length > 200) return jsonOutput_({status:"error", message:"Invalid submission ID."});
    const saved = !!findResponse_(id);
    const email = saved ? getConfirmationState_(id) : {status:"Not queued", attempts:0, error:""};
    const result = {status:"ok", submissionId:id, saved:saved, emailStatus:email.status,
      emailAttempts:email.attempts};
    if (callback) {
      if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,100}$/.test(callback)) {
        return jsonOutput_({status:"error", message:"Invalid callback."});
      }
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(result).replace(/</g,"\\\\u003c") + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return jsonOutput_(result);
  }
  return jsonOutput_({ status: "ok", message: "RSVP API is live." });
}

/**
 * Receives POSTs as text/plain (to avoid a CORS preflight the
 * Apps Script platform cannot answer), parses JSON manually.
 */
function doPost(e) {
  let requestId = "";
  let iframeTransport = false;
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    requestId = String(params.requestId || "");
    let body = null;

    // Standard HTML form POST used by the invitation page.
    if (params.payload) {
      iframeTransport = true;
      body = JSON.parse(String(params.payload));
    } else if (e && e.postData && e.postData.contents) {
      const raw = String(e.postData.contents);
      const contentType = String(e.postData.type || "").toLowerCase();
      if (contentType.indexOf("application/x-www-form-urlencoded") !== -1 || raw.indexOf("payload=") === 0) {
        const formParams = {};
        raw.split("&").forEach(function(pair) {
          const pos = pair.indexOf("=");
          const key = pos >= 0 ? pair.slice(0, pos) : pair;
          const value = pos >= 0 ? pair.slice(pos + 1) : "";
          formParams[decodeURIComponent(key.replace(/\+/g, " "))] = decodeURIComponent(value.replace(/\+/g, " "));
        });
        if (formParams.payload) {
          iframeTransport = true;
          body = JSON.parse(formParams.payload);
          requestId = requestId || String(formParams.requestId || "");
        }
      }
      if (!body) body = JSON.parse(raw);
    }

    if (!body) throw new Error("Request body was empty. Confirm the website is using the current Apps Script /exec URL.");
    requestId = requestId || String(body.requestId || (body.payload && body.payload.requestId) || "");
    iframeTransport = iframeTransport || !!requestId;

    let result;
    if (body.action === "submitRsvp") {
      result = handleSubmitRsvp_(body.payload);
    } else {
      result = { status: "error", message: "Unknown action: " + String(body.action || "(missing)") };
    }

    Logger.log("doPost result: " + JSON.stringify({ requestId: requestId, status: result && result.status, message: result && result.message }));
    if (iframeTransport) return iframeMessageOutput_(requestId, result);
    return jsonOutput_(result);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    Logger.log("doPost ERROR: " + message + "\n" + (err && err.stack ? err.stack : ""));
    const result = { status: "error", message: message };
    // Always return the correlated HTML message for the website's form/iframe
    // transport, even when parsing or database access fails.
    if (iframeTransport || requestId) return iframeMessageOutput_(requestId, result);
    return jsonOutput_(result);
  }
}

function iframeMessageOutput_(requestId, result) {
  const message = JSON.stringify({
    type: "MVB_RSVP_RESULT",
    requestId: String(requestId || ""),
    result: result
  }).replace(/</g, "\\u003c");
  // HtmlService may wrap the returned page in an additional sandbox frame.
  // Notify the top-level invitation page more than once to avoid losing the
  // response during wrapper/frame navigation. Duplicate messages are harmless:
  // the browser client settles each request only once.
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>(function(){' +
    'var data=' + message + ';' +
    'function notify(){' +
    'try{window.top.postMessage(data,"*");}catch(e){}' +
    'try{if(window.parent!==window.top)window.parent.postMessage(data,"*");}catch(e){}' +
    '}' +
    'notify();setTimeout(notify,250);setTimeout(notify,1000);' +
    '})();</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===================== RSVP SUBMISSION ===================== */

function handleSubmitRsvp_(payload) {
  if (!payload) return { status: "error", message: "Missing RSVP details." };
  const isRepresentativeFormat = typeof payload.representativeName === "string";
  const submissionId = sanitizeText_(payload.submissionId) || ("sub_" + Utilities.getUuid());
  if (submissionId.length > 120 || !/^[A-Za-z0-9_-]+$/.test(submissionId)) {
    return { status: "error", message: "Invalid Submission ID." };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const priorResponse = findResponse_(submissionId);
    if (priorResponse) {
      const state = getConfirmationState_(submissionId);
      return { status: "success", submissionId, message: "Already recorded.", duplicate: true,
        attendeeCount: Number(priorResponse.numberOfAttendees), emailStatus: state.status,
        emailAttempts: state.attempts };
    }
    // Recover an interrupted earlier write: Guests is written before the legacy
    // submission log and response sheet. If its guest row exists but the dedicated
    // response row does not, reconstruct only the missing response row.
    const existingGuest = findGuestBySubmission_(submissionId);
    if (existingGuest) {
      const ss = getDatabaseSpreadsheet_();
      const responseSheet = ensureSheet_(ss, SHEET_NAMES.RESPONSES, RESPONSE_HEADERS);
      appendByHeaders_(responseSheet, RESPONSE_HEADERS, [
        new Date(existingGuest.submittedAt || new Date()), existingGuest.fullName,
        existingGuest.email, existingGuest.attendanceChoice === "Attending with a Plus-One" ||
        existingGuest.attendanceChoice === "With a Plus One" ? "With a Plus One" : "Alone",
        Number(existingGuest.attendeeCount) || 1, submissionId
      ]);
      SpreadsheetApp.flush();
      const recovered = findResponse_(submissionId);
      if (!recovered) throw new Error("Existing RSVP was found but its response-sheet recovery could not be verified.");
      const state = getConfirmationState_(submissionId);
      return {status:"success", submissionId, duplicate:true, message:"Previously saved RSVP recovered.",
        attendeeCount:Number(recovered.numberOfAttendees), emailStatus:state.status, emailAttempts:state.attempts};
    }
    if (findSubmission_(submissionId)) return { status: "error", submissionId, message: "A partial legacy submission exists without its guest record. No new row was created; administrator review is required." };
    const ss = getDatabaseSpreadsheet_();
    const guestsSheet = ensureSheet_(ss, SHEET_NAMES.GUESTS, GUEST_HEADERS);
    const submissionsSheet = ensureSheet_(ss, SHEET_NAMES.SUBMISSIONS, SUBMISSION_HEADERS);
    const nowIso = new Date().toISOString();
    let row, attendeeCount, representativeName, attendanceChoice, email, guestId, sheetAttendance;
    if (isRepresentativeFormat) {
      representativeName = sanitizeText_(payload.representativeName).replace(/\s+/g, " ");
      attendanceChoice = sanitizeText_(payload.attendanceChoice);
      email = sanitizeText_(payload.email).toLowerCase();
      if (!representativeName) return { status: "error", message: "Representative full name is required." };
      if (representativeName.length > 160) return { status: "error", message: "Name must be 160 characters or fewer." };
      if (!email || !isValidEmail_(email) || email.length > 120) return { status: "error", message: "A valid email address is required." };
      if (attendanceChoice !== "Attending Alone" && attendanceChoice !== "Attending with a Plus-One" &&
          attendanceChoice !== "Alone" && attendanceChoice !== "With a Plus One") {
        return { status: "error", message: "Please select a valid attendance option." };
      }
      sheetAttendance = (attendanceChoice === "Attending with a Plus-One" || attendanceChoice === "With a Plus One")
        ? "With a Plus One" : "Alone";
      attendeeCount = sheetAttendance === "With a Plus One" ? 2 : 1;
      // The server derives the count; a browser-supplied count is ignored.
      guestId = "g_" + Utilities.getUuid();
      const values = {
        "Guest ID": guestId, "Submission ID": submissionId, "Last Name": "",
        "First Name": representativeName, "Middle Name": "", "Email Address": email,
        "Attendance": "Will Attend", "Submitted At": nowIso, "Updated At": nowIso,
        "Confirmation Email Status": "Pending", "Reminder 1 Status": "Not Due",
        "Reminder 2 Status": "Not Due", "Reminder 3 Status": "Not Due",
        "Registration Type": attendanceChoice, "Attendee Count": attendeeCount,
        "Representative Full Name": representativeName
      };
      row = GUEST_HEADERS.map(h => values[h] === undefined ? "" : values[h]);
    } else {
      // Legacy endpoint support: preserve compatibility for old deployed clients.
      if (!Array.isArray(payload.guests) || payload.guests.length < 1 || payload.guests.length > 25) return { status: "error", message: "Invalid guest list." };
      const checked = payload.guests.map(validateGuest_);
      const invalid = checked.find(x => !x.valid);
      if (invalid) return { status: "error", message: invalid.error };
      const oldGuests = checked.map(x => x.guest);
      attendeeCount = oldGuests.filter(g => g.attendance === "Will Attend").length;
      representativeName = oldGuests.map(g => [g.firstName,g.middleName,g.lastName].filter(Boolean).join(" ")).join(", ");
      attendanceChoice = "Legacy registration";
      row = null;
      const rows = oldGuests.map(g => {
        const guestId = "g_" + Utilities.getUuid();
        const values = {"Guest ID":guestId,"Submission ID":submissionId,"Last Name":g.lastName,"First Name":g.firstName,"Middle Name":g.middleName,"Email Address":g.email,"Attendance":g.attendance,"Submitted At":nowIso,"Updated At":nowIso,"Confirmation Email Status":"Not Sent","Reminder 1 Status":"Not Due","Reminder 2 Status":"Not Due","Reminder 3 Status":"Not Due","Registration Type":"Legacy registration","Attendee Count":g.attendance === "Will Attend" ? 1 : 0,"Representative Full Name":[g.firstName,g.middleName,g.lastName].filter(Boolean).join(" ")};
        return GUEST_HEADERS.map(h => values[h] === undefined ? "" : values[h]);
      });
      rows.forEach(function(values) { appendByHeaders_(guestsSheet, GUEST_HEADERS, values); });
      appendByHeaders_(submissionsSheet, SUBMISSION_HEADERS, [submissionId,nowIso,attendeeCount,"Saved",representativeName,attendanceChoice,attendeeCount]);
      SpreadsheetApp.flush();
      return {status:"success",submissionId,guestCount:oldGuests.length,attendeeCount,emailStatus:"Not applicable"};
    }
    appendByHeaders_(guestsSheet, GUEST_HEADERS, row);
    appendByHeaders_(submissionsSheet, SUBMISSION_HEADERS, [submissionId, nowIso, attendeeCount, "Saved", representativeName, attendanceChoice, attendeeCount]);
    const responseSheet = ensureSheet_(ss, SHEET_NAMES.RESPONSES, RESPONSE_HEADERS);
    const responseValues = [new Date(), representativeName, email, sheetAttendance, attendeeCount, submissionId];
    appendByHeaders_(responseSheet, RESPONSE_HEADERS, responseValues);
    // Flush and read the exact submission ID back before reporting success.
    SpreadsheetApp.flush();
    const saved = findResponse_(submissionId);
    if (!saved) throw new Error("The RSVP write could not be verified in RSVP_Responses.");
    return { status: "success", submissionId, guestCount: 1, attendeeCount, emailStatus: "Pending" };
  } catch (err) {
    Logger.log("handleSubmitRsvp_ ERROR: " + (err && err.stack ? err.stack : err));
    return { status: "error", message: "RSVP database error: " + (err && err.message ? err.message : String(err)) };
  } finally { lock.releaseLock(); }
}

function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const map = {};
  headers.forEach(function(header, index) {
    if (header !== "" && header !== null) map[String(header)] = index + 1;
  });
  return map;
}

// Append by column name so existing/custom column order is preserved.
function safeSheetValue_(value) {
  if (typeof value === "string" && /^[=+@\\-]/.test(value)) return "'" + value;
  return value === undefined || value === null ? "" : value;
}

function appendByHeaders_(sheet, requiredHeaders, values) {
  const map = headerMap_(sheet);
  const width = Math.max(sheet.getLastColumn(), 1);
  const row = new Array(width).fill("");
  requiredHeaders.forEach(function(header, index) {
    const column = map[header];
    if (column) row[column - 1] = safeSheetValue_(values[index]);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);
}

function findResponse_(submissionId) {
  const ss = getDatabaseSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAMES.RESPONSES);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const map = headerMap_(sheet);
  const idColumn = map["Submission ID"];
  if (!idColumn) throw new Error('RSVP_Responses is missing the "Submission ID" header.');
  const count = sheet.getLastRow() - 1;
  const ids = sheet.getRange(2, idColumn, count, 1).getValues().flat();
  const offset = ids.indexOf(submissionId);
  if (offset < 0) return null;
  const row = sheet.getRange(offset + 2, 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    timestamp: row[(map["Timestamp"] || 1) - 1],
    fullName: row[(map["Full Name"] || 2) - 1],
    email: row[(map["Email"] || 3) - 1],
    attendance: row[(map["Attendance"] || 4) - 1],
    numberOfAttendees: row[(map["Number of Attendees"] || 5) - 1],
    submissionId: row[idColumn - 1]
  };
}

function findGuestBySubmission_(submissionId) {
  const sheet = getDatabaseSpreadsheet_().getSheetByName(SHEET_NAMES.GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const columns = headerMap_(sheet);
  if (!columns["Submission ID"]) return null;
  const ids = sheet.getRange(2, columns["Submission ID"], sheet.getLastRow() - 1, 1).getValues().flat();
  const offset = ids.indexOf(submissionId);
  if (offset < 0) return null;
  const rowNum = offset + 2;
  const value = function(name) { return columns[name] ? sheet.getRange(rowNum, columns[name]).getValue() : ""; };
  return {
    submittedAt: value("Submitted At"),
    fullName: value("Representative Full Name") || [value("First Name"), value("Middle Name"), value("Last Name")].filter(Boolean).join(" "),
    email: value("Email Address"),
    attendanceChoice: value("Registration Type"),
    attendeeCount: value("Attendee Count")
  };
}

function findSubmission_(submissionId) {
  const sheet = getDatabaseSpreadsheet_().getSheetByName(SHEET_NAMES.SUBMISSIONS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const column = headerMap_(sheet)["Submission ID"];
  if (!column) throw new Error('RSVP_Submissions is missing the "Submission ID" header.');
  const ids = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues().flat();
  return ids.indexOf(submissionId) !== -1 ? submissionId : null;
}

function validateGuest_(raw) {
  const lastName = sanitizeText_(raw && raw.lastName);
  const firstName = sanitizeText_(raw && raw.firstName);
  const middleName = sanitizeText_(raw && raw.middleName) || "";
  const email = sanitizeText_(raw && raw.email) || "";
  const attendance = sanitizeText_(raw && raw.attendance);

  if (!lastName) return { valid: false, error: "Last name is required for all guests." };
  if (!firstName) return { valid: false, error: "First name is required for all guests." };
  if (lastName.length > 80 || firstName.length > 80 || middleName.length > 80) {
    return { valid: false, error: "Name fields must be under 80 characters." };
  }
  if (attendance !== "Will Attend" && attendance !== "Will Not Attend") {
    return { valid: false, error: "Each guest must have a valid attendance response." };
  }
  if (email && !isValidEmail_(email)) {
    return { valid: false, error: "One of the provided email addresses is not valid." };
  }
  if (email.length > 120) {
    return { valid: false, error: "Email address is too long." };
  }

  return { valid: true, guest: { lastName, firstName, middleName, email, attendance } };
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, 500);
}

function updateGuestEmailStatus_(sheet, guestId, columnName, value) {
  const map = headerMap_(sheet);
  if (!map["Guest ID"] || !map[columnName]) throw new Error("Guests sheet is missing a required header.");
  const count = Math.max(sheet.getLastRow() - 1, 0);
  if (!count) return;
  const ids = sheet.getRange(2, map["Guest ID"], count, 1).getValues().flat();
  const offset = ids.indexOf(guestId);
  if (offset < 0) return;
  sheet.getRange(offset + 2, map[columnName]).setValue(value);
  if (map["Updated At"]) sheet.getRange(offset + 2, map["Updated At"]).setValue(new Date().toISOString());
}

/* ===================== EMAIL: CONFIRMATION ===================== */

function sendConfirmationEmail_(guest) {
  const attending = guest.attendance === "Will Attend";
  // Use clear, transactional subject lines rather than promotional wording.
  const subject = attending
    ? `RSVP confirmation: ${EVENT_CONFIG.celebrantName}'s 50th birthday`
    : `RSVP received: ${EVENT_CONFIG.celebrantName}'s 50th birthday`;

  const greeting = `Dear ${guest.firstName},`;
  const body = attending
    ? `Thank you for confirming your attendance. We are delighted that you will be joining us to celebrate this milestone.\n\nAttendance: ${guest.attendanceChoice || "Attending"}\nTotal attendees in your RSVP: ${guest.attendeeCount || 1}.`
    : `Thank you for letting us know you will not be able to attend. We appreciate your response and will miss celebrating with you.`;

  const html = buildEmailHtml_(greeting, body, attending);
  const text = buildEmailText_(greeting, body);

  return sendEmail_(guest.email, subject, text, html);
}

/* ===================== EMAIL: REMINDERS ===================== */

/**
 * Time-driven entry point. Add a trigger for this function to
 * run every 15–30 minutes (Apps Script > Triggers).
 * Designed to be safely re-run: already-sent reminders are
 * skipped via the per-guest status columns, and a script lock
 * prevents concurrent double-processing.
 */
function processReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log("processReminders: could not acquire lock, skipping this run.");
    return;
  }
  try {
    const ss = getDatabaseSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_NAMES.GUESTS);
    if (!sheet || sheet.getLastRow() < 2) return;

    const numRows = sheet.getLastRow() - 1;
    const guestColumns = headerMap_(sheet);
    const data = sheet.getRange(2, 1, numRows, sheet.getLastColumn()).getValues();

    const now = new Date();
    const reminders = [
      { label: "Reminder 1", targetIso: EVENT_CONFIG.reminder1At, statusCol: "Reminder 1 Status", type: "Reminder1_OneDay" },
      { label: "Reminder 2", targetIso: EVENT_CONFIG.reminder2At, statusCol: "Reminder 2 Status", type: "Reminder2_ThreeHour" },
      { label: "Reminder 3", targetIso: EVENT_CONFIG.reminder3At, statusCol: "Reminder 3 Status", type: "Reminder3_OneHour" }
    ];

    reminders.forEach(reminder => {
      const targetDate = parseEventLocalTime_(reminder.targetIso);
      const dueNow = now.getTime() >= targetDate.getTime();
      const tooLate = (now.getTime() - targetDate.getTime()) > REMINDER_MAX_LATE_HOURS * 3600 * 1000;
      if (!dueNow) return;

      data.forEach((row, idx) => {
        const rowNum = idx + 2;
        const attendance = row[guestColumns["Attendance"] - 1];
        const email = row[guestColumns["Email Address"] - 1];
        const guestId = row[guestColumns["Guest ID"] - 1];
        const statusColIdx = guestColumns[reminder.statusCol];
        const currentStatus = row[statusColIdx - 1];

        if (attendance !== "Will Attend") return;           // never remind decliners
        if (!email) return;                                  // no email on file
        if (currentStatus === "Sent") return;                // idempotent: don't resend

        if (tooLate && currentStatus !== "Sent") {
          sheet.getRange(rowNum, statusColIdx).setValue("Missed");
          return;
        }

        const guest = {
          firstName: row[guestColumns["Representative Full Name"] - 1] || row[guestColumns["First Name"] - 1],
          lastName: row[guestColumns["Last Name"] - 1],
          email
        };
        const result = sendReminderEmail_(guest, reminder.label);
        sheet.getRange(rowNum, statusColIdx).setValue(result.ok ? "Sent" : "Failed");
        logEmailAttempt_(guestId, email, reminder.type, result.ok, result.error);
      });
    });
  } catch (err) {
    Logger.log("processReminders error: " + err);
  } finally {
    lock.releaseLock();
  }
}

function sendReminderEmail_(guest, label) {
  const subject = `Event reminder: ${EVENT_CONFIG.celebrantName}'s 50th birthday`;
  const greeting = `Dear ${guest.firstName},`;
  let body;
  if (label === "Reminder 1") {
    body = `This is a friendly reminder that the celebration is tomorrow.`;
  } else if (label === "Reminder 2") {
    body = `This is a friendly reminder that the celebration begins at ${EVENT_CONFIG.eventTimeDisplay} today.`;
  } else {
    body = `The celebration begins in about one hour. We look forward to seeing you soon.`;
  }
  const html = buildEmailHtml_(greeting, body, true);
  const text = buildEmailText_(greeting, body);
  return sendEmail_(guest.email, subject, text, html);
}

/* ===================== EMAIL TEMPLATES & SENDING ===================== */

function buildEmailHtml_(greeting, bodyText, attending) {
  return `
  <div style="background:#101010;padding:32px 16px;font-family:'Times New Roman',Georgia,serif;">
    <div style="max-width:520px;margin:0 auto;background:#181818;border:1px solid #D4AF37;border-radius:10px;padding:32px;color:#FFF8E8;">
      <p style="letter-spacing:3px;text-transform:uppercase;color:#D4AF37;font-size:12px;margin:0 0 18px;">You Are Cordially Invited To</p>
      <h1 style="color:#F0D779;font-size:24px;margin:0 0 4px;">${escapeHtml_(EVENT_CONFIG.celebrantName)}'s</h1>
      <h2 style="color:#F0D779;font-size:22px;margin:0 0 20px;">${escapeHtml_(EVENT_CONFIG.occasion)}</h2>
      <p style="color:#FFF8E8;font-size:15px;">${escapeHtml_(greeting)}</p>
      <p style="color:#D7D0C0;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml_(bodyText)}</p>
      <table style="width:100%;margin:22px 0;border-top:1px solid rgba(212,175,55,.3);border-bottom:1px solid rgba(212,175,55,.3);padding:16px 0;">
        <tr><td style="color:#D4AF37;font-size:13px;padding:4px 0;">Date</td><td style="color:#FFF8E8;font-size:13px;text-align:right;">${escapeHtml_(EVENT_CONFIG.eventDateDisplay)}</td></tr>
        <tr><td style="color:#D4AF37;font-size:13px;padding:4px 0;">Time</td><td style="color:#FFF8E8;font-size:13px;text-align:right;">${escapeHtml_(EVENT_CONFIG.eventTimeDisplay)}</td></tr>
        <tr><td style="color:#D4AF37;font-size:13px;padding:4px 0;">Venue</td><td style="color:#FFF8E8;font-size:13px;text-align:right;">${escapeHtml_(EVENT_CONFIG.venue)}<br>${escapeHtml_(EVENT_CONFIG.venueAddress)}</td></tr>
        <tr><td style="color:#D4AF37;font-size:13px;padding:4px 0;">Attire</td><td style="color:#FFF8E8;font-size:13px;text-align:right;">${escapeHtml_(EVENT_CONFIG.colorTheme)}</td></tr>
      </table>
      <p style="text-align:center;margin:24px 0 0;">
        <a href="${EVENT_CONFIG.mapUrl}" style="display:inline-block;background:#D4AF37;color:#1a1308;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">View Venue on Google Maps</a>
      </p>
    </div>
  </div>`;
}

function buildEmailText_(greeting, bodyText) {
  return [
    `${EVENT_CONFIG.celebrantName}'s ${EVENT_CONFIG.occasion}`,
    "",
    greeting,
    bodyText,
    "",
    `Date: ${EVENT_CONFIG.eventDateDisplay}`,
    `Time: ${EVENT_CONFIG.eventTimeDisplay}`,
    `Venue: ${EVENT_CONFIG.venue}`,
    `Address: ${EVENT_CONFIG.venueAddress}`,
    `Attire: ${EVENT_CONFIG.colorTheme}`,
    `Map: ${EVENT_CONFIG.mapUrl}`
  ].join("\n");
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Sends email via MailApp. Returns { ok, error }.
 * Note: this reports whether the Apps Script mail service
 * *accepted* the message for sending — not confirmed inbox
 * delivery, which Apps Script cannot verify.
 */
function sendEmail_(to, subject, text, html) {
  if (TEST_MODE_NO_EMAIL) {
    Logger.log("TEST_MODE_NO_EMAIL: would send to " + to + " — " + subject);
    return { ok: true, error: "" };
  }
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: text,
      htmlBody: html,
      name: `${EVENT_CONFIG.celebrantName} — Birthday RSVP`
    });
    return { ok: true, error: "" };
  } catch (err) {
    Logger.log("sendEmail_ error to " + to + ": " + err);
    return { ok: false, error: String(err) };
  }
}

function logEmailAttempt_(guestId, email, type, ok, error) {
  const ss = getDatabaseSpreadsheet_();
  const sheet = ensureSheet_(ss, SHEET_NAMES.EMAIL_LOG, EMAIL_LOG_HEADERS);
  appendByHeaders_(sheet, EMAIL_LOG_HEADERS, [
    "log_" + Utilities.getUuid(), guestId, email, type,
    new Date().toISOString(), ok ? "Sent" : "Failed", error || ""
  ]);
}

/* ===================== TIME HELPERS ===================== */

/**
 * Parses a "YYYY-MM-DDTHH:mm:ss" string as wall-clock time in
 * EVENT_CONFIG.timeZone and returns the equivalent Date.
 */
function parseEventLocalTime_(isoLocal) {
  // Apps Script runs with the script's project time zone; to be
  // robust regardless of project TZ setting, build the date via
  // Utilities with an explicit target time zone offset lookup.
  const [datePart, timePart] = isoLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);

  // Construct using the Asia/Manila fixed UTC+8 offset (no DST).
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm, ss || 0) - (8 * 3600 * 1000);
  return new Date(utcMillis);
}
