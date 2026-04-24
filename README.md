# cricket-scores

GitHub-first IPL scores site that can run in two modes:

- Flask locally for development
- GitHub Pages in production using prebuilt JSON data

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:80`.

## Static build

The GitHub Pages deployment does not run Flask. Instead, a GitHub Actions workflow:

1. fetches the latest match and schedule data
2. builds JSON files and scorecard payloads into `dist/data`
3. publishes the static site to the `gh-pages` branch

The archive view is generated from the local Cricsheet/IPL Universe database:

```bash
python scripts/build_archive_data.py
```

Set `IPL_UNIVERSE_DB` if the database is not at the default local path.

You can generate the static site locally with:

```bash
python scripts/build_static_site.py
```

## Deployment

Push to `main` and the `Deploy GitHub Pages` workflow will publish the site. A scheduled run keeps the data refreshed on GitHub without the VPS.
