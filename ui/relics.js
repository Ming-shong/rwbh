/**
 * ui/relics.js
 * 奇物系統：Boss 戰後掉落，裝備後提供被動加成。純記憶體，重整歸零。
 */

const _DEFAULT_RELIC_DEFS = [
  { id:'iron_core',      name:'鐵核',     icon:'⬡', color:'#aaaaaa',
    bonus:{ atk_mult:1.25, max_hp_bonus:0,  fire_rate_mult:1   },
    drop_threat_min:3, drop_rate:0.40 },
  { id:'crimson_shard',  name:'赤晶碎片', icon:'◈', color:'#ff4444',
    bonus:{ atk_mult:1.50, max_hp_bonus:0,  fire_rate_mult:0.90 },
    drop_threat_min:4, drop_rate:0.25 },
  { id:'vitality_core',  name:'活力核',   icon:'♥', color:'#00ff88',
    bonus:{ atk_mult:1,    max_hp_bonus:30, fire_rate_mult:1   },
    drop_threat_min:2, drop_rate:0.50 },
  { id:'rapid_crystal',  name:'速射結晶', icon:'⚡', color:'#ffee00',
    bonus:{ atk_mult:1,    max_hp_bonus:0,  fire_rate_mult:0.75 },
    drop_threat_min:3, drop_rate:0.30 },
  { id:'shadow_eye',     name:'暗影之眼', icon:'◉', color:'#aa44ff',
    bonus:{ atk_mult:1.35, max_hp_bonus:10, fire_rate_mult:0.85 },
    drop_threat_min:5, drop_rate:0.15 },
];

// 全域奇物定義表（dev_editor 可覆寫）
window.RELIC_DEFS = {};
_DEFAULT_RELIC_DEFS.forEach(d => { window.RELIC_DEFS[d.id] = d; });

window.RELICS = (() => {
  const MAX_SLOTS = 1;
  let _inventory = [];   // 持有但未裝備的奇物
  let _equipped  = new Array(MAX_SLOTS).fill(null);

  // ── 資料 API ─────────────────────────────────────────────────────
  function getInventory() { return _inventory; }
  function getEquipped()  { return _equipped; }

  function getBonus() {
    return _equipped.filter(Boolean).reduce((acc, r) => ({
      atk_mult:       acc.atk_mult * (r.bonus?.atk_mult || 1),
      max_hp_bonus:   acc.max_hp_bonus + (r.bonus?.max_hp_bonus || 0),
      fire_rate_mult: acc.fire_rate_mult * (r.bonus?.fire_rate_mult || 1),
    }), { atk_mult: 1, max_hp_bonus: 0, fire_rate_mult: 1 });
  }

  /** Boss 擊敗後嘗試掉落奇物，回傳掉落的 def 或 null */
  function rollDrop(threat) {
    const candidates = Object.values(window.RELIC_DEFS)
      .filter(d => (d.drop_threat_min || 1) <= threat);
    if (!candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return Math.random() < (pick.drop_rate || 0.3) ? { ...pick } : null;
  }

  /** 將掉落的奇物加入庫存 */
  function addToInventory(relic) {
    _inventory.push({ ...relic, _uid: Date.now() + Math.random() });
    _renderModal();
  }

  /** 裝備庫存中第 invIdx 個奇物到 slot slotIdx */
  function equip(invIdx, slotIdx) {
    const r = _inventory[invIdx];
    if (!r) return;
    if (_equipped[slotIdx]) _inventory.push(_equipped[slotIdx]);
    _equipped[slotIdx] = r;
    _inventory.splice(invIdx, 1);
    _renderModal();
  }

  /** 卸下 slotIdx 的奇物放回庫存 */
  function unequip(slotIdx) {
    if (!_equipped[slotIdx]) return;
    _inventory.push(_equipped[slotIdx]);
    _equipped[slotIdx] = null;
    _renderModal();
  }

  function resetAll() {
    _inventory = [];
    _equipped  = new Array(MAX_SLOTS).fill(null);
  }

  // ── UI ───────────────────────────────────────────────────────────
  let _relicTab = 'equip';
  let _fusionSel = [];
  let _grindSel  = null;

  function openModal() {
    _relicTab = 'equip'; _fusionSel = []; _grindSel = null;
    document.getElementById('relic-modal').style.display = 'flex';
    _renderModal();
  }
  function closeModal() { document.getElementById('relic-modal').style.display = 'none'; }
  function switchRelicTab(tab) { _relicTab = tab; _fusionSel = []; _grindSel = null; _renderModal(); }

  function toggleFusionSel(i) {
    const idx = _fusionSel.indexOf(i);
    if (idx >= 0) _fusionSel.splice(idx, 1);
    else if (_fusionSel.length < 3) _fusionSel.push(i);
    _renderModal();
  }

  function fuseRelics() {
    if (_fusionSel.length < 3) return;
    _fusionSel.sort((a, b) => b - a).forEach(i => _inventory.splice(i, 1));
    _fusionSel = [];
    window.ITEMS.add('miracle_potion', 1);
    window.HUD?.toast('✦ 融合成功！獲得 奇蹟藥劑', 2500);
    _renderModal();
  }

  function selectGrind(i) { _grindSel = (_grindSel === i) ? null : i; _renderModal(); }

  function grindRelic() {
    if (_grindSel === null) return;
    _inventory.splice(_grindSel, 1);
    const gain = Math.floor(Math.random() * 21) + 10;
    _grindSel = null;
    window.ITEMS.add('miracle_essence', gain);
    window.HUD?.toast(`✦ 研磨成功！獲得 奇蹟精華 ×${gain}`, 2500);
    _renderModal();
  }

  function _tabBtn(tab, label) {
    const active = _relicTab === tab;
    return `<button onclick="RELICS.switchRelicTab('${tab}')"
      style="flex:1;padding:7px;background:none;border:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};
      color:${active ? 'var(--accent)' : 'var(--muted)'};font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer">
      ${label}</button>`;
  }

  function _renderModal() {
    const el = document.getElementById('relic-modal-body');
    if (!el) return;

    const tabs = `<div style="display:flex;gap:0;border-bottom:1px solid rgba(200,220,255,.12);margin-bottom:10px">
      ${_tabBtn('equip','◉ 奇物')}${_tabBtn('fusion','⬡ 融合')}${_tabBtn('grind','⚙ 研磨')}
    </div>`;

    let content = '';
    if (_relicTab === 'equip') {
      const r0 = _equipped[0];
      const slotHTML = `<div class="relic-slot ${r0 ? 'filled' : 'empty'}" onclick="${r0 ? 'RELICS.unequip(0)' : ''}">
        <div class="relic-slot-label">裝備欄</div>
        ${r0 ? `<div class="relic-icon" style="color:${r0.color}">${r0.icon}</div>
                <div class="relic-name">${r0.name}</div>
                <div class="relic-bonus">${_bonusText(r0.bonus)}</div>
                <div style="font-size:8px;color:var(--muted);margin-top:2px">點擊卸下</div>`
              : '<div class="relic-slot-empty">— 空 —</div>'}
      </div>`;
      const invHTML = _inventory.length
        ? _inventory.map((r, i) => `<div class="relic-inv-row">
            <span class="relic-icon" style="color:${r.color};font-size:16px">${r.icon}</span>
            <div style="flex:1"><div class="relic-name">${r.name}</div><div class="relic-bonus">${_bonusText(r.bonus)}</div></div>
            <button class="shop-btn equip-btn" style="font-size:9px;padding:3px 8px" onclick="RELICS.equip(${i},0)">裝備</button>
          </div>`).join('')
        : '<div style="color:var(--muted);text-align:center;padding:16px;font-size:10px">尚無奇物庫存</div>';
      content = `<div class="relic-slots-row">${slotHTML}</div>
        <div style="font-size:9px;color:var(--muted);margin:10px 0 6px">持有奇物</div>${invHTML}`;

    } else if (_relicTab === 'fusion') {
      const selCount = _fusionSel.length;
      const canFuse = selCount === 3;
      const invHTML = _inventory.length
        ? _inventory.map((r, i) => {
            const sel = _fusionSel.includes(i);
            return `<div class="relic-inv-row" onclick="RELICS.toggleFusionSel(${i})"
              style="cursor:pointer;${sel ? 'border-color:var(--accent);background:rgba(0,240,255,.06)' : ''}">
              <span style="font-size:12px;margin-right:6px">${sel ? '☑' : '☐'}</span>
              <span class="relic-icon" style="color:${r.color};font-size:14px">${r.icon}</span>
              <div style="flex:1"><div class="relic-name">${r.name}</div><div class="relic-bonus">${_bonusText(r.bonus)}</div></div>
            </div>`;
          }).join('')
        : '<div style="color:var(--muted);text-align:center;padding:16px;font-size:10px">尚無奇物庫存</div>';
      content = `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">選取 3 個奇物融合，獲得 <span style="color:#ffcc44">奇蹟藥劑</span>。已選 <span style="color:var(--accent)">${selCount}/3</span></div>
        ${invHTML}
        <button onclick="RELICS.fuseRelics()" ${canFuse ? '' : 'disabled'}
          style="width:100%;margin-top:10px;padding:9px;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:2px;
          background:${canFuse ? 'rgba(255,204,0,.1)' : 'rgba(100,100,100,.1)'};border:1px solid ${canFuse ? 'rgba(255,204,0,.5)' : 'rgba(100,100,100,.3)'};
          color:${canFuse ? '#ffcc44' : 'var(--muted)'};border-radius:3px;cursor:${canFuse ? 'pointer' : 'default'}">⬡ 融合</button>`;

    } else if (_relicTab === 'grind') {
      const essCount = window.ITEMS?.count?.('miracle_essence') || 0;
      const canGrind = _grindSel !== null;
      const invHTML = _inventory.length
        ? _inventory.map((r, i) => {
            const sel = _grindSel === i;
            return `<div class="relic-inv-row" onclick="RELICS.selectGrind(${i})"
              style="cursor:pointer;${sel ? 'border-color:#88ffcc;background:rgba(136,255,204,.06)' : ''}">
              <span style="font-size:12px;margin-right:6px">${sel ? '◉' : '○'}</span>
              <span class="relic-icon" style="color:${r.color};font-size:14px">${r.icon}</span>
              <div style="flex:1"><div class="relic-name">${r.name}</div><div class="relic-bonus">${_bonusText(r.bonus)}</div></div>
            </div>`;
          }).join('')
        : '<div style="color:var(--muted);text-align:center;padding:16px;font-size:10px">尚無奇物庫存</div>';
      content = `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">研磨奇物獲得 <span style="color:#88ffcc">奇蹟精華</span> 10～30 個。持有：<span style="color:#88ffcc">${essCount}</span></div>
        ${invHTML}
        <button onclick="RELICS.grindRelic()" ${canGrind ? '' : 'disabled'}
          style="width:100%;margin-top:10px;padding:9px;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:2px;
          background:${canGrind ? 'rgba(136,255,204,.1)' : 'rgba(100,100,100,.1)'};border:1px solid ${canGrind ? 'rgba(136,255,204,.5)' : 'rgba(100,100,100,.3)'};
          color:${canGrind ? '#88ffcc' : 'var(--muted)'};border-radius:3px;cursor:${canGrind ? 'pointer' : 'default'}">⚙ 研磨</button>`;
    }

    el.innerHTML = tabs + content;
  }

  function _bonusText(b) {
    if (!b) return '';
    const parts = [];
    if (b.atk_mult && b.atk_mult !== 1) parts.push(`ATK ×${b.atk_mult}`);
    if (b.max_hp_bonus)                  parts.push(`HP +${b.max_hp_bonus}`);
    if (b.fire_rate_mult && b.fire_rate_mult !== 1) parts.push(`射速 ×${b.fire_rate_mult}`);
    return parts.join('  ');
  }

  return { getInventory, getEquipped, getBonus, rollDrop, addToInventory,
           equip, unequip, resetAll, openModal, closeModal, MAX_SLOTS,
           switchRelicTab, toggleFusionSel, fuseRelics, selectGrind, grindRelic };
})();
