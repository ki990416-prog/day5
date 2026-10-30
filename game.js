'use strict';
// 제주 건물 부수기 — 중앙으로 떨어지는 건물을 점프해서 칼로 베어 부수는 2D 게임
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 800, H = 600, GY = 520;
const FONT = '"Malgun Gothic", sans-serif';

// ---------- 사운드 ----------
let actx = null;
function beep(freq, dur, type, vol, slide) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  jump: () => beep(300, 0.12, 'square', 0.05, 250),
  swing: () => beep(900, 0.1, 'sawtooth', 0.05, -600),
  parry: () => beep(500, 0.18, 'triangle', 0.08, 500),
  hit: () => beep(140, 0.1, 'sawtooth', 0.09, -60),
  boom: () => { beep(90, 0.35, 'sawtooth', 0.12, -50); beep(200, 0.2, 'square', 0.06, -120); },
  get: () => beep(780, 0.1, 'triangle', 0.07, 400),
  hurt: () => beep(180, 0.4, 'sawtooth', 0.12, -140),
  power: () => { beep(520, 0.15, 'triangle', 0.08, 300); setTimeout(() => beep(780, 0.2, 'triangle', 0.08, 400), 120); },
};

// ---------- 입력 ----------
const keys = { left: false, right: false };
let jumpBuf = 0, atkBuf = 0, parryBuf = 0;
const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
const jumpKeys = ['ArrowUp', 'w', 'W'];
const parryKeys = ['ArrowDown', 's', 'S'];
addEventListener('keydown', e => {
  if (keyMap[e.key]) { keys[keyMap[e.key]] = true; e.preventDefault(); }
  if (jumpKeys.includes(e.key)) { e.preventDefault(); if (!e.repeat) pressJump(); }
  if (parryKeys.includes(e.key)) { e.preventDefault(); if (!e.repeat) pressParry(); }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) pressAttack(); }
});
addEventListener('keyup', e => {
  if (keyMap[e.key]) keys[keyMap[e.key]] = false;
});
function tryStart() { if (state === 'title' || (state === 'over' && overT > 0.8)) startGame(); }
function pressJump() { if (state !== 'play') { tryStart(); return; } jumpBuf = 0.12; }
function pressAttack() { if (state !== 'play') { tryStart(); return; } atkBuf = 0.12; }
function pressParry() { if (state === 'play') parryBuf = 0.08; }
function bindBtn(id, fn, up) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
  const release = e => { e.preventDefault(); if (up) up(); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}
bindBtn('bL', () => keys.left = true, () => keys.left = false);
bindBtn('bR', () => keys.right = true, () => keys.right = false);
bindBtn('bJ', pressJump);
bindBtn('bA', pressAttack);
bindBtn('bD', pressParry);
cv.addEventListener('pointerdown', tryStart);

// ---------- 게임 데이터 ----------
const STAGES = ['제주공항 앞', '성산일출봉', '우도 해변', '한라산 중턱', '섭지코지', '중문 관광단지', '애월 해안도로', '백록담 정상'];
const SKIES = [
  ['#6cc3f2', '#dff4ff'], ['#ffa86b', '#ffe9b0'], ['#4fb5e8', '#cdf0ff'], ['#8aa8e8', '#e6e0ff'],
  ['#ff8f7a', '#ffd9a8'], ['#5bc7d9', '#e1fff6'], ['#3a4a8c', '#e69a8a'], ['#1c2a5a', '#6a6fb5'],
];
const TYPES = [
  { id: 'thatch', name: '초가집', w: 110, h: 80, hp: 2, wt: 5 },
  { id: 'storage', name: '귤 창고', w: 130, h: 90, hp: 3, wt: 5 },
  { id: 'light', name: '등대', w: 72, h: 150, hp: 3, wt: 3 },
  { id: 'cafe', name: '오션뷰 카페', w: 150, h: 110, hp: 4, wt: 3 },
  { id: 'hotel', name: '리조트', w: 190, h: 150, hp: 6, wt: 2 },
];
// 난이도는 낙하 속도로만 조절한다
const fallSpeed = () => Math.min(380, 80 + (level - 1) * 14);
const KILLS_PER_LEVEL = 6;
const JUMP_V = -1150;
const SWING_TIME = 0.12, SWING_CD = 0.16;
const PARRY_TIME = 0.25, PARRY_CD = 0.9, PARRY_KV = 1100, PARRY_DECAY = 2000;

let state = 'title';
let best = 0;
try { best = +localStorage.getItem('jejuBest') || 0; } catch (e) {}

let player, blds, parts, items, floats;
let score, lives, level, killed, spawnT, time, combo, comboT, tang, power, shakeT, overT, flash;
let swingT, swingCd, swingId, parryT, parryCd, parryId;

function reset() {
  player = { x: W / 2, y: GY, vx: 0, vy: 0, onG: true, inv: 0, sq: 0, w: 34, h: 66 };
  blds = []; parts = []; items = []; floats = [];
  score = 0; lives = 3; level = 1; killed = 0; spawnT = 0.8; time = 0;
  combo = 0; comboT = 0; tang = 0; power = 0; shakeT = 0; overT = 0; flash = 0;
  swingT = 0; swingCd = 0; swingId = 0; parryT = 0; parryCd = 0; parryId = 0;
  jumpBuf = 0; atkBuf = 0; parryBuf = 0;
}
function startGame() { reset(); state = 'play'; sfx.get(); }
reset();

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- 스폰 ----------
function pickType() {
  let r = Math.random() * TYPES.reduce((s, t) => s + t.wt, 0), t = TYPES[0];
  for (const p of TYPES) { if ((r -= p.wt) <= 0) { t = p; break; } }
  return t;
}
// 건물 3~4채를 위아래로 딱 붙여서 화면 중앙 위쪽에서 내려보낸다
function spawnWave() {
  const n = 3 + Math.floor(Math.random() * 2);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = pickType();
    y -= t.h;
    blds.push({
      type: t.id, name: t.name, x: W / 2, y, w: t.w, h: t.h, hp: t.hp, maxhp: t.hp,
      lastSwing: -1, parryId: -1, kv: 0, shake: 0, seed: Math.floor(rnd(1, 99999)), lit: Math.random(),
    });
  }
}

// ---------- 효과 ----------
function burst(x, y, color, n, power2) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-1, 1) * (power2 || 220), vy: rnd(-1, 0.3) * (power2 || 220),
      s: rnd(4, 11), c: color, life: rnd(0.6, 1.3), rot: rnd(0, 6), vr: rnd(-8, 8),
    });
  }
}
function floatText(x, y, text, color) { floats.push({ x, y, text, color: color || '#fff', life: 1 }); }
function shake(t) { shakeT = Math.max(shakeT, t); }

const MAINCOL = { thatch: '#d9b45a', storage: '#f2a33a', light: '#f4f4f0', cafe: '#7fd6d0', hotel: '#e8d8b8' };

function hitBuilding(b, dmg) {
  b.hp -= dmg; b.lastSwing = swingId; b.y -= 12; b.shake = 0.18;
  combo++; comboT = 1.4;
  const gain = 10 * combo;
  score += gain;
  floatText(b.x, b.y + b.h + 6, '+' + gain, combo >= 5 ? '#ffe14a' : '#fff');
  burst(b.x + rnd(-b.w / 3, b.w / 3), b.y + b.h, MAINCOL[b.type], 6, 160);
  sfx.hit(); shake(0.12);
  if (b.hp <= 0) destroy(b, true);
}
function destroy(b, scored) {
  blds.splice(blds.indexOf(b), 1);
  burst(b.x, b.y + b.h / 2, MAINCOL[b.type], 20 + (b.w >> 3), 330);
  burst(b.x, b.y + b.h / 2, '#6b6f73', 10, 260);
  sfx.boom(); shake(0.3);
  if (!scored) return;
  killed++;
  const nl = 1 + Math.floor(killed / KILLS_PER_LEVEL);
  if (nl !== level) { level = nl; floatText(W / 2, 200, 'STAGE ' + level + ' · ' + STAGES[(level - 1) % STAGES.length], '#ffe14a'); }
  const bonus = b.maxhp * 50 * Math.max(1, combo >> 1);
  score += bonus;
  floatText(b.x, b.y + b.h / 2, '부숨! +' + bonus, '#ffd34a');
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) items.push({ kind: 'tang', x: b.x + rnd(-20, 20), y: b.y + b.h / 2, vx: rnd(-90, 90), vy: rnd(-260, -120), life: 8 });
  if (Math.random() < 0.08 && lives < 5) items.push({ kind: 'heart', x: b.x, y: b.y + b.h / 2, vx: rnd(-40, 40), vy: -220, life: 9 });
}

function hurt() {
  lives--; player.inv = 1.6; flash = 0.3; shake(0.5); sfx.hurt(); combo = 0;
  if (lives <= 0) { state = 'over'; overT = 0; if (score > best) { best = score; try { localStorage.setItem('jejuBest', best); } catch (e) {} } }
}

// ---------- 업데이트 ----------
function update(dt) {
  time += dt;
  // 플레이어
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.vx += (dir * 320 - player.vx) * Math.min(1, dt * 14);
  player.x = Math.max(22, Math.min(W - 22, player.x + player.vx * dt));
  jumpBuf -= dt; atkBuf -= dt;
  swingT = Math.max(0, swingT - dt); swingCd = Math.max(0, swingCd - dt);
  if (jumpBuf > 0 && player.onG) { player.vy = JUMP_V; player.onG = false; jumpBuf = 0; player.sq = -0.25; sfx.jump(); }
  // 점프 중에만 스페이스로 칼을 휘두를 수 있다
  if (atkBuf > 0 && !player.onG && swingCd <= 0) { swingT = SWING_TIME; swingCd = SWING_CD; swingId++; atkBuf = 0; sfx.swing(); }
  player.vy += 2000 * dt;
  player.y += player.vy * dt;
  if (player.y >= GY) { if (!player.onG && player.vy > 200) player.sq = 0.25; player.y = GY; player.vy = 0; player.onG = true; }
  player.sq *= Math.max(0, 1 - dt * 12);
  player.inv = Math.max(0, player.inv - dt);
  power = Math.max(0, power - dt);

  // 아래 방향키: 튕겨내기 (짧은 시간 동안 머리 위 건물을 위로 날려 보낸다)
  parryBuf -= dt; parryT = Math.max(0, parryT - dt); parryCd = Math.max(0, parryCd - dt);
  if (parryBuf > 0 && parryCd <= 0) { parryT = PARRY_TIME; parryCd = PARRY_CD; parryId++; parryBuf = 0; sfx.parry(); }

  // 스폰: 앞선 묶음이 화면 안으로 충분히 들어와야 다음 묶음이 나온다
  spawnT -= dt;
  if (spawnT <= 0 && !blds.some(b => b.y < 40)) { spawnWave(); spawnT = 0.4; }

  // 칼 판정 영역
  const reach = power > 0 ? 130 : 100;
  const dmg = power > 0 ? 2 : 1;
  const sx0 = player.x - reach, sx1 = player.x + reach, sy0 = player.y - player.h - reach, sy1 = player.y - 30;
  for (const b of blds.slice()) {
    b.y += (fallSpeed() + b.kv) * dt;
    b.kv = Math.min(0, b.kv + PARRY_DECAY * dt);
    b.shake = Math.max(0, b.shake - dt);
    // 튕겨내기 판정: 머리 위 영역에 들어온 건물을 위로 날린다
    if (parryT > 0 && b.parryId !== parryId && b.x + b.w / 2 > player.x - 110 && b.x - b.w / 2 < player.x + 110 &&
        b.y + b.h > player.y - player.h - 90 && b.y < player.y) {
      // 붙어 있는 건물 묶음 전체를 한꺼번에 위로 날린다
      const shift = Math.max(0, Math.max(...blds.map(o => o.y + o.h)) - (player.y - player.h - 24));
      for (const o of blds) { o.parryId = parryId; o.kv = -PARRY_KV; o.shake = 0.25; o.y -= shift; }
      score += 30; floatText(b.x, b.y + b.h + 6, '튕겨내기! +30', '#9fd8ff');
      burst(player.x, player.y - player.h - 10, '#bfe8ff', 10, 260); sfx.hit(); shake(0.2);
    }
    if (b.y + b.h >= GY) {
      destroy(b, false); burst(b.x, GY, '#3a3a3a', 14, 200);
      floatText(b.x, GY - 20, '땅에 쿵!', '#ff7a6a');
      hurt(); if (state === 'over') return;
      continue;
    }
    // 칼에 맞음
    if (swingT > 0 && b.lastSwing !== swingId && b.x + b.w / 2 > sx0 && b.x - b.w / 2 < sx1 && b.y + b.h > sy0 && b.y < sy1) {
      hitBuilding(b, dmg);
      if (b.hp <= 0) continue;
    }
    // 플레이어와 겹침: 점프 중이면 아래로 밀려나고, 땅에 눌리면 피해
    const bot = b.y + b.h;
    const overX = Math.abs(player.x - b.x) < (player.w + b.w) / 2 - 4;
    if (overX && player.y - player.h < bot && player.y > b.y) {
      const pushY = bot + player.h;
      if (pushY < GY) { player.y = pushY; player.vy = Math.max(player.vy, 80); }
      else if (player.inv <= 0) {
        destroy(b, false); hurt(); floatText(player.x, player.y - 80, '앗!', '#ff7a6a');
        if (state === 'over') return;
      }
    }
  }

  // 콤보
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

  // 아이템
  for (const it of items.slice()) {
    it.vy += 1400 * dt; it.x += it.vx * dt; it.y += it.vy * dt;
    if (it.x < 10 || it.x > W - 10) it.vx *= -1;
    if (it.y >= GY - 10) { it.y = GY - 10; it.vy *= -0.35; it.vx *= 0.8; }
    it.life -= dt;
    if (it.life <= 0) { items.splice(items.indexOf(it), 1); continue; }
    if (Math.abs(it.x - player.x) < 28 && it.y > player.y - player.h - 8 && it.y < player.y + 10) {
      items.splice(items.indexOf(it), 1); sfx.get();
      if (it.kind === 'heart') { lives = Math.min(5, lives + 1); floatText(it.x, it.y - 10, '♥ +1', '#ff6a8a'); }
      else {
        score += 50; tang++; floatText(it.x, it.y - 10, '🍊 +50', '#ffb347');
        if (tang >= 5) { tang = 0; power = 8; sfx.power(); floatText(player.x, player.y - 90, '한라봉 파워!', '#ffd34a'); }
      }
    }
  }

  for (const p of parts) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; if (p.y > GY) { p.y = GY; p.vy *= -0.3; p.vx *= 0.7; } }
  parts = parts.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 40 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
  shakeT = Math.max(0, shakeT - dt); flash = Math.max(0, flash - dt);
}

// ---------- 그리기: 배경 ----------
function drawBackground() {
  const si = (level - 1) % SKIES.length;
  const g = ctx.createLinearGradient(0, 0, 0, 440);
  g.addColorStop(0, SKIES[si][0]); g.addColorStop(1, SKIES[si][1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
  // 해
  const night = si >= 6;
  ctx.fillStyle = night ? '#f4f1d0' : '#fff6b8';
  ctx.beginPath(); ctx.arc(640, night ? 90 : 120, 38, 0, 7); ctx.fill();
  if (night) { ctx.fillStyle = '#ffffffaa'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % 260, 2, 2); }
  // 구름
  ctx.fillStyle = night ? '#ffffff30' : '#ffffffcc';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 260 + time * (6 + i * 3)) % (W + 200)) - 100, cy = 60 + i * 38;
    ctx.beginPath(); ctx.ellipse(cx, cy, 52, 16, 0, 0, 7); ctx.ellipse(cx + 26, cy - 10, 30, 14, 0, 0, 7); ctx.ellipse(cx - 28, cy - 4, 26, 11, 0, 0, 7); ctx.fill();
  }
  // 한라산
  ctx.fillStyle = night ? '#2c3f5c' : '#6f9a86';
  ctx.beginPath(); ctx.moveTo(-20, 430); ctx.quadraticCurveTo(160, 420, 260, 300); ctx.lineTo(330, 258);
  ctx.lineTo(470, 258); ctx.lineTo(540, 300); ctx.quadraticCurveTo(660, 420, 820, 430); ctx.closePath(); ctx.fill();
  ctx.fillStyle = night ? '#3a5273' : '#85b09b';
  ctx.beginPath(); ctx.moveTo(330, 258); ctx.lineTo(470, 258); ctx.lineTo(500, 280); ctx.lineTo(300, 280); ctx.closePath(); ctx.fill();
  // 바다
  ctx.fillStyle = night ? '#1f3d73' : '#2f93c9'; ctx.fillRect(0, 430, W, GY - 430);
  ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) { const y = 448 + r * 22 + Math.sin(x * 0.04 + time * 1.6 + r) * 3; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // 돌담 + 땅
  ctx.fillStyle = '#2a2b2e'; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = '#4aa35a'; ctx.fillRect(0, GY - 4, W, 8);
  ctx.fillStyle = '#3a3b3f';
  for (let r = 0; r < 3; r++) for (let x = -20 + (r % 2) * 30; x < W; x += 60) { ctx.beginPath(); ctx.ellipse(x + 30, GY + 22 + r * 20, 28, 9, 0, 0, 7); ctx.fill(); }
  // 유채꽃
  ctx.fillStyle = '#ffd92e';
  for (let i = 0; i < 46; i++) { const x = (i * 37 + 11) % W, s = Math.sin(time * 2 + i) * 1; ctx.beginPath(); ctx.arc(x + s, GY - 8 - (i % 3) * 2, 3, 0, 7); ctx.fill(); }
  palm(34, GY - 4, 1); palm(W - 40, GY - 4, 0.9);
}
function palm(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -60, 0, -110); ctx.stroke();
  ctx.strokeStyle = '#2f8f4a'; ctx.lineWidth = 6;
  for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.moveTo(0, -110); ctx.quadraticCurveTo(a * 26, -140 + Math.abs(a) * 8, a * 40, -104 + Math.abs(a) * 14 + Math.sin(time * 2 + a) * 3); ctx.stroke(); }
  ctx.restore();
}

// ---------- 그리기: 건물 ----------
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function drawBuilding(b) {
  const w = b.w, h = b.h;
  ctx.save();
  ctx.translate(b.x + (b.shake > 0 ? rnd(-3, 3) : 0), b.y);
  ctx.lineWidth = 2; ctx.strokeStyle = '#00000055';
  switch (b.type) {
    case 'thatch': {
      const wh = h * 0.5;
      ctx.fillStyle = '#8a8f94'; ctx.fillRect(-w / 2 + 10, h - wh, w - 20, wh); ctx.strokeRect(-w / 2 + 10, h - wh, w - 20, wh);
      ctx.fillStyle = '#6e7378'; for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 14 + i * 18, h - wh + 6 + (i % 2) * 14, 12, 8);
      ctx.fillStyle = '#d9b45a'; ctx.beginPath(); ctx.moveTo(-w / 2, h - wh + 8); ctx.lineTo(-w / 2 + 20, 0); ctx.lineTo(w / 2 - 20, 0); ctx.lineTo(w / 2, h - wh + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a8842f'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 14, 2); ctx.lineTo(i * 18, h - wh + 6); ctx.stroke(); }
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(-12, h - 30, 24, 30);
      break;
    }
    case 'storage': {
      ctx.fillStyle = '#f2a33a'; ctx.fillRect(-w / 2, 20, w, h - 20); ctx.strokeRect(-w / 2, 20, w, h - 20);
      ctx.fillStyle = '#4a7fb5'; ctx.fillRect(-w / 2 - 6, 6, w + 12, 18); ctx.strokeRect(-w / 2 - 6, 6, w + 12, 18);
      ctx.strokeStyle = '#ffffff66'; for (let x = -w / 2; x < w / 2; x += 12) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 22); ctx.stroke(); }
      ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.arc(0, 52, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#3aa04a'; ctx.beginPath(); ctx.ellipse(6, 32, 9, 5, -0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#c07a1a'; ctx.fillRect(-w / 2 + 6, h - 22, 28, 22); ctx.fillRect(w / 2 - 34, h - 22, 28, 22);
      break;
    }
    case 'light': {
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.moveTo(-18, 30); ctx.lineTo(18, 30); ctx.lineTo(w / 2, h); ctx.lineTo(-w / 2, h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9473f'; ctx.beginPath(); ctx.moveTo(-24, 70); ctx.lineTo(24, 70); ctx.lineTo(28, 100); ctx.lineTo(-28, 100); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe58a'; ctx.fillRect(-14, 12, 28, 18); ctx.strokeRect(-14, 12, 28, 18);
      ctx.fillStyle = '#2b2b2e'; ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(0, 0); ctx.lineTo(20, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(-8, h - 28, 16, 28);
      break;
    }
    case 'cafe': {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-w / 2 - 4, 12, w + 8, 12); ctx.strokeRect(-w / 2 - 4, 12, w + 8, 12);
      ctx.fillStyle = '#7fd6d0'; ctx.fillRect(-w / 2, 24, w, h - 24); ctx.strokeRect(-w / 2, 24, w, h - 24);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#e8554a'; ctx.fillRect(-w / 2 + i * (w / 8), 24, w / 8, 20); }
      ctx.fillStyle = '#cfefff'; ctx.fillRect(-w / 2 + 14, 52, w - 28, h - 70); ctx.strokeRect(-w / 2 + 14, 52, w - 28, h - 70);
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.arc(0, 0, 0, 0, 7);
      ctx.fillStyle = '#2b5d8a'; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('CAFE ☕', 0, 10);
      break;
    }
    case 'hotel': {
      ctx.fillStyle = '#2b5d8a'; ctx.fillRect(-w / 2 + 30, 0, w - 60, 22); ctx.strokeRect(-w / 2 + 30, 0, w - 60, 22);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('JEJU RESORT', 0, 16);
      ctx.fillStyle = '#e8d8b8'; ctx.fillRect(-w / 2, 22, w, h - 22); ctx.strokeRect(-w / 2, 22, w, h - 22);
      const rnd2 = seeded(b.seed);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        ctx.fillStyle = rnd2() < 0.5 + b.lit * 0.3 ? '#ffe58a' : '#8fc7e8';
        ctx.fillRect(-w / 2 + 14 + c * 33, 32 + r * 27, 22, 17);
      }
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(-12, h - 22, 24, 22);
      break;
    }
  }
  // 균열
  const frac = 1 - b.hp / b.maxhp;
  const n = Math.floor(frac * 6);
  if (n > 0) {
    const r = seeded(b.seed + 7);
    ctx.strokeStyle = '#1b1b1d'; ctx.lineWidth = 2.5;
    for (let i = 0; i < n; i++) {
      let x = (r() - 0.5) * w * 0.8, y = h * 0.3 + r() * h * 0.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 24; y += 8 + r() * 12; ctx.lineTo(x, Math.min(h - 2, y)); }
      ctx.stroke();
    }
  }
  // HP 막대
  ctx.fillStyle = '#00000088'; ctx.fillRect(-w / 2, h + 4, w, 6);
  ctx.fillStyle = b.hp / b.maxhp > 0.5 ? '#6bdc6b' : b.hp / b.maxhp > 0.25 ? '#ffd34a' : '#ff5a4a';
  ctx.fillRect(-w / 2, h + 4, w * Math.max(0, b.hp / b.maxhp), 6);
  ctx.restore();
}

// ---------- 그리기: 플레이어(돌하르방) ----------
function drawPlayer() {
  const p = player;
  if (p.inv > 0 && Math.floor(p.inv * 14) % 2) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // 그림자
  ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.ellipse(0, 0, 20 - Math.min(10, (GY - p.y) / 14), 5, 0, 0, 7); ctx.fill();
  ctx.scale(1 - p.sq * 0.5, 1 + p.sq);
  if (power > 0) { ctx.fillStyle = '#ffd34a55'; ctx.beginPath(); ctx.arc(0, -36, 42 + Math.sin(time * 12) * 3, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#55555a'; ctx.lineWidth = 2;
  ctx.fillStyle = '#9a9a96'; ctx.beginPath(); ctx.roundRect(-16, -34, 32, 34, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a9a9a4'; ctx.beginPath(); ctx.ellipse(0, -44, 17, 17, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8c8c88'; ctx.beginPath(); ctx.ellipse(0, -56, 21, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-12, -70, 24, 15, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(-7, -46, 2.3, 4, 0, 0, 7); ctx.ellipse(7, -46, 2.3, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7c7c78'; ctx.beginPath(); ctx.ellipse(0, -40, 4.5, 5.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.arc(0, -35, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = '#b3b3ae'; ctx.beginPath(); ctx.ellipse(-8, -18, 7, 5, 0.4, 0, 7); ctx.ellipse(8, -22, 7, 5, -0.4, 0, 7); ctx.fill();
  ctx.restore();
  drawSword();
}
function drawSword() {
  const p = player, px = p.x, py = p.y - 40;
  const reach = power > 0 ? 130 : 100;
  ctx.save();
  ctx.lineCap = 'round';
  if (swingT > 0) {
    // 머리 위로 크게 가르는 베기: 왼쪽 → 위 → 오른쪽
    const prog = 1 - swingT / SWING_TIME, th = -Math.PI + prog * Math.PI;
    ctx.strokeStyle = power > 0 ? '#ffe14acc' : '#ffffffaa'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(px, py, reach - 14, -Math.PI, th); ctx.stroke();
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(px, py, reach - 24, Math.max(-Math.PI, th - 0.9), th); ctx.stroke();
    drawBlade(px, py, th, reach - 6);
  } else {
    drawBlade(px, py, p.onG ? -0.9 : -1.2, 46);
  }
  ctx.restore();
}
function drawBlade(x, y, th, len) {
  const c = Math.cos(th), s = Math.sin(th);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x + c * 14, y + s * 14); ctx.lineTo(x + c * len, y + s * len); ctx.stroke();
  ctx.strokeStyle = power > 0 ? '#ffe98a' : '#e8f0f8'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x + c * 14, y + s * 14); ctx.lineTo(x + c * len, y + s * len); ctx.stroke();
  ctx.strokeStyle = '#c9902a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x - s * 9 + c * 12, y + c * 9 + s * 12); ctx.lineTo(x + s * 9 + c * 12, y - c * 9 + s * 12); ctx.stroke();
}

// ---------- 그리기: 기타 ----------
function drawItems() {
  for (const it of items) {
    if (it.life < 2 && Math.floor(it.life * 8) % 2) continue;
    if (it.kind === 'tang') {
      ctx.fillStyle = '#ff8a00'; ctx.beginPath(); ctx.arc(it.x, it.y, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#3aa04a'; ctx.beginPath(); ctx.ellipse(it.x + 3, it.y - 9, 5, 3, -0.5, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#ff5a7a'; ctx.font = '22px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('♥', it.x, it.y + 8);
    }
  }
}
function drawHUD() {
  ctx.textAlign = 'left'; ctx.font = 'bold 22px ' + FONT;
  for (let i = 0; i < Math.max(3, lives); i++) { ctx.fillStyle = i < lives ? '#ff5a7a' : '#ffffff44'; ctx.fillText('♥', 14 + i * 26, 34); }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#00000088'; ctx.lineWidth = 4;
  const t = '점수 ' + score; ctx.strokeText(t, 14, 66); ctx.fillText(t, 14, 66);
  ctx.textAlign = 'right';
  const t2 = 'BEST ' + Math.max(best, score); ctx.strokeText(t2, W - 14, 34); ctx.fillText(t2, W - 14, 34);
  ctx.font = 'bold 16px ' + FONT;
  const t3 = 'STAGE ' + level + ' · ' + STAGES[(level - 1) % STAGES.length]; ctx.strokeText(t3, W - 14, 58); ctx.fillText(t3, W - 14, 58);
  // 귤 게이지
  ctx.textAlign = 'left'; ctx.font = '16px ' + FONT;
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < tang ? '#ff8a00' : '#ffffff44'; ctx.beginPath(); ctx.arc(24 + i * 24, 90, 8, 0, 7); ctx.fill(); }
  if (power > 0) { ctx.fillStyle = '#ffd34a'; ctx.font = 'bold 16px ' + FONT; ctx.fillText('한라봉 파워 ' + power.toFixed(1) + 's', 148, 96); }
  // 튕겨내기 쿨타임
  const ready = parryCd <= 0;
  ctx.fillStyle = '#00000066'; ctx.fillRect(14, 106, 120, 10);
  ctx.fillStyle = ready ? '#6ec8ff' : '#7a8a99'; ctx.fillRect(14, 106, 120 * (1 - parryCd / PARRY_CD), 10);
  ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1; ctx.strokeRect(14, 106, 120, 10);
  ctx.fillStyle = '#fff'; ctx.font = '13px ' + FONT; ctx.textAlign = 'left';
  ctx.fillText(ready ? '↓ 튕겨내기 준비' : '↓ 재충전…', 142, 116);
  if (combo >= 2) {
    ctx.textAlign = 'center'; ctx.font = 'bold ' + (30 + Math.min(combo, 10) * 2) + 'px ' + FONT;
    ctx.fillStyle = '#ffe14a'; ctx.strokeText(combo + ' COMBO!', W / 2, 120); ctx.fillText(combo + ' COMBO!', W / 2, 120);
  }
}
function drawFx() {
  for (const p of parts) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = 'bold 18px ' + FONT; ctx.lineWidth = 3; ctx.strokeStyle = '#00000099';
  for (const f of floats) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;
}
function overlay(title, lines) {
  ctx.fillStyle = '#000000aa'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34a'; ctx.font = 'bold 56px ' + FONT; ctx.fillText(title, W / 2, 190);
  ctx.fillStyle = '#fff'; ctx.font = '22px ' + FONT;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 262 + i * 36));
}

function render() {
  ctx.save();
  if (shakeT > 0) ctx.translate(rnd(-1, 1) * shakeT * 22, rnd(-1, 1) * shakeT * 22);
  drawBackground();
  blds.forEach(drawBuilding);
  if (parryT > 0) {
    // 머리 위로 퍼지는 튕겨내기 충격파
    const k = 1 - parryT / PARRY_TIME, cx = player.x, cy = player.y - 50;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(150,215,255,' + (1 - k) + ')'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, 50 + k * 70, -Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, 36 + k * 60, -Math.PI, 0); ctx.stroke();
    ctx.restore();
  }
  drawItems(); drawPlayer(); drawFx();
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + flash + ')'; ctx.fillRect(0, 0, W, H); }
  if (state !== 'title') drawHUD();
  if (state === 'title') {
    overlay('제주 건물 부수기', [
      '중앙으로 쏟아지는 건물 묶음을 칼로 베어 부수세요!',
      '← → : 이동     ↑ : 점프     점프 중 Space : 칼 휘두르기',
      '↓ : 튕겨내기 — 머리 위 건물을 위로 날려 보내요 (쿨타임 있음)',
      '건물이 땅에 닿거나 머리 위로 눌러 오면 하트가 깎여요',
      '귤 5개를 모으면 한라봉 파워 (칼 피해 2배, 범위 증가)',
      '',
      Math.floor(time * 2) % 2 ? '' : 'Space 또는 화면을 눌러 시작',
    ]);
  } else if (state === 'over') {
    overlay('GAME OVER', ['점수 ' + score + (score >= best && score > 0 ? '  (신기록!)' : ''), 'BEST ' + best, 'STAGE ' + level + ' · ' + STAGES[(level - 1) % STAGES.length], '', overT > 0.8 ? 'Space 또는 화면을 눌러 다시 시작' : '']);
  }
}

// ---------- 루프 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (state === 'play') update(dt);
  else { time += dt; overT += dt; if (state === 'over') { parts.forEach(p => { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.y > GY) p.y = GY; }); parts = parts.filter(p => p.life > 0); shakeT = Math.max(0, shakeT - dt); flash = Math.max(0, flash - dt); } }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
