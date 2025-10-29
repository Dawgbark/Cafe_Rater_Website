import sys
from pathlib import Path
import types

import pytest

requests_stub = types.SimpleNamespace(
    post=lambda *args, **kwargs: None,
    Timeout=Exception,
    RequestException=Exception,
)
class _DummyFlask:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def route(self, *args, **kwargs):
        def decorator(func):
            return func

        return decorator

    def get(self, *args, **kwargs):
        def decorator(func):
            return func

        return decorator

    def run(self, *args, **kwargs):  # pragma: no cover - never executed in tests
        return None


flask_stub = types.SimpleNamespace(
    Flask=_DummyFlask,
    jsonify=lambda *args, **kwargs: None,
    render_template=lambda *args, **kwargs: "",
    request=types.SimpleNamespace(args={}),
)
sys.modules.setdefault("requests", requests_stub)
sys.modules.setdefault("flask", flask_stub)

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import is_open_osm_poi


@pytest.mark.parametrize(
    "tags,expected",
    [
        ({"amenity": "cafe", "name": "Open Cafe"}, True),
        ({"amenity": "cafe", "disused:amenity": "cafe"}, False),
        ({"amenity": "cafe", "abandoned": "yes"}, False),
        ({"amenity": "cafe", "end_date": "2025"}, False),
        ({"amenity": "cafe", "name": "Cafe Closed for Winter"}, False),
    ],
)
def test_is_open_osm_poi(tags, expected):
    assert is_open_osm_poi(tags) is expected
