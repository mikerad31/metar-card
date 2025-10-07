// -----------------------------
// Tiny DOM helpers & elements
// -----------------------------
const $ = (sel, root = document) => root.querySelector(sel);

const card = $('.card');
const rawLine = $('.raw__line');
const btnCopy = $('.raw__actions .btn:not(.btn--ghost)'); // Copy
const btnRefresh = $('.raw__actions .btn.btn--ghost'); // Refresh
const form = document.querySelector('.icao-form');
const input = document.querySelector('#icao-input');
const errorMsg = document.querySelector('#icao-error');
const timestampSel = '[data-role="timestamp"]';

// -----------------------------
// Init on load
// -----------------------------
(function init() {
  // Seed input from storage or header
  const saved = loadLastIcao();
  const headerIcao = document
    .querySelector('.icao')
    .textContent.trim()
    .toUpperCase();
  if (input) input.value = (saved || headerIcao || 'KJFK').toUpperCase();

  setTimestampNow();
  // Optionally fetch immediately:
  // refreshMetar(input.value);
})();

(function init() {
  const saved = loadLastIcao();
  const headerIcao = document
    .querySelector('.icao')
    .textContent.trim()
    .toUpperCase();
  if (input) input.value = (saved || headerIcao || 'KJFK').toUpperCase();

  renderFavs(); // <— render chips on load
  setTimestampNow();
  // refreshMetar(input.value); // optional auto-fetch
})();

// -----------------------------
// UI state & utilities
// -----------------------------
function setState(state) {
  const valid = ['ok', 'loading', 'error'];
  if (!valid.includes(state)) return;
  card.setAttribute('data-state', state);
  card.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function setTimestampNow() {
  const el = $(timestampSel);
  if (!el) return;
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  el.textContent = `Last updated ${hh}:${mm}Z`;
}

function isValidIcao(str) {
  return /^[A-Z]{4}$/.test(str.trim());
}

function showIcaoError(msg) {
  if (!input || !errorMsg) return;
  input.setAttribute('aria-invalid', 'true');
  errorMsg.textContent = msg || 'ICAO must be 4 letters (A–Z).';
}

function clearIcaoError() {
  if (!input || !errorMsg) return;
  input.removeAttribute('aria-invalid');
  errorMsg.textContent = '';
}

function setControlsDisabled(disabled) {
  if (btnRefresh) btnRefresh.disabled = disabled;
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = disabled;
  if (input) input.disabled = disabled;
}

const STORAGE_KEY = 'lastIcao';
function saveLastIcao(val) {
  try {
    localStorage.setItem(STORAGE_KEY, val);
  } catch {}
}
function loadLastIcao() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// ---------- Favorites (localStorage) ----------
const FAV_KEY = 'favoriteIcaos';

function getFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveFavs(list) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {}
}
function addFav(icao) {
  const list = getFavs();
  const up = icao.toUpperCase();
  if (!list.includes(up)) {
    list.push(up);
    saveFavs(list);
    renderFavs();
  }
}
function removeFav(icao) {
  const list = getFavs().filter(x => x !== icao.toUpperCase());
  saveFavs(list);
  renderFavs();
}

// Alt-click Refresh to add favorite
btnRefresh?.addEventListener('click', e => {
  if (e.altKey) {
    const icao = (
      input?.value || document.querySelector('.icao').textContent
    ).toUpperCase();
    if (isValidIcao(icao)) addFav(icao);
    return; // skip fetching on Alt-click
  }
  refreshMetar();
});

// After a successful fetch, auto-add to favorites (optional; comment out if you prefer manual)
function afterSuccessfulFetch(icao) {
  addFav(icao);
}

function renderFavs() {
  const host = document.querySelector('.favorites__list');
  if (!host) return;
  const list = getFavs();
  host.innerHTML = '';
  list.forEach(icao => {
    const li = document.createElement('div');
    li.className = 'chip';
    li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <span>${icao}</span>
      <button class="chip__go" aria-label="Fetch ${icao}" title="Fetch ${icao}">↩</button>
      <button class="chip__del" aria-label="Remove ${icao} from favorites" title="Remove">×</button>
    `;
    // click fetch
    li.querySelector('.chip__go').addEventListener('click', () => {
      if (input) input.value = icao;
      refreshMetar(icao);
    });
    // click remove
    li.querySelector('.chip__del').addEventListener('click', () =>
      removeFav(icao)
    );
    host.appendChild(li);
  });
}

// -----------------------------
// Mock data & fake fetch
// -----------------------------
const MOCK = {
  KJFK: 'METAR KJFK 061751Z 18010KT 10SM FEW040 24/17 A3027 RMK AO2 SLP250 T02390172 10239 20178 58014',
  KLAX: 'METAR KLAX 061753Z 18003KT 8SM FEW009 BKN019 20/15 A2985 RMK AO2 SLP107 T02000150 10200 20161 50006 $',
  KBOS: 'METAR KBOS 061754Z 24011KT 10SM FEW250 28/12 A3020 RMK AO2 SLP227 T02830122 10283 20172 58020',
  KDEN: 'METAR KDEN 061753Z 08007KT 10SM FEW016 OVC021 08/04 A3022 RMK AO2 SLP210 T00830044 10083 20056 50004',
  KSEA: 'METAR KSEA 061753Z 01006KT 10SM FEW200 14/08 A3021 RMK AO2 SLP235 T01440078 10150 20078 50004 $',
};

function fetchMetarMock(icao) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const flip = Math.random();
      if (flip < 0.15) return reject(new Error('Network error'));
      const metar = MOCK[icao] || null;
      if (!metar) return reject(new Error('Invalid ICAO'));
      resolve(metar);
    }, 900 + Math.random() * 800);
  });
}

// -----------------------------
// Parse + update decoded grid
// -----------------------------
function parseMetar(m) {
  const out = { wind: '', vis: '', clouds: '', tTd: '', alt: '' };

  // Wind: 07015G22KT or VRB03KT
  const wind = m.match(/\b((\d{3}|VRB))(\d{2,3})(G(\d{2,3}))?KT\b/);
  if (wind) {
    const dir = wind[2];
    const spd = wind[3];
    const gust = wind[5] ? `G${wind[5]}` : '';
    out.wind = `${dir}° @ ${spd} kt${gust ? ' ' + gust : ''}`;
  }

  // Visibility: 10SM or #### (meters)
  const visSM = m.match(/\b(\d{1,2})SM\b/);
  const visM = m.match(/\b(\d{4})\b/); // crude, fine for mock
  if (visSM) out.vis = `${visSM[1]} SM`;
  else if (visM) out.vis = `${visM[1]} m`;

  // Clouds: first layer
  const cloud = m.match(/\b(FEW|SCT|BKN|OVC)(\d{3})\b/);
  if (cloud) {
    const layer = { FEW: 'FEW', SCT: 'SCT', BKN: 'BKN', OVC: 'OVC' }[cloud[1]];
    const hundreds = parseInt(cloud[2], 10) * 100;
    out.clouds = `${layer} ${hundreds.toLocaleString()} ft`;
  } else if (/\bSKC|CLR\b/.test(m)) {
    out.clouds = 'SKC';
  }

  // Temp/Dew: 18/10 or M03/M07
  const t = m.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  const parseSigned = s =>
    s?.startsWith('M') ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
  if (t) {
    const tt = parseSigned(t[1]);
    const td = parseSigned(t[2]);
    out.tTd = `${tt} °C / ${td} °C`;
  }

  // Altimeter: A2992 -> 29.92 inHg
  const alt = m.match(/\bA(\d{4})\b/);
  if (alt) {
    const val = alt[1];
    out.alt = `${val.slice(0, 2)}.${val.slice(2)} inHg`;
  }

  return out;
}

function updateDecodedFromMetar(metar) {
  const parsed = parseMetar(metar);
  const tiles = document.querySelectorAll(
    '#decoded-grid-ok .grid__item .value'
  );
  if (tiles[0]) tiles[0].textContent = parsed.wind || '—';
  if (tiles[1]) tiles[1].textContent = parsed.vis || '—';
  if (tiles[2]) tiles[2].textContent = parsed.clouds || '—';
  if (tiles[3]) tiles[3].textContent = parsed.tTd || '—';
  if (tiles[4])
    tiles[4].innerHTML = parsed.alt
      ? parsed.alt.replace(
          'inHg',
          `<abbr title="inches of mercury">inHg</abbr>`
        )
      : '—';
}

// -----------------------------
// Main refresh / copy actions
// -----------------------------
async function refreshMetar(passedIcao) {
  const headerIcao = document
    .querySelector('.icao')
    .textContent.trim()
    .toUpperCase();
  const candidate = (
    passedIcao ||
    input?.value ||
    headerIcao ||
    ''
  ).toUpperCase();

  if (!isValidIcao(candidate)) {
    setState('error');
    showIcaoError('ICAO must be 4 letters (A–Z).');
    return;
  }
  clearIcaoError();

  // Sync header ICAO so UI matches selection
  document.querySelector('.icao').textContent = candidate;

  setState('loading');
  setControlsDisabled(true);

  try {
    const metar = await fetchMetarMock(candidate);
    rawLine.textContent = metar;
    updateDecodedFromMetar(metar);
    setState('ok');
    setTimestampNow();
    saveLastIcao(candidate);
    afterSuccessfulFetch(candidate);
  } catch (err) {
    setState('error');
    showIcaoError(
      err?.message === 'Invalid ICAO'
        ? 'Station not found.'
        : 'Network error. Try again.'
    );
  } finally {
    setControlsDisabled(false);
  }
}

async function copyMetar() {
  const text = rawLine.textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    const prev = btnCopy.textContent;
    btnCopy.textContent = 'Copied';
    setTimeout(() => (btnCopy.textContent = prev), 900);
  } catch {
    // fallback: select text
    const range = document.createRange();
    range.selectNodeContents(rawLine);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// -----------------------------
// Wire events
// -----------------------------
if (input) {
  // force uppercase & live validation
  input.addEventListener('input', () => {
    input.value = input.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4);
    if (input.value.length < 4) showIcaoError('ICAO must be 4 letters (A–Z).');
    else clearIcaoError();
  });
}

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    refreshMetar(input.value.trim().toUpperCase());
  });
}

btnRefresh?.addEventListener('click', () => refreshMetar());
btnCopy?.addEventListener('click', copyMetar);

// Dev toggles: 1/2/3 to force states
document.addEventListener('keydown', e => {
  if (e.key === '1') setState('ok');
  if (e.key === '2') setState('loading');
  if (e.key === '3') setState('error');
});
