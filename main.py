"""
main.py
-------
RWBH 後端入口（Phase 2–6 + Favorites + Dev Editor）。
  GET  /api/geocode?place=<地名>
  GET  /api/scan?lat=&lng=&radius=
  GET  /api/world
  GET  /api/shop
  GET  /api/route
  GET  /api/stats
  POST /api/battle/end
  GET  /api/favorites
  POST /api/favorites
  DELETE /api/favorites/<id>
  GET  /api/export/folium
  POST /api/dev/import        → 匯入開發者設計 JSON
  GET  /                      → 前端頁面
"""

import json
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS

from map_system.nominatim    import geocode, search_pois
from map_system.generator    import generate_events
from map_system.world_state  import load as world_load, record_battle, get_stats
from map_system.folium_export import (
    load_favorites, add_favorite, delete_favorite, export_folium_html,
)
from battle.weapons          import get_all_weapons

# ── 初始化 ────────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder="ui", static_url_path="")
CORS(app)

UI_DIR   = Path(__file__).parent / "ui"
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


# ── 工具 ──────────────────────────────────────────────────────────────────────

def err(msg: str, code: int = 400):
    return jsonify({"ok": False, "error": msg}), code


def ok(data: dict):
    return jsonify({"ok": True, **data})


# ── API 路由 ──────────────────────────────────────────────────────────────────

@app.get("/api/geocode")
def api_geocode():
    place = request.args.get("place", "").strip()
    if not place:
        return err("缺少 place 參數")
    result = geocode(place)
    if not result:
        return err(f"找不到地點：{place}", 404)
    return ok({"lat": result["lat"], "lng": result["lng"], "display_name": result["display_name"]})


@app.get("/api/scan")
def api_scan():
    try:
        lat    = float(request.args["lat"])
        lng    = float(request.args["lng"])
        radius = int(request.args.get("radius", 800))
    except (KeyError, ValueError):
        return err("請提供 lat、lng 參數（數字）")

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return err("座標超出合法範圍")
    radius = max(200, min(radius, 3000))

    pois   = search_pois(lat, lng, radius)
    events = generate_events(pois, lat, lng)

    mobs   = [e for e in events if e["type"] == "mob"]
    bosses = [e for e in events if e["type"] == "boss"]

    return ok({
        "center":     {"lat": lat, "lng": lng},
        "radius":     radius,
        "total":      len(events),
        "mob_count":  len(mobs),
        "boss_count": len(bosses),
        "pois":       events,
    })


@app.get("/api/world")
def api_world():
    return jsonify(world_load())


@app.get("/api/shop")
def api_shop():
    """回傳商城武器清單（含定義）。"""
    return ok({"weapons": get_all_weapons()})


@app.get("/api/route")
def api_route():
    """
    查詢兩點之間的步行路線（OSRM），供前端即時更新路線圖使用。
    GET /api/route?lat1=&lng1=&lat2=&lng2=
    """
    try:
        lat1 = float(request.args["lat1"])
        lng1 = float(request.args["lng1"])
        lat2 = float(request.args["lat2"])
        lng2 = float(request.args["lng2"])
    except (KeyError, ValueError):
        return err("請提供 lat1, lng1, lat2, lng2 參數")

    from map_system.osrm import get_walking_route
    route = get_walking_route(lat1, lng1, lat2, lng2)
    if not route:
        return err("無法取得路線", 404)
    return ok(route)


@app.get("/api/stats")
def api_stats():
    """回傳遊戲統計。"""
    return ok(get_stats())


@app.get("/api/visuals")
def api_visuals():
    """
    回傳目前生效的視覺外觀設定（custom_visuals.json）。
    前端啟動時讀取，覆蓋預設顏色/形狀。
    """
    vfile = DATA_DIR / "custom_visuals.json"
    if vfile.exists():
        try:
            return jsonify({"ok": True, "visuals": json.loads(vfile.read_text(encoding="utf-8"))})
        except Exception:
            pass
    return ok({"visuals": {}})


@app.get("/api/layout")
def api_layout():
    """回傳 UI 面板版面設定（custom_layout.json）。"""
    lfile = DATA_DIR / "custom_layout.json"
    if lfile.exists():
        try:
            return jsonify({"ok": True, "layout": json.loads(lfile.read_text(encoding="utf-8"))})
        except Exception:
            pass
    return ok({"layout": {}})


@app.get("/api/config")
def api_config():
    """
    回傳所有自訂設定的合集，供前端統一讀取。
    包含：visuals, mechanics, lore, sfx, vfx, theme, balance
    """
    result = {}
    for key in ["visuals", "mechanics", "lore", "sfx", "vfx", "theme", "balance"]:
        fpath = DATA_DIR / f"custom_{key}.json"
        if fpath.exists():
            try:
                result[key] = json.loads(fpath.read_text(encoding="utf-8"))
            except Exception:
                pass
    return ok({"config": result})


@app.post("/api/battle/end")
def api_battle_end():
    data         = request.get_json(silent=True) or {}
    poi_id       = data.get("poi_id", "")
    won          = bool(data.get("won", False))
    crystals     = int(data.get("crystals", 0))
    damage_taken = int(data.get("damage_taken", 0))
    poi_type     = data.get("type", "mob")
    threat       = int(data.get("threat", 1))

    record_battle(poi_id, won, crystals, damage_taken, poi_type, threat)
    return ok({"recorded": True})


# ── 收藏地點 ──────────────────────────────────────────────────────────────────

@app.get("/api/favorites")
def api_get_favorites():
    return ok({"favorites": load_favorites()})


@app.post("/api/favorites")
def api_add_favorite():
    data = request.get_json(silent=True) or {}
    try:
        lat  = float(data["lat"])
        lng  = float(data["lng"])
        name = str(data.get("name", "未命名"))
    except (KeyError, ValueError):
        return err("請提供 lat、lng、name")
    entry = add_favorite(name, lat, lng)
    return ok({"favorite": entry})


@app.delete("/api/favorites/<fav_id>")
def api_delete_favorite(fav_id: str):
    if delete_favorite(fav_id):
        return ok({"deleted": fav_id})
    return err("找不到此收藏", 404)


@app.get("/api/export/folium")
def api_export_folium():
    """生成 Folium HTML 並直接回傳（Content-Disposition: attachment）。"""
    center_lat = float(request.args.get("lat", 24.797590))
    center_lng = float(request.args.get("lng", 120.995540))
    html = export_folium_html(center_lat, center_lng)
    return Response(
        html,
        mimetype="text/html",
        headers={"Content-Disposition": "attachment; filename=favorites_map.html"},
    )


# ── 開發者設計匯入 ────────────────────────────────────────────────────────────

@app.post("/api/dev/import")
def api_dev_import():
    """
    接收開發者編輯器下載的設計 JSON，
    依 key 分別寫入 data/custom_*.json。
    """
    data = request.get_json(silent=True) or {}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    mapping = {
        "patterns":  "custom_patterns.json",
        "visuals":   "custom_visuals.json",
        "weapons":   "custom_weapons.json",
        "sfx":       "custom_sfx.json",
        "vfx":       "custom_vfx.json",
        "theme":     "custom_theme.json",
        "mechanics": "custom_mechanics.json",
        "abilities": "custom_abilities.json",
        "balance":   "custom_balance.json",
        "world":     "custom_world.json",
        "lore":      "custom_lore.json",
    }
    for key, filename in mapping.items():
        if key in data:
            path = DATA_DIR / filename
            path.write_text(
                json.dumps(data[key], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            written.append(filename)
    return ok({"written": written})


# ── 前端靜態頁面 ──────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory(UI_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename):
    return send_from_directory(UI_DIR, filename)


# ── 啟動 ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  RWBH Phase 2–6 — 後端啟動")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
