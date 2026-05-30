/**
 * ui/inventory.js
 * 武器背包：管理擁有的武器 + 3 個武器槽。
 * 武器清單與裝備槽持久化至 localStorage，重啟後保留。
 */
window.INVENTORY = (() => {
  // 預設值
  let owned = ['pulse_gun'];
  let slots = ['pulse_gun', null, null];

  // ── localStorage 持久化 ─────────────────────────────────────────────────────

  function _save() {
    localStorage.setItem('rwbh_inventory', JSON.stringify({ owned, slots }));
  }

  function _load() {
    try {
      const saved = JSON.parse(localStorage.getItem('rwbh_inventory') || 'null');
      if (!saved) return;
      // 確保 pulse_gun 永遠存在
      if (saved.owned && Array.isArray(saved.owned)) {
        owned = saved.owned;
        if (!owned.includes('pulse_gun')) owned.unshift('pulse_gun');
      }
      if (saved.slots && Array.isArray(saved.slots)) {
        slots = saved.slots;
        if (!slots[0]) slots[0] = 'pulse_gun';
      }
    } catch (_) { /* 損壞的資料，使用預設值 */ }
  }

  // 啟動時立即載入
  _load();

  // ── 資料 API ────────────────────────────────────────────────────────────────

  function own(weaponId) {
    if (!owned.includes(weaponId)) {
      owned.push(weaponId);
      _save();
    }
  }

  function isOwned(weaponId) { return owned.includes(weaponId); }

  function equip(weaponId, slotIndex = 0) {
    if (!isOwned(weaponId)) return false;
    slots[slotIndex] = weaponId;
    _save();
    _renderModal();
    return true;
  }

  function getEquipped(slotIndex = 0) { return slots[slotIndex]; }

  function getActiveWeapon() {
    const id = slots[0] || 'pulse_gun';
    return window._WEAPON_DATA?.[id] || { pattern: 'single', damage: 12, fire_rate: 7, color: '#00f0ff', name: '脈衝槍', icon: '▷' };
  }

  /** 清除所有持久化資料（debug 用） */
  function resetAll() {
    owned = ['pulse_gun'];
    slots = ['pulse_gun', null, null];
    _save();
    _renderModal();
  }

  // 從後端快取的武器資料（由 shop.js preload 填充）
  window._WEAPON_DATA = {};

  // ── UI ──────────────────────────────────────────────────────────────────────

  function openModal() {
    document.getElementById('inventory-modal').style.display = 'flex';
    _renderModal();
  }

  function closeModal() {
    document.getElementById('inventory-modal').style.display = 'none';
  }

  function _renderModal() {
    const el = document.getElementById('inventory-slots');
    if (!el) return;
    const allWeapons = window._WEAPON_DATA;

    el.innerHTML = `
      <div class="inv-section-title">武器槽</div>
      <div class="inv-slots-row">
        ${slots.map((wId, i) => {
          const w = wId ? allWeapons[wId] : null;
          const label = i === 0 ? '主武器' : i === 1 ? '副武器' : '特殊';
          return `<div class="inv-slot ${wId ? 'filled' : 'empty'}" data-slot="${i}">
            <div class="inv-slot-label">${label}</div>
            ${w ? `<div class="inv-slot-icon" style="color:${w.color}">${w.icon || '◈'}</div>
                   <div class="inv-slot-name">${w.name}</div>`
                : `<div class="inv-slot-empty">— 空 —</div>`}
          </div>`;
        }).join('')}
      </div>
      <div class="inv-section-title" style="margin-top:14px">已擁有武器</div>
      <div class="inv-owned-list">
        ${owned.map(wId => {
          const w = allWeapons[wId];
          if (!w) return '';
          const equipped = slots[0] === wId;
          return `<div class="inv-weapon-row ${equipped ? 'equipped' : ''}" onclick="INVENTORY.equip('${wId}', 0)">
            <span class="inv-w-icon" style="color:${w.color}">${w.icon}</span>
            <div class="inv-w-info">
              <div class="inv-w-name">${w.name} ${equipped ? '<span class="equipped-tag">✓ 裝備中</span>' : ''}</div>
              <div class="inv-w-desc">${w.description}</div>
            </div>
            <div class="inv-w-stats">
              <div>ATK ${w.damage}</div>
              <div>INT ${w.fire_rate}f</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  return { own, isOwned, equip, getEquipped, getActiveWeapon, openModal, closeModal, resetAll };
})();
