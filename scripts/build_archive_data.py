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
SCORECARD_OUTPUT_DIR = ROOT / "data" / "archive-scorecards"
STATS_OUTPUT_PATH = ROOT / "data" / "stats-builder.json"

BOWLER_WICKET_TYPES = {
    "bowled",
    "caught",
    "caught and bowled",
    "hit wicket",
    "lbw",
    "stumped",
}
LEGAL_EXTRAS = {"wides", "noballs"}
BATTER_BALL_EXTRAS = {"wides", "noballs"}
EXTRAS_NOT_CHARGED_TO_BOWLER = {"byes", "legbyes", "penalty"}
NON_FOW_WICKET_TYPES = {"retired hurt"}

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


def balls_to_overs(balls: int) -> str:
    overs, remainder = divmod(max(0, balls), 6)
    return str(overs) if remainder == 0 else f"{overs}.{remainder}"


def overs_value(value: float | int | None) -> str:
    if value is None:
        return "0"
    numeric = float(value)
    return str(int(numeric)) if numeric.is_integer() else str(numeric)


def legal_delivery(row: sqlite3.Row) -> bool:
    return row["extras_type"] not in LEGAL_EXTRAS


def batter_ball(row: sqlite3.Row) -> bool:
    return row["extras_type"] not in BATTER_BALL_EXTRAS


def bowler_runs(row: sqlite3.Row) -> int:
    if row["extras_type"] in EXTRAS_NOT_CHARGED_TO_BOWLER:
        return row["runs_batter"] or 0
    return row["runs_total"] or 0


def result_is_fow(row: sqlite3.Row) -> bool:
    return bool(row["is_wicket"] and row["player_out_id"] and row["wicket_type"] not in NON_FOW_WICKET_TYPES)


def dismissal_text(row: sqlite3.Row) -> str:
    wicket_type = row["wicket_type"] or "out"
    bowler = row["bowler"] or ""
    fielder1 = row["fielder1"] or ""
    fielder2 = row["fielder2"] or ""
    fielders = " / ".join(part for part in (fielder1, fielder2) if part)

    if wicket_type == "bowled":
        return f"b {bowler}".strip()
    if wicket_type == "lbw":
        return f"lbw b {bowler}".strip()
    if wicket_type == "caught":
        return f"c {fielder1} b {bowler}".strip()
    if wicket_type == "caught and bowled":
        return f"c & b {bowler}".strip()
    if wicket_type == "stumped":
        return f"st {fielder1} b {bowler}".strip()
    if wicket_type == "hit wicket":
        return f"hit wicket b {bowler}".strip()
    if wicket_type == "run out":
        return f"run out ({fielders})" if fielders else "run out"
    if wicket_type in {"retired hurt", "retired out", "obstructing the field"}:
        return wicket_type
    return f"{wicket_type} b {bowler}".strip()


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


def build_batter_entry(player_id: int, name: str) -> dict:
    return {
        "player_id": player_id,
        "name": name,
        "runs": 0,
        "balls": 0,
        "fours": 0,
        "sixes": 0,
        "strike_rate": 0.0,
        "out_desc": "",
        "is_captain": False,
        "is_keeper": False,
        "not_out": True,
    }


def build_bowler_entry(player_id: int, name: str) -> dict:
    return {
        "player_id": player_id,
        "name": name,
        "balls": 0,
        "maidens": 0,
        "runs": 0,
        "wickets": 0,
        "economy": 0.0,
        "wides": 0,
        "no_balls": 0,
    }


def delivery_marker(row: sqlite3.Row) -> str:
    if row["is_wicket"] and result_is_fow(row):
        return "W"
    if row["is_six"]:
        return "6"
    if row["is_four"]:
        return "4"
    if row["extras_type"] == "wides":
        return "Wd"
    if row["extras_type"] == "noballs":
        return "Nb"
    return str(row["runs_total"] or 0)


def scorecard_delivery_rows(conn: sqlite3.Connection, innings_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        """
        select
            d.*,
            batter.player_name as batter,
            bowler.player_name as bowler,
            non_striker.player_name as non_striker,
            player_out.player_name as player_out,
            fielder1.player_name as fielder1,
            fielder2.player_name as fielder2
        from deliveries d
        join players batter on batter.player_id = d.batter_id
        join players bowler on bowler.player_id = d.bowler_id
        join players non_striker on non_striker.player_id = d.non_striker_id
        left join players player_out on player_out.player_id = d.player_out_id
        left join players fielder1 on fielder1.player_id = d.fielder1_id
        left join players fielder2 on fielder2.player_id = d.fielder2_id
        where d.innings_id = ?
        order by d.delivery_id
        """,
        (innings_id,),
    ).fetchall()


def build_innings_scorecard(conn: sqlite3.Connection, inn: sqlite3.Row) -> dict:
    deliveries = scorecard_delivery_rows(conn, inn["innings_id"])
    batsmen: dict[int, dict] = {}
    bowlers: dict[int, dict] = {}
    bowler_overs: dict[tuple[int, int], dict] = defaultdict(lambda: {"balls": 0, "runs": 0})
    extras = defaultdict(int)
    dismissals: dict[int, str] = {}
    fow = []
    progression = []
    innings_runs = 0
    legal_balls = 0
    fow_count = 0
    pending_runs = 0
    pending_markers: list[str] = []

    def ensure_batter(player_id: int | None, name: str | None) -> None:
        if player_id and player_id not in batsmen:
            batsmen[player_id] = build_batter_entry(player_id, name or "Unknown")

    def ensure_bowler(player_id: int | None, name: str | None) -> None:
        if player_id and player_id not in bowlers:
            bowlers[player_id] = build_bowler_entry(player_id, name or "Unknown")

    for row in deliveries:
        ensure_batter(row["batter_id"], row["batter"])
        ensure_batter(row["non_striker_id"], row["non_striker"])
        ensure_batter(row["player_out_id"], row["player_out"])
        ensure_bowler(row["bowler_id"], row["bowler"])

        batter = batsmen[row["batter_id"]]
        bowler = bowlers[row["bowler_id"]]
        delivery_runs = row["runs_total"] or 0
        innings_runs += delivery_runs
        pending_runs += delivery_runs
        marker = delivery_marker(row)
        if marker not in {"0", "1", "2", "3"}:
            pending_markers.append(marker)

        batter["runs"] += row["runs_batter"] or 0
        if batter_ball(row):
            batter["balls"] += 1
        if row["is_four"]:
            batter["fours"] += 1
        if row["is_six"]:
            batter["sixes"] += 1

        charged_runs = bowler_runs(row)
        bowler["runs"] += charged_runs
        if row["extras_type"] == "wides":
            bowler["wides"] += row["runs_extras"] or 0
        if row["extras_type"] == "noballs":
            bowler["no_balls"] += 1
        if legal_delivery(row):
            legal_balls += 1
            bowler["balls"] += 1
            bowler_overs[(row["bowler_id"], row["over_number"])]["balls"] += 1
        bowler_overs[(row["bowler_id"], row["over_number"])]["runs"] += charged_runs

        if row["extras_type"]:
            extras[row["extras_type"]] += row["runs_extras"] or 0

        if row["is_wicket"] and row["player_out_id"]:
            dismissals[row["player_out_id"]] = dismissal_text(row)
            if row["wicket_type"] in BOWLER_WICKET_TYPES:
                bowler["wickets"] += 1
            if result_is_fow(row):
                fow_count += 1
                fow.append(
                    {
                        "name": row["player_out"] or "Unknown",
                        "runs": innings_runs,
                        "over": balls_to_overs(legal_balls),
                        "wkt_n": fow_count,
                    }
                )
        if legal_delivery(row):
            marker_text = "/".join(pending_markers) if pending_markers else str(pending_runs)
            progression.append(f"{legal_balls},{innings_runs},{fow_count},{pending_runs},{marker_text}")
            pending_runs = 0
            pending_markers = []

    for player_id, batter in batsmen.items():
        batter["out_desc"] = dismissals.get(player_id, "")
        batter["not_out"] = player_id not in dismissals
        batter["strike_rate"] = round((batter["runs"] * 100 / batter["balls"]) if batter["balls"] else 0, 1)

    for (bowler_id, _over_number), over in bowler_overs.items():
        if over["balls"] >= 6 and over["runs"] == 0:
            bowlers[bowler_id]["maidens"] += 1

    bowler_rows = []
    for bowler in bowlers.values():
        bowler["overs"] = balls_to_overs(bowler["balls"])
        bowler["economy"] = round((bowler["runs"] * 6 / bowler["balls"]) if bowler["balls"] else 0, 1)
        bowler_rows.append({key: value for key, value in bowler.items() if key not in {"balls", "player_id"}})

    runs = inn["total_runs"] if inn["total_runs"] is not None else innings_runs
    wickets = inn["total_wickets"] if inn["total_wickets"] is not None else fow_count

    return {
        "bat_team": inn["batting_team"],
        "bowl_team": inn["bowling_team"],
        "innings_id": inn["innings_number"],
        "score": {
            "runs": runs,
            "wickets": wickets,
            "overs": overs_value(inn["total_overs"]) if inn["total_overs"] else balls_to_overs(legal_balls),
            "run_rate": round((runs * 6 / legal_balls) if legal_balls else 0, 2),
            "declared": False,
        },
        "extras": {
            "total": inn["extras"] if inn["extras"] is not None else sum(extras.values()),
            "wides": extras["wides"],
            "no_balls": extras["noballs"],
            "byes": extras["byes"],
            "leg_byes": extras["legbyes"],
        },
        "batsmen": [{key: value for key, value in batter.items() if key != "player_id"} for batter in batsmen.values()],
        "bowlers": bowler_rows,
        "fow": fow,
        "progression": progression,
    }


def build_match_scorecard(conn: sqlite3.Connection, match: dict) -> dict:
    innings_rows = conn.execute(
        """
        select
            i.*,
            bt.team_name as batting_team,
            bw.team_name as bowling_team
        from innings i
        join teams bt on bt.team_id = i.batting_team_id
        join teams bw on bw.team_id = i.bowling_team_id
        where i.match_id = ?
          and i.is_super_over = 0
        order by i.innings_number
        """,
        (match["id"],),
    ).fetchall()

    return {
        "match_id": match["id"],
        "source_id": match["source_id"],
        "season": match["season"],
        "round": match["round"],
        "match_number": match["match_number"],
        "date": match["date"],
        "team1": match["team1"],
        "team2": match["team2"],
        "venue": match["venue"],
        "result_text": match["result_text"],
        "innings": [build_innings_scorecard(conn, inn) for inn in innings_rows],
        "error": None,
    }


def write_archive_scorecards(conn: sqlite3.Connection, matches: list[dict]) -> None:
    SCORECARD_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    existing = {path.name for path in SCORECARD_OUTPUT_DIR.glob("*.json")}
    written = set()

    for match in matches:
        payload = build_match_scorecard(conn, match)
        path = SCORECARD_OUTPUT_DIR / f"{match['id']}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        written.add(path.name)

    for stale in existing - written:
        (SCORECARD_OUTPUT_DIR / stale).unlink()

    print(f"Wrote {len(written)} archive scorecards to {SCORECARD_OUTPUT_DIR}")


def build_stats_builder_data(conn: sqlite3.Connection, archive: dict) -> dict:
    batting_rows = conn.execute(
        """
        select
            m.match_id,
            m.season,
            m.match_type,
            v.venue_name,
            i.innings_id,
            bt.team_name as team,
            bw.team_name as opposition,
            d.batter_id as player_id,
            p.player_name as player,
            sum(d.runs_batter) as runs,
            sum(case when d.extras_type not in ('wides', 'noballs') or d.extras_type is null then 1 else 0 end) as balls,
            sum(d.is_four) as fours,
            sum(d.is_six) as sixes,
            max(case when d.player_out_id = d.batter_id and d.wicket_type != 'retired hurt' then 1 else 0 end) as out
        from deliveries d
        join innings i on i.innings_id = d.innings_id
        join matches m on m.match_id = i.match_id
        join teams bt on bt.team_id = i.batting_team_id
        join teams bw on bw.team_id = i.bowling_team_id
        join players p on p.player_id = d.batter_id
        left join venues v on v.venue_id = m.venue_id
        where i.is_super_over = 0
        group by i.innings_id, d.batter_id
        order by m.season, m.match_id, i.innings_number
        """
    ).fetchall()

    bowling_deliveries = conn.execute(
        """
        select
            m.match_id,
            m.season,
            m.match_type,
            v.venue_name,
            i.innings_id,
            d.over_number,
            bt.team_name as opposition,
            bw.team_name as team,
            d.bowler_id as player_id,
            p.player_name as player,
            d.runs_batter,
            d.runs_total,
            d.extras_type,
            d.is_wicket,
            d.wicket_type
        from deliveries d
        join innings i on i.innings_id = d.innings_id
        join matches m on m.match_id = i.match_id
        join teams bt on bt.team_id = i.batting_team_id
        join teams bw on bw.team_id = i.bowling_team_id
        join players p on p.player_id = d.bowler_id
        left join venues v on v.venue_id = m.venue_id
        where i.is_super_over = 0
        order by m.season, m.match_id, i.innings_number, d.delivery_id
        """
    ).fetchall()

    bowling_groups: dict[tuple[int, int], dict] = {}
    over_groups: dict[tuple[int, int, int], dict] = defaultdict(lambda: {"balls": 0, "runs": 0})
    for row in bowling_deliveries:
        key = (row["innings_id"], row["player_id"])
        group = bowling_groups.setdefault(
            key,
            {
                "m": row["match_id"],
                "y": row["season"],
                "r": format_round(row["match_type"]),
                "v": row["venue_name"] or "Unknown venue",
                "t": row["team"],
                "o": row["opposition"],
                "p": row["player"],
                "b": 0,
                "ru": 0,
                "w": 0,
                "d": 0,
                "md": 0,
            },
        )
        charged_runs = bowler_runs(row)
        group["ru"] += charged_runs
        over_key = (row["innings_id"], row["player_id"], row["over_number"])
        over_groups[over_key]["runs"] += charged_runs

        if legal_delivery(row):
            group["b"] += 1
            over_groups[over_key]["balls"] += 1
            if (row["runs_total"] or 0) == 0:
                group["d"] += 1
        if row["is_wicket"] and row["wicket_type"] in BOWLER_WICKET_TYPES:
            group["w"] += 1

    for (innings_id, player_id, _over_number), over in over_groups.items():
        if over["balls"] >= 6 and over["runs"] == 0:
            bowling_groups[(innings_id, player_id)]["md"] += 1

    batting = [
        {
            "m": row["match_id"],
            "y": row["season"],
            "r": format_round(row["match_type"]),
            "v": row["venue_name"] or "Unknown venue",
            "t": row["team"],
            "o": row["opposition"],
            "p": row["player"],
            "ru": row["runs"] or 0,
            "b": row["balls"] or 0,
            "fo": row["fours"] or 0,
            "si": row["sixes"] or 0,
            "out": row["out"] or 0,
        }
        for row in batting_rows
    ]

    teams = sorted({team["name"] for team in archive["teams"]})
    venues = sorted({match["venue"] for match in archive["matches"] if match["venue"]})
    rounds = archive["rounds"]

    return {
        "years": archive["years"],
        "teams": teams,
        "venues": venues,
        "rounds": rounds,
        "batting": batting,
        "bowling": list(bowling_groups.values()),
    }


def main() -> None:
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    archive = build_archive(conn)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(archive, ensure_ascii=False, indent=2), encoding="utf-8")
    write_archive_scorecards(conn, archive["matches"])
    stats = build_stats_builder_data(conn, archive)
    STATS_OUTPUT_PATH.write_text(json.dumps(stats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    conn.close()
    print(f"Wrote {len(archive['matches'])} archive matches to {OUTPUT_PATH}")
    print(f"Wrote stat builder data to {STATS_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
