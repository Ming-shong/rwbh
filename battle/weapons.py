"""
battle/weapons.py
-----------------
武器定義（Phase 5 + 開發者設計器整合）。
優先讀取 data/custom_weapons.json，支援新增/刪除武器。
"""

import json
from pathlib import Path

CUSTOM_FILE = Path(__file__).parent.parent / "data" / "custom_weapons.json"

WEAPONS: dict[str, dict] = {
    # ── 主武器 ────────────────────────────────────────────────────
    "pulse_gun": {
        "name":        "脈衝槍",
        "description": "標準單發，射速穩定。入門武器。",
        "damage":      12,
        "fire_rate":   7,
        "pattern":     "single",
        "color":       "#00f0ff",
        "price":       0,
        "icon":        "▷",
        "type":        "main",
    },
    "twin": {
        "name":        "雙管炮",
        "description": "左右雙管同步射擊，覆蓋面積增倍。",
        "damage":      11,
        "fire_rate":   9,
        "pattern":     "twin",
        "color":       "#00d4ff",
        "price":       80,
        "icon":        "◈",
        "type":        "main",
    },
    "scatter": {
        "name":        "散彈槍",
        "description": "五發散射，短程命中率極高。",
        "damage":      7,
        "fire_rate":   14,
        "pattern":     "spread_5",
        "color":       "#ffaa00",
        "price":       120,
        "icon":        "⋯",
        "type":        "main",
    },
    "rapid": {
        "name":        "速射機槍",
        "description": "射速超高，個別傷害低但累積驚人。",
        "damage":      5,
        "fire_rate":   3,
        "pattern":     "rapid",
        "color":       "#00ff88",
        "price":       150,
        "icon":        "≡",
        "type":        "main",
    },
    "seeker": {
        "name":        "追蹤導彈",
        "description": "自動追蹤目標，幾乎不會脫靶。",
        "damage":      18,
        "fire_rate":   22,
        "pattern":     "seek",
        "color":       "#ff6b35",
        "price":       300,
        "icon":        "◎",
        "type":        "main",
    },
    # ── 副武器 ────────────────────────────────────────────────────
    "side_cannons": {
        "name":        "側翼砲台",
        "description": "裝備在左右兩側，自動向前方補充火力。",
        "damage":      8,
        "fire_rate":   12,
        "pattern":     "single",
        "color":       "#88ddff",
        "price":       100,
        "icon":        "⊲",
        "type":        "sub",
        "sub_position": {"type": "both_sides", "dist": 28},
    },
    "rear_turret": {
        "name":        "後方砲台",
        "description": "裝備在後方，自動向後方掃射覆蓋盲區。",
        "damage":      10,
        "fire_rate":   18,
        "pattern":     "spread_5",
        "color":       "#ff8855",
        "price":       180,
        "icon":        "▽",
        "type":        "sub",
        "sub_position": {"type": "angle", "angle": 180, "dist": 20},
    },
}


def _load_custom() -> dict:
    """讀取開發者設計器匯出的自訂武器設定。"""
    if not CUSTOM_FILE.exists():
        return {}
    try:
        return json.loads(CUSTOM_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_weapon(weapon_id: str) -> dict | None:
    return get_all_weapons_dict().get(weapon_id)


def get_all_weapons_dict() -> dict:
    """回傳合併後的完整武器字典（自訂武器優先）。"""
    custom_data   = _load_custom()
    custom_weapons = custom_data.get("custom_weapons", {})
    deleted        = set(custom_data.get("deleted_defaults", []))

    result = {}
    # 1. 預設武器（移除已刪除的，pulse_gun 永不刪除）
    for wid, wdata in WEAPONS.items():
        if wid in deleted and wid != "pulse_gun":
            continue
        result[wid] = wdata

    # 2. 合併自訂武器
    for wid, wdata in custom_weapons.items():
        result[wid] = wdata

    return result


def get_all_weapons() -> list[dict]:
    """回傳武器列表（供 /api/shop 使用）。"""
    return [{"id": k, **v} for k, v in get_all_weapons_dict().items()]
