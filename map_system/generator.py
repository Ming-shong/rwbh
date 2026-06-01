"""
map_system/generator.py
-----------------------
POI → 遊戲事件生成器。
整合 OSRM 步行距離，輸出含戰鬥屬性的事件物件。
"""

import json
import random
import hashlib
from pathlib import Path
from .osrm import get_walking_route

# 每步行分鐘（約 80m/min 平均步速）
_WALK_SPEED_MPM = 80
MAX_WALK_MINUTES = 20

BOSS_HP_BASE    = {1: 300,  2: 600,  3: 1200, 4: 2500, 5: 5000}
MOB_COUNT_BASE  = {1: 3,    2: 5,    3: 8,    4: 12,   5: 20}
CRYSTAL_BASE    = {1: 8,    2: 18,   3: 35,   4: 70,   5: 140}

_DEFAULT_BOSS_NAMES   = ["異變核心", "污染體·巨型", "腐敗領主", "混沌守衛", "終焉使者"]
_DEFAULT_MOB_PREFIXES = ["污染體", "異變體", "腐化生物", "感染者", "潛伏者"]

_ENEMY_DATA_PATH   = Path(__file__).parent.parent / "data" / "custom_enemy_data.json"
_BALANCE_DATA_PATH = Path(__file__).parent.parent / "data" / "custom_balance.json"


def _load_balance() -> dict:
    if _BALANCE_DATA_PATH.exists():
        try:
            return json.loads(_BALANCE_DATA_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _load_enemy_data() -> dict:
    """讀取 custom_enemy_data.json（dev_editor 上傳），不存在時回傳預設值。"""
    if _ENEMY_DATA_PATH.exists():
        try:
            return json.loads(_ENEMY_DATA_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _get_by_threat(arr: list, threat: int, default_arr: list) -> str:
    src = arr if arr else default_arr
    idx = max(0, min(threat - 1, len(src) - 1))
    return src[idx]


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
    ed  = _load_enemy_data()
    bal = _load_balance()
    boss_names_cfg   = ed.get("boss_names",   [])
    mob_prefixes_cfg = ed.get("mob_prefixes", [])
    mob_counts_cfg   = ed.get("mob_counts",   {})
    crystal_base_cfg = bal.get("crystals", {}).get("base", {})

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

        # ── 命名（威脅等級索引，確定性）──────────────────────────────────────
        is_boss   = poi["type"] == "boss"
        boss_name = (_get_by_threat(boss_names_cfg, effective_threat, _DEFAULT_BOSS_NAMES)
                     + " — " + poi["name"]) if is_boss else None
        mob_name  = _get_by_threat(mob_prefixes_cfg, effective_threat, _DEFAULT_MOB_PREFIXES) \
                    + f" · Lv.{effective_threat}"

        # ── 戰鬥屬性 ─────────────────────────────────────────────────────────
        hp_base  = BOSS_HP_BASE.get(effective_threat, 500)
        boss_hp  = int(hp_base * (0.8 + rng.random() * 0.4)) if is_boss else int(hp_base * 0.3)
        # mob_count：優先用 dev_editor 設定，否則用 MOB_COUNT_BASE
        mob_count = int(mob_counts_cfg.get(str(effective_threat),
                        mob_counts_cfg.get(effective_threat,
                        MOB_COUNT_BASE.get(effective_threat, 5))))
        _cbase = crystal_base_cfg.get(effective_threat) or crystal_base_cfg.get(str(effective_threat)) or CRYSTAL_BASE.get(effective_threat, 10)
        crystal_drop = int(_cbase * (0.8 + rng.random() * 0.4))

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
