/**
 * ui/inventory.js
 * 武器背包：管理擁有的武器 + 3 個武器槽。
 * 武器清單與裝備槽持久化至 sessionStorage，重整後清除。
 */
window.INVENTORY = (() => {
  // 預設值
  let owned = ['pulse_gun'];
  let slots = ['pulse_gun', null]; // [主武器, 副武器]

  // ── sessionStorage 持久化 ─────────────────────────────────────────────────────

  function _save() { /* 純記憶體，重整即歸零 */ }
  function _load() { /* 無需載入 */ }

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
    return window._WEAPON_DATA?.[id] || { pattern: 'single', damage: 12, fire_rate: 7, color: '#00f0ff', name: '脈衝槍', icon: '▷', type: 'main' };
  }

  function getSubWeapon() {
    const id = slots[1];
    if (!id) return null;
    return window._WEAPON_DATA?.[id] || null;
  }

  /** 清除所有持久化資料（debug 用） */
  function resetAll() {
    owned = ['pulse_gun'];
    slots = ['pulse_gun', null];
    _save();
    _renderModal();
  }

  // 從後端快取的武器資料（由 shop.js preload 填充）
  window._WEAPON_DATA = {};

  // ── UI ──────────────────────────────────────────────────────────────────────

  let _currentTab = 'weapon';
  let _activeSlot = null; // 目前展開選武器的槽位（0=主武器, 1=副武器, null=未選）

  function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('[data-inv-tab]').forEach(b => {
      const active = b.dataset.invTab === tab;
      b.style.borderBottomColor = active ? 'var(--accent)' : 'transparent';
      b.style.color = active ? 'var(--accent)' : 'var(--muted)';
    });
    document.getElementById('inventory-weapon-panel').style.display = tab === 'weapon' ? '' : 'none';
    document.getElementById('inventory-item-panel').style.display   = tab === 'item'   ? '' : 'none';
    if (tab === 'item') _renderItems();
  }

  function openModal() {
    document.getElementById('inventory-modal').style.display = 'flex';
    _activeSlot = null;
    _renderModal();
    if (_currentTab === 'item') _renderItems();
  }

  function closeModal() {
    document.getElementById('inventory-modal').style.display = 'none';
  }

  function _selectSlot(i) {
    _activeSlot = (_activeSlot === i) ? null : i;
    _renderModal();
  }

  function _renderModal() {
    const el = document.getElementById('inventory-slots');
    if (!el) return;
    const allWeapons = window._WEAPON_DATA;

    const slotsHTML = slots.map((wId, i) => {
      const w = wId ? allWeapons[wId] : null;
      const label = i === 0 ? '主武器' : '副武器';
      const isActive = _activeSlot === i;
      return `<div class="inv-slot ${wId ? 'filled' : 'empty'}" onclick="INVENTORY._selectSlot(${i})"
        style="cursor:pointer;${isActive ? 'border-color:var(--accent);background:rgba(0,240,255,.08)' : ''}">
        <div class="inv-slot-label">${label}</div>
        ${w ? `<div class="inv-slot-icon" style="color:${w.color}">${w.icon || '◈'}</div>
               <div class="inv-slot-name">${w.name}</div>`
            : `<div class="inv-slot-empty">— 空 —</div>`}
        <div style="font-size:8px;color:var(--muted);margin-top:2px">${isActive ? '▲ 收起' : '▼ 選擇'}</div>
      </div>`;
    }).join('');

    let listHTML = '';
    if (_activeSlot !== null) {
      const slotType = _activeSlot === 0 ? 'main' : 'sub';
      const ownedFiltered = owned.filter(wId => {
        const w = allWeapons[wId];
        return w && (w.type || 'main') === slotType;
      });
      listHTML = `
        <div class="inv-section-title" style="margin-top:14px">${_activeSlot === 0 ? '主武器' : '副武器'}清單</div>
        <div class="inv-owned-list">
          ${ownedFiltered.length ? ownedFiltered.map(wId => {
            const w = allWeapons[wId];
            const equipped = slots[_activeSlot] === wId;
            return `<div class="inv-weapon-row ${equipped ? 'equipped' : ''}" onclick="INVENTORY.equip('${wId}', ${_activeSlot})">
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
          }).join('') : '<div style="color:var(--muted);text-align:center;padding:10px;font-size:10px">尚無此類武器</div>'}
        </div>`;
    }

    el.innerHTML = `
      <div class="inv-section-title">武器槽 <span style="font-size:9px;color:var(--muted)">(點擊槽位選擇武器)</span></div>
      <div class="inv-slots-row">${slotsHTML}</div>
      ${listHTML}
    `;
  }

  function _renderItems() {
    const el = document.getElementById('inventory-item-list');
    if (!el) return;
    const DEFS = window.ITEM_DEFS_MAP || {};
    const hp = STATE?.player?.hp ?? 100;
    const maxHp = STATE?.player?.maxHp ?? 100;

    const rows = Object.values(DEFS).map(def => {
      const count = window.ITEMS?.count(def.id) || 0;
      const mutation = window.MUTATION || 0;
      const canUse = (def.id === 'heal_potion' && count > 0 && hp > 0 && hp < maxHp)
                  || (def.id === 'miracle_essence' && count > 0 && mutation > 0);
      const hint = def.id === 'revive_syringe'   ? '<span style="font-size:9px;color:var(--muted)">HP=0 時觸發</span>'
                 : def.id === 'miracle_potion'    ? '<span style="font-size:9px;color:var(--muted)">變異100%時使用</span>'
                 : '';
      const useBtn = canUse ? `<button class="shop-btn equip-btn" onclick="SHOP.useItem('${def.id}');INVENTORY.refresh()">使用</button>` : '';
      return `<div class="shop-card">
        <div class="shop-card-header">
          <span class="shop-icon" style="color:${def.color}">${def.icon}</span>
          <div>
            <div class="shop-name">${def.name} <span style="font-size:9px;color:var(--muted)">×${count}</span></div>
            <div class="shop-desc">${def.desc}</div>
          </div>
        </div>
        ${count > 0 ? `<div class="shop-footer" style="justify-content:flex-end;gap:6px">${hint}${useBtn}</div>` : ''}
      </div>`;
    });

    el.innerHTML = rows.length
      ? rows.join('')
      : '<div style="color:var(--muted);text-align:center;padding:20px">背包是空的</div>';
  }

  function refresh() { _renderModal(); if (_currentTab === 'item') _renderItems(); }

  return { own, isOwned, equip, getEquipped, getActiveWeapon, getSubWeapon, openModal, closeModal, resetAll, switchTab, refresh, _selectSlot };
})();
