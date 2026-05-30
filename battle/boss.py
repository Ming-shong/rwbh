"""
battle/boss.py
--------------
Boss 多階段攻擊樣式定義。
優先讀取 data/custom_patterns.json（開發者設計器匯出），
找不到時 fallback 至內建預設。
"""

import json
from pathlib import Path

CUSTOM_FILE = Path(__file__).parent.parent / "data" / "custom_patterns.json"

BOSS_PATTERNS: dict[str, list] = {
    "threat_1": [
        {"phase": 1, "type": "radial", "count": 6,  "speed": 2.5, "hp_threshold": 1.0},
    ],
    "threat_2": [
        {"phase": 1, "type": "radial", "count": 8,  "speed": 3.0, "hp_threshold": 1.0},
        {"phase": 2, "type": "aimed",  "count": 3,  "speed": 4.5, "hp_threshold": 0.5},
    ],
    "threat_3": [
        {"phase": 1, "type": "radial", "count": 10, "speed": 3.0, "hp_threshold": 1.0},
        {"phase": 2, "type": "spiral", "count": 3,  "speed": 4.0, "hp_threshold": 0.6},
        {"phase": 3, "type": "aimed",  "count": 4,  "speed": 5.5, "hp_threshold": 0.3},
    ],
    "threat_4": [
        {"phase": 1, "type": "radial", "count": 12, "speed": 3.5, "hp_threshold": 1.0},
        {"phase": 2, "type": "spiral", "count": 4,  "speed": 5.0, "hp_threshold": 0.7},
        {"phase": 3, "type": "aimed",  "count": 5,  "speed": 6.5, "hp_threshold": 0.4},
        {"phase": 4, "type": "wave",   "count": 18, "speed": 4.0, "hp_threshold": 0.2},
    ],
    "threat_5": [
        {"phase": 1, "type": "radial", "count": 14, "speed": 4.0, "hp_threshold": 1.0},
        {"phase": 2, "type": "spiral", "count": 5,  "speed": 5.5, "hp_threshold": 0.75},
        {"phase": 3, "type": "aimed",  "count": 6,  "speed": 7.0, "hp_threshold": 0.5},
        {"phase": 4, "type": "wave",   "count": 22, "speed": 5.0, "hp_threshold": 0.3},
        {"phase": 5, "type": "chaos",  "count": 16, "speed": 6.0, "hp_threshold": 0.15},
    ],
}


def _load_custom() -> dict:
    """讀取自訂 pattern 設計（來自開發者設計器）。"""
    if not CUSTOM_FILE.exists():
        return {}
    try:
        data = json.loads(CUSTOM_FILE.read_text(encoding="utf-8"))
        # 格式為 {"threat_1": [...], "threat_2": [...], ...}
        return {k: v for k, v in data.items() if k.startswith("threat_")}
    except Exception:
        return {}


def get_patterns(threat: int) -> list:
    """
    回傳指定威脅等級的攻擊 pattern 列表。
    優先讀取 data/custom_patterns.json，找不到才用預設。
    """
    key = f"threat_{max(1, min(5, threat))}"

    # 1. 嘗試自訂設計
    custom = _load_custom()
    if key in custom and isinstance(custom[key], list) and custom[key]:
        return custom[key]

    # 2. fallback 預設
    return BOSS_PATTERNS.get(key, BOSS_PATTERNS["threat_1"])
