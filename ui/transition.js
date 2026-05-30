/**
 * ui/transition.js
 * 地圖 ↔ 戰鬥畫面切換（fade out/in）。
 */
window.TRANSITION = (() => {
  const FADE_MS = 500;

  function _fade(el, from, to, ms) {
    return new Promise(resolve => {
      el.style.transition = `opacity ${ms}ms`;
      el.style.opacity = from;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = to;
          setTimeout(resolve, ms);
        });
      });
    });
  }

  async function toBattle(poiData) {
    STATE.ui.currentView = 'battle';

    const hud    = document.getElementById('hud');
    const battle = document.getElementById('battle-overlay');

    // 淡出地圖 HUD
    await _fade(hud, 1, 0, FADE_MS);
    hud.style.display = 'none';

    // 顯示戰鬥覆蓋層並淡入
    battle.style.display = 'block';
    await _fade(battle, 0, 1, FADE_MS);

    // 啟動戰鬥
    BATTLE.start(poiData);
  }

  async function toMap(result) {
    STATE.ui.currentView = 'map';

    const hud    = document.getElementById('hud');
    const battle = document.getElementById('battle-overlay');

    BATTLE.stop();

    await _fade(battle, 1, 0, FADE_MS);
    battle.style.display = 'none';

    hud.style.display = '';
    await _fade(hud, 0, 1, FADE_MS);

    // 發放獎勵
    if (result?.won && result.crystals > 0) {
      STATE.addCrystals(result.crystals);
      const bonus = [];
      if (result.speed_bonus)  bonus.push('⚡速殺');
      if (result.no_damage_bonus) bonus.push('✦無傷');
      const bonusStr = bonus.length ? '  ' + bonus.join(' ') : '';
      window.HUD?.toast(`⚔ 勝利！◈ ×${result.crystals}${bonusStr}`, 3000);
    } else if (result && !result.won) {
      window.HUD?.toast('撤退... 重新整備再挑戰', 2200);
      // 強制觸發 hpChanged，讓主畫面感知 HP=0 並彈出復活畫面
      STATE.setHp(STATE.player.hp);
    }

    // 標記 POI 已擊敗（灰化標記）
    if (result?.won && result.poi_id) {
      STATE.markDefeated(result.poi_id);
    }

    // 寫入記憶體統計（重整即歸零）
    if (result?.poi_id) {
      window._SESSION_STATS = window._SESSION_STATS || { battles:0, wins:0, crystals:0, defeated_mob:0, defeated_boss:0 };
      window._SESSION_STATS.battles++;
      if (result.won) {
        window._SESSION_STATS.wins++;
        if (result.type === 'boss') window._SESSION_STATS.defeated_boss++;
        else window._SESSION_STATS.defeated_mob++;
      }
      window._SESSION_STATS.crystals += result.crystals || 0;
      window.updateStatsBar?.();
      window.dispatchEvent(new Event('rwbh_stats_updated'));
    }
  }

  return { toBattle, toMap };
})();
