"""
map_system/folium_export.py
---------------------------
Folium 收藏地點管理：讀寫 data/favorites.json，匯出 Folium HTML 地圖。
"""

import json
import time
import uuid
from pathlib import Path
import folium

FAVORITES_FILE = Path(__file__).parent.parent / "data" / "favorites.json"


def load_favorites() -> list:
    if FAVORITES_FILE.exists():
        try:
            return json.loads(FAVORITES_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def save_favorites(favs: list) -> None:
    FAVORITES_FILE.parent.mkdir(parents=True, exist_ok=True)
    FAVORITES_FILE.write_text(
        json.dumps(favs, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_favorite(name: str, lat: float, lng: float) -> dict:
    favs = load_favorites()
    entry = {
        "id":         str(uuid.uuid4())[:8],
        "name":       name.strip() or "未命名",
        "lat":        lat,
        "lng":        lng,
        "created_at": time.time(),
    }
    favs.append(entry)
    save_favorites(favs)
    return entry


def delete_favorite(fav_id: str) -> bool:
    favs = load_favorites()
    new = [f for f in favs if f["id"] != fav_id]
    if len(new) == len(favs):
        return False
    save_favorites(new)
    return True


def export_folium_html(center_lat: float = 24.797590, center_lng: float = 120.995540) -> str:
    """
    生成包含所有收藏地點的 Folium 地圖 HTML，回傳 HTML 字串（供 Flask 直接傳送）。
    """
    favs = load_favorites()
    m = folium.Map(
        location=[center_lat, center_lng],
        zoom_start=14,
        tiles="OpenStreetMap",
    )

    for f in favs:
        folium.Marker(
            location=[f["lat"], f["lng"]],
            popup=folium.Popup(f["name"], max_width=200),
            tooltip=f["name"],
            icon=folium.Icon(color="red", icon="star", prefix="glyphicon"),
        ).add_to(m)

    if not favs:
        folium.Marker(
            location=[center_lat, center_lng],
            popup="（尚無收藏地點）",
            tooltip="預設位置",
        ).add_to(m)

    return m.get_root().render()
