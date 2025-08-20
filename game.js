// =======================================
// Meatball Pop — with Canvas Game Over UI
// =======================================
(() => {
  const $ = (id) => document.getElementById(id);

  function wireUp() {
    // Elements (tolerant IDs for buttons)
    const canvas = $("gameCanvas");
    const ctx = canvas?.getContext("2d");
    const scoreEl = $("score");
    const livesEl = $("lives");
    const levelEl = $("level");
    const startBtn = $("startButton") || $("startBtn");
    const resetBtn = $("resetButton") || $("resetBtn");

    // Guard rails
    if (!canvas || !ctx) return console.error("Missing #gameCanvas");
    if (!scoreEl || !livesEl || !levelEl)
      return console.error("Missing HUD spans: #score, #lives, #level");
    if (!startBtn) return console.error("Missing start button (#startButton)");
    if (!resetBtn) return console.error("Missing reset button (#resetButton)");

    // State
    let score = 0;
    let lives = 3;
    let level = 1;
    let running = false;
    let ended = false;         // game over flag
    let rafId = 0;
    const meatballs = [];

    // Asset
    const meatballImg = new Image();
    let imgReady = false;
    meatballImg.onload  = () => { imgReady = true; };
    meatballImg.onerror = () => { imgReady = false; console.error("Could not load assets/meatball.png"); };
    meatballImg.src = "assets/meatball.png?v=" + Date.now(); // cache-bust

    // Helpers
    function updateHUD() {
      scoreEl.textContent = score;
      livesEl.textContent = lives;
      levelEl.textContent = level;
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
        if (imgReady) {
          ctx.drawImage(meatballImg, this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
        } else {
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

    function spawn(n) {
      for (let i = 0; i < n; i++) {
        const r = 34;
        const x = r + Math.random() * (canvas.width - 2 * r);
        const y = r + Math.random() * (canvas.height - 2 * r);
        const v = 1.6 + level * 0.35; // speed increases by level
        const vx = (Math.random() - 0.5) * v * 2;
        const vy = (Math.random() - 0.5) * v * 2;
        meatballs.push(new Meatball(x, y, r, vx, vy));
      }
    }

    function drawOverlay(title, subtitle) {
      // darken
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "700 44px Arial, sans-serif";
      ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 12);

      ctx.font = "400 20px Arial, sans-serif";
      ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
    }

    function gameOver() {
      running = false;
      ended = true;
      cancelAnimationFrame(rafId);
      drawFrame(); // draw the last state
      drawOverlay("Game Over", `Final Score: ${score} — Click anywhere to restart`);
    }

    function drawFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      meatballs.forEach(m => { m.update(); m.draw(); });
    }

    function loop() {
      drawFrame();
      rafId = requestAnimationFrame(loop);
    }

    function startGame() {
      if (running) return;
      ended = false;
      fitCanvas();
      score = 0; lives = 3; level = 1;
      meatballs.length = 0;
      spawn(4);
      updateHUD();
      running = true;
      cancelAnimationFrame(rafId);
      loop();
    }

    function resetGame() {
      running = false;
      ended = false;
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      score = 0; lives = 3; level = 1;
      meatballs.length = 0;
      updateHUD();
    }

    // Clicks: pop or lose a life; if lives reach 0 -> game over
    canvas.addEventListener("click", (ev) => {
      if (ended) { startGame(); return; } // restart from overlay
      if (!running) return;

      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      let hit = false;
      for (let i = meatballs.length - 1; i >= 0; i--) {
        if (meatballs[i].contains(mx, my)) {
          meatballs.splice(i, 1);
          score++;
          hit = true;

          // simple progression: every 5 hits add a new meatball and level up
          if (score % 5 === 0) {
            level++;
            spawn(1);
          }
          updateHUD();
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

    // Responsive canvas
    window.addEventListener("resize", () => {
      if (!running && !ended) return;
      fitCanvas();
    });

    // Initial HUD
    updateHUD();
    console.log("Meatball Pop ready. Click Start.");
  }

  // Ensure DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp, { once: true });
  } else {
    wireUp();
  }
})();


