/**
 * ui/sfx.js
 * 音效系統（Web Audio API，不依賴外部音檔）。
 * 所有音效皆由振盪器即時合成。
 */
window.SFX = (() => {
  let actx = null;
  let enabled = true;

  function init() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      enabled = false;
    }
  }

  function setEnabled(v) { enabled = v; }

  // 通用 envelope 播放
  function _tone({ freq = 440, freq2 = null, duration = 0.1, type = 'square', vol = 0.08, attack = 0.005, decay = 0.05, sustain = 0.3, release = 0.05 } = {}) {
    if (!actx || !enabled) return;
    const osc  = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, actx.currentTime);
    if (freq2) osc.frequency.linearRampToValueAtTime(freq2, actx.currentTime + duration);
    const t = actx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.linearRampToValueAtTime(vol * sustain, t + attack + decay);
    gain.gain.setValueAtTime(vol * sustain, t + duration - release);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  // 雜訊（用於爆炸）
  function _noise(duration = 0.15, vol = 0.1) {
    if (!actx || !enabled) return;
    const bufSize = actx.sampleRate * duration;
    const buf  = actx.createBuffer(1, bufSize, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = actx.createBufferSource();
    const gain = actx.createGain();
    const filter = actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    src.buffer = buf;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    const t = actx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    src.start(t);
    src.stop(t + duration);
  }

  // ── 音效定義 ──────────────────────────────────────────────────────────────────

  function shoot() {
    _tone({ freq: 1200, freq2: 800, duration: 0.06, type: 'square', vol: 0.04, attack: 0.002, decay: 0.04, sustain: 0, release: 0.01 });
  }

  function shootLaser() {
    _tone({ freq: 600, freq2: 2000, duration: 0.12, type: 'sawtooth', vol: 0.07, attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.03 });
  }

  function shootSeek() {
    _tone({ freq: 900, freq2: 1100, duration: 0.08, type: 'sine', vol: 0.05, attack: 0.01, decay: 0.06, sustain: 0, release: 0.01 });
  }

  function enemyHit() {
    _tone({ freq: 380, freq2: 200, duration: 0.07, type: 'sawtooth', vol: 0.07, attack: 0.003, decay: 0.05, sustain: 0, release: 0.01 });
  }

  function playerHit() {
    _noise(0.18, 0.14);
    _tone({ freq: 150, freq2: 80, duration: 0.2, type: 'sine', vol: 0.12, attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.06 });
  }

  function victory() {
    // 上揚音階
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => _tone({ freq: f, duration: 0.18, type: 'square', vol: 0.08, attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.06 }), i * 120);
    });
    setTimeout(() => _tone({ freq: 1047, freq2: 1319, duration: 0.4, type: 'square', vol: 0.1, attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.1 }), 480);
  }

  function defeat() {
    // 下沉音階
    const notes = [400, 320, 240, 160];
    notes.forEach((f, i) => {
      setTimeout(() => _tone({ freq: f, freq2: f * 0.7, duration: 0.22, type: 'sawtooth', vol: 0.07, attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.07 }), i * 160);
    });
  }

  function phaseChange() {
    _tone({ freq: 220, freq2: 440, duration: 0.3, type: 'square', vol: 0.1, attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.1 });
  }

  function buyItem() {
    _tone({ freq: 880, freq2: 1320, duration: 0.12, type: 'sine', vol: 0.07, attack: 0.005, decay: 0.08, sustain: 0.3, release: 0.04 });
  }

  return { init, setEnabled, shoot, shootLaser, shootSeek, enemyHit, playerHit, victory, defeat, phaseChange, buyItem };
})();
