/**
 * ui/bullets.js
 * 子彈物件池（Phase 5 更新）：追蹤子彈 + 效能計數。
 */
window.BULLETS = (() => {
  const POOL_SIZE = 800;
  const pool = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      r: 4, damage: 10, team: 'enemy', color: '#ff1a6e',
      life: 0, maxLife: 300,
      seeking: false, seekStrength: 0,
    });
  }

  let _activeCount = 0;

  function spawn({ x, y, vx, vy, r = 4, damage = 10, team = 'enemy', color = '#ff1a6e', maxLife = 300, seeking = false, seekStrength = 0 }) {
    for (const b of pool) {
      if (!b.active) {
        b.active = true;
        b.x = x; b.y = y; b.vx = vx; b.vy = vy;
        b.r = r; b.damage = damage; b.team = team;
        b.color = color; b.life = 0; b.maxLife = maxLife;
        b.seeking = seeking; b.seekStrength = seekStrength;
        return b;
      }
    }
    return null;
  }

  function update(cw, ch) {
    _activeCount = 0;
    // 取得追蹤目標（Boss 位置）
    const target = ENEMY?.getBossPos?.() || { x: cw / 2, y: 80 };

    for (const b of pool) {
      if (!b.active) continue;
      _activeCount++;

      // 追蹤邏輯
      if (b.seeking && b.team === 'player') {
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          b.vx += (dx / dist) * b.seekStrength;
          b.vy += (dy / dist) * b.seekStrength;
          // 限制最大速度
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (spd > 10) { b.vx = b.vx / spd * 10; b.vy = b.vy / spd * 10; }
        }
      }

      b.x += b.vx;
      b.y += b.vy;
      b.life++;

      if (b.x < -30 || b.x > cw + 30 || b.y < -30 || b.y > ch + 30 || b.life > b.maxLife) {
        b.active = false;
      }
    }
  }

  function render(ctx) {
    for (const b of pool) {
      if (!b.active) continue;

      ctx.save();
      ctx.shadowBlur = b.r * 4;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // 拖尾
      if (b.r > 1) {
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(b.x - b.vx * 2.5, b.y - b.vy * 2.5, b.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function getActive(team) {
    return pool.filter(b => b.active && (!team || b.team === team));
  }

  function getActiveCount() { return _activeCount; }

  function clear() { pool.forEach(b => { b.active = false; }); _activeCount = 0; }

  return { spawn, update, render, getActive, getActiveCount, clear };
})();
