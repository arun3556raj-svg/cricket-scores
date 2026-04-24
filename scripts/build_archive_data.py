from __future__ import annotations

import json
import os
import sqlite3
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = Path(
    r"C:/Users/91938/Documents/Codex/ipl_universe_v4.db"
)
FALLBACK_DB_PATH = Path(
    r"C:/Users/91938/Downloads/Dev/IPL Project/ipl_universe.db"
)
OUTPUT_PATH = ROOT / "data" / "archive.json"

TEAM_COLORS = {
    "CSK": "#d97706",
    "DC": "#0ea5e9",
    "DD": "#0ea5e9",
    "GL": "#f97316",
    "GT": "#0f766e",
    "KXP": "#e11d48",
    "PK": "#e11d48",
    "PBKS": "#e11d48",
    "KTK": "#14b8a6",
    "KKR": "#7c3aed",
    "LSG": "#0284c7",
    "MI": "#1d4ed8",
    "PW": "#38bdf8",
    "RR": "#db2777",
    "RPS": "#7c2d12",
    "RCB": "#dc2626",
    "SH": "#ea580c",
    "SRH": "#ea580c",
}

TEAM_SHORT_OVERRIDES = {
    "Kings XI Punjab": "PBKS",
    "Punjab Kings": "PBKS",
    "Sunrisers Hyderabad": "SRH",
}


def resolve_db_path() -> Path:
    env_path = os.environ.get("IPL_UNIVERSE_DB")
    candidates = [
        Path(env_path) if env_path else None,
        DEFAULT_DB_PATH,
        FALLBACK_DB_PATH,
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    raise FileNotFoundError(
        "Could not find IPL Universe DB. Set IPL_UNIVERSE_DB to the database path."
    )


def normalize_short_name(team_name: str, short_name: str | None) -> str:
    return TEAM_SHORT_OVERRIDES.get(team_name) or short_name or team_name[:3].upper()


def format_round(match_type: str | None) -> str:
    value = (match_type or "league").strip()
    return " ".join(part.capitalize() for part in value.split())


def innings_score(innings: dict) -> str:
    runs = innings.get("runs") or 0
    wickets = innings.get("wickets") or 0
    if wickets >= 10:
        return str(runs)
    return f"{runs}/{wickets}"


def result_text(row: sqlite3.Row) -> str:
    winner = row["winner"]
    result = row["result"]
    margin = row["result_margin"]
    if not winner:
        return "No result"
    if not result or margin is None:
        return f"{winner} won"
    if result == "wickets":
        return f"{winner} won by {margin} wkts"
    if result == "runs":
        return f"{winner} won by {margin} runs"
    return f"{winner} won by {margin} {result}"


def load_innings(conn: sqlite3.Connection) -> dict[int, list[dict]]:
    rows = conn.execute(
        """
        select
            i.match_id,
            i.innings_number,
            bt.team_name as batting_team,
            bt.short_name as batting_short,
            bw.team_name as bowling_team,
            bw.short_name as bowling_short,
            i.total_runs,
            i.total_wickets,
            i.total_overs,
            i.target
        from innings i
        join teams bt on bt.team_id = i.batting_team_id
        join teams bw on bw.team_id = i.bowling_team_id
        where i.is_super_over = 0
        order by i.match_id, i.innings_number
        """
    ).fetchall()

    by_match: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        batting_short = normalize_short_name(row["batting_team"], row["batting_short"])
        bowling_short = normalize_short_name(row["bowling_team"], row["bowling_short"])
        by_match[row["match_id"]].append(
            {
                "number": row["innings_number"],
                "team": row["batting_team"],
                "team_short": batting_short,
                "team_color": TEAM_COLORS.get(batting_short, "#818cf8"),
                "opponent": row["bowling_team"],
                "opponent_short": bowling_short,
                "runs": row["total_runs"],
                "wickets": row["total_wickets"],
                "overs": row["total_overs"],
                "target": row["target"],
            }
        )
    return by_match


def build_archive(conn: sqlite3.Connection) -> dict:
    conn.row_factory = sqlite3.Row
    innings_by_match = load_innings(conn)
    rows = conn.execute(
        """
        select
            m.match_id,
            m.cricsheet_id,
            m.season,
            m.match_number,
            m.match_type,
            m.date,
            t1.team_name as team1,
            t1.short_name as team1_short,
            t2.team_name as team2,
            t2.short_name as team2_short,
            w.team_name as winner,
            m.result,
            m.result_margin,
            v.venue_name,
            v.city
        from matches m
        join teams t1 on t1.team_id = m.team1_id
        join teams t2 on t2.team_id = m.team2_id
        left join teams w on w.team_id = m.winner_id
        left join venues v on v.venue_id = m.venue_id
        where m.season >= 2008
        order by m.season desc, m.date desc, coalesce(m.match_number, 9999) desc, m.match_id desc
        """
    ).fetchall()

    teams: dict[str, dict] = {}
    rounds: set[str] = set()
    years: set[int] = set()
    matches = []

    for row in rows:
        team1_short = normalize_short_name(row["team1"], row["team1_short"])
        team2_short = normalize_short_name(row["team2"], row["team2_short"])
        for name, short in ((row["team1"], team1_short), (row["team2"], team2_short)):
            teams[name] = {
                "name": name,
                "short": short,
                "color": TEAM_COLORS.get(short, "#818cf8"),
            }

        round_label = format_round(row["match_type"])
        rounds.add(round_label)
        years.add(row["season"])
        venue_parts = [row["venue_name"], row["city"]]

        innings = innings_by_match.get(row["match_id"], [])
        matches.append(
            {
                "id": str(row["match_id"]),
                "source_id": row["cricsheet_id"],
                "season": row["season"],
                "match_number": row["match_number"],
                "round": round_label,
                "date": row["date"],
                "team1": row["team1"],
                "team1_short": team1_short,
                "team1_color": TEAM_COLORS.get(team1_short, "#818cf8"),
                "team2": row["team2"],
                "team2_short": team2_short,
                "team2_color": TEAM_COLORS.get(team2_short, "#818cf8"),
                "winner": row["winner"],
                "result_text": result_text(row),
                "venue": ", ".join(part for part in venue_parts if part),
                "innings": [
                    {
                        **inn,
                        "display": innings_score(inn),
                        "detail": f"({inn['overs']} ov)",
                    }
                    for inn in innings
                ],
            }
        )

    return {
        "years": sorted(years, reverse=True),
        "teams": sorted(teams.values(), key=lambda item: item["name"]),
        "rounds": sorted(rounds),
        "matches": matches,
    }


def main() -> None:
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    archive = build_archive(conn)
    conn.close()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(archive, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(archive['matches'])} archive matches to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
