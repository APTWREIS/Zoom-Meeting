// APTWREIS (Gurukulam) - User Attendance & Zoom Launcher Controller
// 100% Pure Vanilla JavaScript (Zero Dependencies, Standalone)

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramMid = urlParams.get('mid') || urlParams.get('meetingId');
  const paramName = urlParams.get('name') || urlParams.get('attendee_name');
  const paramCode = urlParams.get('code') || urlParams.get('udise') || urlParams.get('roll') || urlParams.get('id');
  const paramDesig = urlParams.get('desig') || urlParams.get('designation') || '';

  // Legacy default demo meeting IDs to purge if found in localStorage
  const LEGACY_DEFAULT_IDS = ['81896937907', '81944027831', '86333953207', 'demo-sync'];

  // Retrieve all meetings from localStorage (clean slate, no fake defaults)
  function getAllMeetings() {
    const raw = localStorage.getItem('zoom_scheduled_meetings');
    let meetings = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out legacy default mock meetings if present
          meetings = parsed.filter(m => m && !LEGACY_DEFAULT_IDS.includes(m.id));
          if (meetings.length !== parsed.length) {
            localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(meetings));
          }
        }
      } catch (e) { }
    }
    return meetings;
  }

  // Find initial meeting (priority: URL param -> first sorted: Present -> Upcoming -> Over)
  function getMeeting() {
    const all = getAllMeetings();
    if (!all.length) return null;
    const sorted = sortMeetingsByStatus(all);
    if (paramMid) {
      return sorted.find(m => m.id === paramMid) || sorted[0];
    }
    return sorted[0];
  }

  let meeting = getMeeting();

  // DOM Elements
  const displayTopic = document.getElementById('displayTopic');
  const displayTime = document.getElementById('displayTime');
  const displayMeetingId = document.getElementById('displayMeetingId');
  const displayPasscode = document.getElementById('displayPasscode');
  const displayDescription = document.getElementById('displayDescription');

  const formUserJoin = document.getElementById('formUserJoin');
  const inputName = document.getElementById('userName');
  const inputCode = document.getElementById('userCode');
  const inputDesig = document.getElementById('userDesig');

  const autoOverlay = document.getElementById('autoOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayAttendee = document.getElementById('overlayAttendee');
  const overlayStatus = document.getElementById('overlayStatus');
  const overlayCountdown = document.getElementById('overlayCountdown');
  const overlayProgress = document.getElementById('overlayProgress');
  const btnDirectZoom = document.getElementById('btnDirectZoom');

  // Live IST Clock
  const clockText = document.getElementById('liveClockText');
  if (clockText) {
    function updateClock() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      clockText.textContent = `${dateStr} • ${timeStr} IST`;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // =========================================================
  // Smart Meeting Date & Time Parser
  // Supports: 'Sep 16, 2026 03:30 PM India', 'Today at 03:30 PM', 'Tomorrow 10:00 AM', '17:30', ISO dates
  // =========================================================
  function parseMeetingDateTime(timeText, fallbackDate) {
    const now = new Date();
    if (timeText) {
      let clean = String(timeText).replace(/\b(india|ist)\b/gi, '').trim();

      // Check 'today' or 'today at'
      if (/^today\s*(at)?\s*/i.test(clean)) {
        const rest = clean.replace(/^today\s*(at)?\s*/i, '').trim();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        clean = todayStr + ' ' + rest;
      }
      // Check 'tomorrow' or 'tomorrow at'
      else if (/^tomorrow\s*(at)?\s*/i.test(clean)) {
        const tom = new Date(now.getTime() + 86400000);
        const rest = clean.replace(/^tomorrow\s*(at)?\s*/i, '').trim();
        const tomStr = tom.getFullYear() + '-' + String(tom.getMonth() + 1).padStart(2, '0') + '-' + String(tom.getDate()).padStart(2, '0');
        clean = tomStr + ' ' + rest;
      }
      // Check simple time only e.g. '03:30 PM' or '17:30'
      else if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(clean)) {
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        clean = todayStr + ' ' + clean;
      }

      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d;
    }

    if (fallbackDate) {
      const d = new Date(fallbackDate);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  // =========================================================
  // =========================================================
  // Dynamic Time Status Calculator
  // Evaluates status of time vs scheduled meeting time:
  // 1: PRESENT (Live Now / In Progress / Live Soon)
  // 2: UPCOMING (Future: today, tomorrow, upcoming dates)
  // 3: OVER (Past / Concluded)
  // =========================================================
  function getTimeStatus(m) {
    const dt = parseMeetingDateTime(m && m.meeting_time_text, m && (m.scheduled_at || m.created_at));

    if (!dt) {
      return {
        priority: 2,
        category: 'UPCOMING',
        categoryLabel: 'Upcoming',
        badgeClass: 'badge-completed',
        label: '● Scheduled Session',
        desc: 'Scheduled',
        dt: null
      };
    }

    const now = new Date();
    const diffMs = dt.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));

    // 1. Present / Live Window: within 15 minutes before scheduled start up to 2 hours after start
    if (diffMins <= 15 && diffMins >= -120) {
      let label = '🟢 Live Now';
      if (diffMins > 0) label = `🟢 Live Soon (in ${diffMins}m)`;
      else if (diffMins < 0) label = `🟢 Live Now (${Math.abs(diffMins)}m in)`;

      return {
        priority: 1,
        category: 'PRESENT',
        categoryLabel: 'Present / Live',
        badgeClass: 'badge-on-time',
        label,
        desc: diffMins > 0 ? 'Starting soon' : 'Meeting in progress',
        dt,
        diffMs
      };
    }

    // 2. Upcoming in future (> 15 mins away)
    if (diffMins > 15) {
      let label = '';
      if (diffMins < 60) {
        label = `⏳ Starts in ${diffMins}m`;
      } else if (diffHours < 24) {
        const isToday = dt.toDateString() === now.toDateString();
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        label = `🕒 ${isToday ? 'Today' : 'Tomorrow'} at ${timeStr}`;
      } else {
        const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        label = `📅 ${dateStr} ${timeStr}`;
      }

      return {
        priority: 2,
        category: 'UPCOMING',
        categoryLabel: 'Upcoming',
        badgeClass: 'badge-upcoming',
        label,
        desc: 'Scheduled',
        dt,
        diffMs
      };
    }

    // 3. Over / Concluded (> 2 hours after scheduled time)
    const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return {
      priority: 3,
      category: 'OVER',
      categoryLabel: 'Over / Concluded',
      badgeClass: 'badge-completed',
      label: `✓ Concluded (${dateStr})`,
      desc: 'Past Session',
      dt,
      diffMs
    };
  }

  // =========================================================
  // Meeting Sorting Engine:
  // Strictly arranges:
  // 1st: Present (Live Now)
  // 2nd: Upcoming (Chronological order)
  // 3rd: Over / Concluded (Most recent first)
  // =========================================================
  function sortMeetingsByStatus(meetingsList) {
    return [...meetingsList].sort((a, b) => {
      const statusA = getTimeStatus(a);
      const statusB = getTimeStatus(b);

      // 1. Order by Category Priority: 1 (PRESENT) < 2 (UPCOMING) < 3 (OVER)
      if (statusA.priority !== statusB.priority) {
        return statusA.priority - statusB.priority;
      }

      // 2. Tie-breakers:
      if (statusA.priority === 1) {
        const timeA = statusA.dt ? statusA.dt.getTime() : 0;
        const timeB = statusB.dt ? statusB.dt.getTime() : 0;
        return timeA - timeB;
      }

      if (statusA.priority === 2) {
        const timeA = statusA.dt ? statusA.dt.getTime() : Infinity;
        const timeB = statusB.dt ? statusB.dt.getTime() : Infinity;
        return timeA - timeB;
      }

      if (statusA.priority === 3) {
        const timeA = statusA.dt ? statusA.dt.getTime() : 0;
        const timeB = statusB.dt ? statusB.dt.getTime() : 0;
        return timeB - timeA;
      }

      return 0;
    });
  }

  // DOM Elements for Dynamic Status
  const activeSessionBadge = document.getElementById('activeSessionBadge');
  const displayTimeStatus = document.getElementById('displayTimeStatus');

  // Populate Meeting Information
  function populateMeetingDetails(m) {
    meeting = m;
    const btnSubmitJoin = document.getElementById('btnSubmitJoin');

    if (!m) {
      if (displayTopic) displayTopic.textContent = 'No Active Zoom Meeting Scheduled';
      if (displayTime) displayTime.textContent = '—';
      if (displayMeetingId) displayMeetingId.textContent = '—';
      if (displayPasscode) displayPasscode.textContent = '—';
      if (displayDescription) {
        displayDescription.textContent = 'There are currently no scheduled Zoom meetings. Official session details and attendance logging will appear here when a meeting is convened by Secretary or IT-WING.';
      }
      if (activeSessionBadge) {
        activeSessionBadge.className = 'badge badge-completed';
        activeSessionBadge.textContent = 'No Active Session';
      }
      if (displayTimeStatus) {
        displayTimeStatus.innerHTML = `
          <span class="badge badge-completed" style="font-size: 0.82rem; padding: 0.25rem 0.65rem;">
            ● No Active Session
          </span>
        `;
      }
      if (btnSubmitJoin) {
        btnSubmitJoin.disabled = true;
        btnSubmitJoin.style.opacity = '0.6';
        btnSubmitJoin.style.cursor = 'not-allowed';
        btnSubmitJoin.textContent = '⚠️ No Meeting Scheduled';
      }
      return;
    }

    if (btnSubmitJoin) {
      btnSubmitJoin.disabled = false;
      btnSubmitJoin.style.opacity = '1';
      btnSubmitJoin.style.cursor = 'pointer';
      btnSubmitJoin.textContent = '🚀 Mark Attendance & Join Zoom Meeting';
    }

    const timeStatus = getTimeStatus(m);

    if (displayTopic) displayTopic.textContent = m.title;
    if (displayTime) displayTime.textContent = m.meeting_time_text || 'Scheduled Session';
    if (displayMeetingId) displayMeetingId.textContent = m.id;
    if (displayPasscode) displayPasscode.textContent = m.meeting_passcode || 'None';

    // Format clean official message without duplicating topic & time headers
    if (displayDescription) {
      let desc = m.description || '';
      // If desc contains redundant raw invitation with Topic: and Time:, clean it up
      if (desc.includes('Topic:') && desc.includes('Time:')) {
        const regardsPart = desc.match(/(With Regards[\s\S]*)/i);
        if (regardsPart) {
          desc = `Sir/Madam,\nSecretary APTWREIS(Gurukulam) is inviting you to attend this official Zoom meeting.\n\n${regardsPart[1]}`;
        }
      }
      displayDescription.textContent = desc || 'Secretary APTWREIS(Gurukulam) scheduled Zoom meeting.\nAttendance is logged automatically upon entering the session.';
    }

    if (activeSessionBadge) {
      activeSessionBadge.className = `badge ${timeStatus.badgeClass}`;
      activeSessionBadge.textContent = timeStatus.label;
    }

    if (displayTimeStatus) {
      displayTimeStatus.innerHTML = `
        <span class="badge ${timeStatus.badgeClass}" style="font-size: 0.82rem; padding: 0.25rem 0.65rem;">
          ${timeStatus.label}
        </span>
      `;
    }

    // Admin Session Controls in Briefing Card
    const briefingAdminActions = document.getElementById('briefingAdminActions');
    if (briefingAdminActions) {
      if (isAdminLoggedIn() && m) {
        briefingAdminActions.innerHTML = `
          <a 
            href="admin.html?select=${encodeURIComponent(m.id)}" 
            class="btn btn-secondary btn-sm"
            title="Inspect Live Attendance Roster & Download Excel for this meeting"
            style="font-size: 0.74rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.25rem;"
          >
            📋 Live Attendance Roster
          </a>
          <button 
            type="button" 
            class="btn btn-danger-subtle btn-sm" 
            onclick="deleteMeetingAsAdmin('${m.id}')"
            title="Delete this scheduled meeting session (Admin)"
            style="font-size: 0.74rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.25rem;"
          >
            🗑️ Delete Session
          </button>
        `;
      } else {
        briefingAdminActions.innerHTML = '';
      }
    }
  }

  // Admin login detection helper
  function isAdminLoggedIn() {
    return sessionStorage.getItem('aptwreis_admin_auth') === 'true' ||
      localStorage.getItem('aptwreis_admin_auth') === 'true';
  }

  // Render Redesigned Scheduled Sessions Hub (First Present, Next Upcoming, Next Over)
  const sessionsGridContainer = document.getElementById('sessionsGridContainer');
  const sessionCountBadge = document.getElementById('sessionCountBadge');

  function renderSessionsHub() {
    if (!sessionsGridContainer) return;
    const all = getAllMeetings();
    const sorted = sortMeetingsByStatus(all);
    const isAdmin = isAdminLoggedIn();

    const hubAdminStatusBadge = document.getElementById('hubAdminStatusBadge');
    if (hubAdminStatusBadge) {
      hubAdminStatusBadge.innerHTML = isAdmin ? `
        <span class="badge" style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.3rem;">
          🔒 Admin Mode Active
        </span>
      ` : '';
    }

    if (sessionCountBadge) {
      sessionCountBadge.textContent = `${sorted.length} ${sorted.length === 1 ? 'Session Available' : 'Sessions Available'}`;
      sessionCountBadge.className = sorted.length > 0 ? 'badge badge-on-time' : 'badge badge-completed';
    }

    if (!sorted.length) {
      sessionsGridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem 1rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius-md);">
          <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">📅</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem;">No Scheduled Zoom Meeting Sessions</p>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">Official meeting sessions scheduled by the Administrator will appear here.</p>
        </div>
      `;
      return;
    }

    sessionsGridContainer.innerHTML = sorted.map(m => {
      const isSelected = meeting && m.id === meeting.id;
      const timeStatus = getTimeStatus(m);
      const rawTime = (m.meeting_time_text || '').trim();
      const hasSpecificTime = rawTime && !/^scheduled(\s+session)?$/i.test(rawTime);

      return `
        <div 
          class="session-select-card ${isSelected ? 'active' : ''}" 
          onclick="switchUserMeeting('${m.id}')"
          role="button"
          tabindex="0"
          title="Click to select session"
        >
          <div class="session-select-top">
            <span class="badge ${timeStatus.badgeClass}">
              ${timeStatus.label}
            </span>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted); background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">
                ID: ${escapeHtml(m.id)}
              </span>
              ${isAdmin ? `
                <button 
                  type="button" 
                  class="btn btn-danger-subtle btn-sm" 
                  onclick="event.stopPropagation(); deleteMeetingAsAdmin('${m.id}')"
                  title="Delete this scheduled meeting session (Admin)"
                  style="padding: 0.15rem 0.45rem; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 0.2rem; border-radius: var(--radius-sm);"
                >
                  🗑️ Delete
                </button>
              ` : ''}
            </div>
          </div>

          <h4 class="session-select-title">
            ${escapeHtml(m.title)}
          </h4>

          <div class="session-select-meta">
            ${hasSpecificTime ? `
              <div class="session-select-meta-item">
                <span>🕒 Time:</span>
                <strong style="color: var(--text);">${escapeHtml(rawTime)}</strong>
              </div>
            ` : ''}
            ${m.meeting_passcode ? `
              <div class="session-select-meta-item">
                <span>🔒 Passcode:</span>
                <strong style="font-family: var(--font-mono); color: var(--text);">${escapeHtml(m.meeting_passcode)}</strong>
              </div>
            ` : ''}
          </div>

          <div class="session-select-footer">
            <span style="color: ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}; font-size: 0.78rem; font-weight: ${isSelected ? '600' : 'normal'};">
              ${isSelected ? '✓ Selected Session' : 'Click to Switch Session'}
            </span>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.74rem;">
                ${isSelected ? 'Active' : 'Select'}
              </span>
              ${isAdmin ? `
                <button 
                  type="button" 
                  class="btn btn-danger-subtle btn-sm" 
                  onclick="event.stopPropagation(); deleteMeetingAsAdmin('${m.id}')"
                  title="Delete this scheduled meeting session (Admin)"
                  style="padding: 0.2rem 0.55rem; font-size: 0.74rem;"
                >
                  🗑️ Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.switchUserMeeting = (mid) => {
    const all = getAllMeetings();
    const found = all.find(m => m.id === mid);
    if (found) {
      populateMeetingDetails(found);
      renderSessionsHub();
    }
  };

  // Global delete meeting helper for authenticated administrator on attendee portal
  window.deleteMeetingAsAdmin = (id) => {
    if (!isAdminLoggedIn()) {
      alert('Administrator access required to delete meeting sessions.');
      window.location.href = 'admin.html';
      return;
    }
    const all = getAllMeetings();
    const target = all.find(m => m.id === id);
    const meetingTitle = target ? target.title : `ID: ${id}`;

    if (!confirm(`Are you sure you want to delete this scheduled meeting session:\n\n"${meetingTitle}"?\n\nThis will remove the session from the portal and delete all associated attendance records.`)) {
      return;
    }

    const updated = all.filter(m => m.id !== id);
    localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(updated));
    localStorage.removeItem('zoom_attendance_' + id);

    const remaining = sortMeetingsByStatus(updated);
    meeting = remaining[0] || null;
    populateMeetingDetails(meeting);
    renderSessionsHub();
  };

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Update Admin navigation status
  const navAdminPortalBtn = document.getElementById('navAdminPortalBtn');
  if (navAdminPortalBtn && isAdminLoggedIn()) {
    navAdminPortalBtn.innerHTML = '🔒 Admin Portal (Signed In)';
    navAdminPortalBtn.style.borderColor = 'var(--primary)';
    navAdminPortalBtn.style.color = 'var(--primary)';
  }

  populateMeetingDetails(meeting);
  renderSessionsHub();

  // Cloud Sync Service: Fetch live meetings from Google Sheets (Central Database)
  async function syncMeetingsFromCloud() {
    if (window.SheetsService && window.SheetsService.isConfigured()) {
      const syncPill = document.getElementById('liveSyncStatusPill');
      const syncText = document.getElementById('liveSyncStatusText');
      if (syncPill) syncPill.style.display = 'inline-flex';
      if (syncText) syncText.textContent = 'Syncing...';

      try {
        const cloudMeetings = await window.SheetsService.getMeetings();
        if (Array.isArray(cloudMeetings) && cloudMeetings.length > 0) {
          // Re-evaluate meeting selection if no meeting was active or to pick current live session
          const currentId = meeting ? meeting.id : null;
          const stillExists = cloudMeetings.find(m => m.id === currentId);
          if (!stillExists || !meeting) {
            meeting = getMeeting();
          } else {
            // Update current meeting object in place with fresh cloud details
            meeting = stillExists;
          }
          populateMeetingDetails(meeting);
          renderSessionsHub();
        }
        if (syncText) syncText.textContent = 'Live Synced';
      } catch (e) {
        console.warn('[user.js] Cloud sync error:', e);
        if (syncText) syncText.textContent = 'Offline';
      }
    }
  }

  // Trigger initial cloud sync
  syncMeetingsFromCloud();

  // Periodic polling: check for newly created meetings every 15 seconds
  const pollInterval = (window.GOOGLE_SHEETS_CONFIG && window.GOOGLE_SHEETS_CONFIG.syncIntervalMs) || 15000;
  setInterval(syncMeetingsFromCloud, pollInterval);

  // Re-calculate dynamic time status every 30 seconds
  setInterval(() => {
    populateMeetingDetails(meeting);
    renderSessionsHub();
  }, 30000);

  // Remembered user credentials (clean frictionless auto-fill)
  const savedUser = JSON.parse(localStorage.getItem('aptwreis_user_info') || '{}');
  if (savedUser.name && inputName) inputName.value = savedUser.name;
  const cleanParamCode = paramCode ? String(paramCode).replace(/\D/g, '').slice(0, 11) : '';
  if (cleanParamCode && inputCode) inputCode.value = cleanParamCode;
  else if (savedUser.code && inputCode) inputCode.value = String(savedUser.code).replace(/\D/g, '').slice(0, 11);
  if (savedUser.desig && inputDesig) inputDesig.value = savedUser.desig;

  // Detect Client Device
  function getDevice() {
    const ua = navigator.userAgent || '';
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    return 'Desktop Browser';
  }

  // Record Attendance Logic
  function recordAttendanceAndJoin(name, code, desig) {
    if (!meeting || !meeting.id || !meeting.zoom_url) {
      alert('No active Zoom meeting session is currently available or selected.');
      return;
    }

    // Save to user info for convenience
    localStorage.setItem('aptwreis_user_info', JSON.stringify({ name, code, desig }));

    // Status: On Time vs Late (calculated according to scheduled time & grace period)
    const now = new Date();
    const scheduled = parseMeetingDateTime(meeting.meeting_time_text, meeting.scheduled_at) || now;
    const graceMs = (parseInt(meeting.grace_period_mins) || 15) * 60 * 1000;
    const isLate = now.getTime() > (scheduled.getTime() + graceMs);
    const status = isLate ? 'LATE' : 'ON_TIME';

    // Retrieve attendance list
    const key = 'zoom_attendance_' + meeting.id;
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      list = [];
    }

    // Check if attendee already recorded today, update or add
    const existingIdx = list.findIndex(a =>
      a.attendee_name.toLowerCase() === name.toLowerCase() ||
      (code && a.school_code && a.school_code.toLowerCase() === code.toLowerCase())
    );

    const record = {
      id: 'att_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      meeting_id: meeting.id,
      attendee_name: name,
      school_code: code || '-',
      designation: desig || 'Officer / Staff',
      joined_at: now.toISOString(),
      status,
      device: getDevice()
    };

    if (existingIdx !== -1) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(key, JSON.stringify(list));

    // Live Cloud Sync: Record attendance directly to Google Sheets (Cloud Excel Database)
    if (window.SheetsService && window.SheetsService.isConfigured()) {
      window.SheetsService.recordAttendance(record).catch(err => {
        console.warn('[user.js] Attendance cloud record failed:', err);
      });
    }

    // Show Confirmation Overlay & Launch Zoom
    showConfirmationAndLaunch(name, code, status);
  }

  function showConfirmationAndLaunch(name, code, status) {
    if (!autoOverlay) {
      window.location.href = meeting.zoom_url;
      return;
    }

    autoOverlay.style.display = 'flex';
    if (overlayTitle) overlayTitle.textContent = meeting.title;
    if (overlayAttendee) overlayAttendee.textContent = `${name}${code ? ` (${code})` : ''}`;

    if (overlayStatus) {
      if (status === 'ON_TIME') {
        overlayStatus.className = 'badge badge-on-time';
        overlayStatus.textContent = '● Attendance Confirmed (On Time)';
      } else {
        overlayStatus.className = 'badge badge-late';
        overlayStatus.textContent = '● Attendance Confirmed (Late)';
      }
    }

    if (btnDirectZoom) {
      btnDirectZoom.href = meeting.zoom_url;
    }

    if (overlayProgress) {
      setTimeout(() => {
        overlayProgress.style.width = '100%';
      }, 50);
    }

    let timeLeft = 2;
    const timer = setInterval(() => {
      timeLeft--;
      if (overlayCountdown) overlayCountdown.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        // Automatically redirect to Zoom meeting link
        window.location.href = meeting.zoom_url;
      }
    }, 1000);
  }

  // Enforce only numbers and maximum 11 digits for UDISE Code
  if (inputCode) {
    inputCode.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
    });
  }

  // Handle Form Submit
  if (formUserJoin) {
    formUserJoin.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!meeting || !meeting.zoom_url) {
        alert('No active Zoom meeting session is currently available to join.');
        return;
      }
      const name = (inputName.value || '').trim();
      const code = (inputCode.value || '').trim();
      const desig = (inputDesig.value || '').trim();

      if (!name) {
        alert('Please enter your full name.');
        inputName.focus();
        return;
      }

      if (!code) {
        alert('Please enter your 11-digit UDISE Code.');
        inputCode.focus();
        return;
      }

      if (code.length !== 11 || !/^\d{11}$/.test(code)) {
        alert('UDISE Code must be exactly 11 numbers (e.g. 12345678901).');
        inputCode.focus();
        return;
      }

      recordAttendanceAndJoin(name, code, desig);
    });
  }

  // Copy Helper for Meeting ID and Passcode
  window.copyText = (text, message = 'Copied!') => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert(message);
      }).catch(() => fallbackCopy(text, message));
    } else {
      fallbackCopy(text, message);
    }
  };

  function fallbackCopy(text, message) {
    const el = document.createElement('input');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert(message);
  }

  // Auto-Attendance on URL Link Click
  if (paramName && meeting) {
    recordAttendanceAndJoin(paramName, paramCode || '', paramDesig || '');
  }
});

