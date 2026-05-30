"""
map_system/world_state.py
-------------------------
世界狀態管理：讀寫 data/world.json，追蹤已擊敗事件與戰鬥記錄。
"""

import json
import time
from pathlib import Path

WORLD_FILE = Path(__file__).parent.parent / "data" / "world.json"


def _default() -> dict:
    return {
        "events":        [],
        "defeated":      [],
        "anomaly_level": 0,
        "battle_log":    [],
        "last_updated":  None,
    }


def load() -> dict:
    if WORLD_FILE.exists():
        try:
            return json.loads(WORLD_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return _default()


def save(world: dict) -> None:
    WORLD_FILE.parent.mkdir(parents=True, exist_ok=True)
    WORLD_FILE.write_text(
        json.dumps(world, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def record_battle(
    poi_id: str,
    won: bool,
    crystals: int,
    damage_taken: int,
    poi_type: str = "mob",
    threat: int = 1,
) -> dict:
    """
    記錄一場戰鬥結果，回傳更新後的 world dict。
    """
    world = load()

    if won and poi_id:
        defeated = world.setdefault("defeated", [])
        if poi_id not in defeated:
            defeated.append(poi_id)

        # Boss 擊敗後增加異變等級
        if poi_type == "boss":
            world["anomaly_level"] = min(100, world.get("anomaly_level", 0) + threat * 4)

    world.setdefault("battle_log", []).append({
        "poi_id":       poi_id,
        "won":          won,
        "crystals":     crystals,
        "damage_taken": damage_taken,
        "poi_type":     poi_type,
        "timestamp":    time.time(),
    })
    world["last_updated"] = time.time()
    save(world)
    return world


def get_stats() -> dict:
    """回傳遊戲統計資訊。"""
    world = load()
    log   = world.get("battle_log", [])
    return {
        "total_battles":  len(log),
        "total_wins":     sum(1 for b in log if b.get("won")),
        "total_crystals": sum(b.get("crystals", 0) for b in log),
        "defeated_count": len(world.get("defeated", [])),
        "anomaly_level":  world.get("anomaly_level", 0),
    }
