/**
 * ui/player.js
 * 玩家屬性與邏輯（Phase 5 更新）：武器系統整合、各 pattern 射擊行為。
 */
window.PLAYER_OBJ = (() => {
  const MAX_HP        = 100;
  const INV_FRAMES    = 90;
  const PLAYER_RADIUS = 8;

  let x, y, hp, invFrames, shootTimer, subShootTimer, mouseX, mouseY;
  let alive = false;
  let particles = [];
  let prevPhase = 1;
  let effectiveMaxHp = MAX_HP;
  let _cm = {};   // 快取的自訂機制設定

  function init(cx, cy) {
    _cm = window._CUSTOM_MECHANICS?.player || {};
    x = cx; y = cy;
    const bonus = window.RELICS?.getBonus?.() || {};
    effectiveMaxHp = (_cm.max_hp || MAX_HP) + (bonus.max_hp_bonus || 0);
    hp = (typeof STATE !== 'undefined' && STATE.player.hp > 0)
      ? Math.min(STATE.player.hp, effectiveMaxHp) : effectiveMaxHp;
    if (typeof STATE !== 'undefined') STATE.player.maxHp = effectiveMaxHp;
    invFrames = 0;
    shootTimer = 0;
    subShootTimer = 0;
    mouseX = cx;
    mouseY = cy;
    alive = true;
    particles = [];
    prevPhase = 1;
  }

  function setMouse(mx, my) { mouseX = mx; mouseY = my; }

  function update(cw, ch) {
    if (!alive) return;

    // X + Y 自由移動，Y 軸上限限制在畫面 20% 以下（避免貼近 boss 區域）
    x += (mouseX - x) * (_cm.move_smoothing || 0.14);
    y += (mouseY - y) * (_cm.move_smoothing || 0.14);
    x = Math.max(16, Math.min(cw - 16, x));
    y = Math.max(ch * 0.20, Math.min(ch - 30, y));

    if (invFrames > 0) invFrames--;

    // 奇物射速加成
    const relicBonus = window.RELICS?.getBonus?.() || {};
    const fireRateMult = relicBonus.fire_rate_mult || 1;

    // 作弊模式：只有按住左鍵時才射擊
    const _shootEnabled = !window.CHEAT || window._battleMouseHeld;

    // 主武器
    const weapon   = INVENTORY.getActiveWeapon();
    const interval = Math.max(1, Math.round((weapon.fire_rate || 7) * fireRateMult));
    shootTimer++;
    if (_shootEnabled && shootTimer >= interval) {
      shootTimer = 0;
      _shoot(weapon);
    }

    // 副武器
    const subWeapon = INVENTORY.getSubWeapon?.();
    if (subWeapon) {
      const subInterval = Math.max(1, Math.round((subWeapon.fire_rate || 12) * fireRateMult));
      subShootTimer++;
      if (_shootEnabled && subShootTimer >= subInterval) {
        subShootTimer = 0;
        _shootSub(subWeapon);
      }
    }

    // 尾焰粒子
    particles.push({ x, y: y + 14, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 2 + 1.5, life: 0, maxLife: 14 + Math.random() * 8 });
    particles = particles.filter(p => p.life < p.maxLife);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life++; });

    // 偵測 Boss phase 切換
    const curPhase = ENEMY?.getCurrentPhase?.() || 1;
    if (curPhase !== prevPhase) {
      prevPhase = curPhase;
      SFX?.phaseChange?.();
      const lines = window._CUSTOM_LORE?.phase_lines?.[String(curPhase)];
      if (lines?.length) window.HUD?.toast?.(lines[Math.floor(Math.random() * lines.length)], 2000);
    }

  }

  // 計算副武器衛星位置（angle=0上/90右/180下/-90左）
  function _subPos(pos) {
    const sp = pos || { type: 'angle', angle: 90, dist: 25 };
    const dist = sp.dist || 25;
    if (sp.type === 'both_sides') {
      const rad = Math.PI / 2; // 90 degrees
      return [
        { sx: x - dist, sy: y },
        { sx: x + dist, sy: y },
      ];
    }
    const rad = ((sp.angle || 0) * Math.PI) / 180;
    return [{ sx: x + Math.sin(rad) * dist, sy: y - Math.cos(rad) * dist }];
  }

  function _shootSub(weapon) {
    const color   = weapon.color   || '#88ddff';
    const bonus   = window.RELICS?.getBonus?.() || {};
    const damage  = window.CHEAT ? 99999 : Math.round((weapon.damage || 8) * (bonus.atk_mult || 1));
    const pattern = weapon.pattern || 'single';
    const positions = _subPos(weapon.sub_position);

    positions.forEach(({ sx, sy }) => {
      _spawnPattern(pattern, sx, sy, color, damage, weapon.bullet_r);
    });
  }

  function _spawnPattern(pattern, ox, oy, color, damage, br) {
    const r0  = br || 3;
    const spd = 11 * (_cm.bullet_speed_mult || 1.0);
    switch (pattern) {
      case 'single':
        BULLETS.spawn({ x: ox, y: oy - 10, vx: 0, vy: -spd, r: r0, damage, team: 'player', color, maxLife: 100 });
        break;
      case 'twin':
        BULLETS.spawn({ x: ox - 8, y: oy - 6, vx: -0.3, vy: -spd, r: r0, damage, team: 'player', color, maxLife: 110 });
        BULLETS.spawn({ x: ox + 8, y: oy - 6, vx:  0.3, vy: -spd, r: r0, damage, team: 'player', color, maxLife: 110 });
        break;
      case 'spread_5': {
        const angles = [-0.35, -0.17, 0, 0.17, 0.35];
        angles.forEach(a => BULLETS.spawn({ x: ox, y: oy - 8, vx: Math.sin(a)*10, vy: -Math.cos(a)*10, r: br||2.5, damage, team: 'player', color, maxLife: 80 }));
        break;
      }
      case 'rapid':
        BULLETS.spawn({ x: ox+(Math.random()-0.5)*4, y: oy-8, vx:(Math.random()-0.5)*0.5, vy:-spd*1.18, r: br||2, damage, team:'player', color, maxLife:90 });
        break;
      case 'seek':
        BULLETS.spawn({ x: ox, y: oy-10, vx:0, vy:-8, r: br||4, damage, team:'player', color, maxLife:180, seeking:true, seekStrength:0.35 });
        break;
      case 'laser':
        for (let i = 0; i < 3; i++) {
          BULLETS.spawn({ x: ox+(i-1)*4, y: oy-10, vx:(i-1)*0.3, vy:-spd*1.4, r: br||2, damage: Math.round(damage/3), team:'player', color, maxLife:60 });
        }
        break;
    }
  }

  function _shoot(weapon) {
    const color   = weapon.color   || '#00f0ff';
    const bonus   = window.RELICS?.getBonus?.() || {};
    const damage  = window.CHEAT ? 99999 : Math.round((weapon.damage || 12) * (bonus.atk_mult || 1));
    const pattern = weapon.pattern || 'single';

    _spawnPattern(pattern, x, y - 2, color, damage, weapon.bullet_r);
    pattern === 'seek' ? SFX?.shootSeek?.() : SFX?.shoot?.();
  }

  function takeDamage(dmg) {
    if (window.CHEAT) return false; // 無敵
    if (invFrames > 0 || !alive) return false;
    const reduction = _cm.damage_reduction || 0;
    hp -= Math.round(dmg * (1 - reduction));
    invFrames = _cm.inv_frames || INV_FRAMES;
    if (hp <= 0) { hp = 0; alive = false; }
    window.STATE?.setHp?.(hp);
    window.addMutation?.(dmg / effectiveMaxHp * 100);
    return true;
  }

  function render(ctx) {
    // 副武器衛星（純視覺，不計入碰撞）
    const subWeapon = INVENTORY.getSubWeapon?.();
    if (subWeapon) {
      const positions = _subPos(subWeapon.sub_position);
      positions.forEach(({ sx, sy }) => {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = subWeapon.color || '#88ddff';
        ctx.fillStyle = subWeapon.color || '#88ddff';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 尾焰粒子（讀取自訂顏色）
    const _pv = window._CUSTOM_VISUALS?.player || {};
    const _hotColor  = _pv.thruster_hot_color  || '#00f0ff';
    const _coldColor = _pv.thruster_cold_color  || '#ff6b00';
    for (const p of particles) {
      const t = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.7;
      ctx.fillStyle = t > 0.5 ? _hotColor : _coldColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - p.life / p.maxLife) * 4 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!alive) return;
    if (invFrames > 0 && Math.floor(invFrames / 5) % 2 === 0) return;

    // 外觀：優先讀取開發者設計器的設定
    const pv   = window._CUSTOM_VISUALS?.player || {};
    const weapon = INVENTORY.getActiveWeapon();
    const hullColor = pv.hull_color_mode === 'fixed'
      ? (pv.hull_fixed_color || '#00f0ff')
      : (weapon.color || '#00f0ff');
    const glowColor    = pv.glow_color    || hullColor;
    const coreColor    = pv.core_color    || '#ffffff';
    const cockpitColor = pv.cockpit_color || 'rgba(0,20,40,0.6)';
    const glowIntensity = pv.glow_intensity || 24;

    ctx.save();
    ctx.shadowBlur = glowIntensity;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = hullColor;

    // 形狀（預設或自訂）
    const shapePreset = pv.shape_preset || 'default';
    ctx.beginPath();
    if (shapePreset === 'arrow') {
      ctx.moveTo(x, y - 18); ctx.lineTo(x - 7, y + 12);
      ctx.lineTo(x, y + 2);  ctx.lineTo(x + 7, y + 12);
    } else if (shapePreset === 'wedge') {
      ctx.moveTo(x, y - 14); ctx.lineTo(x - 14, y + 10);
      ctx.lineTo(x, y + 4);  ctx.lineTo(x + 14, y + 10);
    } else if (shapePreset === 'delta') {
      ctx.moveTo(x, y - 16); ctx.lineTo(x - 13, y + 12);
      ctx.lineTo(x + 13, y + 12);
    } else if (shapePreset === 'wide') {
      ctx.moveTo(x, y - 12); ctx.lineTo(x - 16, y + 8);
      ctx.lineTo(x - 8, y + 4); ctx.lineTo(x, y + 10);
      ctx.lineTo(x + 8, y + 4); ctx.lineTo(x + 16, y + 8);
    } else { // default
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x - 11, y + 10);
      ctx.lineTo(x - 4,  y + 4);
      ctx.lineTo(x,       y + 7);
      ctx.lineTo(x + 4,  y + 4);
      ctx.lineTo(x + 11, y + 10);
    }
    ctx.closePath();
    ctx.fill();

    // 駕駛艙
    ctx.fillStyle = cockpitColor;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 5, y + 5);
    ctx.lineTo(x + 5, y + 5);
    ctx.closePath();
    ctx.fill();

    // 核心光點
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = coreColor;
    ctx.beginPath();
    ctx.arc(x, y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  return {
    get x() { return x; },
    get y() { return y; },
    get hp() { return hp; },
    get maxHp() { return MAX_HP; },
    get alive() { return alive; },
    get radius() { return _cm.player_radius || PLAYER_RADIUS; },
    init, update, setMouse, takeDamage, render,
  };
})();
