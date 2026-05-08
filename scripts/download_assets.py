"""
download_assets.py -- downloads team logos and player images from official IPL CDN.
Run from the project root:  python scripts/download_assets.py

Sources:
  Team logos  -> GitHub community repo (webp/jpg, confirmed accessible)
  Player imgs -> documents.iplt20.com/ipl/IPLHeadshot2026/{id}.png
                 IDs scraped from iplt20.com/teams/{team} pages via cloudscraper

Outputs:
  static/team-logos/{TEAM}.{webp|jpg}
  static/player-images/{slug}.png
  data/asset-manifest.json    <- read by app.js for <img> src resolution
"""

import json
import os
import re
import sys
import time
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    import cloudscraper
except ImportError:
    print("Installing cloudscraper...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cloudscraper", "-q"])
    import cloudscraper

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS_DIR = os.path.join(BASE_DIR, "static", "team-logos")
IMGS_DIR  = os.path.join(BASE_DIR, "static", "player-images")
DATA_DIR  = os.path.join(BASE_DIR, "data")
MANIFEST  = os.path.join(DATA_DIR, "asset-manifest.json")

os.makedirs(LOGOS_DIR, exist_ok=True)
os.makedirs(IMGS_DIR,  exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    ),
}


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def download(url, dest, label="", session=None):
    try:
        if session:
            r = session.get(url, timeout=15)
            if r.status_code != 200 or len(r.content) < 500:
                print("  FAIL %-35s HTTP %d (%dB)" % (label[:35], r.status_code, len(r.content)))
                return False
            with open(dest, "wb") as f:
                f.write(r.content)
        else:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            if len(data) < 500:
                print("  FAIL %-35s too small (%dB)" % (label[:35], len(data)))
                return False
            with open(dest, "wb") as f:
                f.write(data)
            data = data  # noqa
        size = os.path.getsize(dest) // 1024
        print("  OK   %-35s %dKB" % (label[:35], size))
        return True
    except Exception as e:
        print("  FAIL %-35s %s" % (label[:35], str(e)[:70]))
        return False


# ---------------------------------------------------------------------------
# 1. Team Logos (GitHub raw, confirmed accessible)
# ---------------------------------------------------------------------------
GITHUB_BASE = "https://raw.githubusercontent.com/lokeshkrishna3210-prog/IPL-Logo/main/"
GITHUB_LOGOS = {
    "CSK":  ("Chennai%20Super%20Kings.webp",         "webp"),
    "MI":   ("Mumbai%20Indians.jpg",                  "jpg"),
    "RCB":  ("Royal%20Challengers%20Bangalore.webp",  "webp"),
    "KKR":  ("Kolkata%20Knight%20Riders.webp",        "webp"),
    "DC":   ("Delhi%20Capitals.webp",                 "webp"),
    "SRH":  ("Sunrisers%20Hyderabad.webp",            "webp"),
    "PBKS": ("Punjab%20Kings.webp",                   "webp"),
    "RR":   ("Rajasthan%20Royals.webp",               "webp"),
    "GT":   ("Gujarat%20Titans.webp",                 "webp"),
    "LSG":  ("Lucknow%20Super%20Giants.webp",         "webp"),
}

logo_map = {}
print("\n=== Team Logos ===")
for abbr, (gh_file, ext) in GITHUB_LOGOS.items():
    dest = os.path.join(LOGOS_DIR, "%s.%s" % (abbr, ext))
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        print("  SKIP %-5s (cached %dKB)" % (abbr, os.path.getsize(dest) // 1024))
        logo_map[abbr] = "static/team-logos/%s.%s" % (abbr, ext)
        continue
    if download(GITHUB_BASE + gh_file, dest, abbr):
        logo_map[abbr] = "static/team-logos/%s.%s" % (abbr, ext)
    time.sleep(0.25)
print("Logos: %d/10" % len(logo_map))


# ---------------------------------------------------------------------------
# 2. Player Images — scrape all 10 team pages on iplt20.com
#    URL pattern: documents.iplt20.com/ipl/IPLHeadshot2026/{headshot_id}.png
#    The player URL and headshot ID are paired on each team page
# ---------------------------------------------------------------------------

# All 10 current IPL team slugs on iplt20.com
TEAM_PAGES = [
    ("CSK",  "chennai-super-kings"),
    ("MI",   "mumbai-indians"),
    ("RCB",  "royal-challengers-bengaluru"),
    ("KKR",  "kolkata-knight-riders"),
    ("DC",   "delhi-capitals"),
    ("SRH",  "sunrisers-hyderabad"),
    ("PBKS", "punjab-kings"),
    ("RR",   "rajasthan-royals"),
    ("GT",   "gujarat-titans"),
    ("LSG",  "lucknow-super-giants"),
]

IPL_BASE    = "https://www.iplt20.com/teams/%s"
HEADSHOT_CDN = "https://documents.iplt20.com/ipl/IPLHeadshot2026/%s.png"

# name_slug -> (player_name_display, headshot_id)
player_registry = {}   # "kl-rahul" -> ("KL Rahul", "19")
# We'll also build name -> headshot_id for manifest lookup
name_to_headshot = {}  # "KL Rahul" -> "19"
# Track which team each player belongs to
player_team_registry = {}  # "KL Rahul" -> "LSG"

print("\n=== Scraping IPL team squad pages ===")
scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False}
)

for abbr, team_slug in TEAM_PAGES:
    url = IPL_BASE % team_slug
    try:
        r = scraper.get(url, timeout=20)
        if r.status_code != 200:
            print("  FAIL %-5s HTTP %d" % (abbr, r.status_code))
            continue

        # Extract: /players/{name-slug}/{player-id} paired with headshot img IDs
        # The page renders player cards in order: player link, then headshot img
        # We find consecutive pairs in the HTML
        player_links = re.findall(r'iplt20\.com/players/([a-z0-9-]+)/(\d+)', r.text)
        headshot_ids = re.findall(r'IPLHeadshot2026/(\d+)\.png', r.text)

        # Remove duplicates while preserving order
        seen_links = []
        seen_set = set()
        for slug, pid in player_links:
            key = (slug, pid)
            if key not in seen_set:
                seen_links.append((slug, pid))
                seen_set.add(key)

        seen_hs = []
        seen_hs_set = set()
        for h in headshot_ids:
            if h not in seen_hs_set:
                seen_hs.append(h)
                seen_hs_set.add(h)

        # Pair them up (page order: player 1 link, player 1 headshot, player 2 link...)
        paired = list(zip(seen_links, seen_hs))
        print("  %-5s -> %d players" % (abbr, len(paired)))

        for (slug, pid), hs_id in paired:
            # Convert slug to display name: "kl-rahul" -> "KL Rahul" (approx)
            display = " ".join(w.upper() if len(w) <= 3 else w.capitalize()
                               for w in slug.replace("-", " ").split())
            player_registry[slug] = (display, hs_id)
            name_to_headshot[display] = hs_id
            player_team_registry[display] = abbr  # track team membership

        time.sleep(0.5)

    except Exception as e:
        print("  FAIL %-5s %s" % (abbr, str(e)[:60]))

print("Total players in registry: %d" % len(player_registry))


# ---------------------------------------------------------------------------
# 3. Match player registry names to stats-builder names
#    Stats-builder uses Cricsheet format: "KL Rahul", "V Kohli", "MS Dhoni"
#    IPL website uses: "kl-rahul", "virat-kohli", "ms-dhoni"
# ---------------------------------------------------------------------------

stats_path = os.path.join(DATA_DIR, "stats-builder.json")
stats_players = set()
if os.path.exists(stats_path):
    with open(stats_path, encoding="utf-8") as f:
        stats = json.load(f)
    for section in ("batting", "bowling"):
        for entry in stats.get(section, []):
            n = entry.get("p", "").strip()
            if n:
                stats_players.add(n)

# Build a slug lookup from stats player names for matching
def name_to_slug(name):
    """Convert 'KL Rahul' -> 'kl-rahul', 'V Kohli' -> 'v-kohli'"""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

# Map: stats player name -> headshot_id (via slug matching)
stats_to_headshot = {}
for player_name in stats_players:
    slug = name_to_slug(player_name)
    if slug in player_registry:
        _, hs_id = player_registry[slug]
        stats_to_headshot[player_name] = hs_id

print("Stats players matched to IPL headshots: %d / %d" % (
    len(stats_to_headshot), len(stats_players)))


# ---------------------------------------------------------------------------
# 4. Download player headshot images
# ---------------------------------------------------------------------------
player_map = {}
failed = []

print("\n=== Downloading Player Images (%d matched) ===" % len(stats_to_headshot))
for player_name in sorted(stats_to_headshot.keys()):
    hs_id = stats_to_headshot[player_name]
    slug = slugify(player_name)
    dest = os.path.join(IMGS_DIR, "%s.png" % slug)

    if os.path.exists(dest) and os.path.getsize(dest) > 2000:
        print("  SKIP %-35s (cached)" % player_name[:35])
        player_map[player_name] = "static/player-images/%s.png" % slug
        continue

    url = HEADSHOT_CDN % hs_id
    if download(url, dest, player_name):
        player_map[player_name] = "static/player-images/%s.png" % slug
    else:
        failed.append(player_name)
    time.sleep(0.1)

# Also download headshots for all other players in registry (not in stats-builder)
# so they're available for future use
print("\n=== Downloading remaining IPL squad players ===")
for slug, (display, hs_id) in sorted(player_registry.items()):
    p_slug = slugify(display)
    dest = os.path.join(IMGS_DIR, "%s.png" % p_slug)
    if os.path.exists(dest) and os.path.getsize(dest) > 2000:
        # already cached, add to map
        if display not in player_map:
            player_map[display] = "static/player-images/%s.png" % p_slug
        continue
    url = HEADSHOT_CDN % hs_id
    if download(url, dest, display):
        player_map[display] = "static/player-images/%s.png" % p_slug
        # Also map the stats-builder name if we can figure it out
    time.sleep(0.1)

print("\nPlayer images: %d downloaded, %d failed" % (len(player_map), len(failed)))


# ---------------------------------------------------------------------------
# 5. Write asset manifest
# ---------------------------------------------------------------------------
manifest = {
    "team_logos":    logo_map,
    "player_images": player_map,
    "player_teams":  {name: team for name, team in player_team_registry.items() if name in player_map},
}
with open(MANIFEST, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print("\n=== Done ===")
print("  Team logos:    %d/10" % len(logo_map))
print("  Player images: %d" % len(player_map))
print("  Manifest:      %s" % MANIFEST)
