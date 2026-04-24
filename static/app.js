/* ================================================================
   Pitch — app.js  |  IPL Live Scores
   ================================================================ */

const $ = id => document.getElementById(id);
const PITCH_CONFIG = window.PITCH_CONFIG || {};
const IS_STATIC_MODE = PITCH_CONFIG.mode === 'static';
const DATA_BASE_PATH = (PITCH_CONFIG.dataBasePath || './data').replace(/\/+$/, '');
const SCORECARD_BASE_PATH = (PITCH_CONFIG.scorecardBasePath || `${DATA_BASE_PATH}/scorecards`).replace(/\/+$/, '');

function joinPath(base, leaf) {
  return `${base.replace(/\/+$/, '')}/${String(leaf).replace(/^\/+/, '')}`;
}

function getMatchesUrl(forceRefresh = false) {
  return IS_STATIC_MODE
    ? joinPath(DATA_BASE_PATH, 'matches.json')
    : forceRefresh ? '/api/matches/refresh' : '/api/matches';
}

function getScheduleUrl(forceRefresh = false) {
  return IS_STATIC_MODE
    ? joinPath(DATA_BASE_PATH, 'schedule.json')
    : forceRefresh ? '/api/schedule/refresh' : '/api/schedule';
}

function getArchiveUrl() {
  return joinPath(DATA_BASE_PATH, 'archive.json');
}

function getScorecardUrl(matchId) {
  return IS_STATIC_MODE
    ? joinPath(SCORECARD_BASE_PATH, `${matchId}.json`)
    : `/api/scorecard/${matchId}`;
}

function getScheduleScorecardUrl(matchId) {
  return IS_STATIC_MODE
    ? joinPath(SCORECARD_BASE_PATH, `${matchId}.json`)
    : `/api/scorecard/schedule/${matchId}`;
}

function fetchJson(url) {
  return fetch(url, IS_STATIC_MODE ? { cache: 'no-store' } : undefined);
}

// ── Team meta ─────────────────────────────────────────────────
const TEAMS = {
  MI:   { color: '#1d4ed8', bg: 'rgba(29,78,216,0.15)'   },
  CSK:  { color: '#d97706', bg: 'rgba(217,119,6,0.15)'   },
  RCB:  { color: '#dc2626', bg: 'rgba(220,38,38,0.15)'   },
  KKR:  { color: '#7c3aed', bg: 'rgba(124,58,237,0.15)'  },
  DC:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)'  },
  SRH:  { color: '#ea580c', bg: 'rgba(234,88,12,0.15)'   },
  PBKS: { color: '#e11d48', bg: 'rgba(225,29,72,0.15)'   },
  RR:   { color: '#db2777', bg: 'rgba(219,39,119,0.15)'  },
  GT:   { color: '#0d9488', bg: 'rgba(13,148,136,0.15)'  },
  LSG:  { color: '#0284c7', bg: 'rgba(2,132,199,0.15)'   },
};

// Cricbuzz scorecard URL
function cbUrl(id) {
  return `https://www.cricbuzz.com/cricket-scores/${id}`;
}

// ── HTML helpers ──────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function teamMeta(short) {
  return TEAMS[short] || { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' };
}

function scoreBlock(s, cls = '') {
  if (!s) return `<span class="score-ytb">Yet to bat</span>`;
  return `<span class="score-num ${cls}">${esc(s.display)}</span>
          <span class="score-ov">${esc(s.detail)}</span>`;
}

// ── Badge HTML ─────────────────────────────────────────────────
function badge(status) {
  if (status === 'live')
    return `<span class="badge badge-live-sm">Live</span>`;
  if (status === 'upcoming')
    return `<span class="badge badge-upcoming">Upcoming</span>`;
  return `<span class="badge badge-result">Result</span>`;
}

// ── Card bar gradient from team colors ─────────────────────────
function cardBar(t1short, t2short) {
  const c1 = teamMeta(t1short).color;
  const c2 = teamMeta(t2short).color;
  return `<div class="card-bar" style="background:linear-gradient(90deg,${c1} 0%,${c1} 50%,${c2} 50%,${c2} 100%)"></div>`;
}

// ── Match card ─────────────────────────────────────────────────
function matchCard(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const isLive = m.status === 'live';
  const liveClass = isLive ? ' match-card--live' : '';

  const t1Batting = m.team1_score1 && !m.team2_score1;
  const t2Batting = Boolean(m.team2_score1);
  const t1Dim = isLive && t2Batting && !t1Batting && m.team2_score1 ? ' team-name--dim' : '';
  const t2Dim = isLive && !t2Batting ? ' team-name--dim' : '';

  const statusText = m.status === 'upcoming'
    ? (m.start_time ? `Starts at ${esc(m.start_time)}` : 'Upcoming')
    : esc(m.status_text || '');
  const statusClass = m.status === 'live' ? 'status-live'
    : m.status === 'upcoming' ? 'status-upcoming' : 'status-result';

  // Store match data on element via data attr for drawer
  const matchJson = encodeURIComponent(JSON.stringify(m));

  return `
    <div class="match-card${liveClass}" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      ${cardBar(m.team1_short, m.team2_short)}
      <div class="card-body">
        <div class="card-head">
          <span class="card-series">${esc(m.match_desc || m.series)}</span>
          ${badge(m.status)}
        </div>
        <div class="card-teams">
          <div class="team-row">
            <div class="team-left">
              <div class="team-badge" style="border-color:${t1.color}44;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
              <span class="team-name${t1Dim}">${esc(m.team1)}</span>
            </div>
            <div class="team-score">${scoreBlock(m.team1_score1)}</div>
          </div>
          <div class="team-row">
            <div class="team-left">
              <div class="team-badge" style="border-color:${t2.color}44;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
              <span class="team-name${t2Dim}">${esc(m.team2)}</span>
            </div>
            <div class="team-score">${scoreBlock(m.team2_score1)}</div>
          </div>
        </div>
      </div>
      <div class="card-sep"></div>
      <div class="card-footer">
        <span class="card-status ${statusClass}">${statusText}</span>
        ${m.venue ? `<span class="card-venue">${esc(m.venue)}</span>` : ''}
      </div>
      <span class="card-arrow">Full scorecard →</span>
    </div>`;
}

// ── Card click handler ─────────────────────────────────────────
function handleCardClick(matchId, el) {
  const raw = el.getAttribute('data-match');
  if (!raw) return;
  try {
    const m = JSON.parse(decodeURIComponent(raw));
    openDrawer(matchId, m);
  } catch(e) { console.error(e); }
}

// ── Hero card ──────────────────────────────────────────────────
function heroCard(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);

  function heroScoreInner(scoreObj) {
    if (!scoreObj) return `<span class="hero-ytb">Yet to bat</span>`;
    return `<span class="hero-score-num">${esc(scoreObj.display)}</span>
            <span class="hero-score-sub">${esc(scoreObj.detail)}</span>`;
  }

  const matchJson = encodeURIComponent(JSON.stringify(m));
  return `
    <div class="hero-card" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}' style="cursor:pointer">
      <div class="hero-top">
        <div>
          <span class="hero-series-label">${esc(m.series)}</span>
          ${m.match_desc ? `<span class="hero-match-desc">· ${esc(m.match_desc)}</span>` : ''}
        </div>
        <div class="badge-live">
          <span class="badge-live-dot"></span>
          Live Now
        </div>
      </div>

      <div class="hero-matchup">
        <!-- Team 1 -->
        <div class="hero-team">
          <div class="hero-avatar" style="border-color:${t1.color}55;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
          <span class="hero-team-name">${esc(m.team1)}</span>
          <div>${heroScoreInner(m.team1_score1)}</div>
        </div>

        <!-- VS divider -->
        <div class="hero-vs-col">
          <span class="hero-vs-text">vs</span>
          ${m.run_rate ? `<span style="font-size:11px;color:var(--t4);background:var(--surface-hi);border:1px solid var(--border);border-radius:20px;padding:2px 8px">RR ${m.run_rate}</span>` : ''}
        </div>

        <!-- Team 2 -->
        <div class="hero-team hero-team--right">
          <div class="hero-avatar" style="border-color:${t2.color}55;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
          <span class="hero-team-name">${esc(m.team2)}</span>
          <div style="text-align:right">${heroScoreInner(m.team2_score1)}</div>
        </div>
      </div>

      <div class="hero-bottom">
        <span class="hero-status">${esc(m.status_text)}</span>
        ${m.venue ? `<span class="hero-venue">📍 ${esc(m.venue)}</span>` : ''}
        <span class="hero-cta">Full scorecard →</span>
      </div>
    </div>`;
}

// ── Filter state ──────────────────────────────────────────────
let currentFilter = 'all';
let lastData = null;
let scheduleLoaded = false;
let scheduleData = null;
let archiveLoaded = false;
let archiveData = null;
let archiveFilters = { year: 'all', team: 'all', round: 'all' };

function isScheduleView(filter = currentFilter) {
  return filter === 'schedule' || filter === 'archive';
}

function getScheduleViewMeta(filter = currentFilter) {
  if (filter === 'archive') {
    return {
      heading: 'IPL Archive - 2008 onwards',
      loading: 'Loading archive…',
      empty: 'No archive matches found for these filters.',
    };
  }

  return {
    heading: 'IPL 2026 - Schedule',
    loading: 'Loading schedule…',
    empty: 'No schedule data available.',
  };
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === f);
  });
  if (f === 'archive') {
    if (!archiveLoaded) loadArchive();
    else if (archiveData) renderArchive(archiveData);
  } else if (f === 'schedule') {
    if (!scheduleLoaded) loadSchedule();
    else if (scheduleData) renderSchedule(scheduleData);
  } else {
    const controls = $('archiveControls');
    if (controls) controls.style.display = 'none';
  }
  if (lastData) applyFilter(lastData);
}

function applyFilter(data) {
  const show = id => $(id) && ($(id).style.display = '');
  const hide = id => $(id) && ($(id).style.display = 'none');
  const f = currentFilter;

  const scheduleView = isScheduleView(f);
  const showHero     = !scheduleView && (f === 'all' || f === 'live');
  const showLive     = !scheduleView && (f === 'all' || f === 'live');
  const showUpcoming = !scheduleView && (f === 'all' || f === 'upcoming');
  const showResults  = !scheduleView && (f === 'all' || f === 'results');

  // Hero
  if (data.live.length > 0 && showHero) show('heroSection');
  else hide('heroSection');

  // Live grid (extra live matches beyond hero)
  const extraLive = data.live.slice(1);
  if (extraLive.length > 0 && showLive) show('liveSection');
  else hide('liveSection');

  // Upcoming
  if (data.upcoming.length > 0 && showUpcoming) show('upcomingSection');
  else hide('upcomingSection');

  // Results
  if (data.finished.length > 0 && showResults) show('resultsSection');
  else hide('resultsSection');

  // Schedule
  if (scheduleView) show('scheduleSection');
  else hide('scheduleSection');

  // Empty state (only for non-schedule views)
  const anyVisible =
    scheduleView ||
    (data.live.length > 0 && showHero) ||
    (extraLive.length > 0 && showLive) ||
    (data.upcoming.length > 0 && showUpcoming) ||
    (data.finished.length > 0 && showResults);

  if (!anyVisible) show('emptySection');
  else hide('emptySection');
}

// ── Render ────────────────────────────────────────────────────
function render(data) {
  lastData = data;

  const totalLive = data.live.length;
  const livePill = $('livePill');
  if (livePill) {
    livePill.textContent = totalLive;
    livePill.style.display = totalLive > 0 ? 'inline-flex' : 'none';
  }

  // Hero
  $('heroInner').innerHTML = data.live.length > 0 ? heroCard(data.live[0]) : '';

  // Live grid (remaining after hero)
  $('liveGrid').innerHTML = data.live.slice(1).map(matchCard).join('');

  // Upcoming
  $('upcomingGrid').innerHTML = data.upcoming.map(matchCard).join('');

  // Results
  $('resultsGrid').innerHTML = data.finished.map(matchCard).join('');

  applyFilter(data);
}

// ── Fetch ─────────────────────────────────────────────────────
let fetching = false;

async function loadMatches(forceRefresh = false) {
  if (fetching) return;
  fetching = true;

  const btn = $('refreshBtn');
  if (btn) btn.classList.add('spinning');

  try {
    const res = await fetchJson(getMatchesUrl(forceRefresh));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.error && !data.live.length && !data.upcoming.length && !data.finished.length) {
      showError(data.error);
      return;
    }

    // Hide skeleton, show content
    $('skeletonPage').style.display  = 'none';
    $('errorPage').style.display     = 'none';
    $('content').style.display       = '';

    render(data);

    // Update timestamp
    const ts = $('timestamp');
    if (ts && data.last_updated) {
      ts.textContent = `Updated ${data.last_updated}`;
      ts.classList.add('fresh');
      setTimeout(() => ts.classList.remove('fresh'), 3000);
    }

  } catch (err) {
    showError(err.message || 'Network error');
  } finally {
    fetching = false;
    if (btn) btn.classList.remove('spinning');
  }
}

function refreshMatches() { loadMatches(true); }

function showError(msg) {
  $('skeletonPage').style.display = 'none';
  $('content').style.display      = 'none';
  $('errorPage').style.display    = '';
  const el = $('errorMsg');
  if (el) el.textContent = msg;
}

// ================================================================
// SCORECARD DRAWER
// ================================================================

let drawerOpen = false;
let drawerMatchId = null;
let drawerScorecardData = null;
let drawerSelectedInningsIndex = 0;
let drawerHasManualInningsSelection = false;

function getInningsScoreLine(score) {
  const runs = score?.runs ?? 0;
  const wickets = score?.wickets ?? 0;
  const declared = score?.declared ? 'd' : '';
  return `${runs}/${wickets}${declared}`;
}

function getDefaultInningsIndex(innings) {
  return Math.max(0, innings.length - 1);
}

function renderInningsSwitcher(innings) {
  if (innings.length <= 1) return '';

  const options = innings.map((inn, index) => {
    const activeClass = index === drawerSelectedInningsIndex ? ' is-active' : '';
    const overs = inn.score?.overs ?? 0;
    return `
      <button type="button" class="innings-switcher-btn${activeClass}" onclick="selectDrawerInnings(${index})">
        <span class="innings-switcher-team">${esc(inn.bat_team)}</span>
        <span class="innings-switcher-meta">
          <span class="innings-switcher-score">${getInningsScoreLine(inn.score)}</span>
          <span class="innings-switcher-overs">${esc(String(overs))} ov</span>
        </span>
      </button>`;
  }).join('');

  return `
    <div class="innings-switcher-wrap">
      <div class="innings-switcher">
        ${options}
      </div>
    </div>`;
}

function selectDrawerInnings(index) {
  drawerHasManualInningsSelection = true;
  drawerSelectedInningsIndex = index;
  if (drawerScorecardData) renderScorecard(drawerScorecardData);
}

function openDrawer(matchId, matchObj) {
  drawerMatchId = matchId;
  drawerOpen = true;
  drawerScorecardData = null;
  drawerSelectedInningsIndex = 0;
  drawerHasManualInningsSelection = false;

  // Set header info immediately
  $('drawerTeams').textContent = `${matchObj.team1} vs ${matchObj.team2}`;
  $('drawerMeta').textContent  = `${matchObj.series}${matchObj.match_desc ? ' · ' + matchObj.match_desc : ''}`;

  // Live bar
  const liveBar = $('drawerLiveBar');
  if (matchObj.status === 'live') {
    $('drawerStatusText').textContent = matchObj.status_text || 'Live';
    liveBar.style.display = 'flex';
  } else {
    liveBar.style.display = 'none';
  }

  // Show loading
  $('drawerBody').innerHTML = `
    <div class="sc-loading">
      <div class="sc-spin"></div>
      <span>Loading scorecard…</span>
    </div>`;

  // Open panel
  $('drawerBackdrop').classList.add('open');
  $('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Fetch scorecard (and auto-refresh if live)
  fetchScorecard(matchId);
  if (matchObj.status === 'live') startScRefresh(matchId);
}

function closeDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
  drawerScorecardData = null;
  drawerSelectedInningsIndex = 0;
  drawerHasManualInningsSelection = false;
  stopScRefresh();
  $('drawerBackdrop').classList.remove('open');
  $('drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawerOpen) closeDrawer();
});

async function fetchScorecard(matchId) {
  try {
    const res = await fetchJson(getScorecardUrl(matchId));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error && !data.innings.length) {
      $('drawerBody').innerHTML = `<div class="sc-empty">Could not load scorecard.<br>Check back in a moment.</div>`;
      return;
    }
    renderScorecard(data);
  } catch (err) {
    $('drawerBody').innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
  }
}

function renderScorecard(data) {
  if (!data.innings || data.innings.length === 0) {
    $('drawerBody').innerHTML = `<div class="sc-empty">🏏 Match hasn't started yet<br><span style="font-size:12px;color:var(--t4)">Scorecard will appear once play begins</span></div>`;
    return;
  }

  drawerScorecardData = data;
  const innings = data.innings.filter(Boolean);

  if (!hasValidDrawerInningsSelection(innings)) {
    drawerSelectedInningsIndex = getDefaultInningsIndex(innings);
  }

  const html = `
    ${renderInningsSwitcher(innings)}
    ${renderInnings(innings[drawerSelectedInningsIndex])}`;

  $('drawerBody').innerHTML = html;
}

function hasValidDrawerInningsSelection(innings) {
  if (!innings.length) return false;
  if (!drawerHasManualInningsSelection) return false;
  return drawerSelectedInningsIndex >= 0 && drawerSelectedInningsIndex < innings.length;
}

function renderInnings(inn) {
  const { score, bat_team, bowl_team, batsmen, bowlers, extras, fow } = inn;
  const scoreStr = score.declared
    ? `${score.runs}/${score.wickets}d`
    : `${score.runs}/${score.wickets}`;

  // ── Batting table ──
  const batRows = batsmen.map(b => {
    const nameFlags = [
      b.is_captain ? `<span class="captain-tag">C</span>` : '',
      b.is_keeper  ? `<span class="keeper-tag">WK</span>` : '',
      b.not_out    ? `<span class="not-out-star">★</span>` : '',
    ].join('');
    const outInfo = (!b.not_out && b.out_desc)
      ? `<span class="out-desc">${esc(b.out_desc)}</span>`
      : `<span class="out-desc" style="color:var(--result)">not out</span>`;
    const runsClass = b.not_out ? 'sc-runs sc-not-out' : 'sc-runs';
    return `
      <tr>
        <td>
          <div class="bat-name-cell">
            <span class="bat-name">${esc(b.name)} ${nameFlags}</span>
            ${outInfo}
          </div>
        </td>
        <td class="${runsClass}">${b.runs}</td>
        <td>${b.balls}</td>
        <td>${b.fours}</td>
        <td>${b.sixes}</td>
        <td>${b.strike_rate > 0 ? b.strike_rate.toFixed(1) : '—'}</td>
      </tr>`;
  }).join('');

  // Extras + total
  const extraStr = `b ${extras.byes}, lb ${extras.leg_byes}, w ${extras.wides}, nb ${extras.no_balls}`;
  const totalStr = score.declared
    ? `${score.runs}/${score.wickets}d (${score.overs} Ov)`
    : `${score.runs}/${score.wickets} (${score.overs} Ov)`;

  // ── Bowling table ──
  const bowlRows = bowlers.map(bw => `
    <tr>
      <td><span class="bowl-name">${esc(bw.name)}</span></td>
      <td>${bw.overs}</td>
      <td>${bw.maidens}</td>
      <td>${bw.runs}</td>
      <td style="color:${bw.wickets > 0 ? 'var(--result)' : 'var(--t2)'};font-weight:${bw.wickets > 0 ? 700 : 400}">${bw.wickets}</td>
      <td>${bw.economy > 0 ? bw.economy.toFixed(1) : '—'}</td>
    </tr>`).join('');

  // ── Fall of wickets ──
  const fowHtml = fow.length > 0 ? `
    <div class="sc-section-label">Fall of Wickets</div>
    <div class="fow-wrap">
      ${fow.map(w => `<span class="fow-chip">${w.runs}-${w.wkt_n} <span>(${esc(w.name)}, ${w.over} ov)</span></span>`).join('')}
    </div>` : '';

  return `
    <div class="innings-block">
      <div class="innings-headline">
        <div>
          <div class="innings-team">${esc(bat_team)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
            <span class="innings-overs">${score.overs} Overs</span>
            <span class="innings-rr">RR: ${score.run_rate}</span>
          </div>
        </div>
        <span class="innings-score-line">${scoreStr}</span>
      </div>

      <div class="sc-section-label">Batting — vs ${esc(bowl_team)}</div>
      <table class="sc-table">
        <thead>
          <tr>
            <th style="text-align:left">Batter</th>
            <th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
          </tr>
        </thead>
        <tbody>
          ${batRows}
          <tr class="sc-extras-row">
            <td>Extras</td>
            <td colspan="5">${extras.total} (${extraStr})</td>
          </tr>
          <tr class="sc-total-row">
            <td>Total</td>
            <td colspan="5">${totalStr}</td>
          </tr>
        </tbody>
      </table>

      <div class="sc-section-label" style="margin-top:16px">Bowling</div>
      <table class="sc-table">
        <thead>
          <tr>
            <th style="text-align:left">Bowler</th>
            <th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th>
          </tr>
        </thead>
        <tbody>${bowlRows}</tbody>
      </table>

      ${fowHtml}
    </div>`;
}

// Swipe down to close
(function initSwipe() {
  let startY = 0, isDragging = false;
  const panel = document.getElementById('drawer');
  if (!panel) return;

  panel.addEventListener('touchstart', e => {
    if ($('drawerBody').scrollTop > 0) return;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  panel.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    panel.style.transform = '';
    if (dy > 100) closeDrawer();
  });
})();

// ── Theme toggle ──────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('themeBtn');
  if (!btn) return;
  const moon = btn.querySelector('.icon-moon');
  const sun  = btn.querySelector('.icon-sun');
  const lbl  = btn.querySelector('.theme-label');
  if (theme === 'light') {
    moon && (moon.style.display = 'none');
    sun  && (sun.style.display  = '');
    if (lbl) lbl.textContent = 'Dark';
  } else {
    moon && (moon.style.display = '');
    sun  && (sun.style.display  = 'none');
    if (lbl) lbl.textContent = 'Light';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('pitch-theme', next);
  applyTheme(next);
}

// ================================================================
// SCHEDULE / HISTORY
// ================================================================

function scheduleMatchRow(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const isLive     = m.status === 'live';
  const isFinished = m.status === 'finished';

  const resultHtml = isFinished
    ? `<span class="sch-result">${esc(m.status_text)}</span>`
    : isLive
      ? `<span class="sch-live"><span class="pulse-dot" style="width:6px;height:6px"></span> Live</span>`
      : `<span class="sch-time">${m.start_time ? esc(m.start_time) : 'TBD'}</span>`;

  const matchJson = encodeURIComponent(JSON.stringify({
    id: m.id, team1: m.team1, team2: m.team2,
    team1_short: m.team1_short, team2_short: m.team2_short,
    series: m.series || 'IPL 2026', match_desc: m.match_desc,
    status: m.status, status_text: m.status_text, venue: m.venue,
  }));

  return `
    <div class="sch-row${isLive ? ' sch-row--live' : ''}" onclick='openScheduleScorecard(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="sch-desc">${esc(m.match_desc)}</div>
      <div class="sch-teams">
        <span class="sch-badge" style="color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</span>
        <span class="sch-team-name">${esc(m.team1)}</span>
        <span class="sch-vs">vs</span>
        <span class="sch-badge" style="color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</span>
        <span class="sch-team-name">${esc(m.team2)}</span>
      </div>
      <div class="sch-footer">
        ${resultHtml}
        ${m.venue ? `<span class="sch-venue">${esc(m.venue)}</span>` : ''}
      </div>
    </div>`;
}

function renderSchedule(data) {
  scheduleData = data;

  const meta = getScheduleViewMeta();
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = meta.heading;
  const controls = $('archiveControls');
  if (controls) {
    controls.style.display = 'none';
    controls.innerHTML = '';
  }

  const matches = (data.matches || []).filter(m => m.status !== 'finished');

  if (!matches.length) {
    $('scheduleList').innerHTML = `<div class="sc-empty">${meta.empty}</div>`;
    return;
  }

  matches.sort((a, b) => {
    const aEpoch = a.start_epoch || 0;
    const bEpoch = b.start_epoch || 0;
    return aEpoch - bEpoch;
  });

  // Group by date
  const byDate = {};
  for (const m of matches) {
    const d = m.match_date || 'Unknown Date';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(m);
  }

  let html = '';
  for (const [date, matches] of Object.entries(byDate)) {
    html += `<div class="sch-date-group">
      <div class="sch-date-header">${esc(date)}</div>
      ${matches.map(scheduleMatchRow).join('')}
    </div>`;
  }
  $('scheduleList').innerHTML = html;
}

async function loadSchedule() {
  scheduleLoaded = true;
  const meta = getScheduleViewMeta();
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = meta.heading;
  $('scheduleList').innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>${meta.loading}</span></div>`;
  try {
    const res  = await fetchJson(getScheduleUrl(false));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error && !data.matches.length) {
      $('scheduleList').innerHTML = `<div class="sc-empty">Could not load schedule: ${esc(data.error)}</div>`;
      return;
    }
    renderSchedule(data);
  } catch (err) {
    $('scheduleList').innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
    scheduleLoaded = false; // allow retry
  }
}

function archiveMatchRow(match) {
  const scoreRows = (match.innings || []).map(inn => `
    <div class="archive-score-row">
      <div class="team-left">
        <div class="team-badge" style="border-color:${inn.team_color}44;color:${inn.team_color};background:${teamMeta(inn.team_short).bg}">${esc(inn.team_short)}</div>
        <span class="team-name">${esc(inn.team)}</span>
      </div>
      <div class="team-score">
        <span class="score-num">${esc(inn.display)}</span>
        <span class="score-ov">${esc(inn.detail)}</span>
      </div>
    </div>`).join('');

  const matchJson = encodeURIComponent(JSON.stringify(match));
  return `
    <div class="sch-row archive-row" onclick="openArchiveScoreboard(this)" data-match="${matchJson}">
      <div class="archive-row-head">
        <span class="sch-desc">${esc(match.season)} · ${esc(match.round)}${match.match_number ? ` · Match ${esc(String(match.match_number))}` : ''}</span>
        <span class="archive-date">${esc(match.date)}</span>
      </div>
      <div class="archive-scoreboard">${scoreRows}</div>
      <div class="sch-footer">
        <span class="sch-result">${esc(match.result_text)}</span>
        ${match.venue ? `<span class="sch-venue">${esc(match.venue)}</span>` : ''}
      </div>
    </div>`;
}

function renderArchiveControls(data, visibleCount) {
  const yearOptions = ['<option value="all">All years</option>']
    .concat(data.years.map(year => `<option value="${year}" ${archiveFilters.year === String(year) ? 'selected' : ''}>${year}</option>`))
    .join('');
  const teamOptions = ['<option value="all">All teams</option>']
    .concat(data.teams.map(team => `<option value="${esc(team.name)}" ${archiveFilters.team === team.name ? 'selected' : ''}>${esc(team.name)}</option>`))
    .join('');
  const roundOptions = ['<option value="all">All rounds</option>']
    .concat(data.rounds.map(round => `<option value="${esc(round)}" ${archiveFilters.round === round ? 'selected' : ''}>${esc(round)}</option>`))
    .join('');

  return `
    <div class="archive-filter-grid">
      <label class="archive-filter">
        <span>Year</span>
        <select onchange="onArchiveFilterChange('year', this.value)">${yearOptions}</select>
      </label>
      <label class="archive-filter">
        <span>Team</span>
        <select onchange="onArchiveFilterChange('team', this.value)">${teamOptions}</select>
      </label>
      <label class="archive-filter">
        <span>Round</span>
        <select onchange="onArchiveFilterChange('round', this.value)">${roundOptions}</select>
      </label>
    </div>
    <div class="archive-count">${visibleCount} matches</div>`;
}

function getFilteredArchiveMatches(data) {
  return (data.matches || []).filter(match => {
    const yearOk = archiveFilters.year === 'all' || String(match.season) === archiveFilters.year;
    const teamOk = archiveFilters.team === 'all' || match.team1 === archiveFilters.team || match.team2 === archiveFilters.team;
    const roundOk = archiveFilters.round === 'all' || match.round === archiveFilters.round;
    return yearOk && teamOk && roundOk;
  });
}

function renderArchive(data) {
  archiveData = data;
  const meta = getScheduleViewMeta('archive');
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = meta.heading;

  const matches = getFilteredArchiveMatches(data);
  const controls = $('archiveControls');
  if (controls) {
    controls.style.display = '';
    controls.innerHTML = renderArchiveControls(data, matches.length);
  }

  if (!matches.length) {
    $('scheduleList').innerHTML = `<div class="sc-empty">${meta.empty}</div>`;
    return;
  }

  const byYear = new Map();
  for (const match of matches) {
    const year = String(match.season);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(match);
  }

  $('scheduleList').innerHTML = Array.from(byYear.entries())
    .map(([year, yearMatches]) => `
      <div class="sch-date-group">
        <div class="sch-date-header">${esc(year)}</div>
        ${yearMatches.map(archiveMatchRow).join('')}
      </div>`)
    .join('');
}

function onArchiveFilterChange(key, value) {
  archiveFilters = { ...archiveFilters, [key]: value };
  if (archiveData) renderArchive(archiveData);
}

async function loadArchive() {
  archiveLoaded = true;
  const meta = getScheduleViewMeta('archive');
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = meta.heading;
  const controls = $('archiveControls');
  if (controls) {
    controls.style.display = 'none';
    controls.innerHTML = '';
  }
  $('scheduleList').innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>${meta.loading}</span></div>`;
  try {
    const res = await fetchJson(getArchiveUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderArchive(await res.json());
  } catch (err) {
    $('scheduleList').innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
    archiveLoaded = false;
  }
}

function openArchiveScoreboard(el) {
  const raw = el.getAttribute('data-match');
  if (!raw) return;
  const match = JSON.parse(decodeURIComponent(raw));
  drawerMatchId = match.id;
  drawerOpen = true;
  drawerScorecardData = null;
  drawerSelectedInningsIndex = 0;
  drawerHasManualInningsSelection = false;

  $('drawerTeams').textContent = `${match.team1} vs ${match.team2}`;
  $('drawerMeta').textContent = `${match.season} · ${match.round}${match.match_number ? ' · Match ' + match.match_number : ''}`;
  $('drawerLiveBar').style.display = 'none';
  $('drawerBody').innerHTML = renderArchiveScoreboard(match);
  $('drawerBackdrop').classList.add('open');
  $('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderArchiveScoreboard(match) {
  const innings = (match.innings || []).map(inn => `
    <div class="archive-drawer-innings">
      <div>
        <div class="innings-team">${esc(inn.team)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
          <span class="innings-overs">${esc(inn.detail)}</span>
          ${inn.target ? `<span class="innings-rr">Target ${esc(String(inn.target))}</span>` : ''}
        </div>
      </div>
      <span class="innings-score-line">${esc(inn.display)}</span>
    </div>`).join('');

  return `
    <div class="archive-drawer">
      <div class="archive-drawer-meta">
        <span>${esc(match.date)}</span>
        ${match.venue ? `<span>${esc(match.venue)}</span>` : ''}
      </div>
      ${innings}
      <div class="archive-drawer-result">${esc(match.result_text)}</div>
    </div>`;
}

function openScheduleScorecard(matchId, el) {
  const raw = el.getAttribute('data-match');
  if (!raw) return;
  try {
    const m = JSON.parse(decodeURIComponent(raw));
    // Reuse the drawer but point at the schedule scorecard endpoint
    openDrawerForSchedule(matchId, m);
  } catch(e) { console.error(e); }
}

function openDrawerForSchedule(matchId, matchObj) {
  drawerMatchId = matchId;
  drawerOpen = true;
  drawerScorecardData = null;
  drawerSelectedInningsIndex = 0;
  drawerHasManualInningsSelection = false;

  $('drawerTeams').textContent = `${matchObj.team1} vs ${matchObj.team2}`;
  $('drawerMeta').textContent  = `IPL 2026${matchObj.match_desc ? ' · ' + matchObj.match_desc : ''}`;

  const liveBar = $('drawerLiveBar');
  if (matchObj.status === 'live') {
    $('drawerStatusText').textContent = matchObj.status_text || 'Live';
    liveBar.style.display = 'flex';
  } else {
    liveBar.style.display = 'none';
  }

  $('drawerBody').innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>Loading scorecard…</span></div>`;
  $('drawerBackdrop').classList.add('open');
  $('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';

  fetchScheduleScorecard(matchId);
  if (matchObj.status === 'live') startScRefresh(matchId);
}

async function fetchScheduleScorecard(matchId) {
  try {
    const res  = await fetchJson(getScheduleScorecardUrl(matchId));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error && !data.innings.length) {
      $('drawerBody').innerHTML = `<div class="sc-empty">Could not load scorecard.<br>Check back in a moment.</div>`;
      return;
    }
    renderScorecard(data);
  } catch (err) {
    $('drawerBody').innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
  }
}

// ── Live scorecard auto-refresh ───────────────────────────────
let scRefreshTimer = null;

function startScRefresh(matchId) {
  stopScRefresh();
  scRefreshTimer = setInterval(() => {
    if (drawerOpen && drawerMatchId === matchId) {
      fetchScorecard(matchId);
    } else {
      stopScRefresh();
    }
  }, 20_000);
}

function stopScRefresh() {
  if (scRefreshTimer) { clearInterval(scRefreshTimer); scRefreshTimer = null; }
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved theme (default dark)
  const saved = localStorage.getItem('pitch-theme') || 'dark';
  applyTheme(saved);
  loadMatches(false);
  // Auto-refresh match list every 30 seconds when drawer is closed
  setInterval(() => { if (!drawerOpen) loadMatches(false); }, 30_000);
});
