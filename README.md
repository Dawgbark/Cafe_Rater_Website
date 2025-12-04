# Cafe Rater

![Cafe Rater logo](static/cafe-rater-logo.png)

Cafe Rater is a small Flask + Leaflet experience that discovers nearby cafés using OpenStreetMap's Overpass API and displays them on a modern map/list UI. It supports geolocation-based discovery, free-text place search, adjustable radius selection, and quick focusing on cafés from the result list.

## Getting started

### Prerequisites
- Python 3.10+
- pip

### Installation
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # or pip install flask requests
```

### Running the app
```bash
FLASK_APP=app.py flask run --reload
# or
python app.py  # debug mode
```
The app will be available at http://localhost:5000. Grant geolocation permission or use the search box to load cafés. The frontend assets live in `templates/index.html` and `static/`.

### Running tests
```bash
pytest -q
```
All external HTTP calls are stubbed in the tests, so no network is required. Current coverage includes lifecycle filtering, Overpass parsing, and the `/api/cafes` endpoint contract.

## Features
- Geolocation-based discovery and free-text search via Nominatim.
- Overpass queries that expand radius until a minimum count of open cafés is reached.
- Filtering to exclude closed/abandoned cafés and deduplicate objects.
- Leaflet map synchronized with a styled results list that shows distances and centers the map on selection.

## Standalone HTML preview
You can try the client-only prototype without running Flask:

1. Download `cafe_rating_app_standalone.html` (save it anywhere on your computer).
2. Double-click the file to open it in a modern desktop browser like Chrome, Edge, or Firefox.
3. Allow location access when prompted. If you block it, the page automatically loads cafes near the default map view so you can still see the experience.
4. Optionally type a city or landmark in the search box and click **Search** to find cafes elsewhere.

If you open the file and only see the source code instead of the page, make sure the filename ends with `.html` and that your browser isn't set to download rather than open HTML files.

## Demo and artifacts
- Brand logo (used at the top of the page): [`static/cafe-rater-logo.png`](static/cafe-rater-logo.png)
)
- Design reference HTML prototypes: `colorscheme.html`, `temp_preview.html`, and `cafe_rating_app_standalone (1).html` (not required to run the app).

## Copilot reflection
GitHub Copilot was used for helper scaffolding (e.g., building Overpass query strings and test parametrization). Prompts were iterated to ensure readability and to avoid unnecessary API calls. All generated snippets were reviewed and adjusted for correctness and clarity.

## Submission checklist
- [x] Repo contents are runnable with public visibility (permissions should be confirmed in GitHub settings).
- [x] Final code is complete and ready to tag as a release when submitting.
- [x] README documents setup, run steps, feature overview, artifacts, and Copilot reflection.
- [x] Tests are included and passing via `pytest`.
