/* ================================================================
   Pitch — app.js  |  IPL Live Scores
   ================================================================ */

const $ = id => document.getElementById(id);
const PITCH_CONFIG = window.PITCH_CONFIG || {};
const IS_STATIC_MODE = PITCH_CONFIG.mode === 'static';
const DATA_BASE_PATH = (PITCH_CONFIG.dataBasePath || './data').replace(/\/+$/, '');
const SCORECARD_BASE_PATH = (PITCH_CONFIG.scorecardBasePath || `${DATA_BASE_PATH}/scorecards`).replace(/\/+$/, '');
const ARCHIVE_SCORECARD_BASE_PATH = (PITCH_CONFIG.archiveScorecardBasePath || `${DATA_BASE_PATH}/archive-scorecards`).replace(/\/+$/, '');
const STATS_BUILDER_PATH = PITCH_CONFIG.statsBuilderPath || joinPath(DATA_BASE_PATH, 'stats-builder.json');
const POINTS_TABLE_PATH = PITCH_CONFIG.pointsTablePath || joinPath(DATA_BASE_PATH, 'points-table.json');

function joinPath(base, leaf) {
  return `${base.replace(/\/+$/, '')}/${String(leaf).replace(/^\/+/, '')}`;
}

function cacheBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

function getMatchesUrl(forceRefresh = false) {
  return IS_STATIC_MODE
    ? cacheBust(joinPath(DATA_BASE_PATH, 'matches.json'))
    : forceRefresh ? '/api/matches/refresh' : '/api/matches';
}

function getScheduleUrl(forceRefresh = false) {
  return IS_STATIC_MODE
    ? cacheBust(joinPath(DATA_BASE_PATH, 'schedule.json'))
    : forceRefresh ? '/api/schedule/refresh' : '/api/schedule';
}

function getArchiveUrl() {
  return joinPath(DATA_BASE_PATH, 'archive.json');
}

function getArchiveScorecardUrl(matchId) {
  return joinPath(ARCHIVE_SCORECARD_BASE_PATH, `${matchId}.json`);
}

function getStatsBuilderUrl() {
  return STATS_BUILDER_PATH;
}

function getPointsTableUrl() {
  return cacheBust(POINTS_TABLE_PATH);
}

function getScorecardUrl(matchId) {
  return IS_STATIC_MODE
    ? cacheBust(joinPath(SCORECARD_BASE_PATH, `${matchId}.json`))
    : `/api/scorecard/${matchId}`;
}

function getScheduleScorecardUrl(matchId) {
  return IS_STATIC_MODE
    ? cacheBust(joinPath(SCORECARD_BASE_PATH, `${matchId}.json`))
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

function provisionalBadge(item) {
  return item?.provisional ? `<span class="badge badge-provisional">Provisional</span>` : '';
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
          <span class="card-badges">${badge(m.status)}${provisionalBadge(m)}</span>
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
let pointsLoaded = false;
let pointsData = null;
let pointsSeason = '2026';

function isScheduleView(filter = currentFilter) {
  return filter === 'schedule' || filter === 'archive';
}

function isPointsView(filter = currentFilter) {
  return filter === 'points';
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
  } else if (f === 'points') {
    if (!pointsLoaded) loadPointsTable();
    else if (pointsData) renderPointsTable(pointsData);
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
  const pointsView = isPointsView(f);
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

  if (pointsView) show('pointsSection');
  else hide('pointsSection');

  // Empty state (only for non-schedule views)
  const anyVisible =
    scheduleView ||
    pointsView ||
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
    queueStatsBuilderLoad();

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
// STAT BUILDER
// ================================================================

const STAT_PRESETS = {
  batting: [
    { id: 'orange', label: 'Orange Cap', metric: 'runs', sort: 'desc', minBalls: 0, note: 'Most runs across the selected IPL seasons.' },
    { id: 'strike', label: 'Strike Rate', metric: 'strike_rate', sort: 'desc', minBalls: 100, note: 'Fastest run scoring with a balls-faced qualifier.' },
    { id: 'average', label: 'Average', metric: 'average', sort: 'desc', minBalls: 100, note: 'Consistency view for batters with dismissals.' },
    { id: 'sixes', label: 'Six Hitting', metric: 'sixes', sort: 'desc', minBalls: 0, note: 'Boundary power by sixes.' },
    { id: 'fifties', label: '50+ Scores', metric: 'fifties', sort: 'desc', minBalls: 0, note: 'Most innings of 50 or more.' },
  ],
  bowling: [
    { id: 'purple', label: 'Purple Cap', metric: 'wickets', sort: 'desc', minBalls: 0, note: 'Most wickets across the selected IPL seasons.' },
    { id: 'economy', label: 'Economy', metric: 'economy', sort: 'asc', minBalls: 120, note: 'Run control with a balls-bowled qualifier.' },
    { id: 'strike', label: 'Strike Rate', metric: 'strike_rate', sort: 'asc', minBalls: 120, note: 'Wicket-taking frequency.' },
    { id: 'dots', label: 'Dot Balls', metric: 'dots', sort: 'desc', minBalls: 0, note: 'Pressure balls that produce no runs.' },
    { id: 'maidens', label: 'Maidens', metric: 'maidens', sort: 'desc', minBalls: 0, note: 'Rare full-over control in T20 cricket.' },
  ],
};

let statsLoaded = false;
let statsLoadQueued = false;
let statsData = null;
let statsFilters = {
  mode: 'batting',
  preset: 'orange',
  yearFrom: 'all',
  yearTo: 'all',
  team: 'all',
  opposition: 'all',
  venue: 'all',
  round: 'all',
  minInnings: '5',
  minBalls: '0',
};

function currentStatsPreset() {
  const presets = STAT_PRESETS[statsFilters.mode] || STAT_PRESETS.batting;
  return presets.find(item => item.id === statsFilters.preset) || presets[0];
}

function queueStatsBuilderLoad() {
  if (statsLoadQueued || statsLoaded) return;
  const section = $('statsBuilderSection');
  if (!section) return;
  statsLoadQueued = true;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      loadStatsBuilder();
    }, { rootMargin: '420px 0px' });
    observer.observe(section);
    return;
  }

  setTimeout(loadStatsBuilder, 800);
}

async function loadStatsBuilder() {
  if (statsLoaded) return;
  statsLoaded = true;
  try {
    const res = await fetchJson(getStatsBuilderUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    statsData = await res.json();
    renderStatsBuilder();
  } catch (err) {
    const el = $('statsBuilder');
    if (el) {
      el.innerHTML = `<div class="sc-empty">Could not load Stat Builder.<br><span style="font-size:12px;color:var(--t4)">${esc(err.message)}</span></div>`;
    }
    statsLoaded = false;
    statsLoadQueued = false;
  }
}

function renderStatsBuilder() {
  const el = $('statsBuilder');
  if (!el || !statsData) return;
  el.innerHTML = `
    <div class="stats-topline">
      <div>
        <h2 class="stats-title">IPL Stat Builder</h2>
        <p class="stats-subtitle">Filter IPL batting and bowling numbers by season, team, opposition, venue, round, and qualifiers.</p>
      </div>
      <div class="stats-mode-toggle" role="tablist" aria-label="Stat type">
        ${['batting', 'bowling'].map(mode => `
          <button type="button" class="stats-mode-btn${statsFilters.mode === mode ? ' is-active' : ''}" onclick="setStatsMode('${mode}')">
            ${mode === 'batting' ? 'Batting' : 'Bowling'}
          </button>`).join('')}
      </div>
    </div>
    ${renderStatsPresetRail()}
    ${renderStatsControls()}
    <div id="statsResults">${renderStatsResults()}</div>`;
}

function renderStatsPresetRail() {
  const presets = STAT_PRESETS[statsFilters.mode] || [];
  return `
    <div class="stats-preset-rail" aria-label="Stat presets">
      ${presets.map(preset => `
        <button type="button" class="stats-preset${statsFilters.preset === preset.id ? ' is-active' : ''}" onclick="setStatsPreset('${preset.id}')">
          <span>${esc(preset.label)}</span>
          <small>${esc(preset.note)}</small>
        </button>`).join('')}
    </div>`;
}

function statsOptions(values, selected, allLabel) {
  return [`<option value="all">${esc(allLabel)}</option>`]
    .concat((values || []).map(value => {
      const stringValue = String(value);
      return `<option value="${esc(stringValue)}" ${selected === stringValue ? 'selected' : ''}>${esc(stringValue)}</option>`;
    }))
    .join('');
}

function renderStatsControls() {
  const years = statsData.years || [];
  const minLabel = statsFilters.mode === 'batting' ? 'Min balls faced' : 'Min balls bowled';
  return `
    <div class="stats-filter-panel">
      <div class="stats-filter-grid">
        <label class="stats-filter">
          <span>Season from</span>
          <select onchange="onStatsFilterChange('yearFrom', this.value)">${statsOptions(years.slice().reverse(), statsFilters.yearFrom, 'Any year')}</select>
        </label>
        <label class="stats-filter">
          <span>Season to</span>
          <select onchange="onStatsFilterChange('yearTo', this.value)">${statsOptions(years, statsFilters.yearTo, 'Any year')}</select>
        </label>
        <label class="stats-filter">
          <span>Team</span>
          <select onchange="onStatsFilterChange('team', this.value)">${statsOptions(statsData.teams, statsFilters.team, 'All teams')}</select>
        </label>
        <label class="stats-filter">
          <span>Opposition</span>
          <select onchange="onStatsFilterChange('opposition', this.value)">${statsOptions(statsData.teams, statsFilters.opposition, 'All opponents')}</select>
        </label>
        <label class="stats-filter">
          <span>Venue</span>
          <select onchange="onStatsFilterChange('venue', this.value)">${statsOptions(statsData.venues, statsFilters.venue, 'All venues')}</select>
        </label>
        <label class="stats-filter">
          <span>Round</span>
          <select onchange="onStatsFilterChange('round', this.value)">${statsOptions(statsData.rounds, statsFilters.round, 'All rounds')}</select>
        </label>
        <label class="stats-filter">
          <span>Min innings</span>
          <input inputmode="numeric" value="${esc(statsFilters.minInnings)}" onchange="onStatsFilterChange('minInnings', this.value)" />
        </label>
        <label class="stats-filter">
          <span>${esc(minLabel)}</span>
          <input inputmode="numeric" value="${esc(statsFilters.minBalls)}" onchange="onStatsFilterChange('minBalls', this.value)" />
        </label>
      </div>
      <div class="stats-actions">
        <button type="button" class="stats-reset" onclick="resetStatsBuilder()">Reset</button>
        <button type="button" class="stats-apply" onclick="applyStatsBuilder()">Apply</button>
      </div>
    </div>`;
}

function setStatsMode(mode) {
  statsFilters = {
    ...statsFilters,
    mode,
    preset: STAT_PRESETS[mode][0].id,
    minBalls: String(STAT_PRESETS[mode][0].minBalls),
  };
  renderStatsBuilder();
}

function setStatsPreset(presetId) {
  const preset = (STAT_PRESETS[statsFilters.mode] || []).find(item => item.id === presetId);
  if (!preset) return;
  statsFilters = { ...statsFilters, preset: preset.id, minBalls: String(preset.minBalls) };
  renderStatsBuilder();
}

function onStatsFilterChange(key, value) {
  statsFilters = { ...statsFilters, [key]: value };
}

function applyStatsBuilder() {
  const target = $('statsResults');
  if (target) target.innerHTML = renderStatsResults();
}

function resetStatsBuilder() {
  const mode = statsFilters.mode;
  statsFilters = {
    mode,
    preset: STAT_PRESETS[mode][0].id,
    yearFrom: 'all',
    yearTo: 'all',
    team: 'all',
    opposition: 'all',
    venue: 'all',
    round: 'all',
    minInnings: '5',
    minBalls: String(STAT_PRESETS[mode][0].minBalls),
  };
  renderStatsBuilder();
}

function statsRecordInRange(record) {
  const year = Number(record.y);
  const from = statsFilters.yearFrom === 'all' ? -Infinity : Number(statsFilters.yearFrom);
  const to = statsFilters.yearTo === 'all' ? Infinity : Number(statsFilters.yearTo);
  return year >= from &&
    year <= to &&
    (statsFilters.team === 'all' || record.t === statsFilters.team) &&
    (statsFilters.opposition === 'all' || record.o === statsFilters.opposition) &&
    (statsFilters.venue === 'all' || record.v === statsFilters.venue) &&
    (statsFilters.round === 'all' || record.r === statsFilters.round);
}

function aggregateStats() {
  const records = (statsFilters.mode === 'batting' ? statsData.batting : statsData.bowling || []).filter(statsRecordInRange);
  return statsFilters.mode === 'batting'
    ? aggregateBattingStats(records)
    : aggregateBowlingStats(records);
}

function aggregateBattingStats(records) {
  const map = new Map();
  for (const record of records) {
    const row = map.get(record.p) || {
      player: record.p,
      teams: new Set(),
      matches: new Set(),
      seasons: new Set(),
      innings: 0,
      runs: 0,
      balls: 0,
      outs: 0,
      fours: 0,
      sixes: 0,
      fifties: 0,
      hundreds: 0,
      high_score: 0,
    };
    row.teams.add(record.t);
    row.matches.add(record.m);
    row.seasons.add(record.y);
    row.innings += 1;
    row.runs += record.ru || 0;
    row.balls += record.b || 0;
    row.outs += record.out || 0;
    row.fours += record.fo || 0;
    row.sixes += record.si || 0;
    row.fifties += record.ru >= 50 ? 1 : 0;
    row.hundreds += record.ru >= 100 ? 1 : 0;
    row.high_score = Math.max(row.high_score, record.ru || 0);
    map.set(record.p, row);
  }
  return Array.from(map.values()).map(row => ({
    ...row,
    matches_count: row.matches.size,
    team_label: row.teams.size === 1 ? Array.from(row.teams)[0] : `${row.teams.size} teams`,
    season_label: seasonLabel(row.seasons),
    average: row.outs > 0 ? row.runs / row.outs : null,
    strike_rate: row.balls > 0 ? row.runs * 100 / row.balls : 0,
  }));
}

function aggregateBowlingStats(records) {
  const map = new Map();
  for (const record of records) {
    const row = map.get(record.p) || {
      player: record.p,
      teams: new Set(),
      matches: new Set(),
      seasons: new Set(),
      innings: 0,
      balls: 0,
      runs: 0,
      wickets: 0,
      dots: 0,
      maidens: 0,
    };
    row.teams.add(record.t);
    row.matches.add(record.m);
    row.seasons.add(record.y);
    row.innings += 1;
    row.balls += record.b || 0;
    row.runs += record.ru || 0;
    row.wickets += record.w || 0;
    row.dots += record.d || 0;
    row.maidens += record.md || 0;
    map.set(record.p, row);
  }
  return Array.from(map.values()).map(row => ({
    ...row,
    matches_count: row.matches.size,
    team_label: row.teams.size === 1 ? Array.from(row.teams)[0] : `${row.teams.size} teams`,
    season_label: seasonLabel(row.seasons),
    overs: ballsToOvers(row.balls),
    average: row.wickets > 0 ? row.runs / row.wickets : null,
    economy: row.balls > 0 ? row.runs * 6 / row.balls : 0,
    strike_rate: row.wickets > 0 ? row.balls / row.wickets : null,
  }));
}

function seasonLabel(seasons) {
  const values = Array.from(seasons).map(Number).sort((a, b) => a - b);
  if (!values.length) return '';
  return values[0] === values[values.length - 1] ? String(values[0]) : `${values[0]}-${values[values.length - 1]}`;
}

function ballsToOvers(balls) {
  const overs = Math.floor((balls || 0) / 6);
  const rem = (balls || 0) % 6;
  return rem ? `${overs}.${rem}` : String(overs);
}

function statMetricValue(row, metric) {
  if (metric === 'runs') return row.runs;
  if (metric === 'strike_rate') return row.strike_rate ?? 0;
  if (metric === 'average') return row.average ?? -1;
  if (metric === 'sixes') return row.sixes;
  if (metric === 'fifties') return row.fifties;
  if (metric === 'wickets') return row.wickets;
  if (metric === 'economy') return row.economy || Infinity;
  if (metric === 'dots') return row.dots;
  if (metric === 'maidens') return row.maidens;
  return row[metric] ?? 0;
}

function qualifyStatRow(row, preset) {
  const minInnings = Math.max(0, Number(statsFilters.minInnings) || 0);
  const minBalls = Math.max(0, Number(statsFilters.minBalls) || 0);
  if (row.innings < minInnings) return false;
  if ((row.balls || 0) < minBalls) return false;
  if (preset.metric === 'average' && row.average === null) return false;
  if (preset.metric === 'strike_rate' && statsFilters.mode === 'bowling' && row.strike_rate === null) return false;
  if (preset.metric === 'economy' && !row.balls) return false;
  return true;
}

function rankedStatsRows() {
  const preset = currentStatsPreset();
  return aggregateStats()
    .filter(row => qualifyStatRow(row, preset))
    .sort((a, b) => {
      const av = statMetricValue(a, preset.metric);
      const bv = statMetricValue(b, preset.metric);
      if (av === bv) {
        if (statsFilters.mode === 'batting') return b.runs - a.runs || b.strike_rate - a.strike_rate;
        return b.wickets - a.wickets || a.economy - b.economy;
      }
      return preset.sort === 'asc' ? av - bv : bv - av;
    })
    .slice(0, 100);
}

function fmt(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number(value).toFixed(digits);
}

function renderStatsResults() {
  if (!statsData) return '';
  const preset = currentStatsPreset();
  const rows = rankedStatsRows();
  const modeLabel = statsFilters.mode === 'batting' ? 'Batting' : 'Bowling';
  const metricLabel = preset.label;
  if (!rows.length) {
    return `
      <div class="stats-results-card">
        <div class="sc-empty">No players match these filters yet.<br><span style="font-size:12px;color:var(--t4)">Try widening the year range or lowering the qualifiers.</span></div>
      </div>`;
  }

  return `
    <div class="stats-results-card">
      <div class="stats-results-head">
        <div>
          <span class="stats-results-kicker">${esc(modeLabel)} leaderboard</span>
          <h3>${esc(metricLabel)}</h3>
        </div>
        <span class="stats-results-count">Top ${rows.length}</span>
      </div>
      <div class="stats-board stats-board--${statsFilters.mode}">
        <div class="stats-board-head">
          ${statsFilters.mode === 'batting' ? `
            <span>#</span><span>Player</span><span>Runs</span><span>Avg</span><span>SR</span><span>Inns</span><span>4s/6s</span><span>HS</span>
          ` : `
            <span>#</span><span>Player</span><span>Wkts</span><span>Econ</span><span>Avg</span><span>SR</span><span>Overs</span><span>Dots</span>
          `}
        </div>
        ${rows.map((row, index) => statsFilters.mode === 'batting'
          ? renderBattingStatRow(row, index)
          : renderBowlingStatRow(row, index)).join('')}
      </div>
    </div>`;
}

function renderStatPlayerCell(row) {
  return `
    <span class="stats-player-cell">
      <strong>${esc(row.player)}</strong>
      <small>${esc(row.team_label)} · ${esc(row.season_label)} · ${row.matches_count} matches</small>
    </span>`;
}

function renderBattingStatRow(row, index) {
  return `
    <div class="stats-board-row">
      <span class="stats-rank">${index + 1}</span>
      ${renderStatPlayerCell(row)}
      <span data-label="Runs">${row.runs}</span>
      <span data-label="Avg">${row.average === null ? 'no outs' : fmt(row.average, 2)}</span>
      <span data-label="SR">${fmt(row.strike_rate, 1)}</span>
      <span data-label="Inns">${row.innings}</span>
      <span data-label="4s/6s">${row.fours}/${row.sixes}</span>
      <span data-label="HS">${row.high_score}</span>
    </div>`;
}

function renderBowlingStatRow(row, index) {
  return `
    <div class="stats-board-row">
      <span class="stats-rank">${index + 1}</span>
      ${renderStatPlayerCell(row)}
      <span data-label="Wkts">${row.wickets}</span>
      <span data-label="Econ">${fmt(row.economy, 2)}</span>
      <span data-label="Avg">${fmt(row.average, 2)}</span>
      <span data-label="SR">${fmt(row.strike_rate, 1)}</span>
      <span data-label="Overs">${esc(row.overs)}</span>
      <span data-label="Dots">${row.dots}</span>
    </div>`;
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
    ${renderScorecardSummary(data)}
    ${renderInningsSwitcher(innings)}
    ${renderInnings(innings[drawerSelectedInningsIndex])}`;

  $('drawerBody').innerHTML = html;
}

function renderScorecardSummary(data) {
  if (!data.result_text && !data.date && !data.venue) return '';
  const meta = [data.date, data.venue].filter(Boolean).map(item => `<span>${esc(item)}</span>`).join('');
  return `
    <div class="scorecard-summary">
      ${meta ? `<div class="scorecard-summary-meta">${meta}</div>` : ''}
      ${data.result_text ? `<div class="scorecard-summary-result">${esc(data.result_text)}</div>` : ''}
    </div>`;
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
// POINTS TABLE
// ================================================================

async function loadPointsTable() {
  pointsLoaded = true;
  const el = $('pointsTable');
  if (el) {
    el.innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>Loading points table...</span></div>`;
  }
  try {
    const res = await fetchJson(getPointsTableUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pointsData = await res.json();
    if (!pointsData.years?.includes(Number(pointsSeason))) {
      pointsSeason = String(pointsData.years?.[0] || '2026');
    }
    renderPointsTable(pointsData);
  } catch (err) {
    if (el) el.innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
    pointsLoaded = false;
  }
}

function renderPointsTable(data) {
  const el = $('pointsTable');
  if (!el) return;
  const seasons = data.years || [];
  const table = data.tables?.[pointsSeason] || data.tables?.[String(seasons[0])] || { rows: [] };
  const rows = table.rows || [];
  const enhanced = Boolean(table.enhanced);
  const seasonOptions = seasons
    .map(year => `<option value="${year}" ${String(year) === pointsSeason ? 'selected' : ''}>${year}</option>`)
    .join('');

  el.innerHTML = `
    <div class="points-shell">
      <div class="points-head">
        <div>
          <h2 class="points-title">IPL ${esc(pointsSeason)} Points Table</h2>
          <p class="points-subtitle">${esc(table.source_note || 'League-stage standings.')}</p>
        </div>
        <label class="points-season">
          <span>Season</span>
          <select onchange="setPointsSeason(this.value)">${seasonOptions}</select>
        </label>
      </div>
      ${rows.length ? renderPointsRows(rows, enhanced) : `<div class="sc-empty">No points table data found for this season.</div>`}
    </div>`;
}

function setPointsSeason(season) {
  pointsSeason = String(season);
  if (pointsData) renderPointsTable(pointsData);
}

function renderPointsRows(rows, enhanced) {
  return `
    <div class="points-table${enhanced ? ' points-table--enhanced' : ''}">
      <div class="points-row points-row--head">
        <span>#</span><span>Team</span><span>P</span><span>W</span><span>L</span><span>NR</span><span>Pts</span><span>NRR</span>
        ${enhanced ? '<span>For</span><span>Against</span><span>Wkts</span>' : ''}
      </div>
      ${rows.map((row, index) => renderPointsRow(row, index, enhanced)).join('')}
    </div>`;
}

function renderPointsRow(row, index, enhanced) {
  const meta = teamMeta(row.team_short);
  return `
    <div class="points-row">
      <span class="points-rank">${index + 1}</span>
      <span class="points-team">
        <span class="team-badge" style="border-color:${meta.color}44;color:${meta.color};background:${meta.bg}">${esc(row.team_short)}</span>
        <span>
          <strong>${esc(row.team)}</strong>
          ${row.provisional_matches ? `<small>${row.provisional_matches} provisional result${row.provisional_matches > 1 ? 's' : ''}</small>` : ''}
        </span>
      </span>
      <span data-label="P">${row.played}</span>
      <span data-label="W">${row.won}</span>
      <span data-label="L">${row.lost}</span>
      <span data-label="NR">${row.no_result}</span>
      <span data-label="Pts">${row.points}</span>
      <span data-label="NRR">${fmt(row.nrr, 3)}</span>
      ${enhanced ? `
        <span data-label="For">${row.runs_for} / ${esc(row.overs_for)} ov</span>
        <span data-label="Against">${row.runs_against} / ${esc(row.overs_against)} ov</span>
        <span data-label="Wkts">${row.wickets_lost} lost / ${row.wickets_taken} taken</span>
      ` : ''}
    </div>`;
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
        <span class="archive-date">${provisionalBadge(match)}${esc(match.date)}</span>
      </div>
      <div class="archive-scoreboard">${scoreRows}</div>
      <div class="sch-footer">
        <span class="sch-result">${esc(match.result_text)}</span>
        <span class="archive-card-action">Full scorecard</span>
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

async function openArchiveScoreboard(el) {
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
  $('drawerBody').innerHTML = `
    <div class="sc-loading">
      <div class="sc-spin"></div>
      <span>Loading archive scorecard...</span>
    </div>`;
  $('drawerBackdrop').classList.add('open');
  $('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  stopScRefresh();

  try {
    const res = await fetchJson(getArchiveScorecardUrl(match.id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!drawerOpen || drawerMatchId !== match.id) return;
    renderScorecard(data);
  } catch (err) {
    if (!drawerOpen || drawerMatchId !== match.id) return;
    $('drawerBody').innerHTML = `
      ${renderArchiveScoreboard(match)}
      <div class="sc-empty archive-scorecard-fallback">
        Full scorecard is not available yet.<br>
        <span style="font-size:12px;color:var(--t4)">Showing the match summary instead. ${esc(err.message)}</span>
      </div>`;
  }
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
