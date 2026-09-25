// APTWREIS (Gurukulam) - Admin Meeting & Attendance Manager
// 100% Pure Vanilla JavaScript (Zero Dependencies, Standalone)

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let meetings = [];
  let selectedMeeting = null;
  let attendeesList = [];

  // Legacy default demo meeting IDs to purge if found in localStorage
  const LEGACY_DEFAULT_IDS = ['81896937907', '81944027831', '86333953207', 'demo-sync'];

  // DOM Elements
  const pasteInput = document.getElementById('pasteInvitationText');
  const btnParsePaste = document.getElementById('btnParsePaste');
  const btnClearPaste = document.getElementById('btnClearPaste');

  const formMeeting = document.getElementById('formCreateMeeting');
  const inputTitle = document.getElementById('mtgTitle');
  const inputZoomUrl = document.getElementById('mtgZoomUrl');
  const inputMeetingId = document.getElementById('mtgId');
  const inputPasscode = document.getElementById('mtgPasscode');
  const inputTimeText = document.getElementById('mtgTimeText');
  const inputGrace = document.getElementById('mtgGrace');
  const inputDesc = document.getElementById('mtgDesc');

  const parseSuccessBanner = document.getElementById('parseSuccessBanner');
  const meetingsListContainer = document.getElementById('meetingsListContainer');

  const selectActiveMeeting = document.getElementById('selectActiveMeeting');
  const searchRoster = document.getElementById('searchRoster');
  const rosterTableBody = document.getElementById('rosterTableBody');
  const rosterEmptyState = document.getElementById('rosterEmptyState');
  const statTotalAttendees = document.getElementById('statTotalAttendees');
  const statOnTime = document.getElementById('statOnTime');
  const statLate = document.getElementById('statLate');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnRefreshRoster = document.getElementById('btnRefreshRoster');
  const excelButtonGroup = document.getElementById('excelButtonGroup');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnExportExcelText = document.getElementById('btnExportExcelText');
  const btnExportMenuToggle = document.getElementById('btnExportMenuToggle');
  const exportDropdownMenu = document.getElementById('exportDropdownMenu');
  const btnExportXls = document.getElementById('btnExportXls');
  const chkSelectAllRoster = document.getElementById('chkSelectAllRoster');
  const selectedAttendeeIds = new Set();

  const toastNotice = document.getElementById('toastNotice');
  const toastIcon = document.getElementById('toastIcon');
  const toastText = document.getElementById('toastText');

  // Google Sheets Cloud Sync DOM Elements
  const inputSheetsUrl = document.getElementById('inputSheetsUrl');
  const btnSaveSheetsUrl = document.getElementById('btnSaveSheetsUrl');
  const btnTestSheetsUrl = document.getElementById('btnTestSheetsUrl');
  const badgeSyncStatus = document.getElementById('badgeSyncStatus');
  const linkOpenGoogleSheet = document.getElementById('linkOpenGoogleSheet');
  const btnOpenSetupGuide = document.getElementById('btnOpenSetupGuide');
  const btnSyncStatusHeader = document.getElementById('btnSyncStatusHeader');
  const headerSyncDot = document.getElementById('headerSyncDot');
  const headerSyncText = document.getElementById('headerSyncText');
  const modalSheetsGuide = document.getElementById('modalSheetsGuide');
  const btnCloseGuideModal = document.getElementById('btnCloseGuideModal');
  const btnCloseGuideModal2 = document.getElementById('btnCloseGuideModal2');
  const btnCopyAppsScript = document.getElementById('btnCopyAppsScript');
  const codeSnippetBox = document.getElementById('codeSnippetBox');

  // Authentication DOM Elements
  const adminAuthOverlay = document.getElementById('adminAuthOverlay');
  const adminMainContent = document.getElementById('adminMainContent');
  const formAdminLogin = document.getElementById('formAdminLogin');
  const adminUsername = document.getElementById('adminUsername');
  const adminPassword = document.getElementById('adminPassword');
  const rememberAdmin = document.getElementById('rememberAdmin');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const btnAdminLogout = document.getElementById('btnAdminLogout');

  // Live IST Clock
  const adminClockText = document.getElementById('adminClockText');
  if (adminClockText) {
    function updateAdminClock() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      adminClockText.textContent = `${dateStr} • ${timeStr} IST`;
    }
    updateAdminClock();
    setInterval(updateAdminClock, 1000);
  }

  // =========================================================
  // Smart Meeting Date & Time Parser
  // =========================================================
  function parseMeetingDateTime(timeText, fallbackDate) {
    const now = new Date();
    if (timeText) {
      let clean = String(timeText).replace(/\b(india|ist)\b/gi, '').trim();

      if (/^today\s*(at)?\s*/i.test(clean)) {
        const rest = clean.replace(/^today\s*(at)?\s*/i, '').trim();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        clean = todayStr + ' ' + rest;
      } else if (/^tomorrow\s*(at)?\s*/i.test(clean)) {
        const tom = new Date(now.getTime() + 86400000);
        const rest = clean.replace(/^tomorrow\s*(at)?\s*/i, '').trim();
        const tomStr = tom.getFullYear() + '-' + String(tom.getMonth() + 1).padStart(2, '0') + '-' + String(tom.getDate()).padStart(2, '0');
        clean = tomStr + ' ' + rest;
      } else if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(clean)) {
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
  // Dynamic Time Status Calculator
  // Evaluates status of time vs scheduled meeting time
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

    // 1. Present Window: within 15 minutes before scheduled start up to 2 hours after start
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


  // =========================================================
  // 1. Toast Notification
  // =========================================================
  let toastTimer = null;
  function showToast(message, icon = '✓') {
    toastIcon.textContent = icon;
    toastText.textContent = message;
    toastNotice.classList.add('active');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotice.classList.remove('active');
    }, 2800);
  }

  // =========================================================
  // 2. Storage Helpers
  // =========================================================
  function getStoredMeetings() {
    const raw = localStorage.getItem('zoom_scheduled_meetings');
    let list = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out legacy default mock meetings if present
          list = parsed.filter(m => m && !LEGACY_DEFAULT_IDS.includes(m.id));
          if (list.length !== parsed.length) {
            localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(list));
          }
        }
      } catch (e) {}
    }
    return list;
  }

  function saveMeetings(list) {
    meetings = list;
    localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(list));
  }

  function getStoredAttendees(meetingId) {
    if (!meetingId) return [];
    if (localStorage.getItem('zoom_attendance_86333953207')) {
      localStorage.removeItem('zoom_attendance_86333953207');
    }
    const raw = localStorage.getItem('zoom_attendance_' + meetingId);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return [];
  }

  function saveAttendees(meetingId, list) {
    localStorage.setItem('zoom_attendance_' + meetingId, JSON.stringify(list));
  }

  // =========================================================
  // 3. Parser: Parse Pasted Zoom Invitation Text
  // =========================================================
  function parseInvitationText(text) {
    if (!text || !text.trim()) return null;

    // 1. Zoom URL
    const urlMatch = text.match(/https?:\/\/[^\s]+zoom\.us\/[^\s]+/i) || text.match(/https?:\/\/[^\s]+/i);
    const zoomUrl = urlMatch ? urlMatch[0].trim() : '';

    // 2. Topic / Title
    const topicMatch = text.match(/Topic:\s*([^\r\n]+)/i);
    let title = topicMatch ? topicMatch[1].trim() : '';
    if (!title) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const regardingLine = lines.find(l => /regarding/i.test(l));
      if (regardingLine) title = regardingLine.replace(/^Topic:\s*/i, '');
      else if (lines.length > 1 && !lines[0].startsWith('http')) title = lines[0];
      else title = 'Secretary, APTWREIS (Gurukulam) – Zoom Meeting';
    }

    // 3. Meeting ID
    const idMatch = text.match(/Meeting ID:\s*([0-9\s]+)/i);
    let meetingId = '';
    if (idMatch) {
      meetingId = idMatch[1].replace(/\s+/g, '').trim();
    } else if (zoomUrl) {
      const jMatch = zoomUrl.match(/\/j\/(\d+)/i);
      if (jMatch) meetingId = jMatch[1];
    }
    if (!meetingId) {
      meetingId = 'mtg_' + Date.now().toString(36).substr(2, 8);
    }

    // 4. Passcode
    const pwdMatch = text.match(/Passcode:\s*([^\r\n\s]+)/i) || (zoomUrl ? zoomUrl.match(/pwd=([^&\s]+)/i) : null);
    const passcode = pwdMatch ? pwdMatch[1].trim() : '';

    // 5. Time
    const timeMatch = text.match(/Time:\s*([^\r\n]+)/i);
    const timeText = timeMatch ? timeMatch[1].trim() : 'Today at 03:30 PM India';

    // 6. Description / Notes
    let description = '';
    const regardsMatch = text.match(/(With Regards[\s\S]*)/i);
    if (regardsMatch) {
      description = text.trim();
    } else {
      description = text.trim();
    }

    return {
      id: meetingId,
      title,
      zoom_url: zoomUrl,
      meeting_passcode: passcode,
      meeting_time_text: timeText,
      description
    };
  }

  // Handle "Parse & Create Meeting"
  btnParsePaste.addEventListener('click', () => {
    const raw = pasteInput.value.trim();
    if (!raw) {
      alert('Please paste the Zoom meeting invitation text first.');
      pasteInput.focus();
      return;
    }

    const parsed = parseInvitationText(raw);
    if (!parsed || !parsed.zoom_url) {
      alert('Could not find a valid Zoom link in the pasted text. Please verify the invitation text.');
      return;
    }

    // Populate form fields
    inputTitle.value = parsed.title;
    inputZoomUrl.value = parsed.zoom_url;
    inputMeetingId.value = parsed.id;
    inputPasscode.value = parsed.meeting_passcode;
    inputTimeText.value = parsed.meeting_time_text;
    inputDesc.value = parsed.description;

    // Show confirmation banner
    parseSuccessBanner.style.display = 'block';
    parseSuccessBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast('Invitation parsed! Review details and click "Save & Create"', '⚡');
  });

  btnClearPaste.addEventListener('click', () => {
    pasteInput.value = '';
    parseSuccessBanner.style.display = 'none';
  });

  const btnLoadSample = document.getElementById('btnLoadSample');
  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', () => {
      pasteInput.value = 
`Sir/Madam,
Secretary APTWREIS(Gurukulam) is inviting you to a scheduled Zoom meeting.
Topic: Secretary, APTWREIS (Gurukulam) – Zoom Meeting Regarding MITRA – Reg.
Time: Sep 16, 2026 03:30 PM India
Join Zoom Meeting
https://us06web.zoom.us/j/86333953207?pwd=DPY0k5ihoTtnihxwobhs9txYNgAakT.1
Meeting ID: 863 3395 3207
Passcode: 490494
-
With Regards,
IT-WING
APTWREI Society (Gurukulam)
Amaravarti at Tadepali.`;
      showToast('Sample Gurukulam invitation loaded! Click "Parse & Fill Fields"', '📋');
    });
  }

  // Handle Meeting Creation / Save Form
  formMeeting.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = inputTitle.value.trim();
    let zoomUrl = inputZoomUrl.value.trim();
    let id = inputMeetingId.value.trim() || 'mtg_' + Date.now().toString(36);
    const passcode = inputPasscode.value.trim();
    const timeText = inputTimeText.value.trim() || 'Scheduled Session';
    const grace = parseInt(inputGrace.value) || 15;
    const desc = inputDesc.value.trim();

    if (!title || !zoomUrl) {
      alert('Meeting Title and Zoom URL are required.');
      return;
    }

    if (!/^https?:\/\//i.test(zoomUrl)) {
      zoomUrl = 'https://' + zoomUrl;
    }

    const parsedDate = parseMeetingDateTime(timeText);
    const scheduledAt = parsedDate ? parsedDate.toISOString() : new Date().toISOString();

    const newMeeting = {
      id,
      title,
      zoom_url: zoomUrl,
      meeting_passcode: passcode,
      meeting_time_text: timeText,
      scheduled_at: scheduledAt,
      grace_period_mins: grace,
      description: desc,
      created_at: new Date().toISOString()
    };

    // Check if ID already exists, update or add
    const existingIdx = meetings.findIndex(m => m.id === id);
    if (existingIdx !== -1) {
      meetings[existingIdx] = newMeeting;
    } else {
      meetings.unshift(newMeeting);
    }

    saveMeetings(meetings);
    selectedMeeting = newMeeting;

    // Reset form and clear banner
    formMeeting.reset();
    parseSuccessBanner.style.display = 'none';
    pasteInput.value = '';

    updateAllViews();

    // Live Cloud Sync: Save to Google Sheets (Central Database) so all users across devices see it
    if (window.SheetsService && window.SheetsService.isConfigured()) {
      showToast('Saving session to Google Sheets... ⏳', '⏳');
      try {
        const cloudRes = await window.SheetsService.saveMeeting(newMeeting);
        if (cloudRes && cloudRes.success) {
          showToast('Meeting created & synced to Google Sheets! All users can see it 🚀', '✓');
        } else {
          showToast('Meeting saved locally (Google Sheets sync pending)', '⚠️');
        }
      } catch (err) {
        showToast('Meeting saved locally (Google Sheets sync error)', '⚠️');
      }
    } else {
      showToast('Meeting created locally! Connect Google Sheets so all devices can see it 🚀', '✓');
    }
  });

  // =========================================================
  // 4. URL Builder Helper
  // =========================================================
  function getUserPageUrl(meetingId, name = '', code = '') {
    const currentHref = window.location.href.split('#')[0].split('?')[0];
    const targetUrl = currentHref.endsWith('admin.html')
      ? currentHref.replace(/admin\.html$/, 'index.html')
      : (currentHref.endsWith('/') ? currentHref + 'index.html' : currentHref.replace(/\/[^\/]*$/, '/index.html'));

    let link = `${targetUrl}?mid=${encodeURIComponent(meetingId)}`;
    if (name) link += `&name=${encodeURIComponent(name)}`;
    if (code) link += `&code=${encodeURIComponent(code)}`;
    return link;
  }

  // =========================================================
  // 5. Update UI & Links
  // =========================================================
  function updateAllViews() {
    meetings = sortMeetingsByStatus(meetings);
    renderMeetingsList();
    populateSelectDropdown();
    fetchAndRenderRoster();
  }

  function renderMeetingsList() {
    const countBadge = document.getElementById('adminMeetingCountBadge');

    if (!meetings.length) {
      meetingsListContainer.innerHTML = `
        <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius-md);">
          <div style="font-size: 1.35rem; margin-bottom: 0.35rem;">📅</div>
          <p style="font-size: 0.88rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem;">No Meetings Scheduled</p>
          <p style="font-size: 0.78rem; margin: 0;">Create a meeting above using the 1-Click Meeting Creator or form.</p>
        </div>
      `;
      if (countBadge) {
        countBadge.textContent = '0 Sessions';
        countBadge.className = 'badge badge-completed';
      }
      return;
    }

    const sorted = sortMeetingsByStatus(meetings);
    meetings = sorted;

    if (countBadge) {
      countBadge.textContent = `${sorted.length} ${sorted.length === 1 ? 'Session' : 'Sessions'}`;
      countBadge.className = 'badge badge-on-time';
    }

    meetingsListContainer.innerHTML = sorted.map(m => {
      const isSelected = selectedMeeting && selectedMeeting.id === m.id;
      const atts = getStoredAttendees(m.id);
      const userLink = getUserPageUrl(m.id);
      const timeStatus = getTimeStatus(m);

      const rawTime = (m.meeting_time_text || '').trim();
      const hasSpecificTime = rawTime && !/^scheduled(\s+session)?$/i.test(rawTime);

      return `
        <div 
          class="meeting-card ${isSelected ? 'active-meeting-card' : ''}" 
          onclick="selectMeetingById('${m.id}')"
          style="margin-bottom: 0.75rem; padding: 0.85rem 1rem; border: 1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; background: ${isSelected ? 'var(--primary-light)' : 'var(--bg-surface)'}; border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s ease;"
          title="Click to select this meeting and view live roster"
        >
          <!-- Header: Title + Dynamic Time Badge + Delete Icon Button -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.25rem;">
                <span class="badge ${timeStatus.badgeClass}">${timeStatus.label}</span>
                ${isSelected ? '<span style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--primary);">✓ Selected</span>' : ''}
              </div>
              <strong style="font-size: 0.92rem; color: var(--text); line-height: 1.35; display: block;">
                ${escapeHtml(m.title)}
              </strong>
            </div>

            <button 
              type="button" 
              class="btn btn-danger-subtle btn-sm"
              onclick="event.stopPropagation(); deleteMeeting('${m.id}')" 
              title="Delete this scheduled meeting session"
              style="padding: 0.2rem 0.55rem; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.25rem; border-radius: var(--radius-sm); white-space: nowrap;"
            >
              🗑️ Delete
            </button>
          </div>

          <!-- Metadata: Show specific time only if real date/time; clean ID, passcode, attendee count -->
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center;">
            ${hasSpecificTime ? `<span>🕒 <strong style="color: var(--text);">${escapeHtml(rawTime)}</strong></span>` : ''}
            <span>🔑 ID: <strong style="font-family: var(--font-mono); color: var(--text);">${escapeHtml(m.id)}</strong></span>
            ${m.meeting_passcode ? `<span>🔒 Pass: <strong style="font-family: var(--font-mono); color: var(--text);">${escapeHtml(m.meeting_passcode)}</strong></span>` : ''}
            <span>👥 <strong>${atts.length}</strong> Attended</span>
          </div>

          <!-- Bottom Actions: Clean, non-redundant Copy Link, Open Zoom & Delete Session -->
          <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-secondary btn-sm" onclick="copyText('${userLink}', 'Universal attendance link copied!')" style="font-size: 0.76rem; padding: 0.25rem 0.65rem;">
              🔗 Copy Link
            </button>
            ${m.zoom_url ? `
              <a href="${escapeHtml(m.zoom_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="font-size: 0.76rem; padding: 0.25rem 0.65rem;">
                🚀 Open Zoom
              </a>
            ` : ''}
            <button type="button" class="btn btn-danger-subtle btn-sm" onclick="deleteMeeting('${m.id}')" title="Delete this scheduled meeting session" style="font-size: 0.76rem; padding: 0.25rem 0.65rem;">
              🗑️ Delete Session
            </button>
            <span style="margin-left: auto; font-size: 0.74rem; color: ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: ${isSelected ? '600' : 'normal'};">
              ${isSelected ? '● Viewing Roster' : 'Click to select →'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  function populateSelectDropdown() {
    if (!selectActiveMeeting) return;
    if (!meetings.length) {
      selectActiveMeeting.innerHTML = '<option value="">No meetings scheduled</option>';
      return;
    }
    selectActiveMeeting.innerHTML = meetings.map(m => {
      const timeStatus = getTimeStatus(m);
      return `
        <option value="${m.id}" ${selectedMeeting && selectedMeeting.id === m.id ? 'selected' : ''}>
          [${timeStatus.categoryLabel}] ${m.title} (ID: ${m.id})
        </option>
      `;
    }).join('');
  }

  selectActiveMeeting.addEventListener('change', (e) => {
    const id = e.target.value;
    const found = meetings.find(m => m.id === id);
    if (found) {
      selectedMeeting = found;
      updateAllViews();
      showToast(`Selected: ${found.title}`, '📋');
    }
  });

  // Global select meeting helper
  window.selectMeetingById = (id) => {
    const found = meetings.find(m => m.id === id);
    if (found) {
      selectedMeeting = found;
      updateAllViews();
      showToast(`Viewing: ${found.title}`, '📋');
    }
  };

  // Global delete meeting helper
  window.deleteMeeting = async (id, title) => {
    const target = meetings.find(m => m.id === id);
    const meetingTitle = title || (target ? target.title : `ID: ${id}`);
    if (!confirm(`Are you sure you want to delete this scheduled meeting session:\n\n"${meetingTitle}"?\n\nThis will remove the session from the portal and delete all associated attendance records.`)) {
      return;
    }
    meetings = meetings.filter(m => m.id !== id);
    localStorage.setItem('zoom_scheduled_meetings', JSON.stringify(meetings));
    localStorage.removeItem('zoom_attendance_' + id);

    if (selectedMeeting && selectedMeeting.id === id) {
      selectedMeeting = meetings[0] || null;
    }
    showToast('Meeting session deleted successfully', '🗑️');
    updateAllViews();

    if (window.SheetsService && window.SheetsService.isConfigured()) {
      try {
        await window.SheetsService.deleteMeeting(id);
      } catch (e) {
        console.warn('Failed to delete meeting from Google Sheets:', e);
      }
    }
  };

  // =========================================================
  // 6. Live Attendance Roster Table
  // =========================================================
  function updateExcelButtonLabel() {
    if (!btnExportExcelText) return;
    const selectedCount = selectedAttendeeIds.size;
    if (selectedCount > 0) {
      btnExportExcelText.textContent = `Download Excel (${selectedCount} Selected)`;
      if (btnExportExcel) btnExportExcel.title = `Download ${selectedCount} selected attendee record(s) to Excel`;
    } else {
      const total = attendeesList.length;
      btnExportExcelText.textContent = total > 0 ? `Download Excel (${total})` : 'Download Excel';
      if (btnExportExcel) {
        btnExportExcel.title = total > 0
          ? `Download complete attendance roster (${total} attendees) to Excel`
          : 'Download attendance roster to Excel';
      }
    }
  }

  function fetchAndRenderRoster() {
    const rosterBadge = document.getElementById('rosterTimeStatusBadge');
    const rosterSub = document.getElementById('rosterMeetingSubtitle');
    const btnDeleteCurrent = document.getElementById('btnDeleteCurrentMeeting');

    if (!selectedMeeting) {
      attendeesList = [];
      selectedAttendeeIds.clear();
      renderRosterRows([]);
      if (btnDeleteCurrent) btnDeleteCurrent.style.display = 'none';
      if (excelButtonGroup) excelButtonGroup.style.display = 'none';
      if (btnExportExcel) btnExportExcel.disabled = true;
      if (rosterBadge) {
        rosterBadge.className = 'badge badge-completed';
        rosterBadge.textContent = 'No Meeting Selected';
      }
      if (rosterSub) {
        rosterSub.textContent = 'Create or select a meeting session to view its attendance roster.';
      }
      return;
    }

    if (btnDeleteCurrent) {
      btnDeleteCurrent.style.display = 'inline-flex';
    }

    // Show option for Excel download when Live Attendance Roster is selected
    if (excelButtonGroup) {
      excelButtonGroup.style.display = 'inline-flex';
    }
    if (btnExportExcel) {
      btnExportExcel.disabled = false;
    }

    const timeStatus = getTimeStatus(selectedMeeting);
    if (rosterBadge) {
      rosterBadge.className = `badge ${timeStatus.badgeClass}`;
      rosterBadge.textContent = timeStatus.label;
    }
    if (rosterSub) {
      rosterSub.textContent = `Scheduled: ${selectedMeeting.meeting_time_text || 'Active Session'} • Passcode: ${selectedMeeting.meeting_passcode || 'None'} • Grace: ${selectedMeeting.grace_period_mins || 15}m`;
    }

    attendeesList = getStoredAttendees(selectedMeeting.id);
    
    function applyCurrentFilterAndRender() {
      const query = (searchRoster.value || '').toLowerCase().trim();
      const filtered = attendeesList.filter(a => {
        if (!query) return true;
        return (a.attendee_name || '').toLowerCase().includes(query) ||
               (a.school_code || '').toLowerCase().includes(query) ||
               (a.designation || '').toLowerCase().includes(query);
      });
      renderRosterRows(filtered);
    }

    applyCurrentFilterAndRender();

    // Live Google Sheets Attendance Fetch (asynchronous background update)
    if (window.SheetsService && window.SheetsService.isConfigured() && !fetchAndRenderRoster._inFlight) {
      fetchAndRenderRoster._inFlight = true;
      const targetMid = selectedMeeting.id;
      window.SheetsService.getAttendance(targetMid).then(cloudList => {
        if (Array.isArray(cloudList) && selectedMeeting && selectedMeeting.id === targetMid) {
          attendeesList = cloudList;
          applyCurrentFilterAndRender();
        }
      }).catch(err => {
        console.warn('Error fetching cloud attendance:', err);
      }).finally(() => {
        fetchAndRenderRoster._inFlight = false;
      });
    }
  }

  function renderRosterRows(list) {
    const total = attendeesList.length;
    const onTimeCount = attendeesList.filter(a => a.status === 'ON_TIME').length;
    const lateCount = attendeesList.filter(a => a.status === 'LATE').length;

    statTotalAttendees.textContent = total;
    statOnTime.textContent = onTimeCount;
    statLate.textContent = lateCount;

    if (!list.length) {
      rosterTableBody.innerHTML = '';
      rosterEmptyState.style.display = 'block';
      if (chkSelectAllRoster) {
        chkSelectAllRoster.checked = false;
        chkSelectAllRoster.disabled = true;
      }
      updateExcelButtonLabel();
      return;
    }

    if (chkSelectAllRoster) {
      chkSelectAllRoster.disabled = false;
      chkSelectAllRoster.checked = list.length > 0 && list.every(a => selectedAttendeeIds.has(a.id));
    }

    rosterEmptyState.style.display = 'none';
    rosterTableBody.innerHTML = list.map((att, idx) => {
      const timeStr = new Date(att.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const statusBadge = att.status === 'LATE'
        ? '<span class="badge badge-late">● Late</span>'
        : '<span class="badge badge-on-time">● On Time</span>';
      const isChecked = selectedAttendeeIds.has(att.id);

      return `
        <tr style="${isChecked ? 'background: rgba(37, 99, 235, 0.05);' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" class="roster-row-chk" data-id="${att.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
          </td>
          <td style="color: var(--text-dim); font-size: 0.8rem;">#${idx + 1}</td>
          <td>
            <strong>${escapeHtml(att.attendee_name)}</strong>
            ${att.designation ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(att.designation)}</div>` : ''}
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-subtle); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">
              ${escapeHtml(att.school_code || '-')}
            </span>
          </td>
          <td>${statusBadge}</td>
          <td style="font-size: 0.82rem;">${timeStr}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(att.device || 'Web Browser')}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" style="color: var(--danger); padding: 0.2rem 0.45rem;" onclick="deleteAttendee('${att.id}')" title="Delete attendance row">
              ✕
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row checkbox event listeners
    const rowCheckboxes = rosterTableBody.querySelectorAll('.roster-row-chk');
    rowCheckboxes.forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) {
          selectedAttendeeIds.add(id);
        } else {
          selectedAttendeeIds.delete(id);
        }
        if (chkSelectAllRoster) {
          chkSelectAllRoster.checked = list.length > 0 && list.every(a => selectedAttendeeIds.has(a.id));
        }
        updateExcelButtonLabel();
      });
    });

    updateExcelButtonLabel();
  }

  // Handle Select All Checkbox
  if (chkSelectAllRoster) {
    chkSelectAllRoster.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const query = (searchRoster.value || '').toLowerCase().trim();
      const visibleList = attendeesList.filter(a => {
        if (!query) return true;
        return (a.attendee_name || '').toLowerCase().includes(query) ||
               (a.school_code || '').toLowerCase().includes(query) ||
               (a.designation || '').toLowerCase().includes(query);
      });

      visibleList.forEach(a => {
        if (isChecked) {
          selectedAttendeeIds.add(a.id);
        } else {
          selectedAttendeeIds.delete(a.id);
        }
      });

      const rowCheckboxes = rosterTableBody.querySelectorAll('.roster-row-chk');
      rowCheckboxes.forEach(c => {
        c.checked = isChecked;
      });

      updateExcelButtonLabel();
    });
  }

  window.deleteAttendee = async (id) => {
    if (!selectedMeeting) return;
    if (confirm('Delete this attendee record?')) {
      selectedAttendeeIds.delete(id);
      attendeesList = attendeesList.filter(a => a.id !== id);
      saveAttendees(selectedMeeting.id, attendeesList);
      showToast('Record deleted', '🗑️');
      fetchAndRenderRoster();

      if (window.SheetsService && window.SheetsService.isConfigured()) {
        try {
          await window.SheetsService.deleteAttendee(selectedMeeting.id, id);
        } catch (e) {
          console.warn('Cloud delete attendee error:', e);
        }
      }
    }
  };

  searchRoster.addEventListener('input', fetchAndRenderRoster);
  btnRefreshRoster.addEventListener('click', async () => {
    if (window.SheetsService && window.SheetsService.isConfigured() && selectedMeeting) {
      showToast('Syncing live attendance from Google Sheets... ⏳', '⏳');
      try {
        const cloudAtt = await window.SheetsService.getAttendance(selectedMeeting.id);
        if (Array.isArray(cloudAtt)) {
          attendeesList = cloudAtt;
          fetchAndRenderRoster();
          showToast(`Synced! ${cloudAtt.length} attendee(s) from Google Sheets`, '✓');
          return;
        }
      } catch (e) { }
    }
    fetchAndRenderRoster();
    showToast('Roster updated', '🔄');
  });

  const btnDeleteCurrentMeeting = document.getElementById('btnDeleteCurrentMeeting');
  if (btnDeleteCurrentMeeting) {
    btnDeleteCurrentMeeting.addEventListener('click', () => {
      if (!selectedMeeting) {
        showToast('No meeting selected to delete', '⚠️');
        return;
      }
      deleteMeeting(selectedMeeting.id, selectedMeeting.title);
    });
  }

  // =========================================================
  // Excel & CSV Download Functionality
  // =========================================================
  function getAttendeesForExport() {
    if (!selectedMeeting) return [];
    if (selectedAttendeeIds.size > 0) {
      return attendeesList.filter(a => selectedAttendeeIds.has(a.id));
    }
    return attendeesList;
  }

  function downloadExcelRoster(attendees) {
    if (!selectedMeeting) {
      showToast('Please select a meeting session first', '⚠️');
      return;
    }
    if (!attendees || !attendees.length) {
      showToast('No attendee records to export yet for this meeting', '⚠️');
      return;
    }

    const meetingTitle = selectedMeeting.title || 'Official Zoom Meeting';
    const meetingId = selectedMeeting.id || '-';
    const meetingPass = selectedMeeting.meeting_passcode || 'None';
    const meetingTime = selectedMeeting.meeting_time_text || 'Scheduled Session';
    const exportTimeStr = new Date().toLocaleString();

    const total = attendees.length;
    const onTime = attendees.filter(a => a.status === 'ON_TIME').length;
    const late = attendees.filter(a => a.status === 'LATE').length;

    const rowsHtml = attendees.map((a, i) => {
      const isLate = a.status === 'LATE';
      const statusBg = isLate ? '#fef3c7' : '#dcfce7';
      const statusColor = isLate ? '#b45309' : '#15803d';
      const statusLabel = isLate ? 'Late Arrival' : 'On Time';
      const joinStr = new Date(a.joined_at).toLocaleString();

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px;">${i + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold; color: #0f172a;">${escapeHtml(a.attendee_name || '-')}</td>
          <td style="mso-number-format:'\\@'; text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-family: Consolas, monospace; background: #f8fafc;">${escapeHtml(a.school_code || '-')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; color: #334155;">${escapeHtml(a.designation || '-')}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; background-color: ${statusBg}; color: ${statusColor}; font-weight: bold;">${statusLabel}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; color: #334155;">${joinStr}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; color: #64748b;">${escapeHtml(a.device || 'Web Browser')}</td>
        </tr>
      `;
    }).join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Attendance Roster</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #1e3a8a; padding: 8px 10px; font-size: 10.5pt; text-align: center; }
          .header-main { font-size: 15pt; font-weight: bold; color: #1e3a8a; text-align: center; padding: 8px; }
          .header-sub { font-size: 10pt; color: #64748b; text-align: center; padding-bottom: 6px; }
          .meta-title { font-weight: bold; color: #1e293b; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; }
          .meta-val { border: 1px solid #cbd5e1; padding: 6px 8px; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="7" class="header-main">
              APTWREIS (Gurukulam) - Official Zoom Meeting Live Attendance Roster
            </td>
          </tr>
          <tr>
            <td colspan="7" class="header-sub">
              IT-WING, APTWREI Society • Amaravati at Tadepalli • Government of Andhra Pradesh
            </td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr>
            <td class="meta-title">Meeting Topic:</td>
            <td colspan="6" class="meta-val" style="font-weight: bold; font-size: 11.5pt;">${escapeHtml(meetingTitle)}</td>
          </tr>
          <tr>
            <td class="meta-title">Scheduled Time:</td>
            <td colspan="2" class="meta-val">${escapeHtml(meetingTime)}</td>
            <td class="meta-title">Meeting ID:</td>
            <td class="meta-val" style="mso-number-format:'\\@'; font-family: Consolas, monospace;">${escapeHtml(meetingId)}</td>
            <td class="meta-title">Passcode:</td>
            <td class="meta-val" style="font-family: Consolas, monospace;">${escapeHtml(meetingPass)}</td>
          </tr>
          <tr>
            <td class="meta-title">Export Generated:</td>
            <td colspan="2" class="meta-val">${exportTimeStr}</td>
            <td class="meta-title">Attendance Summary:</td>
            <td colspan="3" class="meta-val">
              <strong>Total: ${total}</strong> &nbsp;|&nbsp; 
              <span style="color: #15803d;"><strong>On Time: ${onTime}</strong></span> &nbsp;|&nbsp; 
              <span style="color: #b45309;"><strong>Late: ${late}</strong></span>
            </td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <thead>
            <tr>
              <th style="width: 45px;">#</th>
              <th style="width: 240px; text-align: left;">Officer / Attendee Name</th>
              <th style="width: 140px;">UDISE Code</th>
              <th style="width: 200px; text-align: left;">Designation</th>
              <th style="width: 120px;">Status</th>
              <th style="width: 190px;">Joined Date & Time</th>
              <th style="width: 140px;">Device / Source</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `APTWREIS_Attendance_${meetingId}_${dateStr}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Excel downloaded (${total} records)`, '📊');
  }

  function downloadCSVRoster(attendees) {
    if (!selectedMeeting) {
      showToast('Please select a meeting session first', '⚠️');
      return;
    }
    if (!attendees || !attendees.length) {
      showToast('No attendee records to export yet for this meeting', '⚠️');
      return;
    }

    const headers = ['#', 'Officer / Attendee Name', 'UDISE Code', 'Designation', 'Status', 'Joined Date & Time', 'Device'];
    const rows = attendees.map((a, i) => [
      i + 1,
      `"${(a.attendee_name || '').replace(/"/g, '""')}"`,
      `"${(a.school_code || '').replace(/"/g, '""')}"`,
      `"${(a.designation || '').replace(/"/g, '""')}"`,
      a.status,
      `"${new Date(a.joined_at).toLocaleString()}"`,
      `"${(a.device || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `APTWREIS_Attendance_${selectedMeeting.id}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Attendance CSV downloaded (${attendees.length} records)`, '📥');
  }

  // Toggle Dropdown Menu
  if (btnExportMenuToggle && exportDropdownMenu) {
    btnExportMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = exportDropdownMenu.style.display === 'block';
      exportDropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
    });
  }

  // Primary Excel Download Button
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      downloadExcelRoster(getAttendeesForExport());
    });
  }

  // Dropdown Excel (.xls)
  if (btnExportXls) {
    btnExportXls.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
      downloadExcelRoster(getAttendeesForExport());
    });
  }

  // Dropdown CSV (.csv)
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exportDropdownMenu) exportDropdownMenu.style.display = 'none';
      downloadCSVRoster(getAttendeesForExport());
    });
  }

  // Copy helper
  window.copyText = (text, message = 'Copied!') => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(message, '✓');
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
    showToast(message, '✓');
  }

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================
  // 7. Administrator Authentication Gate
  // =========================================================
  function isValidAdminCredentials(user, pass) {
    const u = (user || '').trim().toLowerCase();
    const p = (pass || '').trim();

    // Primary official credentials: gurukulam.itwing@gmail.com / gklm@2026
    if (u === 'gurukulam.itwing@gmail.com' && p === 'gklm@2026') return true;
    // Official society aliases:
    if ((u === 'itwing' || u === 'admin' || u === 'aptwreis') && (p === 'gklm@2026' || p === 'itwing@2026' || p === 'aptw@2026')) return true;
    return false;
  }

  function unlockAdminDashboard() {
    if (adminAuthOverlay) adminAuthOverlay.style.display = 'none';
    if (adminMainContent) {
      adminMainContent.style.filter = 'none';
      adminMainContent.style.pointerEvents = 'auto';
    }
  }

  function lockAdminDashboard() {
    if (adminAuthOverlay) adminAuthOverlay.style.display = 'flex';
    if (adminMainContent) {
      adminMainContent.style.filter = 'blur(4px)';
      adminMainContent.style.pointerEvents = 'none';
    }
    if (adminUsername) {
      setTimeout(() => adminUsername.focus(), 100);
    }
  }

  function checkAdminSession() {
    const isSession = sessionStorage.getItem('aptwreis_admin_auth') === 'true';
    const isLocal = localStorage.getItem('aptwreis_admin_auth') === 'true';

    if (isSession || isLocal) {
      unlockAdminDashboard();
    } else {
      lockAdminDashboard();
    }
  }

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = (adminUsername.value || '').trim();
      const pass = (adminPassword.value || '').trim();

      if (isValidAdminCredentials(user, pass)) {
        if (rememberAdmin && rememberAdmin.checked) {
          localStorage.setItem('aptwreis_admin_auth', 'true');
        } else {
          sessionStorage.setItem('aptwreis_admin_auth', 'true');
        }

        if (authErrorMsg) authErrorMsg.style.display = 'none';
        adminPassword.value = '';
        unlockAdminDashboard();
        showToast('Authenticated! Welcome, Administrator 🔓', '✓');
      } else {
        if (authErrorMsg) {
          authErrorMsg.style.display = 'block';
          authErrorMsg.textContent = '⚠️ Invalid username or password. Please try again.';
        }
        adminPassword.value = '';
        adminPassword.focus();
        showToast('Invalid username or password', '⚠️');
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem('aptwreis_admin_auth');
      localStorage.removeItem('aptwreis_admin_auth');
      if (adminPassword) adminPassword.value = '';
      if (authErrorMsg) authErrorMsg.style.display = 'none';
      lockAdminDashboard();
      showToast('Signed out of Admin Portal 🔒', 'ℹ️');
    });
  }

  // =========================================================
  // 7. Google Sheets Live Database Controller
  // =========================================================
  let appsScriptCodeCache = '';

  async function loadAppsScriptCode() {
    if (appsScriptCodeCache) return appsScriptCodeCache;
    try {
      const res = await fetch('google-apps-script.js');
      if (res.ok) {
        appsScriptCodeCache = await res.text();
        return appsScriptCodeCache;
      }
    } catch (e) { }
    return `// Paste the contents of google-apps-script.js here into Code.gs in Google Sheets Apps Script`;
  }

  function updateSyncUIStatus(isConnected, message = '', spreadsheetUrl = '') {
    if (!badgeSyncStatus) return;

    if (isConnected) {
      badgeSyncStatus.className = 'badge sync-badge-connected';
      badgeSyncStatus.textContent = '● Live Synced';
      if (headerSyncDot) headerSyncDot.style.display = 'inline-block';
      if (headerSyncText) headerSyncText.textContent = 'Sheets Live';

      const sUrl = spreadsheetUrl || window.getSpreadsheetUrl();
      if (linkOpenGoogleSheet && sUrl) {
        linkOpenGoogleSheet.href = sUrl;
        linkOpenGoogleSheet.style.display = 'inline-block';
      }
    } else {
      badgeSyncStatus.className = 'badge sync-badge-disconnected';
      badgeSyncStatus.textContent = '⚪ Local Only';
      if (headerSyncDot) headerSyncDot.style.display = 'none';
      if (headerSyncText) headerSyncText.textContent = 'Sheets: Setup';
      if (linkOpenGoogleSheet) linkOpenGoogleSheet.style.display = 'none';
    }
  }

  // Initialize Cloud Sync UI
  const currentSavedUrl = window.getSheetsUrl();
  if (inputSheetsUrl) inputSheetsUrl.value = currentSavedUrl;

  if (window.SheetsService && window.SheetsService.isConfigured()) {
    updateSyncUIStatus(true);
    // Background ping to refresh spreadsheet URL
    window.SheetsService.testConnection().then(res => {
      if (res && res.success) {
        updateSyncUIStatus(true, res.message, res.spreadsheetUrl);
      }
    });
  } else {
    updateSyncUIStatus(false);
  }

  // Save Google Sheets URL
  if (btnSaveSheetsUrl) {
    btnSaveSheetsUrl.addEventListener('click', async () => {
      const url = (inputSheetsUrl.value || '').trim();
      if (!url) {
        localStorage.removeItem(window.GOOGLE_SHEETS_CONFIG.storageKey);
        localStorage.removeItem(window.GOOGLE_SHEETS_CONFIG.spreadsheetUrlKey);
        updateSyncUIStatus(false);
        showToast('Google Sheets URL removed. Using local storage.', 'ℹ️');
        return;
      }

      if (!url.startsWith('https://script.google.com/')) {
        showToast('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/', '⚠️');
        return;
      }

      btnSaveSheetsUrl.disabled = true;
      btnSaveSheetsUrl.textContent = 'Testing...';

      const testRes = await window.SheetsService.testConnection(url);
      btnSaveSheetsUrl.disabled = false;
      btnSaveSheetsUrl.textContent = '💾 Save & Connect';

      if (testRes.success) {
        localStorage.setItem(window.GOOGLE_SHEETS_CONFIG.storageKey, url);
        updateSyncUIStatus(true, testRes.message, testRes.spreadsheetUrl);
        showToast('Connected! Meetings and live attendance synced with Google Sheets 🚀', '✓');

        // Fetch cloud meetings right away
        syncAdminMeetingsFromCloud();
      } else {
        showToast('Connection failed: ' + testRes.error, '⚠️');
      }
    });
  }

  // Test Connection Button
  if (btnTestSheetsUrl) {
    btnTestSheetsUrl.addEventListener('click', async () => {
      const url = (inputSheetsUrl.value || '').trim();
      if (!url) {
        showToast('Please enter a Web App URL first', '⚠️');
        return;
      }

      btnTestSheetsUrl.disabled = true;
      btnTestSheetsUrl.textContent = 'Testing...';

      const res = await window.SheetsService.testConnection(url);
      btnTestSheetsUrl.disabled = false;
      btnTestSheetsUrl.textContent = '🔌 Test Connection';

      if (res.success) {
        updateSyncUIStatus(true, res.message, res.spreadsheetUrl);
        showToast(`Success! Connected to "${res.spreadsheetTitle}"`, '✓');
      } else {
        showToast('Failed: ' + res.error, '⚠️');
      }
    });
  }

  // Setup Guide Modal Handlers
  async function openSetupGuide() {
    if (!modalSheetsGuide) return;
    modalSheetsGuide.style.display = 'flex';
    if (codeSnippetBox) {
      codeSnippetBox.textContent = 'Loading Google Apps Script code...';
      const code = await loadAppsScriptCode();
      codeSnippetBox.textContent = code;
    }
  }

  if (btnOpenSetupGuide) btnOpenSetupGuide.addEventListener('click', openSetupGuide);
  if (btnSyncStatusHeader) btnSyncStatusHeader.addEventListener('click', openSetupGuide);

  function closeSetupGuide() {
    if (modalSheetsGuide) modalSheetsGuide.style.display = 'none';
  }

  if (btnCloseGuideModal) btnCloseGuideModal.addEventListener('click', closeSetupGuide);
  if (btnCloseGuideModal2) btnCloseGuideModal2.addEventListener('click', closeSetupGuide);

  if (btnCopyAppsScript) {
    btnCopyAppsScript.addEventListener('click', async () => {
      const code = await loadAppsScriptCode();
      navigator.clipboard.writeText(code).then(() => {
        showToast('Google Apps Script code copied to clipboard! 📋', '✓');
      }).catch(() => {
        showToast('Please select and copy the code in the box below', 'ℹ️');
      });
    });
  }

  // Sync Meetings from Cloud
  async function syncAdminMeetingsFromCloud() {
    if (!window.SheetsService || !window.SheetsService.isConfigured()) return;
    try {
      const cloudMeetings = await window.SheetsService.getMeetings();
      if (Array.isArray(cloudMeetings) && cloudMeetings.length > 0) {
        meetings = sortMeetingsByStatus(cloudMeetings);
        // Preserve selection or pick first
        if (selectedMeeting) {
          const found = meetings.find(m => m.id === selectedMeeting.id);
          selectedMeeting = found || meetings[0] || null;
        } else {
          selectedMeeting = meetings[0] || null;
        }
        renderMeetingsList();
        populateSelectDropdown();
        fetchAndRenderRoster();
      }
    } catch (e) {
      console.warn('[admin.js] Sync meetings error:', e);
    }
  }

  // =========================================================
  // 8. Initialize
  // =========================================================
  meetings = getStoredMeetings();
  const urlParams = new URLSearchParams(window.location.search);
  const paramMid = urlParams.get('select') || urlParams.get('mid');
  if (paramMid) {
    const found = meetings.find(m => m.id === paramMid);
    if (found) {
      selectedMeeting = found;
    } else {
      selectedMeeting = meetings[0] || null;
    }
  } else {
    selectedMeeting = meetings[0] || null;
  }
  updateAllViews();
  checkAdminSession();

  // Initial cloud sync
  syncAdminMeetingsFromCloud();

  // Re-calculate dynamic time status & poll cloud database every 15 seconds
  const syncInterval = (window.GOOGLE_SHEETS_CONFIG && window.GOOGLE_SHEETS_CONFIG.syncIntervalMs) || 15000;
  setInterval(() => {
    renderMeetingsList();
    fetchAndRenderRoster();
    syncAdminMeetingsFromCloud();
  }, syncInterval);
});

