from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "dist"
STATIC_DIR = DIST_DIR / "static"
DATA_DIR = DIST_DIR / "data"
SCORECARD_DIR = DATA_DIR / "scorecards"
TEMPLATE_PATH = ROOT / "templates" / "index.html"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scraper import get_all_matches, get_schedule
from scorecard import get_scorecard

STATIC_CONFIG_SNIPPET = """
  <script>
    window.PITCH_CONFIG = {
      mode: "static",
      dataBasePath: "./data",
      scorecardBasePath: "./data/scorecards"
    };
  </script>
""".strip()


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


def collect_scorecard_targets(matches: dict, schedule: dict) -> dict[str, tuple[str, str]]:
    targets: dict[str, tuple[str, str]] = {}
    for bucket in ("live", "upcoming", "finished"):
        for match in matches.get(bucket, []):
            targets[match["id"]] = (match["team1_short"], match["team2_short"])
    for match in schedule.get("matches", []):
        targets[match["id"]] = (match["team1_short"], match["team2_short"])
    return targets


def build_scorecards(targets: dict[str, tuple[str, str]]) -> None:
    for match_id, (team1_short, team2_short) in sorted(targets.items()):
        scorecard = get_scorecard(match_id, team1_short, team2_short)
        write_json(SCORECARD_DIR / f"{match_id}.json", scorecard)


def main() -> None:
    reset_dist()
    write_index()
    copy_static_assets()

    matches = get_all_matches()
    schedule = get_schedule()

    write_json(DATA_DIR / "matches.json", matches)
    write_json(DATA_DIR / "schedule.json", schedule)
    build_scorecards(collect_scorecard_targets(matches, schedule))


if __name__ == "__main__":
    main()
