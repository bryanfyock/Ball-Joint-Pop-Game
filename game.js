// =================== Pop The Balls — game.js (burritos + easier) ===================

// ------- Element refs -------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const topbar = document.getElementById('topbar');
const hud    = document.querySelector('.hud');
const wrap   = document.getElementById('game-wrap');
const controls = document.getElementById('controls');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const bonusEl = document.getElementById('bonus');

const startBtn = document.getElementById('startButton');
const resetBtn = document.getElementById('resetButton');

// ------- Assets -------
const BALL_IMG = new Image();
BALL_IMG.src = 'assets/meatball.png';

const BURRITO_IMG = new Image();
BURRITO_IMG.src = 'assets/burrito.png'; // <-- add a burrito image to /assets/ (e.g. 128x64)

// ------- Game state -------
let rafId = null;
let running = false;

let score = 0;
let lives = 3;
let level = 1;

let balls = [];
const MAX_LEVEL = 10;

// Burritos
let burritosHit = 0;       // 0..3 → adds $ to final reward
let burrito = null;        // {x, y, w, h, vx, alive}

// Physics config per level (easier: +1 ball per level, gentler speeds)
function levelConfig(lvl) {
  return {
    count: 2 + lvl,               // L1=3, L10=12
    minSpeed: 40 + (lvl - 1) * 5, // px/s
    maxSpeed: 80 + (lvl - 1) * 7, // px/s
    radius: 36
  };
}

// ------- Utility: fit canvas to viewport (no scroll) -------
function sizeCanvas() {
  const vw = window.innerWidth;
  const usedH = (topbar?.offsetHeight || 0) +
                (hud?.offsetHeight || 0) +
                (controls?.offsetHeight || 0) + 34;
  const vhAvail = Math.max(200, window.innerHeight - usedH);

  const maxW = Math.min(1100, vw - 24);
  let w = maxW;
  let h = Math.floor(w * 9 / 16);

  if (h > vhAvail) {
    h = vhAvail;
    w = Math.floor(h * 16 / 9);
  }

  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  canvas.width = w;
  canvas.height = h;
}

// ------- Helpers -------
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ------- Balls -------
function spawnBalls() {
  const cfg = levelConfig(level);
  balls = [];
  for (let i = 0; i < cfg.count; i++) {
    const r = cfg.radius;
    const x = rand(r, canvas.width - r);
    const y = rand(r, canvas.height - r);
    const speed = rand(cfg.minSpeed, cfg.maxSpeed);
    const angle = rand(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    balls.push({ x, y, r, vx, vy, alive: true, wallHits: 0 });
  }
}

function aliveCount() {
  let n = 0;
  for (const b of balls) if (b.alive) n++;
  return n;
}

// ------- Burritos -------
const BURRITO_LEVELS = new Set([2, 5, 8]); // when a burrito should appear

function maybeSpawnBurrito() {
  if (!BURRITO_LEVELS.has(level)) {
    burrito = null;
    return;
  }
  // Create one burrito that flies across the screen once per these levels
  const h = Math.max(32, Math.floor(canvas.height * 0.10)); // ~10% of board height
  const aspect = 2; // wide burrito (w ~ 2h)
  const w = Math.floor(h * aspect);

  const y = clamp(Math.floor(canvas.height * rand(0.25, 0.7)), h, canvas.height - h);
  const fromLeft = Math.random() < 0.5;

  burrito = {
    x: fromLeft ? -w - 10 : canvas.width + 10,
    y,
    w, h,
    vx: fromLeft ? (120 + level * 10) : -(120 + level * 10),
    alive: true
  };
}

function updateBurrito(dt) {
  if (!burrito || !burrito.alive) return;
  burrito.x += burrito.vx * dt;

  // off screen → remove
  if (burrito.x < -burrito.w - 20 || burrito.x > canvas.width + 20) {
    burrito.alive = false;
  }
}

function drawBurrito() {
  if (!burrito || !burrito.alive) return;
  if (BURRITO_IMG.complete && BURRITO_IMG.naturalWidth > 0) {
    ctx.drawImage(BURRITO_IMG, burrito.x, burrito.y, burrito.w, burrito.h);
  } else {
    // placeholder rectangle if image not loaded yet
    ctx.fillStyle = '#8b5';
    ctx.fillRect(burrito.x, burrito.y, burrito.w, burrito.h);
  }
}

function hitBurrito(px, py) {
  if (!burrito || !burrito.alive) return false;
  if (px >= burrito.x && px <= burrito.x + burrito.w &&
      py >= burrito.y && py <= burrito.y + burrito.h) {
    burrito.alive = false;
    burritosHit = Math.min(3, burritosHit + 1);
    bonusEl.textContent = `$${burritosHit}`;
    return true;
  }
  return false;
}

// ------- Game loop -------
let lastTime = 0;

function update(dt) {
  // Balls
  for (const b of balls) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Bounce walls + count bounces
    if (b.x < b.r) { b.x = b.r; b.vx *= -1; b.wallHits++; }
    if (b.x > canvas.width - b.r) { b.x = canvas.width - b.r; b.vx *= -1; b.wallHits++; }
    if (b.y < b.r) { b.y = b.r; b.vy *= -1; b.wallHits++; }
    if (b.y > canvas.height - b.r) { b.y = canvas.height - b.r; b.vy *= -1; b.wallHits++; }

    // After 3 wall bounces, despawn (counts as a "miss")
    if (b.wallHits >= 3) {
      b.alive = false;
    }
  }

  // Burrito
  updateBurrito(dt);

  // Progress rule: player may miss one ball per level
  if (aliveCount() <= 1) {
    nextLevel();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Balls
  for (const b of balls) {
    if (!b.alive) continue;
    const d = b.r * 2;
    if (BALL_IMG.complete && BALL_IMG.naturalWidth > 0) {
      ctx.drawImage(BALL_IMG, b.x - b.r, b.y - b.r, d, d);
    } else {
      ctx.fillStyle = '#c24a00';
      ctx.strokeStyle = '#ffcc88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Burrito on top
  drawBurrito();
}

function loop(ts) {
  if (!running) return;
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;
  update(dt);
  draw();
  rafId = requestAnimationFrame(loop);
}

// ------- Input (click to pop balls / burrito) -------
canvas.addEventListener('pointerdown', (e) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Burrito hit?
  if (hitBurrito(x, y)) return;

  // Balls
  let hitSomething = false;
  for (const b of balls) {
    if (!b.alive) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx*dx + dy*dy <= b.r*b.r) {
      b.alive = false;
      hitSomething = true;
      score += 1;
    }
  }
  if (hitSomething) {
    scoreEl.textContent = score;
    if (aliveCount() <= 1) nextLevel();
  }
});

// ------- Level flow -------
function nextLevel() {
  if (level < MAX_LEVEL) {
    level += 1;
    levelEl.textContent = level;
    spawnBalls();
    maybeSpawnBurrito();
  } else {
    endGame();
  }
}

function startGame() {
  running = true;
  lastTime = performance.now();
  spawnBalls();
  maybeSpawnBurrito();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function resetGame() {
  running = false;
  cancelAnimationFrame(rafId);
  score = 0; lives = 3; level = 1;
  burritosHit = 0;
  burrito = null;

  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  bonusEl.textContent = `$${burritosHit}`;

  spawnBalls();
  maybeSpawnBurrito();
  draw();
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);

  const dollarsOff = 5 + burritosHit;  // $5 base + $1 per burrito
  // Placeholder promo codes by tier — replace when you have the real ones
  const codes = {
    5: 'TBD-5OFF',
    6: 'TBD-6OFF',
    7: 'TBD-7OFF',
    8: 'TBD-8OFF'
  };
  const code = codes[dollarsOff] || 'TBD-5OFF';

  alert(
    `Congratulations! You win!\n` +
    `Promo Tier: $${dollarsOff} off\n` +
    `Promo Code: ${code}\n` +
    `Burritos hit: ${burritosHit} (+$${burritosHit})`
  );
}

// ------- Init / resize -------
window.addEventListener('resize', () => {
  sizeCanvas();
  // keep actors on screen when resizing
  for (const b of balls) {
    b.x = clamp(b.x, b.r, canvas.width  - b.r);
    b.y = clamp(b.y, b.r, canvas.height - b.r);
  }
  draw();
});

function init() {
  sizeCanvas();
  resetGame();
}
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
