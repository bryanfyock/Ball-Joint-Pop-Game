// =============================
// Meatball Pop (robust version)
// =============================
(() => {
  // --- helpers ---
  const $ = (id) => document.getElementById(id);

  function wireUp() {
    // Canvas / UI
    const canvas = $("gameCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    const scoreEl = $("score");
    const livesEl = $("lives");
    const levelEl = $("level");

    // Be tolerant to both id styles: startButton OR startBtn (same for reset)
    const startBtn = $("startButton") || $("startBtn");
    const resetBtn = $("resetButton") || $("resetBtn");

    // Guard rails: tell us in the console exactly what’s missing
    if (!canvas || !ctx) {
      console.error("Canvas element with id='gameCanvas' not found.");
      return;
    }
    if (!startBtn) {
      console.error("Start button not found. Use id='startButton' (or 'startBtn').");
      return;
    }
    if (!resetBtn) {
      console.error("Reset button not found. Use id='resetButton' (or 'resetBtn').");
      return;
    }
    if (!scoreEl || !livesEl || !levelEl) {
      console.error("Missing one of score/lives/level spans (ids: score, lives, level).");
      return;
    }

    // --- state ---
    let score = 0;
    let lives = 3;
    let level = 1;
    let gameRunning = false;
    let loopId = 0;
    const meatballs = [];

    function updateUI() {
      scoreEl.textContent = score;
      livesEl.textContent = lives;
      levelEl.textContent = level;
    }

    // --- image asset ---
    const meatballImg = new Image();
    let imgReady = false;
    meatballImg.onload = () => {
      imgReady = true;
      console.log("Meatball image loaded OK.");
    };
    meatballImg.onerror = (e) => {
      imgReady = false;
      console.error("Failed to load assets/meatball.png", e);
    };
    meatballImg.src = "assets/meatball.png?v=" + Date.now(); // cache-bust

    // --- meatball class ---
    class Meatball {
      constructor(x, y, r, vx, vy) {
        this.x = x; this.y = y; this.r = r; this.vx = vx; this.vy = vy;
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
          // Fallback circle if image not ready
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
          ctx.fillStyle = "#a35300";
          ctx.strokeStyle = "#f0d7b3";
          ctx.lineWidth = 3;
          ctx.fill();
          ctx.stroke();
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
        const vx = (Math.random() - 0.5) * (2 + level * 0.4);
        const vy = (Math.random() - 0.5) * (2 + level * 0.4);
        meatballs.push(new Meatball(x, y, r, vx, vy));
      }
    }

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      meatballs.forEach((m) => { m.update(); m.draw(); });
      loopId = requestAnimationFrame(tick);
    }

    function startGame() {
      if (gameRunning) return;
      // size canvas responsively (safe default)
      const maxW = Math.min(980, document.body.clientWidth - 32);
      canvas.style.width = maxW + "px";
      canvas.style.height = Math.floor(maxW * 9 / 16) + "px";
      canvas.width = maxW;
      canvas.height = Math.floor(maxW * 9 / 16);

      // reset state
      score = 0; lives = 3; level = 1;
      meatballs.length = 0;
      spawn(4);
      updateUI();

      gameRunning = true;
      cancelAnimationFrame(loopId);
      tick();
    }

    function resetGame() {
      gameRunning = false;
      cancelAnimationFrame(loopId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      score = 0; lives = 3; level = 1;
      meatballs.length = 0;
      updateUI();
    }

    canvas.addEventListener("click", (ev) => {
      if (!gameRunning) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      for (let i = meatballs.length - 1; i >= 0; i--) {
        if (meatballs[i].contains(mx, my)) {
          meatballs.splice(i, 1);
          score++;
          if (score % 5 === 0) { level++; spawn(1); }
          updateUI();
          break;
        }
      }
      // lose a life if you miss completely (optional)
      // if no hit: lives--; if (lives <= 0) resetGame(); updateUI();
    });

    startBtn.addEventListener("click", startGame);
    resetBtn.addEventListener("click", resetGame);

    console.log("Game wired up. Click Start to play.");
  }

  // Ensure DOM exists before wiring
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp, { once: true });
  } else {
    wireUp();
  }
})();
