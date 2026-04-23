"""
scorecard.py — Fetch detailed innings data from Cricbuzz scorecard page.
Returns structured batting, bowling, extras, FOW for each innings.
"""
import re
import json
import traceback
from http_utils import fetch_text


def _make_slug(t1: str, t2: str) -> str:
    """Construct Cricbuzz URL slug from team short names."""
    return f"{t1.lower()}-vs-{t2.lower()}-ipl-2026"


def _fetch_raw(match_id: str, slug: str) -> str:
    url = f"https://www.cricbuzz.com/live-cricket-scorecard/{match_id}/{slug}"
    return fetch_text(url, timeout=15)


def _extract_scorecard_json(html: str) -> list:
    """Pull the scoreCard array out of the Next.js RSC payload."""
    pushes = re.findall(r"__next_f\.push\(\[(\d+),(.*?)\]\)", html, re.DOTALL)
    for typ, val in pushes:
        if typ != "1":
            continue
        try:
            decoded = json.loads(val)
        except Exception:
            continue
        if not isinstance(decoded, str) or "batTeamDetails" not in decoded:
            continue
        # Extract the scoreCard array — it ends before matchHeader/respondBy
        m = re.search(
            r'"scoreCard":(\[.*?\])(?=\s*,\s*"(?:matchHeader|respondBy|miniscore)")',
            decoded,
            re.DOTALL,
        )
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                # Try relaxed extraction — sometimes trailing data breaks strict parse
                raw = m.group(1)
                # Find each innings object
                return _split_innings(raw)
    return []


def _split_innings(raw: str) -> list:
    """Best-effort split of concatenated innings JSON objects."""
    results = []
    depth = 0
    start = None
    for i, ch in enumerate(raw):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    results.append(json.loads(raw[start : i + 1]))
                except Exception:
                    pass
                start = None
    return results


def _parse_innings(inns: dict) -> dict:
    bat_team = inns.get("batTeamDetails", {})
    bowl_team = inns.get("bowlTeamDetails", {})
    score = inns.get("scoreDetails", {})
    extras = inns.get("extrasData", {})
    wkts_raw = inns.get("wicketsData", {})

    # ── Batting ─────────────────────────────────────────────────
    batsmen = []
    for b in bat_team.get("batsmenData", {}).values():
        batsmen.append({
            "name":        b.get("batName", ""),
            "runs":        b.get("runs", 0),
            "balls":       b.get("balls", 0),
            "fours":       b.get("fours", 0),
            "sixes":       b.get("sixes", 0),
            "strike_rate": b.get("strikeRate", 0.0),
            "out_desc":    b.get("outDesc", ""),
            "is_captain":  b.get("isCaptain", False),
            "is_keeper":   b.get("isKeeper", False),
            "not_out":     not bool(b.get("outDesc", "").strip()),
        })

    # ── Bowling ──────────────────────────────────────────────────
    bowlers = []
    for bw in bowl_team.get("bowlersData", {}).values():
        bowlers.append({
            "name":     bw.get("bowlName", ""),
            "overs":    bw.get("overs", 0),
            "maidens":  bw.get("maidens", 0),
            "runs":     bw.get("runs", 0),
            "wickets":  bw.get("wickets", 0),
            "economy":  bw.get("economy", 0.0),
            "wides":    bw.get("wides", 0),
            "no_balls": bw.get("no_balls", 0),
        })

    # ── Fall of wickets ──────────────────────────────────────────
    fow = []
    for w in wkts_raw.values():
        fow.append({
            "name":  w.get("batName", ""),
            "runs":  w.get("wktRuns", 0),
            "over":  w.get("wktOver", 0),
            "wkt_n": w.get("wktNbr", 0),
        })
    fow.sort(key=lambda x: x["wkt_n"])

    return {
        "bat_team":  bat_team.get("batTeamName", ""),
        "bowl_team": bowl_team.get("bowlTeamName", ""),
        "innings_id": inns.get("inningsId", 1),
        "score": {
            "runs":     score.get("runs", 0),
            "wickets":  score.get("wickets", 0),
            "overs":    score.get("overs", 0),
            "run_rate": round(score.get("runRate", 0), 2),
            "declared": score.get("isDeclared", False),
        },
        "extras": {
            "total":    extras.get("total", 0),
            "wides":    extras.get("wides", 0),
            "no_balls": extras.get("noBalls", 0),
            "byes":     extras.get("byes", 0),
            "leg_byes": extras.get("legByes", 0),
        },
        "batsmen":  batsmen,
        "bowlers":  bowlers,
        "fow":      fow,
    }


def get_scorecard(match_id: str, team1_short: str, team2_short: str) -> dict:
    try:
        slug = _make_slug(team1_short, team2_short)
        html = _fetch_raw(match_id, slug)
        raw_innings = _extract_scorecard_json(html)
        innings = [_parse_innings(i) for i in raw_innings if i]
        return {"innings": innings, "error": None}
    except Exception as e:
        traceback.print_exc()
        return {"innings": [], "error": str(e)}
