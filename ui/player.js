/**
 * ui/player.js
 * 玩家屬性與邏輯（Phase 5 更新）：武器系統整合、各 pattern 射擊行為。
 */
window.PLAYER_OBJ = (() => {
  const MAX_HP       = 100;
  const INV_FRAMES   = 90;
  const PLAYER_RADIUS = 8;

  let x, y, hp, invFrames, shootTimer, mouseX, mouseY;
  let alive = false;
  let particles = [];
  let prevPhase = 1;

  function init(cx, cy) {
    x = cx; y = cy;
    hp = MAX_HP;
    invFrames = 0;
    shootTimer = 0;
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
    x += (mouseX - x) * 0.14;
    y += (mouseY - y) * 0.14;
    x = Math.max(16, Math.min(cw - 16, x));
    y = Math.max(ch * 0.20, Math.min(ch - 30, y));

    if (invFrames > 0) invFrames--;

    // 武器決定射擊間隔
    const weapon   = INVENTORY.getActiveWeapon();
    const interval = weapon.fire_rate || 7;

    shootTimer++;
    if (shootTimer >= interval) {
      shootTimer = 0;
      _shoot(weapon);
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
    }
  }

  function _shoot(weapon) {
    const color   = weapon.color   || '#00f0ff';
    const damage  = window.CHEAT ? 99999 : (weapon.damage || 12);
    const pattern = weapon.pattern || 'single';

    switch (pattern) {
      case 'single':
        BULLETS.spawn({ x, y: y - 12, vx: 0, vy: -11, r: 3, damage, team: 'player', color, maxLife: 100 });
        SFX?.shoot?.();
        break;

      case 'twin':
        BULLETS.spawn({ x: x - 12, y: y - 8, vx: -0.3, vy: -11, r: 3, damage, team: 'player', color, maxLife: 110 });
        BULLETS.spawn({ x: x + 12, y: y - 8, vx:  0.3, vy: -11, r: 3, damage, team: 'player', color, maxLife: 110 });
        SFX?.shoot?.();
        break;

      case 'spread_5': {
        const angles = [-0.35, -0.17, 0, 0.17, 0.35];
        angles.forEach(a => {
          BULLETS.spawn({ x, y: y - 10, vx: Math.sin(a) * 10, vy: -Math.cos(a) * 10, r: 2.5, damage, team: 'player', color, maxLife: 80 });
        });
        SFX?.shoot?.();
        break;
      }

      case 'rapid':
        BULLETS.spawn({ x: x + (Math.random() - 0.5) * 6, y: y - 10, vx: (Math.random() - 0.5) * 0.8, vy: -13, r: 2, damage, team: 'player', color, maxLife: 90 });
        SFX?.shoot?.();
        break;

      case 'laser':
        // 雷射：又長又粗、穿透感（大 r + 快速）
        BULLETS.spawn({ x, y: y - 12, vx: 0, vy: -16, r: 5, damage, team: 'player', color, maxLife: 80 });
        BULLETS.spawn({ x, y: y - 12, vx: 0, vy: -16, r: 2, damage: 0, team: 'player', color: '#ffffff', maxLife: 80 });
        SFX?.shootLaser?.();
        break;

      case 'seek':
        BULLETS.spawn({ x, y: y - 12, vx: 0, vy: -8, r: 4, damage, team: 'player', color, maxLife: 180, seeking: true, seekStrength: 0.35 });
        SFX?.shootSeek?.();
        break;
    }
  }

  function takeDamage(dmg) {
    if (window.CHEAT) return false; // 無敵
    if (invFrames > 0 || !alive) return false;
    hp -= dmg;
    invFrames = INV_FRAMES;
    if (hp <= 0) { hp = 0; alive = false; }
    return true;
  }

  function render(ctx) {
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
    get radius() { return PLAYER_RADIUS; },
    init, update, setMouse, takeDamage, render,
  };
})();
