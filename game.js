// =================== Pop The Balls — game.js ===================

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

// ------- Game state -------
let rafId = null;
let running = false;

let score = 0;
let lives = 3;
let level = 1;
let bonusPct = 0;

const BALL_IMG = new Image();
BALL_IMG.src = 'assets/meatball.png';

let balls = [];
const MAX_LEVEL = 10;

// Physics config per level (gentler speeds)
function levelConfig(lvl) {
  return {
    count: Math.min(3 + Math.floor((lvl - 1) * 1.2), 12),
    minSpeed: 40 + (lvl - 1) * 6,   // px/s (slower start)
    maxSpeed: 90 + (lvl - 1) * 8,   // px/s
    radius: 36                       // visual size; canvas scaled
  };
}

// ------- Utility: fit canvas to viewport (no scroll) -------
function sizeCanvas() {
  // Available width/height inside viewport
  const vw = window.innerWidth;
  // Subtract the heights of topbar, hud, and controls (+ margins)
  const usedH = (topbar?.offsetHeight || 0) +
                (hud?.offsetHeight || 0) +
                (controls?.offsetHeight || 0) + 34;
  const vhAvail = Math.max(200, window.innerHeight - usedH);

  // Keep 16:9 and some max width to look nice
  const maxW = Math.min(1100, vw - 24);
  let w = maxW;
  let h = Math.floor(w * 9 / 16);

  if (h > vhAvail) {
    h = vhAvail;
    w = Math.floor(h * 16 / 9);
  }

  // CSS size (display size)
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';

  // Canvas internal resolution
  canvas.width = w;
  canvas.height = h;
}

// ------- Ball creation -------
function rand(min, max) { return Math.random() * (max - min) + min; }

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
    balls.push({ x, y, r, vx, vy, alive: true });
  }
}

// ------- Game loop -------
let lastTime = 0;

function update(dt) {
  // dt in seconds
  balls.forEach(b => {
    if (!b.alive) return;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Bounce walls
    if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
    if (b.x > canvas.width - b.r) { b.x = canvas.width - b.r; b.vx *= -1; }
    if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
    if (b.y > canvas.height - b.r) { b.y = canvas.height - b.r; b.vy *= -1; }
  });
}

function draw() {
  // Clear (the semi-transparent watermark is an <img> over the canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw balls (meatball image)
  balls.forEach(b => {
    if (!b.alive) return;
    const d = b.r * 2;
    if (BALL_IMG.complete) {
      ctx.drawImage(BALL_IMG, b.x - b.r, b.y - b.r, d, d);
    } else {
      // fallback circle
      ctx.fillStyle = '#c24a00';
      ctx.strokeStyle = '#ffcc88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
    }
  });
}

function loop(ts) {
  if (!running) return;
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;
  update(dt);
  draw();
  rafId = requestAnimationFrame(loop);
}

// ------- Input (click to pop) -------
canvas.addEventListener('pointerdown', (e) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  let hit = false;
  for (const b of balls) {
    if (!b.alive) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx*dx + dy*dy <= b.r*b.r) {
      b.alive = false;
      hit = true;
      score += 1;
    }
  }
  if (hit) {
    scoreEl.textContent = score;
    // if all popped -> next level
    if (balls.every(b => !b.alive)) {
      if (level < MAX_LEVEL) {
        level += 1;
        levelEl.textContent = level;
        spawnBalls();
      } else {
        running = false;
        cancelAnimationFrame(rafId);
        alert(`Congratulations! You win!\nPromo Code: BallGameWinner\nBonus: ${bonusPct}%`);
      }
    }
  }
});

// ------- Start/Reset -------
function startGame() {
  running = true;
  lastTime = performance.now();
  spawnBalls();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function resetGame() {
  running = false;
  cancelAnimationFrame(rafId);
  score = 0; lives = 3; level = 1; bonusPct = 0;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  bonusEl.textContent = `${bonusPct}%`;
  spawnBalls();
  draw();
}

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);

// ------- Init -------
window.addEventListener('resize', () => {
  sizeCanvas();
  // keep balls on screen when resizing
  balls.forEach(b => {
    b.x = Math.max(b.r, Math.min(canvas.width  - b.r, b.x));
    b.y = Math.max(b.r, Math.min(canvas.height - b.r, b.y));
  });
  draw();
});

function init() {
  sizeCanvas();
  resetGame();
}
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
