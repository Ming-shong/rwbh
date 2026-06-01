/**
 * ui/battle_canvas.js
 * 彈幕戰鬥主迴圈（Phase 6 更新）：整合 SFX + VFX，FPS 計數，效能監控。
 */
window.BATTLE = (() => {
  let canvas, ctx;
  let animId      = null;
  let poiData     = null;
  let _resultTimer = null;
  let startTime   = 0;
  let damageTaken   = 0;
  let enemiesKilled = 0;
  let gameState   = 'idle';
  let endScheduled = false;

  // FPS 計數
  let fpsFrames = 0, fpsLast = 0, fpsCurrent = 0;

  // 傷害數字
  const damageNumbers = [];

  // 背景星點
  const STARS = [];
  function _initStars(cw, ch) {
    STARS.length = 0;
    for (let i = 0; i < 90; i++) {
      STARS.push({ x: Math.random() * cw, y: Math.random() * ch, r: Math.random() * 1.4 + 0.3, speed: Math.random() * 0.5 + 0.1, op: Math.random() * 0.5 + 0.2 });
    }
  }
  function _updateStars(ch) { STARS.forEach(s => { s.y += s.speed; if (s.y > ch) s.y = 0; }); }
  function _drawStars() { STARS.forEach(s => { ctx.fillStyle = `rgba(200,220,255,${s.op})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }); }

  function _drawDamageNumbers() {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dn = damageNumbers[i];
      const t = 1 - dn.life / dn.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffcc00';
      ctx.fillStyle = '#ffcc00';
      ctx.font = `bold ${10 + Math.round((1 - t) * 4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${dn.val}`, dn.x, dn.y - dn.life * 0.5);
      ctx.restore();
      dn.life++;
      if (dn.life >= dn.maxLife) damageNumbers.splice(i, 1);
    }
  }

  // 碰撞偵測（含 SFX + VFX）
  function _checkCollisions() {
    // 玩家子彈 → 敵人
    if (ENEMY.getMode() === 'mobs') {
      // Mob 模式：每顆子彈對每隻存活小怪做圓形碰撞
      const liveMobs = ENEMY.getMobs().filter(m => m.alive);
      for (const b of BULLETS.getActive('player')) {
        for (const mob of liveMobs) {
          const dx = b.x - mob.x, dy = b.y - mob.y;
          if (dx * dx + dy * dy < (mob.r + b.r) ** 2) {
            b.active = false;
            ENEMY.takeMobDamage(mob.id, b.damage);
            VFX.spawnHitSpark(b.x, b.y, b.color);
            damageNumbers.push({ x: mob.x + (Math.random()-.5)*20, y: mob.y - 16, val: b.damage, life: 0, maxLife: 40 });
            break; // 一顆子彈只打一隻
          }
        }
      }
    } else {
      // Boss 模式
      const bp = ENEMY.getBossPos();
      const br = ENEMY.getBossR();
      for (const b of BULLETS.getActive('player')) {
        const dx = b.x - bp.x, dy = b.y - bp.y;
        if (dx * dx + dy * dy < (br + b.r) ** 2) {
          b.active = false;
          if (ENEMY.takeDamage(b.damage)) enemiesKilled++;
          VFX.spawnHitSpark(b.x, b.y, b.color);
          SFX.enemyHit();
          const bp2 = ENEMY.getBossPos();
          damageNumbers.push({ x: bp2.x + (Math.random()-.5)*30, y: bp2.y - 20, val: b.damage, life: 0, maxLife: 40 });
        }
      }
    }

    // 敵方子彈 → 玩家
    const pr = PLAYER_OBJ.radius;
    for (const b of BULLETS.getActive('enemy')) {
      const dx = b.x - PLAYER_OBJ.x, dy = b.y - PLAYER_OBJ.y;
      if (dx * dx + dy * dy < (pr + b.r) ** 2) {
        if (PLAYER_OBJ.takeDamage(b.damage)) {
          b.active = false;
          damageTaken += b.damage;
          VFX.spawnPlayerHit(PLAYER_OBJ.x, PLAYER_OBJ.y);
          SFX.playerHit();
        }
      }
    }
  }

  // HUD
  function _drawHUD(cw, ch) {
    const phRatio = PLAYER_OBJ.hp / PLAYER_OBJ.maxHp;

    // 玩家 HP（左下）
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(12, ch - 36, 180, 18);
    ctx.fillStyle = `hsl(${phRatio * 120},100%,45%)`;
    ctx.fillRect(13, ch - 35, 178 * phRatio, 16);
    ctx.strokeStyle = 'rgba(0,240,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, ch - 36, 180, 18);
    ctx.fillStyle = '#c8deff';
    ctx.font = '10px "Share Tech Mono"';
    ctx.textAlign = 'left';
    ctx.fillText(`HP  ${PLAYER_OBJ.hp} / ${PLAYER_OBJ.maxHp}`, 16, ch - 22);

    // 武器名稱（左下下方）
    const w = INVENTORY.getActiveWeapon();
    ctx.fillStyle = w.color || '#00f0ff';
    ctx.font = '9px "Share Tech Mono"';
    ctx.fillText(`${w.icon || '▷'} ${w.name || '脈衝槍'}`, 14, ch - 8);

    // 上方中央：Boss HP 條 / Mob 計數
    const bw = Math.min(cw * 0.55, 380);
    const bx = (cw - bw) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx, 8, bw, 20);

    if (ENEMY.getMode() === 'mobs') {
      // Mob 模式：顯示存活/總數
      const allMobs   = ENEMY.getMobs();
      const aliveCount = allMobs.filter(m => m.alive).length;
      const totalCount = allMobs.length;
      const ratio = aliveCount / totalCount;
      ctx.fillStyle = `rgba(255,107,53,${0.4 + ratio * 0.6})`;
      ctx.fillRect(bx + 1, 9, (bw - 2) * ratio, 18);
      ctx.strokeStyle = 'rgba(255,107,53,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, 8, bw, 20);
      ctx.fillStyle = '#ff6b35';
      ctx.font = 'bold 10px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(`小怪 ${aliveCount} / ${totalCount}`, cw / 2, 23);
    } else {
      // Boss 模式：顯示 HP 條 + 名稱
      const bRatio = Math.max(0, ENEMY.getHP() / ENEMY.getMaxHP());
      ctx.fillStyle = `rgba(255,26,110,${0.4 + bRatio * 0.6})`;
      ctx.fillRect(bx + 1, 9, (bw - 2) * bRatio, 18);
      ctx.strokeStyle = 'rgba(255,26,110,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, 8, bw, 20);
      ctx.fillStyle = '#ff1a6e';
      ctx.font = 'bold 10px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(ENEMY.getBossName(), cw / 2, 23);
      ctx.fillStyle = '#ffaa00';
      ctx.font = '9px "Share Tech Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(`PHASE ${ENEMY.getCurrentPhase()}`, bx + 6, 23);
    }

    // 右上：FPS + 子彈數
    ctx.fillStyle = 'rgba(80,110,140,0.7)';
    ctx.font = '9px "Share Tech Mono"';
    ctx.textAlign = 'right';
    ctx.fillText(`FPS ${fpsCurrent}  ⦿ ${BULLETS.getActiveCount()}`, cw - 10, 20);

    // 右下：時間 + ESC
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    ctx.fillStyle = 'rgba(80,110,140,0.6)';
    ctx.fillText(`[ESC] 撤退`, cw - 10, ch - 22);
    ctx.fillText(mm + ':' + ss, cw - 10, ch - 8);
    ctx.textAlign = 'left';
  }

  // 結算畫面
  function _drawResult(cw, ch, won) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    ctx.shadowBlur = 30;
    ctx.shadowColor = won ? '#00ff88' : '#ff3a3a';
    ctx.fillStyle   = won ? '#00ff88' : '#ff3a3a';
    ctx.font = 'bold 38px "Orbitron"';
    ctx.fillText(won ? 'VICTORY' : 'DEFEAT', cw / 2, ch / 2 - 32);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c8deff';
    ctx.font = '13px "Share Tech Mono"';
    if (won && poiData?._earnedCrystals) {
      ctx.fillText(`◈ 獲得變異結晶 ×${poiData._earnedCrystals}`, cw / 2, ch / 2 + 12);
      let yOff = 32;
      if (poiData._speedBonus)  { ctx.fillStyle = '#ffaa00'; ctx.fillText('⚡ 速殺加成', cw / 2, ch / 2 + yOff); yOff += 20; }
      if (poiData._noDmgBonus)  { ctx.fillStyle = '#00ff88'; ctx.fillText('✦ 無傷加成', cw / 2, ch / 2 + yOff); }
    } else if (!won) {
      ctx.fillStyle = '#ff6060';
      ctx.fillText('繼續探索，再次挑戰', cw / 2, ch / 2 + 12);
    }
    ctx.fillStyle = 'rgba(100,120,150,0.7)';
    ctx.font = '10px "Share Tech Mono"';
    ctx.fillText('3 秒後返回地圖...', cw / 2, ch / 2 + 70);
    ctx.textAlign = 'left';
  }

  // 勝負判定
  function _checkEndConditions() {
    if (endScheduled) return;

    if (ENEMY.isDefeated()) {
      gameState = 'won';
      endScheduled = true;
      VFX.spawnBossDefeat(ENEMY.getBossPos().x, ENEMY.getBossPos().y);
      SFX.victory();
      const _vlines = window._CUSTOM_LORE?.victory_lines;
      if (_vlines?.length) window.HUD?.toast?.(_vlines[Math.floor(Math.random()*_vlines.length)], 2500);

      const elapsed  = (Date.now() - startTime) / 1000;
      const threat   = poiData?.effective_threat || poiData?.threat || 1;
      const _bal     = window._CUSTOM_BALANCE?.crystals || {};
      const _baseArr = _bal.base || {1:8,2:18,3:35,4:70,5:140};
      const base     = (_baseArr[threat] || _baseArr[String(threat)]) ?? [8,18,35,70,140][Math.min(4, threat-1)];
      const sMult    = Math.max(0.5, Math.min(2.0, threat * 30 / Math.max(elapsed, 1)));
      const ndMult   = damageTaken === 0 ? (_bal.no_damage_mult ?? 1.5) : 1.0;
      const crystals = Math.max(1, Math.round(base * sMult * (_bal.speed_bonus_mult ?? 1.0) * ndMult * (0.8 + Math.random() * 0.4)));
      poiData._earnedCrystals = crystals;
      poiData._speedBonus  = sMult > 1.2;
      poiData._noDmgBonus  = damageTaken === 0;

      // Boss 戰有機率掉落奇物
      const relicDrop = (poiData.type === 'boss')
        ? (window.RELICS?.rollDrop?.(threat) || null) : null;

      const resultData = { poi_id: poiData.id, won: true, crystals, damage_taken: damageTaken, type: poiData.type, threat, speed_bonus: poiData._speedBonus, no_damage_bonus: poiData._noDmgBonus, relic_drop: relicDrop };
      _showExitBtn(() => { clearTimeout(_resultTimer); TRANSITION.toMap(resultData); });
      _resultTimer = setTimeout(() => TRANSITION.toMap(resultData), 3000);

    } else if (!PLAYER_OBJ.alive) {
      gameState = 'lost';
      endScheduled = true;
      SFX.defeat();
      const _dlines = window._CUSTOM_LORE?.defeat_lines;
      if (_dlines?.length) window.HUD?.toast?.(_dlines[Math.floor(Math.random()*_dlines.length)], 2500);
      const resultData = { poi_id: poiData.id, won: false, crystals: 0, damage_taken: damageTaken };
      _showDeathScreen(resultData);
    }
  }

  function _showExitBtn(cb) {
    const el = document.getElementById('battle-result-exit');
    if (!el) return;
    el.style.display = 'block';
    window.BATTLE_EXIT = () => { el.style.display = 'none'; window.BATTLE_EXIT = null; cb(); };
  }

  function _showDeathScreen(resultData) {
    const screen = document.getElementById('battle-death-screen');
    if (!screen) return;
    screen.style.display = 'flex';

    // 倒數顯示
    let countdown = 3;
    const countEl = screen.querySelector('.death-countdown');
    if (countEl) countEl.textContent = countdown;
    const tickId = setInterval(() => {
      countdown--;
      if (countEl) countEl.textContent = Math.max(0, countdown);
    }, 1000);

    const doExit = () => {
      clearInterval(tickId);
      clearTimeout(_resultTimer);
      screen.style.display = 'none';
      window.BATTLE_EXIT = null;
      TRANSITION.toMap(resultData);
    };
    _resultTimer = setTimeout(doExit, 3000);
    window.BATTLE_EXIT = doExit;
  }

  // 主迴圈
  function _loop(timestamp) {
    if (gameState === 'idle') return;

    // FPS 計算
    fpsFrames++;
    if (timestamp - fpsLast >= 1000) {
      fpsCurrent = fpsFrames;
      fpsFrames  = 0;
      fpsLast    = timestamp;
    }

    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, cw, ch);
    _updateStars(ch);
    _drawStars();

    if (gameState === 'playing') {
      PLAYER_OBJ.update(cw, ch);
      ENEMY.update(cw, ch, PLAYER_OBJ.x, PLAYER_OBJ.y);
      BULLETS.update(cw, ch);
      VFX.update();
      _checkCollisions();
      _checkEndConditions();
    }

    VFX.render(ctx);
    BULLETS.render(ctx);
    ENEMY.render(ctx);
    PLAYER_OBJ.render(ctx);
    _drawDamageNumbers();
    _drawHUD(cw, ch);

    if (gameState === 'won' || gameState === 'lost') {
      _drawResult(cw, ch, gameState === 'won');
    }

    animId = requestAnimationFrame(_loop);
  }

  // ── 公開 API ─────────────────────────────────────────────────────────────────

  async function start(data) {
    // 每次戰鬥開始前重新讀取最新自訂設定
    try {
      const r = await fetch('/api/config');
      const j = await r.json();
      if (j.ok && j.config) {
        const c = j.config;
        if (c.visuals)   window._CUSTOM_VISUALS   = c.visuals;
        if (c.mechanics) window._CUSTOM_MECHANICS = c.mechanics;
        if (c.lore)      window._CUSTOM_LORE      = c.lore;
      }
    } catch(_) {}

    SFX.init();

    // 清除上一場殘留的結算計時器、退出按鈕、死亡畫面
    if (_resultTimer) { clearTimeout(_resultTimer); _resultTimer = null; }
    const exitEl = document.getElementById('battle-result-exit');
    if (exitEl) exitEl.style.display = 'none';
    window.BATTLE_EXIT = null;
    const deathEl = document.getElementById('battle-death-screen');
    if (deathEl) deathEl.style.display = 'none';
    window.DEATH_RESTART = null;

    canvas = document.getElementById('battle-canvas');
    ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    // 立刻清空畫面，避免殘留上一場結算畫面
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poiData      = data;
    startTime    = Date.now();
    damageTaken  = 0;
    damageNumbers.length = 0;
    gameState    = 'playing';
    endScheduled = false;
    fpsFrames    = 0; fpsLast = 0; fpsCurrent = 0;

    _initStars(canvas.width, canvas.height);
    BULLETS.clear();
    VFX.clear();
    PLAYER_OBJ.init(canvas.width / 2, canvas.height - 80);

    if (data.type === 'boss') {
      ENEMY.initBoss(data);
    } else {
      // Mob 戰：依 mob_count 生成多個小怪
      ENEMY.initMobs({
        ...data,
        mob_count: data.mob_count || 3,
        boss_hp:   data.boss_hp || Math.max(150, 200 * (data.effective_threat || data.threat || 1)),
      });
    }

    canvas.onmousemove = e => PLAYER_OBJ.setMouse(e.clientX, e.clientY);


    window._battleEsc = e => {
      if (e.key === 'Escape' && gameState === 'playing') {
        gameState = 'lost';
        endScheduled = true;
        SFX.defeat();
        setTimeout(() => TRANSITION.toMap({ poi_id: data.id, won: false, crystals: 0, damage_taken: damageTaken }), 300);
      }
    };
    document.addEventListener('keydown', window._battleEsc);
    animId = requestAnimationFrame(_loop);
  }

  function stop() {
    gameState = 'idle';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    BULLETS.clear();
    VFX.clear();
    ENEMY.clear();
    if (window._battleEsc) document.removeEventListener('keydown', window._battleEsc);
    const exitEl = document.getElementById('battle-result-exit');
    if (exitEl) exitEl.style.display = 'none';
    window.BATTLE_EXIT = null;
    const deathEl = document.getElementById('battle-death-screen');
    if (deathEl) deathEl.style.display = 'none';
    window.DEATH_RESTART = null;
    if (canvas) canvas.onmousemove = null;
    // 清空 canvas，避免殘留畫面在下次淡入時出現
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop };
})();
