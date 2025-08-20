// =======================================================
// Meatball Pop — fixed canvas size + logo + burritos + level 10 win
// =======================================================
(() => {
  const $ = (id) => document.getElementById(id);

  function wireUp() {
    const canvas = $("gameCanvas");
    const ctx = canvas?.getContext("2d");

    const scoreEl = $("score");
    const livesEl = $("lives");
    const levelEl = $("level");
    const bonusEl = $("bonus");

    // Your buttons must have these IDs in index.html
    const startBtn = $("startButton") || $("startBtn");
    const resetBtn = $("resetButton") || $("resetBtn");

    // Guards
    if (!canvas || !ctx) { console.error("Missing #gameCanvas"); return; }
    if (!scoreEl || !livesEl || !levelEl || !bonusEl) { console.error("Missing HUD spans"); return; }
    if (!startBtn || !resetBtn) { console.error("Missing start/reset buttons"); return; }

    // ---------- Game State ----------
    let score = 0;
    let lives = 3;
    let level = 1;
    let bonusPercent = 0;            // +5% per burrito (max 15)
    let running = false;
    let ended = false;
    let rafId = 0;

    const meatballs = [];
    const burritos = [];
    const maxBurritos = 3;
    let burritosSpawned = 0;

    const WIN_LEVEL = 10;

    // ---------- Assets ----------
    const meatballImg = new Image();
    let meatballReady = false;
    meatballImg.onload = () => (meatballReady = true);
    meatballImg.onerror = () => console.error("Failed to load assets/meatball.png");
    meatballImg.src = "assets/meatball.png?v=" + Date.now();

    const burritoImg = new Image();
    let burritoReady = false;
    burritoImg.onload = () => (burritoReady = true);
    burritoImg.onerror = () => console.warn("No assets/burrito.png found — fallback rect will be used.");
    burritoImg.src = "assets/burrito.png?v=" + Date.now();

    // ---------- Sizing ----------
    function fitCanvas() {
      // Match the internal pixel buffer to the displayed CSS size.
      // CSS already reserves a stable 16:9 area via aspect-ratio, so this
      // prevents any jump when Start is pressed.
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.round(rect.width);
      const targetH = Math.round(rect.height);

      // Set internal resolution to match visual size
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    }

    // ---------- HUD ----------
    function updateHUD() {
      scoreEl.textContent = score;
      livesEl.textContent = lives;
      levelEl.textContent = level;
      bonusEl.textContent = `${bonusPercent}%`;
    }

    // ---------- Entities ----------
    class Meatball {
      constructor(x, y, r, vx, vy) {
        this.x = x; this.y = y; this.r = r;
        this.vx = vx; this.vy = vy;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x - this.r < 0 || this.x + this.r > canvas.width) this.vx *= -1;
        if (this.y - this.r < 0 || this.y + this.r > canvas.height) this.vy *= -1;
      }
      draw() {
        if (meatballReady) {
          ctx.drawImage(meatballImg, this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
        } else {
          // Fallback circle
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
          ctx.fillStyle = "#a35300";
          ctx.strokeStyle = "#f0d7b3";
          ctx.lineWidth = 3;
          ctx.fill(); ctx.stroke();
        }
      }
      contains(mx, my) {
        const dx = mx - this.x, dy = my - this.y;
        return Math.hypot(dx, dy) <= this.r;
      }
    }

    class Burrito {
      constructor(fromLeft = true) {
        this.w = Math.max(60, canvas.width * 0.06);
        this.h = Math.max(26, this.w * 0.44);
        this.y = 40 + Math.random() * (canvas.height - 80);
        this.x = fromLeft ? -this.w : canvas.width + this.w;
        this.vx = (fromLeft ? 1 : -1) * (2.2 + level * 0.15);
      }
      update(){ this.x += this.vx; }
      outOfBounds(){
        return (this.vx > 0 && this.x - this.w > canvas.width) ||
               (this.vx < 0 && this.x + this.w < 0);
      }
      draw(){
        if (burritoReady) {
          ctx.drawImage(burritoImg, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        } else {
          ctx.fillStyle = "#c79f6a";
          ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        }
      }
      contains(mx, my){
        return (mx >= this.x - this.w/2 && mx <= this.x + this.w/2 &&
                my >= this.y - this.h/2 && my <= this.y + this.h/2);
      }
    }

    // ---------- Spawning & Difficulty ----------
    function spawnMeatballs(n) {
      for (let i = 0; i < n; i++) {
        const r = Math.max(30, Math.min(44, Math.round(canvas.width * 0.04))); // responsive radius
        const x = r + Math.random() * (canvas.width - 2 * r);
        const y = r + Math.random() * (canvas.height - 2 * r);

        // Slightly slower base + gentle ramp per level
        const base = 1.0 + level * 0.22;
        const vx = (Math.random() - 0.5) * base * 2;
        const vy = (Math.random() - 0.5) * base * 2;

        meatballs.push(new Meatball(x, y, r, vx, vy));
      }
    }

    function maybeSpawnBurrito() {
      if (burritosSpawned >= maxBurritos) return;
      // Appear on levels 3, 6, 9
      if ([3, 6, 9].includes(level)) {
        burritos.push(new Burrito(Math.random() < 0.5));
        burritosSpawned++;
      }
    }

    // ---------- Overlays ----------
    function drawOverlay(title, subtitle) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(24, canvas.width*0.045)}px Arial, sans-serif`;
      ctx.fillText(title, canvas.width/2, canvas.height/2 - 10);
      ctx.font = `400 ${Math.max(14, canvas.width*0.022)}px Arial, sans-serif`;
      ctx.fillText(subtitle, canvas.width/2, canvas.height/2 + 28);
    }

    function winGame() {
      running = false; ended = true;
      cancelAnimationFrame(rafId);
      drawFrame();
      const code = "BallGameWinner";
      drawOverlay("Congratulations! You win!",
        `Promo Code: ${code} — Bonus Discount: +${bonusPercent}% (max +15%)`);
    }

    function gameOver() {
      running = false; ended = true;
      cancelAnimationFrame(rafId);
      drawFrame();
      drawOverlay("Game Over", `Final Score: ${score} — Click the canvas to restart`);
    }

    // ---------- Loop ----------
    function drawFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      meatballs.forEach(m => { m.update(); m.draw(); });

      for (let i = burritos.length - 1; i >= 0; i--) {
        burritos[i].update();
        burritos[i].draw();
        if (burritos[i].outOfBounds()) burritos.splice(i, 1);
      }
    }

    function loop() {
      drawFrame();
      rafId = requestAnimationFrame(loop);
    }

    // ---------- Control Flow ----------
    function startGame() {
      if (running) return;
      ended = false;

      fitCanvas();           // safe to call; size is already stable visually
      score = 0; lives = 3; level = 1; bonusPercent = 0;
      meatballs.length = 0; burritos.length = 0; burritosSpawned = 0;

      spawnMeatballs(4);
      updateHUD();

      running = true;
      cancelAnimationFrame(rafId);
      loop();
    }

    function resetGame() {
      running = false; ended = false;
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      score = 0; lives = 3; level = 1; bonusPercent = 0;
      meatballs.length = 0; burritos.length = 0; burritosSpawned = 0;
      updateHUD();
    }

    // ---------- Input ----------
    canvas.addEventListener("click", (ev) => {
      if (ended) { startGame(); return; }
      if (!running) return;

      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      // Burrito first (bonus)
      for (let i = burritos.length - 1; i >= 0; i--) {
        if (burritos[i].contains(mx, my)) {
          burritos.splice(i, 1);
          bonusPercent = Math.min(15, bonusPercent + 5); // +5% per burrito
          updateHUD();
          return; // don't pop a meatball with same click
        }
      }

      // Then meatballs
      let hit = false;
      for (let i = meatballs.length - 1; i >= 0; i--) {
        if (meatballs[i].contains(mx, my)) {
          meatballs.splice(i, 1);
          score++; hit = true;

          if (score % 5 === 0) {
            level++;
            spawnMeatballs(1);
            maybeSpawnBurrito();
            updateHUD();
            if (level >= WIN_LEVEL) { winGame(); return; }
          } else {
            updateHUD();
          }
          break;
        }
      }

      if (!hit) {
        lives--;
        updateHUD();
        if (lives <= 0) gameOver();
      }
    });

    // Buttons
    startBtn.addEventListener("click", startGame);
    resetBtn.addEventListener("click", resetGame);

    // Keep internal buffer matched to the displayed size
    window.addEventListener("resize", () => {
      const wasRunning = running;
      fitCanvas();
      if (!wasRunning) drawFrame(); // keep placeholder clean
    });

    // ---------- INITIALIZE (pre-start) ----------
    // Reserve stable size immediately and sync the internal buffer
    fitCanvas();
    updateHUD();
    drawFrame(); // shows the clean panel before starting
    console.log("Meatball Pop ready.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp, { once:true });
  } else {
    wireUp();
  }
})();
