import os
import json as _json
import time
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
