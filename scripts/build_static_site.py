from __future__ import annotations

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "dist"
STATIC_DIR = DIST_DIR / "static"
DATA_DIR = DIST_DIR / "data"
SCORECARD_DIR = DATA_DIR / "scorecards"
ARCHIVE_SCORECARD_DIR = DATA_DIR / "archive-scorecards"
TEMPLATE_PATH = ROOT / "templates" / "index.html"
ARCHIVE_SOURCE_PATH = ROOT / "data" / "archive.json"
ARCHIVE_SCORECARD_SOURCE_DIR = ROOT / "data" / "archive-scorecards"
STATS_SOURCE_PATH = ROOT / "data" / "stats-builder.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scraper import get_all_matches, get_schedule
from scorecard import get_scorecard

STATIC_CONFIG_SNIPPET = """
  <script>
    window.PITCH_CONFIG = {
      mode: "static",
      dataBasePath: "./data",
      scorecardBasePath: "./data/scorecards",
      archiveScorecardBasePath: "./data/archive-scorecards",
      statsBuilderPath: "./data/stats-builder.json",
      pointsTablePath: "./data/points-table.json"
    };
  </script>
""".strip()

TEAM_FALLBACK_COLORS = {
    "CSK": "#d97706",
    "DC": "#0ea5e9",
    "DD": "#0ea5e9",
    "GL": "#f97316",
    "GT": "#0f766e",
    "KKR": "#7c3aed",
    "KTK": "#14b8a6",
    "LSG": "#0284c7",
    "MI": "#1d4ed8",
    "PBKS": "#e11d48",
    "PW": "#38bdf8",
    "RCB": "#dc2626",
    "RPS": "#7c2d12",
    "RR": "#db2777",
    "SRH": "#ea580c",
}

FULL_T20_BALLS = 120


def reset_dist() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    SCORECARD_DIR.mkdir(parents=True, exist_ok=True)


def write_index() -> None:
    html = TEMPLATE_PATH.read_text(encoding="utf-8")
    marker = '<script src="static/app.js"></script>'
    if marker not in html:
        raise RuntimeError("Could not find app.js script tag in template.")
    html = html.replace(marker, f"{STATIC_CONFIG_SNIPPET}\n  {marker}", 1)
    (DIST_DIR / "index.html").write_text(html, encoding="utf-8")


def copy_static_assets() -> None:
    shutil.copytree(ROOT / "static", STATIC_DIR, dirs_exist_ok=True)
    (DIST_DIR / ".nojekyll").write_text("", encoding="utf-8")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path, fallback: dict | None = None) -> dict:
    if not path.exists():
        return fallback or {}
    return json.loads(path.read_text(encoding="utf-8"))


def copy_archive_data() -> None:
    if ARCHIVE_SOURCE_PATH.exists():
        shutil.copy2(ARCHIVE_SOURCE_PATH, DATA_DIR / "archive.json")
    if ARCHIVE_SCORECARD_SOURCE_DIR.exists():
        shutil.copytree(ARCHIVE_SCORECARD_SOURCE_DIR, ARCHIVE_SCORECARD_DIR, dirs_exist_ok=True)
    if STATS_SOURCE_PATH.exists():
        shutil.copy2(STATS_SOURCE_PATH, DATA_DIR / "stats-builder.json")


def collect_scorecard_targets(matches: dict, schedule: dict) -> dict[str, dict]:
    targets: dict[str, dict] = {}
    for bucket in ("live", "upcoming", "finished"):
        for match in matches.get(bucket, []):
            targets[match["id"]] = {
                "team1_short": match["team1_short"],
                "team2_short": match["team2_short"],
                "status": match.get("status", bucket),
            }
    for match in schedule.get("matches", []):
        targets[match["id"]] = {
            "team1_short": match["team1_short"],
            "team2_short": match["team2_short"],
            "status": match.get("status", "upcoming"),
        }
    return targets


def build_scorecards(targets: dict[str, dict]) -> dict[str, dict]:
    scorecards: dict[str, dict] = {}
    for match_id, target in sorted(targets.items()):
        if target["status"] == "upcoming":
            scorecard = {"innings": [], "error": None}
        else:
            scorecard = get_scorecard(match_id, target["team1_short"], target["team2_short"])
        scorecards[match_id] = scorecard
        write_json(SCORECARD_DIR / f"{match_id}.json", scorecard)
    return scorecards


def parse_match_number(match_desc: str | None) -> int | None:
    match = re.search(r"\d+", match_desc or "")
    return int(match.group(0)) if match else None


def parse_match_date(match: dict) -> str:
    if match.get("start_epoch"):
        return datetime.fromtimestamp(int(match["start_epoch"]) / 1000).strftime("%Y-%m-%d")
    value = match.get("match_date") or ""
    try:
        return datetime.strptime(value, "%a, %d %b %Y").strftime("%Y-%m-%d")
    except ValueError:
        return value


def team_identity(team1: str, team2: str, date: str, match_number: int | None) -> tuple:
    return (
        date,
        match_number,
        tuple(sorted((team1.strip().lower(), team2.strip().lower()))),
    )


def official_match_keys(archive: dict) -> set[tuple]:
    return {
        team_identity(match["team1"], match["team2"], match["date"], match.get("match_number"))
        for match in archive.get("matches", [])
    }


def latest_official_position(archive: dict) -> tuple[str, int]:
    official = archive.get("matches", [])
    if not official:
        return "", 0
    latest_date = max(match.get("date", "") for match in official)
    latest_number = max(
        (match.get("match_number") or 0 for match in official if match.get("date") == latest_date),
        default=0,
    )
    return latest_date, latest_number


def overs_to_balls(value: Any) -> int:
    if value is None:
        return 0
    whole, _, fraction = str(value).partition(".")
    try:
        return int(whole or 0) * 6 + int((fraction or "0")[0])
    except ValueError:
        return 0


def balls_to_overs(balls: int) -> str:
    overs, remainder = divmod(max(0, balls), 6)
    return str(overs) if remainder == 0 else f"{overs}.{remainder}"


def nrr_balls(score: dict) -> int:
    balls = overs_to_balls(score.get("overs"))
    if score.get("wickets", 0) >= 10 and balls < FULL_T20_BALLS:
        return FULL_T20_BALLS
    return balls


def score_display(score: dict) -> str:
    runs = score.get("runs", 0)
    wickets = score.get("wickets", 0)
    return str(runs) if wickets >= 10 else f"{runs}/{wickets}"


def team_short(match: dict, team_name: str) -> str:
    if team_name == match.get("team1"):
        return match.get("team1_short", "")
    if team_name == match.get("team2"):
        return match.get("team2_short", "")
    return "".join(part[0] for part in team_name.split()[:3]).upper()


def team_color(match: dict, team_name: str) -> str:
    if team_name == match.get("team1"):
        return match.get("team1_color") or TEAM_FALLBACK_COLORS.get(match.get("team1_short"), "#818cf8")
    if team_name == match.get("team2"):
        return match.get("team2_color") or TEAM_FALLBACK_COLORS.get(match.get("team2_short"), "#818cf8")
    return TEAM_FALLBACK_COLORS.get(team_short(match, team_name), "#818cf8")


def build_archive_innings(match: dict, scorecard: dict) -> list[dict]:
    innings = []
    previous_runs: int | None = None
    for index, inn in enumerate(scorecard.get("innings") or [], start=1):
        score = inn.get("score") or {}
        batting = inn.get("bat_team", "")
        bowling = inn.get("bowl_team", "")
        target = None if previous_runs is None else previous_runs + 1
        innings.append(
            {
                "number": index,
                "team": batting,
                "team_short": team_short(match, batting),
                "team_color": team_color(match, batting),
                "opponent": bowling,
                "opponent_short": team_short(match, bowling),
                "runs": score.get("runs", 0),
                "wickets": score.get("wickets", 0),
                "overs": score.get("overs", 0),
                "target": target,
                "display": score_display(score),
                "detail": f"({score.get('overs', 0)} ov)",
            }
        )
        previous_runs = score.get("runs", 0)
    return innings


def infer_winner(match: dict) -> str | None:
    status = match.get("status_text") or ""
    for team in (match.get("team1"), match.get("team2")):
        if team and status.lower().startswith(team.lower()):
            return team
    return None


def build_provisional_matches(archive: dict, schedule: dict, scorecards: dict[str, dict]) -> list[dict]:
    keys = official_match_keys(archive)
    latest_date, latest_number = latest_official_position(archive)
    provisional = []

    for match in schedule.get("matches", []):
        if match.get("status") != "finished":
            continue
        match_date = parse_match_date(match)
        match_number = parse_match_number(match.get("match_desc"))
        if team_identity(match["team1"], match["team2"], match_date, match_number) in keys:
            continue
        if match_date < latest_date:
            continue
        if match_date == latest_date and (match_number or 0) <= latest_number:
            continue

        scorecard = scorecards.get(match["id"]) or {"innings": []}
        if len(scorecard.get("innings") or []) < 2:
            continue

        provisional.append(
            {
                "id": f"prov-{match['id']}",
                "source_id": match["id"],
                "source": "cricbuzz",
                "provisional": True,
                "season": 2026,
                "match_number": match_number,
                "round": "League",
                "date": match_date,
                "team1": match["team1"],
                "team1_short": match["team1_short"],
                "team1_color": match.get("team1_color") or TEAM_FALLBACK_COLORS.get(match["team1_short"], "#818cf8"),
                "team2": match["team2"],
                "team2_short": match["team2_short"],
                "team2_color": match.get("team2_color") or TEAM_FALLBACK_COLORS.get(match["team2_short"], "#818cf8"),
                "winner": infer_winner(match),
                "result_text": match.get("status_text", ""),
                "venue": match.get("venue", ""),
                "innings": build_archive_innings(match, scorecard),
            }
        )

    return sorted(
        provisional,
        key=lambda item: (item["season"], item["date"], item.get("match_number") or 0),
        reverse=True,
    )


def write_provisional_scorecards(provisional: list[dict], scorecards: dict[str, dict]) -> None:
    for match in provisional:
        scorecard = scorecards.get(match["source_id"]) or {"innings": [], "error": None}
        payload = {
            "match_id": match["id"],
            "source_id": match["source_id"],
            "source": "cricbuzz",
            "provisional": True,
            "season": match["season"],
            "round": match["round"],
            "match_number": match["match_number"],
            "date": match["date"],
            "team1": match["team1"],
            "team2": match["team2"],
            "venue": match["venue"],
            "result_text": match["result_text"],
            "innings": scorecard.get("innings", []),
            "error": scorecard.get("error"),
        }
        write_json(ARCHIVE_SCORECARD_DIR / f"{match['id']}.json", payload)


def merge_archive(archive: dict, provisional: list[dict]) -> dict:
    if not provisional:
        return archive
    merged = json.loads(json.dumps(archive))
    existing_team_names = {team["name"] for team in merged.get("teams", [])}
    for match in provisional:
        for name, short, color in (
            (match["team1"], match["team1_short"], match["team1_color"]),
            (match["team2"], match["team2_short"], match["team2_color"]),
        ):
            if name not in existing_team_names:
                merged.setdefault("teams", []).append({"name": name, "short": short, "color": color})
                existing_team_names.add(name)
    merged["matches"] = sorted(
        provisional + merged.get("matches", []),
        key=lambda item: (item["season"], item["date"], item.get("match_number") or 0, str(item["id"])),
        reverse=True,
    )
    merged["years"] = sorted({match["season"] for match in merged["matches"]}, reverse=True)
    merged["teams"] = sorted(merged.get("teams", []), key=lambda item: item["name"])
    merged["rounds"] = sorted({match["round"] for match in merged["matches"]})
    return merged


def augment_matches_payload(matches: dict, provisional: list[dict]) -> dict:
    if not provisional:
        return matches
    merged = json.loads(json.dumps(matches))
    provisional_by_source = {match["source_id"]: match for match in provisional}
    for match in merged.get("finished", []):
        if match.get("id") in provisional_by_source:
            match["provisional"] = True
            match["source"] = "cricbuzz"
    existing_ids = {match.get("id") for match in merged.get("finished", [])}
    for match in provisional:
        if match["source_id"] in existing_ids:
            continue
        innings_by_team = {inn["team"]: inn for inn in match.get("innings", [])}
        t1 = innings_by_team.get(match["team1"])
        t2 = innings_by_team.get(match["team2"])
        merged.setdefault("finished", []).append(
            {
                "id": match["source_id"],
                "series": "IPL 2026",
                "match_desc": f"{match['match_number']}th Match" if match.get("match_number") else "IPL Match",
                "match_format": "T20",
                "team1": match["team1"],
                "team1_short": match["team1_short"],
                "team1_color": match["team1_color"],
                "team2": match["team2"],
                "team2_short": match["team2_short"],
                "team2_color": match["team2_color"],
                "team1_score1": inning_to_score(t1),
                "team1_score2": None,
                "team2_score1": inning_to_score(t2),
                "team2_score2": None,
                "venue": match["venue"],
                "status": "finished",
                "status_text": match["result_text"],
                "start_time": None,
                "start_epoch": None,
                "run_rate": None,
                "provisional": True,
                "source": "cricbuzz",
            }
        )
    merged["finished"] = sorted(
        merged.get("finished", []),
        key=lambda item: (parse_match_number(item.get("match_desc")) or 0, item.get("id", "")),
        reverse=True,
    )
    return merged


def inning_to_score(innings: dict | None) -> dict | None:
    if not innings:
        return None
    return {
        "display": innings.get("display"),
        "detail": innings.get("detail"),
        "runs": innings.get("runs"),
        "wickets": innings.get("wickets"),
        "overs": innings.get("overs"),
    }


def merge_stats(stats: dict, provisional: list[dict], scorecards: dict[str, dict]) -> dict:
    if not provisional:
        return stats
    merged = json.loads(json.dumps(stats))
    batting = merged.setdefault("batting", [])
    bowling = merged.setdefault("bowling", [])
    for match in provisional:
        scorecard = scorecards.get(match["source_id"]) or {}
        for innings in scorecard.get("innings", []):
            bat_team = innings.get("bat_team", "")
            bowl_team = innings.get("bowl_team", "")
            for batter in innings.get("batsmen", []):
                batting.append(
                    {
                        "m": match["id"],
                        "y": match["season"],
                        "r": match["round"],
                        "v": match["venue"] or "Unknown venue",
                        "t": bat_team,
                        "o": bowl_team,
                        "p": batter.get("name", ""),
                        "ru": batter.get("runs", 0),
                        "b": batter.get("balls", 0),
                        "fo": batter.get("fours", 0),
                        "si": batter.get("sixes", 0),
                        "out": 0 if batter.get("not_out") else 1,
                        "provisional": True,
                    }
                )
            for bowler in innings.get("bowlers", []):
                bowling.append(
                    {
                        "m": match["id"],
                        "y": match["season"],
                        "r": match["round"],
                        "v": match["venue"] or "Unknown venue",
                        "t": bowl_team,
                        "o": bat_team,
                        "p": bowler.get("name", ""),
                        "b": bowler.get("balls") or overs_to_balls(bowler.get("overs")),
                        "ru": bowler.get("runs", 0),
                        "w": bowler.get("wickets", 0),
                        "d": bowler.get("dots", 0),
                        "md": bowler.get("maidens", 0),
                        "provisional": True,
                    }
                )
    merged["years"] = sorted(set(merged.get("years", [])) | {match["season"] for match in provisional}, reverse=True)
    merged["teams"] = sorted(set(merged.get("teams", [])) | {match["team1"] for match in provisional} | {match["team2"] for match in provisional})
    merged["venues"] = sorted(set(merged.get("venues", [])) | {match["venue"] for match in provisional if match.get("venue")})
    merged["rounds"] = sorted(set(merged.get("rounds", [])) | {match["round"] for match in provisional})
    return merged


def build_points_table(archive: dict) -> dict:
    tables: dict[str, dict] = {}
    for year in archive.get("years", []):
        standings: dict[str, dict] = {}
        league_matches = [
            match
            for match in archive.get("matches", [])
            if match.get("season") == year and match.get("round") == "League"
        ]
        for match in league_matches:
            innings = match.get("innings") or []
            if len(innings) < 2:
                continue
            for team in (match["team1"], match["team2"]):
                standings.setdefault(team, empty_points_row(match, team))

            innings_by_team = {inn["team"]: inn for inn in innings}
            winner = match.get("winner")
            for team, opponent in ((match["team1"], match["team2"]), (match["team2"], match["team1"])):
                row = standings[team]
                own = innings_by_team.get(team)
                opp = innings_by_team.get(opponent)
                if not own or not opp:
                    continue
                row["played"] += 1
                row["runs_for"] += own.get("runs", 0)
                row["balls_for"] += nrr_balls(own)
                row["wickets_lost"] += own.get("wickets", 0)
                row["runs_against"] += opp.get("runs", 0)
                row["balls_against"] += nrr_balls(opp)
                row["wickets_taken"] += opp.get("wickets", 0)
                row["provisional_matches"] += 1 if match.get("provisional") else 0

                if winner == team:
                    row["won"] += 1
                    row["points"] += 2
                elif winner == opponent:
                    row["lost"] += 1
                else:
                    row["no_result"] += 1
                    row["points"] += 1

        rows = [finalize_points_row(row) for row in standings.values()]
        rows.sort(key=lambda row: (-row["points"], -row["nrr"], -row["won"], row["team"]))
        tables[str(year)] = {
            "season": year,
            "enhanced": year == 2026,
            "source_note": "Includes provisional Cricbuzz results." if any(row["provisional_matches"] for row in rows) else "Official Cricsheet archive.",
            "rows": rows,
        }
    return {"years": archive.get("years", []), "tables": tables}


def empty_points_row(match: dict, team: str) -> dict:
    if team == match["team1"]:
        short = match["team1_short"]
        color = match["team1_color"]
    else:
        short = match["team2_short"]
        color = match["team2_color"]
    return {
        "team": team,
        "team_short": short,
        "team_color": color,
        "played": 0,
        "won": 0,
        "lost": 0,
        "no_result": 0,
        "points": 0,
        "runs_for": 0,
        "balls_for": 0,
        "wickets_lost": 0,
        "runs_against": 0,
        "balls_against": 0,
        "wickets_taken": 0,
        "provisional_matches": 0,
    }


def finalize_points_row(row: dict) -> dict:
    for_rate = (row["runs_for"] * 6 / row["balls_for"]) if row["balls_for"] else 0
    against_rate = (row["runs_against"] * 6 / row["balls_against"]) if row["balls_against"] else 0
    return {
        **row,
        "nrr": round(for_rate - against_rate, 3),
        "overs_for": balls_to_overs(row["balls_for"]),
        "overs_against": balls_to_overs(row["balls_against"]),
    }


def main() -> None:
    reset_dist()
    write_index()
    copy_static_assets()

    matches = get_all_matches()
    schedule = get_schedule()
    scorecards = build_scorecards(collect_scorecard_targets(matches, schedule))

    copy_archive_data()
    official_archive = read_json(ARCHIVE_SOURCE_PATH, {"years": [], "teams": [], "rounds": [], "matches": []})
    official_stats = read_json(STATS_SOURCE_PATH, {"years": [], "teams": [], "venues": [], "rounds": [], "batting": [], "bowling": []})

    provisional = build_provisional_matches(official_archive, schedule, scorecards)
    combined_archive = merge_archive(official_archive, provisional)
    combined_stats = merge_stats(official_stats, provisional, scorecards)
    points_table = build_points_table(combined_archive)
    combined_matches = augment_matches_payload(matches, provisional)

    write_json(DATA_DIR / "matches.json", combined_matches)
    write_json(DATA_DIR / "schedule.json", schedule)
    write_json(DATA_DIR / "archive.json", combined_archive)
    write_json(DATA_DIR / "stats-builder.json", combined_stats)
    write_json(DATA_DIR / "points-table.json", points_table)
    write_provisional_scorecards(provisional, scorecards)

    if provisional:
        print(f"Added {len(provisional)} provisional Cricbuzz result(s) to static data")


if __name__ == "__main__":
    main()
