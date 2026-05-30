/**
 * ui/shop.js
 * 商城 UI：從 /api/shop 載入武器清單，用結晶購買。
 */
window.SHOP = (() => {
  let weapons = []; // 從後端載入

  async function openModal() {
    document.getElementById('shop-modal').style.display = 'flex';
    if (weapons.length === 0) await _loadWeapons();
    _render();
  }

  function closeModal() {
    document.getElementById('shop-modal').style.display = 'none';
  }

  async function _loadWeapons() {
    try {
      const resp = await fetch('/api/shop');
      const data = await resp.json();
      if (data.ok) {
        weapons = data.weapons;
        // 快取武器資料供 INVENTORY 使用
        window._WEAPON_DATA = {};
        weapons.forEach(w => { window._WEAPON_DATA[w.id] = w; });
      }
    } catch (e) {
      console.error('[Shop] 載入失敗', e);
    }
  }

  function buy(weaponId) {
    const w = weapons.find(x => x.id === weaponId);
    if (!w) return;
    if (INVENTORY.isOwned(weaponId)) { window.HUD?.toast('已擁有此武器'); return; }
    if (STATE.player.crystals < w.price) { window.HUD?.toast('◈ 結晶不足'); return; }
    STATE.addCrystals(-w.price);
    INVENTORY.own(weaponId);
    INVENTORY.equip(weaponId, 0); // 購買後自動裝備
    SFX.buyItem?.();
    window.HUD?.toast(`✦ 購得 ${w.name}！已裝備`, 2500);
    _render();
  }

  function _render() {
    const el = document.getElementById('shop-items');
    if (!el) return;
    const crystals = STATE.player.crystals;

    el.innerHTML = weapons.map(w => {
      const owned    = INVENTORY.isOwned(w.id);
      const equipped = INVENTORY.getEquipped(0) === w.id;
      const canBuy   = !owned && crystals >= w.price;
      const isFree   = w.price === 0;

      return `<div class="shop-card ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
        <div class="shop-card-header">
          <span class="shop-icon" style="color:${w.color}">${w.icon}</span>
          <div>
            <div class="shop-name">${w.name}</div>
            <div class="shop-desc">${w.description}</div>
          </div>
        </div>
        <div class="shop-stats">
          <span>ATK <b>${w.damage}</b></span>
          <span>INT <b>${w.fire_rate}f</b></span>
          <span>類型 <b>${_patternLabel(w.pattern)}</b></span>
        </div>
        <div class="shop-footer">
          ${owned
            ? `<div class="shop-tag-owned">${equipped ? '✓ 裝備中' : '✓ 已擁有'}</div>`
            : `<div class="shop-price ${canBuy ? '' : 'unaffordable'}">◈ ×${w.price}</div>`
          }
          ${owned
            ? (equipped ? '' : `<button class="shop-btn equip-btn" onclick="INVENTORY.equip('${w.id}',0);SHOP.refresh()">裝備</button>`)
            : `<button class="shop-btn buy-btn" ${canBuy ? '' : 'disabled'} onclick="SHOP.buy('${w.id}')">購買</button>`
          }
        </div>
      </div>`;
    }).join('');
  }

  function _patternLabel(p) {
    const map = { single: '單發', twin: '雙管', spread_5: '散射', rapid: '速射', laser: '雷射', seek: '追蹤' };
    return map[p] || p;
  }

  // 外部刷新（equip 後呼叫）
  function refresh() { _render(); }

  // 預載武器資料（在商城 / 背包開啟前就要有）
  async function preload() { await _loadWeapons(); }

  return { openModal, closeModal, buy, refresh, preload };
})();
