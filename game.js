// =======================================================
// Meatball Pop — logo, slower balls, burrito bonus, win UI
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
    let bonusPercent = 0;          // +5% per burrito
    let running = false;
    let ended = false;
    let rafId = 0;

    const meatballs = [];
    const burritos = [];
    const maxBurritos = 3;
    let burritosSpawned = 0;       // total spawned so far

    // Win condition: reach level 10
    const WIN_LEVEL = 10;

    // ---------- Assets ----------
    const meatballImg = new Image();
    let meatballReady = false;
    meatballImg.onload = () => meatballReady = true;
    meatballImg.onerror = () => console.error("Failed to load assets/meatball.png");
    meatballImg.src = "assets/meatball.png?v=" + Date.now();

    const burritoImg = new Image();
    let burritoReady = false;
    burritoImg.onload = () => burritoReady = true;
    burritoImg.onerror = () => console.error("Failed to load assets/burrito.png");
    burritoImg.src = "assets/burrito.png?v=" + Date.now();

    // ---------- UI ----------
    function updateHUD() {
      scoreEl.textContent = score;
      livesEl.textContent = lives;
      levelEl.textContent = level;
      bonusEl.textContent = `${bonusPercent}%`;
    }

    function fitCanvas() {
      const maxW = Math.min(980, document.body.clientWidth - 32);
      const w = Math.max(360, maxW);
      const h = Math.floor(w * 9 / 16);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = w;
      canvas.height = h;
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
          // fallback
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
      // a light rectangle-ish sprite that flies across screen
      constructor(fromLeft = true) {
        this.w = 64; this.h = 28;
        this.y = 40 + Math.random() * (canvas.height - 80);
        this.x = fromLeft ? -this.w : canvas.width + this.w;
        this.vx = (fromLeft ? 1 : -1) * (2.2 + level * 0.15); // speed
        this.hit = false;
      }
      update() {
        this.x += this.vx;
      }
      outOfBounds() {
        return (this.vx > 0 && this.x - this.w > canvas.width) ||
               (this.vx < 0 && this.x + this.w < 0);
      }
      draw() {
        if (burritoReady) {
          ctx.drawImage(burritoImg, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        } else {
          // fallback rectangle
          ctx.fillStyle = "#c79f6a";
          ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        }
      }
      contains(mx, my) {
        return (mx >= this.x - this.w/2 && mx <= this.x + this.w/2 &&
                my >= this.y - this.h/2 && my <= this.y + this.h/2);
      }
    }

    // ---------- Spawning ----------
    function spawnMeatballs(n) {
      for (let i = 0; i < n; i++) {
        const r = 34;
        const x = r + Math.random() * (canvas.width - 2 * r);
        const y = r + Math.random() * (canvas.height - 2 * r);
        // SLOWER movement than before
        const base = 1.0 + level * 0.22;     // lower starting speed + gentler slope
        const vx = (Math.random() - 0.5) * base * 2;
        const vy = (Math.random() - 0.5) * base * 2;
        meatballs.push(new Meatball(x, y, r, vx, vy));
      }
    }

    function maybeSpawnBurrito() {
      if (burritosSpawned >= maxBurritos) return;
      // schedule at levels 3, 6, 9 (roughly spaced)
      if ([3, 6, 9].includes(level)) {
        burritos.push(new Burrito(Math.random() < 0.5));
        burritosSpawned++;
      }
    }

    // ---------- Loop & Draw ----------
    function drawOverlay(title, subtitle) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "700 42px Arial, sans-serif";
      ctx.fillText(title, canvas.width/2, canvas.height/2 - 10);
      ctx.font = "400 20px Arial, sans-serif";
      ctx.fillText(subtitle, canvas.width/2, canvas.height/2 + 26);
    }

    function winGame() {
      running = false;
      ended = true;
      cancelAnimationFrame(rafId);
      drawFrame();
      const code = "BallGameWinner"; // you can rename later
      drawOverlay(
        "Congratulations! You win!",
        `Promo Code: ${code} — Bonus Discount: +${bonusPercent}% (3 burritos max)`
      );
    }

    function gameOver() {
      running = false;
      ended = true;
      cancelAnimationFrame(rafId);
      drawFrame();
      drawOverlay("Game Over", `Final Score: ${score} — Click to restart`);
    }

    function drawFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // meatballs
      meatballs.forEach(m => { m.update(); m.draw(); });

      // burritos
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

      fitCanvas();
      score = 0; lives = 3; level = 1; bonusPercent = 0;
      meatballs.length = 0;
      burritos.length = 0;
      burritosSpawned = 0;

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

      // Check burritos first (bonus)
      for (let i = burritos.length - 1; i >= 0; i--) {
        if (burritos[i].contains(mx, my)) {
          burritos.splice(i, 1);
          bonusPercent = Math.min(15, bonusPercent + 5); // +5%, max 15
          updateHUD();
          return; // don't also pop a meatball on the same click
        }
      }

      // Then meatballs
      let hit = false;
      for (let i = meatballs.length - 1; i >= 0; i--) {
        if (meatballs[i].contains(mx, my)) {
          meatballs.splice(i, 1);
          score++;
          hit = true;

          if (score % 5 === 0) {
            level++;
            spawnMeatballs(1);     // gradually more on screen
            maybeSpawnBurrito();   // at 3/6/9
            updateHUD();
            if (level >= WIN_LEVEL) {
              winGame();
              return;
            }
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

    startBtn.addEventListener("click", startGame);
    resetBtn.addEventListener("click", resetGame);
    window.addEventListener("resize", () => { if (running || ended) fitCanvas(); });

    updateHUD();
    console.log("Meatball Pop ready — Start when you are!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp, { once: true });
  } else {
    wireUp();
  }
})();
