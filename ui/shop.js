/**
 * ui/shop.js
 * 商城 UI：武器商城 + 道具商城
 */

// ── 道具庫存（純記憶體，重整歸零）────────────────────────────────────────────
window.ITEMS = {
  heal_potion:    0,  // 回血藥劑
  revive_syringe: 0,  // 復活針劑
  miracle_potion:  0, // 奇蹟藥劑（融合奇物取得）
  miracle_essence: 0, // 奇蹟精華（研磨奇物取得）

  add(id, n = 1) { this[id] = (this[id] || 0) + n; },
  use(id) {
    if (!this[id] || this[id] <= 0) return false;
    this[id]--;
    return true;
  },
  count(id) { return this[id] || 0; },
};

// ── 道具定義 ─────────────────────────────────────────────────────────────────
const ITEM_DEFS = [
  {
    id: 'heal_potion',
    name: '回血藥劑', icon: '💊', color: '#00ff88',
    desc: '立即回復 50 點 HP',
    price: 20,
    use() {
      const cur = STATE.player.hp, max = STATE.player.maxHp;
      if (cur >= max) { window.HUD?.toast('HP 已滿'); return false; }
      STATE.setHp(Math.min(max, cur + 50));
      window.HUD?.toast('💊 回復 50 HP', 2000);
      return true;
    },
  },
  {
    id: 'revive_syringe',
    name: '復活針劑', icon: '💉', color: '#ff6b35',
    desc: '死亡後可用於復活，並恢復 30% HP',
    price: 50,
    use() {
      STATE.setHp(Math.round(STATE.player.maxHp * 0.3));
      window.HUD?.toast('💉 復活！HP 恢復 30%', 2500);
      return true;
    },
  },
  {
    id: 'miracle_potion',
    name: '奇蹟藥劑', icon: '🧪', color: '#ffcc00',
    desc: '變異達 100% 時使用，可清除全部變異。融合 3 個奇物取得。',
    purchasable: false,
    use() {
      window.resetMutation?.();
      window.HUD?.toast('🧪 奇蹟藥劑生效，變異清除', 2500);
      return true;
    },
  },
  {
    id: 'miracle_essence',
    name: '奇蹟精華', icon: '✦', color: '#88ffcc',
    desc: '每個可減少 1% 變異。研磨奇物取得（10～30 個）。',
    purchasable: false,
    use() {
      if ((window.MUTATION || 0) <= 0) { window.HUD?.toast('變異已為 0%'); return false; }
      window.MUTATION = Math.max(0, (window.MUTATION || 0) - 1);
      window.HUD?.setMutation?.(window.MUTATION);
      window.HUD?.toast('✦ 奇蹟精華：變異 -1%', 1500);
      return true;
    },
  },
];

window.ITEM_DEFS_MAP = Object.fromEntries(ITEM_DEFS.map(d => [d.id, d]));

window.SHOP = (() => {
  let weapons = [];
  let _currentTab = 'weapon_main';

  async function openModal() {
    document.getElementById('shop-modal').style.display = 'flex';
    if (weapons.length === 0) await _loadWeapons();
    _renderAll();
  }

  function closeModal() {
    document.getElementById('shop-modal').style.display = 'none';
  }

  function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('.shop-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('shop-weapon-main-panel').style.display = tab === 'weapon_main' ? '' : 'none';
    document.getElementById('shop-weapon-sub-panel').style.display  = tab === 'weapon_sub'  ? '' : 'none';
    document.getElementById('shop-item-panel').style.display        = tab === 'item'        ? '' : 'none';
  }

  async function _loadWeapons() {
    try {
      const resp = await fetch('/api/shop');
      const data = await resp.json();
      if (data.ok) {
        weapons = data.weapons;
        window._WEAPON_DATA = {};
        weapons.forEach(w => { window._WEAPON_DATA[w.id] = w; });
      }
    } catch (e) { console.error('[Shop] 載入失敗', e); }
  }

  function buy(weaponId) {
    const w = weapons.find(x => x.id === weaponId);
    if (!w) return;
    if (INVENTORY.isOwned(weaponId)) { window.HUD?.toast('已擁有此武器'); return; }
    if (STATE.player.crystals < w.price) { window.HUD?.toast('◈ 結晶不足'); return; }
    STATE.addCrystals(-w.price);
    INVENTORY.own(weaponId);
    const slot = (w.type === 'sub') ? 1 : 0;
    INVENTORY.equip(weaponId, slot);
    SFX.buyItem?.();
    window.HUD?.toast(`✦ 購得 ${w.name}！已裝備`, 2500);
    _renderWeapons();
  }

  function buyItem(itemId) {
    const def = ITEM_DEFS.find(d => d.id === itemId);
    if (!def) return;
    if (STATE.player.crystals < def.price) { window.HUD?.toast('◈ 結晶不足'); return; }
    STATE.addCrystals(-def.price);
    ITEMS.add(itemId);
    window.HUD?.toast(`✦ 購得 ${def.name}！`, 2000);
    _renderItems();
  }

  function useItem(itemId) {
    const def = ITEM_DEFS.find(d => d.id === itemId);
    if (!def) return;
    if (!ITEMS.use(itemId)) { window.HUD?.toast('沒有此道具'); return; }
    def.use();
    _renderItems();
  }

  function _renderAll() {
    _renderWeapons('main');
    _renderWeapons('sub');
    _renderItems();
  }

  function _renderWeapons(typeFilter) {
    const elId = typeFilter === 'sub' ? 'shop-weapon-sub-items' : 'shop-weapon-main-items';
    const el = document.getElementById(elId);
    if (!el) return;
    const crystals = STATE.player.crystals;
    const list = weapons.filter(w => (w.type || 'main') === typeFilter);
    if (!list.length) {
      el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:10px">尚無此類武器</div>';
      return;
    }
    const slot = typeFilter === 'sub' ? 1 : 0;
    el.innerHTML = list.map(w => {
      const owned   = INVENTORY.isOwned(w.id);
      const equipped = INVENTORY.getEquipped(slot) === w.id;
      const canBuy  = !owned && crystals >= w.price;
      return `<div class="shop-card ${owned?'owned':''} ${equipped?'equipped':''}">
        <div class="shop-card-header">
          <span class="shop-icon" style="color:${w.color}">${w.icon}</span>
          <div><div class="shop-name">${w.name}</div><div class="shop-desc">${w.description}</div></div>
        </div>
        <div class="shop-stats">
          <span>ATK <b>${w.damage}</b></span>
          <span>INT <b>${w.fire_rate}f</b></span>
          <span>模式 <b>${_patternLabel(w.pattern)}</b></span>
        </div>
        <div class="shop-footer">
          ${owned ? `<div class="shop-tag-owned">${equipped?'✓ 裝備中':'✓ 已擁有'}</div>`
                  : `<div class="shop-price ${canBuy?'':'unaffordable'}">◈ ×${w.price}</div>`}
          ${owned ? (equipped ? '' : `<button class="shop-btn equip-btn" onclick="INVENTORY.equip('${w.id}',${slot});SHOP.refresh()">裝備</button>`)
                  : `<button class="shop-btn buy-btn" ${canBuy?'':'disabled'} onclick="SHOP.buy('${w.id}')">購買</button>`}
        </div>
      </div>`;
    }).join('');
  }

  function _renderItems() {
    const el = document.getElementById('shop-item-list');
    if (!el) return;
    const crystals = STATE.player.crystals;
    el.innerHTML = ITEM_DEFS.filter(def => def.purchasable !== false).map(def => {
      const owned = ITEMS.count(def.id);
      const canBuy = crystals >= def.price;
      // revive_syringe 不顯示使用按鈕；heal_potion 只有 HP > 0 且未滿才能用
      const hp = STATE.player.hp, maxHp = STATE.player.maxHp;
      const canUse = def.id === 'heal_potion' && owned > 0 && hp > 0 && hp < maxHp;
      const useBtn = canUse ? `<button class="shop-btn equip-btn" onclick="SHOP.useItem('${def.id}')">使用</button>` : '';
      const useHint = def.id === 'revive_syringe' && owned > 0
        ? `<span style="font-size:9px;color:var(--muted)">HP=0 時自動觸發</span>` : '';
      return `<div class="shop-card">
        <div class="shop-card-header">
          <span class="shop-icon" style="color:${def.color}">${def.icon}</span>
          <div><div class="shop-name">${def.name} <span style="font-size:9px;color:var(--muted)">×${owned}</span></div>
          <div class="shop-desc">${def.desc}</div></div>
        </div>
        <div class="shop-footer">
          <div class="shop-price ${canBuy?'':'unaffordable'}">◈ ×${def.price}</div>
          <div style="display:flex;gap:4px;align-items:center">
            ${useHint}${useBtn}
            <button class="shop-btn buy-btn" ${canBuy?'':'disabled'} onclick="SHOP.buyItem('${def.id}')">購買</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function _patternLabel(p) {
    return { single:'單發', twin:'雙管', spread_5:'散射', rapid:'速射', laser:'雷射', seek:'追蹤' }[p] || p;
  }

  function refresh() { _renderAll(); }
  async function preload() { await _loadWeapons(); }

  return { openModal, closeModal, buy, buyItem, useItem, refresh, preload, switchTab };
})();
