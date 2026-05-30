"""
tools/download_tiles.py
-----------------------
一次性下載 OSM 地圖 tiles 供離線開發者模式使用。
下載 zoom 13–16，新竹市區 2km×2km 範圍。
執行方式：python tools/download_tiles.py
"""

import math, time, urllib.request
from pathlib import Path

CENTER_LAT = 24.797590
CENTER_LNG = 120.995540
ZOOM_LEVELS = [13, 14, 15, 16]
PADDING     = 2          # 中心 tile 外延幾格
OUT_DIR     = Path(__file__).parent.parent / "ui" / "tiles"
TILE_URL    = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
USER_AGENT  = "RWBH-DevMode/1.0 (educational project, offline tiles)"


def lat_lng_to_tile(lat, lng, zoom):
    n = 2 ** zoom
    x = int((lng + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def download_tile(z, x, y):
    path = OUT_DIR / str(z) / str(x) / f"{y}.png"
    if path.exists():
        return "skip"
    path.parent.mkdir(parents=True, exist_ok=True)
    url = TILE_URL.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            path.write_bytes(resp.read())
        return "ok"
    except Exception as e:
        print(f"  ✗ {z}/{x}/{y}: {e}")
        return "err"


if __name__ == "__main__":
    total_ok = total_skip = total_err = 0
    for zoom in ZOOM_LEVELS:
        cx, cy = lat_lng_to_tile(CENTER_LAT, CENTER_LNG, zoom)
        tiles = [(x, y)
                 for x in range(cx - PADDING, cx + PADDING + 1)
                 for y in range(cy - PADDING, cy + PADDING + 1)]
        print(f"\nZoom {zoom}: {len(tiles)} tiles")
        for i, (x, y) in enumerate(tiles, 1):
            status = download_tile(zoom, x, y)
            print(f"  [{i:2d}/{len(tiles)}] {zoom}/{x}/{y} → {status}")
            if status == "ok":
                total_ok += 1; time.sleep(0.5)   # 遵守 OSM 速率限制
            elif status == "skip":
                total_skip += 1
            else:
                total_err += 1

    print(f"\n完成：下載 {total_ok} 張，略過 {total_skip} 張，錯誤 {total_err} 張")
    print(f"Tiles 儲存於：{OUT_DIR}")
