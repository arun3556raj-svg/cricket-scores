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
const TEAM_LOGO_EXT = { MI: 'jpg' };

// ── Inline-style team badge with real logo image + text fallback ──
function teamBadge(short, size = 44) {
  const t = teamMeta(short);
  const r = Math.round(size * 0.28);
  const fs = Math.round(size * 0.32);
  const ext = TEAM_LOGO_EXT[short] || 'webp';
  const logoSrc = joinPath(STATIC_BASE_PATH, `team-logos/${short}.${ext}`);

  // padding: 4% for larger badges, 8% for small ones — keeps logo prominent
  const pad = size >= 60 ? Math.round(size * 0.04) : size >= 40 ? Math.round(size * 0.06) : Math.round(size * 0.08);
  return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:linear-gradient(135deg,${t.color},${t.color2 || t.color + '88'});display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 20px ${t.color}35;overflow:hidden;padding:${pad}px;box-sizing:border-box">
    <img src="${logoSrc}" alt="${esc(short)}" style="width:100%;height:100%;object-fit:contain"
         onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <span style="display:none;font-size:${fs}px;font-weight:800;color:#fff;letter-spacing:-0.5px">${esc(short)}</span>
  </div>`;
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
  let battersHtml = '', bowlersHtml = '', winProbHtml = '';

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

  const panelsHtml = (battersHtml || bowlersHtml) ? `
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
    <article style="background:${bgGrad};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;position:relative;cursor:pointer"
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
function liveCardCK(m) {
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const isLive   = m.status === 'live';
  const isResult = m.status === 'finished';

  let t1Winner = false, t2Winner = false;
  if (isResult && m.status_text) {
    const st = m.status_text.toLowerCase();
    if ([m.team1, m.team1_short].filter(Boolean).some(s => st.startsWith(s.toLowerCase()))) t1Winner = true;
    else if ([m.team2, m.team2_short].filter(Boolean).some(s => st.startsWith(s.toLowerCase()))) t2Winner = true;
  }

  const matchLabel = esc(m.match_desc || m.series || '');
  const statusText = esc(m.status_text || (isLive ? 'Live' : ''));
  const statusColor = isResult ? 'rgba(255,255,255,0.5)' : '#22c55e';
  const glowColor   = `${t1.color}15`;
  const stakes = matchStakes(m);
  const resultImpact = isResult ? tableImpactLine(m, t1Winner, t2Winner) : '';

  const badgeHtml = isLive
    ? `<span style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase;animation:livePulse 2s infinite;display:inline-block">LIVE</span>`
    : `<span style="background:var(--cbadge);color:var(--ct3);font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase">RESULT</span>`;

  const metaChips = isResult
    ? `${resultMarginBadge(m)}${stakes.impact ? `<span class="match-intel-chip ${stakes.tone}">Table impact</span>` : ''}`
    : `${stakes.severity ? `<span class="match-intel-chip ${stakes.tone}">${esc(stakes.severity)}</span>` : ''}${m.run_rate ? `<span class="match-intel-chip neutral">CRR ${esc(String(m.run_rate))}</span>` : ''}`;

  return `
    <article style="background:var(--cbg);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--cbd);border-radius:16px;overflow:hidden;cursor:pointer;transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s"
             onmouseenter="this.style.borderColor='var(--cbd-h)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px ${glowColor}'"
             onmouseleave="this.style.borderColor='var(--cbd)';this.style.transform='translateY(0)';this.style.boxShadow='none'"
             onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div style="height:2px;background:linear-gradient(90deg,${t1.color}88,${t2.color}88)"></div>
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 0;gap:10px">
        <span style="font-size:11.5px;color:var(--ct3);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${matchLabel}</span>
        ${badgeHtml}
      </div>
      ${metaChips ? `<div class="match-intel-row">${metaChips}</div>` : ''}
      <!-- Teams & Scores -->
      <div style="display:flex;align-items:center;justify-content:center;padding:14px 18px 10px;gap:10px">
        ${teamBadge(m.team1_short, 52)}
        <div style="text-align:center;flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--ct2)">${esc(m.team1_short)}${t1Winner ? ' <span style="color:#22c55e;font-size:10px">✓</span>' : ''}</div>
          ${teamMiniIntel(m.team1_short)}
          <div style="font-size:22px;font-weight:800;color:var(--ct);letter-spacing:-0.5px">${m.team1_score1 ? esc(m.team1_score1.display) : '—'}</div>
          <div style="font-size:10.5px;color:var(--ct4)">${m.team1_score1 ? esc(m.team1_score1.detail) : 'Yet to bat'}</div>
        </div>
        <span style="font-size:10px;color:var(--ct5);font-weight:600;flex-shrink:0">vs</span>
        <div style="text-align:center;flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--ct2)">${esc(m.team2_short)}${t2Winner ? ' <span style="color:#22c55e;font-size:10px">✓</span>' : ''}</div>
          ${teamMiniIntel(m.team2_short)}
          <div style="font-size:22px;font-weight:800;color:var(--ct);letter-spacing:-0.5px">${m.team2_score1 ? esc(m.team2_score1.display) : '—'}</div>
          <div style="font-size:10.5px;color:var(--ct4)">${m.team2_score1 ? esc(m.team2_score1.detail) : 'Yet to bat'}</div>
        </div>
        ${teamBadge(m.team2_short, 52)}
      </div>
      <!-- Status & Table Impact -->
      ${isResult ? `
      <div style="text-align:center;padding:10px 14px 12px;background:rgba(255,255,255,0.015);margin:0 14px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.03)">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5)">${statusText}</div>
        ${resultImpact ? resultImpact.replace('match-impact-line','match-impact-line in-result') : ''}
        ${!resultImpact && stakes.impact ? `<div class="match-impact-line in-result">📊 ${esc(stakes.impact)}</div>` : ''}
      </div>
      ` : `
      <div style="text-align:center;padding:0 18px 14px">
        <span style="font-size:11.5px;font-weight:600;color:${statusColor}">${statusText}</span>
        ${stakes.impact ? `<div class="match-impact-line">★ ${esc(stakes.impact)}</div>` : ''}
      </div>
      `}
    </article>`;
}

// ── Crickly Upcoming Row (UpcomingRow style) ──────────────────
function upcomingRowCK(m) {
  const matchJson = encodeURIComponent(JSON.stringify(m));
  const t1 = teamMeta(m.team1_short);
  const t2 = teamMeta(m.team2_short);
  const stakes = matchStakes(m);

  let timeDisplay = m.start_time || 'TBD';
  let dateDisplay = '';
  if (m.start_epoch) {
    const d = new Date(m.start_epoch);
    const today    = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString())         dateDisplay = 'Today';
    else if (d.toDateString() === tomorrow.toDateString()) dateDisplay = 'Tomorrow';
    else dateDisplay = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const sublabelParts = [m.match_desc || m.series, m.venue ? m.venue.split(',')[0] : ''].filter(Boolean);
  const sublabel = esc(sublabelParts.join(' · '));
  // Head-to-head from match data (both teams have complete field) or default
  const h2h = (m.t1_h2h_wins != null && m.t2_h2h_wins != null) ? `${m.t1_h2h_wins}-${m.t2_h2h_wins}` : null;
  
  const chipHtml = (() => {
    const items = [];
    if (stakes.severity && stakes.tone === 'danger') items.push(`<span class="match-intel-chip danger">Must-win</span>`);
    else if (stakes.severity && stakes.tone === 'warn') items.push(`<span class="match-intel-chip warn">Playoff swing</span>`);
    else if (stakes.severity) items.push(`<span class="match-intel-chip ${stakes.tone}">${esc(stakes.severity)}</span>`);
    for (const c of (stakes.chips || []).slice(0, 2)) items.push(`<span class="match-intel-chip neutral">${esc(c)}</span>`);
    return items.join('');
  })();

  return `
    <div class="upcoming-smart-card" style="--t1:${t1.color};--t2:${t2.color}"
         onclick='handleCardClick(${JSON.stringify(m.id)}, this)' data-match='${matchJson}'>
      <div class="upcoming-smart-stripe"></div>
      <div class="upcoming-smart-head">
        <div class="upcoming-smart-meta">
          <span>${esc(m.match_desc || 'Fixture')}</span>
          ${m.venue ? `<span class="mini-dot"></span><span>${esc(m.venue.split(',')[0])}</span>` : ''}
        </div>
        <div class="upcoming-smart-time">
          <strong>${esc(timeDisplay)}</strong>
          ${dateDisplay ? `<span>${esc(dateDisplay)}</span>` : ''}
        </div>
      </div>
      <div class="upcoming-smart-body">
        <div class="upcoming-smart-team">
          ${teamBadge(m.team1_short, 40)}
          <div>
            <div class="upcoming-smart-code">${esc(m.team1_short)}</div>
            ${teamMiniIntel(m.team1_short)}
          </div>
        </div>
        <div class="upcoming-smart-vs"><span>VS</span>${h2h ? `<span class="upcoming-h2h">${esc(h2h)}</span>` : ''}</div>
        <div class="upcoming-smart-team is-right">
          <div>
            <div class="upcoming-smart-code">${esc(m.team2_short)}</div>
            ${teamMiniIntel(m.team2_short)}
          </div>
          ${teamBadge(m.team2_short, 40)}
        </div>
      </div>
      ${chipHtml ? `<div class="match-intel-row in-card">${chipHtml}</div>` : ''}
      ${stakes.headline ? `<div class="match-impact-line upcoming is-significance">★ ${esc(stakes.headline)}</div>` : (stakes.impact ? `<div class="match-impact-line upcoming">📊 ${esc(stakes.impact)}</div>` : '')}
      ${sublabel ? `<div class="upcoming-smart-sub">${sublabel}</div>` : ''}
    </div>`;
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
let pointsSeason = '2026';
let pointsViewMode = 'compact';
let pointsExpandedRow = null;
let pointsDetailTabs = {};

let pulseStatsData = null;
let pulseStatsLoaded = false;
let pulseArchiveData = null;
let pulseArchiveLoaded = false;

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
  
  // Kick off lazy data loads
  if (!pulseStatsLoaded) {
    pulseStatsLoaded = true;
    fetchJson(STATS_BUILDER_PATH).then(r => { if(r.ok) return r.json(); }).then(d => { pulseStatsData=d; renderTournamentPulse(); }).catch(()=>{});
  }
  if (!pulseArchiveLoaded) {
    pulseArchiveLoaded = true;
    fetchJson(getArchiveUrl()).then(r => { if(r.ok) return r.json(); }).then(d => { pulseArchiveData=d; renderTournamentPulse(); }).catch(()=>{});
  }

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
    const el = $('heroInner');
    if (el) el.innerHTML = heroCK(match, sc);
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
  if (showPulse) { show('tournamentPulse'); renderTournamentPulse(); }
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

  // Hero — show Crickly hero card, then auto-fetch scorecard for player data
  if (data.live.length > 0) {
    const liveMatch = data.live[0];
    const cachedSc = (heroMatchId === liveMatch.id) ? heroScorecardData : null;
    $('heroInner').innerHTML = heroCK(liveMatch, cachedSc);
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

  // Tournament Pulse — kick off data loading early
  renderTournamentPulse();

  // Live grid (remaining after hero) — Crickly cards
  $('liveGrid').innerHTML = data.live.slice(1).map(liveCardCK).join('');

  // Upcoming — Crickly rows (full list in the Upcoming tab)
  $('upcomingGrid').innerHTML = data.upcoming.map(upcomingRowCK).join('');

  // Results — Crickly cards
  $('resultsGrid').innerHTML = data.finished.map(liveCardCK).join('');

  applyFilter(data);
}

// ── Fetch ─────────────────────────────────────────────────────
let fetching = false;

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
    ? `<span class="stats-prov-note">+${provCount} provisional match${provCount > 1 ? 'es' : ''} included (pending Cricsheets sync)</span>`
    : '';
  el.innerHTML = `
    <div class="stats-topline">
      <div>
        <h2 class="stats-title">IPL Stat Builder</h2>
        <p class="stats-subtitle">Filter batting and bowling numbers by season, team, venue, round, and qualifiers.${provNote ? ' ' + provNote : ''}</p>
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
        <button type="button"
          class="stats-preset${statsFilters.preset === preset.id ? ' is-active' : ''}"
          data-preset="${esc(preset.id)}"
          onclick="setStatsPreset('${preset.id}')">
          <span class="preset-icon-area" aria-hidden="true">${esc(preset.icon || '📋')}</span>
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

function renderTeamsSection() {
  const el = $('teamsSection');
  if (!el) return;
  el.innerHTML = `
    <div class="ck-sec-head"><span class="ck-sec-title">IPL 2026 — All Teams</span></div>
    <div class="teams-grid">
      ${TEAM_ORDER.map(abbr => {
        const t = teamMeta(abbr);
        const ext = TEAM_LOGO_EXT[abbr] || 'webp';
        const full = TEAM_FULL_NAMES[abbr] || abbr;
        return `
          <div class="team-card" onclick="showTeamDetail('${abbr}')">
            <div class="team-card-logo-wrap" style="background:linear-gradient(135deg,${t.color}18,${t.color2||t.color}08)">
              <img src="${joinPath(STATIC_BASE_PATH, `team-logos/${abbr}.${ext}`)}" alt="${esc(abbr)}" style="width:100%;height:100%;object-fit:contain"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <span style="display:none;font-size:20px;font-weight:800;color:${t.color};width:100%;height:100%;align-items:center;justify-content:center">${esc(abbr)}</span>
            </div>
            <div class="team-card-body">
              <div style="font-size:10px;font-weight:700;color:${t.color};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px">${esc(abbr)}</div>
              <div style="font-size:12px;font-weight:600;color:var(--ct);line-height:1.3">${esc(full)}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function showTeamDetail(abbr) {
  const t = teamMeta(abbr);
  const full = TEAM_FULL_NAMES[abbr] || abbr;
  const el = $('teamsSection');
  if (!el) return;
  const ext = TEAM_LOGO_EXT[abbr] || 'webp';

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

function renderPlayersSection() {
  const el = $('playersSection');
  if (!el) return;

  // Build player-team map from stats data (most recent year)
  const playerTeamMap = {}; // playerName → teamAbbr
  if (statsData) {
    const latestYearMap = {}; // playerName → latestYear
    for (const rec of [...(statsData.batting||[]), ...(statsData.bowling||[])]) {
      if (!rec.p || !rec.t) continue;
      const yr = Number(rec.y) || 0;
      if (!latestYearMap[rec.p] || yr > latestYearMap[rec.p]) {
        latestYearMap[rec.p] = yr;
        playerTeamMap[rec.p] = rec.t;
      }
    }
  }
  // Also try manifest player_teams if available
  const manifestTeams = assetManifest.player_teams || {};
  Object.assign(playerTeamMap, manifestTeams);

  // Build player run totals for sorting
  const runMap = new Map();
  if (statsData) {
    for (const rec of (statsData.batting || [])) {
      if (rec.p) runMap.set(rec.p, (runMap.get(rec.p) || 0) + (rec.ru || 0));
    }
  }

  // Get players with images from manifest
  const allPlayers = Object.entries(assetManifest.player_images || {});

  // Filter by team
  const filtered = playersTeamFilter === 'all'
    ? allPlayers
    : allPlayers.filter(([name]) => playerTeamMap[name] === playersTeamFilter);

  // Sort by runs descending, then name
  const sorted = filtered
    .map(([name, path]) => ({ name, path, runs: runMap.get(name) || 0, team: playerTeamMap[name] || '' }))
    .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));

  const teamTabs = ['all', ...TEAM_ORDER];

  el.innerHTML = `
    <div class="ck-sec-head"><span class="ck-sec-title">IPL Players</span></div>
    <!-- Team filter pills -->
    <div class="team-filter-bar" style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:10px;margin-bottom:16px">
      ${teamTabs.map(abbr => {
        const isAll = abbr === 'all';
        const isActive = playersTeamFilter === abbr;
        const tcolor = isAll ? '#818cf8' : (teamMeta(abbr).color);
        return `<button onclick="setPlayersTeamFilter('${abbr}')"
          style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid ${isActive ? tcolor : 'var(--cbd)'};background:${isActive ? tcolor+'22' : 'transparent'};color:${isActive ? tcolor : 'var(--ct3)'};font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);transition:all 0.15s;white-space:nowrap">
          ${isAll ? 'All Teams' : esc(abbr)}
        </button>`;
      }).join('')}
    </div>
    ${sorted.length ? `
    <div class="players-grid">
      ${sorted.map(({ name, path, runs, team }) => {
        const t = teamMeta(team || '');
        const words = name.split(' ');
        const initials = (words.length >= 2 ? words[0][0]+words[words.length-1][0] : name.slice(0,2)).toUpperCase();
        const displayName = words[words.length - 1] || name; // Last name for brevity
        const safeNameAttr = esc(name).replace(/"/g, '&quot;');
        return `
          <div class="player-card" onclick="showPlayerDetail(${JSON.stringify(name)})">
            <div class="player-card-avatar" style="background:linear-gradient(135deg,${t.color}22,${t.color}0a)">
              <img src="/${esc(path)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <span style="display:none;font-size:20px;font-weight:700;color:${t.color};width:100%;height:100%;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(135deg,${t.color}25,${t.color}10)">${esc(initials)}</span>
            </div>
            <div class="player-card-name">${esc(displayName)}</div>
            ${team ? `<div style="font-size:10px;color:${t.color};font-weight:700">${esc(team)}</div>` : ''}
            ${runs > 0 ? `<div style="font-size:10px;font-weight:600;color:var(--ct4)">${runs} <span style="font-weight:400">runs</span></div>` : ''}
          </div>`;
      }).join('')}
    </div>` : `
    <div style="text-align:center;padding:60px 20px">
      <div style="font-size:32px;margin-bottom:12px">🏏</div>
      <p style="color:var(--ct3);font-size:14px">No players found${playersTeamFilter !== 'all' ? ' for ' + playersTeamFilter : ''}.</p>
      <p style="color:var(--ct4);font-size:12px;margin-top:6px">Run scripts/download_assets.py to download player images.</p>
    </div>`}`;
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
  return `<span class="pt-team-badge" style="--team:${meta.color};width:${size}px;height:${size}px;border-color:${meta.color}33;background:${meta.color}1A;color:${meta.color}">${esc(short)}</span>`;
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
        <button class="pt-tab${activeView === 'advanced' ? ' active' : ''}" onclick="setPointsView('advanced')">Advanced</button>
        <button class="pt-tab${activeView === 'qualification' ? ' active' : ''}" onclick="setPointsView('qualification')">⟡ Qualification</button>
      </div>
      ${rows.length ? renderPointsView(rows, activeView) : `<div class="sc-empty" style="padding:28px">No data for this season.</div>`}
    </div>`;
}
function renderPointsView(rows, view) {
  if (view === 'advanced') return renderAdvancedPointsView(rows);
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
      ${['overview','qualification','fixtures'].map(t => `<button class="pt-inner-tab${tab === t ? ' active' : ''}" onclick="setPtsDetailTab(${i}, '${t}', event)">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}
    </div>
    ${tab === 'qualification' ? renderExpandedQualification(row) : tab === 'fixtures' ? renderExpandedFixtures(row) : renderExpandedOverview(row)}
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
function renderExpandedQualification(row) {
  const qColor = getQualColor(row.qualProb), pColor = getPressureColor(row.pressureIndex);
  const neededWins = Math.max(0, Math.ceil((16 - row.points) / 2));
  const marker = ptClamp(((row.nrr + 2) / 4) * 100);
  const what = row.eliminated ? 'Mathematically eliminated from playoff contention.' : row.qualProb >= 90 ? `Need ${neededWins} more win${neededWins === 1 ? '' : 's'} from ${row.remaining} remaining to lock top 4.` : row.qualProb >= 60 ? `Need to win ${neededWins} of ${row.remaining} remaining. NRR could be decisive.` : row.qualProb >= 25 ? `Must win ${neededWins} of ${row.remaining} remaining and need other results.` : 'Need to win all remaining and depend heavily on other results.';
  return `<div class="pt-qual-stack">
    <div class="pt-card pt-prob"><div><div class="pt-card-label">Playoff Probability</div><div class="pt-big" style="color:${qColor}">${Math.round(row.qualProb)}%</div><p>${getQualDescriptor(row.qualProb)}</p></div>${createQualRing(row.qualProb,52)}</div>
    <div class="pt-two"><div class="pt-card"><div class="pt-card-label">Virtual Rank</div><div class="pt-rank-range"><b>${row.virtualRank[0]}</b><span>to</span><b class="dim">${row.virtualRank[1]}</b></div><p>Best → worst case</p></div><div class="pt-card"><div class="pt-card-label">Pressure Index</div><div class="pt-pressure"><span style="width:${row.pressureIndex}%;background:${pColor}"></span></div><b style="color:${pColor}">${Math.round(row.pressureIndex)}/100</b><p>${getPressureLabel(row.pressureIndex)}</p></div></div>
    <div class="pt-card"><div class="pt-card-label">NRR Danger Zone</div><div class="pt-zone"><span class="pt-zone-marker" style="left:${marker}%;background:${teamMeta(row.team_short).color}"></span></div><div class="pt-scale"><span>-2.0</span><span>0.0</span><span>+2.0</span></div></div>
    <div class="pt-card pt-need ${row.eliminated ? 'danger' : ''}">${esc(what)}</div>
  </div>`;
}
function renderExpandedFixtures(row) {
  const dColor = getDifficultyColor(row.remainingDifficulty);
  const fixtures = row.remainingFixtures.length ? row.remainingFixtures : ['TBD'];
  return `<div class="pt-fixtures"><div class="pt-fixture-head"><div><b>Remaining Difficulty</b><small>${row.remaining} matches left</small></div><span style="background:${dColor}1A;color:${dColor};border-color:${dColor}33">${getDifficultyLabel(row.remainingDifficulty)} (${Math.round(row.remainingDifficulty)}/100)</span></div>${fixtures.map(code => renderFixtureRow(code)).join('')}</div>`;
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
function raceIntensity(rows) {
  if (!rows.length) return 0;
  const fourth = rows[3]?.points || 0;
  const within = rows.filter(r => Math.abs(r.points - fourth) <= 4).length;
  const avgRemaining = rows.reduce((s,r)=>s+r.remaining,0)/rows.length;
  return ptClamp((within / rows.length) * 72 + avgRemaining * 3);
}
function renderQualificationPointsView(rows) {
  const intensity = raceIntensity(rows);
  const fourth = rows[3]?.points || 0;
  const within = rows.filter(r => Math.abs(r.points - fourth) <= 4).length;
  const avgLeft = rows.length ? Math.round(rows.reduce((s,r)=>s+r.remaining,0)/rows.length) : 0;
  return `<div class="pt-race"><div class="race-banner"><div><span>Playoff Race Intensity</span><b>${Math.round(intensity)}%</b></div><div class="race-bar"><i style="width:${intensity}%"></i></div><p>${within} teams within 4 pts for 4 spots · ${avgLeft} matches left avg.</p></div>${rows.map(row => renderRaceCard(row)).join('')}</div>`;
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
    const end2 = now + 172800000; // 48 hours
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
  // Restore saved theme (default dark)
  const saved = localStorage.getItem('pitch-theme') || 'dark';
  applyTheme(saved);
  // Load asset manifest (team logos + player images) then render
  loadAssetManifest().finally(() => {
    // Pre-load points table so match cards render with ranks/form/stakes on first pass
    loadPointsIntel();
    // Generate Crickly-style date tabs
    generateDateTabs();
    loadMatches(false);
    // Auto-refresh match list every 15 seconds when drawer is closed
    setInterval(() => { if (!drawerOpen) loadMatches(false); }, 15_000);
  });
});
