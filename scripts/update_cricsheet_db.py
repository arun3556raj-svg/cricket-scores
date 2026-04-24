from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import tempfile
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = Path(r"C:/Users/91938/Documents/Codex/ipl_universe_v4.db")
DEFAULT_SOURCE_URL = "https://cricsheet.org/downloads/ipl_json.zip"

TEAM_SHORTS = {
    "Chennai Super Kings": "CSK",
    "Deccan Chargers": "DCH",
    "Delhi Capitals": "DC",
    "Delhi Daredevils": "DD",
    "Gujarat Lions": "GL",
    "Gujarat Titans": "GT",
    "Kings XI Punjab": "PBKS",
    "Kochi Tuskers Kerala": "KTK",
    "Kolkata Knight Riders": "KKR",
    "Lucknow Super Giants": "LSG",
    "Mumbai Indians": "MI",
    "Pune Warriors": "PW",
    "Punjab Kings": "PBKS",
    "Rajasthan Royals": "RR",
    "Rising Pune Supergiant": "RPS",
    "Rising Pune Supergiants": "RPS",
    "Royal Challengers Bangalore": "RCB",
    "Royal Challengers Bengaluru": "RCB",
    "Sunrisers Hyderabad": "SRH",
}

TEAM_COLORS = {
    "CSK": "#d97706",
    "DCH": "#2563eb",
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

BOWLER_WICKET_TYPES = {
    "bowled",
    "caught",
    "caught and bowled",
    "hit wicket",
    "lbw",
    "stumped",
}

SCHEMA = """
PRAGMA foreign_keys = OFF;

CREATE TABLE teams (
    team_id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT UNIQUE NOT NULL,
    short_name TEXT,
    home_city TEXT,
    primary_color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venues (
    venue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_name TEXT NOT NULL,
    city TEXT,
    country TEXT DEFAULT 'India',
    UNIQUE(venue_name, city)
);

CREATE TABLE players (
    player_id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    cricsheet_id TEXT UNIQUE,
    batting_style TEXT,
    bowling_style TEXT,
    role TEXT,
    nationality TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matches (
    match_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cricsheet_id TEXT UNIQUE NOT NULL,
    season INTEGER NOT NULL,
    match_number INTEGER,
    match_type TEXT DEFAULT 'league',
    date TEXT NOT NULL,
    venue_id INTEGER,
    team1_id INTEGER NOT NULL,
    team2_id INTEGER NOT NULL,
    toss_winner_id INTEGER,
    toss_decision TEXT,
    winner_id INTEGER,
    result TEXT,
    result_margin INTEGER,
    player_of_match_id INTEGER,
    umpire1 TEXT,
    umpire2 TEXT,
    tv_umpire TEXT,
    match_referee TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
    FOREIGN KEY (team1_id) REFERENCES teams(team_id),
    FOREIGN KEY (team2_id) REFERENCES teams(team_id),
    FOREIGN KEY (toss_winner_id) REFERENCES teams(team_id),
    FOREIGN KEY (winner_id) REFERENCES teams(team_id),
    FOREIGN KEY (player_of_match_id) REFERENCES players(player_id)
);

CREATE TABLE innings (
    innings_id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    innings_number INTEGER NOT NULL,
    batting_team_id INTEGER NOT NULL,
    bowling_team_id INTEGER NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_overs REAL DEFAULT 0,
    extras INTEGER DEFAULT 0,
    target INTEGER,
    is_super_over INTEGER DEFAULT 0,
    FOREIGN KEY (match_id) REFERENCES matches(match_id),
    FOREIGN KEY (batting_team_id) REFERENCES teams(team_id),
    FOREIGN KEY (bowling_team_id) REFERENCES teams(team_id),
    UNIQUE(match_id, innings_number)
);

CREATE TABLE deliveries (
    delivery_id INTEGER PRIMARY KEY AUTOINCREMENT,
    innings_id INTEGER NOT NULL,
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    batter_id INTEGER NOT NULL,
    bowler_id INTEGER NOT NULL,
    non_striker_id INTEGER NOT NULL,
    runs_batter INTEGER DEFAULT 0,
    runs_extras INTEGER DEFAULT 0,
    runs_total INTEGER DEFAULT 0,
    extras_type TEXT,
    is_wicket INTEGER DEFAULT 0,
    wicket_type TEXT,
    player_out_id INTEGER,
    fielder1_id INTEGER,
    fielder2_id INTEGER,
    is_four INTEGER DEFAULT 0,
    is_six INTEGER DEFAULT 0,
    FOREIGN KEY (innings_id) REFERENCES innings(innings_id),
    FOREIGN KEY (batter_id) REFERENCES players(player_id),
    FOREIGN KEY (bowler_id) REFERENCES players(player_id),
    FOREIGN KEY (non_striker_id) REFERENCES players(player_id),
    FOREIGN KEY (player_out_id) REFERENCES players(player_id),
    FOREIGN KEY (fielder1_id) REFERENCES players(player_id),
    FOREIGN KEY (fielder2_id) REFERENCES players(player_id)
);

CREATE TABLE player_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id),
    UNIQUE(player_id, team_id, season)
);

CREATE TABLE player_stats (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    season INTEGER,
    matches INTEGER DEFAULT 0,
    innings_batted INTEGER DEFAULT 0,
    runs_scored INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    fours INTEGER DEFAULT 0,
    sixes INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    not_outs INTEGER DEFAULT 0,
    fifties INTEGER DEFAULT 0,
    hundreds INTEGER DEFAULT 0,
    innings_bowled INTEGER DEFAULT 0,
    balls_bowled INTEGER DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    wickets INTEGER DEFAULT 0,
    best_bowling_wickets INTEGER DEFAULT 0,
    best_bowling_runs INTEGER DEFAULT 0,
    four_wicket_hauls INTEGER DEFAULT 0,
    five_wicket_hauls INTEGER DEFAULT 0,
    maidens INTEGER DEFAULT 0,
    catches INTEGER DEFAULT 0,
    stumpings INTEGER DEFAULT 0,
    run_outs INTEGER DEFAULT 0,
    batting_avg REAL,
    strike_rate REAL,
    bowling_avg REAL,
    economy REAL,
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    UNIQUE(player_id, season)
);

CREATE TABLE team_stats (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    season INTEGER,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    no_results INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    net_run_rate REAL,
    highest_total INTEGER,
    lowest_total INTEGER,
    playoff_finish TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(team_id),
    UNIQUE(team_id, season)
);

CREATE TABLE head_to_head (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team1_id INTEGER NOT NULL,
    team2_id INTEGER NOT NULL,
    team1_wins INTEGER DEFAULT 0,
    team2_wins INTEGER DEFAULT 0,
    no_results INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(team_id),
    FOREIGN KEY (team2_id) REFERENCES teams(team_id),
    UNIQUE(team1_id, team2_id)
);

CREATE TABLE curated_moments (
    moment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    moment_type TEXT,
    match_id INTEGER,
    delivery_id INTEGER,
    player_id INTEGER,
    team_id INTEGER,
    season INTEGER,
    media_url TEXT,
    source_url TEXT,
    tags TEXT,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(match_id),
    FOREIGN KEY (delivery_id) REFERENCES deliveries(delivery_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_season ON matches(season);
CREATE INDEX idx_innings_match ON innings(match_id);
CREATE INDEX idx_deliveries_innings ON deliveries(innings_id);
CREATE INDEX idx_deliveries_batter ON deliveries(batter_id);
CREATE INDEX idx_deliveries_bowler ON deliveries(bowler_id);
CREATE INDEX idx_player_stats_player ON player_stats(player_id);
CREATE INDEX idx_player_stats_season ON player_stats(season);
CREATE INDEX idx_curated_match ON curated_moments(match_id);
CREATE INDEX idx_curated_player ON curated_moments(player_id);
CREATE INDEX idx_curated_season ON curated_moments(season);
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild the local IPL universe DB from Cricsheet IPL JSON.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="SQLite DB path to write.")
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="Cricsheet IPL JSON ZIP URL.")
    parser.add_argument("--zip", type=Path, help="Use an already downloaded Cricsheet IPL JSON ZIP.")
    return parser.parse_args()


def download_zip(source_url: str) -> Path:
    target = Path(tempfile.gettempdir()) / "ipl_json.zip"
    print(f"Downloading {source_url}")
    urllib.request.urlretrieve(source_url, target)
    return target


def read_existing_match_ids(db_path: Path) -> tuple[dict[str, int], int]:
    if not db_path.exists():
        return {}, 0
    try:
        conn = sqlite3.connect(db_path)
        rows = conn.execute("select cricsheet_id, match_id from matches").fetchall()
        max_id = conn.execute("select coalesce(max(match_id), 0) from matches").fetchone()[0]
        conn.close()
        return {str(cricsheet_id): int(match_id) for cricsheet_id, match_id in rows}, int(max_id)
    except sqlite3.DatabaseError:
        return {}, 0


def season_to_int(value: Any, match_date: str | None = None) -> int:
    # IPL seasons align with the calendar year in which the match is played.
    # Cricsheet stores the inaugural edition as 2007/08, but the matches are IPL 2008.
    text = str(match_date or value)
    match = re.search(r"\d{4}", text)
    if not match:
        raise ValueError(f"Could not parse season {value!r}")
    return int(match.group(0))


def normalize_round(info: dict[str, Any]) -> str:
    event = info.get("event") or {}
    stage = event.get("stage")
    if stage:
        return str(stage).strip().lower()
    return "league"


def match_number(info: dict[str, Any]) -> int | None:
    number = (info.get("event") or {}).get("match_number")
    return int(number) if isinstance(number, int) or (isinstance(number, str) and number.isdigit()) else None


def short_name(team_name: str) -> str:
    return TEAM_SHORTS.get(team_name, "".join(part[0] for part in team_name.split()[:3]).upper())


def overs_decimal(legal_balls: int) -> float:
    overs, balls = divmod(legal_balls, 6)
    return float(f"{overs}.{balls}") if balls else float(overs)


def extras_type(extras: dict[str, Any] | None) -> str | None:
    if not extras:
        return None
    for key in ("wides", "noballs", "byes", "legbyes", "penalty"):
        if key in extras:
            return key
    return next(iter(extras))


def is_legal_delivery(delivery: dict[str, Any]) -> bool:
    extras = delivery.get("extras") or {}
    return "wides" not in extras and "noballs" not in extras


class Importer:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        self.team_ids: dict[str, int] = {}
        self.venue_ids: dict[tuple[str, str], int] = {}
        self.player_ids_by_key: dict[str, int] = {}
        self.player_ids_by_name: dict[str, int] = {}

    def team_id(self, name: str) -> int:
        if name in self.team_ids:
            return self.team_ids[name]
        short = short_name(name)
        cur = self.conn.execute(
            "insert into teams (team_name, short_name, primary_color) values (?, ?, ?)",
            (name, short, TEAM_COLORS.get(short)),
        )
        team_id = int(cur.lastrowid)
        self.team_ids[name] = team_id
        return team_id

    def venue_id(self, name: str, city: str | None) -> int:
        key = (name, city or "")
        if key in self.venue_ids:
            return self.venue_ids[key]
        cur = self.conn.execute(
            "insert into venues (venue_name, city) values (?, ?)",
            (name, city),
        )
        venue_id = int(cur.lastrowid)
        self.venue_ids[key] = venue_id
        return venue_id

    def player_id(self, name: str | None, registry: dict[str, str]) -> int | None:
        if not name:
            return None
        registry_id = registry.get(name)
        key = registry_id or f"name:{name}"
        if key in self.player_ids_by_key:
            return self.player_ids_by_key[key]
        cur = self.conn.execute(
            "insert into players (player_name, cricsheet_id) values (?, ?)",
            (name, registry_id),
        )
        player_id = int(cur.lastrowid)
        self.player_ids_by_key[key] = player_id
        self.player_ids_by_name[name] = player_id
        return player_id

    def register_match_people(self, info: dict[str, Any]) -> dict[str, str]:
        registry = ((info.get("registry") or {}).get("people") or {}).copy()
        for names in (info.get("players") or {}).values():
            for name in names:
                self.player_id(name, registry)
        for name in info.get("player_of_match") or []:
            self.player_id(name, registry)
        return registry

    def import_match(self, match_id: int, cricsheet_id: str, data: dict[str, Any]) -> None:
        info = data["info"]
        registry = self.register_match_people(info)
        teams = info.get("teams") or []
        if len(teams) != 2:
            raise ValueError(f"{cricsheet_id}: expected two teams, got {teams!r}")

        team1_id = self.team_id(teams[0])
        team2_id = self.team_id(teams[1])
        venue_id = self.venue_id(info.get("venue") or "Unknown venue", info.get("city"))
        toss = info.get("toss") or {}
        outcome = info.get("outcome") or {}
        winner = outcome.get("winner")
        by = outcome.get("by") or {}
        result = next(iter(by), None) or outcome.get("result")
        result_margin = by.get(result) if result in by else None
        officials = info.get("officials") or {}
        umpires = officials.get("umpires") or []
        tv_umpires = officials.get("tv_umpires") or []
        referees = officials.get("match_referees") or []
        player_of_match = (info.get("player_of_match") or [None])[0]

        self.conn.execute(
            """
            insert into matches (
                match_id, cricsheet_id, season, match_number, match_type, date,
                venue_id, team1_id, team2_id, toss_winner_id, toss_decision,
                winner_id, result, result_margin, player_of_match_id,
                umpire1, umpire2, tv_umpire, match_referee
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                match_id,
                cricsheet_id,
                season_to_int(info.get("season"), (info.get("dates") or [""])[0]),
                match_number(info),
                normalize_round(info),
                (info.get("dates") or [""])[0],
                venue_id,
                team1_id,
                team2_id,
                self.team_id(toss["winner"]) if toss.get("winner") else None,
                toss.get("decision"),
                self.team_id(winner) if winner else None,
                result,
                result_margin,
                self.player_id(player_of_match, registry),
                umpires[0] if len(umpires) > 0 else None,
                umpires[1] if len(umpires) > 1 else None,
                tv_umpires[0] if tv_umpires else None,
                referees[0] if referees else None,
            ),
        )

        prior_totals: list[int] = []
        for innings_number, innings in enumerate(data.get("innings") or [], start=1):
            self.import_innings(match_id, innings_number, innings, teams, registry, prior_totals)

    def import_innings(
        self,
        match_id: int,
        innings_number: int,
        innings: dict[str, Any],
        match_teams: list[str],
        registry: dict[str, str],
        prior_totals: list[int],
    ) -> None:
        batting_team = innings["team"]
        bowling_team = next(team for team in match_teams if team != batting_team)
        total_runs = 0
        total_wickets = 0
        total_extras = 0
        legal_balls = 0

        for over in innings.get("overs") or []:
            for delivery in over.get("deliveries") or []:
                runs = delivery.get("runs") or {}
                total_runs += runs.get("total", 0)
                total_extras += runs.get("extras", 0)
                if is_legal_delivery(delivery):
                    legal_balls += 1
                total_wickets += len(
                    [
                        wicket
                        for wicket in delivery.get("wickets") or []
                        if wicket.get("kind") != "retired hurt"
                    ]
                )

        target = None
        if innings.get("target", {}).get("runs"):
            target = innings["target"]["runs"]
        elif prior_totals:
            target = prior_totals[-1] + 1

        cur = self.conn.execute(
            """
            insert into innings (
                match_id, innings_number, batting_team_id, bowling_team_id,
                total_runs, total_wickets, total_overs, extras, target, is_super_over
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                match_id,
                innings_number,
                self.team_id(batting_team),
                self.team_id(bowling_team),
                total_runs,
                total_wickets,
                overs_decimal(legal_balls),
                total_extras,
                target,
                1 if innings.get("super_over") else 0,
            ),
        )
        innings_id = int(cur.lastrowid)
        prior_totals.append(total_runs)

        for over in innings.get("overs") or []:
            ball_number = 0
            for delivery in over.get("deliveries") or []:
                ball_number += 1
                self.import_delivery(innings_id, over["over"], ball_number, delivery, registry)

    def import_delivery(
        self,
        innings_id: int,
        over_number: int,
        ball_number: int,
        delivery: dict[str, Any],
        registry: dict[str, str],
    ) -> None:
        runs = delivery.get("runs") or {}
        extras = delivery.get("extras") or {}
        wickets = delivery.get("wickets") or []
        first_wicket = wickets[0] if wickets else {}
        fielders = first_wicket.get("fielders") or []
        fielder_names = [fielder.get("name") for fielder in fielders if fielder.get("name")]
        wicket_kind = first_wicket.get("kind")
        player_out = first_wicket.get("player_out")

        self.conn.execute(
            """
            insert into deliveries (
                innings_id, over_number, ball_number, batter_id, bowler_id, non_striker_id,
                runs_batter, runs_extras, runs_total, extras_type, is_wicket, wicket_type,
                player_out_id, fielder1_id, fielder2_id, is_four, is_six
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                innings_id,
                over_number,
                ball_number,
                self.player_id(delivery.get("batter"), registry),
                self.player_id(delivery.get("bowler"), registry),
                self.player_id(delivery.get("non_striker"), registry),
                runs.get("batter", 0),
                runs.get("extras", 0),
                runs.get("total", 0),
                extras_type(extras),
                1 if wickets else 0,
                wicket_kind,
                self.player_id(player_out, registry),
                self.player_id(fielder_names[0], registry) if len(fielder_names) > 0 else None,
                self.player_id(fielder_names[1], registry) if len(fielder_names) > 1 else None,
                1 if runs.get("batter", 0) == 4 else 0,
                1 if runs.get("batter", 0) == 6 else 0,
            ),
        )


def load_matches(zip_path: Path) -> list[tuple[str, dict[str, Any]]]:
    with zipfile.ZipFile(zip_path) as archive:
        matches = []
        for name in archive.namelist():
            if not name.endswith(".json"):
                continue
            with archive.open(name) as handle:
                data = json.load(handle)
            cricsheet_id = Path(name).stem
            matches.append((cricsheet_id, data))
    return sorted(
        matches,
        key=lambda item: ((item[1]["info"].get("dates") or [""])[0], int(item[0]) if item[0].isdigit() else item[0]),
    )


def rebuild_database(zip_path: Path, db_path: Path) -> None:
    existing_ids, max_existing_id = read_existing_match_ids(db_path)
    next_match_id = max_existing_id + 1
    matches = load_matches(zip_path)
    tmp_db = db_path.with_suffix(".tmp.db")
    if tmp_db.exists():
        tmp_db.unlink()

    conn = sqlite3.connect(tmp_db)
    conn.executescript(SCHEMA)
    importer = Importer(conn)

    for cricsheet_id, data in matches:
        match_id = existing_ids.get(cricsheet_id)
        if match_id is None:
            match_id = next_match_id
            next_match_id += 1
        importer.import_match(match_id, cricsheet_id, data)

    conn.commit()
    conn.close()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        backup = db_path.with_suffix(f".bak-{datetime.now():%Y%m%d%H%M%S}.db")
        shutil.copy2(db_path, backup)
        print(f"Backed up existing DB to {backup}")
    tmp_db.replace(db_path)
    print(f"Rebuilt {db_path} from {len(matches)} Cricsheet IPL matches")


def main() -> None:
    args = parse_args()
    zip_path = args.zip if args.zip else download_zip(args.source_url)
    rebuild_database(zip_path, args.db)


if __name__ == "__main__":
    main()
