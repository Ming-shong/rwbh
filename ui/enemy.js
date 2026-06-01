/**
 * ui/enemy.js
 * Boss（單體）與 Mobs（多小怪）雙模式。
 * mode = 'boss' | 'mobs'
 * 外觀由 window._CUSTOM_VISUALS 覆寫（來自 /api/visuals）。
 */

// ── 自訂視覺輔助函式 ────────────────────────────────────────────────────────
function _getBossVisual(threat) {
  const b = window._CUSTOM_VISUALS?.boss;
  return (b && (b[threat] || b[String(threat)])) || {};
}
function _getMobVisual(threat) {
  const m = window._CUSTOM_VISUALS?.mob;
  return (m && (m[threat] || m[String(threat)])) || {};
}

window.ENEMY = (() => {
  let mode = 'boss';

  // ── Boss 狀態 ─────────────────────────────────────────────────────────────
  let boss = null;
  let bossAngle = 0, spiralAngle = 0, wobbleT = 0, hitFlash = 0, shootTimer = 0;

  // ── Mobs 狀態 ─────────────────────────────────────────────────────────────
  let mobs = [];
  let mobPatterns = [];

  // ════════════════════════════════════════════════════════
  //  初始化
  // ════════════════════════════════════════════════════════

  function initBoss(data) {
    mode = 'boss';
    mobs = [];
    boss = {
      x: 0, y: 0,
      hp:    data.boss_hp || 500,
      maxHp: data.boss_hp || 500,
      threat: data.effective_threat || data.threat || 1,
      name:   data.boss_name || data.mob_name || data.name || 'BOSS',
      patterns: data.patterns || [{ phase: 1, type: 'radial', count: 6, speed: 2.5, hp_threshold: 1.0 }],
      r: 28 + (data.effective_threat || data.threat || 1) * 7,
    };
    bossAngle = 0; spiralAngle = 0; wobbleT = 0; hitFlash = 0; shootTimer = 0;
  }

  function initMobs(data) {
    mode = 'mobs';
    boss = null;
    mobPatterns = data.patterns || [];
    bossAngle = 0; spiralAngle = 0;
    const count  = Math.max(1, Math.min(data.mob_count || 3, 6));
    const threat = data.effective_threat || data.threat || 1;
    const hpEach = Math.max(60, Math.floor((data.boss_hp || 200) / count));

    mobs = Array.from({ length: count }, (_, i) => ({
      id:         i,
      x: 0, y: 0,
      hp:     hpEach,
      maxHp:  hpEach,
      r:      10 + threat * 3,
      color:  '#ff6b35',
      threat,
      shootTimer: Math.floor(i * 20),
      wobbleT:    (Math.PI * 2 / count) * i,
      alive:  true,
      hitFlash: 0,
    }));
  }

  // ════════════════════════════════════════════════════════
  //  Boss 攻擊 patterns
  // ════════════════════════════════════════════════════════

  function _getCurrentPattern() {
    if (!boss?.patterns?.length) return null;
    const ratio = boss.hp / boss.maxHp;
    let cur = boss.patterns[0];
    for (const p of boss.patterns) { if (ratio <= p.hp_threshold) cur = p; }
    return cur;
  }

  function _getCurrentMobPattern() {
    if (!mobPatterns.length) return null;
    const alive = mobs.filter(m => m.alive).length;
    const ratio = mobs.length > 0 ? alive / mobs.length : 1;
    let cur = mobPatterns[0];
    for (const p of mobPatterns) { if (ratio <= p.hp_threshold) cur = p; }
    return cur;
  }

  function _spawnMobBullets(p, mx, my, px, py, cw) {
    const av  = p.trajectory === 'curved' ? (p.angular_velocity || 0) : 0;
    const spd = p.speed || 3;
    const dmg = p.damage || 10;
    const col = p.color || '#ff6b35';
    const r   = p.r || 5;
    const ml  = p.maxLife || 280;
    const mk  = (vx, vy) => BULLETS.spawn({ x: mx, y: my, vx, vy, r, damage: dmg, team: 'enemy', color: col, maxLife: ml, angularVelocity: av });
    switch (p.type) {
      case 'radial':
        for (let i = 0; i < p.count; i++) { const a = (Math.PI*2/p.count)*i + bossAngle; mk(Math.cos(a)*spd, Math.sin(a)*spd); }
        bossAngle += 0.22; break;
      case 'spiral':
        for (let i = 0; i < p.count; i++) { const a = spiralAngle + (Math.PI*2/p.count)*i; mk(Math.cos(a)*spd, Math.sin(a)*spd); }
        spiralAngle += 0.14; break;
      case 'aimed': {
        const base = Math.atan2(py - my, px - mx);
        for (let i = 0; i < p.count; i++) { const a = base + (i-(p.count-1)/2)*0.22; mk(Math.cos(a)*spd, Math.sin(a)*spd); }
        break;
      }
      case 'wave':
        for (let i = 0; i < p.count; i++) { const wx = (cw/p.count)*i + cw/p.count/2; BULLETS.spawn({ x: wx, y: my, vx: (Math.random()-.5)*1.2, vy: spd*(0.8+Math.random()*.4), r, damage: dmg, team: 'enemy', color: col, maxLife: ml, angularVelocity: av }); }
        break;
      case 'chaos': {
        const roll = Math.random();
        _spawnMobBullets({...p, type: roll<0.33?'radial':roll<0.66?'spiral':'aimed'}, mx, my, px, py, cw);
        break;
      }
      default:
        mk(Math.cos(Math.atan2(py-my,px-mx))*spd, Math.sin(Math.atan2(py-my,px-mx))*spd);
    }
  }

  function _spawnRadial(p) {
    const av = p.trajectory === 'curved' ? (p.angular_velocity || 0) : 0;
    for (let i = 0; i < p.count; i++) {
      const a = (Math.PI * 2 / p.count) * i + bossAngle;
      BULLETS.spawn({ x: boss.x, y: boss.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: p.r||6, damage: p.damage||10, team: 'enemy', color: p.color||'#ff1a6e', maxLife: p.maxLife||260, angularVelocity: av });
    }
    bossAngle += 0.22;
  }

  function _spawnSpiral(p) {
    const av = p.trajectory === 'curved' ? (p.angular_velocity || 0) : 0;
    for (let a = 0; a < p.count; a++) {
      const angle = spiralAngle + (Math.PI * 2 / p.count) * a;
      BULLETS.spawn({ x: boss.x, y: boss.y, vx: Math.cos(angle) * p.speed, vy: Math.sin(angle) * p.speed, r: p.r||5, damage: p.damage||8, team: 'enemy', color: p.color||'#ff6600', maxLife: p.maxLife||320, angularVelocity: av });
    }
    spiralAngle += 0.14;
  }

  function _spawnAimed(p, px, py) {
    const av = p.trajectory === 'curved' ? (p.angular_velocity || 0) : 0;
    const base = Math.atan2(py - boss.y, px - boss.x);
    for (let i = 0; i < p.count; i++) {
      const a = base + (i - (p.count - 1) / 2) * 0.22;
      BULLETS.spawn({ x: boss.x, y: boss.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: p.r||7, damage: p.damage||16, team: 'enemy', color: p.color||'#ffaa00', maxLife: p.maxLife||320, angularVelocity: av });
    }
  }

  function _spawnWave(p, cw) {
    const av = p.trajectory === 'curved' ? (p.angular_velocity || 0) : 0;
    for (let i = 0; i < p.count; i++) {
      const wx = (cw / p.count) * i + cw / p.count / 2;
      BULLETS.spawn({ x: wx, y: boss.y + boss.r + 5, vx: (Math.random() - 0.5) * 1.2, vy: p.speed * (0.8 + Math.random() * 0.4), r: p.r||6, damage: p.damage||13, team: 'enemy', color: p.color||'#aa00ff', maxLife: p.maxLife||350, angularVelocity: av });
    }
  }

  function _spawnChaos(p, px, py) {
    const roll = Math.random();
    if (roll < 0.33)      _spawnRadial(p);
    else if (roll < 0.66) _spawnSpiral(p);
    else                  _spawnAimed(p, px, py);
  }

  // ════════════════════════════════════════════════════════
  //  Update
  // ════════════════════════════════════════════════════════

  function update(cw, ch, px, py) {
    if (mode === 'boss') _updateBoss(cw, ch, px, py);
    else                 _updateMobs(cw, ch, px, py);
  }

  function _updateBoss(cw, ch, px, py) {
    if (!boss) return;
    const cv  = _getBossVisual(boss.threat);
    const pattern = _getCurrentPattern();
    const mvt  = pattern?.movement_type  || cv.boss_movement?.type  || 'wobble';
    const mspd = pattern?.movement_speed ?? cv.boss_movement?.speed ?? 0.018;
    wobbleT += mspd;
    switch (mvt) {
      case 'circular':
        boss.x = cw / 2 + Math.cos(wobbleT) * (cv.boss_movement?.orbit_r || 80);
        boss.y = 90  + Math.sin(wobbleT) * 40;
        break;
      case 'figure8':
        boss.x = cw / 2 + Math.sin(wobbleT) * (cv.boss_movement?.scale || 80);
        boss.y = 85  + Math.sin(wobbleT * 2) * 30;
        break;
      case 'track_player_x':
        boss.x += (px - boss.x) * (cv.boss_movement?.lag || 0.05);
        boss.y = 85 + Math.sin(wobbleT) * 15;
        break;
      case 'static':
        boss.x = cw / 2;
        boss.y = 85;
        break;
      default: // wobble
        boss.x = cw / 2 + Math.sin(wobbleT * 0.7) * 40;
        boss.y = 80 + Math.sin(wobbleT) * 18;
    }
    if (hitFlash > 0) hitFlash--;

    if (!pattern) return;
    const interval = pattern.fire_interval || Math.max(14, 55 - boss.threat * 7);
    shootTimer++;
    if (shootTimer >= interval) {
      shootTimer = 0;
      switch (pattern.type) {
        case 'radial': _spawnRadial(pattern); break;
        case 'spiral': _spawnSpiral(pattern); break;
        case 'aimed':  _spawnAimed(pattern, px, py); break;
        case 'wave':   _spawnWave(pattern, cw); break;
        case 'chaos':  _spawnChaos(pattern, px, py); break;
      }
    }
  }

  function _updateMobs(cw, ch, px, py) {
    const cols    = Math.ceil(Math.sqrt(mobs.length));
    const spacingX = cw / (cols + 1);

    mobs.forEach((mob, i) => {
      if (!mob.alive) return;
      mob.wobbleT += 0.022;
      if (mob.hitFlash > 0) mob.hitFlash--;

      // 網格排列 + 搖擺
      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseX = spacingX * (col + 1);
      const baseY = 70 + row * 70;
      mob.x = baseX + Math.sin(mob.wobbleT + col) * 35;
      mob.y = baseY + Math.cos(mob.wobbleT * 0.8) * 18;

      // 射擊：依 custom_patterns 的 phase 決定攻擊類型
      const mobP = _getCurrentMobPattern();
      if (mobP) {
        const interval = mobP.fire_interval || Math.max(50, 110 - mob.threat * 10);
        mob.shootTimer++;
        if (mob.shootTimer >= interval) {
          mob.shootTimer = 0;
          _spawnMobBullets(mobP, mob.x, mob.y, px, py, cw);
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════
  //  Damage
  // ════════════════════════════════════════════════════════

  function takeDamage(dmg) {
    if (!boss) return;
    boss.hp = Math.max(0, boss.hp - dmg);
    hitFlash = 6;
  }

  function takeMobDamage(mobId, dmg) {
    const mob = mobs.find(m => m.id === mobId);
    if (!mob || !mob.alive) return;
    mob.hp = Math.max(0, mob.hp - dmg);
    mob.hitFlash = 6;
    if (mob.hp <= 0) {
      mob.alive = false;
      VFX.spawnExplosion(mob.x, mob.y, 10, mob.color);
      SFX.enemyHit?.();
    }
  }

  // ════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════

  function render(ctx) {
    if (mode === 'boss') _renderBoss(ctx);
    else                 _renderMobs(ctx);
  }

  function _renderBoss(ctx) {
    if (!boss) return;
    const { x, y, hp, maxHp } = boss;
    const hpRatio = hp / maxHp;
    const flash   = hitFlash > 0;

    // 讀取自訂外觀（優先使用開發者設計器的設定）
    const cv    = _getBossVisual(boss.threat);
    const col   = flash ? '#ffffff' : (cv.primary_color || '#ff1a6e');
    const glow  = cv.glow_intensity || 50;
    const shape = cv.shape || 'diamond';
    const rMult = cv.size_multiplier || 1.0;
    const r     = boss.r * rMult;
    const spokeCount = cv.spoke_count !== undefined ? cv.spoke_count : 6;
    const rotSpeed   = cv.rotation_speed || 0.5;

    ctx.save();
    ctx.shadowBlur = glow;
    ctx.shadowColor = flash ? '#ffffff' : (cv.primary_color || '#ff1a6e');

    // 旋轉光環（可設定輻條數）
    if (spokeCount > 0) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(wobbleT * rotSpeed);
      const _sc = cv.spoke_color || cv.primary_color || '#ff1a6e';
      ctx.strokeStyle = `rgba(${_hexToRgb(_sc)},${0.25 + hpRatio * 0.3})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < spokeCount; i++) {
        const a = (Math.PI * 2 / spokeCount) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
        ctx.lineTo(Math.cos(a) * (r + 22), Math.sin(a) * (r + 22));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 主體（支援多種形狀）
    ctx.fillStyle = col;
    ctx.beginPath();
    _drawShape(ctx, x, y, r, shape);
    ctx.closePath(); ctx.fill();

    // 子形狀（在核心之下，與 dev_editor PREVIEW 圖層順序一致）
    (cv.sub_shapes || []).forEach(ss => {
      const sr = r * (ss.size_mult || 0.5);
      const sx = x + (ss.offset_x || 0);
      const sy = y + (ss.offset_y || 0);
      const ssCol = flash ? '#ffffff' : (ss.color || '#ff1a6e');
      ctx.save();
      ctx.shadowBlur = ss.glow_intensity || 20;
      ctx.shadowColor = ssCol;
      ctx.fillStyle   = ssCol;
      if ((ss.spoke_count || 0) > 0) {
        ctx.strokeStyle = ssCol;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < ss.spoke_count; i++) {
          const a = (Math.PI * 2 / ss.spoke_count) * i;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * (sr + 4), sy + Math.sin(a) * (sr + 4));
          ctx.lineTo(sx + Math.cos(a) * (sr + 14), sy + Math.sin(a) * (sr + 14));
          ctx.stroke();
        }
      }
      ctx.beginPath();
      _drawShape(ctx, sx, sy, sr, ss.shape || 'circle');
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });

    // 內核（core_color_mode: hp_shift=預設漸變, fixed=固定用 primary_color）
    const ic = flash ? (cv.primary_color || '#ff1a6e')
      : cv.core_color_mode === 'fixed' ? (cv.primary_color || '#ff1a6e')
      : `hsl(${hpRatio * 120},100%,55%)`;
    ctx.fillStyle = ic; ctx.shadowBlur = 20; ctx.shadowColor = ic;
    ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 共用形狀繪製（與 dev_editor PREVIEW 保持一致）
  function _drawShape(ctx, x, y, r, shape) {
    switch (shape) {
      case 'circle':
        ctx.arc(x, y, r, 0, Math.PI * 2);
        break;
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 / 6) * i;
          i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
                  : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        break;
      case 'pentagon':
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
          i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
                  : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        break;
      case 'square':
        ctx.rect(x - r, y - r, r * 2, r * 2);
        break;
      case 'triangle':
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
          i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
                  : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a  = (Math.PI * 2 / 10) * i - Math.PI / 2;
          const rv = i % 2 === 0 ? r : r * 0.42;
          i === 0 ? ctx.moveTo(x + Math.cos(a) * rv, y + Math.sin(a) * rv)
                  : ctx.lineTo(x + Math.cos(a) * rv, y + Math.sin(a) * rv);
        }
        break;
      case 'cross': {
        const arm = r * 0.38;
        ctx.rect(x - arm, y - r, arm * 2, r * 2);
        ctx.rect(x - r, y - arm, r * 2, arm * 2);
        break;
      }
      default: // diamond
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.65, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.65, y);
    }
  }

  function _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function _renderMobs(ctx) {
    mobs.forEach(mob => {
      if (!mob.alive) return;
      const hpR  = mob.hp / mob.maxHp;
      const flash = mob.hitFlash > 0;

      // 讀取自訂外觀
      const cv    = _getMobVisual(mob.threat);
      const col   = cv.primary_color || mob.color || '#ff6b35';
      const glow  = cv.glow_intensity || 24;
      const rMult = cv.size_multiplier || 1.0;
      const r     = mob.r * rMult;
      const shape = cv.shape || 'hexagon';

      ctx.save();
      ctx.shadowBlur = glow;
      ctx.shadowColor = flash ? '#ffffff' : col;

      // 外殼（多形狀）
      ctx.strokeStyle = flash ? '#ffffff' : col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + mob.wobbleT * 0.4;
          i === 0 ? ctx.moveTo(mob.x + Math.cos(a) * r, mob.y + Math.sin(a) * r)
                  : ctx.lineTo(mob.x + Math.cos(a) * r, mob.y + Math.sin(a) * r);
        }
      } else if (shape === 'square') {
        ctx.rect(mob.x - r, mob.y - r, r * 2, r * 2);
      } else if (shape === 'triangle') {
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
          i === 0 ? ctx.moveTo(mob.x + Math.cos(a) * r, mob.y + Math.sin(a) * r)
                  : ctx.lineTo(mob.x + Math.cos(a) * r, mob.y + Math.sin(a) * r);
        }
      } else if (shape === 'star') {
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 / 10) * i - Math.PI / 2;
          const rv = i % 2 === 0 ? r : r * 0.42;
          i === 0 ? ctx.moveTo(mob.x + Math.cos(a) * rv, mob.y + Math.sin(a) * rv)
                  : ctx.lineTo(mob.x + Math.cos(a) * rv, mob.y + Math.sin(a) * rv);
        }
      } else { // circle default
        ctx.arc(mob.x, mob.y, r, 0, Math.PI * 2);
      }
      ctx.closePath();
      const rgb = _hexToRgb(col);
      ctx.fillStyle = `rgba(${rgb},0.18)`;
      ctx.fill(); ctx.stroke();

      // 核心
      const ic = flash ? '#ffffff' : `hsl(40,100%,60%)`;
      ctx.fillStyle = ic; ctx.shadowBlur = 10; ctx.shadowColor = ic;
      ctx.beginPath(); ctx.arc(mob.x, mob.y, r * 0.35, 0, Math.PI * 2); ctx.fill();

      // HP 條（可關閉）
      if (cv.show_hp_bar !== false) {
        const bw = r * 2.2, bh = 4;
        const bx = mob.x - bw / 2, by = mob.y - r - 9;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = `hsl(${hpR * 120},100%,45%)`; ctx.fillRect(bx, by, bw * hpR, bh);
      }

      // 子形狀
      (cv.sub_shapes || []).forEach(ss => {
        const sr = r * (ss.size_mult || 0.4);
        const sx = mob.x + (ss.offset_x || 0);
        const sy = mob.y + (ss.offset_y || 0);
        const ssCol = flash ? '#ffffff' : (ss.color || '#ff6b35');
        ctx.save();
        ctx.shadowBlur = ss.glow_intensity || 16;
        ctx.shadowColor = ssCol;
        ctx.fillStyle   = ssCol;
        ctx.beginPath();
        _drawShape(ctx, sx, sy, sr, ss.shape || 'circle');
        ctx.closePath(); ctx.fill();
        ctx.restore();
      });

      ctx.restore();
    });
  }

  // ════════════════════════════════════════════════════════
  //  Getter API
  // ════════════════════════════════════════════════════════

  function isDefeated() {
    if (mode === 'boss') return boss && boss.hp <= 0;
    return mobs.length > 0 && mobs.every(m => !m.alive);
  }

  // 為 seeking bullets 提供追蹤目標
  function getBossPos() {
    if (mode === 'boss') return boss ? { x: boss.x, y: boss.y } : { x: 0, y: 0 };
    const alive = mobs.find(m => m.alive);
    return alive ? { x: alive.x, y: alive.y } : { x: 0, y: 0 };
  }

  function getBossR()   { return boss ? boss.r : (mobs[0]?.r ?? 20); }
  function getHP()      { return mode === 'boss' ? (boss?.hp ?? 0) : mobs.reduce((s, m) => s + (m.alive ? m.hp : 0), 0); }
  function getMaxHP()   { return mode === 'boss' ? (boss?.maxHp ?? 1) : mobs.reduce((s, m) => s + m.maxHp, 0); }
  function getBossName(){ return boss?.name ?? ''; }
  function getCurrentPhase() {
    if (mode === 'mobs') return 1;
    const p = _getCurrentPattern();
    return p ? p.phase : 1;
  }
  function getMobs()    { return mobs; }
  function getMode()    { return mode; }

  function clear() {
    boss = null; mobs = [];
    bossAngle = 0; spiralAngle = 0; wobbleT = 0; hitFlash = 0; shootTimer = 0;
  }

  return {
    initBoss, initMobs, update, takeDamage, takeMobDamage, render,
    isDefeated, getBossPos, getBossR, getHP, getMaxHP, getBossName,
    getCurrentPhase, getMobs, getMode, clear,
  };
})();
