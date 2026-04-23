import re
import json
import traceback
from datetime import datetime
from http_utils import fetch_text

URL          = "https://www.cricbuzz.com/cricket-match/live-scores"
SCHEDULE_URL = "https://www.cricbuzz.com/cricket-series/9241/indian-premier-league-2026/matches"

IPL_TEAMS = {
    "Mumbai Indians":                    {"short": "MI",   "color": "#1d4ed8"},
    "Chennai Super Kings":               {"short": "CSK",  "color": "#d97706"},
    "Royal Challengers Bengaluru":       {"short": "RCB",  "color": "#dc2626"},
    "Royal Challengers Bangalore":       {"short": "RCB",  "color": "#dc2626"},
    "Kolkata Knight Riders":             {"short": "KKR",  "color": "#7c3aed"},
    "Delhi Capitals":                    {"short": "DC",   "color": "#0ea5e9"},
    "Sunrisers Hyderabad":               {"short": "SRH",  "color": "#ea580c"},
    "Punjab Kings":                      {"short": "PBKS", "color": "#e11d48"},
    "Rajasthan Royals":                  {"short": "RR",   "color": "#db2777"},
    "Gujarat Titans":                    {"short": "GT",   "color": "#0f766e"},
    "Lucknow Super Giants":              {"short": "LSG",  "color": "#0284c7"},
}


def _fetch_type_matches():
    html = fetch_text(URL, timeout=15)

    pushes = re.findall(r"__next_f\.push\(\[(\d+),(.*?)\]\)", html, re.DOTALL)
    for typ, val in pushes:
        if typ != "1":
            continue
        try:
            decoded = json.loads(val)
        except Exception:
            continue
        if not isinstance(decoded, str) or "seriesAdWrapper" not in decoded:
            continue
        # Find the outer array that wraps the React tree
        m = re.search(r"\[\[.*\]\]", decoded, re.DOTALL)
        if not m:
            continue
        try:
            outer = json.loads(m.group())
        except Exception:
            continue
        tm = _deep_find(outer, "typeMatches")
        if tm:
            return tm
    return []


def _deep_find(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _deep_find(v, key)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for item in obj:
            r = _deep_find(item, key)
            if r is not None:
                return r
    return None


def _fmt_score(innings):
    if not innings:
        return None
    runs = innings.get("runs", 0)
    wkts = innings.get("wickets", 0)
    overs = innings.get("overs", 0)
    detail = f"({overs} ov)"
    if wkts == 10:
        return {"display": str(runs), "detail": detail, "runs": runs, "wickets": wkts, "overs": overs}
    return {"display": f"{runs}/{wkts}", "detail": detail, "runs": runs, "wickets": wkts, "overs": overs}


def _calc_rr(innings):
    if not innings:
        return None
    runs = innings.get("runs", 0)
    overs = innings.get("overs", 0)
    if overs and overs > 0:
        return round(runs / overs, 2)
    return None


def _parse_match(match_data):
    info  = match_data.get("matchInfo", {})
    score = match_data.get("matchScore", {})

    team1_info = info.get("team1", {})
    team2_info = info.get("team2", {})
    venue_info = info.get("venueInfo", {})

    state = info.get("state", "").lower()
    if any(k in state for k in ("live", "in progress", "innings break", "toss")):
        status = "live"
    elif any(k in state for k in ("complete", "finish", "drawn", "abandoned", "cancelled", "no result")):
        status = "finished"
    else:
        status = "upcoming"

    t1_score = score.get("team1Score", {})
    t2_score = score.get("team2Score", {})

    t1_i1 = _fmt_score(t1_score.get("inngs1"))
    t1_i2 = _fmt_score(t1_score.get("inngs2"))
    t2_i1 = _fmt_score(t2_score.get("inngs1"))
    t2_i2 = _fmt_score(t2_score.get("inngs2"))

    # Identify the active innings for run rate
    current = None
    if status == "live":
        if t2_i1 and not t2_i2:
            current = t2_score.get("inngs1")
        elif t1_i1 and not t2_i1:
            current = t1_score.get("inngs1")

    rr = _calc_rr(current)

    start_ms = info.get("startDate", 0)
    start_time = start_epoch = None
    if start_ms:
        try:
            dt = datetime.fromtimestamp(int(start_ms) / 1000)
            start_time  = dt.strftime("%I:%M %p")
            start_epoch = int(start_ms)
        except Exception:
            pass

    t1_name = team1_info.get("teamName", "Team 1")
    t2_name = team2_info.get("teamName", "Team 2")
    t1_meta = IPL_TEAMS.get(t1_name, {})
    t2_meta = IPL_TEAMS.get(t2_name, {})

    venue_parts = [venue_info.get("ground", ""), venue_info.get("city", "")]
    venue_str   = ", ".join(p for p in venue_parts if p)

    return {
        "id":           str(info.get("matchId", "")),
        "series":       info.get("seriesName", ""),
        "match_desc":   info.get("matchDesc", ""),
        "match_format": info.get("matchFormat", "T20"),
        "team1":        t1_name,
        "team1_short":  t1_meta.get("short") or team1_info.get("teamSName", t1_name[:3].upper()),
        "team1_color":  t1_meta.get("color", "#6366f1"),
        "team2":        t2_name,
        "team2_short":  t2_meta.get("short") or team2_info.get("teamSName", t2_name[:3].upper()),
        "team2_color":  t2_meta.get("color", "#6366f1"),
        "team1_score1": t1_i1,
        "team1_score2": t1_i2,
        "team2_score1": t2_i1,
        "team2_score2": t2_i2,
        "venue":        venue_str,
        "status":       status,
        "status_text":  info.get("status", ""),
        "start_time":   start_time,
        "start_epoch":  start_epoch,
        "run_rate":     rr,
    }


def get_all_matches():
    try:
        type_matches = _fetch_type_matches()
        live, upcoming, finished = [], [], []

        for type_match in type_matches:
            for series_entry in type_match.get("seriesMatches", []):
                wrapper = series_entry.get("seriesAdWrapper", {})
                if not wrapper:
                    continue
                series_name = wrapper.get("seriesName", "")
                if "IPL" not in series_name.upper():
                    continue
                for match in wrapper.get("matches", []):
                    try:
                        parsed = _parse_match(match)
                    except Exception:
                        continue
                    if parsed["status"] == "live":
                        live.append(parsed)
                    elif parsed["status"] == "upcoming":
                        upcoming.append(parsed)
                    else:
                        finished.append(parsed)

        return {
            "live":         live,
            "upcoming":     upcoming,
            "finished":     finished,
            "last_updated": datetime.now().strftime("%d %b, %I:%M %p"),
            "error":        None,
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "live":         [],
            "upcoming":     [],
            "finished":     [],
            "last_updated": datetime.now().strftime("%d %b, %I:%M %p"),
            "error":        str(e),
        }


def _extract_match_details(html: str) -> list:
    """Extract the matchDetails array from a Cricbuzz series/schedule page."""
    pushes = re.findall(r"__next_f\.push\(\[(\d+),(.*?)\]\)", html, re.DOTALL)
    for typ, val in pushes:
        if typ != "1":
            continue
        try:
            decoded = json.loads(val)
        except Exception:
            continue
        if not isinstance(decoded, str) or "matchDetailsMap" not in decoded:
            continue
        # Use brace/bracket counting to extract the full matchDetails array
        key = '"matchDetails":['
        idx = decoded.find(key)
        if idx == -1:
            continue
        start = idx + len(key) - 1
        depth = 0
        i = start
        while i < len(decoded):
            c = decoded[i]
            if c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        try:
            return json.loads(decoded[start:i + 1])
        except Exception:
            continue
    return []


def _parse_schedule_match(info: dict) -> dict:
    """Parse a matchInfo dict from the schedule page into a flat match record."""
    t1      = info.get("team1", {})
    t2      = info.get("team2", {})
    venue   = info.get("venueInfo", {})
    t1_name = t1.get("teamName", "Team 1")
    t2_name = t2.get("teamName", "Team 2")
    t1_meta = IPL_TEAMS.get(t1_name, {})
    t2_meta = IPL_TEAMS.get(t2_name, {})

    state_raw = info.get("state", "").lower()
    if any(k in state_raw for k in ("live", "in progress", "innings break", "toss")):
        status = "live"
    elif any(k in state_raw for k in ("complete", "finish", "drawn", "abandoned", "cancelled", "no result")):
        status = "finished"
    else:
        status = "upcoming"

    start_ms   = info.get("startDate", 0)
    start_time = start_epoch = None
    if start_ms:
        try:
            dt = datetime.fromtimestamp(int(start_ms) / 1000)
            start_time  = dt.strftime("%I:%M %p")
            start_epoch = int(start_ms)
        except Exception:
            pass

    venue_str = ", ".join(
        p for p in [venue.get("ground", ""), venue.get("city", "")] if p
    )

    return {
        "id":          str(info.get("matchId", "")),
        "series":      info.get("seriesName", ""),
        "match_desc":  info.get("matchDesc", ""),
        "team1":       t1_name,
        "team1_short": t1_meta.get("short") or t1.get("teamSName", t1_name[:3].upper()),
        "team1_color": t1_meta.get("color", "#6366f1"),
        "team2":       t2_name,
        "team2_short": t2_meta.get("short") or t2.get("teamSName", t2_name[:3].upper()),
        "team2_color": t2_meta.get("color", "#6366f1"),
        "venue":       venue_str,
        "status":      status,
        "status_text": info.get("status", ""),
        "start_time":  start_time,
        "start_epoch": start_epoch,
    }


def get_schedule() -> dict:
    """Return every IPL 2026 match from the series schedule page."""
    try:
        html         = fetch_text(SCHEDULE_URL)
        match_detail = _extract_match_details(html)
        matches      = []
        current_date = None

        for item in match_detail:
            mdm  = item.get("matchDetailsMap", {})
            date = mdm.get("key", "")
            for m in mdm.get("match", []):
                info = m.get("matchInfo", {})
                sn_upper = info.get("seriesName", "").upper()
                if "IPL" not in sn_upper and "INDIAN PREMIER LEAGUE" not in sn_upper:
                    continue
                parsed = _parse_schedule_match(info)
                parsed["match_date"] = date
                matches.append(parsed)

        return {
            "matches":      matches,
            "last_updated": datetime.now().strftime("%d %b, %I:%M %p"),
            "error":        None,
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "matches":      [],
            "last_updated": datetime.now().strftime("%d %b, %I:%M %p"),
            "error":        str(e),
        }
