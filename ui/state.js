/**
 * ui/state.js
 * -----------
 * 前端全域狀態管理。
 * 變異結晶、HP 持久化至 localStorage，重啟後保留。
 */

window.STATE = {
  // 玩家
  player: {
    lat:      null,
    lng:      null,
    hp:       100,
    maxHp:    100,
    crystals: parseInt(localStorage.getItem('rwbh_crystals') || '0', 10),
  },

  // 世界
  world: {
    anomalyLevel: 0,
    pois:         [],
    mobCount:     0,
    bossCount:    0,
  },

  // UI 狀態
  ui: {
    scanning:    false,
    currentView: "map",
  },

  // ── 工具方法 ────────────────────────────────────────────────────────────────

  setPlayerPos(lat, lng) {
    this.player.lat = lat;
    this.player.lng = lng;
    document.dispatchEvent(new CustomEvent("playerMoved", { detail: { lat, lng } }));
  },

  setPOIs(pois) {
    this.world.pois      = pois;
    this.world.mobCount  = pois.filter(p => p.type === "mob").length;
    this.world.bossCount = pois.filter(p => p.type === "boss").length;
    document.dispatchEvent(new CustomEvent("poisUpdated", { detail: { pois } }));
  },

  /** 增加/扣除變異結晶，並自動持久化 */
  addCrystals(n) {
    this.player.crystals = Math.max(0, this.player.crystals + n);
    localStorage.setItem('rwbh_crystals', this.player.crystals);
    document.dispatchEvent(new CustomEvent("crystalsChanged", {
      detail: { crystals: this.player.crystals },
    }));
  },

  setHp(hp) {
    this.player.hp = Math.max(0, Math.min(hp, this.player.maxHp));
    document.dispatchEvent(new CustomEvent("hpChanged", {
      detail: { hp: this.player.hp, maxHp: this.player.maxHp },
    }));
  },

  markDefeated(poiId) {
    const poi = this.world.pois.find(p => p.id === poiId);
    if (poi) {
      poi.defeated = true;
      document.dispatchEvent(new CustomEvent("poiDefeated", { detail: { poiId } }));
    }
  },
};
