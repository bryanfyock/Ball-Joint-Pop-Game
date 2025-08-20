/* ================== Grab The Balls — game.js ================== */

/* -------- DOM refs ---------- */
const wrap   = document.getElementById('game-wrap');
const header = document.querySelector('.site-header');
const hudBox = document.getElementById('hud');
const controls = document.getElementById('controls');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const bonusEl = document.getElementById('bonus');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* -------- Assets ------------ */
const meatballImg = new Image();
meatballImg.src = 'assets/meatball.png';
let meatballReady = false;
meatballImg.onload = () => { meatballReady = true; };

/* Optional: bigger hand cursors (CSS already falls back if missing) */
const CURSOR_HAND  = 'assets/cursor-hand-48.png';
const CURSOR_GRAB  = 'assets/cursor-grab-48.png';

/* -------- Game state -------- */
const ASPECT = 16/9;
const MAX_W  = 980;

let running = false;
let rafId = 0;

let level = 1;
let score = 0;
let lives = 3;

let bonusDollars = 0;      // $ bonus from burritos (0..3)
let balls = [];            // active balls
let popped = 0;            // popped this level
let missed = 0;            // missed this level (including 3-wall-hit disappear)
let burritosThisGame = 0;  // how many burritos hit overall (for end screen)

/* Level config */
const BASE_BALLS = 3;      // Level 1 starts with 3
const ALLOWED_MISS = 1;    // can miss one per level
const BALL_SPEED_BASE = 1.4;  // slower base speed
const BALL_SPEED_INC  = 0.25; // small increment per level

/* Burritos */
const MAX_BURRITOS_TOTAL = 3;   // total in whole game
const BURRITO_BONUS_EACH = 1;   // $1 per burrito
const BURRITO_PROB_PER_TICK = 0.0025; // small chance each frame while running
let burritosSeen = 0;

/* ---------------- Canvas sizing (no scrolling) ---------------- */
function sizeCanvas(){
  // Available width inside wrap (with small padding consideration)
  const wrapStyles = getComputedStyle(wrap);
  const wrapPaddingX = parseFloat(wrapStyles.paddingLeft) + parseFloat(wrapStyles.paddingRight);
  const containerWidth = Math.min(MAX_W, wrap.clientWidth - wrapPaddingX);

  // Available height in viewport after title + HUD + controls + small margins
  const used = header.offsetHeight + hudBox.offsetHeight + controls.offsetHeight + 28; // extra breathing room
  const availH = Math.max(200, window.innerHeight - used);

  // Choose canvas size that fits avail space and keeps 16:9
  const widthByHeight = Math.floor(availH * ASPECT);
  const desiredW = Math.min(containerWidth, widthByHeight);
  const desiredH = Math.floor(desiredW / ASPECT);

  canvas.width  = desiredW;
  canvas.height = desiredH;

  // Also cap the board so the watermark aligns with canvas
  const board = document.getElementById('board');
  board.style.maxWidth = desiredW + 'px';
  board.style.height   = desiredH + 'px';
}
sizeCanvas();
addEventListener('resize', () => {
  sizeCanvas();
  // When resizing, re-clamp balls inside new bounds so nothing jumps outside
  balls.forEach(b => {
    b.x = Math.min(Math.max(b.x, b.r), canvas.width - b.r);
    b.y = Math.min(Math.max(b.y, b.r), canvas.height - b.r);
  });
});

/* ---------------- Ball model ---------------- */
function makeBall(isBurrito = false){
  // radius and speed
  const r = isBurrito ? 20 : 28;
  const levelSpeed = BALL_SPEED_BASE + (level-1) * BALL_SPEED_INC;
  const speed = isBurrito ? levelSpeed * 1.2 : levelSpeed;

  // random spawn inside bounds
  const x = Math.random() * (canvas.width - 2*r) + r;
  const y = Math.random() * (canvas.height - 2*r) + r;

  // random direction
  const a = Math.random() * Math.PI * 2;
  const vx = Math.cos(a) * speed;
  const vy = Math.sin(a) * speed;

  return {
    x, y, vx, vy, r,
    wallHits: 0,
    isBurrito,
    popped: false
  };
}

/* -------------- Drawing (meatballs 100% opacity) -------------- */
function drawBall(b){
  if (b.isBurrito){
    // Simple burrito visual (stacked rectangles) — you can swap with an image if you like
    ctx.save();
    ctx.fillStyle = '#8d5a2a';
    ctx.strokeStyle = '#3d2916';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x - b.r, b.y - b.r/2, b.r*2, b.r, 10);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }

  // Meatball at 100% opacity
  ctx.save();
  ctx.globalAlpha = 1.0;

  if (meatballReady){
    const s = b.r * 2;
    ctx.drawImage(meatballImg, b.x - b.r, b.y - b.r, s, s);
  }else{
    // fallback circle (rarely seen once image cached)
    ctx.fillStyle = '#b24a00';
    ctx.strokeStyle = 'rgba(255,180,110,.8)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function clearCanvas(){
  ctx.clearRect(0,0,canvas.width, canvas.height);
}

/* ----------------- Spawning / Level flow ----------------- */
function ballsThisLevel(){ return BASE_BALLS + (level - 1); }

function spawnLevel(){
  balls = [];
  popped = 0;
  missed = 0;

  const n = ballsThisLevel();
  for (let i=0;i<n;i++){
    balls.push(makeBall(false));
  }
}

function maybeSpawnBurrito(){
  if (!running) return;
  if (burritosSeen >= MAX_BURRITOS_TOTAL) return;
  if (Math.random() < BURRITO_PROB_PER_TICK){
    balls.push(makeBall(true));
    burritosSeen++;
  }
}

/* ------------------ Input (pop/grab) ------------------ */
canvas.addEventListener('pointerdown', (e)=>{
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // check from top-most (last drawn) downwards
  for (let i = balls.length - 1; i >= 0; i--){
    const b = balls[i];
    const dx = x - b.x, dy = y - b.y;
    if (dx*dx + dy*dy <= b.r*b.r){
      // pop it
      b.popped = true;
      balls.splice(i,1);

      if (b.isBurrito){
        bonusDollars = Math.min(3, bonusDollars + BURRITO_BONUS_EACH);
        burritosThisGame++;
        updateHUD();
      }else{
        score += 1;
        popped += 1;
        updateHUD();
      }
      break;
    }
  }
});

/* ------------------ Update & Physics ------------------ */
function step(){
  if (!running) return;

  clearCanvas();

  // physics
  for (let i=balls.length-1; i>=0; i--){
    const b = balls[i];
    b.x += b.vx;
    b.y += b.vy;

    // walls
    if (b.x - b.r < 0){
      b.x = b.r;
      b.vx *= -1;
      b.wallHits++;
    }else if (b.x + b.r > canvas.width){
      b.x = canvas.width - b.r;
      b.vx *= -1;
      b.wallHits++;
    }
    if (b.y - b.r < 0){
      b.y = b.r;
      b.vy *= -1;
      b.wallHits++;
    }else if (b.y + b.r > canvas.height){
      b.y = canvas.height - b.r;
      b.vy *= -1;
      b.wallHits++;
    }

    // remove after 3 wall hits (miss)
    if (b.wallHits >= 3){
      balls.splice(i,1);
      if (!b.isBurrito){
        missed += 1;
      }
      continue;
    }
  }

  // draw
  balls.forEach(drawBall);

  // maybe spawn a burrito now and then
  maybeSpawnBurrito();

  // check level end AFTER all balls resolved
  const totalCoreBalls = ballsThisLevel();
  const resolvedCore = popped + missed; // core balls that are decided (popped or missed)
  const allCoreResolved = resolvedCore >= totalCoreBalls;
  const poppedEnough = popped >= (totalCoreBalls - ALLOWED_MISS);

  if (allCoreResolved){
    if (poppedEnough){
      // next level
      level++;
      levelEl.textContent = level;
      spawnLevel();
    }else{
      // lose a life
      lives--;
      livesEl.textContent = lives;
      if (lives <= 0){
        endGame();
        return;
      }else{
        spawnLevel();
      }
    }
  }

  rafId = requestAnimationFrame(step);
}

/* ------------------ HUD & Game control ------------------ */
function updateHUD(){
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  bonusEl.textContent = `$${bonusDollars}`;
}

function startGame(){
  if (running) return;
  running = true;

  // fresh level start (no preview balls)
  spawnLevel();
  updateHUD();
  cancelAnimationFrame(rafId);
  step();
}

function resetGame(){
  running = false;
  cancelAnimationFrame(rafId);

  level = 1;
  score = 0;
  lives = 3;
  bonusDollars = 0;
  burritosThisGame = 0;
  burritosSeen = 0;

  balls = [];
  popped = 0;
  missed = 0;

  updateHUD();
  clearCanvas(); // make sure nothing shows before starting
}

function endGame(){
  running = false;
  cancelAnimationFrame(rafId);

  // Build promo code tier
  const base = 5; // $5 base
  const total = Math.min(8, base + burritosThisGame); // up to $8
  const codeMap = {5:'SAVE5', 6:'SAVE6', 7:'SAVE7', 8:'SAVE8'};
  const code = codeMap[total] || 'SAVE5';

  setTimeout(()=>{
    alert(
      `Congratulations! You win!\n` +
      `Promo Code: ${code}\n` +
      `Bonus: $${burritosThisGame} (from burritos)\n` +
      `Final Discount: $${total}`
    );
  }, 50);
}

/* Buttons */
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('resetButton').addEventListener('click', resetGame);

/* Initial state */
resetGame();
