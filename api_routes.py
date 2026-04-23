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
