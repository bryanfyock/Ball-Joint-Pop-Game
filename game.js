// =========================
// Meatball Pop Game Script
// =========================

// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");
const levelDisplay = document.getElementById("level");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");

// Game variables
let score = 0;
let lives = 3;
let level = 1;
let meatballs = [];
let gameInterval;
let gameRunning = false;

// Meatball image
const meatballImg = new Image();
meatballImg.src = "assets/meatball.png";

// Meatball class
class Meatball {
    constructor(x, y, radius, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = speedX;
        this.speedY = speedY;
    }

    draw() {
        ctx.drawImage(
            meatballImg,
            this.x - this.radius,
            this.y - this.radius,
            this.radius * 2,
            this.radius * 2
        );
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off walls
        if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
            this.speedX *= -1;
        }
        if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
            this.speedY *= -1;
        }

        this.draw();
    }

    isClicked(mouseX, mouseY) {
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.radius;
    }
}

// Spawn new meatballs
function spawnMeatballs(count) {
    for (let i = 0; i < count; i++) {
        const radius = 30;
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = Math.random() * (canvas.height - radius * 2) + radius;
        const speedX = (Math.random() - 0.5) * 4;
        const speedY = (Math.random() - 0.5) * 4;
        meatballs.push(new Meatball(x, y, radius, speedX, speedY));
    }
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    meatballs.forEach((meatball, index) => {
        meatball.update();
    });
}

// Start game
function startGame() {
    if (!gameRunning) {
        score = 0;
        lives = 3;
        level = 1;
        meatballs = [];
        spawnMeatballs(3);
        updateUI();
        gameInterval = setInterval(gameLoop, 20);
        gameRunning = true;
    }
}

// Reset game
function resetGame() {
    clearInterval(gameInterval);
    score = 0;
    lives = 3;
    level = 1;
    meatballs = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateUI();
    gameRunning = false;
}

// Update UI
function updateUI() {
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    levelDisplay.textContent = level;
}

// Click handler
canvas.addEventListener("click", function (event) {
    if (!gameRunning) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    meatballs.forEach((meatball, index) => {
        if (meatball.isClicked(mouseX, mouseY)) {
            meatballs.splice(index, 1);
            score++;
            if (score % 5 === 0) {
                level++;
                spawnMeatballs(level);
            }
            updateUI();
        }
    });
});

// Button listeners
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);




