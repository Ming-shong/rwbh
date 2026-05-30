"""
map_system/generator.py
-----------------------
POI → 遊戲事件生成器。
整合 OSRM 步行距離，輸出含戰鬥屬性的事件物件。
"""

import random
import hashlib
from .osrm import get_walking_route

# 每步行分鐘（約 80m/min 平均步速）
_WALK_SPEED_MPM = 80
MAX_WALK_MINUTES = 20

BOSS_HP_BASE    = {1: 300,  2: 600,  3: 1200, 4: 2500, 5: 5000}
MOB_COUNT_BASE  = {1: 3,    2: 5,    3: 8,    4: 12,   5: 20}
CRYSTAL_BASE    = {1: 8,    2: 18,   3: 35,   4: 70,   5: 140}

BOSS_NAMES   = ["異變核心", "污染體·巨型", "腐敗領主", "混沌守衛",
                "深淵君主", "終焉使者",   "虛空支配者", "災厄根源"]
MOB_PREFIXES = ["污染體", "異變體", "腐化生物", "感染者", "潛伏者"]


def _estimate_walk(distance_m: float) -> float:
    return round(distance_m / _WALK_SPEED_MPM, 1)


def _rng(poi_id: str) -> random.Random:
    """為每個 POI 建立固定種子的 Random，確保名稱/屬性在重開後一致。"""
    seed = int(hashlib.md5(poi_id.encode()).hexdigest(), 16) % (2 ** 31)
    return random.Random(seed)


def generate_events(pois: list, player_lat: float, player_lng: float) -> list:
    """
    將 POI list 轉換成帶有戰鬥屬性的事件物件。

    Boss POI 會呼叫 OSRM 取得真實步行距離；mob POI 使用直線距離估算。
    回傳 list，每個元素包含原始 POI 欄位加上：
      walk_minutes, boss_name/mob_name, boss_hp, mob_count,
      crystal_drop, effective_threat, route_geometry, patterns
    """
    from battle.boss import get_patterns   # 延遲 import 避免循環

    events = []
    for poi in pois:
        rng = _rng(poi["id"])

        # ── 步行距離 ──────────────────────────────────────────────────────────
        route = None
        if poi["type"] == "boss":
            route = get_walking_route(player_lat, player_lng, poi["lat"], poi["lng"])

        walk_minutes = route["walk_minutes"] if route else _estimate_walk(poi.get("distance_m", 800))

        # 超遠的 POI 降低威脅等級（仍保留，不刪除）
        effective_threat = poi["threat"]
        if walk_minutes > MAX_WALK_MINUTES:
            effective_threat = max(1, effective_threat - 2)

        # ── 命名（固定種子，不隨機）──────────────────────────────────────────
        is_boss   = poi["type"] == "boss"
        boss_name = (rng.choice(BOSS_NAMES) + " — " + poi["name"]) if is_boss else None
        mob_name  = rng.choice(MOB_PREFIXES) + f" · Lv.{effective_threat}"

        # ── 戰鬥屬性 ─────────────────────────────────────────────────────────
        hp_base  = BOSS_HP_BASE.get(effective_threat, 500)
        boss_hp  = int(hp_base * (0.8 + rng.random() * 0.4)) if is_boss else int(hp_base * 0.3)
        mob_count = min(6, int(MOB_COUNT_BASE.get(effective_threat, 5) * (0.7 + rng.random() * 0.6)))
        crystal_drop = int(CRYSTAL_BASE.get(effective_threat, 10) * (0.8 + rng.random() * 0.4))

        events.append({
            **poi,
            "effective_threat": effective_threat,
            "walk_minutes":     walk_minutes,
            "boss_name":        boss_name,
            "mob_name":         mob_name,
            "boss_hp":          boss_hp,
            "mob_count":        mob_count,
            "crystal_drop":     crystal_drop,
            "route_geometry":   route["geometry"] if route else None,
            "patterns":         get_patterns(effective_threat),
        })

    return events
