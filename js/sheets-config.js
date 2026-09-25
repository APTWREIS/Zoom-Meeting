// =========================================================
// APTWREIS (Gurukulam) - Google Sheets Cloud Configuration
// =========================================================
// This configuration enables automatic real-time sync across
// all devices (Admin PC, Officer laptops, smartphones).
//
// Once deployed, paste your Google Apps Script Web App URL below:
// Example: "https://script.google.com/macros/s/AKfycb.../exec"
// =========================================================

window.GOOGLE_SHEETS_CONFIG = {
  // Google Apps Script Web App URL (leave empty string or paste your deployed URL)
  webAppUrl: 'https://script.google.com/macros/s/AKfycby9hg0UMH1TzZZlCOQGVUS9vHvdVPrQSJp2LVM18n0roGHaLkXgkJ7xr4nlSjCygkva/exec',

  // Polling interval in milliseconds (default: 15 seconds)
  syncIntervalMs: 15000,

  // LocalStorage key for admin overrides and local caching
  storageKey: 'aptwreis_sheets_url',
  spreadsheetUrlKey: 'aptwreis_spreadsheet_url'
};

// Returns active Google Apps Script URL (prefers localStorage override set via Admin UI)
window.getSheetsUrl = function () {
  try {
    const local = localStorage.getItem(window.GOOGLE_SHEETS_CONFIG.storageKey);
    if (local && local.trim() && local.trim().startsWith('http')) {
      return local.trim();
    }
  } catch (e) { }

  if (window.GOOGLE_SHEETS_CONFIG && window.GOOGLE_SHEETS_CONFIG.webAppUrl) {
    return window.GOOGLE_SHEETS_CONFIG.webAppUrl.trim();
  }
  return '';
};

// Returns stored Google Spreadsheet direct link (if available)
window.getSpreadsheetUrl = function () {
  try {
    return localStorage.getItem(window.GOOGLE_SHEETS_CONFIG.spreadsheetUrlKey) || '';
  } catch (e) {
    return '';
  }
};
