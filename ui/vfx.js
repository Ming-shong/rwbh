/**
 * ui/vfx.js
 * 視覺特效系統：爆炸粒子、受擊火花、擊敗演出。
 * 所有粒子在 battle_canvas 的每幀呼叫 update / render。
 */
window.VFX = (() => {
  const particles = [];

  // ── 粒子生成 ──────────────────────────────────────────────────────────────────

  function spawnHitSpark(x, y, color = '#ff1a6e') {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 3 + 1;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 2 + 0.8, color, life: 0, maxLife: 14 + Math.random() * 8, type: 'spark' });
    }
  }

  function spawnExplosion(x, y, count = 14, color = '#ff6b35') {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 5 + 1.5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 4 + 1.5, color, life: 0, maxLife: 28 + Math.random() * 20, type: 'explosion' });
    }
    // 中心閃光
    particles.push({ x, y, vx: 0, vy: 0, r: 20, color: '#ffffff', life: 0, maxLife: 8, type: 'flash' });
  }

  function spawnBossDefeat(x, y) {
    const colors = ['#ff1a6e', '#ff6600', '#ffaa00', '#ffffff', '#00f0ff', '#aa00ff'];
    for (let wave = 0; wave < 4; wave++) {
      setTimeout(() => {
        const c = colors[wave % colors.length];
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = Math.random() * 8 + 2;
          particles.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 5 + 2, color: c, life: 0, maxLife: 45 + Math.random() * 30, type: 'explosion' });
        }
        // 大閃光
        particles.push({ x, y, vx: 0, vy: 0, r: 60 - wave * 10, color: '#ffffff', life: 0, maxLife: 10, type: 'flash' });
      }, wave * 120);
    }
  }

  function spawnPlayerHit(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 2;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 3 + 1, color: '#ff3a3a', life: 0, maxLife: 20 + Math.random() * 12, type: 'explosion' });
    }
  }

  // ── 更新與渲染 ──────────────────────────────────────────────────────────────

  function update() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.90;
      p.vy *= 0.90;
      p.life++;
    }
    // 移除結束的粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life >= particles[i].maxLife) particles.splice(i, 1);
    }
  }

  function render(ctx) {
    for (const p of particles) {
      const t = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = p.type === 'flash' ? t * 0.85 : t * 0.9;
      ctx.shadowBlur  = p.type === 'flash' ? p.r * 2 : p.r * 3;
      ctx.shadowColor = p.color;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      const radius = p.type === 'flash' ? p.r * t : p.r * (0.3 + t * 0.7);
      ctx.arc(p.x, p.y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function clear() { particles.length = 0; }

  return { spawnHitSpark, spawnExplosion, spawnBossDefeat, spawnPlayerHit, update, render, clear };
})();
