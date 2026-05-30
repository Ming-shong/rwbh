"""
map_system/osrm.py
------------------
OSRM 步行路線計算。
呼叫 router.project-osrm.org，快取結果至 data/osrm_cache.json。
"""

import json
import hashlib
import time
from pathlib import Path
import requests

OSRM_URL   = "http://router.project-osrm.org/route/v1/foot"
CACHE_FILE = Path(__file__).parent.parent / "data" / "osrm_cache.json"
CACHE_TTL  = 3600
USER_AGENT = "RWBH-Game/1.0 (educational project)"


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _cache_key(lat1: float, lng1: float, lat2: float, lng2: float) -> str:
    raw = f"osrm:{lat1:.4f}:{lng1:.4f}:{lat2:.4f}:{lng2:.4f}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_walking_route(lat1: float, lng1: float, lat2: float, lng2: float) -> dict | None:
    """
    計算兩點之間的步行路線（透過 OSRM public API）。
    回傳：{"distance_m": int, "duration_s": int, "walk_minutes": float, "geometry": dict}
    失敗時回傳 None。
    """
    cache = _load_cache()
    key   = _cache_key(lat1, lng1, lat2, lng2)
    now   = time.time()

    if key in cache:
        entry = cache[key]
        if now - entry.get("timestamp", 0) < CACHE_TTL:
            return entry["route"]

    url = f"{OSRM_URL}/{lng1},{lat1};{lng2},{lat2}"
    params = {"overview": "full", "geometries": "geojson"}

    try:
        resp = requests.get(
            url, params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            return None

        r = data["routes"][0]
        result = {
            "distance_m":   round(r["distance"]),
            "duration_s":   round(r["duration"]),
            "walk_minutes": round(r["duration"] / 60, 1),
            "geometry":     r.get("geometry"),
        }
        cache[key] = {"timestamp": now, "route": result}
        _save_cache(cache)
        print(f"[OSRM] 路線取得：{result['walk_minutes']} 分鐘, {result['distance_m']}m")
        return result

    except Exception as e:
        print(f"[OSRM] 呼叫失敗：{e}")
        return None
