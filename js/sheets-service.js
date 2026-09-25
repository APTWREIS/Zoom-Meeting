// =========================================================
// APTWREIS (Gurukulam) - Google Sheets Sync Service
// =========================================================
// Connects frontend to Google Sheets Web App for 100% centralized,
// cross-device synchronization of Zoom meetings & live attendance.
// =========================================================

const SheetsService = {
  isConfigured() {
    const url = window.getSheetsUrl ? window.getSheetsUrl() : '';
    return Boolean(url && url.startsWith('http'));
  },

  // Test connection to Google Apps Script Web App
  async testConnection(customUrl) {
    const url = (customUrl || (window.getSheetsUrl ? window.getSheetsUrl() : '')).trim();
    if (!url || !url.startsWith('http')) {
      return { success: false, error: 'Please enter a valid Google Apps Script Web App URL starting with https://' };
    }

    try {
      const pingUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
      const res = await fetch(pingUrl, { method: 'GET', mode: 'cors' });
      if (!res.ok) {
        return { success: false, error: `HTTP error ${res.status}: ${res.statusText}` };
      }
      const data = await res.json();
      if (data && data.success) {
        if (data.spreadsheetUrl) {
          try {
            localStorage.setItem(window.GOOGLE_SHEETS_CONFIG.spreadsheetUrlKey, data.spreadsheetUrl);
          } catch (e) { }
        }
        return {
          success: true,
          message: data.message || 'Connected successfully!',
          spreadsheetTitle: data.spreadsheetTitle || 'APTWREIS Meetings Spreadsheet',
          spreadsheetUrl: data.spreadsheetUrl || ''
        };
      } else {
        return { success: false, error: (data && data.error) ? data.error : 'Invalid response from Google Apps Script' };
      }
    } catch (err) {
      return {
        success: false,
        error: `Could not connect to Google Apps Script (${err.message}). Ensure Web App deployment is set to "Anyone" and permissions are granted.`
      };
    }
  },

  // Fetch all meetings from Google Sheets
  async getMeetings() {
    if (!this.isConfigured()) {
      return this._getLocalMeetings();
    }

    const url = window.getSheetsUrl();
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'action=getMeetings&t=' + Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors', signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.meetings)) {
          // Update local cache
          try {
            localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(data.meetings));
          } catch (e) { }
          return data.meetings;
        }
      }
    } catch (err) {
      console.warn('[SheetsService] Failed to fetch meetings from Google Sheets, using local cache:', err.message);
    }

    return this._getLocalMeetings();
  },

  // Save/Create meeting to Google Sheets
  async saveMeeting(meeting) {
    // Save to local cache first for instant feedback
    const local = this._getLocalMeetings();
    const idx = local.findIndex(m => m.id === meeting.id);
    if (idx !== -1) {
      local[idx] = meeting;
    } else {
      local.unshift(meeting);
    }
    try {
      localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(local));
    } catch (e) { }

    if (!this.isConfigured()) return { success: true, localOnly: true, meeting };

    const url = window.getSheetsUrl();
    const payload = { action: 'createMeeting', meeting: meeting };

    try {
      // Send as text/plain to avoid CORS OPTIONS preflight issues with Google Apps Script
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[SheetsService] POST save meeting failed, trying GET fallback:', err.message);
      try {
        const fallbackUrl = url + (url.includes('?') ? '&' : '?') + 'action=createMeeting&data=' + encodeURIComponent(JSON.stringify(meeting)) + '&t=' + Date.now();
        const res2 = await fetch(fallbackUrl, { method: 'GET', mode: 'cors' });
        return await res2.json();
      } catch (err2) {
        console.error('[SheetsService] Could not save meeting to Google Sheets:', err2);
        return { success: false, error: err2.message };
      }
    }
  },

  // Delete meeting from Google Sheets
  async deleteMeeting(meetingId) {
    // Update local cache
    let local = this._getLocalMeetings();
    local = local.filter(m => m.id !== meetingId);
    try {
      localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(local));
      localStorage.removeItem('zoom_attendance_' + meetingId);
    } catch (e) { }

    if (!this.isConfigured()) return { success: true, localOnly: true };

    const url = window.getSheetsUrl();
    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMeeting', meeting_id: meetingId })
      });
      return await res.json();
    } catch (err) {
      console.error('[SheetsService] Failed to delete meeting from Google Sheets:', err);
      return { success: false, error: err.message };
    }
  },

  // Record Attendance to Google Sheets
  async recordAttendance(record) {
    const meetingId = record.meeting_id;
    // Update local cache first
    try {
      const key = 'zoom_attendance_' + meetingId;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const existingIdx = list.findIndex(a =>
        (a.id && a.id === record.id) ||
        (a.attendee_name && a.attendee_name.toLowerCase() === record.attendee_name.toLowerCase()) ||
        (record.school_code && record.school_code !== '-' && a.school_code === record.school_code)
      );
      if (existingIdx !== -1) {
        list[existingIdx] = record;
      } else {
        list.unshift(record);
      }
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) { }

    if (!this.isConfigured()) return { success: true, localOnly: true, attendance: record };

    const url = window.getSheetsUrl();
    const payload = { action: 'recordAttendance', attendance: record };

    try {
      // POST with text/plain (CORS safe)
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[SheetsService] Attendance POST failed, attempting GET fallback:', err.message);
      try {
        const fallbackUrl = url + (url.includes('?') ? '&' : '?') + 'action=recordAttendance&data=' + encodeURIComponent(JSON.stringify(record)) + '&t=' + Date.now();
        const res2 = await fetch(fallbackUrl, { method: 'GET', mode: 'cors' });
        return await res2.json();
      } catch (err2) {
        console.error('[SheetsService] Failed to record attendance to Google Sheets:', err2);
        return { success: false, error: err2.message };
      }
    }
  },

  // Fetch live attendance for a specific meeting
  async getAttendance(meetingId) {
    if (!meetingId) return [];

    if (!this.isConfigured()) {
      return this._getLocalAttendance(meetingId);
    }

    const url = window.getSheetsUrl();
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'action=getAttendance&meeting_id=' + encodeURIComponent(meetingId) + '&t=' + Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors', signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.attendance)) {
          // Update local cache
          try {
            localStorage.setItem('zoom_attendance_' + meetingId, JSON.stringify(data.attendance));
          } catch (e) { }
          return data.attendance;
        }
      }
    } catch (err) {
      console.warn('[SheetsService] Failed to fetch live attendance from Google Sheets, using local cache:', err.message);
    }

    return this._getLocalAttendance(meetingId);
  },

  // Delete attendee record
  async deleteAttendee(meetingId, attendeeId) {
    // Remove locally
    try {
      const key = 'zoom_attendance_' + meetingId;
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.filter(a => a.id !== attendeeId);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) { }

    if (!this.isConfigured()) return { success: true, localOnly: true };

    const url = window.getSheetsUrl();
    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteAttendance', attendance_id: attendeeId })
      });
      return await res.json();
    } catch (err) {
      console.error('[SheetsService] Failed to delete attendance from Google Sheets:', err);
      return { success: false, error: err.message };
    }
  },

  // Internal local storage helpers
  _getLocalMeetings() {
    const raw = localStorage.getItem('zoom_scheduled_meetings');
    const LEGACY_DEFAULT_IDS = ['81896937907', '81944027831', '86333953207', 'demo-sync'];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(m => m && !LEGACY_DEFAULT_IDS.includes(m.id));
        }
      } catch (e) { }
    }
    return [];
  },

  _getLocalAttendance(meetingId) {
    if (!meetingId) return [];
    try {
      const raw = localStorage.getItem('zoom_attendance_' + meetingId);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return [];
  }
};

window.SheetsService = SheetsService;
