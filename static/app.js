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
const STATIC_BASE_PATH = (PITCH_CONFIG.staticBasePath || './static').replace(/\/+$/, '');
const ASSET_MANIFEST_PATH = PITCH_CONFIG.assetManifestPath || joinPath(DATA_BASE_PATH, 'asset-manifest.json');

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
  return IS_STATIC_MODE ? cacheBust(POINTS_TABLE_PATH) : cacheBust('/api/points-table');
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
// color  = primary team colour (used for text, borders, accents)
// color2 = secondary/gradient end colour (used in badge gradients)
// bg     = translucent tint for legacy card outlines
const TEAMS = {
  MI:   { color: '#004BA0', color2: '#0078D7', bg: 'rgba(0,75,160,0.15)'    },
  CSK:  { color: '#F9CD05', color2: '#F15A22', bg: 'rgba(249,205,5,0.15)'   },
  RCB:  { color: '#EC1C24', color2: '#8B0000', bg: 'rgba(236,28,36,0.15)'   },
  KKR:  { color: '#3A225D', color2: '#FFC72C', bg: 'rgba(58,34,93,0.15)'    },
  DC:   { color: '#004C93', color2: '#EF1B23', bg: 'rgba(0,76,147,0.15)'    },
  SRH:  { color: '#FF822A', color2: '#F7A721', bg: 'rgba(255,130,42,0.15)'  },
  PBKS: { color: '#DD1F2D', color2: '#84171B', bg: 'rgba(221,31,45,0.15)'   },
  RR:   { color: '#EA1A85', color2: '#254AA5', bg: 'rgba(234,26,133,0.15)'  },
  GT:   { color: '#0B4973', color2: '#1B6B3A', bg: 'rgba(11,73,115,0.15)'   },
  LSG:  { color: '#A72056', color2: '#FFCC00', bg: 'rgba(167,32,86,0.15)'   },
};

const TEAM_FULL_NAMES = {
  CSK:  'Chennai Super Kings',
  MI:   'Mumbai Indians',
  RCB:  'Royal Challengers Bengaluru',
  KKR:  'Kolkata Knight Riders',
  DC:   'Delhi Capitals',
  SRH:  'Sunrisers Hyderabad',
  PBKS: 'Punjab Kings',
  RR:   'Rajasthan Royals',
  GT:   'Gujarat Titans',
  LSG:  'Lucknow Super Giants',
};
const TEAM_ORDER = ['CSK','MI','RCB','KKR','DC','SRH','PBKS','RR','GT','LSG'];

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
  return TEAMS[short] || { color: '#818cf8', color2: '#a78bfa', bg: 'rgba(129,140,248,0.12)' };
}


// ── Match intelligence helpers (real-data derived, no mock inputs) ──
function pointsRowsForSeason() {
  const tables = pointsData?.tables || {};
  const season = tables[pointsSeason] ? pointsSeason : Object.keys(tables).sort().pop();
  return season && tables[season]?.rows ? tables[season].rows : [];
}

function standingForTeam(short) {
  const rows = pointsRowsForSeason();
  const idx = rows.findIndex(r => r.team_short === short);
  if (idx < 0) return null;
  return { ...rows[idx], rank: idx + 1 };
}

function formPillsHtml(form = []) {
  const recent = (form || []).slice(-3);
  if (!recent.length) return '';
  return `<span class="mini-form-pills">${recent.map(r => {
    const win = String(r).toUpperCase() === 'W';
    return `<span class="mini-form-pill ${win ? 'is-win' : 'is-loss'}">${esc(r)}</span>`;
  }).join('')}</span>`;
}

function teamMiniIntel(short) {
  const row = standingForTeam(short);
  if (!row) return '';
  return `<span class="team-mini-intel"><span>#${row.rank}</span>${formPillsHtml(row.last_5)}</span>`;
}

function qualificationBand(row) {
  if (!row || row.qualification_pct == null) return null;
  const pct = Number(row.qualification_pct);
  if (pct >= 85) return { label: 'Strong top-4', tone: 'safe', pct };
  if (pct >= 65) return { label: 'Top-4 track', tone: 'safe', pct };
  if (pct >= 40) return { label: 'Bubble', tone: 'warn', pct };
  if (pct >= 15) return { label: 'Must win', tone: 'danger', pct };
  return { label: 'Elimination heat', tone: 'danger', pct };
}

function matchStakes(m) {
  const a = standingForTeam(m.team1_short);
  const b = standingForTeam(m.team2_short);
  if (!a || !b) return { severity: 'Fixture', tone: 'neutral', impact: '', chips: [], headline: '' };

  const aBand = qualificationBand(a);
  const bBand = qualificationBand(b);
  const rankGap = Math.abs(a.rank - b.rank);
  const topFourClash = a.rank <= 4 && b.rank <= 4;
  const bubbleClash = [a, b].some(r => r.rank >= 4 && r.rank <= 7);
  const danger = [aBand, bBand].some(x => x && x.tone === 'danger');
  const pointsGap = Math.abs((a.points || 0) - (b.points || 0));

  let severity = 'Medium stakes', tone = 'neutral';
  if (danger || (bubbleClash && pointsGap <= 4)) { severity = 'High stakes'; tone = 'danger'; }
  if (topFourClash || (rankGap <= 2 && pointsGap <= 2)) { severity = 'Table swing'; tone = 'warn'; }
  if (danger && bubbleClash) { severity = 'Must-win heat'; tone = 'danger'; }

  // Generate clean headlines like "RCB win locks them into top 4"
  let headline = '';
  if (danger && aBand?.tone === 'danger') headline = `${esc(m.team1_short)} must win to keep playoff hopes alive`;
  else if (danger && bBand?.tone === 'danger') headline = `${esc(m.team2_short)} must win to keep playoff hopes alive`;
  else if (topFourClash) {
    if (a.rank < b.rank) headline = `${esc(m.team1_short)} win locks them into top 4`;
    else headline = `${esc(m.team2_short)} win locks them into top 4`;
  }
  else if (bubbleClash && pointsGap <= 4) headline = `${esc(m.team1_short)} vs ${esc(m.team2_short)} — qualification showdown`;
  else if (rankGap <= 1 && pointsGap <= 2) headline = `${esc(m.team1_short)} can leapfrog ${esc(m.team2_short)} with a win`;
  else if (danger) headline = `Playoff survival: ${esc(m.team1_short)} vs ${esc(m.team2_short)}`;
  else if (a.rank <= 4 && b.rank > 4) headline = `${esc(m.team1_short)} can consolidate top 4 with a win`;
  else if (b.rank <= 4 && a.rank > 4) headline = `${esc(m.team2_short)} can consolidate top 4 with a win`;

  const chips = [];
  if (aBand) chips.push(`${m.team1_short}: ${aBand.pct}%`);
  if (bBand) chips.push(`${m.team2_short}: ${bBand.pct}%`);
  if (rankGap <= 2) chips.push('Rank pressure');
  if (pointsGap <= 2) chips.push('2-pt swing');

  let impact = `${m.team1_short} #${a.rank} (${a.points} pts) vs ${m.team2_short} #${b.rank} (${b.points} pts)`;
  if (danger) impact = `${impact} · playoff survival pressure`;
  else if (topFourClash) impact = `${impact} · top-four positioning`;
  else if (bubbleClash) impact = `${impact} · qualification bubble`;

  return { severity, tone, impact, chips, headline };
}

function resultMarginBadge(m) {
  const text = String(m.status_text || '').toLowerCase();
  let label = 'Result', tone = 'safe';
  const runs = text.match(/(\d+)\s+runs?/);
  const wkts = text.match(/(\d+)\s+(?:wickets?|wkts?)/);
  if (runs) {
    const n = Number(runs[1]);
    if (n <= 5) { label = 'Thriller'; tone = 'danger'; }
    else if (n <= 10) { label = 'Close'; tone = 'warn'; }
    else if (n <= 20) { label = 'Comfortable'; tone = 'safe'; }
    else if (n >= 50) { label = 'Dominant'; tone = 'safe'; }
    else { label = 'Comfortable'; tone = 'safe'; }
  } else if (wkts) {
    const n = Number(wkts[1]);
    if (n <= 2) { label = 'Thriller'; tone = 'danger'; }
    else if (n <= 4) { label = 'Close'; tone = 'warn'; }
    else if (n >= 8) { label = 'Dominant'; tone = 'safe'; }
    else { label = 'Comfortable'; tone = 'safe'; }
  }
  return `<span class="match-intel-chip ${tone}" style="font-size:10px">${label}</span>`;
}

function tableImpactLine(m, t1Winner, t2Winner) {
  const winner = t1Winner ? m.team1_short : t2Winner ? m.team2_short : null;
  const loser = t1Winner ? m.team2_short : t2Winner ? m.team1_short : null;
  const wr = standingForTeam(winner);
  const lr = standingForTeam(loser);
  if (!winner || !wr) return '';
  // Generate a clean narrative line like "GT jump to #2, RR slip to danger zone"
  const wBand = qualificationBand(wr);
  const lBand = lr ? qualificationBand(lr) : null;
  const wText = wBand && wBand.tone === 'safe' ? `${winner} jump to #${wr.rank}` : `${winner} hold at #${wr.rank}`;
  const lText = lr ? (lBand && lBand.tone === 'danger' ? `${loser} slip to danger zone` : `${loser} drop to #${lr.rank}`) : '';
  const text = lText ? `${wText}, ${lText}` : wText;
  return `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;opacity:.5">📊</span><span>${esc(text)}</span></div>`;
}

// ── Asset manifest (loaded once at startup from data/asset-manifest.json) ──
let assetManifest = { team_logos: {}, player_images: {} };
let playerImageLookup = {};
function normalizePlayerKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function addPlayerImageAlias(alias, path) {
  const key = normalizePlayerKey(alias);
  if (key && path && !playerImageLookup[key]) playerImageLookup[key] = path;
}
function buildPlayerImageLookup() {
  playerImageLookup = {};
  const images = assetManifest.player_images || {};
  for (const [name, path] of Object.entries(images)) {
    addPlayerImageAlias(name, path);
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(p => p[0]).join('');
      addPlayerImageAlias(`${initials} ${last}`, path);       // Virat Kohli -> V Kohli, Rohit Sharma -> R Sharma
      addPlayerImageAlias(`${initials}${last}`, path);        // VKohli
      if (parts.length >= 3) {
        addPlayerImageAlias(`${parts[0][0]} ${parts.slice(1).join(' ')}`, path); // Faf du Plessis -> F du Plessis
      }
    }
  }
  // Common cricket scorecard abbreviations that differ from display/full names.
  const manualAliases = {
    'V Kohli': 'Virat Kohli',
    'RG Sharma': 'Rohit Sharma',
    'RA Jadeja': 'Ravindra Jadeja',
    'SP Narine': 'Sunil Narine',
    'HH Pandya': 'Hardik Pandya',
    'KH Pandya': 'Krunal Pandya',
    'JJ Bumrah': 'Jasprit Bumrah',
    'Ruturaj Gaikwad': 'Ruturaj Gaikwad',
    'RD Gaikwad': 'Ruturaj Gaikwad',
    'YS Chahal': 'Yuzvendra Chahal',
    'RR Pant': 'Rishabh Pant',
    'SV Samson': 'Sanju Samson',
    'S Dhawan': 'Shikhar Dhawan',
    'Shubman Gill': 'Shubman Gill',
    'KL Rahul': 'KL Rahul',
    'MS Dhoni': 'MS Dhoni'
  };
  for (const [alias, full] of Object.entries(manualAliases)) {
    const path = images[full] || playerImageLookup[normalizePlayerKey(full)];
    if (path) addPlayerImageAlias(alias, path);
  }
}
function getPlayerImagePath(playerName) {
  return (assetManifest.player_images || {})[playerName] || playerImageLookup[normalizePlayerKey(playerName)] || '';
}
async function loadAssetManifest() {
  try {
    const r = await fetch(cacheBust(ASSET_MANIFEST_PATH));
    if (r.ok) assetManifest = await r.json();
  } catch (e) { /* use fallbacks silently */ }
  buildPlayerImageLookup();
}

// team abbr → logo file extension (only MI uses .jpg, rest .webp)
const TEAM_LOGO_EXT = {};

// ── Inline-style team badge with real logo image + text fallback ──
function teamBadge(short, size = 44) {
  const t = teamMeta(short);
  const ext = TEAM_LOGO_EXT[short] || 'png';
  const logoSrc = joinPath(STATIC_BASE_PATH, `team-logos/${short}.${ext}`);
  return `<img src="${logoSrc}" alt="${esc(short)}" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;border-radius:${Math.round(size*0.1)}px"
       onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"
       loading="lazy">
    <span style="display:none;font-size:${Math.round(size*0.35)}px;font-weight:800;color:${t.color};flex-shrink:0;text-align:center;width:${size}px">${esc(short)}</span>`;
}

// ── Player avatar: real photo (from manifest) or initials circle ──
function playerAvatar(playerName, teamShort, size = 36) {
  const t = teamMeta(teamShort || '');
  const color = t.color;
  const words = (playerName || '?').split(' ');
  const initials = (words.length >= 2
    ? (words[0][0] + words[words.length - 1][0])
    : (playerName || '?').slice(0, 2)
  ).toUpperCase();

  const imgPath = getPlayerImagePath(playerName);
  if (imgPath) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${color},${color}88);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
      <img src="${joinPath('./', imgPath)}" alt="${esc(playerName)}" style="width:100%;height:100%;object-fit:cover"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span style="display:none;font-size:${Math.round(size * 0.33)}px;font-weight:700;color:#fff;align-items:center;justify-content:center;width:100%;height:100%">${esc(initials)}</span>
    </div>`;
  }

  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${color},${color}88);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.33)}px;font-weight:700;color:#fff;flex-shrink:0">${esc(initials)}</div>`;
}

function scoreBlock(s, cls = '') {
  if (!s) return `<span class="score-ytb">Yet to bat</span>`;
  return `<span class="score-num ${cls}">${esc(s.display)}</span>
          <span class="score-ov">${esc(s.detail)}</span>`;
}

// ── Badge HTML ─────────────────────────────────────────────────
function badge(status) {
  if (status === 'live') {
    return `<span class="status-badge badge-live-sm"><span class="live-dot" style="background:var(--live)"></span>Live</span>`;
  }
  if (status === 'upcoming') {
    return `<span class="status-badge badge-upcoming"><span class="static-dot" style="background:var(--upcoming)"></span>Upcoming</span>`;
  }
  return `<span class="status-badge badge-result"><span class="static-dot" style="background:var(--result)"></span>Result</span>`;
}

function provisionalBadge(item) {
  return item?.provisional ? `<span class="status-badge badge-provisional">Provisional</span>` : '';
}

function matchAccent(status) {
  if (status === 'live') return 'var(--live)';
  if (status === 'upcoming') return 'var(--upcoming)';
  return 'var(--result)';
}

// ── Match card (glass redesign) ────────────────────────────────
function matchCard(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const isLive     = m.status === 'live';
  const isResult   = m.status === 'finished';
  const isUpcoming = m.status === 'upcoming';
  const matchJson  = encodeURIComponent(JSON.stringify(m));

  // ── Upcoming card ──────────────────────────────────────────
  if (isUpcoming) {
    return `
    <article class="match-card match-card--upcoming" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="card-stripe" style="background:linear-gradient(90deg,${t1.color},${t2.color})"></div>
      <header class="match-head">
        <div class="match-head-left">
          ${badge('upcoming')}${provisionalBadge(m)}
          <span class="card-series">${esc(m.match_desc || m.series)}</span>
        </div>
        ${m.start_time ? `<time class="card-time" style="font-size:12px;font-weight:600;color:var(--upcoming)">${esc(m.start_time)}</time>` : ''}
      </header>
      <div class="match-vs-body">
        <div class="vs-team">
          <div class="team-badge lg" style="border-color:${t1.color}55;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
          <span class="vs-team-name">${esc(m.team1)}</span>
        </div>
        <div class="vs-divider-wrap">
          <span class="vs-divider">vs</span>
        </div>
        <div class="vs-team vs-team--right">
          <div class="team-badge lg" style="border-color:${t2.color}55;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
          <span class="vs-team-name">${esc(m.team2)}</span>
        </div>
      </div>
      <footer class="match-foot">
        ${m.venue ? `<span class="match-venue">📍 ${esc(m.venue)}</span>` : '<span></span>'}
        <span class="match-cta" style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.35)">Tap for details →</span>
      </footer>
    </article>`;
  }

  // ── Live / Result card ─────────────────────────────────────
  const t2Batting = isLive && Boolean(m.team2_score1);
  const t1Opacity = isLive && t2Batting  ? 'opacity:0.45;' : '';
  const t2Opacity = isLive && !t2Batting ? 'opacity:0.45;' : '';

  let t1Winner = false, t2Winner = false;
  if (isResult && m.status_text) {
    const st = m.status_text.toLowerCase();
    const t1Check = [m.team1, m.team1_short].filter(Boolean).map(s => s.toLowerCase());
    const t2Check = [m.team2, m.team2_short].filter(Boolean).map(s => s.toLowerCase());
    if (t1Check.some(s => st.startsWith(s))) t1Winner = true;
    else if (t2Check.some(s => st.startsWith(s))) t2Winner = true;
  }

  const statusText  = esc(m.status_text || (isLive ? 'Live' : ''));
  const statusClass = isLive ? 'status-live' : 'status-result';

  // Gradient top-stripe
  const stripeGrad = isLive
    ? `linear-gradient(90deg,${t1.color},rgba(239,68,68,0.6),${t2.color})`
    : `linear-gradient(90deg,${t1.color},${t2.color})`;

  return `
    <article class="match-card${isLive ? ' match-card--live' : ' match-card--result'}" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="card-stripe" style="background:${stripeGrad}"></div>
      <header class="match-head">
        <div class="match-head-left">
          ${badge(m.status)}${provisionalBadge(m)}
          <span class="card-series">${esc(m.match_desc || m.series)}</span>
        </div>
        ${isLive && m.run_rate ? `<span style="font-size:10px;font-weight:700;color:var(--text-2);font-family:var(--mono)">CRR ${esc(String(m.run_rate))}</span>` : ''}
      </header>
      <div class="match-rows">
        <div class="match-row" style="${t1Opacity}">
          <div class="team-left">
            <div class="team-badge" style="border-color:${t1.color}55;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
            <span class="team-name-sm">${esc(m.team1)}</span>
            ${t1Winner ? `<span class="winner-tag">W</span>` : ''}
          </div>
          <div class="team-right-score">
            ${m.team1_score1 ? `<span class="score-num" style="color:${t1.color}">${esc(m.team1_score1.display)}</span><span class="score-ov">${esc(m.team1_score1.detail)}</span>` : `<span class="score-ytb">Yet to bat</span>`}
          </div>
        </div>
        <div class="match-row" style="${t2Opacity}">
          <div class="team-left">
            <div class="team-badge" style="border-color:${t2.color}55;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
            <span class="team-name-sm">${esc(m.team2)}</span>
            ${t2Winner ? `<span class="winner-tag">W</span>` : ''}
          </div>
          <div class="team-right-score">
            ${m.team2_score1 ? `<span class="score-num" style="color:${t2.color}">${esc(m.team2_score1.display)}</span><span class="score-ov">${esc(m.team2_score1.detail)}</span>` : `<span class="score-ytb">Yet to bat</span>`}
          </div>
        </div>
      </div>
      <footer class="match-foot">
        <span class="match-status ${statusClass}">${statusText}</span>
        ${m.venue ? `<span class="match-venue">${esc(m.venue)}</span>` : ''}
      </footer>
    </article>`;
}

// ══════════════════════════════════════════════════════════════
// CRICKLY-STYLE CARD TEMPLATES
// ══════════════════════════════════════════════════════════════

// ── Crickly Hero Card ─────────────────────────────────────────
function heroCK(m, sc = null) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const s1 = m.team1_score1;
  const s2 = m.team2_score1;

  // Background uses both team colours
  const bgGrad = `linear-gradient(135deg,${t1.color}22,${t2.color}08)`;

  // ── Extract batters & bowlers from scorecard ─────────────────
  let battersHtml = '', bowlersHtml = '', winProbHtml = '', panelsHtml = '';

  let intelBatters = m.batters || null;
  let intelBowlers = m.bowlers || null;
  let intelWp = m.win_prob || null;
  let intelProj = m.projection_data || null;

  // Build batter/bowler HTML from intel data if available (faster than scorecard fetch)
  if (intelBatters && intelBatters.length) {
    battersHtml = intelBatters.slice(0, 2).map(function(b) {
      var sr = b.sr || (b.balls > 0 ? (b.runs * 100 / b.balls) : 0);
      return '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="player-avatar-fallback" style="width:30px;height:30px;font-size:12px;background:' + (m.team1_color || '#6366f1') + '20;border-color:' + (m.team1_color || '#6366f1') + '40;color:' + (m.team1_color || '#6366f1') + '">' + (b.name ? b.name.split(' ').map(function(s,j){return j===0||j===b.name.split(' ').length-1?s[0]:'';}).filter(Boolean).join('') : '?') + '</span></div>'
        + '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b.name) + '</div><div style="font-size:11px;color:var(--ct3)">SR ' + sr.toFixed(1) + (b.fours ? ' \u00b7 ' + b.fours + '\u00d74' : '') + (b.sixes ? ' ' + b.sixes + '\u00d76' : '') + '</div></div>'
        + '<span style="font-size:15px;font-weight:800;color:var(--ct);flex-shrink:0">' + (b.runs || 0) + '<span style="font-size:11px;font-weight:500;color:var(--ct4)"> (' + (b.balls || 0) + ')</span></span></div>';
    }).join('');
  }
  if (intelBowlers && intelBowlers.length) {
    bowlersHtml = intelBowlers.slice(0, 2).map(function(b) {
      return '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="player-avatar-fallback" style="width:30px;height:30px;font-size:12px;background:' + (m.team2_color || '#6366f1') + '20;border-color:' + (m.team2_color || '#6366f1') + '40;color:' + (m.team2_color || '#6366f1') + '">' + (b.name ? b.name.split(' ').map(function(s,j){return j===0||j===b.name.split(' ').length-1?s[0]:'';}).filter(Boolean).join('') : '?') + '</span></div>'
        + '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b.name) + '</div><div style="font-size:11px;color:var(--ct3)">Econ ' + (b.econ || 0).toFixed(2) + '</div></div>'
        + '<span style="font-size:15px;font-weight:800;color:var(--ct);flex-shrink:0">' + (b.wickets || 0) + '/' + (b.runs || 0) + '</span></div>';
    }).join('');
  }

  if (intelWp) {
    var p1 = intelWp.batting_team, p2 = intelWp.fielding_team;
    winProbHtml = '<div style="padding:0 24px 18px;position:relative;z-index:1"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:600;color:var(--ct3)">Win Probability</span><div style="display:flex;gap:14px"><span style="font-size:11px;color:' + t1.color + ';font-weight:700">' + esc(m.team1_short) + ' ' + p1 + '%</span><span style="font-size:11px;color:' + t2.color + ';font-weight:700">' + esc(m.team2_short) + ' ' + p2 + '%</span></div></div><div style="height:7px;border-radius:4px;overflow:hidden;display:flex;background:var(--cwpbg)"><div style="width:' + p1 + '%;background:linear-gradient(90deg,' + t1.color + ',' + (t1.color2 || t1.color + 'cc') + ');transition:width 1.5s cubic-bezier(.4,0,.2,1)"></div><div style="flex:1;background:linear-gradient(90deg,' + t2.color + ',' + (t2.color2 || t2.color + 'cc') + ');transition:width 1.5s cubic-bezier(.4,0,.2,1)"></div></div></div>';
  }

  if (sc && sc.innings && sc.innings.length > 0) {
    const curInn = sc.innings[sc.innings.length - 1];
    const batsmen = (curInn.batsmen || []).filter(b => (b.balls || 0) > 0)
      .sort((a, b) => (b.runs || 0) - (a.runs || 0)).slice(0, 2);
    const bowlers = (curInn.bowlers || [])
      .sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.economy || 99) - (b.economy || 99))
      .slice(0, 2);

    battersHtml = batsmen.map(b => `
      <div style="display:flex;align-items:center;gap:10px">
        ${playerAvatar(b.name, m.team1_short, 30)}
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</div>
          <div style="font-size:11px;color:var(--ct3)">${b.fours || 0}×4 ${b.sixes || 0}×6</div>
        </div>
        <span style="font-size:15px;font-weight:800;color:var(--ct);flex-shrink:0">${b.runs}<span style="font-size:11px;font-weight:500;color:var(--ct4)"> (${b.balls})</span></span>
      </div>`).join('');

    bowlersHtml = bowlers.map(bw => `
      <div style="display:flex;align-items:center;gap:10px">
        ${playerAvatar(bw.name, m.team2_short, 30)}
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(bw.name)}</div>
          <div style="font-size:11px;color:var(--ct3)">${bw.overs} ov · Econ ${bw.economy || '-'}</div>
        </div>
        <span style="font-size:15px;font-weight:800;color:var(--ct);flex-shrink:0">${bw.wickets}/${bw.runs}</span>
      </div>`).join('');

    // Win probability (chasing innings only)
    if (sc.innings.length >= 2) {
      const inn1 = sc.innings[0];
      const inn2 = sc.innings[sc.innings.length - 1];
      const target    = (inn1.score?.runs || 0) + 1;
      const chased    = inn2.score?.runs || 0;
      const ballsDone = _overs2balls(inn2.score?.overs || 0);
      const ballsLeft = 120 - ballsDone;
      const needed    = target - chased;
      if (ballsLeft > 0 && needed > 0) {
        const crr = ballsDone > 0 ? chased * 6 / ballsDone : 0;
        const rrr = needed * 6 / ballsLeft;
        let p2 = Math.round(50 + (crr - rrr) * 4);
        p2 = Math.min(95, Math.max(5, p2));
        const p1 = 100 - p2;
        winProbHtml = `
          <div style="padding:0 24px 18px;position:relative;z-index:1">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:11px;font-weight:600;color:var(--ct3)">Win Probability</span>
              <div style="display:flex;gap:14px">
                <span style="font-size:11px;color:${t1.color};font-weight:700">${esc(m.team1_short)} ${p1}%</span>
                <span style="font-size:11px;color:${t2.color};font-weight:700">${esc(m.team2_short)} ${p2}%</span>
              </div>
            </div>
            <div style="height:7px;border-radius:4px;overflow:hidden;display:flex;background:var(--cwpbg)">
              <div style="width:${p1}%;background:linear-gradient(90deg,${t1.color},${t1.color2 || t1.color}cc);transition:width 1.5s cubic-bezier(.4,0,.2,1)"></div>
              <div style="flex:1;background:linear-gradient(90deg,${t2.color},${t2.color2 || t2.color}cc);transition:width 1.5s cubic-bezier(.4,0,.2,1)"></div>
            </div>
          </div>`;
      }
    }
  }

  panelsHtml = (battersHtml || bowlersHtml) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 24px 16px;position:relative;z-index:1">
      <div style="background:var(--csf);border-radius:12px;padding:14px 16px;border:1px solid var(--csfbd)">
        <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Batting</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${battersHtml || `<span style="font-size:11px;color:var(--ct4)">Loading…</span>`}
        </div>
      </div>
      <div style="background:var(--csf);border-radius:12px;padding:14px 16px;border:1px solid var(--csfbd)">
        <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Bowling</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${bowlersHtml || `<span style="font-size:11px;color:var(--ct4)">Loading…</span>`}
        </div>
      </div>
    </div>` : '';

  return `
    <article class="hero-live-card" style="background:${bgGrad};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;position:relative;cursor:pointer"
             onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>

      <!-- Glow blobs -->
      <div style="position:absolute;top:-60px;left:-60px;width:200px;height:200px;border-radius:50%;background:${t1.color}18;filter:blur(60px);pointer-events:none"></div>
      <div style="position:absolute;bottom:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:${t2.color}0d;filter:blur(60px);pointer-events:none"></div>

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:24px 24px 0;position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase;animation:livePulse 2s infinite;display:inline-block">LIVE</span>
          <span style="color:var(--ct);font-size:13.5px;font-weight:600">${esc(m.series || 'IPL 2026')}${m.match_desc ? ' · ' + esc(m.match_desc) : ''}</span>
        </div>
        ${m.run_rate ? `<span style="color:var(--ct4);font-size:12px">CRR ${esc(String(m.run_rate))}</span>` : ''}
      </div>
      ${m.venue ? `<div style="padding:0 24px;color:var(--ct4);font-size:11.5px;margin-top:3px;position:relative;z-index:1">${esc(m.venue)}</div>` : ''}

      <!-- Scoreboard -->
      <div style="display:flex;align-items:center;justify-content:center;padding:28px 24px 16px;gap:40px;position:relative;z-index:1">
        <!-- Team 1 (right-aligned) -->
        <div style="display:flex;align-items:center;gap:18px;flex:1;justify-content:flex-end">
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:700;color:var(--ct)">${esc(m.team1_short)}</div>
            <div style="font-size:34px;font-weight:800;color:var(--ct);letter-spacing:-1px;line-height:1.1">${s1 ? esc(s1.display) : '—'}</div>
            <div style="font-size:12px;color:var(--ct3);margin-top:2px">${s1 ? esc(s1.detail) : 'Yet to bat'}</div>
          </div>
          ${teamBadge(m.team1_short, 72)}
        </div>
        <!-- VS circle -->
        <div style="width:40px;height:40px;border-radius:50%;background:var(--cvscirc);border:1px solid var(--cvsbd);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--ct3);flex-shrink:0">vs</div>
        <!-- Team 2 (left-aligned) -->
        <div style="display:flex;align-items:center;gap:18px;flex:1">
          ${teamBadge(m.team2_short, 72)}
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--ct)">${esc(m.team2_short)}</div>
            <div style="font-size:34px;font-weight:800;color:var(--ct);letter-spacing:-1px;line-height:1.1">${s2 ? esc(s2.display) : '—'}</div>
            <div style="font-size:12px;color:var(--ct3);margin-top:2px">${s2 ? esc(s2.detail) : 'Yet to bat'}</div>
          </div>
        </div>
      </div>

      <!-- Match situation -->
      ${m.status_text ? `<div style="text-align:center;padding:0 24px 12px;position:relative;z-index:1">
        <span style="color:#22c55e;font-size:13px;font-weight:600">${esc(m.status_text)}</span>
      </div>` : ''}

      <!-- Batting + Bowling panels -->
      ${panelsHtml}

      <!-- Win probability -->
      ${winProbHtml}

      <!-- Footer -->
      <div style="padding:14px 24px;border-top:1px solid var(--cdiv);display:flex;align-items:center;justify-content:flex-end;position:relative;z-index:1">
        <span style="font-size:12.5px;color:var(--ct3);font-weight:500">View full scorecard →</span>
      </div>
    </article>`;
}

// ── Crickly Live / Result Card (CompactMatchCard style) ───────

function matchCardTeamBadge(code, size = 44, faded = false) {
  const meta = teamMeta(code);
  const opacity = faded ? '0.3' : '0.6';
  return `<span class="mc-team-badge" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:800;color:${meta.color};opacity:${opacity};font-size:${Math.max(9, Math.round(size * .23))}px;border-radius:${Math.round(size * .15)}px">${esc(code || '—')}</span>`;
}

function matchCardFormDots(form = [], align = '') {
  const recent = (form || []).slice(-5);
  if (!recent.length) return '<span class="mc-muted">No form</span>';
  return `<div class="mc-form-dots ${align}">${recent.map(r => {
    const win = String(r).toUpperCase() === 'W';
    return `<span class="mc-form-dot ${win ? 'win' : 'loss'}">${esc(r)}</span>`;
  }).join('')}</div>`;
}

function matchCardQualColor(value) {
  const n = Number(value || 0);
  if (n >= 70) return '#22C55E';
  if (n >= 40) return '#FACC15';
  if (n >= 15) return '#F97316';
  return '#EF4444';
}

function matchCardQualRing(value, label) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = matchCardQualColor(pct);
  return `<div class="mc-qual-ring" title="${esc(label)} qualification probability">
    <svg width="42" height="42" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="18" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="3"></circle>
      <circle cx="21" cy="21" r="18" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    </svg>
    <span class="mc-ring-num" style="color:${color}">${Math.round(pct)}</span><span class="mc-ring-pct">%</span>
  </div>`;
}

function matchCardTeamInfo(m, side) {
  const code = side === 1 ? m.team1_short : m.team2_short;
  const row = standingForTeam(code) || {};
  return {
    code,
    rank: m[`team${side}_rank`] ?? row.rank ?? '—',
    points: m[`team${side}_points`] ?? row.points ?? '—',
    form: m[`team${side}_last_5`] || row.last_5 || [],
    qual: m[`team${side}_qualification_pct`] ?? row.qualification_pct ?? 0,
    nrr: Number(row.nrr || 0),
    color: teamMeta(code).color,
  };
}

function matchCardNrr(nrr) {
  const val = Number(nrr || 0);
  return `<span class="${val >= 0 ? 'pos' : 'neg'}">${val >= 0 ? '+' : ''}${val.toFixed(3)}</span>`;
}

function matchCardKeyPlayer(code) {
  const map = {
    RCB:['Virat Kohli','Batter'], MI:['Jasprit Bumrah','Bowler'], CSK:['Ruturaj Gaikwad','Captain · Batter'],
    LSG:['KL Rahul','Batter'], SRH:['Travis Head','Opener'], RR:['Sanju Samson','Captain'],
    KKR:['Sunil Narine','All-rounder'], DC:['Axar Patel','All-rounder'], GT:['Shubman Gill','Captain'], PBKS:['Arshdeep Singh','Bowler']
  };
  const [name, role] = map[code] || [code, 'Key player'];
  return { name, surname: name.split(/\s+/).pop(), role };
}


// ── Client-side live intelligence helpers ──────────────────
function liveOversToBalls(ov) {
  const o = Math.floor(ov);
  const b = Math.round((ov - o) * 10);
  return o * 6 + b;
}
function liveBallsRemaining(overs) {
  return 120 - liveOversToBalls(overs);
}
function liveProjection(score, overs, wickets, crr) {
  if (!score || !overs) return null;
  const ballsRem = liveBallsRemaining(overs);
  const remOvers = ballsRem / 6;
  let proj = score + (crr * remOvers);
  const wktPen = wickets * 0.4 * remOvers;
  proj -= wktPen;
  const oversDone = Number(overs);
  if (oversDone >= 16) proj *= 1.05;
  const r = Math.round(proj);
  return { projected_score: r, range_low: r - 7, range_high: r + 7, proj_target: r + 1 };
}
function liveWinProb(score, overs, wickets, crr, target, rrr, innings) {
  if (innings === 1) {
    const proj = score + crr * (liveBallsRemaining(overs) / 6);
    const delta = (proj - 175) / 35;
    let bp = 50 + delta * 20;
    bp = Math.max(10, Math.min(90, bp));
    return { batting_team: Math.round(bp), fielding_team: Math.round(100 - bp) };
  } else {
    if (rrr == null || crr == null) return { batting_team: 50, fielding_team: 50 };
    const rateDiff = rrr - crr;
    let bp = 50 - rateDiff * 10;
    bp -= wickets * 3;
    bp = Math.max(5, Math.min(95, bp));
    return { batting_team: Math.round(bp), fielding_team: Math.round(100 - bp) };
  }
}
function liveMomentum(last6) {
  if (!last6 || !last6.length) return null;
  const runVals = { '0':0,'1':1,'2':2,'3':3,'4':4,'6':6,'W':0,'Wd':1,'Nb':1 };
  const runs = last6.reduce(function(s,b) { return s + (runVals[b] || 0); }, 0);
  const wkts = last6.filter(function(b) { return b === 'W'; }).length;
  let v = Math.max(0, Math.min(100, (runs / 15) * 100 - wkts * 20));
  v = Math.round(v);
  let label = v >= 75 ? 'Dominant' : v >= 55 ? 'Building' : v >= 40 ? 'Neutral' : v >= 25 ? 'Under pressure' : 'Struggling';
  return { value: v, label: label, last_6_rpo: runs };
}
function livePressure(innings, overs, wickets, crr, rrr, target, score) {
  let base = 0;
  if (innings === 1) {
    base += wickets * 10;
    if (Number(overs) > 10 && crr < 8.0) base += 15;
    if (Number(overs) > 16) base += 10;
  } else {
    if (rrr != null && crr != null) base += Math.max(0, (rrr - crr) * 8);
    base += wickets * 8;
    const ballsLeft = (20 - Number(overs)) * 6;
    if (ballsLeft < 24 && (target - score) > 30) base += 20;
  }
  const v = Math.round(Math.min(100, Math.max(0, base)));
  let label = v >= 70 ? 'High pressure' : v >= 45 ? 'Medium' : v >= 20 ? 'Low' : 'Comfortable';
  return { value: v, label: label };
}
function liveBallCfg(ball) {
  if (ball === 'W') return { bg: '#EF4444', tx: '#fff', glow: 'rgba(239,68,68,0.6)' };
  if (ball === '6') return { bg: 'rgba(34,197,94,0.22)', tx: '#4ADE80', glow: 'rgba(34,197,94,0.4)' };
  if (ball === '4') return { bg: 'rgba(59,130,246,0.22)', tx: '#60A5FA', glow: 'rgba(59,130,246,0.4)' };
  if (ball === '0') return { bg: 'rgba(255,255,255,0.05)', tx: 'rgba(255,255,255,0.25)', glow: 'transparent' };
  return { bg: 'rgba(255,255,255,0.1)', tx: 'rgba(255,255,255,0.8)', glow: 'transparent' };
}
function liveSrColor(sr) {
  return sr > 150 ? '#4ADE80' : sr >= 130 ? '#FACC15' : '#F87171';
}
function liveEconColor(econ) {
  return econ < 7.5 ? '#4ADE80' : econ <= 9.5 ? '#FACC15' : '#F87171';
}

function liveCardCK(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const isLive = m.status === 'live';
  const isResult = m.status === 'finished';

  if (!isLive) return matchCardCK ? matchCardCK(m) : '';

  // ── Extract data from API response ──
  const meta   = m.live_meta   || {};
  const sb     = m.score_block || {};
  const proj   = m.projection_data || m.projected || {};
  const wp     = m.win_prob   || {};
  const part   = m.partnership || {};
  const bt     = m.ball_timeline || {};
  const fowArr = m.fow_display || [];

  // Determine batting team: if both scores exist, the one with overs < 20 is active
  const batScore1 = m.team1_score1;
  const batScore2 = m.team2_score1;
  const batCode = meta.batting_team || (
    batScore1 && batScore2
      ? (Number(batScore1.overs) >= 20 ? m.team2_short : m.team1_short)
      : (batScore1 ? m.team1_short : m.team2_short)
  );
  const bowlCode = meta.fielding_team || (batCode === m.team1_short ? m.team2_short : m.team1_short);
  const batT  = teamMeta(batCode);
  const bowlT = teamMeta(bowlCode);

  const score    = sb.score    || (m.team1_score1 ? Number(m.team1_score1.runs) : 0);
  const wickets  = sb.wickets  != null ? sb.wickets : (m.team1_score1 ? Number(m.team1_score1.wickets) : 0);
  const overs    = sb.overs    || 0;
  const crr      = sb.crr      || Number(m.run_rate) || 0;
  const rrr      = sb.rrr;
  const target   = sb.target;
  const ballsRem = sb.balls_remaining != null ? sb.balls_remaining : 120 - (Math.floor(overs) * 6 + Math.round((overs % 1) * 10));

  const innings  = meta.innings || 1;
  const displayScore = m.team1_score1 ? esc(m.team1_score1.display) : (m.team2_score1 ? esc(m.team2_score1.display) : '—');
  const displayOvers = m.team1_score1 ? esc(m.team1_score1.detail) : (m.team2_score1 ? esc(m.team2_score1.detail) : '');

  // Required runs (2nd innings only)
  const reqRuns  = target ? Math.max(0, target - score) : null;
  const reqBalls = ballsRem || null;

  // Batters
  const activeBatters    = (m.batters || []).filter(function(b) { return b.is_active; }).slice(0, 2);
  const dismissedBatters = (m.batters || []).filter(function(b) { return !b.is_active && b.runs != null; });

  // Bowlers
  const bowlersList  = m.bowlers || [];
  const currentBwlr  = bowlersList.filter(function(b) { return b.is_current; });
  const currentBowler = currentBwlr.length ? currentBwlr[0] : (bowlersList.length ? bowlersList[0] : null);
  const otherBowlers  = currentBowler ? bowlersList.filter(function(b) { return b.name !== currentBowler.name; }) : bowlersList;

  // Dot ball % - compute from bowler dots (best approximation without ball-by-ball)
  const totalLegalBalls = bowlersList.reduce(function(sum, b) { return sum + (b.overs ? Math.floor(Number(b.overs)) * 6 + Math.round((Number(b.overs) % 1) * 10) : 0); }, 0);
  const totalDots = bowlersList.reduce(function(sum, b) { return sum + (b.dots || 0); }, 0);
  const dotPct = totalLegalBalls > 0 ? Math.round(totalDots / totalLegalBalls * 100) : null;

  // Last wicket
  const lastWktArr = fowArr.length ? fowArr[fowArr.length - 1] : null;
  const lastWktText = bt.last_wicket_desc || (lastWktArr ? esc(lastWktArr.batter) + ' @ ' + lastWktArr.over + ' · ' + lastWktArr.runs + ' runs' : '');

  // Overs history from ball timeline
  const thisOver = bt.this_over || [];
  const lastOver = bt.last_over || [];

  // Phase scores - from scorecard phases if available
  const phases = m.phases || {};

  // Win prob
  const wpBat = wp.batting_team || 50;
  const wpBowl = wp.fielding_team || 50;
  const wpBatColor = wpBat >= 60 ? '#4ADE80' : wpBat >= 45 ? '#FACC15' : '#F87171';
  const wpBowlColor = wpBowl >= 60 ? '#4ADE80' : wpBowl >= 45 ? '#FACC15' : '#F87171';

  // Helpers
  function srCol(sr) { return sr > 150 ? '#4ADE80' : sr >= 120 ? '#FACC15' : '#F87171'; }
  function econCol(e) { return e < 7.5 ? '#4ADE80' : e <= 9.5 ? '#FACC15' : '#F87171'; }

  function ballDot(b) {
    var cfg = b === 'W' ? 'background:#ef4444;color:#fff'
      : b === '6' ? 'background:#a78bfa;color:#fff'
      : b === '4' ? 'background:#34d399;color:#fff'
      : b === '0' ? 'background:transparent;color:#6b7280;border:1px solid #374151'
      : 'background:#1f2937;color:#d1d5db';
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:10px;font-weight:700;' + cfg + '">' + esc(b) + '</span>';
  }

  // ── Render ──
  return '<div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;overflow:hidden;font-family:var(--font,sans-serif);color:#f9fafb" onclick=\'handleCardClick(' + JSON.stringify(m.id) + ', this)\' data-match=\'' + matchJson + '\'>'
    // ═══ HEADER ═══
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px 0">'
    + '<div style="display:flex;align-items:center;gap:6px">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;box-shadow:0 0 8px #ef4444"></span>'
    + '<span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:1px">LIVE</span>'
    + '<span style="color:#374151;margin:0 4px">·</span>'
    + '<span style="font-size:11px;color:#9ca3af">' + esc(meta.match_num || m.match_desc || m.series || '') + '</span>'
    + '</div>'
    + '<span style="font-size:10px;color:#6b7280">' + esc((meta.venue || m.venue || '').split(',')[0]) + '</span>'
    + '</div>'

    // ═══ SCORES ═══
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 14px 0">'
    // Batting team
    + '<div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:4px">'
    + teamBadge(batCode, 48)
    + '<div style="font-size:11px;font-weight:600;color:' + batT.color + '">' + esc(batCode) + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:4px">'
    + '<span style="font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums">' + score + '</span>'
    + '<span style="font-size:17px;color:#6b7280">/' + wickets + '</span>'
    + '</div>'
    + '<div><span data-live="overs" style="font-size:11px;color:#6b7280">' + overs + '</span><span style="font-size:11px;color:#6b7280"> ov</span></div>'
    + '</div>'
    // VS + Target
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 14px">'
    + '<span style="font-size:10px;color:#374151;font-weight:700">vs</span>'
    + '<div style="width:1px;height:30px;background:#1f2937"></div>'
    + (target ? '<div style="font-size:9px;color:#6b7280;text-align:center">Target<br><span style="font-size:15px;font-weight:800;color:#f9fafb">' + target + '</span></div>' : '<div style="font-size:9px;color:#6b7280;text-align:center">1st Innings</div>')
    + '</div>'
    // Fielding team — always show score (completed for 1st inns, current for 2nd)
    + '<div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
    + teamBadge(bowlCode, 48)
    + '<div style="font-size:11px;font-weight:600;color:' + bowlT.color + '">' + esc(bowlCode) + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:4px"><span data-live="opp-score" style="font-size:22px;font-weight:700;color:#6b7280">' + (innings === 2 && batScore1 ? (batScore1.runs || 0) : (batScore2 ? batScore2.runs || 0 : 0)) + '</span><span data-live="opp-wkts" style="font-size:13px;color:#6b7280">/' + (innings === 2 && batScore1 ? (batScore1.wickets || 0) : (batScore2 ? batScore2.wickets || 0 : 0)) + '</span></div>'
    + '<div data-live="opp-ov" style="font-size:10px;color:#6b7280">' + (innings === 2 && batScore1 ? esc(batScore1.detail || '') : (batScore2 ? esc(batScore2.detail || '') : '—')) + '</div>'
    + '<div style="font-size:11px;color:#6b7280">CRR <span data-live="crr">' + crr.toFixed(2) + '</span>' + (rrr ? ' · RRR <span data-live="rrr">' + rrr.toFixed(2) + '</span>' : '') + '</div>'
    + '<div style="display:none" data-live="need-wrap">Need <span data-live="need">0</span> in <span data-live="need-balls">0</span> balls</div>'
    + '</div>'
    + '</div>'

    // ═══ STATUS BAR ═══
    + (meta.toss ? '<div style="margin:10px 14px 0;padding:8px 12px;background:#0f172a;border-radius:8px;font-size:12px;color:#9ca3af;font-style:italic">' + esc(batCode) + (innings === 2 && target ? ' need <strong>' + reqRuns + ' runs</strong> in ' + reqBalls + ' balls' : '') + ' · ' + esc(meta.toss) + '</div>' : '')

    // ═══ CURRENT BATTERS ═══
    + (activeBatters.filter(function(x){return x.balls>0||x.runs>0;}).length ? '<div style="padding:14px 14px"><div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Current Batters</div>'
    + activeBatters.filter(function(x){return x.balls>0||x.runs>0;}).map(function(b) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1f2937">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + (b.is_striker ? '<span style="width:6px;height:6px;border-radius:50%;background:' + batT.color + '"></span>' : '<span style="width:6px"></span>')
        + '<span style="font-size:13px;font-weight:600;color:#f9fafb">' + esc(b.name) + '</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:12px">'
        + '<span style="font-size:14px;font-weight:700;color:#f9fafb">' + b.runs + '</span>'
        + '<span style="font-size:11px;color:#6b7280">' + b.balls + '</span>'
        + '<span style="font-size:11px;color:#6b7280">' + (b.fours || 0) + '/' + (b.sixes || 0) + '</span>'
        + '<span style="font-size:11px;font-weight:600;color:' + srCol(b.sr) + '">' + (b.sr || 0).toFixed(1) + '</span>'
        + '</div></div>';
    }).join('') + '</div>' : '')

    // ═══ CURRENT BOWLER ═══
    + (currentBowler ? '<div style="padding:0 14px 14px"><div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Current Bowler</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#0f172a;border-radius:8px">'
    + '<span style="font-size:13px;font-weight:600;color:#f9fafb">' + esc(currentBowler.name) + '</span>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<span style="font-size:12px;color:#6b7280">' + currentBowler.overs + '</span>'
    + '<span style="font-size:12px;color:#6b7280">' + currentBowler.runs + '</span>'
    + '<span style="font-size:12px;font-weight:700;color:' + (currentBowler.wickets > 0 ? '#4ADE80' : '#6b7280') + '">' + currentBowler.wickets + '</span>'
    + '<span style="font-size:12px;font-weight:600;color:' + econCol(currentBowler.econ || 0) + '">' + (currentBowler.econ || 0).toFixed(2) + '</span>'
    + (currentBowler.dots != null ? '<span style="font-size:12px;color:#6b7280">' + currentBowler.dots + ' dots</span>' : '')
    + '</div></div>'
    // This over
    + (thisOver.length ? '<div style="display:flex;gap:4px;margin-top:8px;align-items:center"><span style="font-size:9px;color:#6b7280">This over:</span>' + thisOver.map(ballDot).join('') + '</div>' : '')
    + '</div>' : '')

    // ═══ WIN PROBABILITY ═══
    + '<div style="padding:0 14px 14px">'
    + '<div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Win Probability</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
    + '<span data-live="wp-bat" style="font-size:13px;font-weight:700;color:' + wpBatColor + '">' + esc(batCode) + ' ' + wpBat + '%</span>'
    + '<div style="flex:1;height:6px;border-radius:3px;background:#1f2937;overflow:hidden;display:flex">'
    + '<div data-live="wp-bar" style="width:' + wpBat + '%;background:' + wpBatColor + ';border-radius:3px"></div>'
    + '</div>'
    + '<span data-live="wp-bowl" style="font-size:13px;font-weight:700;color:' + wpBowlColor + '">' + esc(bowlCode) + ' ' + wpBowl + '%</span>'
    + '</div>'
    + '</div>'

    // ═══ DOT BALL % ═══
    + (dotPct != null ? '<div style="padding:0 14px 14px;display:flex;align-items:center;justify-content:space-between">'
    + '<span style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase">Dot Ball %</span>'
    + '<span style="font-size:14px;font-weight:700;color:' + (dotPct >= 40 ? '#ef4444' : dotPct >= 30 ? '#f97316' : '#6b7280') + '">' + dotPct + '%</span>'
    + '</div>' : '')

    // ═══ PARTNERSHIP & LAST WICKET ═══
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 14px">'
    + (part.runs != null ? '<div style="padding:8px 10px;background:#0f172a;border-radius:8px"><div style="font-size:8px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Partnership</div><span style="font-size:14px;font-weight:700;color:#f9fafb">' + part.runs + '</span><span style="font-size:11px;color:#6b7280;margin-left:4px">(' + (part.balls || '—') + ' balls)</span></div>' : '')
    + (lastWktText ? '<div style="padding:8px 10px;background:#0f172a;border-radius:8px"><div style="font-size:8px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Last Wicket</div><span style="font-size:12px;color:#9ca3af">' + lastWktText + '</span></div>' : '')
    + '</div>'

    // ═══ PROJECTED SCORE ═══
    + (proj.projected_score ? '<div style="padding:0 14px 14px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#0f172a;border-radius:8px">'
    + '<span style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase">Projected Score</span>'
    + '<div style="text-align:right">'
    + '<span data-live="proj" style="font-size:18px;font-weight:800;color:#f9fafb">' + proj.projected_score + '</span>'
    + '<br><span style="font-size:10px;color:#6b7280">Range ' + (proj.range_low || '—') + '–' + (proj.range_high || '—') + '</span>'
    + '</div></div></div>' : '')

    // ═══ PHASE SCORES ═══
    + (phases.powerplay ? '<div style="padding:0 14px 14px"><div style="font-size:9px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Phase Scores</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    + ['powerplay','middle','death'].map(function(ph) {
      var p = phases[ph] || {};
      return '<div style="padding:8px;background:#0f172a;border-radius:6px;text-align:center"><div style="font-size:8px;font-weight:700;color:#6b7280;text-transform:uppercase">' + ph + '</div><div style="font-size:12px;font-weight:700;color:#f9fafb">' + (p.runs != null ? p.runs + '/' + (p.wickets || 0) : '—') + '</div><div style="font-size:9px;color:#6b7280">RPO ' + (p.rpo != null ? p.rpo.toFixed(2) : '—') + '</div></div>';
    }).join('') + '</div></div>' : '')

    // ═══ OVER HISTORY (mini bar chart) ═══
    + (false ? '' : '')  // Placeholder for over history — needs per-over data from API

    // ═══ SCORECARD TABS (bat/bowl) ═══
    + '<div style="border-top:1px solid #1f2937;padding:0 14px">'
    + '<div style="display:flex;gap:0;border-bottom:1px solid #1f2937">'
    + '<button onclick="event.stopPropagation();ckScTab(\'' + m.id + '\',\'bat\',this)" class="sctab_' + m.id + ' bat" style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;color:#f9fafb;padding:10px 14px 8px;border-bottom:2px solid #ef4444;font-family:inherit">Bat</button>'
    + '<button onclick="event.stopPropagation();ckScTab(\'' + m.id + '\',\'bowl\',this)" class="sctab_' + m.id + ' bowl" style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:#6b7280;padding:10px 14px 8px;border-bottom:2px solid transparent;font-family:inherit">Bowl</button>'
    + '</div>'
    + '<div id="scpanel_' + m.id + '_bat" class="scpanel_' + m.id + ' bat">'
    // Batting scorecard
    + '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="color:#6b7280;font-size:9px;text-transform:uppercase">'
    + '<th style="text-align:left;padding:8px 4px">Batter</th><th style="padding:8px 4px">R</th><th style="padding:8px 4px">B</th><th style="padding:8px 4px">4s</th><th style="padding:8px 4px">6s</th><th style="padding:8px 4px">SR</th>'
    + '</tr></thead><tbody>'
    + (m.batters || []).map(function(b) {
      return '<tr><td style="padding:6px 4px;color:' + (b.is_active ? '#f9fafb' : '#6b7280') + '">' + esc(b.name) + (b.is_striker ? ' <span style="color:' + batT.color + '">*</span>' : '') + (b.dismissal ? '<br><span style="font-size:9px;color:#6b7280">' + esc(b.dismissal) + '</span>' : '') + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#f9fafb;font-weight:700">' + b.runs + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + b.balls + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + (b.fours || 0) + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + (b.sixes || 0) + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:' + srCol(b.sr) + '">' + (b.sr || 0).toFixed(1) + '</td></tr>';
    }).join('') + '</tbody></table>'
    + '</div>'
    + '<div id="scpanel_' + m.id + '_bowl" class="scpanel_' + m.id + ' bowl" style="display:none">'
    // Bowling scorecard
    + '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="color:#6b7280;font-size:9px;text-transform:uppercase">'
    + '<th style="text-align:left;padding:8px 4px">Bowler</th><th style="padding:8px 4px">O</th><th style="padding:8px 4px">R</th><th style="padding:8px 4px">W</th><th style="padding:8px 4px">Econ</th><th style="padding:8px 4px">Dots</th>'
    + '</tr></thead><tbody>'
    + (m.bowlers || []).map(function(b) {
      return '<tr><td style="padding:6px 4px;color:' + (b.is_current ? '#f9fafb' : '#6b7280') + '">' + esc(b.name) + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + b.overs + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + b.runs + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:' + (b.wickets > 0 ? '#4ADE80' : '#6b7280') + ';font-weight:' + (b.wickets > 0 ? '700' : '400') + '">' + b.wickets + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:' + econCol(b.econ || 0) + '">' + (b.econ || 0).toFixed(2) + '</td>'
        + '<td style="padding:6px 4px;text-align:center;color:#6b7280">' + (b.dots || 0) + '</td></tr>';
    }).join('') + '</tbody></table>'
    + '</div>'
    + '</div>'
    + '<div style="padding:10px 14px;border-top:1px solid #1f2937;display:flex;align-items:center;justify-content:flex-end">'
    + '<span style="font-size:11px;color:#6b7280;font-weight:500">Full scorecard →</span>'
    + '</div>'
    + '</div>';
}



function updateLiveCard(m) {
  if (!m) return;
  var heroEl = document.getElementById("heroInner");
  var curId = heroEl ? heroEl.getAttribute("data-mid") : null;
  if (curId && String(m.id) !== curId) {
    if (heroEl) heroEl.innerHTML = liveCardCK(m);
    return;
  }
  var sb = m.score_block || {};
  var meta = m.live_meta || {};
  var el;
  if (el = document.querySelector('[data-live="score"]')) el.textContent = sb.score || (m.team1_score1 ? m.team1_score1.runs : (m.team2_score1 ? m.team2_score1.runs : 0));
  if (el = document.querySelector('[data-live="wickets"]')) el.textContent = '/' + (sb.wickets != null ? sb.wickets : (m.team1_score1 ? m.team1_score1.wickets : (m.team2_score1 ? m.team2_score1.wickets : 0)));
  if (el = document.querySelector('[data-live="overs"]')) el.textContent = sb.overs || (m.team1_score1 ? m.team1_score1.overs : (m.team2_score1 ? m.team2_score1.overs : 0));
  if (el = document.querySelector('[data-live="crr"]')) el.textContent = (sb.crr || Number(m.run_rate) || 0).toFixed(2);
  if (el = document.querySelector('[data-live="rrr"]')) {
    var rrrVal = sb.rrr;
    if (rrrVal != null) { el.textContent = rrrVal.toFixed(2); el.parentNode ? (el.parentNode.style.display = '') : null; }
  }
  // Update opponent score
  if (el = document.querySelector('[data-live="opp-score"]')) {
    var inns = meta.innings || 1;
    var s1 = m.team1_score1, s2 = m.team2_score1;
    if (inns === 2 && s1) el.textContent = s1.runs || 0;
    else if (s2) el.textContent = s2.runs || 0;
    else el.textContent = 0;
  }
  if (el = document.querySelector('[data-live="opp-wkts"]')) {
    var inns2 = meta.innings || 1;
    var s1b = m.team1_score1, s2b = m.team2_score1;
    if (inns2 === 2 && s1b) el.textContent = '/' + (s1b.wickets || 0);
    else if (s2b) el.textContent = '/' + (s2b.wickets || 0);
  }
  if (el = document.querySelector('[data-live="opp-ov"]')) {
    var inns3 = meta.innings || 1;
    var s1c = m.team1_score1, s2c = m.team2_score1;
    if (inns3 === 2 && s1c) el.textContent = s1c.detail || '';
    else if (s2c) el.textContent = s2c.detail || '';
  }
  // Win prob
  if (el = document.querySelector('[data-live="wp-bar"]')) {
    var wp = m.win_prob || {};
    el.style.width = (wp.batting_team || 50) + '%';
  }
  if (el = document.querySelector('[data-live="wp-bat"]')) {
    var wp2 = m.win_prob || {};
    el.textContent = (meta.batting_team || '') + ' ' + (wp2.batting_team || 0) + '%';
  }
  if (el = document.querySelector('[data-live="wp-bowl"]')) {
    var wp3 = m.win_prob || {};
    el.textContent = (meta.fielding_team || '') + ' ' + (wp3.fielding_team || 0) + '%';
  }
  // Need runs
  if (el = document.querySelector('[data-live="need-wrap"]')) {
    var tgt = sb.target;
    var sc = sb.score || 0;
    if (tgt) {
      el.style.display = '';
      var needEl = document.querySelector('[data-live="need"]');
      var ballEl = document.querySelector('[data-live="need-balls"]');
      if (needEl) needEl.textContent = Math.max(0, tgt - sc);
      if (ballEl) ballEl.textContent = sb.balls_remaining || 0;
    } else {
      el.style.display = 'none';
    }
  }
}
function ckScTab(matchId, tab, btn) {
  // Hide all panels for this match
  document.querySelectorAll('.scpanel_' + matchId).forEach(function(el) {
    el.style.display = 'none';
  });
  // Show target panel
  var panel = document.getElementById('scpanel_' + matchId + '_' + tab);
  if (panel) panel.style.display = '';
  // Update tab styles
  document.querySelectorAll('.sctab_' + matchId).forEach(function(el) {
    el.style.fontWeight = '500';
    el.style.color = '#6b7280';
    el.style.borderBottomColor = 'transparent';
  });
  btn.style.fontWeight = '700';
  btn.style.color = '#f9fafb';
  btn.style.borderBottomColor = '#ef4444';
}


function matchCardCK(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const isResult = m.status === 'finished';
  let t1Winner = false, t2Winner = false;
  if (isResult && m.status_text) {
    const st = m.status_text.toLowerCase();
    if ([m.team1, m.team1_short].filter(Boolean).some(function(s) { return st.startsWith(s.toLowerCase()); })) t1Winner = true;
    else if ([m.team2, m.team2_short].filter(Boolean).some(function(s) { return st.startsWith(s.toLowerCase()); })) t2Winner = true;
  }
  const matchLabel = esc(m.match_desc || m.series || '');
  const statusText = esc(m.status_text || '');
  const stakes = matchStakes(m);
  const resultImpact = tableImpactLine(m, t1Winner, t2Winner);
  const metaChips = (resultMarginBadge(m) || '') + (stakes.impact ? '<span class="match-intel-chip ' + stakes.tone + '">Table impact</span>' : '');

  return '<article style="background:var(--cbg);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--cbd);border-radius:16px;overflow:hidden;cursor:pointer;transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s" onmouseenter="this.style.borderColor=\'var(--cbd-h)\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px ' + t1.color + '15\'" onmouseleave="this.style.borderColor=\'var(--cbd)\';this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\'" onclick=\'handleCardClick(' + JSON.stringify(m.id) + ', this)\' data-match=\'' + matchJson + '\'>'
    + '<div style="height:2px;background:linear-gradient(90deg,' + t1.color + '88,' + t2.color + '88)"></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 0;gap:10px"><span style="font-size:11.5px;color:var(--ct3);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + matchLabel + '</span><span style="background:var(--cbadge);color:var(--ct3);font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase">RESULT</span></div>'
    + (metaChips ? '<div class="match-intel-row">' + metaChips + '</div>' : '')
    + '<div style="display:flex;align-items:center;justify-content:center;padding:14px 18px 10px;gap:10px">'
    + teamBadge(m.team1_short, 52)
    + '<div style="text-align:center;flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--ct2)">' + esc(m.team1_short) + (t1Winner ? ' <span style="color:#22c55e;font-size:10px">\u2713</span>' : '') + '</div>' + teamMiniIntel(m.team1_short) + '<div style="font-size:22px;font-weight:800;color:var(--ct);letter-spacing:-0.5px">' + (m.team1_score1 ? esc(m.team1_score1.display) : '—') + '</div><div style="font-size:10.5px;color:var(--ct4)">' + (m.team1_score1 ? esc(m.team1_score1.detail) : 'Yet to bat') + '</div></div>'
    + '<span style="font-size:10px;color:var(--ct5);font-weight:600;flex-shrink:0">vs</span>'
    + '<div style="text-align:center;flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--ct2)">' + esc(m.team2_short) + (t2Winner ? ' <span style="color:#22c55e;font-size:10px">\u2713</span>' : '') + '</div>' + teamMiniIntel(m.team2_short) + '<div style="font-size:22px;font-weight:800;color:var(--ct);letter-spacing:-0.5px">' + (m.team2_score1 ? esc(m.team2_score1.display) : '—') + '</div><div style="font-size:10.5px;color:var(--ct4)">' + (m.team2_score1 ? esc(m.team2_score1.detail) : 'Yet to bat') + '</div></div>'
    + teamBadge(m.team2_short, 52)
    + '</div>'
    + '<div style="text-align:center;padding:10px 14px 12px;background:rgba(255,255,255,0.015);margin:0 14px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5)">' + statusText + '</div>' + (resultImpact ? resultImpact.replace('match-impact-line','match-impact-line in-result') : '') + (!resultImpact && stakes.impact ? '<div class="match-impact-line in-result">📊 ' + esc(stakes.impact) + '</div>' : '') + '</div>'
    + '</article>';
}



function upcomingRowCK(m) {
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const t1 = matchCardTeamInfo(m, 1);
  const t2 = matchCardTeamInfo(m, 2);
  const stakes = matchStakes(m);
  let timeDisplay = m.start_time || 'TBD';
  let dateDisplay = '';
  if (m.start_epoch) {
    const d = new Date(m.start_epoch);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) dateDisplay = 'Today';
    else if (d.toDateString() === tomorrow.toDateString()) dateDisplay = 'Tomorrow';
    else dateDisplay = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const venue = m.venue ? m.venue.split(',')[0] : '';
  const h2h1 = Number(m.t1_h2h_wins || 0), h2h2 = Number(m.t2_h2h_wins || 0);
  const h2hTotal = h2h1 + h2h2;
  const h2hPct = h2hTotal ? Math.round(h2h1 / h2hTotal * 100) : 50;
  const mustWin = [t1, t2].filter(team => Number(team.qual) < 15 || stakes.tone === 'danger' && (Number(team.qual) < 40));
  const kp1 = matchCardKeyPlayer(t1.code), kp2 = matchCardKeyPlayer(t2.code);
  const note = m.toss_note || m.weather_note || (dateDisplay === 'Today' ? 'Dew factor possible — chasing may matter' : '');

  return `
    <article class="match-preview-card" style="--t1:${t1.color};--t2:${t2.color}" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="match-preview-stripe"></div>
      <div class="match-preview-inner">
        <div class="mp-row mp-meta"><div class="mp-meta-left"><span>${esc(m.match_desc || 'Fixture')}</span>${venue ? `<i></i><span class="mp-venue">${esc(venue)}</span>` : ''}</div><div class="mp-time"><b>${esc(timeDisplay)}</b>${dateDisplay ? `<span class="${dateDisplay === 'Today' ? 'today' : ''}">${esc(dateDisplay)}</span>` : ''}</div></div>
        <div class="mp-teams-row">
          <div class="mp-team">${matchCardTeamBadge(t1.code, 44)}<div><b>${esc(t1.code)}</b><span>#${esc(String(t1.rank))} · ${esc(String(t1.points))}pts</span></div></div>
          <div class="mp-vs"><b>VS</b>${h2hTotal ? `<span>${h2h1}-${h2h2}</span>` : '<span>H2H</span>'}</div>
          <div class="mp-team right"><div><b>${esc(t2.code)}</b><span>#${esc(String(t2.rank))} · ${esc(String(t2.points))}pts</span></div>${matchCardTeamBadge(t2.code, 44)}</div>
        </div>
        <div class="mp-form-row"><div class="mp-form-side"><span>FORM</span>${matchCardFormDots(t1.form)}</div><div class="mp-rings">${matchCardQualRing(t1.qual, t1.code)}<i></i>${matchCardQualRing(t2.qual, t2.code)}</div><div class="mp-form-side right"><span>FORM</span>${matchCardFormDots(t2.form, 'right')}</div></div>
        ${mustWin.length || note ? `<div class="mp-tags">${mustWin.map(team => `<span class="mp-team-pill" style="color:${team.color};border-color:${team.color}33;background:${team.color}12">${esc(team.code)}</span><span class="mp-must-win">MUST-WIN</span>`).join('')}${note ? `<em>💧 ${esc(note)}</em>` : ''}</div>` : ''}
        ${(stakes.headline || stakes.impact) ? `<div class="mp-significance"><span>★</span><em>${esc(stakes.headline || stakes.impact)}</em></div>` : ''}
      </div>
      <details class="mp-expand" onclick="event.stopPropagation()"><summary>Match preview <span>⌄</span></summary><div class="mp-expanded">
        <div class="mp-h2h"><div><b style="color:${t1.color}">${h2h1}</b><span>Head to Head</span><b style="color:${t2.color}">${h2h2}</b></div><div class="mp-h2h-track" style="background:${t2.color}25"><i style="width:${h2hPct}%;background:${t1.color}"></i></div></div>
        <div class="mp-key-grid"><div class="mp-key" style="border-left-color:${t1.color}"><span>Key Player</span><b>${esc(kp1.surname)}</b><em style="color:${t1.color}">${esc(kp1.role)}</em></div><div class="mp-key" style="border-left-color:${t2.color}"><span>Key Player</span><b>${esc(kp2.surname)}</b><em style="color:${t2.color}">${esc(kp2.role)}</em></div></div>
        <div class="mp-nrr-weather"><span>${esc(t1.code)} NRR ${matchCardNrr(t1.nrr)}</span><span>${esc(t2.code)} NRR ${matchCardNrr(t2.nrr)}</span><em>☀️ 32°C · ${dateDisplay === 'Today' ? 'Dew expected' : 'Low risk'}</em></div>
      </div></details>
    </article>`;
}

// ── Generate date tabs ─────────────────────────────────────────
function generateDateTabs() {
  const container = $('dateTabs');
  if (!container) return;
  const today = new Date();
  const tabs = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = i === 0
      ? 'Today'
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const val = i === 0 ? 'today' : `d${i}`;
    tabs.push({ label, val, epoch: d.getTime() });
  }
  container.innerHTML = tabs.map((t, i) => `
    <button class="ck-date-tab${i === 0 ? ' is-active' : ''}" data-date="${t.val}" onclick="selectDateTab(this, ${t.epoch})">${esc(t.label)}</button>
  `).join('');
}

function selectDateTab(el, epoch) {
  document.querySelectorAll('.ck-date-tab').forEach(b => b.classList.remove('is-active'));
  el.classList.add('is-active');
  // If "Today" tab — reset to normal all view
  if (el.dataset.date === 'today') {
    setFilter('all');
    return;
  }
  // Otherwise filter upcoming by date
  if (!lastData) return;
  const dayStart = new Date(epoch); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(epoch); dayEnd.setHours(23,59,59,999);
  const filtered = (lastData.upcoming || []).filter(m => {
    if (!m.start_epoch) return false;
    const d = new Date(m.start_epoch);
    return d >= dayStart && d <= dayEnd;
  });
  $('upcomingGrid').innerHTML = filtered.map(upcomingRowCK).join('');
  $('upcomingSection').style.display = filtered.length ? '' : 'none';
  $('heroSection').style.display     = 'none';
  $('liveSection').style.display     = 'none';
  $('resultsSection').style.display  = 'none';
  if (!filtered.length) $('emptySection').style.display = '';
  else $('emptySection').style.display = 'none';
}

// ── Coming soon toast ─────────────────────────────────────────
function showComingSoon(name) {
  // Remove any existing toast
  const old = document.querySelector('.ck-toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'ck-toast';
  toast.innerHTML = `<span>🚧 ${esc(name || 'This section')} coming soon!</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('ck-toast--show'));
  setTimeout(() => {
    toast.classList.remove('ck-toast--show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
  closeSidebar();
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
    <article class="hero-card" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="card-stripe" style="background:var(--live)"></div>
      <header class="hero-top">
        <div class="hero-meta">
          ${badge('live')}
          <span class="meta-dot"></span>
          <span class="hero-series-label">${esc(m.series)}</span>
          ${m.match_desc ? `<span class="meta-dot"></span><span class="hero-match-desc">${esc(m.match_desc)}</span>` : ''}
          ${m.venue ? `<span class="meta-dot"></span><span class="hero-match-desc">${esc(m.venue)}</span>` : ''}
        </div>
        <div class="hero-meta">
          ${m.run_rate ? `<span class="chip">CRR ${esc(String(m.run_rate))}</span>` : ''}
        </div>
      </header>

      <div class="hero-matchup">
        <div class="hero-team">
          <div class="hero-avatar" style="border-color:${t1.color}55;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
          <div class="hero-team-meta">
            <span class="hero-team-name">${esc(m.team1)}</span>
            <span class="team-overs mono-xs muted-2">${m.team1_score1?.detail ? esc(m.team1_score1.detail) : 'Yet to bat'}</span>
          </div>
          <div class="hero-score">${heroScoreInner(m.team1_score1)}</div>
        </div>

        <div class="hero-vs-col">
          <span class="hero-vs-text">VS</span>
        </div>

        <div class="hero-team hero-team--right">
          <div class="hero-score">${heroScoreInner(m.team2_score1)}</div>
          <div class="hero-team-meta is-right">
            <span class="hero-team-name">${esc(m.team2)}</span>
            <span class="team-overs mono-xs muted-2">${m.team2_score1?.detail ? esc(m.team2_score1.detail) : 'Yet to bat'}</span>
          </div>
          <div class="hero-avatar" style="border-color:${t2.color}55;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
        </div>
      </div>

      <footer class="hero-bottom">
        <span class="hero-status">${esc(m.status_text)}</span>
        <span class="hero-cta">View scorecard →</span>
      </footer>
    </article>`;
}

// ── Hero card v2 (Crickly-style with players + win prob) ────────
function playerInitials(name) {
  return String(name || '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function _overs2balls(overs) {
  const s = String(overs || '0');
  const [w, f] = s.split('.');
  return parseInt(w || 0) * 6 + parseInt((f || '0')[0] || 0);
}

function heroCardV2(m, sc = null) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));

  // ── Extract top batsmen + bowlers from scorecard ──────────
  let batHtml = '', bowlHtml = '', winProbHtml = '';

  if (sc && sc.innings && sc.innings.length > 0) {
    const curInn = sc.innings[sc.innings.length - 1];
    const batsmen = (curInn.batsmen || []).filter(b => (b.balls || 0) > 0)
      .sort((a, b) => (b.runs || 0) - (a.runs || 0)).slice(0, 2);
    const bowlers = (curInn.bowlers || [])
      .sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.economy || 99) - (b.economy || 99))
      .slice(0, 2);

    if (batsmen.length) {
      batHtml = batsmen.map(b => `
        <div class="hero2-player">
          <div class="hero2-player-avatar">${esc(playerInitials(b.name))}</div>
          <div class="hero2-player-info">
            <div class="hero2-player-name">${esc(b.name)}</div>
            <div class="hero2-player-stat">${b.runs} <span style="font-weight:400;color:var(--text-3)">(${b.balls})</span></div>
          </div>
        </div>`).join('');
    }
    if (bowlers.length) {
      bowlHtml = bowlers.map(bw => `
        <div class="hero2-player">
          <div class="hero2-player-avatar">${esc(playerInitials(bw.name))}</div>
          <div class="hero2-player-info">
            <div class="hero2-player-name">${esc(bw.name)}</div>
            <div class="hero2-player-stat">${bw.wickets}/${bw.runs} <span style="font-weight:400;color:var(--text-3)">(${bw.overs})</span></div>
          </div>
        </div>`).join('');
    }

    // Win probability from run rates
    if (sc.innings.length >= 2) {
      const inn1 = sc.innings[0];
      const inn2 = sc.innings[sc.innings.length - 1];
      const target   = (inn1.score?.runs || 0) + 1;
      const chased   = inn2.score?.runs || 0;
      const ballsDone = _overs2balls(inn2.score?.overs || 0);
      const ballsLeft = 120 - ballsDone;
      const needed   = target - chased;
      if (ballsLeft > 0 && needed > 0) {
        const crr = ballsDone > 0 ? chased * 6 / ballsDone : 0;
        const rrr = ballsLeft > 0 ? needed * 6 / ballsLeft : 99;
        let p2 = Math.round(50 + (crr - rrr) * 4);
        p2 = Math.min(95, Math.max(5, p2));
        const p1 = 100 - p2;
        const t1short = esc(m.team1_short), t2short = esc(m.team2_short);
        winProbHtml = `
          <div class="hero2-winprob">
            <div class="hero2-winprob-head">
              <span class="hero2-winprob-label">Live Win Probability</span>
            </div>
            <div class="hero2-winprob-teams">
              <span>${t1short} ${p1}%</span>
              <span>${t2short} ${p2}%</span>
            </div>
            <div class="hero2-winprob-bar">
              <div class="hero2-winprob-fill1" style="width:${p1}%"></div>
              <div class="hero2-winprob-fill2"></div>
            </div>
          </div>`;
      }
    }
  }

  const playersSection = (batHtml || bowlHtml) ? `
    <div class="hero2-players">
      <div class="hero2-players-col">
        <div class="hero2-players-label">Top Batsmen</div>
        ${batHtml || '<span style="font-size:11px;color:var(--text-3)">Loading…</span>'}
      </div>
      <div class="hero2-divider"></div>
      <div class="hero2-players-col">
        <div class="hero2-players-label">Top Bowlers</div>
        ${bowlHtml || '<span style="font-size:11px;color:var(--text-3)">Loading…</span>'}
      </div>
    </div>` : '';

  const s1 = m.team1_score1;
  const s2 = m.team2_score1;

  return `
    <article class="hero-card-v2" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="hero2-head">
        <div class="hero2-head-left">
          ${badge('live')}
          <span class="hero2-series">${esc(m.series)}${m.match_desc ? ' · ' + esc(m.match_desc) : ''}${m.venue ? ' · ' + esc(m.venue) : ''}</span>
        </div>
        ${m.run_rate ? `<span class="hero2-crr">CRR ${esc(String(m.run_rate))}</span>` : ''}
      </div>

      <div class="hero2-scores">
        <div class="hero2-team-col">
          <div class="hero2-avatar" style="border-color:${t1.color}55;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
          <div class="hero2-team-info">
            <span class="hero2-team-name">${esc(m.team1)}</span>
            <span class="hero2-overs">${s1?.detail || 'Yet to bat'}</span>
          </div>
          <div class="hero2-score" style="color:${t1.color}">
            ${s1 ? esc(s1.display) : '<span class="hero2-ytb">-</span>'}
          </div>
        </div>

        <div class="hero2-vs-col">
          <span class="hero2-vs-text">VS</span>
        </div>

        <div class="hero2-team-col hero2-team-col--right">
          <div class="hero2-score" style="color:${t2.color}">
            ${s2 ? esc(s2.display) : '<span class="hero2-ytb">-</span>'}
          </div>
          <div class="hero2-team-info" style="text-align:right">
            <span class="hero2-team-name">${esc(m.team2)}</span>
            <span class="hero2-overs">${s2?.detail || 'Yet to bat'}</span>
          </div>
          <div class="hero2-avatar" style="border-color:${t2.color}55;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
        </div>
      </div>

      ${m.status_text ? `<div class="hero2-status">${esc(m.status_text)}</div>` : ''}

      ${playersSection}
      ${winProbHtml}

      <div class="hero2-footer">
        <span class="hero2-footer-cta">View full scorecard →</span>
      </div>
    </article>`;
}

// ── Upcoming list item (Crickly-style clean rows) ──────────────
function upcomingListItem(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));

  // Format start time + date
  let timeDisplay = m.start_time || 'TBD';
  let dateDisplay = '';
  if (m.start_epoch) {
    const d = new Date(m.start_epoch);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) dateDisplay = 'Today';
    else if (isTomorrow) dateDisplay = 'Tomorrow';
    else dateDisplay = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return `
    <div class="upcoming-item" onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="upcoming-match-info">
        <div class="upcoming-teams-row">
          <div class="upcoming-team-chip">
            <div class="team-badge" style="border-color:${t1.color}44;color:${t1.color};background:${t1.bg}">${esc(m.team1_short)}</div>
            <span class="upcoming-team-name">${esc(m.team1)}</span>
          </div>
          <span class="upcoming-vs">vs</span>
          <div class="upcoming-team-chip">
            <div class="team-badge" style="border-color:${t2.color}44;color:${t2.color};background:${t2.bg}">${esc(m.team2_short)}</div>
            <span class="upcoming-team-name">${esc(m.team2)}</span>
          </div>
        </div>
        <span class="upcoming-desc">${esc(m.match_desc || m.series)}</span>
        ${m.venue ? `<span class="upcoming-venue">📍 ${esc(m.venue)}</span>` : ''}
      </div>
      <div class="upcoming-time-col">
        <span class="upcoming-time">${esc(timeDisplay)}</span>
        ${dateDisplay ? `<span class="upcoming-date">${esc(dateDisplay)}</span>` : ''}
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
let archiveFilters = { year: 'All', team: 'All', round: 'All', search: '' };
let archiveViewMode = 'matches';
let pointsLoaded = false;
let pointsData = null;
let pointsIntelLoading = false;
let pointsSeason = '2026';
let pointsViewMode = 'compact';
let pointsExpandedRow = null;
let pointsDetailTabs = {};
let teamsSortMode = 'rank';
let teamsExpanded = {};

let pulseStatsData = null;
let pulseStatsLoaded = false;
let pulseArchiveData = null;
let pulseArchiveLoaded = false;
let pulseHeavyLoadQueued = false;

// ── Broadcast-quality tournament pulse analysis ──────────────
function tournamentPulseData() {
  const ptsRows = pointsRowsForSeason();
  const sourceNote = pointsData?.tables?.[pointsSeason]?.source_note || '';
  const matchPos = sourceNote.match(/Match (\d+)\s+of\s+(\d+)/i);
  const doneMatches = matchPos ? Number(matchPos[1]) : ptsRows.length ? ptsRows[0].played : 0;
  const totalMatches = matchPos ? Number(matchPos[2]) : 74;
  const remainMatches = totalMatches - doneMatches;
  const progressPct = totalMatches > 0 ? Math.round(doneMatches / totalMatches * 100) : 0;

  // ── Playoff bubble analysis ──
  const sortedPts = [...ptsRows].sort((a,b) => (b.points||0)-(a.points||0) || (b.nrr||0)-(a.nrr||0));
  const alive = sortedPts.filter(r => (r.qualification_pct||0) > 5);
  const top6 = sortedPts.filter(r => (r.rank||99) <= 6);
  const spread = top6.length >= 2 ? top6[0].points - top6[Math.min(top6.length-1,5)].points : 0;
  const bubble = sortedPts.filter(r => r.rank >= 4 && r.rank <= 7);
  const nrrDecider = bubble.length >= 2 ? Math.max(...bubble.map(r=>Math.abs(r.nrr||0))) > 0.1 : false;
  const tieRisk = bubble.length >= 3 ? bubble.filter(r => Math.abs(r.points - bubble[1].points) <= 2).length >= 3 : false;

  // ── NRR Pressure Points ──
  const nrrSwing = sortedPts.filter(r => Math.abs(r.trend||0) >= 1).slice(0, 2);
  // Teams on same points separated by NRR
  let nrrWatch = [];
  for (let i = 0; i < sortedPts.length - 1; i++) {
    if (sortedPts[i].points === sortedPts[i+1].points) {
      nrrWatch.push({ t1: sortedPts[i], t2: sortedPts[i+1] });
      if (nrrWatch.length >= 2) break;
    }
  }

  // ── Hot streak ──
  let bestStreak = { team: '', streak: 0, last5: [] };
  for (const r of sortedPts) {
    let streak = 0;
    for (let k = r.last_5.length-1; k >= 0; k--) {
      if (r.last_5[k] === 'W') streak++; else break;
    }
    if (streak > bestStreak.streak) bestStreak = { team: r.team_short, streak, last5: r.last_5 };
  }
  // Best NRR team
  const nrrLeader = sortedPts.length ? sortedPts[0] : null;

  // ── Stats from stats builder ──
  let topBat = {}, topBowl = {}, sixHitter = {}, mvpLeader = {};
  let highestTotal = { team: '', runs: 0, wkts: 0 };
  if (pulseStatsData) {
    const bat2026 = (pulseStatsData.batting||[]).filter(r => r.y === 2026);
    const bowl2026 = (pulseStatsData.bowling||[]).filter(r => r.y === 2026);
    const batMap = new Map(), bowlMap = new Map(), sixMap = new Map();
    for (const r of bat2026) {
      const k = r.p;
      if (!batMap.has(k)) batMap.set(k, {player:k, team:r.t, runs:0, balls:0, sixes:0, matches:new Set()});
      const row = batMap.get(k);
      row.runs += r.ru||0; row.balls += r.b||0; row.sixes += r.si||0; row.matches.add(r.m);
    }
    for (const r of bowl2026) {
      const k = r.p;
      if (!bowlMap.has(k)) bowlMap.set(k, {player:k, team:r.t, wkts:0, runs:0, balls:0, econ:0, matches:new Set()});
      const row = bowlMap.get(k);
      row.wkts += r.w||0; row.runs += r.ru||0; row.balls += r.b||0; row.matches.add(r.m);
    }
    for (const r of bat2026) {
      const k = r.p;
      if (!sixMap.has(k)) sixMap.set(k, {player:k, sixes:0});
      sixMap.get(k).sixes += r.si||0;
    }
    // De-duplicate names properly
    const dedupe = (map, valKey) => {
      const seen = new Set();
      return Array.from(map.values()).filter(r => { const k=r.player; if(seen.has(k))return false; seen.add(k); return true; })
        .sort((a,b) => (b[valKey]||0) - (a[valKey]||0));
    };
    const batList = dedupe(batMap, 'runs');
    const bowlList = dedupe(bowlMap, 'wkts');
    const sixList = dedupe(sixMap, 'sixes');
    topBat = batList[0] || {};
    topBowl = bowlList[0] || {};
    sixHitter = sixList[0] || {};
    
    // MVP: runs + wkts*20
    const mvpMap = new Map();
    for (const r of bat2026) {
      const k = r.p;
      if (!mvpMap.has(k)) mvpMap.set(k, {player:k, runs:0, wkts:0, sixes:0});
      mvpMap.get(k).runs += r.ru||0;
      mvpMap.get(k).sixes += r.si||0;
    }
    for (const r of bowl2026) {
      const k = r.p;
      if (!mvpMap.has(k)) mvpMap.set(k, {player:k, runs:0, wkts:0, sixes:0});
      mvpMap.get(k).wkts += r.w||0;
    }
    const mvpList = Array.from(mvpMap.values())
      .filter(r => { const s=new Set(); const k=r.player; if(s.has(k))return false; s.add(k); return true; })
    mvpList.forEach(r => r.score = r.runs + r.wkts*20 + r.sixes*3);
    mvpList.sort((a,b) => b.score - a.score);
    mvpLeader = mvpList[0] || {};
  }

  // ── Archive-sourced entertainment data ──
  let chaseRate = { won: 0, total: 0 };
  let highestInn = { team: '', runs: 0, wkts: 0, overs: '' };
  let closestFinish = { margin: 999, detail: '' };
  if (pulseArchiveData) {
    const m26 = (pulseArchiveData.matches||[]).filter(m => m.season === 2026);
    let chases = 0, chasesWon = 0;
    for (const m of m26) {
      const inns = m.innings || [];
      if (inns.length >= 2) {
        const winner = m.winner || '';
        const winnerShort = inns.find(i => i.team === winner)?.team_short || inns.find(i => winner && winner.includes(i.team||''))?.team_short || '';
        if (winnerShort === inns[1].team_short) chasesWon++;
        chases++;
      }
      for (const inn of inns) {
        const r = inn.runs || 0;
        if (r > highestInn.runs) highestInn = { team: inn.team_short, runs: r, wkts: inn.wickets||0, overs: inn.overs||'' };
      }
      const txt = m.result_text || '';
      const rm = txt.match(/(\d+)\s+runs?/);
      if (rm) {
        const margin = parseInt(rm[1]);
        if (margin < closestFinish.margin) closestFinish = { margin, detail: txt, winner: m.winner };
      }
    }
    chaseRate = { won: chasesWon, total: chases };
  }

  return {
    doneMatches, totalMatches, remainMatches, progressPct,
    alive: alive.length, playoff: { spread, nrrDecider, tieRisk },
    bubble: bubble.length, nrrWatch: nrrWatch.slice(0,2), nrrSwing,
    bestStreak, nrrLeader,
    topBat, topBowl, sixHitter, mvpLeader,
    chaseRate, highestInn, closestFinish,
  };
}

function renderTournamentPulse() {
  const pulseEl = $('pulseGrid');
  if (!pulseEl) return;

  const pt = tournamentPulseData();

  pulseEl.innerHTML = `
    <div class="pulse-dashboard">
      <div class="pulse-section">
        <span class="pulse-section-label">◈ Tournament State</span>
        <div class="pulse-cards">
          ${matchesDoneCard(pt)}
          ${playoffCard(pt)}
        </div>
      </div>
      <div class="pulse-section">
        <span class="pulse-section-label">◈ Momentum</span>
        <div class="pulse-cards">
          ${momentumCard(pt)}
          ${nrrPressureCard(pt)}
        </div>
      </div>
      <div class="pulse-section">
        <span class="pulse-section-label">◈ Race Leaders</span>
        <div class="pulse-cards">
          ${orangeCapCard(pt)}
          ${purpleCapCard(pt)}
        </div>
      </div>
      <div class="pulse-section">
        <span class="pulse-section-label">◈ Entertainment</span>
        <div class="pulse-cards">
          ${chaseCard(pt)}
          ${totalCard(pt)}
        </div>
      </div>
    </div>`;
}

function loadTournamentPulseHeavyData() {
  if (!pulseStatsLoaded) {
    pulseStatsLoaded = true;
    fetchJson(STATS_BUILDER_PATH)
      .then(r => { if (r.ok) return r.json(); })
      .then(d => { pulseStatsData = d; renderTournamentPulse(); })
      .catch(() => {});
  }
  if (!pulseArchiveLoaded) {
    pulseArchiveLoaded = true;
    fetchJson(getArchiveUrl())
      .then(r => { if (r.ok) return r.json(); })
      .then(d => { pulseArchiveData = d; renderTournamentPulse(); })
      .catch(() => {});
  }
}

function queueTournamentPulseHeavyLoad() {
  if (pulseHeavyLoadQueued || (pulseStatsLoaded && pulseArchiveLoaded)) return;
  const section = $('tournamentPulse');
  if (!section) return;
  pulseHeavyLoadQueued = true;

  const start = () => {
    const run = () => loadTournamentPulseHeavyData();
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3500 });
    else setTimeout(run, 1800);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, { rootMargin: '160px 0px' });
    observer.observe(section);
    return;
  }

  start();
}

function matchesDoneCard(pt) {
  const pct = pt.progressPct;
  const rem = pt.remainMatches;
  return `
    <div class="pulse-card pulse-card--state">
      <div class="pulse-label">Matches Completed</div>
      <div class="pulse-value-row">
        <span class="pulse-primary pulse-primary--big">${pt.doneMatches}</span>
        <span class="pulse-separator">/</span>
        <span class="pulse-secondary">${pt.totalMatches}</span>
        <span class="pulse-secondary" style="margin-left:auto;color:rgba(255,255,255,.18)">${pct}%</span>
      </div>
      <div class="pulse-progress-wrap">
        <div class="pulse-progress-bar">
          <div class="pulse-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="pulse-subtext">${rem > 0 ? rem + ' matches remaining in league stage' : 'League stage complete'}</div>
    </div>`;
}

function playoffCard(pt) {
  const sp = pt.playoff;
  const alive = pt.alive;
  let subtext = '';
  if (sp.tieRisk) subtext = `${alive} teams in contention · NRR deciding final spots · ${sp.spread} pts separating #3–#6`;
  else subtext = `${alive} teams alive · ${sp.spread} pts separating #3–#6`;
  return `
    <div class="pulse-card pulse-card--state">
      <div class="pulse-label">Playoff Race</div>
      <div class="pulse-value-row">
        <span class="pulse-primary pulse-primary--orange">${alive}</span>
        <span class="pulse-secondary">teams in playoff contention</span>
      </div>
      <div class="pulse-subtext">${esc(subtext)}</div>
      ${sp.nrrDecider ? `<div class="pulse-alert" style="border-color:rgba(251,146,60,.25);background:rgba(251,146,60,.06);color:#fb923c">⚡ NRR likely to decide final qualifiers</div>` : ''}
    </div>`;
}

function momentumCard(pt) {
  const s = pt.bestStreak;
  const nrrL = pt.nrrLeader;
  if (!s || !s.streak) {
    // Show most dominant team by NRR instead
    return `
      <div class="pulse-card pulse-card--momentum">
        <div class="pulse-label">Hot Streak</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">No active streaks</div>
        ${nrrL ? `<div class="pulse-subtext" style="margin-top:8px">NRR leader: ${esc(nrrL.team_short)} (${nrrL.nrr > 0 ? '+' : ''}${(nrrL.nrr||0).toFixed(3)})</div>` : ''}
      </div>`;
  }
  return `
    <div class="pulse-card pulse-card--momentum">
      <div class="pulse-label">Hot Streak</div>
      <div style="display:flex;align-items:baseline;gap:6px">
        <span style="font-size:18px;font-weight:800;color:#4ade80">${esc(s.team)}</span>
        <span class="pulse-separator">·</span>
        <span style="font-size:22px;font-weight:800;color:#f1f5f9;font-variant-numeric:tabular-nums">${s.streak}</span>
        <span class="pulse-secondary">consecutive wins</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:8px">
        ${s.last5.slice(-5).map(r => {
          const w = String(r).toUpperCase() === 'W';
          return `<span style="width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;${w ? 'color:#4ade80;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.18)' : 'color:#f87171;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.18)'}">${r}</span>`;
        }).join('')}
      </div>
      ${nrrL?.team_short !== s.team ? `<div class="pulse-subtext" style="margin-top:8px">NRR leader: ${esc(nrrL?.team_short||'')} (${nrrL?.nrr > 0 ? '+' : ''}${(nrrL?.nrr||0).toFixed(3)})</div>` : `<div class="pulse-subtext" style="margin-top:8px;color:#4ade80">NRR ${(nrrL?.nrr||0).toFixed(3)} · hottest team in the tournament</div>`}
    </div>`;
}

function nrrPressureCard(pt) {
  const watch = pt.nrrWatch;
  if (!watch || !watch.length) {
    return `
      <div class="pulse-card pulse-card--momentum">
        <div class="pulse-label">NRR Pressure</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">No teams tied on points</div>
        ${pt.nrrLeader ? `<div class="pulse-subtext" style="margin-top:8px">Highest NRR: ${esc(pt.nrrLeader.team_short)} (${(pt.nrrLeader.nrr||0).toFixed(3)})</div>` : ''}
      </div>`;
  }
  return `
    <div class="pulse-card pulse-card--momentum">
      <div class="pulse-label">NRR Watch</div>
      ${watch.map(w => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
          <span style="font-size:11px;font-weight:700;color:var(--ct)">${esc(w.t1.team_short)}</span>
          <span style="font-size:10px;color:rgba(255,255,255,.25)">${w.t1.points}pts</span>
          <span style="flex:1;text-align:center;font-size:9px;color:rgba(255,255,255,.12)">NRR gap: ${(Math.abs((w.t1.nrr||0) - (w.t2.nrr||0))).toFixed(3)}</span>
          <span style="font-size:10px;color:rgba(255,255,255,.25)">${w.t2.points}pts</span>
          <span style="font-size:11px;font-weight:700;color:var(--ct)">${esc(w.t2.team_short)}</span>
        </div>
      `).join('')}
      ${pt.nrrSwing.length ? `<div class="pulse-subtext" style="margin-top:8px">⚡ NRR swing alert: ${pt.nrrSwing.map(r => esc(r.team_short)).join(', ')}</div>` : ''}
    </div>`;
}

function orangeCapCard(pt) {
  const b = pt.topBat;
  if (!b || !b.runs) {
    return `
      <div class="pulse-card pulse-card--race">
        <div class="pulse-label">Orange Cap</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">Loading stats data…</div>
      </div>`;
  }
  const sr = b.balls > 0 ? Math.round(b.runs*100/b.balls) : 0;
  return `
    <div class="pulse-card pulse-card--race">
      <div class="pulse-label">Orange Cap</div>
      <div class="pulse-player-name" style="color:#f97316">${esc(b.player)}</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px">
        <span style="font-size:20px;font-weight:800;color:#f1f5f9;font-variant-numeric:tabular-nums">${b.runs}</span>
        <span class="pulse-secondary">runs</span>
        <span class="pulse-separator">·</span>
        <span style="font-size:11px;color:rgba(255,255,255,.3);font-family:var(--mono)">SR ${sr}</span>
      </div>
      ${b.sixes ? `<div class="pulse-subtext">${b.sixes} sixes · ${b.matches?.size || '—'} matches</div>` : ''}
    </div>`;
}

function purpleCapCard(pt) {
  const b = pt.topBowl;
  if (!b || !b.wkts) {
    return `
      <div class="pulse-card pulse-card--race">
        <div class="pulse-label">Purple Cap</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">Loading stats data…</div>
      </div>`;
  }
  const econ = b.balls > 0 ? Math.round(b.runs*6/b.balls*100)/100 : 0;
  return `
    <div class="pulse-card pulse-card--race">
      <div class="pulse-label">Purple Cap</div>
      <div class="pulse-player-name" style="color:#a78bfa">${esc(b.player)}</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px">
        <span style="font-size:20px;font-weight:800;color:#f1f5f9;font-variant-numeric:tabular-nums">${b.wkts}</span>
        <span class="pulse-secondary">wickets</span>
        <span class="pulse-separator">·</span>
        <span style="font-size:11px;color:rgba(255,255,255,.3);font-family:var(--mono)">Econ ${econ.toFixed(2)}</span>
      </div>
      ${b.matches?.size ? `<div class="pulse-subtext">${b.matches.size} matches · last: ${esc(b.team||'')}</div>` : ''}
    </div>`;
}

function chaseCard(pt) {
  const c = pt.chaseRate;
  if (!c || !c.total) {
    return `
      <div class="pulse-card pulse-card--ent">
        <div class="pulse-label">Chase Success</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">Loading archive data…</div>
      </div>`;
  }
  const pct = Math.round(c.won/c.total*100);
  return `
    <div class="pulse-card pulse-card--ent">
      <div class="pulse-label">Chase Success Rate</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:4px">
        <span style="font-size:28px;font-weight:800;color:#22d3ee;font-variant-numeric:tabular-nums">${pct}%</span>
        <span class="pulse-secondary">teams batting second ${c.total > 0 ? 'win' : ''}</span>
      </div>
      <div class="pulse-subtext">${c.won}/${c.total} chases won ${pt.totalMatches ? '· ' + pt.remainMatches + ' remaining' : ''}</div>
      ${c.won > 0 && c.total > 0 ? `<div class="pulse-progress-wrap" style="margin-top:8px"><div class="pulse-progress-bar"><div class="pulse-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#22d3ee,#06b6d4)"></div></div></div>` : ''}
    </div>`;
}

function totalCard(pt) {
  const h = pt.highestInn;
  const cf = pt.closestFinish;
  if (!h || !h.runs) {
    return `
      <div class="pulse-card pulse-card--ent">
        <div class="pulse-label">Highest Total</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">Loading archive data…</div>
      </div>`;
  }
  return `
    <div class="pulse-card pulse-card--ent">
      <div class="pulse-label">Highest Total / Closest Finish</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px">
        <span style="font-size:18px;font-weight:800;color:#22d3ee">${esc(h.team)}</span>
        <span style="font-size:22px;font-weight:800;color:#f1f5f9;font-variant-numeric:tabular-nums">${h.runs}/${h.wkts}</span>
      </div>
      ${cf && cf.margin < 999 ? `<div class="pulse-subtext" style="margin-top:6px">🎯 Closest finish: ${esc(cf.detail)}</div>` : ''}
    </div>`;
}
async function loadPointsIntel() {
  if (pointsData || pointsIntelLoading) return;
  pointsIntelLoading = true;
  try {
    const res = await fetchJson(getPointsTableUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pointsData = await res.json();
    pointsLoaded = true;
    if (!pointsData.years?.includes(Number(pointsSeason))) {
      pointsSeason = String(pointsData.years?.[0] || '2026');
    }
    if (currentFilter === 'points') renderPointsTable(pointsData);
    if (currentFilter === 'teams') renderTeamsSection();
    if (lastData) render(lastData);
  } catch (_) {
    // Match cards still work without table intelligence.
  } finally {
    pointsIntelLoading = false;
  }
}

// ── Hero scorecard (auto-fetched for live match) ───────────────
let heroScorecardData = null;
let heroMatchId = null;

async function loadHeroScorecard(match) {
  try {
    const res = await fetchJson(getScorecardUrl(match.id));
    if (!res.ok) return;
    const sc = await res.json();
    heroScorecardData = sc;
    heroMatchId = match.id;
    // Scorecard data available for drawer — no hero overwrite needed (avoids flicker)
  } catch (_) { /* silently ignore — hero still shows without player data */ }
}

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

const FILTER_TITLES = {
  all: 'Home', live: 'Live', upcoming: 'Upcoming',
  results: 'Results', points: 'Points', stats: 'Stats',
  archive: 'Archive', schedule: 'Schedule',
  teams: 'Teams', players: 'Players',
};

function setFilter(f) {
  // Scroll both window and main column to top
  const mainEl = $('main');
  if (mainEl) mainEl.scrollTop = 0;
  else window.scrollTo({ top: 0, behavior: 'instant' });

  currentFilter = f;

  // Update ALL nav elements with data-filter attribute
  document.querySelectorAll('[data-filter]').forEach(el => {
    const match = el.dataset.filter === f;
    el.classList.toggle('is-active', match);
    el.classList.toggle('active', match);
  });

  // Update main title (desktop)
  const titleEl = $('mainTitle');
  if (titleEl) titleEl.textContent = FILTER_TITLES[f] || 'Pitch';

  if (f === 'archive') {
    if (!archiveLoaded) loadArchive();
    else if (archiveData) renderArchive(archiveData);
  } else if (f === 'schedule') {
    if (!scheduleLoaded) loadSchedule();
    else if (scheduleData) renderSchedule(scheduleData);
  } else if (f === 'points') {
    if (!pointsLoaded) loadPointsTable();
    else if (pointsData) renderPointsTable(pointsData);
    if (!scheduleData && !scheduleLoaded) loadSchedule();
  } else if (f === 'stats') {
    if (!statsLoaded) loadStatsBuilder();
    else if (statsData) renderStatsBuilder();
  } else if (f === 'teams') {
    renderTeamsSection();
  } else if (f === 'players') {
    // Load stats first if not loaded (needed for player team + run/wicket data)
    if (!statsLoaded) {
      loadStatsBuilder().then(() => renderPlayersSection());
    } else {
      renderPlayersSection();
    }
  } else {
    const controls = $('archiveControls');
    if (controls) controls.style.display = 'none';
  }
  if (lastData) applyFilter(lastData);

  // Close sidebar on mobile when a nav item is tapped
  closeSidebar();
}

// ── Mobile sidebar toggle ──────────────────────────────────
function toggleSidebar() {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (!sidebar) return;
  const willOpen = !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', willOpen);
  if (overlay) overlay.classList.toggle('is-open', willOpen);
  document.body.style.overflow = willOpen ? 'hidden' : '';
}

function closeSidebar() {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

function applyFilter(data) {
  const show = id => $(id) && ($(id).style.display = '');
  const hide = id => $(id) && ($(id).style.display = 'none');
  const f = currentFilter;

  const scheduleView = isScheduleView(f);
  const pointsView = isPointsView(f);
  const showHero     = !scheduleView && (f === 'all' || f === 'live');
  const showLive     = !scheduleView && (f === 'all' || f === 'live');
  // Upcoming full section only on explicit 'upcoming' tab — on 'all' tab we show the preview below hero instead
  const showUpcoming = !scheduleView && f === 'upcoming';
  const showResults  = !scheduleView && (f === 'all' || f === 'results');

  // Hero
  if (data.live.length > 0 && showHero) show('heroSection');
  else hide('heroSection');

  // Upcoming preview (below hero, or standalone on home when no live match)
  const showUpcomingPreview = showHero && data.upcoming.length > 0;
  if (showUpcomingPreview) { const el = $('heroUpcomingPreview'); if (el) el.style.display = ''; }
  else { const el = $('heroUpcomingPreview'); if (el) el.style.display = 'none'; }

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

  // Tournament Pulse — home only
  const showPulse = f === 'all';
  if (showPulse) { show('tournamentPulse'); renderTournamentPulse(); queueTournamentPulseHeavyLoad(); }
  else hide('tournamentPulse');

  // Schedule
  if (scheduleView) show('scheduleSection');
  else hide('scheduleSection');

  if (pointsView) show('pointsSection');
  else hide('pointsSection');

  // Stats builder — only shown when Stats tab is active
  // Must force display:flex (not '') because CSS class has display:none
  const statsView = f === 'stats';
  const statsEl = $('statsBuilderSection');
  if (statsEl) statsEl.style.display = statsView ? 'flex' : 'none';

  // Teams / Players sections
  const teamsView   = f === 'teams';
  const playersView = f === 'players';
  const teamsEl   = $('teamsSection');
  const playersEl = $('playersSection');
  if (teamsEl)   teamsEl.style.display   = teamsView   ? '' : 'none';
  if (playersEl) playersEl.style.display = playersView ? '' : 'none';

  // Empty state (only for non-schedule/points/stats/teams/players views)
  const anyVisible =
    scheduleView ||
    pointsView ||
    statsView ||
    teamsView ||
    playersView ||
    (data.live.length > 0 && showHero) ||
    (extraLive.length > 0 && showLive) ||
    (data.upcoming.length > 0 && showUpcoming) ||
    (data.upcoming.length > 0 && showHero) || // preview counts as content on 'all' tab
    (data.finished.length > 0 && showResults);

  if (!anyVisible) show('emptySection');
  else hide('emptySection');
}

// ── Upcoming preview (home page, below hero or standalone) ────
function renderUpcomingPreview(upcoming) {
  const el = $('heroUpcomingPreview');
  if (!el) return;
  const preview = upcoming.slice(0, 3);
  if (!preview.length) { el.style.display = 'none'; return; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:15px;font-weight:700;letter-spacing:-0.3px;color:var(--ct)">Upcoming Matches</span>
      <button onclick="setFilter('upcoming')" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:3px;font-size:12.5px;font-weight:600;color:#7c5dc7;font-family:var(--font);padding:0">
        See All
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${preview.map(upcomingRowCK).join('')}
    </div>`;
  el.style.display = '';
}

// ── Render ────────────────────────────────────────────────────
function render(data) {
  lastData = data;


  const totalLive = data.live.length;

  // Update ALL live count indicators
  ['livePill', 'livePillDesktop'].forEach(id => {
    const el = $(id);
    if (el) { el.textContent = totalLive; el.style.display = totalLive > 0 ? 'inline-flex' : 'none'; }
  });
  const liveBadge = $('liveBadge');
  if (liveBadge) { liveBadge.textContent = totalLive; liveBadge.style.display = totalLive > 0 ? 'inline-flex' : 'none'; }

  // Hero — show ultra live card without flicker
  if (data.live.length > 0) {
    const liveMatch = data.live[0];
    var heroMatchCheck = document.getElementById("heroInner");
    var heroMid = heroMatchCheck ? heroMatchCheck.getAttribute("data-mid") : null;
    var existingHero = heroMid && String(liveMatch.id) !== heroMid
      ? (heroMatchCheck.innerHTML = liveCardCK(liveMatch), false)
      : document.querySelector('[data-live="score"]');
    if (existingHero) {
      updateLiveCard(liveMatch);
    } else {
      $('heroInner').innerHTML = liveCardCK(liveMatch);
    }
    const cachedSc = (heroMatchId === liveMatch.id) ? heroScorecardData : null;
    if (!cachedSc || heroMatchId !== liveMatch.id) {
      heroScorecardData = null;
      heroMatchId = liveMatch.id;
      loadHeroScorecard(liveMatch);
    }
  } else {
    $('heroInner').innerHTML = '';
    heroScorecardData = null;
    heroMatchId = null;
  }

  // Upcoming preview — always shown on home when there are upcoming matches
  renderUpcomingPreview(data.upcoming);

  // Tournament Pulse renders only when Home tab is active; heavy data lazy-loads near viewport.

  // Live grid (remaining after hero) — Crickly cards
  $('liveGrid').innerHTML = data.live.slice(1).map(liveCardCK).join('');
  // Fetch live intelligence for all live matches
  data.live.forEach(function(m) { loadLiveIntel(m); });

  // Also fetch for the hero match
  if (data.live.length > 0) loadLiveIntel(data.live[0]);

  // Upcoming — Crickly rows (full list in the Upcoming tab)
  $('upcomingGrid').innerHTML = data.upcoming.map(upcomingRowCK).join('');

  // Results — Crickly cards
  $('resultsGrid').innerHTML = data.finished.map(liveCardCK).join('');

  applyFilter(data);
}

// ── Fetch ─────────────────────────────────────────────────────
let fetching = false;

// ── Live intelligence fetcher ──
let liveIntelCache = {};
let liveIntelLoading = {};


// ── Live intel helpers ─────────────────────────────────


function loadLiveIntel(match) {
  if (!match || !match.id) return;
  var url = '/api/live/' + encodeURIComponent(match.id);
  fetch(url).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(data) {
    // Apply fresh data to match object
    if (lastData && lastData.live) {
      for (var i = 0; i < lastData.live.length; i++) {
        var m = lastData.live[i];
        if (m.id === match.id) {
          if (data.batters && data.batters.length) m.batters = data.batters;
          if (data.bowlers && data.bowlers.length) m.bowlers = data.bowlers;
          if (data.partnership) m.partnership = data.partnership;
          if (data.fall_of_wickets && data.fall_of_wickets.length) m.fow_display = data.fall_of_wickets;
          if (data.pressure) m.pressure_data = data.pressure;
          if (data.win_probability) m.win_prob = data.win_probability;
          if (data.projected) m.projection_data = data.projected;
          if (data.match_meta) m.live_meta = data.match_meta;
          if (data.ball_timeline) m.ball_timeline = data.ball_timeline;
          if (data.momentum) m.last_6_balls = data.momentum.last_6_balls;
          break;
        }
      }
      // Re-render hero + grid
      var heroIn = document.getElementById('heroInner');
      if (heroIn && lastData.live.length > 0 && heroIn.innerHTML) {
        // Check if batter section exists in DOM — if not, full render to create it
        if (heroIn.innerHTML.indexOf('Current Batters') >= 0) {
          updateLiveCard(lastData.live[0]);
        } else {
          heroIn.innerHTML = liveCardCK(lastData.live[0]);
        }
      }
      var grid = document.getElementById('liveGrid');
      if (grid) grid.innerHTML = lastData.live.slice(1).map(liveCardCK).join('');
    }
  }).catch(function() {
    // Silently fail
  });
}


async function loadMatches(forceRefresh = false) {
  if (fetching) return;
  fetching = true;

  ['refreshBtn', 'desktopRefreshBtn', 'sidebarRefreshBtn'].forEach(id => {
    const btn = $(id); if (btn) btn.classList.add('spinning');
  });

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

    // Boot right rail once (idempotent)
    initRightRail();

    render(data);
    loadPointsIntel();

    // Update timestamps (mobile topbar + desktop header + sidebar)
    const updatedText = data.last_updated ? `Updated ${data.last_updated}` : '';
    ['timestamp', 'desktopTimestamp'].forEach(id => {
      const ts = $(id);
      if (ts && updatedText) {
        ts.textContent = updatedText;
        ts.classList.add('fresh');
        setTimeout(() => ts.classList.remove('fresh'), 3000);
      }
    });
    const sidebarTs = $('sidebarTimestamp');
    if (sidebarTs && data.last_updated) sidebarTs.textContent = data.last_updated;

  } catch (err) {
    showError(err.message || 'Network error');
  } finally {
    fetching = false;
    ['refreshBtn', 'desktopRefreshBtn', 'sidebarRefreshBtn'].forEach(id => {
      const b = $(id); if (b) b.classList.remove('spinning');
    });
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
    { id: 'orange', label: 'Orange Cap', icon: '🟠', metric: 'runs', sort: 'desc', minBalls: 0, note: 'Most runs across the selected IPL seasons.' },
    { id: 'strike', label: 'Strike Rate', icon: '⚡', metric: 'strike_rate', sort: 'desc', minBalls: 100, note: 'Fastest run-scoring with a balls-faced qualifier.' },
    { id: 'average', label: 'Average', icon: '📊', metric: 'average', sort: 'desc', minBalls: 100, note: 'Consistency view for batters with dismissals.' },
    { id: 'sixes', label: 'Six Hitting', icon: '💥', metric: 'sixes', sort: 'desc', minBalls: 0, note: 'Boundary power by sixes.' },
    { id: 'fifties', label: '50+ Scores', icon: '🏅', metric: 'fifties', sort: 'desc', minBalls: 0, note: 'Most innings of 50 or more.' },
  ],
  bowling: [
    { id: 'purple', label: 'Purple Cap', icon: '🟣', metric: 'wickets', sort: 'desc', minBalls: 0, note: 'Most wickets across the selected IPL seasons.' },
    { id: 'economy', label: 'Economy', icon: '🔒', metric: 'economy', sort: 'asc', minBalls: 120, note: 'Run control with a balls-bowled qualifier.' },
    { id: 'strike', label: 'Strike Rate', icon: '🎯', metric: 'strike_rate', sort: 'asc', minBalls: 120, note: 'Wicket-taking frequency.' },
    { id: 'dots', label: 'Dot Balls', icon: '🔵', metric: 'dots', sort: 'desc', minBalls: 0, note: 'Pressure balls — no runs scored.' },
    { id: 'maidens', label: 'Maidens', icon: '🌟', metric: 'maidens', sort: 'desc', minBalls: 0, note: 'Rare full-over control in T20 cricket.' },
  ],
};

let statsLoaded = false;
let statsLoadQueued = false;
let statsFiltersOpen = false;
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
  statsLoadQueued = true;
  try {
    // Load archive stats + provisional (scraped) stats in parallel
    const fetches = [fetchJson(getStatsBuilderUrl())];
    if (!IS_STATIC_MODE) fetches.push(fetchJson('/api/provisional-stats'));

    const [statsRes, provRes] = await Promise.all(fetches);
    if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);

    statsData = await statsRes.json();

    // Merge provisional records — these cover the ~3-day Cricsheets delay
    if (provRes && provRes.ok) {
      const prov = await provRes.json();
      const provBatting = prov.batting || [];
      const provBowling = prov.bowling || [];
      // Only add records for match IDs not already in the archive
      const archiveMatchIds = new Set((statsData.batting || []).map(r => r.m));
      const newBat = provBatting.filter(r => !archiveMatchIds.has(r.m));
      const newBwl = provBowling.filter(r => !archiveMatchIds.has(r.m));
      statsData.batting  = [...(statsData.batting  || []), ...newBat];
      statsData.bowling  = [...(statsData.bowling  || []), ...newBwl];
      statsData._provMatchCount = prov.match_count || 0;
      // Ensure 2026 is in the years list
      if (prov.match_count && !statsData.years.includes(2026)) {
        statsData.years = [...statsData.years, 2026].sort();
      }
    }

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
  const provCount = statsData._provMatchCount || 0;
  const provNote = provCount > 0
    ? `<span class="stats-prov-note">+${provCount} provisional match${provCount > 1 ? 'es' : ''} included</span>`
    : '';
  el.innerHTML = `
    <div class="stats-page">
      <div class="stats-title-block">
        <h2 class="stats-title">IPL Stat Builder</h2>
        <p class="stats-subtitle">Build batting and bowling leaderboards across seasons.${provNote ? ' ' + provNote : ''}</p>
      </div>
      <div class="stats-mode-toggle" role="tablist" aria-label="Stat type">
        <button type="button" class="stats-mode-btn batting ${statsFilters.mode === 'batting' ? 'active' : ''}" onclick="setStatsMode('batting')">Batting</button>
        <button type="button" class="stats-mode-btn bowling ${statsFilters.mode === 'bowling' ? 'active' : ''}" onclick="setStatsMode('bowling')">Bowling</button>
      </div>
      ${renderStatsPresetRail()}
      ${renderStatsControls()}
      <div id="statsResults">${renderStatsResults()}</div>
    </div>`;
}

function renderStatsPresetRail() {
  const allowed = statsFilters.mode === 'batting'
    ? ['orange', 'strike', 'average', 'sixes']
    : ['purple', 'economy'];
  const presets = (STAT_PRESETS[statsFilters.mode] || []).filter(p => allowed.includes(p.id));
  return `
    <div class="stats-cat-scroll" aria-label="Stat categories">
      ${presets.map(preset => `
        <button type="button" class="stats-cat-card ${statsFilters.preset === preset.id ? 'active' : ''}" onclick="setStatsPreset('${preset.id}')">
          <span class="stats-cat-icon">${esc(preset.icon || '📋')}</span>
          <span class="stats-cat-label">${esc(preset.label)}</span>
          <span class="stats-cat-sub">${esc(statsCatSub(preset.id))}</span>
        </button>`).join('')}
    </div>`;
}

function statsCatSub(id) {
  return {
    orange: 'Most runs across selected seasons',
    strike: 'Fastest scorers with qualifier',
    average: 'Most consistent batters',
    sixes: 'Most sixes in IPL history',
    purple: 'Most wickets across selected seasons',
    economy: 'Tightest bowlers with qualifier',
  }[id] || 'Leaderboard category';
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
  return `
    <div class="stats-filter-wrap">
      <button type="button" class="stats-filter-toggle" onclick="toggleStatsFilters()">⚙ Filters <span>${statsFiltersOpen ? '▴' : '▾'}</span></button>
      ${statsFiltersOpen ? `
        <div class="stats-filter-panel stats-filter-panel-new">
          <div class="stats-filter-grid">
            <label><span class="stats-filter-label">Season from</span><select class="stats-filter-select" onchange="onStatsFilterChange('yearFrom', this.value)">${statsOptions(years.slice().reverse(), statsFilters.yearFrom, 'Any year')}</select></label>
            <label><span class="stats-filter-label">Season to</span><select class="stats-filter-select" onchange="onStatsFilterChange('yearTo', this.value)">${statsOptions(years, statsFilters.yearTo, 'Any year')}</select></label>
            <label><span class="stats-filter-label">Team</span><select class="stats-filter-select" onchange="onStatsFilterChange('team', this.value)">${statsOptions(statsData.teams, statsFilters.team, 'All teams')}</select></label>
            <label><span class="stats-filter-label">Opposition</span><select class="stats-filter-select" onchange="onStatsFilterChange('opposition', this.value)">${statsOptions(statsData.teams, statsFilters.opposition, 'All opponents')}</select></label>
          </div>
          <div class="stats-actions"><button type="button" class="stats-reset-btn" onclick="resetStatsBuilder()">Reset</button><button type="button" class="stats-apply-btn" onclick="applyStatsBuilder()">Apply</button></div>
        </div>` : ''}
    </div>`;
}

function toggleStatsFilters() {
  statsFiltersOpen = !statsFiltersOpen;
  renderStatsBuilder();
}

function statsColumnConfig() {
  if (statsFilters.mode === 'batting') {
    return {
      orange: [{key:'runs', label:'Runs'}, {key:'average', label:'Avg'}, {key:'strike_rate', label:'SR'}],
      strike: [{key:'strike_rate', label:'SR'}, {key:'runs', label:'Runs'}, {key:'average', label:'Avg'}],
      average: [{key:'average', label:'Avg'}, {key:'runs', label:'Runs'}, {key:'strike_rate', label:'SR'}],
      sixes: [{key:'sixes', label:'6s'}, {key:'runs', label:'Runs'}, {key:'strike_rate', label:'SR'}],
    }[statsFilters.preset] || [{key:'runs', label:'Runs'}, {key:'average', label:'Avg'}, {key:'strike_rate', label:'SR'}];
  }
  return {
    purple: [{key:'wickets', label:'Wkts'}, {key:'average', label:'Avg'}, {key:'economy', label:'Econ'}],
    economy: [{key:'economy', label:'Econ'}, {key:'wickets', label:'Wkts'}, {key:'average', label:'Avg'}],
  }[statsFilters.preset] || [{key:'wickets', label:'Wkts'}, {key:'average', label:'Avg'}, {key:'economy', label:'Econ'}];
}

function statsTeamCode(row) {
  if (row.teams && row.teams.size) return Array.from(row.teams)[0];
  const label = String(row.team_label || '').split(' ')[0];
  return label && label !== 'teams' ? label : 'IPL';
}

function statsTeamBadge(code) {
  const meta = teamMeta(code);
  return `<span class="stats-team-badge" style="background:${meta.color}18;border-color:${meta.color}30;color:${meta.color}">${esc(code)}</span>`;
}

function statsRank(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
}

function statsValue(row, key) {
  const v = row[key];
  if (key === 'average') return v === null ? '-' : fmt(v, 2);
  if (key === 'economy') return fmt(v, 2);
  if (key === 'strike_rate') return fmt(v, 1);
  if (key === 'runs' || key === 'wickets' || key === 'sixes') return String(Math.round(v || 0));
  return v == null ? '-' : String(v);
}

function renderStatsResults() {
  if (!statsData) return '';
  const preset = currentStatsPreset();
  const rows = rankedStatsRows().slice(0, 25);
  const cols = statsColumnConfig();
  const modeLabel = statsFilters.mode === 'batting' ? 'Batting' : 'Bowling';
  const badgeClass = statsFilters.mode === 'batting' ? 'batting' : 'bowling';
  if (!rows.length) {
    return `<div class="stats-results-card"><div class="sc-empty">No players match these filters yet.<br><span style="font-size:12px;color:var(--t4)">Try widening the year range or lowering qualifiers.</span></div></div>`;
  }
  return `
    <div class="stats-leaderboard">
      <div class="stats-lb-header">
        <div><span class="stats-lb-badge ${badgeClass}">${esc(modeLabel)} leaderboard</span><h3 class="stats-lb-title">${esc(preset.label)}</h3></div>
        <span class="stats-lb-count">Top ${rows.length}</span>
      </div>
      <div class="stats-col-header"><span style="width:28px">#</span><span class="stats-col-player">Player</span>${cols.map((c,i)=>`<span class="stats-col-label ${i===0?'primary':''}">${esc(c.label)}</span>`).join('')}</div>
      <div class="stats-row-list">${rows.map((row, index) => renderStatsLeaderboardRow(row, index, cols)).join('')}</div>
    </div>`;
}

function renderStatsLeaderboardRow(row, index, cols) {
  const rank = index + 1;
  const team = statsTeamCode(row);
  const meta = statsFilters.mode === 'batting'
    ? `${row.innings} inns · HS ${row.high_score}`
    : `${row.innings} inns · BB ${row.best_bowling || '-'}`;
  return `
    <div class="stats-row ${rank <= 3 ? 'top3' : ''}">
      <span class="stats-rank-new">${esc(statsRank(rank))}</span>
      ${statsTeamBadge(team)}
      <span class="stats-player-main"><b>${esc(row.player)}</b><small>${esc(meta)}</small></span>
      ${cols.map((col, i) => `<span class="stats-stat-cell ${i === 0 ? 'primary rank-' + rank : ''}"><b>${esc(statsValue(row, col.key))}</b><small>${esc(col.label)}</small></span>`).join('')}
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
      best_wickets: -1,
      best_runs: 0,
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
    const wk = record.w || 0;
    const ru = record.ru || 0;
    if (wk > row.best_wickets || (wk === row.best_wickets && ru < row.best_runs)) {
      row.best_wickets = wk;
      row.best_runs = ru;
    }
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
    best_bowling: row.best_wickets >= 0 ? `${row.best_wickets}/${row.best_runs}` : '-',
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

function teamInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'TEAM';
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

  const kickerClass = statsFilters.mode === 'batting' ? 'batting-kicker' : 'bowling-kicker';
  return `
    <div class="stats-results-card">
      <div class="stats-results-head">
        <div>
          <span class="stats-results-kicker ${kickerClass}">${esc(modeLabel)} leaderboard</span>
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
let drawerComparisonMode = 'over';

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

function selectComparisonMode(mode) {
  drawerComparisonMode = mode === 'ball' ? 'ball' : 'over';
  if (drawerScorecardData) renderScorecard(drawerScorecardData);
}

function openDrawer(matchId, matchObj) {
  drawerMatchId = matchId;
  drawerOpen = true;
  drawerScorecardData = null;
  drawerSelectedInningsIndex = 0;
  drawerHasManualInningsSelection = false;
  drawerComparisonMode = 'over';

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
  drawerComparisonMode = 'over';
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
    ${renderInnings(innings[drawerSelectedInningsIndex])}
    ${renderInningsComparison(innings)}`;

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

function scorecardSectionId(prefix, inn) {
  const team = String(inn?.bat_team || 'innings')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${team}-${inn?.innings_id || 'scorecard'}`;
}

function scrollScorecardSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderScorecardJumpbar(items) {
  return `
    <div class="scorecard-jumpbar" aria-label="Scorecard sections">
      ${items.map(item => `
        <button type="button" onclick="scrollScorecardSection('${item.id}')">
          <span>${esc(item.label)}</span>
          <strong>${esc(String(item.count))}</strong>
        </button>`).join('')}
    </div>`;
}

function hasValidDrawerInningsSelection(innings) {
  if (!innings.length) return false;
  if (!drawerHasManualInningsSelection) return false;
  return drawerSelectedInningsIndex >= 0 && drawerSelectedInningsIndex < innings.length;
}

function progressionForMode(progression, mode) {
  const rows = Array.isArray(progression)
    ? progression.map(normalizeProgressionItem).filter(item => Number(item?.ball) > 0)
    : [];
  if (mode === 'ball') return rows;

  const byOver = new Map();
  for (const item of rows) {
    const overNumber = Math.ceil(Number(item.ball) / 6);
    byOver.set(overNumber, item);
  }
  return Array.from(byOver.values()).sort((a, b) => Number(a.ball) - Number(b.ball));
}

function normalizeProgressionItem(item) {
  if (item && typeof item === 'object') {
    return { ...item, over: item.over || ballsToOvers(Number(item.ball || 0)) };
  }
  if (typeof item !== 'string') return null;
  const [ball, runs, wickets, deliveryRuns, ...markerParts] = item.split(',');
  const ballNumber = Number(ball);
  return {
    ball: ballNumber,
    over: ballsToOvers(ballNumber),
    runs: Number(runs || 0),
    wickets: Number(wickets || 0),
    delivery_runs: Number(deliveryRuns || 0),
    marker: markerParts.join(',') || deliveryRuns || '0',
  };
}

function renderInningsComparison(innings) {
  const comparable = innings
    .filter(inn => Array.isArray(inn.progression) && inn.progression.length)
    .slice(0, 2);
  if (comparable.length < 2) return '';

  const [first, second] = comparable;
  const firstRows = progressionForMode(first.progression, drawerComparisonMode);
  const secondRows = progressionForMode(second.progression, drawerComparisonMode);
  const firstByBall = new Map(firstRows.map(item => [Number(item.ball), item]));
  const secondByBall = new Map(secondRows.map(item => [Number(item.ball), item]));
  const keys = Array.from(new Set([...firstByBall.keys(), ...secondByBall.keys()])).sort((a, b) => a - b);
  const firstShort = teamInitials(first.bat_team);
  const secondShort = teamInitials(second.bat_team);

  return `
    <div class="comparison-panel">
      <div class="comparison-head">
        <div>
          <span class="comparison-kicker">Run Race</span>
          <h3>${drawerComparisonMode === 'ball' ? 'Ball-by-ball comparison' : 'Over-by-over comparison'}</h3>
          <p>Compare both innings at the same point in the chase.</p>
        </div>
        <div class="comparison-toggle" role="tablist" aria-label="Comparison mode">
          <button type="button" class="${drawerComparisonMode === 'over' ? 'is-active' : ''}" onclick="selectComparisonMode('over')">Overs</button>
          <button type="button" class="${drawerComparisonMode === 'ball' ? 'is-active' : ''}" onclick="selectComparisonMode('ball')">Balls</button>
        </div>
      </div>
      <div class="comparison-table">
        <div class="comparison-row comparison-row--head">
          <span>After</span>
          <span>${esc(firstShort)}</span>
          <span>${esc(secondShort)}</span>
          <span>Edge</span>
        </div>
        ${keys.map(key => renderComparisonRow(key, firstByBall.get(key), secondByBall.get(key), firstShort, secondShort)).join('')}
      </div>
    </div>`;
}

function renderComparisonRow(ball, first, second, firstShort, secondShort) {
  const label = first?.over || second?.over || ballsToOvers(ball);
  return `
    <div class="comparison-row">
      <span class="comparison-over">After ${esc(String(label))} ov</span>
      ${renderComparisonScore(first, firstShort)}
      ${renderComparisonScore(second, secondShort)}
      ${renderComparisonEdge(first, second, firstShort, secondShort)}
    </div>`;
}

function renderComparisonScore(item, teamShort) {
  if (!item) {
    return `<span class="comparison-score comparison-score--empty" data-team="${esc(teamShort)}"><strong>-</strong><small>Not reached</small></span>`;
  }
  const marker = item.marker ? ` · ${item.marker}` : '';
  const deliveryRuns = Number(item.delivery_runs ?? 0);
  return `
    <span class="comparison-score" data-team="${esc(teamShort)}">
      <strong>${item.runs}/${item.wickets}</strong>
      <small>${deliveryRuns} run${deliveryRuns === 1 ? '' : 's'}${esc(marker)}</small>
    </span>`;
}

function renderComparisonEdge(first, second, firstShort, secondShort) {
  if (!first || !second) {
    return `<span class="comparison-edge">Pending</span>`;
  }
  const diff = Number(first.runs || 0) - Number(second.runs || 0);
  if (diff === 0) return `<span class="comparison-edge is-level">Level</span>`;
  const leader = diff > 0 ? firstShort : secondShort;
  return `<span class="comparison-edge">${esc(leader)} +${Math.abs(diff)}</span>`;
}

function isDidNotBatCandidate(batter) {
  return Boolean(batter?.not_out) &&
    !String(batter?.out_desc || '').trim() &&
    Number(batter?.runs || 0) === 0 &&
    Number(batter?.balls || 0) === 0 &&
    Number(batter?.fours || 0) === 0 &&
    Number(batter?.sixes || 0) === 0;
}

function isScorecardNotOut(batter) {
  const dismissal = String(batter?.out_desc || '').trim().toLowerCase();
  return dismissal === 'not out' || (Boolean(batter?.not_out) && !isDidNotBatCandidate(batter));
}

function splitBattingCardRows(batsmen, score) {
  const candidates = batsmen.filter(isDidNotBatCandidate);
  const activeZeroBallNotOuts = new Set();
  const wickets = Number(score?.wickets || 0);
  const alreadyActive = batsmen.filter(isScorecardNotOut).length;

  if (wickets < 10 && candidates.length && candidates.length === 1) {
    const allowance = Math.max(0, 2 - alreadyActive);
    candidates.slice(0, allowance).forEach(batter => activeZeroBallNotOuts.add(batter));
  } else if (wickets >= 10 && candidates.length === 1 && batsmen.length <= 11) {
    activeZeroBallNotOuts.add(candidates[0]);
  }

  const batters = [];
  const didNotBat = [];
  for (const batter of batsmen) {
    if (isDidNotBatCandidate(batter) && !activeZeroBallNotOuts.has(batter)) {
      didNotBat.push(batter);
    } else {
      batters.push(batter);
    }
  }
  return { batters, didNotBat };
}

function renderInnings(inn) {
  const { score, bat_team, bowl_team } = inn;
  const batsmen = Array.isArray(inn.batsmen) ? inn.batsmen : [];
  const bowlers = Array.isArray(inn.bowlers) ? inn.bowlers : [];
  const fow = Array.isArray(inn.fow) ? inn.fow : [];
  const extras = inn.extras || { total: 0, byes: 0, leg_byes: 0, wides: 0, no_balls: 0 };
  const battingId = scorecardSectionId('batting', inn);
  const bowlingId = scorecardSectionId('bowling', inn);
  const fowId = scorecardSectionId('fow', inn);
  const scoreStr = score.declared
    ? `${score.runs}/${score.wickets}d`
    : `${score.runs}/${score.wickets}`;

  // ── Batting table ──
  const { batters: battingRows, didNotBat } = splitBattingCardRows(batsmen, score);
  const batRows = battingRows.length ? battingRows.map(b => {
    const isNotOut = isScorecardNotOut(b);
    const nameFlags = [
      b.is_captain ? `<span class="captain-tag">C</span>` : '',
      b.is_keeper  ? `<span class="keeper-tag">WK</span>` : '',
      isNotOut     ? `<span class="not-out-star">★</span>` : '',
    ].join('');
    const outInfo = (!isNotOut && b.out_desc)
      ? `<span class="out-desc">${esc(b.out_desc)}</span>`
      : `<span class="out-desc" style="color:var(--result)">not out</span>`;
    const runsClass = isNotOut ? 'sc-runs sc-not-out' : 'sc-runs';
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
  }).join('') : `
      <tr>
        <td class="sc-empty-row" colspan="6">Batting data is not available for this innings yet.</td>
      </tr>`;
  const didNotBatHtml = didNotBat.length ? `
    <div class="did-not-bat">
      <span>Did not bat</span>
      <p>${didNotBat.map(batter => esc(batter.name)).join(', ')}</p>
    </div>` : '';

  // Extras + total
  const extraStr = `b ${extras.byes}, lb ${extras.leg_byes}, w ${extras.wides}, nb ${extras.no_balls}`;
  const totalStr = score.declared
    ? `${score.runs}/${score.wickets}d (${score.overs} Ov)`
    : `${score.runs}/${score.wickets} (${score.overs} Ov)`;

  // ── Bowling table ──
  const bowlRows = bowlers.length ? bowlers.map(bw => `
    <tr>
      <td><span class="bowl-name">${esc(bw.name)}</span></td>
      <td>${bw.overs}</td>
      <td>${bw.maidens}</td>
      <td>${bw.runs}</td>
      <td style="color:${bw.wickets > 0 ? 'var(--result)' : 'var(--t2)'};font-weight:${bw.wickets > 0 ? 700 : 400}">${bw.wickets}</td>
      <td>${bw.economy > 0 ? bw.economy.toFixed(1) : '—'}</td>
    </tr>`).join('') : `
    <tr>
      <td class="sc-empty-row" colspan="6">Bowling data is not available for this innings yet.</td>
    </tr>`;

  // ── Fall of wickets ──
  const fowHtml = fow.length > 0 ? `
    <div class="sc-section-label" id="${fowId}">Fall of Wickets</div>
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

        ${renderScorecardJumpbar([
          { id: battingId, label: 'Batting', count: battingRows.length },
          { id: bowlingId, label: 'Bowling', count: bowlers.length },
          { id: fowId, label: 'Wickets', count: fow.length },
        ])}

        <div class="sc-section-label" id="${battingId}">Batting — vs ${esc(bowl_team)}</div>
        <div class="sc-table-wrap">
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
        </div>
        ${didNotBatHtml}

        <div class="sc-section-label" id="${bowlingId}" style="margin-top:16px">Bowling — ${esc(bowl_team)}</div>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead>
              <tr>
                <th style="text-align:left">Bowler</th>
                <th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th>
              </tr>
            </thead>
            <tbody>${bowlRows}</tbody>
          </table>
        </div>

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
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☽' : '☀';
  const sideIcon = document.getElementById('sidebarThemeIcon');
  if (sideIcon) sideIcon.textContent = theme === 'dark' ? '☽' : '☀';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('pitch-theme', next);
  applyTheme(next);
}

// ================================================================
// RIGHT RAIL — Points widget + Top Performers widget
// ================================================================

let rightRailInited = false;
let railPerfMode = 'batting';
let railPointsData = null;
let railPerfData   = null;

function initRightRail() {
  if (rightRailInited) return;
  rightRailInited = true;
  _loadRailPoints();
  _loadRailPerformers();
}

async function _loadRailPoints() {
  try {
    const res = await fetchJson(getPointsTableUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    railPointsData = await res.json();
    renderRailPoints();
  } catch (err) {
    const el = $('railPointsBody');
    if (el) el.innerHTML = `<div class="sc-empty" style="font-size:11px;padding:10px 13px">Could not load</div>`;
  }
}

async function _loadRailPerformers() {
  const url = IS_STATIC_MODE
    ? joinPath(DATA_BASE_PATH, 'top-performers-2026.json')
    : '/api/top-performers';
  try {
    const res = await fetchJson(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    railPerfData = await res.json();
    renderRailPerformers();
  } catch (err) {
    const el = $('railPerfBody');
    if (el) el.innerHTML = `<div class="sc-empty" style="font-size:11px;padding:10px 13px">Could not load</div>`;
  }
}

function renderRailPoints() {
  const el = $('railPointsBody');
  if (!el || !railPointsData) return;
  // Use the most recent season available
  const season = String(railPointsData.years?.slice(-1)[0] || '2026');
  const rows = (railPointsData.tables?.[season]?.rows || []).slice(0, 8);
  if (!rows.length) {
    el.innerHTML = `<div class="sc-empty" style="font-size:11px;padding:10px 13px">No data</div>`;
    return;
  }
  el.innerHTML = `
    <div class="rail-pt-head">
      <span>#</span><span>Team</span><span>W</span><span>L</span><span>Pts</span>
    </div>
    ${rows.map((t, i) => {
      const meta = teamMeta(t.team_short);
      const isQ  = i < 4;
      return `
        <div class="rail-pt-row${isQ ? ' is-qualifying' : ''}" onclick="setFilter('points')" title="View full points table">
          <span class="rail-pt-rank">${i + 1}</span>
          <span class="rail-pt-team">
            <span class="rail-pt-badge" style="border-color:${meta.color}55;color:${meta.color};background:${meta.bg}">${esc(t.team_short)}</span>
            <span class="rail-pt-name">${esc(t.team)}</span>
          </span>
          <span class="rail-pt-val">${t.won ?? 0}</span>
          <span class="rail-pt-val">${t.lost ?? 0}</span>
          <span class="rail-pt-pts">${t.points ?? 0}</span>
        </div>`;
    }).join('')}`;
}

function setRailPerfMode(mode) {
  railPerfMode = mode;
  // Update toggle button active state
  const toggleEl = $('railPerfToggle');
  if (toggleEl) {
    toggleEl.querySelectorAll('.rail-toggle-btn').forEach((btn, i) => {
      const modes = ['batting', 'bowling'];
      btn.classList.toggle('is-active', modes[i] === mode);
    });
  }
  renderRailPerformers();
}

function renderRailPerformers() {
  const el = $('railPerfBody');
  if (!el || !railPerfData) return;
  const rows = (railPerfMode === 'batting'
    ? railPerfData.batting
    : railPerfData.bowling
  ) || [];
  const top = rows.slice(0, 7);
  if (!top.length) {
    el.innerHTML = `<div class="sc-empty" style="font-size:11px;padding:10px 13px">No data</div>`;
    return;
  }
  const isBat = railPerfMode === 'batting';
  el.innerHTML = top.map((p, i) => `
    <div class="rail-perf-row">
      <span class="rail-perf-rank">${i + 1}</span>
      <div class="rail-perf-info">
        <div class="rail-perf-name">${esc(p.player)}</div>
        <div class="rail-perf-team">${esc(p.team)}</div>
      </div>
      <div class="rail-perf-val-wrap">
        <span class="rail-perf-val">${isBat ? p.runs : p.wickets}</span>
        <span class="rail-perf-label">${isBat ? 'runs' : 'wkts'}</span>
      </div>
    </div>`).join('');
}

// ================================================================
// TEAMS SECTION
// ================================================================


// TEAM_PROFILE_META removed — no API data available for captain/coach/titles. Expanded card shows "—" for missing fields.

function renderTeamsSection() {
  const el = $('teamsSection');
  if (!el) return;
  if (!pointsData && !pointsIntelLoading) loadPointsIntel();
  const rows = buildTeamRowsForCards();
  el.innerHTML = `
    <div class="teams-v2">
      <div class="ck-sec-head"><span class="ck-sec-title">IPL 2026 — Team Intelligence</span></div>
      <div class="team-sort-pills">
        ${[
          ['rank', 'By Rank'],
          ['points', 'By Points'],
          ['qual', 'Qual %'],
          ['form', 'Form'],
        ].map(([id, label]) => `<button type="button" class="team-sort-pill ${teamsSortMode === id ? 'active' : ''}" onclick="setTeamsSort('${id}')">${label}</button>`).join('')}
      </div>
      <div class="team-list">
        ${rows.map(renderTeamIntelligenceCard).join('')}
      </div>
    </div>`;
}

function buildTeamRowsForCards() {
  const season = String(pointsSeason || pointsData?.years?.[0] || '2026');
  const rawRows = (pointsData?.tables?.[season]?.rows || []).map((row, index) => ({ ...row, rank: row.rank || index + 1 }));
  const rowMap = new Map(rawRows.map(row => [row.team_short, row]));
  const rows = TEAM_ORDER.map((abbr, index) => normalizeTeamCardRow(abbr, rowMap.get(abbr), index + 1));
  return rows.sort((a, b) => {
    if (teamsSortMode === 'points') return b.points - a.points || b.nrr - a.nrr;
    if (teamsSortMode === 'qual') return b.qualification_pct - a.qualification_pct || a.rank - b.rank;
    if (teamsSortMode === 'form') return teamFormScore(b.last_5) - teamFormScore(a.last_5) || a.rank - b.rank;
    return a.rank - b.rank;
  });
}

function normalizeTeamCardRow(abbr, row, fallbackRank) {
  const played = row?.played || 0;
  const won = row?.won || 0;
  const lost = row?.lost || 0;
  const last5 = Array.isArray(row?.last_5) ? row.last_5 : [];
  const qual = Number(row?.qualification_pct ?? 0);
  return {
    abbr,
    full: TEAM_FULL_NAMES[abbr] || abbr,
    rank: row?.rank || fallbackRank,
    played,
    won,
    lost,
    points: Number(row?.points || 0),
    nrr: Number(row?.nrr || 0),
    last_5: last5,
    qualification_pct: qual,
    eliminated: qual <= 3 && played >= 10,
    momentum: teamMomentum(last5, row?.trend || 0),
    profile,
    lastResult: latestTeamResult(abbr),
    topBatter: topTeamPerformer(abbr, 'batting'),
    topBowler: topTeamPerformer(abbr, 'bowling'),
  };
}

function teamFormScore(form) {
  return (form || []).reduce((score, result, index) => score + (result === 'W' ? (index + 1) : 0), 0);
}

function teamMomentum(form, trend) {
  const wins = (form || []).filter(r => r === 'W').length;
  const tail = (form || []).slice(-3);
  const tailWins = tail.filter(r => r === 'W').length;
  const tailLosses = tail.filter(r => r === 'L').length;
  if (tailLosses === 3) return 'Collapsing';
  if (tailWins === 3 || wins >= 4) return 'Surging';
  if (tailWins >= 2 || trend > 0) return 'Rising';
  if (tailLosses >= 2 || trend < 0) return 'Falling';
  if (wins <= 1) return 'Dipping';
  return 'Steady';
}

function teamMomentumMeta(label) {
  return {
    Surging: { icon: '⚡', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
    Rising: { icon: '↑', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
    Steady: { icon: '→', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
    Dipping: { icon: '↘', color: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
    Falling: { icon: '↓', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
    Collapsing: { icon: '⬇', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  }[label] || { icon: '→', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
}

function latestTeamResult(abbr) {
  const finished = (lastData?.finished || []).filter(m => m.team1_short === abbr || m.team2_short === abbr);
  const m = finished[0];
  if (!m) return null;
  const isT1 = m.team1_short === abbr;
  const opp = isT1 ? m.team2_short : m.team1_short;
  const score = isT1 ? m.team1_score1 : m.team2_score1;
  const won = String(m.winner || '').includes(abbr) || String(m.winner || '').includes(TEAM_FULL_NAMES[abbr] || abbr);
  return { opp, won, score: score?.display || '—', overs: score?.detail || '', result: won ? 'W' : 'L' };
}

function topTeamPerformer(abbr, mode) {
  if (!statsData) return null;
  const season = 2026;
  if (mode === 'batting') {
    const map = new Map();
    for (const rec of (statsData.batting || [])) {
      if (rec.t !== abbr || Number(rec.y) !== season) continue;
      const row = map.get(rec.p) || { player: rec.p, runs: 0 };
      row.runs += rec.ru || 0;
      map.set(rec.p, row);
    }
    const top = Array.from(map.values()).sort((a, b) => b.runs - a.runs)[0];
    return top ? { player: top.player, stat: top.runs + ' runs' } : null;
  }
  const map = new Map();
  for (const rec of (statsData.bowling || [])) {
    if (rec.t !== abbr || Number(rec.y) !== season) continue;
    const row = map.get(rec.p) || { player: rec.p, wickets: 0 };
    row.wickets += rec.w || 0;
  }
  const top = Array.from(map.values()).sort((a, b) => b.wickets - a.wickets)[0];
  return top ? { player: top.player, stat: top.wickets + ' wkts' } : null;
}
function teamQualColor(value) {
  return value >= 70 ? '#22C55E' : value >= 40 ? '#FACC15' : value >= 15 ? '#F97316' : '#EF4444';
}

function renderTeamFormPills(form) {
  const values = (form || []).length ? form : ['-','-','-','-','-'];
  return `<div class="team-form-pills">${values.map(r => `<span class="team-form-pill ${r === 'W' ? 'win' : r === 'L' ? 'loss' : 'empty'}">${esc(r)}</span>`).join('')}</div>`;
}

function renderTeamIntelligenceCard(row) {
  const t = teamMeta(row.abbr);
  const color = t.color;
  const isTop4 = row.rank <= 4;
  const qColor = teamQualColor(row.qualification_pct);
  const mom = teamMomentumMeta(row.momentum);
  const open = !!teamsExpanded[row.abbr];
  const last = row.lastResult;
  return `
    <div class="team-card team-intel-card ${row.eliminated ? 'eliminated' : ''}" style="--team-color:${color};--team-color-2:${t.color2 || color}">
      <div class="team-top-bar"></div>
      <div class="team-card-pad">
        <div class="team-row team-row-main">
          <div class="team-main-left">
            <div class="team-rank-bubble ${isTop4 ? 'top4' : ''}">#${row.rank}</div>
            <div class="team-name-stack">
              <div class="team-code-line"><span>${esc(row.abbr)}</span>${isTop4 && !row.eliminated ? '<b class="team-status-pill top4">TOP 4</b>' : ''}${row.eliminated ? '<b class="team-status-pill out">OUT</b>' : ''}</div>
              <div class="team-full-name">${esc(row.full)}</div>
              <div class="team-home-ground">${esc('Home ground')}</div>
            </div>
          </div>
          <div class="team-points-box"><b>${row.points}</b><span>pts</span><em class="${row.nrr >= 0 ? 'pos' : 'neg'}">${row.nrr > 0 ? '+' : ''}${fmt(row.nrr, 3)}</em></div>
        </div>
        <div class="team-row team-record-row">
          <div class="team-record"><span class="w">${row.won}W</span><i>·</i><span class="l">${row.lost}L</span><i>·</i><span class="p">${row.played}P</span></div>
          <div class="team-momentum" style="background:${mom.bg};color:${mom.color}"><span>${mom.icon}</span>${esc(row.momentum)}</div>
        </div>
        <div class="team-row team-form-row">
          ${renderTeamFormPills(row.last_5)}
          ${last ? `<div class="team-last-chip ${last.won ? 'won' : 'lost'}"><span>vs ${esc(last.opp)}</span><b>${esc(last.result)} · ${esc(last.score)} ${last.overs ? `(${esc(last.overs)})` : ''}</b></div>` : `<div class="team-last-chip"><span>Latest</span><b>Awaiting result</b></div>`}
        </div>
        <div class="team-qual-block">
          <div class="team-qual-label"><span>PLAYOFF PROBABILITY</span><b style="color:${qColor}">${Math.round(row.qualification_pct)}%</b></div>
          <div class="team-qual-track"><i style="width:${Math.max(0, Math.min(100, row.qualification_pct))}%;background:${qColor}"></i></div>
        </div>
      </div>
      <button type="button" class="team-expand-toggle" onclick="toggleTeamProfile('${row.abbr}')">Team Profile ${open ? '▴' : '▾'}</button>
      ${open ? renderTeamExpandedProfile(row) : ''}
    </div>`;
}

function renderTeamExpandedProfile(row) {
  const titles = Number(row.profile.titles || 0);
  return `
    <div class="team-expanded">
      <div class="team-expand-grid">
        <div class="team-expand-card"><span>Captain</span><b>—</b></div>
        <div class="team-expand-card"><span>Coach</span><b>—</b></div>
      </div>
      <div class="team-expand-grid">
        <div class="team-expand-card"><span>Top Batter</span><b>${row.topBatter ? esc(row.topBatter.player) : '—'}</b>${row.topBatter ? '<em>' + esc(row.topBatter.stat) + '</em>' : '<em>No data</em>'}</div>
        <div class="team-expand-card"><span>Top Bowler</span><b>${row.topBowler ? esc(row.topBowler.player) : '—'}</b>${row.topBowler ? '<em>' + esc(row.topBowler.stat) + '</em>' : '<em>No data</em>'}</div>
      </div>
      <div style="padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);text-align:center">
        <span style="font-size:9px;color:rgba(255,255,255,.25);font-weight:700">Titles & Founded — data unavailable</span>
      </div>
    </div>`;
}

function setTeamsSort(mode) {
  teamsSortMode = mode;
  renderTeamsSection();
}

function toggleTeamProfile(abbr) {
  teamsExpanded[abbr] = !teamsExpanded[abbr];
  renderTeamsSection();
}

function showTeamDetail(abbr) {
  const t = teamMeta(abbr);
  const full = TEAM_FULL_NAMES[abbr] || abbr;
  const el = $('teamsSection');
  if (!el) return;
  const ext = TEAM_LOGO_EXT[abbr] || 'png';

  // Filter matches from lastData
  const live     = (lastData?.live     || []).filter(m => m.team1_short === abbr || m.team2_short === abbr);
  const upcoming = (lastData?.upcoming || []).filter(m => m.team1_short === abbr || m.team2_short === abbr);
  const results  = (lastData?.finished || []).filter(m => m.team1_short === abbr || m.team2_short === abbr);

  // Points table entry
  let ptRow = null;
  if (pointsData) {
    const season = String(pointsData.years?.slice(-1)[0] || '2026');
    const rows = pointsData.tables?.[season]?.rows || [];
    ptRow = rows.find(r => r.team_short === abbr);
  }

  // Top performers for this team (2026) from stats
  let topBat = [], topBowl = [];
  if (statsData) {
    const batMap = new Map();
    for (const rec of (statsData.batting || [])) {
      if (rec.t !== abbr || Number(rec.y) !== 2026) continue;
      const row = batMap.get(rec.p) || { player: rec.p, runs: 0, balls: 0, matches: new Set() };
      row.runs += rec.ru || 0; row.balls += rec.b || 0; row.matches.add(rec.m);
      batMap.set(rec.p, row);
    }
    topBat = Array.from(batMap.values()).sort((a, b) => b.runs - a.runs).slice(0, 5)
      .map(r => ({ ...r, sr: r.balls > 0 ? (r.runs * 100 / r.balls).toFixed(1) : '—' }));

    const bowlMap = new Map();
    for (const rec of (statsData.bowling || [])) {
      if (rec.t !== abbr || Number(rec.y) !== 2026) continue;
      const row = bowlMap.get(rec.p) || { player: rec.p, wickets: 0, balls: 0, runs: 0, matches: new Set() };
      row.wickets += rec.w || 0; row.balls += rec.b || 0; row.runs += rec.ru || 0; row.matches.add(rec.m);
      bowlMap.set(rec.p, row);
    }
    topBowl = Array.from(bowlMap.values()).sort((a, b) => b.wickets - a.wickets).slice(0, 5)
      .map(r => ({ ...r, econ: r.balls > 0 ? (r.runs * 6 / r.balls).toFixed(2) : '—' }));
  }

  const perfHtml = (topBat.length || topBowl.length) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${topBat.length ? `
      <div style="background:var(--csf);border-radius:14px;padding:16px;border:1px solid var(--csfbd)">
        <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Top Batsmen — 2026</div>
        ${topBat.map(p => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--cdiv);cursor:pointer" onclick="showPlayerDetail('${esc(p.player).replace(/'/g,"\\'")}')">
            ${playerAvatar(p.player, abbr, 28)}
            <div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.player)}</div></div>
            <div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:800;color:${t.color}">${p.runs}</div><div style="font-size:9.5px;color:var(--ct4)">SR ${p.sr}</div></div>
          </div>`).join('')}
      </div>` : ''}
      ${topBowl.length ? `
      <div style="background:var(--csf);border-radius:14px;padding:16px;border:1px solid var(--csfbd)">
        <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Top Bowlers — 2026</div>
        ${topBowl.map(p => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--cdiv);cursor:pointer" onclick="showPlayerDetail('${esc(p.player).replace(/'/g,"\\'")}')">
            ${playerAvatar(p.player, abbr, 28)}
            <div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:600;color:var(--ct);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.player)}</div></div>
            <div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:800;color:${t.color}">${p.wickets}<span style="font-size:10px;color:var(--ct4)"> wkts</span></div><div style="font-size:9.5px;color:var(--ct4)">Econ ${p.econ}</div></div>
          </div>`).join('')}
      </div>` : ''}
    </div>` : '';

  el.innerHTML = `
    <div style="margin-bottom:20px">
      <button onclick="renderTeamsSection()" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--ct3);padding:4px 0;font-family:var(--font)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>
        All Teams
      </button>
    </div>

    <!-- Team hero -->
    <div style="background:linear-gradient(135deg,${t.color}15,${t.color2||t.color}06);border:1px solid ${t.color}22;border-radius:20px;padding:24px;margin-bottom:20px;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden">
      <div style="position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:${t.color}0c;border-radius:50%;filter:blur(60px);pointer-events:none"></div>
      <div style="width:96px;height:96px;border-radius:18px;background:linear-gradient(135deg,${t.color}22,${t.color2||t.color}10);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 8px 32px ${t.color}30;padding:8px;box-sizing:border-box;position:relative;z-index:1">
        <img src="${joinPath(STATIC_BASE_PATH, `team-logos/${abbr}.${ext}`)}" alt="${esc(abbr)}" style="width:100%;height:100%;object-fit:contain"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span style="display:none;font-size:20px;font-weight:800;color:${t.color};width:100%;height:100%;align-items:center;justify-content:center">${esc(abbr)}</span>
      </div>
      <div style="position:relative;z-index:1;flex:1;min-width:0">
        <div style="font-size:10px;font-weight:700;color:${t.color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px">${esc(abbr)}</div>
        <div style="font-size:20px;font-weight:800;color:var(--ct);letter-spacing:-0.3px;margin-bottom:8px">${esc(full)}</div>
        ${ptRow ? `<div style="display:flex;gap:20px;flex-wrap:wrap">
          <div><div style="font-size:20px;font-weight:800;color:var(--ct)">${ptRow.played||0}</div><div style="font-size:10px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Played</div></div>
          <div><div style="font-size:20px;font-weight:800;color:#22c55e">${ptRow.won||0}</div><div style="font-size:10px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Won</div></div>
          <div><div style="font-size:20px;font-weight:800;color:#ef4444">${ptRow.lost||0}</div><div style="font-size:10px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Lost</div></div>
          <div><div style="font-size:20px;font-weight:800;color:${t.color}">${ptRow.points||0}</div><div style="font-size:10px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Points</div></div>
          ${ptRow.nrr != null ? `<div><div style="font-size:20px;font-weight:800;color:var(--ct)">${Number(ptRow.nrr)>=0?'+':''}${Number(ptRow.nrr).toFixed(3)}</div><div style="font-size:10px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">NRR</div></div>` : ''}
        </div>` : `<div style="font-size:12px;color:var(--ct4)">Load Points table for 2026 standings</div>`}
      </div>
    </div>

    ${perfHtml}

    ${live.length ? `<div class="ck-sec-head"><span class="ck-sec-title">Live Now</span></div>
    <div class="ck-cards-grid" style="margin-bottom:20px">${live.map(liveCardCK).join('')}</div>` : ''}

    ${upcoming.length ? `<div class="ck-sec-head"><span class="ck-sec-title">Upcoming Fixtures</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">${upcoming.map(upcomingRowCK).join('')}</div>` : ''}

    ${results.length ? `<div class="ck-sec-head"><span class="ck-sec-title">Recent Results</span></div>
    <div class="ck-cards-grid">${results.map(liveCardCK).join('')}</div>` : ''}

    ${!live.length && !upcoming.length && !results.length ? `
    <div style="text-align:center;padding:48px 20px">
      <div style="font-size:28px;margin-bottom:10px">🏏</div>
      <p style="color:var(--ct3);font-size:14px">No recent matches found for ${esc(full)}.</p>
    </div>` : ''}`;
}

// ================================================================
// PLAYERS SECTION
// ================================================================

let playersTeamFilter = 'all';
let playersRoleFilter = 'all';
let playersSortMode = 'runs';
let playersSearch = '';


function renderPlayersSection() {
  const el = $('playersSection');
  if (!el) return;
  if (!statsData && !statsLoaded) { loadStatsBuilder().then(() => renderPlayersSection()); return; }
  if (!statsData) return;

  const all = buildPlayerCardList();
  const filtered = filterPlayerCardList(all);
  const teamTabs = ['all', ...TEAM_ORDER];

  el.innerHTML = `
    <div class="players-v2">
      <div class="ck-sec-head"><span class="ck-sec-title">IPL Players</span></div>
      <div class="players-search-wrap">
        <span class="players-search-icon">🔍</span>
        <input class="players-search-input" type="text" placeholder="Search players..." value="${esc(playersSearch)}" oninput="setPlayersSearch(this.value)" autocomplete="off">
      </div>
      <div class="players-team-pills">${teamTabs.map(abbr => {
        const isAll = abbr === 'all';
        const tcolor = isAll ? '#818cf8' : teamMeta(abbr).color;
        const isActive = playersTeamFilter === abbr;
        return `<button type="button" class="players-team-pill ${isActive?'active':''}" onclick="setPlayersTeamFilter('${abbr}')" style="${isActive ? `--pill-color:${tcolor};background:${tcolor}18;border-color:${tcolor}35;color:${tcolor}` : ''}">${isAll ? 'All' : esc(abbr)}</button>`;
      }).join('')}</div>
      <div class="players-filter-row">
        <select class="players-filter-select" onchange="setPlayersRoleFilter(this.value)">
          <option value="all" ${playersRoleFilter==='all'?'selected':''}>All Roles</option>
          <option value="batter" ${playersRoleFilter==='batter'?'selected':''}>Batter</option>
          <option value="bowler" ${playersRoleFilter==='bowler'?'selected':''}>Bowler</option>
          <option value="allrounder" ${playersRoleFilter==='allrounder'?'selected':''}>Allrounder</option>
          <option value="wk" ${playersRoleFilter==='wk'?'selected':''}>WK</option>
        </select>
        <select class="players-filter-select" onchange="setPlayersSortMode(this.value)">
          <option value="runs" ${playersSortMode==='runs'?'selected':''}>Most Runs</option>
          <option value="wickets" ${playersSortMode==='wickets'?'selected':''}>Most Wickets</option>
          <option value="avg" ${playersSortMode==='avg'?'selected':''}>Best Avg</option>
          <option value="sr" ${playersSortMode==='sr'?'selected':''}>Best SR</option>
        </select>
      </div>
      <div class="players-count">${filtered.length} player${filtered.length !== 1 ? 's' : ''}</div>
      <div class="players-card-list">${filtered.map((pl, idx) => renderPlayerCard(pl, idx)).join('')}
      </div>
    </div>`;
}

// ── Player data builders ──

function buildPlayerCardList() {
  const players = Object.entries(assetManifest.player_images || {});
  const teamMap = assetManifest.player_teams || {};
  const result = [];

  for (const [name, imgPath] of players) {
    const team = teamMap[name] || '';
    const t = teamMeta(team);
    const stats = aggregatePlayerStats(name);
    const role = detectPlayerRole(name, stats);
    const impact = computePlayerImpact(role, stats);
    const lastScores = getPlayerLastScores(name);
    const lastForm = getPlayerLastForm(team);
    const words = name.split(' ');
    const initials = words.length >= 2 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2);
    result.push({
      name, imgPath, team, t, role, impact,
      stats, lastScores, lastForm, initials,
    });
  }
  return result;
}

function aggregatePlayerStats(fullName) {
  const bat = { runs: 0, balls: 0, inns: 0, out: 0, fours: 0, sixes: 0, hs: 0, hsNotOut: false };
  const bowl = { wickets: 0, balls: 0, runs: 0, inns: 0, dots: 0, md: 0, bestW: 0, bestR: 999 };
  if (!statsData) return { batting: bat, bowling: bowl };
  // Build name lookup key
  const abbr = abbrName(fullName);
  for (const rec of (statsData.batting || [])) {
    if (!matchPlayerName(rec.p, fullName, abbr)) continue;
    bat.runs += rec.ru || 0;
    bat.balls += rec.b || 0;
    bat.inns += 1;
    if (rec.out) bat.out += 1;
    bat.fours += rec.fo || 0;
    bat.sixes += rec.si || 0;
    if (rec.ru > bat.hs) { bat.hs = rec.ru; bat.hsNotOut = !rec.out; }
  }
  for (const rec of (statsData.bowling || [])) {
    if (!matchPlayerName(rec.p, fullName, abbr)) continue;
    bowl.wickets += rec.w || 0;
    bowl.balls += rec.b || 0;
    bowl.runs += rec.ru || 0;
    bowl.inns += 1;
    bowl.dots += rec.d || 0;
    bowl.md += rec.md || 0;
    if (rec.w > bowl.bestW || (rec.w === bowl.bestW && rec.ru < bowl.bestR)) {
      bowl.bestW = rec.w; bowl.bestR = rec.ru;
    }
  }
  return { batting: bat, bowling: bowl };
}

function abbrName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName.toLowerCase();
  return parts[0][0].toUpperCase() + ' ' + parts[parts.length - 1];
}

function matchPlayerName(statsName, fullName, abbr) {
  if (statsName === fullName || statsName === abbr) return true;
  const a = statsName?.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const b = fullName?.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (a === b) return true;
  const c = abbr?.toLowerCase().replace(/[^a-z ]/g, '').trim();
  return a === c;
}

const KNOWN_WK = new Set([
  'MS Dhoni', 'KL Rahul', 'Rishabh Pant', 'Sanju Samson', 'Ishan Kishan',
  'Dinesh Karthik', 'Jos Buttler', 'Jonny Bairstow', 'Quinton de Kock',
  'Nicholas Pooran', 'Heinrich Klaasen', 'Wriddhiman Saha', 'Devon Conway',
  'Phil Salt', 'Jitesh Sharma', 'Tom Banton', 'Sam Billings', 'Naman Dhir',
  'Vishnu Vinod', 'Anuj Rawat', 'KS Bharat', 'Kona Srikar Bharat',
  'Prabhsimran Singh', 'Matthew Wade', 'Rahul Tripathi', 'Glenn Maxwell'
]);

function detectPlayerRole(name, stats) {
  const { batting: bat, bowling: bowl } = stats;
  const hasBat = bat.inns > 0;
  const hasBowl = bowl.inns > 0;
  if (KNOWN_WK.has(name)) return 'wk';
  if (hasBat && hasBowl) return 'allrounder';
  if (hasBowl) return 'bowler';
  return 'batter';
}

function computePlayerImpact(role, stats) {
  const { batting: bat, bowling: bowl } = stats;
  if (role === 'bowler' || role === 'allrounder') {
    const econ = bowl.balls > 0 ? (bowl.runs * 6 / bowl.balls) : 999;
    if (bowl.wickets > 12 && econ < 8.0) return 'high';
    if (bowl.wickets > 7 || econ < 8.5) return 'medium';
    return 'low';
  }
  if (role === 'batter' || role === 'wk') {
    const sr = bat.balls > 0 ? (bat.runs * 100 / bat.balls) : 0;
    if (bat.runs > 400 && sr > 145) return 'high';
    if (bat.runs > 200 || sr > 135) return 'medium';
    return 'low';
  }
  return 'low';
}

function getPlayerLastScores(fullName) {
  if (!statsData) return [];
  const abbr = abbrName(fullName);
  const batRecords = (statsData.batting || [])
    .filter(r => matchPlayerName(r.p, fullName, abbr))
    .sort((a, b) => b.m - a.m)
    .slice(0, 5)
    .map(r => r.ru || 0);
  if (batRecords.length >= 2) return batRecords;
  const bowlRecords = (statsData.bowling || [])
    .filter(r => matchPlayerName(r.p, fullName, abbr))
    .sort((a, b) => b.m - a.m)
    .slice(0, 5)
    .map(r => r.w || 0);
  return bowlRecords.length >= 2 ? bowlRecords : batRecords.length ? batRecords : [0,0,0,0,0];
}

function getPlayerLastForm(teamCode) {
  if (!teamCode || !lastData?.finished) return [];
  const matches = lastData.finished
    .filter(m => m.team1_short === teamCode || m.team2_short === teamCode)
    .slice(0, 5);
  return matches.map(m => {
    const isT1 = m.team1_short === teamCode;
    const winner = String(m.winner || '');
    return winner.includes(teamCode) || winner.includes(TEAM_FULL_NAMES[teamCode] || teamCode) ? 'W' : 'L';
  }).filter(Boolean);
}

// ── Filter & sort ──

function filterPlayerCardList(players) {
  let filtered = players;
  if (playersTeamFilter !== 'all') filtered = filtered.filter(p => p.team === playersTeamFilter);
  if (playersSearch) {
    const q = playersSearch.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
  }
  if (playersRoleFilter !== 'all') filtered = filtered.filter(p => p.role === playersRoleFilter);
  const sortFns = {
    runs: (a, b) => b.stats.batting.runs - a.stats.batting.runs || a.name.localeCompare(b.name),
    wickets: (a, b) => b.stats.bowling.wickets - a.stats.bowling.wickets || a.name.localeCompare(b.name),
    avg: (a, b) => {
      const aAvg = a.stats.batting.out > 0 ? (a.stats.batting.runs / a.stats.batting.out) : 0;
      const bAvg = b.stats.batting.out > 0 ? (b.stats.batting.runs / b.stats.batting.out) : 0;
      return bAvg - aAvg || a.name.localeCompare(b.name);
    },
    sr: (a, b) => {
      const aSr = a.stats.batting.balls > 0 ? (a.stats.batting.runs * 100 / a.stats.batting.balls) : 0;
      const bSr = b.stats.batting.balls > 0 ? (b.stats.batting.runs * 100 / b.stats.batting.balls) : 0;
      return bSr - aSr || a.name.localeCompare(b.name);
    },
  };
  return filtered.sort(sortFns[playersSortMode] || sortFns.runs);
}

function setPlayersSearch(val) {
  playersSearch = val;
  renderPlayersSection();
}
function setPlayersRoleFilter(val) {
  playersRoleFilter = val;
  renderPlayersSection();
}
function setPlayersSortMode(val) {
  playersSortMode = val;
  renderPlayersSection();
}

// ── Player card rendering ──

function renderPlayerCard(pl, idx) {
  const { name, imgPath, team, t, role, impact, stats, lastScores, lastForm, initials } = pl;
  const isBatter = role === 'batter' || role === 'wk';
  const isBowler = role === 'bowler';
  const primary = isBowler ? String(stats.bowling.wickets) : String(stats.batting.runs);
  const primaryLabel = isBowler ? 'Wkts' : 'Runs';
  const sr = stats.batting.balls > 0 ? (stats.batting.runs * 100 / stats.batting.balls).toFixed(1) : '—';
  const avg = stats.batting.out > 0 ? (stats.batting.runs / stats.batting.out).toFixed(2) : '—';
  const hs = stats.batting.hs > 0 ? (String(stats.batting.hs) + (stats.batting.hsNotOut ? '*' : '')) : '—';
  const econ = stats.bowling.balls > 0 ? (stats.bowling.runs * 6 / stats.bowling.balls).toFixed(2) : '—';
  const wkts = String(stats.bowling.wickets);
  const bb = stats.bowling.bestW > 0 ? `${stats.bowling.bestW}/${stats.bowling.bestR}` : '—';

  const impactMeta = { high: { icon: '🔥', label: 'High Impact' }, medium: { icon: '📈', label: 'Med Impact' }, low: { icon: '↓', label: 'Low Impact' } }[impact] || { icon: '↓', label: 'Low' };
  const fullPath = imgPath.startsWith('http') ? imgPath : joinPath(STATIC_BASE_PATH, imgPath);

  // stat cols by role
  const statCols = isBowler
    ? [{val: avg, label:'Avg'}, {val: econ, label:'Econ'}, {val: bb, label:'BB'}]
    : [{val: avg, label:'Avg'}, {val: sr, label:'SR'}, {val: hs, label:'HS'}];

  const imgId = `pi-${idx}`;

  return `
    <div class="player-card" onclick="showPlayerDetail(${esc(JSON.stringify(name))})" style="--player-color:${t.color}">
      <div class="player-top-bar"></div>
      <div class="player-inner">
        <div class="player-top">
          <div class="player-avatar" style="border-color:${t.color}30;background:${t.color}10">
            <img src="${esc(fullPath)}" alt="${esc(name)}" id="${imgId}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block"
                 onerror="document.getElementById('${imgId}').style.display='none';document.getElementById('${imgId}f').style.display='flex'">
            <span class="player-avatar-fallback" id="${imgId}f" style="display:none;background:${t.color}18;border-color:${t.color}30;color:${t.color}">${esc(initials)}</span>
          </div>
          <div class="player-info">
            <div class="player-code-line"><span>${esc(team)}</span><span class="player-role-badge role-${role}">${esc(role === 'wk' ? 'WK' : role === 'allrounder' ? 'AR' : role === 'bowler' ? 'BOWL' : 'BAT')}</span><span class="player-impact impact-${impact}" title="${esc(impactMeta.label)}">${impactMeta.icon}</span></div>
            <div class="player-name">${esc(name)}</div>
            <div class="player-meta">${esc(String(stats.batting.inns + stats.bowling.inns))} matches${team ? ' · ' + esc(TEAM_FULL_NAMES[team] || team) : ''}</div>
            <div class="player-primary-stat"><b>${esc(primary)}</b><span>${primaryLabel}</span></div>
          </div>
        </div>
        <div class="player-stat-row">${statCols.map(col => `<div class="player-stat-col"><span class="player-stat-val">${esc(String(col.val))}</span><span class="player-stat-label">${esc(col.label)}</span></div>`).join('')}</div>
        <div class="player-bottom">
          <div class="player-form-pills">${lastForm.length ? lastForm.map(r => `<span class="player-form-pill ${r==='W'?'win':'loss'}">${esc(r)}</span>`).join('') : '<span class="player-form-empty">—</span>'}</div>
          ${renderPlayerMiniBar(lastScores, t.color)}
        </div>
      </div>
    </div>`;
}

function renderPlayerMiniBar(scores, color) {
  const data = scores.slice(0, 5);
  const peak = Math.max(...data, 1);
  return `<div class="player-minibar">${data.map((val, i) => {
    const pct = Math.max(10, (val / peak) * 100);
    const opacity = i === data.length - 1 ? '1' : '.5';
    return `<i style="height:${pct.toFixed(0)}%;background:color-mix(in srgb,${color} ${parseFloat(opacity)*100}%,transparent)" title="${esc(String(val))}"></i>`;
  }).join('')}</div>`;
}

function setPlayersTeamFilter(abbr) {
  playersTeamFilter = abbr;
  renderPlayersSection();
}

// ================================================================
// PLAYER STATS MODAL
// ================================================================

let playerModalOpen = false;

function showPlayerDetail(playerName) {
  playerModalOpen = true;
  const overlay = $('playerModal');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Fetch stats if not loaded
  if (!statsLoaded) {
    const body = $('playerModalBody');
    if (body) body.innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>Loading stats…</span></div>`;
    loadStatsBuilder().then(() => _renderPlayerModal(playerName));
    return;
  }
  _renderPlayerModal(playerName);
}

function _renderPlayerModal(playerName) {
  const body = $('playerModalBody');
  if (!body) return;

  const imgPath = getPlayerImagePath(playerName);

  // Determine player's team from stats
  let playerTeam = (assetManifest.player_teams || {})[playerName] || '';
  if (!playerTeam && statsData) {
    let latestYear = -1;
    for (const rec of [...(statsData.batting||[]), ...(statsData.bowling||[])]) {
      if (rec.p === playerName && Number(rec.y) > latestYear) {
        latestYear = Number(rec.y);
        playerTeam = rec.t;
      }
    }
  }
  const t = teamMeta(playerTeam || '');
  const words = playerName.split(' ');
  const initials = (words.length >= 2 ? words[0][0]+words[words.length-1][0] : playerName.slice(0,2)).toUpperCase();

  // Aggregate batting year-by-year
  const batByYear = new Map();
  if (statsData) {
    for (const rec of (statsData.batting || [])) {
      if (rec.p !== playerName) continue;
      const yr = rec.y;
      const row = batByYear.get(yr) || { year: yr, team: rec.t, inn: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, hs: 0, fifties: 0, hundreds: 0, matches: new Set() };
      row.matches.add(rec.m); row.inn++; row.runs += rec.ru||0; row.balls += rec.b||0;
      row.outs += rec.out||0; row.fours += rec.fo||0; row.sixes += rec.si||0;
      row.hs = Math.max(row.hs, rec.ru||0);
      if ((rec.ru||0) >= 100) row.hundreds++; else if ((rec.ru||0) >= 50) row.fifties++;
      batByYear.set(yr, row);
    }
  }

  // Aggregate bowling year-by-year
  const bowlByYear = new Map();
  if (statsData) {
    for (const rec of (statsData.bowling || [])) {
      if (rec.p !== playerName) continue;
      const yr = rec.y;
      const row = bowlByYear.get(yr) || { year: yr, team: rec.t, inn: 0, balls: 0, runs: 0, wickets: 0, dots: 0, maidens: 0, matches: new Set() };
      row.matches.add(rec.m); row.inn++; row.balls += rec.b||0; row.runs += rec.ru||0;
      row.wickets += rec.w||0; row.dots += rec.d||0; row.maidens += rec.md||0;
      bowlByYear.set(yr, row);
    }
  }

  const batRows  = Array.from(batByYear.values()).sort((a,b) => a.year - b.year);
  const bowlRows = Array.from(bowlByYear.values()).sort((a,b) => a.year - b.year);

  // Totals
  const bT = batRows.reduce((a,r) => ({
    mat:a.mat+r.matches.size, inn:a.inn+r.inn, runs:a.runs+r.runs, balls:a.balls+r.balls,
    outs:a.outs+r.outs, fours:a.fours+r.fours, sixes:a.sixes+r.sixes,
    hs:Math.max(a.hs,r.hs), fifties:a.fifties+r.fifties, hundreds:a.hundreds+r.hundreds
  }), {mat:0,inn:0,runs:0,balls:0,outs:0,fours:0,sixes:0,hs:0,fifties:0,hundreds:0});

  const wT = bowlRows.reduce((a,r) => ({
    mat:a.mat+r.matches.size, inn:a.inn+r.inn, balls:a.balls+r.balls, runs:a.runs+r.runs,
    wickets:a.wickets+r.wickets, dots:a.dots+r.dots, maidens:a.maidens+r.maidens
  }), {mat:0,inn:0,balls:0,runs:0,wickets:0,dots:0,maidens:0});

  const avg  = (r,o) => o>0 ? (r/o).toFixed(2) : '—';
  const sr   = (r,b) => b>0 ? (r*100/b).toFixed(1) : '—';
  const econ = (r,b) => b>0 ? (r*6/b).toFixed(2) : '—';
  const bsr  = (b,w) => w>0 ? (b/w).toFixed(1) : '—';
  const ovr  = (b) => { const o=Math.floor(b/6); const r=b%6; return r ? `${o}.${r}` : String(o); };

  const batTableHtml = batRows.length ? `
    <div style="margin-bottom:24px">
      <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="width:7px;height:7px;border-radius:50%;background:#f97316;flex-shrink:0"></span>Batting
      </div>
      <div style="overflow-x:auto;border-radius:12px;border:1px solid var(--csfbd,rgba(255,255,255,0.07))">
        <table class="player-stats-table">
          <thead><tr>
            <th>Year</th><th>Mat</th><th>Inn</th><th style="text-align:center;padding:10px 8px;color:var(--ct4);font-weight:600">Runs</th>
            <th>Avg</th><th>SR</th><th>HS</th><th>50s</th><th>100s</th><th>4s</th><th>6s</th>
          </tr></thead>
          <tbody>
            ${batRows.map((r,i) => `<tr>
              <td>${r.year}</td>
              <td style="text-align:center;color:var(--ct3)">${r.matches.size}</td>
              <td style="text-align:center;color:var(--ct3)">${r.inn}</td>
              <td style="text-align:center;font-weight:800;color:var(--ct)">${r.runs}</td>
              <td style="text-align:center;color:var(--ct2)">${avg(r.runs,r.outs)}</td>
              <td style="text-align:center;color:var(--ct2)">${sr(r.runs,r.balls)}</td>
              <td style="text-align:center;font-weight:700;color:${t.color}">${r.hs}</td>
              <td style="text-align:center;color:var(--ct3)">${r.fifties}</td>
              <td style="text-align:center;color:var(--ct3)">${r.hundreds}</td>
              <td style="text-align:center;color:var(--ct3)">${r.fours}</td>
              <td style="text-align:center;color:var(--ct3)">${r.sixes}</td>
            </tr>`).join('')}
            ${batRows.length > 1 ? `<tr class="career-row" style="background:${t.color}0a">
              <td style="color:${t.color};font-weight:800">Career</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.mat}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.inn}</td>
              <td style="text-align:center;font-weight:800;color:var(--ct)">${bT.runs}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${avg(bT.runs,bT.outs)}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${sr(bT.runs,bT.balls)}</td>
              <td style="text-align:center;font-weight:700;color:${t.color}">${bT.hs}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.fifties}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.hundreds}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.fours}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bT.sixes}</td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const bowlTableHtml = bowlRows.length ? `
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--ct4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="width:7px;height:7px;border-radius:50%;background:#8b5cf6;flex-shrink:0"></span>Bowling
      </div>
      <div style="overflow-x:auto;border-radius:12px;border:1px solid var(--csfbd,rgba(255,255,255,0.07))">
        <table class="player-stats-table">
          <thead><tr>
            <th>Year</th><th>Mat</th><th>Inn</th><th style="text-align:center;padding:10px 8px;color:var(--ct4);font-weight:600">Wkts</th>
            <th>Runs</th><th>Avg</th><th>Econ</th><th>SR</th><th>Overs</th><th>Dots</th>
          </tr></thead>
          <tbody>
            ${bowlRows.map((r,i) => `<tr>
              <td>${r.year}</td>
              <td style="text-align:center;color:var(--ct3)">${r.matches.size}</td>
              <td style="text-align:center;color:var(--ct3)">${r.inn}</td>
              <td style="text-align:center;font-weight:800;color:${t.color}">${r.wickets}</td>
              <td style="text-align:center;color:var(--ct3)">${r.runs}</td>
              <td style="text-align:center;color:var(--ct2)">${avg(r.runs,r.wickets)}</td>
              <td style="text-align:center;font-weight:600;color:var(--ct2)">${econ(r.runs,r.balls)}</td>
              <td style="text-align:center;color:var(--ct2)">${bsr(r.balls,r.wickets)}</td>
              <td style="text-align:center;color:var(--ct3)">${ovr(r.balls)}</td>
              <td style="text-align:center;color:var(--ct3)">${r.dots}</td>
            </tr>`).join('')}
            ${bowlRows.length > 1 ? `<tr class="career-row" style="background:${t.color}0a">
              <td style="color:${t.color};font-weight:800">Career</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${wT.mat}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${wT.inn}</td>
              <td style="text-align:center;font-weight:800;color:${t.color}">${wT.wickets}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${wT.runs}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${avg(wT.runs,wT.wickets)}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${econ(wT.runs,wT.balls)}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${bsr(wT.balls,wT.wickets)}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${ovr(wT.balls)}</td>
              <td style="text-align:center;font-weight:700;color:var(--ct)">${wT.dots}</td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const noStats = !batRows.length && !bowlRows.length;

  body.innerHTML = `
    <!-- Player hero -->
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--cdiv)">
      <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,${t.color}22,${t.color}0a);box-shadow:0 4px 20px ${t.color}28;display:flex;align-items:center;justify-content:center">
        ${imgPath
          ? `<img src="${esc(joinPath('./', imgPath))}" alt="${esc(playerName)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML='<span style=font-size:26px;font-weight:700;color:${t.color}>${esc(initials)}</span>'">`
          : `<span style="font-size:26px;font-weight:700;color:${t.color}">${esc(initials)}</span>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:20px;font-weight:800;color:var(--ct);letter-spacing:-0.3px;margin-bottom:5px">${esc(playerName)}</div>
        ${playerTeam ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${teamBadge(playerTeam, 26)}<span style="font-size:13px;color:${t.color};font-weight:600">${esc(TEAM_FULL_NAMES[playerTeam]||playerTeam)}</span></div>` : ''}
        ${batRows.length ? `<div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><div style="font-size:18px;font-weight:800;color:var(--ct)">${bT.runs}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IPL Runs</div></div>
          <div><div style="font-size:18px;font-weight:800;color:var(--ct)">${bT.inn}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Innings</div></div>
          <div><div style="font-size:18px;font-weight:800;color:${t.color}">${bT.hs}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Best</div></div>
          <div><div style="font-size:18px;font-weight:800;color:var(--ct)">${avg(bT.runs,bT.outs)}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Avg</div></div>
        </div>` : ''}
        ${!batRows.length && bowlRows.length ? `<div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><div style="font-size:18px;font-weight:800;color:${t.color}">${wT.wickets}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IPL Wickets</div></div>
          <div><div style="font-size:18px;font-weight:800;color:var(--ct)">${wT.inn}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Innings</div></div>
          <div><div style="font-size:18px;font-weight:800;color:var(--ct)">${econ(wT.runs,wT.balls)}</div><div style="font-size:9.5px;color:var(--ct4);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Economy</div></div>
        </div>` : ''}
      </div>
    </div>
    ${noStats ? `<div style="text-align:center;padding:40px 0">
      <div style="font-size:24px;margin-bottom:10px">📊</div>
      <p style="color:var(--ct3);font-size:14px">No IPL statistics found for ${esc(playerName)}.</p>
      <p style="font-size:12px;color:var(--ct4);margin-top:6px">Available for players in our Cricsheet database (2008–2026).</p>
    </div>` : ''}
    ${batTableHtml}
    ${bowlTableHtml}`;
}

function closePlayerModal() {
  const overlay = $('playerModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  playerModalOpen = false;
}

// Close player modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && playerModalOpen) closePlayerModal();
});

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

function ptNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function ptClamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function ptNrr(row) {
  return ptNum(row.nrr, 0);
}
function ptNrrText(nrr) {
  return `${nrr > 0 ? '+' : ''}${nrr.toFixed(3)}`;
}
function getMomentumConfig(m) {
  const map = {
    surging: { label: 'Surging', icon: '↗', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
    rising: { label: 'Rising', icon: '↑', color: '#4ADE80', bg: 'rgba(74,222,128,0.10)' },
    steady: { label: 'Steady', icon: '→', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
    dipping: { label: 'Dipping', icon: '↘', color: '#FB923C', bg: 'rgba(251,146,60,0.10)' },
    falling: { label: 'Falling', icon: '↓', color: '#F87171', bg: 'rgba(248,113,113,0.10)' },
    collapsing: { label: 'Collapsing', icon: '!', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  };
  return map[m] || map.steady;
}
function getPressureColor(p) {
  if (p >= 80) return '#EF4444';
  if (p >= 60) return '#F97316';
  if (p >= 40) return '#FACC15';
  return '#22C55E';
}
function getQualColor(q) {
  if (q >= 85) return '#22C55E';
  if (q >= 60) return '#4ADE80';
  if (q >= 35) return '#FACC15';
  if (q >= 10) return '#F97316';
  return '#EF4444';
}
function getDifficultyLabel(d) {
  if (d >= 70) return 'Tough';
  if (d >= 50) return 'Moderate';
  return 'Favorable';
}
function getDifficultyColor(d) {
  if (d >= 70) return '#EF4444';
  if (d >= 50) return '#F97316';
  return '#22C55E';
}
function getQualDescriptor(q) {
  if (q >= 90) return 'Almost certain';
  if (q >= 75) return 'Strong position';
  if (q >= 45) return 'Competitive';
  if (q >= 20) return 'Needs results';
  if (q >= 8) return 'Unlikely';
  return 'Virtually eliminated';
}
function getPressureLabel(p) {
  if (p >= 80) return 'Must-win territory';
  if (p >= 60) return 'High stakes';
  if (p >= 40) return 'Building pressure';
  return 'Comfortable';
}
function getFormFromRow(row) {
  const raw = Array.isArray(row.last_5) ? row.last_5 : Array.isArray(row.last5) ? row.last5 : [];
  const cleaned = raw.map(v => String(v || '').trim().toUpperCase()[0]).filter(v => ['W','L','N'].includes(v));
  if (cleaned.length) return cleaned.slice(-5);
  const played = Math.max(1, ptNum(row.played || row.p, 0));
  const wins = ptNum(row.won || row.w, 0);
  const ratio = wins / played;
  const winCount = ratio >= 0.72 ? 4 : ratio >= 0.55 ? 3 : ratio >= 0.35 ? 2 : ratio >= 0.18 ? 1 : 0;
  return Array.from({ length: 5 }, (_, i) => i < winCount ? 'W' : 'L');
}
function getStreakType(last5) {
  if (!last5.length) return '—';
  const last = last5[last5.length - 1];
  let count = 0;
  for (let i = last5.length - 1; i >= 0; i--) {
    if (last5[i] === last) count++; else break;
  }
  return `${last}${count}`;
}
function classifyMomentum(last5, nrr, trend = 0) {
  const wins = last5.filter(v => v === 'W').length;
  if (wins >= 4 && nrr >= 0.5) return 'surging';
  if (wins >= 3 && (nrr >= 0 || trend >= 0)) return 'rising';
  if (wins >= 2 && nrr > -0.2) return 'steady';
  if (wins >= 2) return 'dipping';
  if (wins <= 1 && nrr < -0.75) return 'collapsing';
  return 'falling';
}
function makeNrrTrend(nrr, trend = 0) {
  const direction = trend > 0 ? 1 : trend < 0 ? -1 : nrr >= 0 ? 1 : -1;
  const base = Math.abs(nrr) < 0.001 ? 0.06 * direction : nrr;
  return [0.58, 0.70, 0.82, 0.92, 1].map((m, i) => {
    const wobble = (i - 2) * 0.018 * direction;
    return Number((base * m + wobble).toFixed(3));
  });
}
function createSparkline(data, color, width = 64, height = 24) {
  const safe = (data && data.length ? data : [0, 0, 0, 0, 0]).map(Number);
  const min = Math.min(...safe), max = Math.max(...safe);
  const range = max - min || 1;
  const points = safe.map((v, i) => {
    const x = safe.length === 1 ? width : (i / (safe.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastX = width;
  const lastY = height - ((safe[safe.length - 1] - min) / range) * (height - 4) - 2;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="pt-spark"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY.toFixed(1)}" r="2.5" fill="${color}"/></svg>`;
}
function createQualRing(value, size = 44, showText = false) {
  const q = ptClamp(value);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (q / 100) * circ;
  const color = getQualColor(q);
  const icon = q >= 85 ? '✓' : q < 10 ? '×' : '?';
  return `<span class="pt-ring-wrap" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="rotate(-90 ${size/2} ${size/2})"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition:stroke-dashoffset .8s ease"/></g></svg><span class="pt-ring-center" style="color:${color}">${showText ? Math.round(q) : icon}</span></span>`;
}
function formPills(last5) {
  return `<div class="pt-form-row">${(last5 || []).map(r => `<span class="form-pill ${r === 'W' ? 'win' : r === 'L' ? 'loss' : 'nr'}">${esc(r)}</span>`).join('')}</div>`;
}
function teamBadgePt(short, size = 30) {
  const meta = teamMeta(short);
  const ext = TEAM_LOGO_EXT[short] || 'png';
  const logoSrc = joinPath(STATIC_BASE_PATH, `team-logos/${short}.${ext}`);
  return `<img src="${logoSrc}" alt="${esc(short)}" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" loading="lazy"><span style="display:none;font-size:${Math.round(size*0.33)}px;font-weight:800;color:${meta.color}">${esc(short)}</span>`;
}
function fixtureOpponents(teamShort, rows) {
  const maxMatches = 14;
  const team = rows.find(r => r.team_short === teamShort);
  const left = Math.max(0, maxMatches - ptNum(team?.played, 0));
  const sorted = rows.filter(r => r.team_short !== teamShort).sort((a,b) => ptNum(b.points)-ptNum(a.points));
  if (scheduleData?.matches) {
    const fixtures = scheduleData.matches.filter(m => {
      const status = String(m.status || '').toLowerCase();
      const upcoming = !status || status === 'upcoming' || status === 'scheduled';
      return upcoming && (m.team1_short === teamShort || m.team2_short === teamShort);
    }).map(m => m.team1_short === teamShort ? m.team2_short : m.team1_short).filter(Boolean);
    if (fixtures.length) return fixtures.slice(0, left || fixtures.length);
  }
  return sorted.slice(0, left).map(r => r.team_short);
}
function enrichPointsRows(rows) {
  const sorted = rows.map((row, idx) => ({ ...row, _origIndex: idx })).sort((a,b) => (ptNum(a.position, 999) - ptNum(b.position, 999)) || (ptNum(b.points)-ptNum(a.points)) || (ptNrr(b)-ptNrr(a)));
  const fourthPts = ptNum(sorted[3]?.points, 0);
  return sorted.map((row, idx) => {
    const short = row.team_short || row.team || '';
    const played = ptNum(row.played || row.p, 0);
    const won = ptNum(row.won || row.w, 0);
    const lost = ptNum(row.lost || row.l, 0);
    const nr = ptNum(row.no_result ?? row.nr, 0);
    const points = ptNum(row.points ?? row.pts, won * 2 + nr);
    const remaining = Math.max(0, 14 - played);
    const maxPts = points + remaining * 2;
    const nrr = ptNrr(row);
    const last5 = getFormFromRow(row);
    const momentum = classifyMomentum(last5, nrr, ptNum(row.trend, 0));
    const streakType = getStreakType(last5);
    const qualBase = row.qualification_pct != null ? ptNum(row.qualification_pct) : (points / 20) * 70 + Math.max(0, 5 - idx) * 7 + nrr * 8;
    const qualProb = ptClamp(qualBase + (maxPts >= 16 ? 8 : maxPts < fourthPts ? -55 : 0));
    const pressureIndex = ptClamp(100 - qualProb + Math.max(0, 12 - points) * 2 + (remaining <= 3 && qualProb < 60 ? 10 : 0));
    const eliminated = maxPts < fourthPts || qualProb < 3;
    const fixtures = fixtureOpponents(short, sorted);
    const fixtureRows = fixtures.map(code => sorted.find(r => r.team_short === code)).filter(Boolean);
    const remainingDifficulty = fixtureRows.length
      ? ptClamp(fixtureRows.reduce((sum, r) => sum + (100 - ((ptNum(r.position, sorted.indexOf(r)+1) - 1) * 8)) + ptNum(r.points,0) * 2, 0) / fixtureRows.length)
      : ptClamp(50 + (idx < 4 ? 10 : -5));
    const bestCase = Math.max(1, idx + 1 - Math.ceil(remaining / 2));
    const worstCase = Math.min(sorted.length, idx + 1 + Math.max(1, Math.ceil((14 - points) / 4)));
    return {
      ...row,
      rank: idx + 1,
      team_short: short,
      full: TEAM_FULL_NAMES[short] || short,
      played, won, lost, no_result: nr, points, remaining, maxPts, nrr,
      runs_for: ptNum(row.runs_for, 0), runs_against: ptNum(row.runs_against, 0),
      wickets_taken: ptNum(row.wickets_taken, 0), wickets_lost: ptNum(row.wickets_lost, 0),
      last5, momentum, streakType, qualProb, pressureIndex, eliminated,
      nrrTrend: makeNrrTrend(nrr, ptNum(row.trend, 0)), remainingFixtures: fixtures,
      remainingDifficulty, virtualRank: [bestCase, worstCase], isTopFour: idx < 4
    };
  });
}
function renderPointsTable(data) {
  const el = $('pointsTable');
  if (!el) return;
  const seasons = data.years || [];
  const table = data.tables?.[pointsSeason] || data.tables?.[String(seasons[0])] || { rows: [] };
  const rows = enrichPointsRows(table.rows || []);
  const seasonPills = seasons.map(year => `<button class="pts-v3-season-btn${String(year) === pointsSeason ? ' active' : ''}" onclick="setPointsSeason('${year}')">${year}</button>`).join('');
  const activeView = pointsViewMode || 'compact';
  el.innerHTML = `
    <div class="pt-shell">
      <div class="pts-v3-header pt-intel-head">
        <div>
          <div class="pts-v3-title"><span class="pts-v3-trophy">🏆</span> Points Table</div>
          <div class="pts-v3-league"><span class="pts-v3-league-dot"></span><span class="pts-v3-league-name">Tournament Intelligence · IPL ${esc(pointsSeason)}</span></div>
        </div>
        <div class="pt-head-stat"><span>${rows.filter(r => !r.eliminated).length}</span><small>alive</small></div>
      </div>
      <div class="pts-v3-seasons">${seasonPills}</div>
      <div class="pt-tabs">
        <button class="pt-tab${activeView === 'compact' ? ' active' : ''}" onclick="setPointsView('compact')">Compact</button>
        <button class="pt-tab${activeView === 'qualification' ? ' active' : ''}" onclick="setPointsView('qualification')">⟡ Qualification</button>
      </div>
      ${rows.length ? renderPointsView(rows, activeView) : `<div class="sc-empty" style="padding:28px">No data for this season.</div>`}
    </div>`;
}
function renderPointsView(rows, view) {
  if (view === 'qualification') return renderQualificationPointsView(rows);
  return renderCompactPointsView(rows);
}
function setPointsSeason(season) {
  pointsSeason = String(season);
  pointsExpandedRow = null;
  pointsDetailTabs = {};
  if (pointsData) renderPointsTable(pointsData);
}
function setPointsView(view) {
  pointsViewMode = view;
  pointsExpandedRow = null;
  if (pointsData) renderPointsTable(pointsData);
}
function togglePtsRow(i) {
  pointsExpandedRow = pointsExpandedRow === i ? null : i;
  if (pointsData) renderPointsTable(pointsData);
}
function setPtsDetailTab(i, tab, event) {
  if (event) event.stopPropagation();
  pointsDetailTabs[i] = tab;
  if (pointsData) renderPointsTable(pointsData);
}
function renderCompactPointsView(rows) {
  const colHead = `<div class="pt-compact-head"><span>#</span><span>TEAM</span><span>P</span><span>W</span><span>L</span><span>PTS</span><span>NRR</span><span></span></div>`;
  const rowsHtml = rows.map((row, i) => renderCompactPointRow(row, i)).join('');
  return `${colHead}<div class="pt-compact-list">${rowsHtml}</div><div class="pt-legend"><span><i class="pt-lg-playoff"></i>Playoff zone</span><span><i class="pt-lg-elim"></i>Eliminated</span></div>`;
}
function renderCompactPointRow(row, i) {
  const meta = teamMeta(row.team_short);
  const nrrColor = row.nrr > 0 ? '#4ADE80' : row.nrr < 0 ? '#F87171' : 'var(--t3)';
  const expanded = pointsExpandedRow === i;
  return `<div class="pt-row ${row.isTopFour ? 'playoff' : ''} ${row.eliminated ? 'eliminated' : ''} ${expanded ? 'expanded' : ''}" style="--team:${meta.color}" id="pts-row-${i}">
    <div class="pt-row-main" onclick="togglePtsRow(${i})">
      <span class="pt-rank">${row.rank}</span>
      <span class="pt-team-cell">${teamBadgePt(row.team_short)}<span><b>${esc(row.team_short)}</b><small>${esc(row.full)}</small></span></span>
      <span class="pt-cell">${row.played}</span><span class="pt-cell">${row.won}</span><span class="pt-cell">${row.lost}</span><span class="pt-pts">${row.points}</span>
      <span class="pt-nrr" style="color:${nrrColor}">${ptNrrText(row.nrr)}</span><span class="pt-chevron">▾</span>
    </div>
    ${expanded ? renderPointExpanded(row, i) : ''}
  </div>`;
}
function renderPointExpanded(row, i) {
  const tab = pointsDetailTabs[i] || 'overview';
  return `<div class="pt-expanded" onclick="event.stopPropagation()">
    <div class="pt-inner-tabs">
      ${['overview','fixtures'].map(t => `<button class="pt-inner-tab${tab === t ? ' active' : ''}" onclick="setPtsDetailTab(${i}, '${t}', event)">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}
    </div>
    ${tab === 'fixtures' ? renderExpandedFixtures(row) : renderExpandedOverview(row)}
  </div>`;
}
function ratioBar(a, b, color = '#4ADE80') {
  const total = Math.max(1, ptNum(a) + ptNum(b));
  const pct = ptClamp((ptNum(a) / total) * 100);
  return `<div class="pt-ratio"><span style="width:${pct}%;background:${color}"></span></div>`;
}
function renderExpandedOverview(row) {
  const mom = getMomentumConfig(row.momentum);
  const nrrColor = row.nrr >= 0 ? '#4ADE80' : '#F87171';
  return `<div class="pt-card-grid">
    <div class="pt-card"><div class="pt-card-label">Runs</div><div class="pt-vs"><b class="good">${row.runs_for.toLocaleString()}</b><span>vs</span><b class="bad">${row.runs_against.toLocaleString()}</b></div><div class="pt-subpair"><span>Scored</span><span>Conceded</span></div>${ratioBar(row.runs_for,row.runs_against)}</div>
    <div class="pt-card"><div class="pt-card-label">Wickets</div><div class="pt-vs"><b class="good">${row.wickets_taken}</b><span>vs</span><b class="bad">${row.wickets_lost}</b></div><div class="pt-subpair"><span>Taken</span><span>Lost</span></div>${ratioBar(row.wickets_taken,row.wickets_lost)}</div>
    <div class="pt-card"><div class="pt-card-label">Momentum</div><span class="pt-momentum" style="background:${mom.bg};color:${mom.color}">${mom.icon} ${mom.label}</span><div class="pt-streak">Streak: ${esc(row.streakType)}</div>${formPills(row.last5)}</div>
    <div class="pt-card"><div class="pt-card-label">NRR Trend</div><div class="pt-spark-wrap">${createSparkline(row.nrrTrend,nrrColor,80,28)}<div><b style="color:${nrrColor}">${ptNrrText(row.nrr)}</b><small>Current</small></div></div></div>
  </div>`;
}

function renderExpandedFixtures(row) {
  var code = row.team_short;
  var html = '<div class="pt-fixtures">';

  // Load schedule if not already — points tab preloads it
  if (!scheduleData && !scheduleLoaded) { loadSchedule(); }

  // Get all matches from schedule (53 finished) + lastData.finished as fallback
  var allMatches = [];
  if (scheduleData && scheduleData.matches) {
    allMatches = scheduleData.matches;
  } else if (lastData && lastData.finished) {
    allMatches = lastData.finished;
  }

  // Filter matches for this team
  var myResults = allMatches.filter(function(m) {
    return m.team1_short === code || m.team2_short === code;
  });

  // Previous results (finished matches)
  var prevResults = myResults.filter(function(m) { return m.status === 'finished' || m.status === 'completed'; });
  if (prevResults.length) {
    html += '<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Previous</div>';
    html += prevResults.map(function(m) {
      var isT1 = m.team1_short === code;
      var opp = isT1 ? m.team2_short : m.team1_short;
      // Detect winner from status_text (e.g. "RCB won by 6 wkts" or "beat RCB by 6 wkts")
      var wSt = m.status_text || m.result || '';
      var wLow = wSt.toLowerCase();
      var t1n = (m.team1 || '').toLowerCase();
      var t2n = (m.team2 || '').toLowerCase();
      var t1s = (m.team1_short || '').toLowerCase();
      var t2s = (m.team2_short || '').toLowerCase();
      var wonThis = wLow.indexOf(code.toLowerCase()) >= 0 && (wLow.indexOf('won') >= 0 || wLow.indexOf('beat') >= 0 || wLow.indexOf('defeated') >= 0);
      var lostThis = (!wonThis && wLow.indexOf('won') >= 0) || wLow.indexOf('lost') >= 0;
      var won = wonThis || (!lostThis && (wLow.indexOf(t1n) >= 0 || wLow.indexOf(t2n) >= 0) && wLow.indexOf('won') >= 0 && (
        (isT1 && wLow.indexOf(t1s) >= 0) || (!isT1 && wLow.indexOf(t2s) >= 0)
      ));
      var s1 = m.team1_score1 ? esc(m.team1_score1.display) : '';
      var s2 = m.team2_score1 ? esc(m.team2_score1.display) : '';
      var margin = m.status_text ? esc(m.status_text.replace(/^.*?(won|lost|tied)/i,'').trim()) : '';
      var wLabel = won ? 'Won' : 'Lost';
      return '<div class="pt-fixture-row" style="border-left:2px solid ' + (won ? '#22C55E' : '#F87171') + ';background:' + (won ? 'rgba(34,197,94,0.03)' : 'rgba(248,113,113,0.03)') + ';margin-bottom:3px;padding:7px 10px;border-radius:6px;display:flex;align-items:center;gap:8px">'
        + '<span style="background:' + (won ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)') + ';color:' + (won ? '#22C55E' : '#F87171') + ';padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800">' + (won ? 'W' : 'L') + '</span>'
        + '<span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);flex:1">' + esc(opp) + '</span>'
        + '<span style="font-size:9px;color:rgba(255,255,255,0.25)">' + (s1 ? s1 : '') + (s1 && s2 ? ' vs ' : '') + (s2 ? s2 : '') + '</span>'
        + '<span style="font-size:10px;font-weight:700;color:' + (won ? '#22C55E' : '#F87171') + '">' + wLabel + ' ' + margin + '</span>'
        + '</div>';
    }).join('');
  }




  // Upcoming fixtures — from live scheduleData or remainingFixtures fallback
  var upcomingCodes = [];
  if (scheduleData && scheduleData.matches) {
    upcomingCodes = scheduleData.matches.filter(function(m) {
      var st = String(m.status || '').toLowerCase();
      return (st === '' || st === 'upcoming' || st === 'scheduled') && (m.team1_short === code || m.team2_short === code);
    }).map(function(m) { return m.team1_short === code ? m.team2_short : m.team1_short; }).filter(Boolean);
  }
  if (!upcomingCodes.length && row.remainingFixtures && row.remainingFixtures.length) {
    upcomingCodes = row.remainingFixtures;
  }
  if (upcomingCodes.length) {
    html += '<div style="margin-top:10px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Upcoming</div>';
    html += upcomingCodes.map(function(c) { return renderFixtureRow(c); }).join('');
  }

  html += '</div>';
  return html;
}
function renderFixtureRow(code) {
  const rows = enrichPointsRows((pointsData?.tables?.[pointsSeason]?.rows) || []);
  const opp = rows.find(r => r.team_short === code);
  if (!opp) return `<div class="pt-fixture-row"><span class="pt-fixture-meta">Opponent TBD</span></div>`;
  return `<div class="pt-fixture-row">${teamBadgePt(opp.team_short,28)}<div><b>${esc(opp.full)}</b><small>Rank ${opp.rank} · ${opp.points} pts · ${ptNrrText(opp.nrr)}</small></div><div class="pt-fixture-form">${formPills(opp.last5.slice(-3))}</div></div>`;
}
function renderAdvancedPointsView(rows) {
  return `<div class="pt-advanced-list">${rows.map(row => { const meta=teamMeta(row.team_short); const mom=getMomentumConfig(row.momentum); const nrrColor=row.nrr>=0?'#4ADE80':'#F87171'; return `<div class="pt-adv-card ${row.isTopFour?'playoff':''} ${row.eliminated?'eliminated':''}" style="--team:${meta.color}"><div class="pt-adv-top"><span class="pt-rank">${row.rank}</span>${teamBadgePt(row.team_short,28)}<div class="pt-adv-team"><b>${esc(row.full)}</b><small>${row.won}W ${row.lost}L · ${row.played}P</small></div><div class="pt-adv-score"><b>${row.points}</b><span style="color:${nrrColor}">${ptNrrText(row.nrr)}</span></div></div><div class="pt-adv-bottom"><span>FORM</span>${formPills(row.last5)}<span class="pt-momentum" style="background:${mom.bg};color:${mom.color}">${mom.icon} ${mom.label}</span></div></div>`; }).join('')}</div>`;
}
function renderQualificationPointsView(rows) {
  const intensity = raceIntensity(rows);
  const fourth = rows[3] ? rows[3].points || 0 : 0;
  const within = rows.filter(function(r) { return Math.abs(r.points - fourth) <= 4; }).length;
  const avgLeft = rows.length ? Math.round(rows.reduce(function(s,r) { return s + r.remaining; }, 0) / rows.length) : 0;
  return '<div class="pt-race"><div class="race-banner"><div><span>Playoff Race Intensity</span><b>' + Math.round(intensity) + '%</b></div><div class="race-bar"><i style="width:' + intensity + '%"></i></div><p>' + within + ' teams within 4 pts for 4 spots · ' + avgLeft + ' matches left avg.</p></div>' + rows.map(function(row) { return renderRaceCard(row); }).join('') + '</div>';
}

function raceIntensity(rows) {
  if (!rows.length) return 0;
  const fourth = rows[3]?.points || 0;
  const within = rows.filter(r => Math.abs(r.points - fourth) <= 4).length;
  const avgRemaining = rows.reduce((s,r)=>s+r.remaining,0)/rows.length;
  return ptClamp((within / rows.length) * 72 + avgRemaining * 3);
}

function renderRaceCard(row) {
  const qColor = getQualColor(row.qualProb), pColor = getPressureColor(row.pressureIndex), dColor = getDifficultyColor(row.remainingDifficulty);
  return `<div class="pt-race-card ${row.eliminated?'eliminated':''}" style="--race:${qColor}"><div class="pt-race-top"><div class="pt-race-team"><span class="pt-rank">${row.rank}</span>${teamBadgePt(row.team_short,28)}<div><b>${esc(row.full)}</b><small>${row.points} pts · ${row.remaining} left</small></div></div>${createQualRing(row.qualProb,40,true)}</div><div class="pt-race-bottom"><div><small>Pressure</small><div class="pt-pressure"><span style="width:${row.pressureIndex}%;background:${pColor}"></span></div></div><i></i><div><small>NRR</small>${createSparkline(row.nrrTrend,row.nrr>=0?'#4ADE80':'#F87171',48,18)}</div><i></i><div><small>Sched.</small><b style="color:${dColor}">${getDifficultyLabel(row.remainingDifficulty)}</b></div></div></div>`;
}
function renderPointsRows(rows) { return renderCompactPointsView(enrichPointsRows(rows)); }

// ================================================================
// SCHEDULE / HISTORY
// ================================================================

// ══════════════════════════════════════════════════════════════
// SCHEDULE — redesigned with tournament progress, playoff tabs, standings
// ══════════════════════════════════════════════════════════════

// ── Schedule filter tabs state ──
let scheduleFilterMode = 'all'; // 'all' | 'next2' | 'playoff'

function setScheduleFilter(mode) {
  scheduleFilterMode = mode;
  if (scheduleData) renderSchedule(scheduleData);
}

function scheduleMatchRow(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const isLive     = m.status === 'live';
  const isFinished = m.status === 'finished';
  const stakes = matchStakes(m);
  const rowA = standingForTeam(m.team1_short);
  const rowB = standingForTeam(m.team2_short);
  const hasPlayoffStakes = stakes.tone === 'danger' || stakes.tone === 'warn';

  // Format time
  let timeDisplay = m.start_time || 'TBD';
  if (m.start_epoch && !isFinished) {
    timeDisplay = new Date(m.start_epoch).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  }

  const matchJson = encodeURIComponent(JSON.stringify({
    id: m.id, team1: m.team1, team2: m.team2,
    team1_short: m.team1_short, team2_short: m.team2_short,
    series: m.series || 'IPL 2026', match_desc: m.match_desc,
    status: m.status, status_text: m.status_text, venue: m.venue,
  }));

  // Winner detection
  let t1Win = false, t2Win = false;
  if (isFinished && m.status_text) {
    const st = m.status_text.toLowerCase();
    if ([m.team1, m.team1_short].some(s => s && st.startsWith(s.toLowerCase()))) t1Win = true;
    else if ([m.team2, m.team2_short].some(s => s && st.startsWith(s.toLowerCase()))) t2Win = true;
  }

  const t1Stand = rowA ? `#${rowA.rank}` : '';
  const t1Pts = rowA ? `${rowA.points}pts` : '';
  const t1Form = rowA ? rowA.last_5 : [];
  const t2Stand = rowB ? `#${rowB.rank}` : '';
  const t2Pts = rowB ? `${rowB.points}pts` : '';
  const t2Form = rowB ? rowB.last_5 : [];

  return `
    <div class="sch-match-card${hasPlayoffStakes ? ' sch-match-card--stakes' : ''}"
         onclick='openScheduleScorecard(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <!-- Card header: match number + playoff impact badge + time -->
      <div class="sch-card-head">
        <span class="sch-card-meta">${esc(m.match_desc || '')} ${m.venue ? '· ' + esc(m.venue.split(',')[0]) : ''}</span>
        <div class="sch-card-head-right">
          ${hasPlayoffStakes ? `<span class="sch-badge-playoff" style="color:#f97316;background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.2)">★ Playoff Impact</span>` : ''}
          ${isFinished
            ? `<span class="sch-card-time sch-card-time--done">Result</span>`
            : isLive
              ? `<span class="sch-card-time sch-card-time--live"><span class="pulse-dot"></span>Live</span>`
              : `<span class="sch-card-time">${esc(timeDisplay)}</span>`
          }
        </div>
      </div>
      <!-- Teams row -->
      <div class="sch-card-teams">
        <div class="sch-card-team${t1Win ? ' sch-card-team--win' : ''}">
          ${teamBadge(m.team1_short, 42)}
          <div class="sch-card-team-info">
            <div class="sch-card-team-name">${esc(m.team1_short)}</div>
            ${t1Stand && t1Pts ? `<div class="sch-card-team-stand">${t1Stand} · ${t1Pts}</div>` : ''}
          </div>
          <div class="sch-card-team-form">${t1Form.length ? formPills(t1Form.slice(-3)) : ''}</div>
          ${isFinished && m.team1_score1 ? `<div class="sch-card-score${t1Win ? ' sch-card-score--win' : ''}">${esc(m.team1_score1.display)}<span class="sch-card-score-ov">${esc(m.team1_score1.detail)}</span></div>` : ''}
        </div>
        <div class="sch-card-vs"><span>VS</span></div>
        <div class="sch-card-team sch-card-team--right${t2Win ? ' sch-card-team--win' : ''}">
          ${isFinished && m.team2_score1 ? `<div class="sch-card-score${t2Win ? ' sch-card-score--win' : ''}">${esc(m.team2_score1.display)}<span class="sch-card-score-ov">${esc(m.team2_score1.detail)}</span></div>` : ''}
          <div class="sch-card-team-form sch-card-team-form--right">${t2Form.length ? formPills(t2Form.slice(-3)) : ''}</div>
          <div class="sch-card-team-info sch-card-team-info--right">
            <div class="sch-card-team-name">${esc(m.team2_short)}</div>
            ${t2Stand && t2Pts ? `<div class="sch-card-team-stand">${t2Stand} · ${t2Pts}</div>` : ''}
          </div>
          ${teamBadge(m.team2_short, 42)}
        </div>
      </div>
      <!-- Footer: venue + stakes -->
      <div class="sch-card-foot">
        <span class="sch-card-venue">📍 ${esc(m.venue || 'Venue TBD')}</span>
        ${isFinished && m.status_text ? `<span class="sch-card-result">${esc(m.status_text)}</span>` : ''}
        ${!isFinished && stakes.headline ? `<span class="sch-card-stakes">★ ${esc(stakes.headline)}</span>` : ''}
      </div>
    </div>`;
}

function renderScheduleProgress() {
  let doneMatches = 0, totalMatches = 74;
  try {
    const src = ((pointsData?.tables?.[pointsSeason])?.source_note) || '';
    const m = src.match(/Match (\d+)\s+of\s+(\d+)/i);
    if (m) { doneMatches = Number(m[1]); totalMatches = Number(m[2]); }
  } catch(_) {}
  const remain = totalMatches - doneMatches;
  const pct = totalMatches > 0 ? Math.round(doneMatches / totalMatches * 100) : 0;

  // Count playoff-stakes matches in schedule
  const matches = scheduleData?.matches || [];
  const stakeMatches = matches.filter(m => {
    const a = standingForTeam(m.team1_short);
    const b = standingForTeam(m.team2_short);
    if (!a || !b) return false;
    const qa = qualificationBand(a);
    const qb = qualificationBand(b);
    return (qa?.tone === 'danger' || qb?.tone === 'danger' ||
            (a.rank <= 4 && b.rank <= 4) ||
            (Math.abs(a.rank - b.rank) <= 2 && Math.abs((a.points||0) - (b.points||0)) <= 4));
  }).length;

  return `
    <!-- Page title -->
    <div class="sch-title-block">
      <h1>IPL 2026 — Schedule</h1>
      <p>${remain} matches remaining${stakeMatches > 0 ? ' · <strong>' + stakeMatches + ' with playoff stakes</strong>' : ''}</p>
    </div>

    <!-- Tournament Progress -->
    <div class="sch-progress-card">
      <div class="sch-progress-head">
        <span class="sch-progress-label">Tournament Progress</span>
        <span class="sch-progress-count"><strong>Match ${doneMatches}</strong> of ${totalMatches}</span>
      </div>
      <div class="sch-progress-bar"><div class="sch-progress-fill" style="width:${pct}%"></div></div>
      <div class="sch-progress-labels">
        <span>League stage</span>
        <span class="sch-progress-playoffs">Playoffs — May 20</span>
      </div>
    </div>`;
}

function scheduleFilterBar() {
  const tabs = [
    { id: 'all', label: 'All Matches' },
    { id: 'next2', label: 'Next 2 Days' },
    { id: 'playoff', label: '★ Playoff Stakes' },
  ];
  return `<div class="sch-filter-bar">${tabs.map(t => `<button class="sch-filter-btn${scheduleFilterMode === t.id ? ' is-active' : ''}" onclick="setScheduleFilter('${t.id}')">${t.label}</button>`).join('')}</div>`;
}

function renderSchedule(data) {
  scheduleData = data;
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = 'IPL 2026 — Schedule';
  const controls = $('archiveControls');
  if (controls) controls.style.display = 'none';

  const matches = (data.matches || []);
  if (!matches.length) {
    $('scheduleList').innerHTML = '<div class="sc-empty">No schedule data available.</div>';
    return;
  }

  // Sort: upcoming/live first by epoch, then finished by epoch desc
  const upcoming = matches.filter(m => m.status !== 'finished')
    .sort((a, b) => (a.start_epoch || 0) - (b.start_epoch || 0));
  const finished = matches.filter(m => m.status === 'finished')
    .sort((a, b) => (b.start_epoch || 0) - (a.start_epoch || 0));
  const sorted = [...upcoming, ...finished];

  // Apply filter
  let filtered = sorted;
  const now = Date.now();
  if (scheduleFilterMode === 'next2') {
    const end2 = now + 1722000000; // 48 hours
    filtered = sorted.filter(m => {
      if (m.status === 'finished') return false;
      return (m.start_epoch || 0) >= now && (m.start_epoch || 0) <= end2;
    });
  } else if (scheduleFilterMode === 'playoff') {
    filtered = sorted.filter(m => {
      const a = standingForTeam(m.team1_short);
      const b = standingForTeam(m.team2_short);
      if (!a || !b) return false;
      const qa = qualificationBand(a);
      const qb = qualificationBand(b);
      return (qa?.tone === 'danger' || qb?.tone === 'danger' ||
              (a.rank <= 4 && b.rank <= 4) ||
              (Math.abs(a.rank - b.rank) <= 2 && Math.abs((a.points||0) - (b.points||0)) <= 4));
    });
  }

  // Group by date with formatted headers
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const byDate = new Map();
  for (const m of filtered) {
    let dateKey = 'TBD';
    let label = '';
    if (m.start_epoch) {
      const d = new Date(m.start_epoch);
      const dStart = new Date(d); dStart.setHours(0,0,0,0);
      const time = dStart.getTime();
      if (Math.abs(time - today.getTime()) < 86400000) { label = 'Today'; dateKey = 'today'; }
      else if (Math.abs(time - tomorrow.getTime()) < 86400000) { label = 'Tomorrow'; dateKey = 'tomorrow'; }
      else { label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(); dateKey = label; }
    }
    if (!byDate.has(dateKey)) byDate.set(dateKey, { label, isToday: label==='Today', isTomorrow: label==='Tomorrow', matches: [] });
    byDate.get(dateKey).matches.push(m);
  }

  // Build HTML: progress + filter bar + date groups
  let html = renderScheduleProgress() + scheduleFilterBar();
  for (const [key, group] of byDate) {
    const isPlayoffStage = !group.isToday && !group.isTomorrow && (group.label || '').startsWith('MAY 2');
    html += `<div class="sch-date-group">
      <div class="sch-date-header-wrap">
        <div class="sch-date-header-left">
          ${group.isToday ? `<span class="sch-date-pill sch-date-pill--today">TODAY</span>` : ''}
          ${group.isTomorrow ? `<span class="sch-date-pill sch-date-pill--tomorrow">TOMORROW</span>` : ''}
          <span class="sch-date-label" style="color:${group.isToday ? '#CBD5E1' : 'rgba(255,255,255,.35)'}">${esc(group.label.replace(/_/g,' '))}</span>
        </div>
        <div class="sch-date-header-right">
          <span class="sch-date-divider"></span>
          <span class="sch-date-count">${group.matches.length} match${group.matches.length > 1 ? 'es' : ''}</span>
        </div>
      </div>
      <div class="sch-date-cards">
        ${group.matches.map(scheduleMatchRow).join('')}
      </div>
    </div>`;
  }

  if (!filtered.length) {
    html = renderScheduleProgress() + scheduleFilterBar() + '<div class="sc-empty" style="margin-top:16px">No matches in this view.</div>';
  }

  // Add playoff structure teaser at the bottom
  html += `<div class="sch-playoff-teaser">
    <div class="sch-playoff-teaser-head">Playoff Structure</div>
    <div class="sch-playoff-teaser-list">
      ${[
        { label:'Qualifier 1', desc:'#1 vs #2 · Winner → Final', date:'May 20', color:'#22C55E' },
        { label:'Eliminator', desc:'#3 vs #4 · Loser eliminated', date:'May 21', color:'#EF4444' },
        { label:'Qualifier 2', desc:'Q1 Loser vs EL Winner', date:'May 23', color:'#F97316' },
        { label:'Final', desc:'Champion crowned', date:'May 25', color:'#FACC15' },
      ].map(s => `<div class="sch-playoff-row"><span class="sch-playoff-dot" style="background:${s.color}"></span><span class="sch-playoff-name">${esc(s.label)}</span><span class="sch-playoff-desc">${esc(s.desc)}</span><span class="sch-playoff-date">${esc(s.date)}</span></div>`).join('')}
    </div>
  </div>`;

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
    // Re-render points table if active so fixtures tab gets fresh schedule data
    // Preserve expanded row so user doesn't lose their place
    if (currentFilter === 'points' && pointsData) {
      var savedRow = pointsExpandedRow;
      var savedTabs = Object.assign({}, pointsDetailTabs);
      renderPointsTable(pointsData);
      pointsExpandedRow = savedRow;
      pointsDetailTabs = savedTabs;
    }
  } catch (err) {
    $('scheduleList').innerHTML = `<div class="sc-empty">Error: ${esc(err.message)}</div>`;
    scheduleLoaded = false; // allow retry
  }
}


const ARCHIVE_TEAM_COLORS = {
  SRH:'#F97316', GT:'#1D4B6E', RCB:'#DC2626', PBKS:'#E11D48',
  RR:'#EC4899', CSK:'#FACC15', DC:'#3B82F6', KKR:'#7C3AED',
  LSG:'#06B6D4', MI:'#1E40AF', DD:'#1D4ED8', KXIP:'#E11D48',
  RPS:'#F59E0B', GL:'#EA580C', PWI:'#16A34A', DCH:'#0891B2', SH:'#0891B2'
};
const IPL_CHAMPIONS = {
  2008:'RR', 2009:'DCH', 2010:'CSK', 2011:'CSK', 2012:'KKR',
  2013:'MI', 2014:'KKR', 2015:'MI', 2016:'SRH', 2017:'MI',
  2018:'CSK', 2019:'MI', 2020:'MI', 2021:'CSK', 2022:'GT',
  2023:'CSK', 2024:'KKR', 2025:'RCB'
};
const KNOCKOUT_ROUNDS = ['Final', 'Qualifier 1', 'Qualifier 2', 'Eliminator'];
const ARCHIVE_TEAMS = ['CSK','MI','RCB','KKR','RR','SRH','GT','PBKS','DC','LSG'];
const ARCHIVE_ROUNDS = ['All','Final','Qualifier 1','Qualifier 2','Eliminator','League'];

function archiveTeamColor(code, fallback = 'rgba(255,255,255,0.2)') {
  return ARCHIVE_TEAM_COLORS[code] || fallback;
}

function createArchiveTeamBadge(code, size = 32) {
  const color = archiveTeamColor(code);
  const fontSize = Math.max(6, Math.floor(size * 0.19));
  const radius = Math.floor(size * 0.22);
  return `<div class="archive-team-badge" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${color}18;border:1px solid ${color}30;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:${color};letter-spacing:.04em;flex-shrink:0">${esc(code || '—')}</div>`;
}

function archiveTeamShort(match, teamName) {
  if (teamName === match.team1) return match.team1_short;
  if (teamName === match.team2) return match.team2_short;
  return teamName;
}

function archiveWinnerShort(match) {
  return archiveTeamShort(match, match.winner) || match.winner || '';
}

function normalizeArchiveRound(round) {
  if (round === 'Elimination Final') return 'Eliminator';
  if (round === 'Semi Final') return 'Qualifier 2';
  return KNOCKOUT_ROUNDS.includes(round) ? round : 'League';
}

function archiveCity(match) {
  const venue = match.venue || '';
  const parts = venue.split(',').map(x => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '');
}

function archiveScoreFor(match, teamName) {
  return (match.innings || []).find(inn => inn.team === teamName) || null;
}

function archiveResultMargin(match) {
  const text = match.result_text || '';
  const m = text.match(/won by\s+(.+)$/i);
  return m ? m[1] : text;
}

function archiveIsCloseOrSuper(match) {
  const text = (match.result_text || '').toLowerCase();
  if (text.includes('super over')) return true;
  const runs = text.match(/(\d+)\s+runs?/);
  const wkts = text.match(/(\d+)\s+(?:wickets?|wkts?)/);
  return (runs && Number(runs[1]) <= 5) || (wkts && Number(wkts[1]) <= 1);
}

function archiveIsNotable(match, seasonMatches = []) {
  const round = normalizeArchiveRound(match.round);
  if (KNOCKOUT_ROUNDS.includes(round) || archiveIsCloseOrSuper(match)) return true;
  if (!seasonMatches.length) return false;
  const sorted = [...seasonMatches].sort((a,b) => (a.match_number || 0) - (b.match_number || 0));
  return match.id === sorted[0]?.id || match.id === sorted[sorted.length - 1]?.id;
}

function archiveRoundBadge(round) {
  const r = normalizeArchiveRound(round);
  const map = {
    Final: ['#FACC15', 'rgba(250,204,21,.1)'],
    'Qualifier 1': ['#22C55E', 'rgba(34,197,94,.1)'],
    'Qualifier 2': ['#F97316', 'rgba(249,115,22,.1)'],
    Eliminator: ['#EF4444', 'rgba(239,68,68,.1)'],
    League: ['rgba(255,255,255,.35)', 'rgba(255,255,255,.05)']
  };
  const [color, bg] = map[r] || map.League;
  return `<span class="archive-round-badge" style="color:${color};background:${bg}">${esc(r)}</span>`;
}

function archiveSurname(name = '') {
  return String(name).trim().split(/\s+/).pop() || name;
}

function filterArchiveMatches(matches, filters) {
  return (matches || []).filter(m => {
    const y = String(m.season || m.year || '');
    const t1 = m.team1_short || archiveTeamShort(m, m.team1);
    const t2 = m.team2_short || archiveTeamShort(m, m.team2);
    const r = normalizeArchiveRound(m.round);
    if (filters.year !== 'All' && y !== filters.year) return false;
    if (filters.team !== 'All' && t1 !== filters.team && t2 !== filters.team) return false;
    if (filters.round !== 'All') {
      if (filters.round === 'League' && KNOCKOUT_ROUNDS.includes(r)) return false;
      if (filters.round !== 'League' && r !== filters.round) return false;
    }
    const q = (filters.search || '').trim().toLowerCase();
    if (q) {
      const fields = [t1, t2, m.team1, m.team2, archiveCity(m), m.venue, m.winner, m.result_text, m.potm || ''];
      if (!fields.some(f => String(f || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

function renderArchiveTitle(data) {
  const years = data.years || [];
  const minYear = years.length ? Math.min(...years) : 2008;
  const maxYear = years.length ? Math.max(...years) : 2026;
  return `<div class="archive-title-block"><h1 class="archive-heading">IPL Archive</h1><p class="archive-sub">${minYear} – ${maxYear} · ${(data.matches || []).length.toLocaleString('en-IN')} matches · ${years.length} seasons</p></div>`;
}

function renderChampionsStrip() {
  const chips = [2025,2024,2023,2022,2021,2020,2019,2018].map(year => {
    const champ = IPL_CHAMPIONS[year];
    if (!champ) return '';
    const color = archiveTeamColor(champ);
    return `<button class="champion-chip" onclick="setArchiveChampionFilter('${year}')">${createArchiveTeamBadge(champ, 24)}<span class="champion-chip-year" style="color:${color}">${year}</span></button>`;
  }).join('');
  return `<div class="champions-strip"><div class="champions-strip-label">Recent champions</div><div class="champions-scroll">${chips}</div></div>`;
}

function renderArchiveViewToggle() {
  return `<div class="archive-view-toggle"><button class="archive-view-btn ${archiveViewMode === 'matches' ? 'active' : ''}" onclick="setArchiveViewMode('matches')">📋 Matches</button><button class="archive-view-btn ${archiveViewMode === 'stats' ? 'active' : ''}" onclick="setArchiveViewMode('stats')">📊 Team Stats</button></div>`;
}

function renderArchiveFilterControls(data, visibleCount) {
  const years = ['All'].concat([...(data.years || [])].sort((a,b) => b - a).map(String));
  const yearOptions = years.map(y => `<option value="${esc(y)}" ${archiveFilters.year === y ? 'selected' : ''}>${esc(y)}</option>`).join('');
  const teamOptions = ['All', ...ARCHIVE_TEAMS].map(t => `<option value="${esc(t)}" ${archiveFilters.team === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const roundOptions = ARCHIVE_ROUNDS.map(r => `<option value="${esc(r)}" ${archiveFilters.round === r ? 'selected' : ''}>${esc(r)}</option>`).join('');
  const chips = [];
  if (archiveFilters.year !== 'All') chips.push(`<span class="archive-active-chip">${esc(archiveFilters.year)}</span>`);
  if (archiveFilters.team !== 'All') chips.push(`<span class="archive-active-chip">${esc(archiveFilters.team)}</span>`);
  if (archiveFilters.round !== 'All') chips.push(`<span class="archive-active-chip">${esc(archiveFilters.round)}</span>`);
  if ((archiveFilters.search || '').trim()) chips.push(`<span class="archive-active-chip">Search: ${esc(archiveFilters.search)}</span>`);
  const hasActive = chips.length > 0;
  return `
    <div class="archive-content">
      <div class="archive-search-wrap"><span class="archive-search-icon">⌕</span><input class="archive-search-input" value="${esc(archiveFilters.search || '')}" oninput="onArchiveFilterChange('search', this.value)" placeholder="Search team, city, venue, result…"></div>
      <div class="archive-filter-grid">
        <label class="archive-filter-item"><span class="archive-filter-label">Year</span><select class="archive-filter-select" onchange="onArchiveFilterChange('year', this.value)">${yearOptions}</select></label>
        <label class="archive-filter-item"><span class="archive-filter-label">Team</span><select class="archive-filter-select" onchange="onArchiveFilterChange('team', this.value)">${teamOptions}</select></label>
        <label class="archive-filter-item"><span class="archive-filter-label">Round</span><select class="archive-filter-select" onchange="onArchiveFilterChange('round', this.value)">${roundOptions}</select></label>
      </div>
      <div class="archive-filter-meta"><div>${chips.join('')}${hasActive ? `<button class="archive-clear-btn" onclick="clearArchiveFilters()">Clear all</button>` : ''}</div><span class="archive-match-count">${visibleCount} matches</span></div>
    </div>`;
}

function renderArchiveYearHeader(year, count) {
  const champ = IPL_CHAMPIONS[year];
  const color = champ ? archiveTeamColor(champ) : '';
  return `<div class="archive-year-header"><span class="archive-year-num">${esc(year)}</span>${champ ? `<div class="archive-year-champ">${createArchiveTeamBadge(champ, 20)}<span class="archive-year-champ-label" style="color:${color}">Champions</span></div>` : ''}<span class="archive-year-divider"></span><span class="archive-year-count">${count} matches</span></div>`;
}

function archiveMatchCard(match, seasonMatches = []) {
  const t1 = match.team1_short || archiveTeamShort(match, match.team1);
  const t2 = match.team2_short || archiveTeamShort(match, match.team2);
  const winner = archiveWinnerShort(match);
  const winnerColor = archiveTeamColor(winner, match.team1_color || match.team2_color || '#818cf8');
  const t1Inn = archiveScoreFor(match, match.team1);
  const t2Inn = archiveScoreFor(match, match.team2);
  const t1W = winner === t1;
  const t2W = winner === t2;
  const round = normalizeArchiveRound(match.round);
  const city = archiveCity(match);
  const notable = archiveIsNotable(match, seasonMatches);
  const matchJson = encodeURIComponent(JSON.stringify(match));
  const result = archiveResultMargin(match);
  const scoreBlock = (code, team, inn, isWinner, right = false) => `
    <div class="archive-team-block ${right ? 'right' : ''}">
      ${createArchiveTeamBadge(code, 34)}
      <div style="${right ? 'text-align:right' : ''}">
        <div style="display:flex;align-items:center;gap:4px;${right ? 'justify-content:flex-end' : ''}">${isWinner && !right ? `<span class="archive-winner-tick">✓</span>` : ''}<span class="archive-team-name ${isWinner ? 'is-winner' : ''}">${esc(code)}</span>${isWinner && right ? `<span class="archive-winner-tick">✓</span>` : ''}</div>
        <div><span class="archive-team-score ${isWinner ? 'is-winner' : ''}">${esc(inn?.display || '—')}</span>${inn?.detail ? `<span class="archive-team-overs"> ${esc(inn.detail)}</span>` : ''}</div>
      </div>
    </div>`;
  return `
    <article class="archive-match-card ${round === 'Final' ? 'is-final' : ''}" onclick="openArchiveScoreboard(this)" data-match="${matchJson}">
      <div class="archive-match-stripe" style="background:linear-gradient(90deg,${winnerColor}66,${winnerColor}22,transparent)"></div>
      <div class="archive-match-inner">
        <div class="archive-match-meta"><div class="archive-meta-left">${archiveRoundBadge(round)}${city ? `<span class="archive-match-city">${esc(city)}</span>` : ''}${notable ? `<span class="archive-classic-badge">Classic</span>` : ''}</div><span class="archive-match-date">${esc(match.date || '')}</span></div>
        <div class="archive-score-row">${scoreBlock(t1, match.team1, t1Inn, t1W)}<span class="archive-vs-divider">VS</span>${scoreBlock(t2, match.team2, t2Inn, t2W, true)}</div>
        <div class="archive-card-footer"><div class="archive-result-text"><span style="width:2px;height:2px;border-radius:50%;background:${winnerColor};display:inline-block"></span><span>${esc(archiveSurname(match.winner || winner))} won by <b class="archive-result-margin">${esc(result)}</b></span></div>${match.potm ? `<div class="archive-potm"><span class="archive-potm-star">★</span><span class="archive-potm-name">${esc(archiveSurname(match.potm))}</span>${match.potmStat ? `<span class="archive-potm-stat">${esc(match.potmStat)}</span>` : ''}</div>` : ''}</div>
      </div>
    </article>`;
}

function renderArchiveMatchesView(data, matches) {
  if (!matches.length) return `<div class="archive-empty"><div class="archive-empty-icon">🏏</div><div class="archive-empty-title">No matches found</div><div class="archive-empty-sub">Try clearing filters or searching another team.</div></div>`;
  const byYear = new Map();
  for (const match of matches) {
    const year = String(match.season);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(match);
  }
  return Array.from(byYear.entries()).sort((a,b) => Number(b[0]) - Number(a[0])).map(([year, yearMatches]) => {
    const sorted = [...yearMatches].sort((a,b) => (b.match_number || 0) - (a.match_number || 0));
    return `<section class="archive-year-group">${renderArchiveYearHeader(year, sorted.length)}<div class="archive-match-stack">${sorted.map(m => archiveMatchCard(m, sorted)).join('')}</div></section>`;
  }).join('');
}

function renderArchiveStatsView(data) {
  const wins = new Map();
  for (const match of data.matches || []) {
    const code = archiveWinnerShort(match);
    if (code) wins.set(code, (wins.get(code) || 0) + 1);
  }
  const rows = Array.from(wins.entries()).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const max = rows[0]?.[1] || 1;
  const winRows = rows.map(([code, val]) => {
    const color = archiveTeamColor(code);
    return `<div class="archive-stat-row"><div class="archive-stat-meta"><span class="archive-stat-label">${esc(code)}</span><span class="archive-stat-val">${val}</span></div><div class="archive-stat-track"><div class="archive-stat-fill" style="width:${Math.round(val / max * 100)}%;background:${color}"></div></div></div>`;
  }).join('');
  return `<div class="archive-content"><div class="archive-stats-card"><div class="archive-stats-title">All-time wins</div>${winRows}</div><div class="archive-trivia-grid"><div class="archive-trivia-tile"><div class="archive-trivia-label">Most titles</div><div class="archive-trivia-val" style="color:#1E40AF">MI (5)</div></div><div class="archive-trivia-tile"><div class="archive-trivia-label">Highest score</div><div class="archive-trivia-val" style="color:#DC2626">287/2 (RCB)</div></div><div class="archive-trivia-tile"><div class="archive-trivia-label">Finals played</div><div class="archive-trivia-val" style="color:#FACC15">${(data.years || []).length} seasons</div></div><div class="archive-trivia-tile"><div class="archive-trivia-label">Closest final</div><div class="archive-trivia-val" style="color:#4ADE80">MI won by 1 run</div></div></div></div>`;
}

function renderArchive(data) {
  archiveData = data;
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = 'IPL Archive';
  const matches = filterArchiveMatches(data.matches || [], archiveFilters);
  const controls = $('archiveControls');
  if (controls) {
    controls.style.display = '';
    controls.innerHTML = renderArchiveTitle(data) + renderChampionsStrip() + renderArchiveViewToggle() + (archiveViewMode === 'matches' ? renderArchiveFilterControls(data, matches.length) : '');
  }
  $('scheduleList').innerHTML = archiveViewMode === 'stats'
    ? renderArchiveStatsView(data)
    : `<div class="archive-content">${renderArchiveMatchesView(data, matches)}</div>`;
}

function setArchiveViewMode(mode) {
  archiveViewMode = mode === 'stats' ? 'stats' : 'matches';
  if (archiveData) renderArchive(archiveData);
}

function setArchiveChampionFilter(year) {
  archiveViewMode = 'matches';
  archiveFilters = { ...archiveFilters, year: String(year), round: 'Final' };
  if (archiveData) renderArchive(archiveData);
}

function clearArchiveFilters() {
  archiveFilters = { year: 'All', team: 'All', round: 'All', search: '' };
  if (archiveData) renderArchive(archiveData);
}

function onArchiveFilterChange(key, value) {
  archiveFilters = { ...archiveFilters, [key]: value };
  if (archiveData) renderArchive(archiveData);
}

async function loadArchive() {
  archiveLoaded = true;
  const heading = $('scheduleHeading');
  if (heading) heading.textContent = 'IPL Archive';
  const controls = $('archiveControls');
  if (controls) {
    controls.style.display = 'none';
    controls.innerHTML = '';
  }
  $('scheduleList').innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>Loading archive…</span></div>`;
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
  drawerComparisonMode = 'over';

  $('drawerTeams').textContent = `${match.team1} vs ${match.team2}`;
  $('drawerMeta').textContent = `${match.season} · ${match.round}${match.match_number ? ' · Match ' + match.match_number : ''}`;
  $('drawerLiveBar').style.display = 'none';
  $('drawerBody').innerHTML = `<div class="sc-loading"><div class="sc-spin"></div><span>Loading archive scorecard...</span></div>`;
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
    $('drawerBody').innerHTML = `${renderArchiveScoreboard(match)}<div class="sc-empty archive-scorecard-fallback">Full scorecard is not available yet.<br><span style="font-size:12px;color:var(--t4)">Showing the match summary instead. ${esc(err.message)}</span></div>`;
  }
}

function renderArchiveScoreboard(match) {
  const innings = (match.innings || []).map(inn => `
    <div class="archive-drawer-innings">
      <div><div class="innings-team">${esc(inn.team)}</div><div style="display:flex;align-items:center;gap:8px;margin-top:2px"><span class="innings-overs">${esc(inn.detail)}</span>${inn.target ? `<span class="innings-rr">Target ${esc(String(inn.target))}</span>` : ''}</div></div>
      <span class="innings-score-line">${esc(inn.display)}</span>
    </div>`).join('');
  return `<div class="archive-drawer"><div class="archive-drawer-meta"><span>${esc(match.date)}</span>${match.venue ? `<span>${esc(match.venue)}</span>` : ''}</div>${innings}<div class="archive-drawer-result">${esc(match.result_text)}</div></div>`;
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
  drawerComparisonMode = 'over';

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
  }, 8_000);
}

function stopScRefresh() {
  if (scRefreshTimer) { clearInterval(scRefreshTimer); scRefreshTimer = null; }
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Theme restored before first paint via inline <script> in <head>.
  // Just ensure the icon matches on DOMContentLoaded.
  const saved = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(saved);
  // Load asset manifest (team logos + player images) then render
  loadAssetManifest().finally(() => {
    // Pre-load points table so match cards render with ranks/form/stakes on first pass
    loadPointsIntel();
    // Generate Crickly-style date tabs
    generateDateTabs();
    loadMatches(false);
    // Auto-refresh match list every 15 seconds when drawer is closed
    setInterval(() => { if (!drawerOpen) loadMatches(false); }, 20000);
  });
});
