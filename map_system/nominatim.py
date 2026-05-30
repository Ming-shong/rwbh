"""
map_system/nominatim.py
-----------------------
Nominatim API 封裝：搜尋附近 POI，並快取結果避免重複呼叫。
"""

import json
import time
import hashlib
import math
from pathlib import Path
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL  = "https://overpass-api.de/api/interpreter"
CACHE_FILE    = Path(__file__).parent.parent / "data" / "cache.json"
USER_AGENT    = "RWBH-Game/1.0 (educational project)"

# POI 分類設定：tag → (遊戲類型, 顯示名, 威脅等級)
POI_CATEGORIES = [
    {"tag": "amenity=convenience_store", "label": "便利商店", "type": "mob",  "threat": 1},
    {"tag": "amenity=fast_food",         "label": "速食店",   "type": "mob",  "threat": 1},
    {"tag": "amenity=restaurant",        "label": "餐廳",     "type": "mob",  "threat": 1},
    {"tag": "amenity=cafe",              "label": "咖啡廳",   "type": "mob",  "threat": 1},
    {"tag": "amenity=pharmacy",          "label": "藥局",     "type": "mob",  "threat": 2},
    {"tag": "amenity=bank",              "label": "銀行",     "type": "mob",  "threat": 2},
    {"tag": "amenity=police",            "label": "警察局",   "type": "mob",  "threat": 2},
    {"tag": "leisure=park",              "label": "公園",     "type": "boss", "threat": 3},
    {"tag": "amenity=school",            "label": "學校",     "type": "boss", "threat": 3},
    {"tag": "amenity=university",        "label": "大學",     "type": "boss", "threat": 4},
    {"tag": "amenity=hospital",          "label": "醫院",     "type": "boss", "threat": 4},
    {"tag": "railway=station",           "label": "車站",     "type": "boss", "threat": 5},
    {"tag": "shop=mall",                 "label": "商場",     "type": "boss", "threat": 4},
    {"tag": "amenity=bus_station",       "label": "公車站",   "type": "boss", "threat": 3},
]

# 快取過期時間（秒）
CACHE_TTL = 3600


# ── 快取工具 ──────────────────────────────────────────────────────────────────

def _load_cache() -> dict:
    """載入快取檔案，不存在則回傳空 dict。"""
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    """儲存快取至檔案。"""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _cache_key(lat: float, lng: float, radius: int) -> str:
    """以座標 + 半徑產生快取鍵（四捨五入到小數後 3 位降低碎片化）。"""
    raw = f"poi:{lat:.3f}:{lng:.3f}:{radius}"
    return hashlib.md5(raw.encode()).hexdigest()


def _find_covering_cache(lat: float, lng: float, radius: int, cache: dict) -> list | None:
    """
    在現有快取中搜尋能涵蓋當前請求區域的記錄。
    若已快取的掃描中心距離夠近、半徑夠大，直接回傳過濾後的 POI，
    避免重新呼叫 Overpass API。
    """
    now = time.time()
    for entry in cache.values():
        if now - entry.get("timestamp", 0) > CACHE_TTL:
            continue
        meta = entry.get("meta")
        if not meta:
            continue  # 舊格式快取，跳過
        clat, clng, cradius = meta["lat"], meta["lng"], meta["radius"]
        dist_centers = haversine(lat, lng, clat, clng)
        # 現有快取的有效覆蓋半徑 >= 當前請求半徑 + 圓心距離 → 完全涵蓋
        if cradius >= radius + dist_centers * 0.9:
            # 過濾到當前半徑內，並重新計算距離
            result = []
            for p in entry["pois"]:
                d = haversine(lat, lng, p["lat"], p["lng"])
                if d <= radius:
                    result.append({**p, "distance_m": round(d)})
            print(f"[Nominatim] 超集快取命中（覆蓋節點 {len(result)} 個）")
            return result
    return None


# ── Haversine 距離 ────────────────────────────────────────────────────────────

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """回傳兩點之間的直線距離（公尺）。"""
    R = 6_371_000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(d_lng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Geocoding（地名 → 座標）──────────────────────────────────────────────────

def geocode(place: str) -> dict | None:
    """
    將地名轉換為座標。
    回傳 {"lat": float, "lng": float, "display_name": str} 或 None。
    """
    params = {
        "q": place,
        "format": "json",
        "limit": 1,
        "accept-language": "zh-TW,zh",
    }
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        return {
            "lat": float(data[0]["lat"]),
            "lng": float(data[0]["lon"]),
            "display_name": data[0].get("display_name", place),
        }
    except (requests.RequestException, KeyError, ValueError) as e:
        print(f"[Nominatim] geocode 失敗：{e}")
        return None


# ── Overpass POI 搜尋 ─────────────────────────────────────────────────────────

def _build_overpass_query(lat: float, lng: float, radius: int) -> str:
    """組建 Overpass QL 查詢，一次抓所有 POI 類型。"""
    filters = []
    for cat in POI_CATEGORIES:
        k, v = cat["tag"].split("=", 1)
        filters.append(f'node["{k}"="{v}"](around:{radius},{lat},{lng});')
        filters.append(f'way["{k}"="{v}"](around:{radius},{lat},{lng});')

    inner = "\n".join(filters)
    return f"""[out:json][timeout:20];
(
{inner}
);
out center 80;"""


def _parse_element(el: dict, cat_map: dict) -> dict | None:
    """將 Overpass element 轉為 POI dict。"""
    tags = el.get("tags", {})

    # 取得座標（way 用 center）
    if el["type"] == "node":
        lat, lng = el.get("lat"), el.get("lon")
    else:
        center = el.get("center", {})
        lat, lng = center.get("lat"), center.get("lon")

    if lat is None or lng is None:
        return None

    # 找到匹配的分類
    matched_cat = None
    for cat in POI_CATEGORIES:
        k, v = cat["tag"].split("=", 1)
        if tags.get(k) == v:
            matched_cat = cat
            break
    if not matched_cat:
        return None

    return {
        "id":       f"{el['type']}-{el['id']}",
        "lat":      float(lat),
        "lng":      float(lng),
        "name":     tags.get("name") or matched_cat["label"],
        "category": matched_cat["label"],
        "type":     matched_cat["type"],
        "threat":   matched_cat["threat"],
        "tags":     tags,
    }


def _deduplicate(pois: list[dict], min_dist: float = 25.0) -> list[dict]:
    """去除距離太近的重複 POI（保留先出現的）。"""
    result = []
    for p in pois:
        too_close = any(
            haversine(p["lat"], p["lng"], q["lat"], q["lng"]) < min_dist
            for q in result
        )
        if not too_close:
            result.append(p)
    return result


def search_pois(lat: float, lng: float, radius: int = 800) -> list[dict]:
    """
    搜尋 (lat, lng) 半徑 radius 公尺內的 POI。
    優先使用快取；超過 TTL 才重新呼叫 Overpass API。

    回傳 list of POI dict：
    {
        "id", "lat", "lng", "name", "category",
        "type" ("mob"|"boss"), "threat" (1-5), "tags",
        "distance_m"  ← 與查詢中心的直線距離
    }
    """
    cache = _load_cache()
    key   = _cache_key(lat, lng, radius)
    now   = time.time()

    # 1. 精確快取命中
    if key in cache:
        entry = cache[key]
        if now - entry.get("timestamp", 0) < CACHE_TTL:
            print(f"[Nominatim] 精確快取命中 {key[:8]}…，共 {len(entry['pois'])} 筆")
            return entry["pois"]

    # 2. 超集快取：已掃描的更大範圍涵蓋此次請求 → 不呼叫 API
    covering = _find_covering_cache(lat, lng, radius, cache)
    if covering is not None:
        return covering

    # 3. 呼叫 Overpass API
    print(f"[Nominatim] 呼叫 Overpass API（lat={lat:.4f}, lng={lng:.4f}, r={radius}m）")
    query = _build_overpass_query(lat, lng, radius)

    try:
        resp = requests.post(
            OVERPASS_URL,
            data=query,
            headers={"User-Agent": USER_AGENT},
            timeout=25,
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except (requests.RequestException, json.JSONDecodeError) as e:
        print(f"[Nominatim] Overpass 呼叫失敗：{e}")
        return []

    # 解析 + 去重 + 加距離
    raw_pois = [_parse_element(el, {}) for el in elements]
    raw_pois = [p for p in raw_pois if p]
    raw_pois = _deduplicate(raw_pois)

    for p in raw_pois:
        p["distance_m"] = round(haversine(lat, lng, p["lat"], p["lng"]))

    # 寫入快取（含 meta，供超集快取偵測使用）
    cache[key] = {
        "timestamp": now,
        "meta": {"lat": lat, "lng": lng, "radius": radius},
        "pois": raw_pois,
    }
    _save_cache(cache)

    print(f"[Nominatim] 取得 {len(raw_pois)} 個 POI（去重後）")
    return raw_pois
