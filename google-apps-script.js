/**
 * APTWREIS (Gurukulam) - Official Meetings & Live Attendance Google Sheets Backend
 * ---------------------------------------------------------------------------------
 * This Google Apps Script acts as the cloud database (live Excel spreadsheet)
 * for the APTWREIS Zoom Meetings & Attendance Portal.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets (https://sheets.new) and name it: "APTWREIS Zoom Meetings & Attendance"
 * 2. In Google Sheets, click: Extensions > Apps Script
 * 3. Delete any code in the editor, paste this entire file, and click Save (Ctrl+S / Cmd+S).
 * 4. Click: Deploy > New deployment
 * 5. Click the gear icon (Select type) > Choose "Web app"
 * 6. Set Description: "APTWREIS Meetings API"
 * 7. Set "Execute as": "Me" (your email)
 * 8. Set "Who has access": "Anyone"  <-- CRITICAL! Allows all attendees to sync without logging in.
 * 9. Click "Deploy" and authorize permissions if prompted.
 * 10. Copy the "Web app URL" and paste it into the Admin Portal (admin.html) or js/sheets-config.js.
 */

// Initialize sheets with formatted headers if they don't exist
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Meetings Sheet
  let meetingsSheet = ss.getSheetByName("Meetings");
  if (!meetingsSheet) {
    meetingsSheet = ss.insertSheet("Meetings");
    const mHeaders = [
      "Meeting ID", 
      "Meeting Topic / Title", 
      "Zoom URL", 
      "Passcode", 
      "Scheduled Time Text", 
      "Grace (Mins)", 
      "Official Note / Description", 
      "Created At", 
      "Scheduled At ISO"
    ];
    meetingsSheet.appendRow(mHeaders);
    meetingsSheet.getRange(1, 1, 1, mHeaders.length)
      .setBackground("#1e3a8a")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    meetingsSheet.setFrozenRows(1);
    meetingsSheet.autoResizeColumns(1, mHeaders.length);
  }

  // 2. Attendance Sheet
  let attSheet = ss.getSheetByName("Attendance");
  if (!attSheet) {
    attSheet = ss.insertSheet("Attendance");
    const aHeaders = [
      "Attendee ID", 
      "Meeting ID", 
      "Officer / Attendee Name", 
      "UDISE Code", 
      "Designation", 
      "Status", 
      "Joined At (IST)", 
      "Joined At (ISO)", 
      "Device"
    ];
    attSheet.appendRow(aHeaders);
    attSheet.getRange(1, 1, 1, aHeaders.length)
      .setBackground("#059669")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    attSheet.setFrozenRows(1);
    attSheet.autoResizeColumns(1, aHeaders.length);
    // Format UDISE column as plain text to avoid scientific notation
    attSheet.getRange("D:D").setNumberFormat("@");
  }

  // Remove default Sheet1 if empty
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }
}

// GET Handler - Handles fetching meetings, attendance, ping, or fallback submissions
function doGet(e) {
  try {
    initSpreadsheet();
    const action = e.parameter.action || "getMeetings";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Ping / Test Connection
    if (action === "ping") {
      return jsonResponse({
        success: true,
        message: "Google Sheets Web App is online and connected!",
        spreadsheetTitle: ss.getName(),
        spreadsheetUrl: ss.getUrl()
      });
    }

    // 2. Get All Meetings
    if (action === "getMeetings") {
      const meetings = readMeetings(ss);
      return jsonResponse({ success: true, meetings: meetings });
    }

    // 3. Get Attendance for a Meeting
    if (action === "getAttendance") {
      const meetingId = e.parameter.meeting_id || e.parameter.meetingId || "";
      const attendance = readAttendance(ss, meetingId);
      return jsonResponse({ success: true, attendance: attendance, meetingId: meetingId });
    }

    // 4. Get Both in one request (Fast Init)
    if (action === "getAll") {
      const meetings = readMeetings(ss);
      const meetingId = e.parameter.meeting_id || "";
      const attendance = readAttendance(ss, meetingId);
      return jsonResponse({ success: true, meetings: meetings, attendance: attendance });
    }

    // 5. Fallback Save via GET (for networks blocking POST)
    if (action === "recordAttendance" && e.parameter.data) {
      const data = JSON.parse(e.parameter.data);
      const res = recordAttendanceRow(ss, data);
      return jsonResponse({ success: true, record: res });
    }

    if (action === "createMeeting" && e.parameter.data) {
      const data = JSON.parse(e.parameter.data);
      const res = saveMeetingRow(ss, data);
      return jsonResponse({ success: true, meeting: res });
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// POST Handler - Handles creating/updating meetings, recording attendance, deleting
function doPost(e) {
  try {
    initSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action;

    // 1. Create or Update Meeting
    if (action === "createMeeting" || action === "saveMeeting") {
      const meetingData = payload.meeting || payload;
      const saved = saveMeetingRow(ss, meetingData);
      return jsonResponse({ success: true, meeting: saved });
    }

    // 2. Delete Meeting
    if (action === "deleteMeeting") {
      const meetingId = String(payload.meeting_id || payload.id || "");
      const deleted = deleteMeetingRow(ss, meetingId);
      return jsonResponse({ success: true, deleted: deleted });
    }

    // 3. Record Attendance
    if (action === "recordAttendance") {
      const attData = payload.attendance || payload;
      const recorded = recordAttendanceRow(ss, attData);
      return jsonResponse({ success: true, attendance: recorded });
    }

    // 4. Delete Attendance Record
    if (action === "deleteAttendance") {
      const attId = String(payload.attendance_id || payload.id || "");
      const deleted = deleteAttendanceRow(ss, attId);
      return jsonResponse({ success: true, deleted: deleted });
    }

    return jsonResponse({ success: false, error: "Unknown POST action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ==========================================
// Helper Functions: Read & Write Sheets
// ==========================================

function readMeetings(ss) {
  const sheet = ss.getSheetByName("Meetings");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return []; // Only headers

  const meetings = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || "").trim();
    if (!id) continue;

    meetings.push({
      id: id,
      title: String(row[1] || ""),
      zoom_url: String(row[2] || ""),
      meeting_passcode: String(row[3] || ""),
      meeting_time_text: String(row[4] || ""),
      grace_period_mins: parseInt(row[5]) || 15,
      description: String(row[6] || ""),
      created_at: row[7] ? String(row[7]) : new Date().toISOString(),
      scheduled_at: row[8] ? String(row[8]) : new Date().toISOString()
    });
  }
  return meetings;
}

function saveMeetingRow(ss, meeting) {
  const sheet = ss.getSheetByName("Meetings");
  const meetingId = String(meeting.id || "").trim();
  if (!meetingId) throw new Error("Meeting ID is required");

  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === meetingId) {
      rowIndex = i + 1; // 1-based index in Google Sheets
      break;
    }
  }

  const rowData = [
    "'" + meetingId, // Prefix quote to prevent numeric formatting loss
    meeting.title || "Official Zoom Meeting",
    meeting.zoom_url || "",
    "'" + (meeting.meeting_passcode || ""),
    meeting.meeting_time_text || "",
    parseInt(meeting.grace_period_mins) || 15,
    meeting.description || "",
    meeting.created_at || new Date().toISOString(),
    meeting.scheduled_at || new Date().toISOString()
  ];

  if (rowIndex !== -1) {
    // Update existing row
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Append new row
    sheet.appendRow(rowData);
  }

  return meeting;
}

function deleteMeetingRow(ss, meetingId) {
  const sheet = ss.getSheetByName("Meetings");
  if (!sheet) return false;
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim() === meetingId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function readAttendance(ss, meetingId) {
  const sheet = ss.getSheetByName("Attendance");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const list = [];
  const targetMid = meetingId ? String(meetingId).trim() : "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowMid = String(row[1] || "").trim();
    if (targetMid && rowMid !== targetMid) continue;

    const id = String(row[0] || "").trim();
    if (!id) continue;

    list.push({
      id: id,
      meeting_id: rowMid,
      attendee_name: String(row[2] || ""),
      school_code: String(row[3] || "").replace(/^'/, ""),
      designation: String(row[4] || ""),
      status: String(row[5] || "ON_TIME"),
      joined_at: row[7] ? String(row[7]) : (row[6] ? String(row[6]) : new Date().toISOString()),
      device: String(row[8] || "Web Browser")
    });
  }

  // Reverse so latest joiners appear first
  return list.reverse();
}

function recordAttendanceRow(ss, att) {
  const sheet = ss.getSheetByName("Attendance");
  const meetingId = String(att.meeting_id || "").trim();
  const name = String(att.attendee_name || "").trim();
  const code = String(att.school_code || "").trim();

  if (!name) throw new Error("Attendee Name is required");

  const rows = sheet.getDataRange().getValues();
  let existingRow = -1;

  for (let i = 1; i < rows.length; i++) {
    const rowMid = String(rows[i][1]).trim();
    const rowName = String(rows[i][2]).trim();
    const rowCode = String(rows[i][3]).replace(/^'/, "").trim();

    if (rowMid === meetingId && (
      rowName.toLowerCase() === name.toLowerCase() ||
      (code && code !== "-" && rowCode === code)
    )) {
      existingRow = i + 1;
      break;
    }
  }

  const now = new Date();
  const istTimeStr = Utilities.formatDate(now, "Asia/Kolkata", "dd/MM/yyyy, hh:mm:ss a") + " IST";
  const isoTimeStr = att.joined_at || now.toISOString();

  const id = att.id || ("att_" + now.getTime().toString(36) + Math.random().toString(36).substr(2, 4));

  const rowData = [
    id,
    "'" + meetingId,
    name,
    "'" + code,
    att.designation || "Officer / Staff",
    att.status || "ON_TIME",
    istTimeStr,
    isoTimeStr,
    att.device || "Web Browser"
  ];

  if (existingRow !== -1) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return {
    id: id,
    meeting_id: meetingId,
    attendee_name: name,
    school_code: code,
    designation: att.designation || "Officer / Staff",
    status: att.status || "ON_TIME",
    joined_at: isoTimeStr,
    device: att.device || "Web Browser"
  };
}

function deleteAttendanceRow(ss, attId) {
  const sheet = ss.getSheetByName("Attendance");
  if (!sheet) return false;
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim() === attId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
