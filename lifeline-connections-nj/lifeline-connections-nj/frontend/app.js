// ---- Configuration ----
// Point this at your deployed backend. During local development this is
// usually http://localhost:3001. Once the backend is deployed (Render,
// Railway, Fly.io, etc.), replace with that URL, e.g.
// 'https://api.lifelineconnectionsnj.com'
const API_BASE_URL = window.LIFELINE_API_BASE_URL || 'http://localhost:3001';

const zipInput = document.getElementById('zip-input');
const searchBtn = document.getElementById('search-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const resultsSub = document.getElementById('results-sub');
const resultsContainer = document.getElementById('results-container');
const alertBanner = document.getElementById('alert-banner');

// ---- Rendering helpers ----
function groupByCategory(resources) {
  const groups = {};
  resources.forEach(r => { (groups[r.nims_category] ||= []).push(r); });
  return groups;
}

function resultsHTML(resources) {
  if (!resources.length) {
    return `<div class="empty-state">No resources on file for this zip code yet. Try a nearby zip, or check back soon as our database grows.</div>`;
  }
  const groups = groupByCategory(resources);
  let html = '';
  Object.keys(groups).forEach(cat => {
    html += `<div class="cat-group"><h3>${escapeHTML(cat)}</h3>`;
    groups[cat].forEach(r => {
      const hours = (r.operating_hours && r.operating_hours.hours) ? r.operating_hours.hours : '';
      html += `<div class="res-card">
        <div class="type-badge type-${r.nims_type}">T${r.nims_type}</div>
        <div>
          <h4>${escapeHTML(r.organization_name)}</h4>
          <p class="addr">${escapeHTML(r.address)}</p>
          ${hours ? `<p class="hours">${escapeHTML(hours)}</p>` : ''}
        </div>
        ${r.phone_number ? `<a class="phone" href="tel:${r.phone_number.replace(/[^0-9+]/g,'')}">${escapeHTML(r.phone_number)}</a>` : ''}
      </div>`;
    });
    html += `</div>`;
  });
  return html;
}

function alertHTML(alert) {
  const level = (alert.severity || 'unknown').toLowerCase();
  const effective = alert.effective ? new Date(alert.effective).toLocaleString() : '';
  const expires = alert.expires ? new Date(alert.expires).toLocaleString() : '';
  return `<div class="alert-card ${level}">
    <div class="a-icon">⚠</div>
    <div>
      <h3>${escapeHTML(alert.headline || alert.eventType)}</h3>
      <p>${escapeHTML(truncate(alert.description || '', 320))}</p>
      <div class="meta">${expires ? `Expires ${expires}` : ''}</div>
    </div>
  </div>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n).trim() + '…' : str;
}

// ---- Networking, with offline fallback ----
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function runSearch() {
  const zip = zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    statusText.textContent = 'Enter a valid 5-digit zip code.';
    statusDot.classList.remove('offline');
    return;
  }

  searchBtn.disabled = true;
  statusText.textContent = 'Searching…';
  resultsSub.textContent = `Searching ${zip}…`;

  try {
    const [resourceData, weatherData] = await Promise.all([
      fetchJSON(`${API_BASE_URL}/api/resources?zip=${zip}`),
      fetchJSON(`${API_BASE_URL}/api/weather/alerts?zip=${zip}`).catch(() => ({ alerts: [] })) // weather is best-effort
    ]);

    // cache last successful result for offline use
    localStorage.setItem('lifeline:lastSearch', JSON.stringify({ zip, resourceData, weatherData, savedAt: Date.now() }));

    renderResults(zip, resourceData, weatherData, false);
    statusDot.classList.remove('offline');
    statusText.textContent = `Live data for ${zip}`;
  } catch (err) {
    console.error(err);
    // try offline cache as a fallback
    const cached = localStorage.getItem('lifeline:lastSearch');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.zip === zip) {
        renderResults(zip, parsed.resourceData, parsed.weatherData, true);
        statusDot.classList.add('offline');
        statusText.textContent = `Offline: showing data saved ${new Date(parsed.savedAt).toLocaleString()}`;
        searchBtn.disabled = false;
        return;
      }
    }
    resultsSub.textContent = `Could not load resources for ${zip}.`;
    resultsContainer.innerHTML = `<div class="error-state">${escapeHTML(err.message)}. Check your connection and try again.</div>`;
    alertBanner.classList.remove('show');
  } finally {
    searchBtn.disabled = false;
  }
}

function renderResults(zip, resourceData, weatherData, isOffline) {
  const resources = resourceData.resources || [];
  resultsSub.textContent = `${isOffline ? 'Last known results' : 'Showing results'} for ${zip}${resourceData.place ? `: ${resourceData.place}` : ''} (${resources.length} found)`;
  resultsContainer.innerHTML = resultsHTML(resources);

  const alerts = (weatherData && weatherData.alerts) || [];
  if (alerts.length > 0) {
    alertBanner.innerHTML = alerts.map(alertHTML).join('');
    alertBanner.classList.add('show');
  } else {
    alertBanner.classList.remove('show');
    alertBanner.innerHTML = '';
  }
}

searchBtn.addEventListener('click', runSearch);
zipInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

// Restore last search on load if available (works fully offline)
window.addEventListener('DOMContentLoaded', () => {
  const cached = localStorage.getItem('lifeline:lastSearch');
  if (cached) {
    const parsed = JSON.parse(cached);
    zipInput.value = parsed.zip;
    if (!navigator.onLine) {
      renderResults(parsed.zip, parsed.resourceData, parsed.weatherData, true);
      statusDot.classList.add('offline');
      statusText.textContent = `Offline: showing data saved ${new Date(parsed.savedAt).toLocaleString()}`;
    }
  }
});

// ---- Donation amount buttons (front-end only; wire to a real processor) ----
const amountGrid = document.getElementById('amount-grid');
amountGrid.querySelectorAll('.amount-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    amountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('amount-custom').value = '';
  });
});
document.getElementById('give-btn').addEventListener('click', () => {
  const el = document.getElementById('give-confirm');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 8000);
});

// ---- PWA: register service worker ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ---- PWA: install prompt ----
let deferredInstallPrompt = null;
const installBtn = document.getElementById('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.classList.add('show');
});
installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.classList.remove('show');
});
