import os
import json as _json
import time
from datetime import datetime
from flask import Blueprint, jsonify

from scraper import get_all_matches, get_schedule
from scorecard import get_scorecard

api_bp = Blueprint("api", __name__)

# Match list cache (30s)
_match_cache = {"data": None, "ts": 0}
MATCH_TTL = 30

# Scorecard cache (20s)
_sc_cache = {}
SC_TTL = 20

# Schedule cache (5 min — changes rarely)
_schedule_cache = {"data": None, "ts": 0}
SCHEDULE_TTL = 300


def fetch_cached_matches():
    now = time.time()
    if _match_cache["data"] is None or (now - _match_cache["ts"]) > MATCH_TTL:
        _match_cache["data"] = get_all_matches()
        _match_cache["ts"] = now
    return _match_cache["data"]


def fetch_cached_scorecard(match_id, team1_short, team2_short):
    now = time.time()
    entry = _sc_cache.get(match_id)
    if entry is None or (now - entry["ts"]) > SC_TTL:
        _sc_cache[match_id] = {
            "data": get_scorecard(match_id, team1_short, team2_short),
            "ts": now,
        }
    return _sc_cache[match_id]["data"]


@api_bp.route("/api/matches")
def api_matches():
    return jsonify(fetch_cached_matches())


@api_bp.route("/api/matches/refresh")
def api_refresh():
    _match_cache["ts"] = 0
    return jsonify(fetch_cached_matches())


@api_bp.route("/api/scorecard/<match_id>")
def api_scorecard(match_id):
    data = fetch_cached_matches()
    all_matches = data.get("live", []) + data.get("upcoming", []) + data.get("finished", [])
    match = next((m for m in all_matches if m.get("id") == match_id), None)
    if not match:
        return jsonify({"error": "Match not found", "innings": []}), 404

    scorecard = fetch_cached_scorecard(match_id, match["team1_short"], match["team2_short"])

    # Attach basic match info so the drawer has context.
    scorecard["match_id"] = match_id
    scorecard["team1"] = match["team1"]
    scorecard["team2"] = match["team2"]
    scorecard["team1_short"] = match["team1_short"]
    scorecard["team2_short"] = match["team2_short"]
    scorecard["status"] = match["status"]
    scorecard["status_text"] = match["status_text"]
    scorecard["series"] = match["series"]
    scorecard["match_desc"] = match["match_desc"]
    scorecard["venue"] = match["venue"]
    return jsonify(scorecard)


@api_bp.route("/api/scorecard/<match_id>/refresh")
def api_scorecard_refresh(match_id):
    if match_id in _sc_cache:
        del _sc_cache[match_id]
    return api_scorecard(match_id)


def fetch_cached_schedule():
    now = time.time()
    if _schedule_cache["data"] is None or (now - _schedule_cache["ts"]) > SCHEDULE_TTL:
        # Merge live state from the match cache into schedule entries
        schedule = get_schedule()
        live_data = fetch_cached_matches()
        live_ids  = {m["id"] for m in live_data.get("live", [])}
        for m in schedule.get("matches", []):
            if m["id"] in live_ids:
                m["status"] = "live"
        _schedule_cache["data"] = schedule
        _schedule_cache["ts"]   = now
    return _schedule_cache["data"]


@api_bp.route("/api/schedule")
def api_schedule():
    return jsonify(fetch_cached_schedule())


@api_bp.route("/api/schedule/refresh")
def api_schedule_refresh():
    _schedule_cache["ts"] = 0
    return jsonify(fetch_cached_schedule())


@api_bp.route("/api/points-table")
def api_points_table():
    import json as _json_lib
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    path = os.path.join(data_dir, "points-table.json")
    if not os.path.isfile(path):
        return jsonify({"error": "points-table.json not found", "years": [], "tables": {}}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(_json_lib.load(f))


@api_bp.route("/api/provisional-matches")
def api_provisional_matches():
    """Return scraped finished matches that are not yet in the Cricsheets archive."""
    data = fetch_cached_matches()
    return jsonify({
        "matches": data.get("finished", []),
        "last_updated": data.get("last_updated"),
    })


@api_bp.route("/api/provisional-stats")
def api_provisional_stats():
    """Compute batting/bowling records from provisional (scraped) finished matches.
    Used by the stats builder to bridge the ~3-day Cricsheets ingestion delay."""
    data = fetch_cached_matches()
    finished = data.get("finished", [])

    batting = []
    bowling = []

    for match in finished:
        match_id = match.get("id")
        if not match_id:
            continue
        try:
            sc = fetch_cached_scorecard(
                match_id, match["team1_short"], match["team2_short"]
            )
            innings_list = sc.get("innings") or []
            for inn in innings_list:
                bat_team  = inn.get("bat_team",  "")
                bowl_team = inn.get("bowl_team", "")
                # Map full name → short
                t1, t2 = match["team1"], match["team2"]
                t1s, t2s = match["team1_short"], match["team2_short"]
                bat_short  = t1s if bat_team  == t1 else (t2s if bat_team  == t2 else bat_team[:3].upper())
                bowl_short = t1s if bowl_team == t1 else (t2s if bowl_team == t2 else bowl_team[:3].upper())

                for b in (inn.get("batsmen") or []):
                    ru = int(b.get("runs") or 0)
                    ba = int(b.get("balls") or 0)
                    if ru == 0 and ba == 0:
                        continue
                    batting.append({
                        "p": b.get("name", ""),
                        "t": bat_short,
                        "o": bowl_short,
                        "v": match.get("venue", ""),
                        "r": "League",
                        "y": 2026,
                        "m": f"prov_{match_id}",
                        "ru": ru,
                        "b": ba,
                        "out": 0 if b.get("not_out") else 1,
                        "fo": int(b.get("fours") or 0),
                        "si": int(b.get("sixes") or 0),
                        "provisional": True,
                    })

                for bw in (inn.get("bowlers") or []):
                    overs_str = str(bw.get("overs", "0"))
                    parts = overs_str.split(".")
                    balls = int(parts[0]) * 6 + (int(parts[1]) if len(parts) > 1 else 0)
                    if balls == 0:
                        continue
                    bowling.append({
                        "p": bw.get("name", ""),
                        "t": bowl_short,
                        "o": bat_short,
                        "v": match.get("venue", ""),
                        "r": "League",
                        "y": 2026,
                        "m": f"prov_{match_id}",
                        "b": balls,
                        "ru": int(bw.get("runs") or 0),
                        "w": int(bw.get("wickets") or 0),
                        "d": 0,
                        "md": int(bw.get("maidens") or 0),
                        "provisional": True,
                    })
        except Exception:
            continue

    return jsonify({
        "batting": batting,
        "bowling": bowling,
        "match_count": len(finished),
    })


# Top performers cache (10 min — archive stats change rarely)
_top_perf_cache = {"data": None, "ts": 0}
TOP_PERF_TTL = 600


@api_bp.route("/api/top-performers")
def api_top_performers():
    """Return top 10 batters and bowlers for the most recent IPL season
    by aggregating the archive stats-builder.json plus provisional matches."""
    global _top_perf_cache
    now = time.time()
    if _top_perf_cache["data"] and (now - _top_perf_cache["ts"]) < TOP_PERF_TTL:
        return jsonify(_top_perf_cache["data"])

    # Load archive data
    stats_path = os.path.join(os.path.dirname(__file__), "data", "stats-builder.json")
    try:
        with open(stats_path, encoding="utf-8") as f:
            archive = _json.load(f)
    except Exception:
        archive = {"batting": [], "bowling": []}

    target_year = 2026

    bat_agg: dict = {}
    for r in archive.get("batting", []):
        if r.get("y") != target_year:
            continue
        p = r["p"]
        if p not in bat_agg:
            bat_agg[p] = {"player": p, "team": r.get("t", ""), "runs": 0, "balls": 0, "innings": 0}
        bat_agg[p]["runs"]   += r.get("ru", 0)
        bat_agg[p]["balls"]  += r.get("b",  0)
        bat_agg[p]["innings"] += 1

    bowl_agg: dict = {}
    for r in archive.get("bowling", []):
        if r.get("y") != target_year:
            continue
        p = r["p"]
        if p not in bowl_agg:
            bowl_agg[p] = {"player": p, "team": r.get("t", ""), "wickets": 0, "runs": 0, "balls": 0}
        bowl_agg[p]["wickets"] += r.get("w",  0)
        bowl_agg[p]["runs"]    += r.get("ru", 0)
        bowl_agg[p]["balls"]   += r.get("b",  0)

    # Merge provisional (scraped) finished matches — fills the 3-day Cricsheets gap
    try:
        prov_data = fetch_cached_matches()
        finished  = prov_data.get("finished", [])
        archive_ids = set()  # no dedup needed — prov uses prefix prov_<id>

        for match in finished:
            mid = match.get("id")
            if not mid:
                continue
            try:
                sc = fetch_cached_scorecard(mid, match["team1_short"], match["team2_short"])
                t1, t2 = match["team1"], match["team2"]
                t1s, t2s = match["team1_short"], match["team2_short"]
                for inn in sc.get("innings") or []:
                    bt = inn.get("bat_team", "")
                    bw = inn.get("bowl_team", "")
                    bat_short  = t1s if bt == t1 else (t2s if bt == t2 else bt[:3].upper())
                    bowl_short = t1s if bw == t1 else (t2s if bw == t2 else bw[:3].upper())
                    for b in inn.get("batsmen") or []:
                        p = b.get("name", "")
                        ru = int(b.get("runs") or 0)
                        ba = int(b.get("balls") or 0)
                        if not p or (ru == 0 and ba == 0):
                            continue
                        if p not in bat_agg:
                            bat_agg[p] = {"player": p, "team": bat_short, "runs": 0, "balls": 0, "innings": 0}
                        bat_agg[p]["runs"]    += ru
                        bat_agg[p]["balls"]   += ba
                        bat_agg[p]["innings"] += 1
                    for bw_r in inn.get("bowlers") or []:
                        p = bw_r.get("name", "")
                        os_str = str(bw_r.get("overs", "0"))
                        parts  = os_str.split(".")
                        balls  = int(parts[0]) * 6 + (int(parts[1]) if len(parts) > 1 else 0)
                        if not p or balls == 0:
                            continue
                        if p not in bowl_agg:
                            bowl_agg[p] = {"player": p, "team": bowl_short, "wickets": 0, "runs": 0, "balls": 0}
                        bowl_agg[p]["wickets"] += int(bw_r.get("wickets") or 0)
                        bowl_agg[p]["runs"]    += int(bw_r.get("runs") or 0)
                        bowl_agg[p]["balls"]   += balls
            except Exception:
                continue
    except Exception:
        pass

    top_bat  = sorted(bat_agg.values(),  key=lambda x: (-x["runs"], -x["balls"]))[:10]
    top_bowl = sorted(bowl_agg.values(), key=lambda x: (-x["wickets"], x["runs"]))[:10]

    for b in top_bat:
        b["sr"] = round(b["runs"] * 100 / b["balls"], 1) if b["balls"] > 0 else 0.0
    for b in top_bowl:
        b["economy"] = round(b["runs"] * 6 / b["balls"], 2) if b["balls"] > 0 else 0.0

    result = {"batting": top_bat, "bowling": top_bowl, "season": target_year}
    _top_perf_cache["data"] = result
    _top_perf_cache["ts"]   = now
    return jsonify(result)


@api_bp.route("/api/scorecard/schedule/<match_id>")
def api_scorecard_schedule(match_id):
    """Scorecard for a match coming from the schedule view (team info from schedule)."""
    sched = fetch_cached_schedule()
    match = next((m for m in sched.get("matches", []) if m["id"] == match_id), None)
    if not match:
        # Fallback to live matches
        return api_scorecard(match_id)
    scorecard = fetch_cached_scorecard(match_id, match["team1_short"], match["team2_short"])
    scorecard["match_id"]    = match_id
    scorecard["team1"]       = match["team1"]
    scorecard["team2"]       = match["team2"]
    scorecard["team1_short"] = match["team1_short"]
    scorecard["team2_short"] = match["team2_short"]
    scorecard["status"]      = match["status"]
    scorecard["status_text"] = match["status_text"]
    scorecard["series"]      = match.get("series", "IPL 2026")
    scorecard["match_desc"]  = match["match_desc"]
    scorecard["venue"]       = match["venue"]
    return jsonify(scorecard)

# ── Live match intelligence endpoint ──────────────────────────
def _compute_projection(score, overs, wickets, crr):
    if not score or not overs:
        return None
    total_balls = int(overs) * 6 + int(round((overs - int(overs)) * 10))
    balls_rem = 120 - total_balls
    if balls_rem <= 0:
        return None
    rem_overs = balls_rem / 6
    proj = score + (crr * rem_overs)
    proj -= wickets * 0.4 * rem_overs
    if overs >= 16:
        proj *= 1.05
    r = round(proj)
    return {"projected_score": r, "range_low": r - 7, "range_high": r + 7, "proj_target": r + 1, "balls_remaining": balls_rem}

def _compute_win_prob(score, overs, wickets, crr, innings, target=None, rrr=None):
    if innings == 1:
        balls_rem = live_balls_remaining(overs)
        proj = score + crr * (balls_rem / 6)
        delta = (proj - 175) / 35
        bp = max(10, min(90, round(50 + delta * 20)))
        return {"batting_team": bp, "fielding_team": 100 - bp}
    else:
        if rrr is None and target and overs:
            balls_rem = live_balls_remaining(overs)
            rrr_val = (target - score) / (balls_rem / 6)
        else:
            rrr_val = rrr
        if rrr_val is None or crr is None:
            return {"batting_team": 50, "fielding_team": 50}
        rate_diff = rrr_val - crr
        bp = max(5, min(95, round(50 - rate_diff * 10 - wickets * 3)))
        return {"batting_team": bp, "fielding_team": 100 - bp}

def live_balls_remaining(overs):
    return 120 - (int(overs) * 6 + int(round((overs - int(overs)) * 10)))

def _compute_partnership(innings):
    if not innings:
        return {"runs": 0, "balls": 0}
    score = innings.get("score", {})
    runs = score.get("runs", 0)
    fow = innings.get("fow", [])
    if fow:
        last_wkt_runs = fow[-1].get("runs", 0)
        part_runs = runs - last_wkt_runs
    else:
        part_runs = runs
    return {"runs": max(0, part_runs), "balls": 0}

def _compute_pressure(innings, score, over, crr, target, rrr):
    base = 0
    if innings == 1:
        base += (score.get("wickets", 0) or 0) * 10
        if over > 10 and crr and crr < 8.0:
            base += 15
        if over > 16:
            base += 10
    else:
        if rrr and crr:
            base += max(0, (rrr - crr) * 8)
        base += (score.get("wickets", 0) or 0) * 8
        balls_left = (20 - over) * 6
        if target and balls_left < 24 and (target - score.get("runs", 0)) > 30:
            base += 20
    v = min(100, max(0, base))
    label = "High pressure" if v >= 70 else "Medium" if v >= 45 else "Low" if v >= 20 else "Comfortable"
    return {"value": v, "label": label}

def _enrich_batters(batsmen):
    result = []
    for b in (batsmen or []):
        sr = round((b.get("runs", 0) / b.get("balls", 1)) * 100, 1) if b.get("balls", 0) > 0 else 0.0
        result.append({
            "name": b.get("name", ""),
            "runs": b.get("runs", 0),
            "balls": b.get("balls", 0),
            "fours": b.get("fours", 0),
            "sixes": b.get("sixes", 0),
            "sr": sr,
            "is_active": not bool(b.get("out_desc", "")),
            "is_striker": False,
            "dismissal": b.get("out_desc", None),
        })
    return result

def _enrich_bowlers(bowl_data):
    result = []
    for b in (bowl_data or []):
        overs = float(b.get("overs", 0))
        econ = round(b.get("runs", 0) / overs, 2) if overs > 0 else 0.0
        result.append({
            "name": b.get("name", ""),
            "overs": overs,
            "runs": b.get("runs", 0),
            "wickets": b.get("wickets", 0),
            "econ": econ,
            "dots": b.get("dots", 0),
            "is_current": False,
        })
    return result

@api_bp.route("/api/live/<match_id>")
def api_live_intel(match_id):
    data = fetch_cached_matches()
    all_matches = data.get("live", []) + data.get("upcoming", []) + data.get("finished", [])
    match = next((m for m in all_matches if m.get("id") == match_id), None)
    if not match:
        return jsonify({"error": "Match not found"}), 404

    sc = fetch_cached_scorecard(match_id, match["team1_short"], match["team2_short"])
    innings_list = sc.get("innings", [])

    # Determine active innings (usually the last one)
    active_inn = innings_list[-1] if innings_list else None

    # Get basic score info
    bat_score = match.get("team1_score1") or {}
    t1s = match.get("team1_short", "")
    t2s = match.get("team2_short", "")
    batting_is_t1 = bool(bat_score) or not match.get("team2_score1")
    bat_code = t1s if batting_is_t1 else t2s
    bowl_code = t2s if batting_is_t1 else t1s
    score = bat_score.get("runs", 0) or 0
    overs = float(bat_score.get("overs", 0) or 0)
    wickets = bat_score.get("wickets", 0) or 0
    crr = float(match.get("run_rate") or 0)

    # Compute rich fields
    batsmen = _enrich_batters(active_inn.get("batsmen", []) if active_inn else [])
    bowlers = _enrich_bowlers(active_inn.get("bowlers", []) if active_inn else [])
    fow = active_inn.get("fow", []) if active_inn else []
    projected = _compute_projection(score, overs, wickets, crr)
    wp = _compute_win_prob(score, overs, wickets, crr, 1)
    pressure = _compute_pressure(
        active_inn or {}, {"runs": score, "wickets": wickets}, overs, crr, None, None
    )
    partnership = _compute_partnership(active_inn)

    # Mark first batter as striker (approximation)
    if batsmen:
        batsmen[0]["is_striker"] = True

    payload = {
        "match_meta": {
            "match_num": match.get("match_desc", ""),
            "t1": t1s,
            "t2": t2s,
            "t1_full": match.get("team1", ""),
            "t2_full": match.get("team2", ""),
            "venue": match.get("venue", ""),
            "toss": match.get("status_text", ""),
            "innings": 1,
            "batting_team": bat_code,
            "fielding_team": bowl_code,
            "is_live": match.get("status") == "live",
        },
        "score_block": {
            "score": score,
            "wickets": wickets,
            "overs": overs,
            "crr": crr,
            "rrr": None,
            "target": None,
            "balls_remaining": live_balls_remaining(overs),
        },
        "projected": projected,
        "win_probability": wp,
        "win_probability_history": [],
        "momentum": None,
        "pressure": pressure,
        "ball_timeline": {"this_over": [], "last_over": [], "last_wicket_desc": fow[-1].get("name", "") + " @" + str(fow[-1].get("over", "")) if fow else ""},
        "batters": batsmen,
        "bowlers": bowlers,
        "partnership": partnership,
        "fall_of_wickets": [{"wicket": w.get("wkt_n", i+1), "score": w.get("runs", 0), "over": str(w.get("over", 0)), "batter": w.get("name", ""), "runs": w.get("runs", 0)} for i, w in enumerate(fow)],
        "phases": {},
        "worm_chart": {},
        "dot_analysis": {},
        "key_matchup": None,
        "ticker_items": [],
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }
    return jsonify(payload)
