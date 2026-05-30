"""
battle/reward.py
----------------
戰鬥結算：計算掉落結晶數量。
"""

import random

CRYSTAL_BASE = {1: 8, 2: 18, 3: 35, 4: 70, 5: 140}


def calc_reward(threat: int, elapsed_seconds: float, damage_taken: int) -> dict:
    base = CRYSTAL_BASE.get(max(1, min(5, threat)), 10)

    expected_time = threat * 30
    speed_mult    = max(0.5, min(2.0, expected_time / max(elapsed_seconds, 1)))
    no_dmg_mult   = 1.5 if damage_taken == 0 else 1.0

    crystals = int(base * speed_mult * no_dmg_mult * (0.8 + random.random() * 0.4))

    return {
        "crystals":        max(1, crystals),
        "speed_bonus":     speed_mult > 1.2,
        "no_damage_bonus": damage_taken == 0,
    }
