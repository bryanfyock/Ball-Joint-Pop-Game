// ================== Meatball Pop — game.js (final) ==================

// ---------- Canvas + sizing ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function sizeCanvas() {
  const container = document.getElementById("game-container");
  const maxW = Math.min(980, container.clientWidth - 24);
  const hFromW = Math.floor(maxW * 9 / 16);
  const maxH = Math.floor(window.innerHeight * 0.65);
  const h = Math.max(300, Math.min(hFromW, maxH));
  const w = Math.floor(h * 16 / 9);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", sizeCanvas)
  : sizeCanvas();
window.addEventListener("resize", sizeCanvas, { passive: true });

// ---------- HUD helpers ----------
const $ = (id) => document.getElementById(id);

function setHUD(score, time) {
  if ($("score")) $("score").textContent = score;
  if ($("timer")) $("timer").textContent = time;
}

// ---------- Image asset (your meatball art) ----------
const meatballImg = new Image();
let imgReady = false;

// Correct path for your repo/site:
meatballImg.onload = () => { imgReady = true; setImgBadge("IMG: OK"); };
meatballImg.onerror = () => { imgReady = false; setImgBadge("IMG: FAIL"); };
meatballImg.src = "assets/meatball.png";

// Tiny debug badge (optional, safe if not in DOM)
function setImgBadge(text) {
  let b = $("imgBadge");
  if (!b) return;
  b.textContent = text;
}

// ---------- Game state ----------
let balls = [];
let pops = []; // cheese flashes
let running = false;
let paused = false;
let raf = 0;
let timerId = 0;

let level = 1;
let targetsRemaining = 0;
let timeLeft = 20;

let soundOn = true;
const popSound = new Audio(
  "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
);

// ---------- Level tuning ----------
const rand = (a, b) => Math.random() * (b - a) + a;

function levelConfig(n) {
  return {
    time: 20,                             // seconds
    count: 6 + (n - 1) * 2,               // L1=6 → L10=24
    size: { min: 36, max: Math.max(36, 56 - (n - 1) * 2) },
    speed: 60 + (n - 1) * 8               // px/sec upward
  };
}

// ---------- Spawning ----------
function spawnBall(cfg) {
  const r = rand(cfg.size.min, cfg.size.max);
  const x = rand(r, canvas.width - r);
  // Spawn within visible play area (lower 75%)
  const y = rand(canvas.height * 0.25, canvas.height - r);
  const vx = rand(-20, 20);
  const vy = cfg.speed + rand(-10, 20);
  balls.push({ x, y, r, vx, vy, rot: rand(0, Math.PI * 2), spin: rand(-0.8, 0.8) });
}

// ---------- Game flow ----------
function startLevel(n = 1) {
  level = n;
  const cfg = levelConfig(level);

  timeLeft = cfg.time;
  balls.length = 0;
  pops.length = 0;

  for (let i = 0; i < cfg.count; i++) spawnBall(cfg);
  targetsRemaining = balls.length;
  setHUD(targetsRemaining, timeLeft);

  // cancel old loops/timers
  if (raf) cancelAnimationFrame(raf);
  if (timerId) clearInterval(timerId);
  running = true;
  paused = false;

  // timer
  timerId = setInterval(() => {
    if (!running || paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    setHUD(targetsRemaining, timeLeft);
    if (timeLeft === 0) endLevel(false);
  }, 1000);

  raf = requestAnimationFrame(loop);
}

function endLevel(won) {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  if (timerId) clearInterval(timerId);

  if (won) {
    if (level >= 10) {
      alert("🎉 Congratulations! You win!\nPromo Code: BallGameWinner");
      startLevel(1);
    } else {
      alert(`Level ${level} complete! Starting Level ${level + 1}`);
      startLevel(level + 1);
    }
  } else {
    alert(`Level ${level} — Try again`);
    startLevel(level);
  }
}

// Expose a simple global for your Start button in index.html
window.startGame = function () {
  startLevel(1);
};

// ---------- Input ----------
canvas.addEventListener("click", (e) => {
  if (!running || paused) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (Math.hypot(b.x - x, b.y - y) <= b.r) {
      balls.splice(i, 1);
      targetsRemaining = Math.max(0, targetsRemaining - 1);
      pops.push({ x, y, age: 0, life: 220 }); // cheese flash
      if (soundOn) { try { popSound.currentTime = 0; popSound.play(); } catch { } }
      setHUD(targetsRemaining, timeLeft);
      if (targetsRemaining === 0) endLevel(true);
      break;
    }
  }
});

// Optional buttons if you add them later by id
const startBtn = $("startBtn");
if (startBtn) startBtn.addEventListener("click", () => startLevel(1));

const pauseBtn = $("pauseBtn");
if (pauseBtn) pauseBtn.addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (!paused) raf = requestAnimationFrame(loop);
});

const soundBtn = $("soundBtn");
if (soundBtn) soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
});

// ---------- Main loop ----------
let last = 0;

function loop(ts) {
  if (!running || paused) return;
  if (!last) last = ts;
  const dt = Math.min(1 / 30, (ts - last) / 1000);
  last = ts;

  // update
  for (const b of balls) {
    b.x += b.vx * dt;
    b.y -= b.vy * dt;
    b.rot += b.spin * dt;
    if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
    if (b.x > canvas.width - b.r) { b.x = canvas.width - b.r; b.vx *= -1; }
  }
  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i].y + balls[i].r < -10) balls.splice(i, 1); // missed and floated off top
  }
  if (balls.length === 0 && targetsRemaining > 0) {
    endLevel(false);
    return;
  }

  // draw bg
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createLinearGradient(0, canvas.height, 0, 0);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e293b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw balls (meatball art if loaded)
  for (const b of balls) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.clip();

    if (imgReady) {
      const d = b.r * 2;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.translate(-b.x, -b.y);
      const ratio = Math.max(d / meatballImg.width, d / meatballImg.height);
      const iw = meatballImg.width * ratio;
      const ih = meatballImg.height * ratio;
      ctx.drawImage(meatballImg, b.x - iw / 2, b.y - ih / 2, iw, ih);
    } else {
      // fallback circle (only shows if PNG failed)
      ctx.fillStyle = "#9d4b00";
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    ctx.restore();
    // subtle rim
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // cheese flashes
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.age += dt * 1000;
    const t = Math.min(1, p.age / p.life);
    const alpha = 1 - t;
    const r = 10 + 40 * t;
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grd.addColorStop(0, `rgba(255,250,230,${0.9 * alpha})`);
    grd.addColorStop(1, `rgba(255,220,120,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (p.age >= p.life) pops.splice(i, 1);
  }

  raf = requestAnimationFrame(loop);
}
// =====================================================================


