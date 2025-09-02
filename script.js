class OrdiBird {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.winScreen = document.getElementById('winScreen');
        this.startButton = document.getElementById('startButton');
        this.restartButton = document.getElementById('restartButton');
        this.claimTokenButton = document.getElementById('claimTokenButton');
        this.winScoreElement = document.getElementById('winScore');
        this.currentScoreElement = document.getElementById('currentScore');
        this.finalScoreElement = document.getElementById('finalScore');
        this.thanksScoreElement = document.getElementById('thanksScore');
        
        this.gameState = 'start'; // 'start', 'playing', 'gameOver'
        this.score = 0;
        this.highScore = localStorage.getItem('ordiBirdHighScore') || 0;
        
        // Game dimensions
        this.canvasWidth = 800;
        this.canvasHeight = 600;
        
        // Bitcoin character properties
        this.bitcoin = {
            x: 150,
            y: this.canvasHeight / 2,
            width: 40,
            height: 40,
            velocity: 0,
            gravity: 1, // Balanced gravity for good control
            jumpPower: -10, // Balanced jump height for good control
            rotation: 0
        };
        
        // Garbage cans (obstacles)
        this.garbageCans = [];
        this.ropes = []; // Separate array for ropes
        this.garbageCanWidth = 80;
        this.garbageCanGap = 300; // Increased gap for more room
        this.garbageCanSpeed = 15; // Increased by 25% from 12 for even faster 30 FPS
        this.garbageCanSpawnRate = 33; // Increased by 50% from 50 for even faster spawning
        this.ropeSpawnRate = 33; // Increased by 50% from 50 for even faster spawning
        this.frameCount = 0;
        this.flagMode = false;
        
        // Garbage man character
        this.garbageMan = null;
        this.garbageManSpawnRate = 90; // frames between garbage man spawns (1.5 seconds at 30fps)
        this.garbageManSpeed = 18; // Good speed - clearly visible movement
        
        // Load garbage man image
        this.garbageManImage = new Image();
        this.garbageManImage.src = 'images/garbageman.png';
        
        // Difficulty progression
        this.difficultyLevel = 1;
        this.baseSpeed = 15; // Increased by 25% from 12 for even faster 30 FPS
        this.speedIncrease = 0.5; // Increased by 25% from 0.4 for even faster 30 FPS
        this.maxSpeed = 40; // Increased by 25% from 32 for even faster 30 FPS
        
        // Animation
        this.wingFlap = 0;
        this.wingFlapSpeed = 0.3;
        
        // Game loop control
        this.gameLoopRunning = false;
        this.gameLoopInterval = null;
        
        this.setupEventListeners();
        this.startScreen.classList.add('active'); // Make start screen visible initially
        this.drawStartScreen();
    }
    
    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
        this.claimTokenButton.addEventListener('click', () => this.claimToken());
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState === 'playing') {
                    this.flap();
                } else if (this.gameState === 'start') {
                    this.startGame();
                }
            }
            
            // Debug: Press W to trigger win screen
            if (e.code === 'KeyW' && this.gameState === 'playing') {
                this.score = 40;
                this.gameWin();
            }
        });
        
        this.canvas.addEventListener('click', () => {
            if (this.gameState === 'playing') {
                this.flap();
            } else if (this.gameState === 'start') {
                this.startGame();
            }
        });
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.bitcoin.x = 150; // Reset bird position
        this.bitcoin.y = this.canvasHeight / 2;
        this.bitcoin.velocity = 0; // Start with zero velocity (same as constructor)
        this.bitcoin.rotation = 0;
        this.garbageCans = [];
        this.ropes = [];
        this.frameCount = 0;
        this.difficultyLevel = 1;
        
        // Explicitly reset ALL speed and timing variables to original values
        this.garbageCanSpeed = 15; // Increased by 25% for even faster 30 FPS
        this.garbageCanSpawnRate = 33; // 50% faster spawning
        this.ropeSpawnRate = 33; // 50% faster spawning
        this.garbageManSpeed = 18; // Good speed - clearly visible movement
        this.garbageManSpawnRate = 90; // Original garbage man spawn rate (30 FPS)
        
        this.flagMode = false;
        this.garbageMan = null;
        
        // Reset gravity to balanced value for good control
        this.bitcoin.gravity = 1;
        
        // Hide all overlays
        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.winScreen.classList.remove('active');
        const thanksScreen = document.getElementById('thanksScreen');
        if (thanksScreen) {
            thanksScreen.classList.remove('active');
        }
        this.updateScore();
        
        // Only start game loop if it's not already running
        if (!this.gameLoopRunning) {
            this.gameLoopRunning = true;
            // Use setInterval for consistent 30 FPS across all devices
            this.gameLoopInterval = setInterval(() => this.gameLoop(), 1000 / 30); // 30 FPS
        }
    }
    
    restartGame() {
        this.startGame();
    }
    
    flap() {
        this.bitcoin.velocity = this.bitcoin.jumpPower;
        this.wingFlap = Math.PI; // Start wing flap animation
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Check for win condition in flag mode
        if (this.flagMode && this.bitcoin.x >= this.canvasWidth - 120) {
            // Award the 50th point when reaching the flag
            if (this.score === 49) {
                this.score = 50;
                this.updateScore();
            }
            this.gameWin();
            return;
        }
        
        // Update Bitcoin with consistent gravity
        this.bitcoin.velocity += this.bitcoin.gravity;
        this.bitcoin.y += this.bitcoin.velocity;
        
        // Move bird horizontally in flag mode
        if (this.flagMode) {
            this.bitcoin.x += 10; // Increased by 25% from 8 for even faster 30 FPS
        }
        
        this.bitcoin.rotation = Math.min(Math.PI / 2, Math.max(-Math.PI / 2, this.bitcoin.velocity * 0.1));
        
        // Update wing flap animation
        this.wingFlap += this.wingFlapSpeed;
        
        // Update garbage cans
        this.updateGarbageCans();
        
        // Update garbage man
        this.updateGarbageMan();
        
        // Check collisions
        this.checkCollisions();
        
        // Update difficulty
        this.updateDifficulty();
        
        this.frameCount++;
    }
    
    updateGarbageCans() {
        // Move existing garbage cans (only if not in flag mode)
        if (!this.flagMode) {
            for (let i = this.garbageCans.length - 1; i >= 0; i--) {
                const can = this.garbageCans[i];
                can.x -= this.garbageCanSpeed;
                
                // Remove cans that are off screen
                if (can.x + this.garbageCanWidth < 0) {
                    this.garbageCans.splice(i, 1);
                    this.score++;
                    this.updateScore();
                }
            }
            
            // Move existing ropes (only if not in flag mode)
            for (let i = this.ropes.length - 1; i >= 0; i--) {
                const rope = this.ropes[i];
                rope.x -= this.garbageCanSpeed;
                
                // Remove ropes that are off screen (no points for ropes)
                if (rope.x + this.garbageCanWidth < 0) {
                    this.ropes.splice(i, 1);
                }
            }
            
            // Spawn new garbage cans (only if not in flag mode)
            if (this.frameCount % this.garbageCanSpawnRate === 0) {
                this.spawnGarbageCan();
            }
            
            // Spawn new ropes (only if not in flag mode and level 2+)
            if (this.difficultyLevel >= 2 && this.frameCount % this.ropeSpawnRate === 0) {
                this.spawnRope();
            }
        } else {
            // In flag mode, don't award additional points - just mark cans as passed
            for (let i = this.garbageCans.length - 1; i >= 0; i--) {
                const can = this.garbageCans[i];
                // If bird has passed the can and we haven't marked it yet
                if (this.bitcoin.x > can.x + this.garbageCanWidth && !can.passed) {
                    can.passed = true;
                    // No additional points in flag mode
                }
            }
            
            // In flag mode, ropes don't give points (only garbage cans do)
            for (let i = this.ropes.length - 1; i >= 0; i--) {
                const rope = this.ropes[i];
                // Mark rope as passed but don't score
                if (this.bitcoin.x > rope.x + this.garbageCanWidth && !rope.passed) {
                    rope.passed = true;
                }
            }
        }
    }
    
    spawnGarbageCan() {
        // Don't spawn if in flag mode
        if (this.flagMode) {
            return;
        }
        
        // Check if we should enforce the proper gap distance for this level
        let enforceGap = false;
        if (this.difficultyLevel >= 2) {
            if (this.difficultyLevel === 4) {
                // Level 4: 60% chance to enforce 60px gaps for guaranteed challenge
                // Also guarantee the first obstacle in Level 4 uses the proper gap
                enforceGap = Math.random() < 0.6 || this.garbageCans.length === 0;
            } else {
                // Levels 2-3: 30% chance to enforce proper gap distance
                enforceGap = Math.random() < 0.3;
            }
        }
        
        // Calculate spawn position
        let spawnX = this.canvasWidth;
        
        // If enforcing gap and we have previous obstacles, ensure proper spacing
        if (enforceGap && this.garbageCans.length > 0) {
            const lastCan = this.garbageCans[this.garbageCans.length - 1];
            const targetGap = this.garbageCanGap;
            
            // Calculate where the new obstacle should be for proper gap
            const idealSpawnX = lastCan.x + targetGap;
            
            // Only use the gap positioning if it would spawn off-screen to the right
            // Otherwise, spawn normally at the right edge
            if (idealSpawnX >= this.canvasWidth) {
                spawnX = idealSpawnX;
            }
            // If idealSpawnX would be on-screen, keep spawnX as canvasWidth (normal spawning)
        }
        
        // Generate hill height based on difficulty level with increased variability
        let hillHeight = 0;
        if (this.difficultyLevel >= 1) {
            hillHeight = Math.random() * 120 + 5; // 5-125px hill height for level 1 (much more variation)
        }
        if (this.difficultyLevel >= 2) {
            hillHeight = Math.random() * 100 + 15; // 15-115px hill height for levels 2+ (more dynamic)
        }
        if (this.difficultyLevel >= 3) {
            hillHeight = Math.random() * 140 + 25; // 25-165px hill height for levels 3+ (high variation)
        }
        if (this.difficultyLevel >= 4) {
            hillHeight = Math.random() * 180 + 40; // 40-220px hill height for level 4 (maximum variation)
        }
        
        // Ensure there's always enough space for Ordi to fly through
        // Gap should be at least 300px, and we need to account for hill height + fixed garbage can height
        const fixedCanHeight = 120;
        const minGapPosition = 50;
        const maxGapPosition = this.canvasHeight - this.garbageCanGap - hillHeight - fixedCanHeight - 50; // Leave 50px margin
        const gapPosition = Math.random() * (maxGapPosition - minGapPosition) + minGapPosition;
        
        this.garbageCans.push({
            x: spawnX,
            gapY: gapPosition,
            gapHeight: this.garbageCanGap,
            hillHeight: hillHeight,
            passed: false
        });
    }
    
    spawnRope() {
        // Don't spawn if in flag mode
        if (this.flagMode) {
            return;
        }
        
        // Spawn rope with increased variability in position and length
        const ropeX = this.canvasWidth;
        
        // More variable rope positioning based on difficulty level
        let ropeY;
        if (this.difficultyLevel === 1) {
            ropeY = Math.random() * 200 + 30; // 30-230px for level 1 (wider range)
        } else if (this.difficultyLevel === 2) {
            ropeY = Math.random() * 180 + 40; // 40-220px for level 2 (more variation)
        } else if (this.difficultyLevel === 3) {
            ropeY = Math.random() * 160 + 50; // 50-210px for level 3 (high variation)
        } else {
            ropeY = Math.random() * 140 + 60; // 60-200px for level 4 (maximum variation)
        }
        
        // Add random length variation to make ropes more interesting
        const baseLength = Math.random() * 80 + 40; // 40-120px base length
        const lengthMultiplier = 0.8 + Math.random() * 0.6; // 0.8x to 1.4x variation
        const customLength = Math.floor(baseLength * lengthMultiplier);
        
        this.ropes.push({
            x: ropeX,
            y: ropeY,
            customLength: customLength, // Store custom length for drawing
            passed: false
        });
    }
    
    updateGarbageMan() {
        // Don't spawn or update if in flag mode
        if (this.flagMode) {
            this.garbageMan = null;
            return;
        }
        
        // Update existing garbage man
        if (this.garbageMan) {
            this.garbageMan.x -= this.garbageManSpeed; // Move left (toward player)
            
            // Remove if off screen to the left
            if (this.garbageMan.x + 40 < 0) {
                this.garbageMan = null;
            }
        }
        
        // Spawn new garbage man if none exists and it's time
        if (!this.garbageMan && this.frameCount % this.garbageManSpawnRate === 0) {
            this.spawnGarbageMan();
        }
    }
    
    spawnGarbageMan() {
        // Always spawn at the same height along the bottom of the screen
        // Image is 120px tall, so position it so feet are at bottom of screen
        const walkY = this.canvasHeight - 120; // Position so feet are at bottom
        
        this.garbageMan = {
            x: this.canvasWidth + 50, // Start off screen to the right
            y: walkY,
            direction: -1, // Walking left (toward player)
            animationFrame: 0
        };
    }
    
    checkCollisions() {
        // Check if Bitcoin hits the ceiling (with higher ceiling)
        if (this.bitcoin.y <= -20) {
            this.gameOver();
            return;
        }
        
        // Check ground collision - this will be handled by individual garbage can collision
        // since the ground level varies due to hills
        
        // Check collision with garbage cans and hills
        for (const can of this.garbageCans) {
            // Only check collision if the can is actually on screen and not overlapping with flag
            if (can.x < this.canvasWidth && can.x + this.garbageCanWidth > 0) {
                // Skip collision check if can overlaps with flag area
                if (this.flagMode && can.x >= this.canvasWidth - 100) {
                    continue;
                }
                
                // Check horizontal collision with the garbage can area
                if (this.bitcoin.x < can.x + this.garbageCanWidth &&
                    this.bitcoin.x + this.bitcoin.width > can.x) {
                    
                    // Calculate hill and garbage can positions
                    const hillTopY = this.canvasHeight - (can.hillHeight || 0);
                    const fixedCanHeight = 120;
                    const canTopY = hillTopY - fixedCanHeight;
                    
                    // Check if Bitcoin hits the hill (ground level)
                    if (this.bitcoin.y + this.bitcoin.height > hillTopY) {
                        this.gameOver();
                        return;
                    }
                    
                    // Check if Bitcoin hits the garbage can itself (the actual can structure)
                    if (this.bitcoin.y < canTopY + fixedCanHeight &&
                        this.bitcoin.y + this.bitcoin.height > canTopY) {
                        this.gameOver();
                        return;
                    }
                }
            }
        }
        
        // Check collision with garbage man
        if (this.garbageMan) {
            const manX = this.garbageMan.x;
            const manY = this.garbageMan.y;
            const manWidth = 40;
            const manHeight = 60;
            
            // More precise collision detection for the garbage man
            if (this.bitcoin.x < manX + manWidth &&
                this.bitcoin.x + this.bitcoin.width > manX &&
                this.bitcoin.y < manY + manHeight &&
                this.bitcoin.y + this.bitcoin.height > manY) {
                this.gameOver();
                return;
            }
        }
        
        // Check collision with independent ropes
        for (const rope of this.ropes) {
            // Only check collision if the rope is actually on screen
            if (rope.x < this.canvasWidth && rope.x + this.garbageCanWidth > 0) {
                // Skip collision check if rope overlaps with flag area
                if (this.flagMode && rope.x >= this.canvasWidth - 100) {
                    continue;
                }
                
                // Calculate rope position and dimensions
                const ropeX = rope.x + this.garbageCanWidth / 2 - 4; // 8px wide rope
                const ropeWidth = 8;
                
                // Use custom length if available, otherwise fall back to original calculation
                let ropeHeight;
                if (rope.customLength) {
                    ropeHeight = rope.customLength; // Use the custom length we set
                } else {
                    ropeHeight = Math.min(rope.y - 50, 150); // Fallback to original calculation
                }
                
                // Check if Bitcoin hits the rope (more precise collision)
                if (this.bitcoin.x < ropeX + ropeWidth &&
                    this.bitcoin.x + this.bitcoin.width > ropeX &&
                    this.bitcoin.y < ropeHeight &&
                    this.bitcoin.y + this.bitcoin.height > 0) {
                    this.gameOver();
                    return;
                }
            }
        }
        
        // Check ground collision with hills
        this.checkGroundCollision();
    }
    
    checkGroundCollision() {
        // Find the highest ground level (hill) that the bird might be colliding with
        let highestGroundLevel = this.canvasHeight; // Default to bottom of screen
        
        for (const can of this.garbageCans) {
            // Only check cans that are near the bird horizontally (with some margin)
            if (can.x < this.bitcoin.x + this.bitcoin.width + 30 && 
                can.x + this.garbageCanWidth > this.bitcoin.x - 30) {
                
                // Calculate the ground level for this can (hill top where Scriby would crash)
                const hillTopY = this.canvasHeight - (can.hillHeight || 0);
                const groundLevel = hillTopY; // Hill top is the collision point
                
                // Update highest ground level if this can creates a higher ground
                if (groundLevel < highestGroundLevel) {
                    highestGroundLevel = groundLevel;
                }
            }
        }
        
        // Check if bird hits the ground (including bottom of screen)
        if (this.bitcoin.y + this.bitcoin.height >= highestGroundLevel) {
            this.gameOver();
            return;
        }
        
        // Also check if bird hits the bottom of the screen
        if (this.bitcoin.y + this.bitcoin.height >= this.canvasHeight) {
            this.gameOver();
            return;
        }
    }
    
    updateDifficulty() {
        // Calculate current difficulty level based on score
        const newDifficultyLevel = Math.min(4, Math.floor(this.score / 10) + 1);
        
        // Extend Level 4 to 49 points for more challenge
        if (this.score >= 40 && this.score < 50) {
            this.difficultyLevel = 4;
        }
        
        // Only update if difficulty level changed
        if (newDifficultyLevel !== this.difficultyLevel) {
            this.difficultyLevel = newDifficultyLevel;
            this.garbageCanSpeed = Math.min(this.maxSpeed, this.baseSpeed + (this.difficultyLevel - 1) * this.speedIncrease);
            
            // Spawn rate progression for 4 levels (3x faster than before)
            if (this.difficultyLevel === 1) {
                this.garbageCanSpawnRate = 33; // Level 1 - 50% faster
                this.ropeSpawnRate = 67; // Level 1 - 50% faster
            } else if (this.difficultyLevel === 2) {
                this.garbageCanSpawnRate = 20; // Level 2 - 50% faster
                this.ropeSpawnRate = 27; // Level 2 - 50% faster
                this.garbageCanGap = 120; // Level 2 - very tight gaps for high challenge
            } else if (this.difficultyLevel === 3) {
                this.garbageCanSpawnRate = 13; // Level 3 - 50% faster
                this.ropeSpawnRate = 22; // Level 3 - 50% faster
                this.garbageCanGap = 120; // Level 3 - very tight gaps for high challenge
            } else if (this.difficultyLevel === 4) {
                this.garbageCanSpawnRate = 10; // Level 4 - 50% faster
                this.ropeSpawnRate = 18; // Level 4 - 50% faster
                this.garbageCanGap = 60; // Level 4 - ultimate challenge with extremely tight gaps
            }
        }
        
        // Check for flag mode at 49 points
        if (this.score >= 49 && this.gameState === 'playing' && !this.flagMode) {
            this.enterFlagMode();
        }
    }
    
    gameOver() {
        console.log('Game Over triggered! Score:', this.score);
        this.gameState = 'gameOver';
        this.finalScoreElement.textContent = this.score;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('ordiBirdHighScore', this.highScore);
        }
        
        this.gameOverScreen.classList.add('active');
        console.log('Game Over screen should be visible now');
        
        // Stop the game loop interval
        this.stopGameLoop();
    }
    
    enterFlagMode() {
        this.flagMode = true;
        this.garbageCanSpeed = 0; // Stop garbage cans from moving
        this.garbageCanSpawnRate = 0; // Stop spawning new garbage cans
        
        // Remove any garbage cans that would overlap with the flag area
        this.garbageCans = this.garbageCans.filter(can => can.x < this.canvasWidth - 100);
    }
    
    gameWin() {
        console.log('Game Win triggered! Score:', this.score);
        this.gameState = 'gameWin';
        this.winScoreElement.textContent = this.score;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('ordiBirdHighScore', this.highScore);
        }
        
        this.winScreen.classList.add('active');
        console.log('Win screen should be visible now');
        this.createConfetti();
        
        // Stop the game loop interval
        this.stopGameLoop();
    }
    
    createConfetti() {
        const colors = ['#0066cc', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
        const confettiCount = 150;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * window.innerWidth + 'px';
                confetti.style.animationDelay = Math.random() * 2 + 's';
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                
                // Random confetti shape and color
                const color = colors[Math.floor(Math.random() * colors.length)];
                const shape = Math.random() > 0.5 ? '●' : '◆';
                confetti.style.color = color;
                confetti.style.fontSize = (Math.random() * 10 + 8) + 'px';
                confetti.textContent = shape;
                
                document.body.appendChild(confetti);
                
                // Remove confetti after animation
                setTimeout(() => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                }, 5000);
            }, i * 20); // Stagger confetti creation
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0, '#87ceeb');
        gradient.addColorStop(1, '#98fb98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Draw garbage cans
        this.drawGarbageCans();
        
        // Draw garbage man
        if (this.garbageMan) {
            this.drawGarbageMan();
        }
        
        // Draw Bitcoin
        this.drawBitcoin();
        
        // Draw flag when in flag mode
        if (this.flagMode) {
            this.drawFlag();
        }
        
        // Draw score
        this.drawScore();
    }
    
    drawBitcoin() {
        this.ctx.save();
        this.ctx.translate(this.bitcoin.x + this.bitcoin.width / 2, this.bitcoin.y + this.bitcoin.height / 2);
        this.ctx.rotate(this.bitcoin.rotation);
        
        // Draw 🧿 emoji
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🧿', 0, 0);
        
        // Draw wings
        this.drawWings();
        
        this.ctx.restore();
    }
    
    drawWings() {
        const wingFlapOffset = Math.sin(this.wingFlap) * 5;
        
        // Left wing
        this.ctx.fillStyle = '#0066cc';
        this.ctx.beginPath();
        this.ctx.ellipse(-25, -5 + wingFlapOffset, 15, 8, Math.PI / 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Right wing
        this.ctx.beginPath();
        this.ctx.ellipse(25, -5 - wingFlapOffset, 15, 8, -Math.PI / 4, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawGarbageCans() {
        for (const can of this.garbageCans) {
            // Calculate hill position at the bottom of the screen
            const hillBaseY = this.canvasHeight; // Bottom of screen
            const hillTopY = this.canvasHeight - (can.hillHeight || 0); // Top of the hill
            
            // Draw hill first (if it exists) at the bottom
            if (can.hillHeight && can.hillHeight > 0) {
                this.drawHill(can.x, hillBaseY, can.hillHeight);
            }
            
            // Draw garbage can on top of the hill with fixed height
            const fixedCanHeight = 120; // Fixed garbage can height
            this.drawGarbageCan(can.x, hillTopY - fixedCanHeight, fixedCanHeight);
        }
        
        // Draw ropes separately
        for (const rope of this.ropes) {
                            this.drawRopeWithKnot(rope.x, rope.y, rope.customLength);
        }
    }
    
    drawGarbageCan(x, y, height) {
        // Main can body - grey plastic
        this.ctx.fillStyle = '#808080';
        this.ctx.fillRect(x, y, this.garbageCanWidth, height);
        
        // Top rim/lip
        this.ctx.fillStyle = '#696969';
        this.ctx.fillRect(x - 2, y, this.garbageCanWidth + 4, 6);
        
        // Triangular tooth-like indentations along the top
        this.ctx.fillStyle = '#5a5a5a';
        for (let i = 0; i < 8; i++) {
            const toothX = x + 5 + (i * 8);
            this.ctx.beginPath();
            this.ctx.moveTo(toothX, y);
            this.ctx.lineTo(toothX + 4, y + 6);
            this.ctx.lineTo(toothX + 8, y);
            this.ctx.fill();
        }
        
        // Vertical reinforcement panels on sides
        this.ctx.fillStyle = '#5a5a5a';
        this.ctx.fillRect(x + 5, y + 10, 8, height - 20);
        this.ctx.fillRect(x + this.garbageCanWidth - 13, y + 10, 8, height - 20);
        
        // Hinged lid (partially open) - facing opposite direction
        this.ctx.fillStyle = '#808080';
        this.ctx.save();
        this.ctx.translate(x + this.garbageCanWidth / 2, y);
        this.ctx.rotate(Math.PI / 4); // 45 degree angle in opposite direction
        this.ctx.fillRect(-this.garbageCanWidth / 2 - 2, -8, this.garbageCanWidth + 4, 12);
        this.ctx.restore();
        
        // Lid handle
        this.ctx.fillStyle = '#5a5a5a';
        this.ctx.fillRect(x + 15, y - 10, 20, 6);
        this.ctx.fillRect(x + 20, y - 15, 10, 8);
        
        // Wheels at the bottom
        this.ctx.fillStyle = '#808080';
        this.ctx.beginPath();
        this.ctx.arc(x + 15, y + height - 8, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(x + this.garbageCanWidth - 15, y + height - 8, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Wheel spokes
        this.ctx.strokeStyle = '#5a5a5a';
        this.ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            // Left wheel
            this.ctx.beginPath();
            this.ctx.moveTo(x + 15 + Math.cos(angle) * 3, y + height - 8 + Math.sin(angle) * 3);
            this.ctx.lineTo(x + 15 + Math.cos(angle) * 8, y + height - 8 + Math.sin(angle) * 8);
            this.ctx.stroke();
            // Right wheel
            this.ctx.beginPath();
            this.ctx.moveTo(x + this.garbageCanWidth - 15 + Math.cos(angle) * 3, y + height - 8 + Math.sin(angle) * 3);
            this.ctx.lineTo(x + this.garbageCanWidth - 15 + Math.cos(angle) * 8, y + height - 8 + Math.sin(angle) * 8);
            this.ctx.stroke();
        }
        
        // Shadow/base
        this.ctx.fillStyle = '#5a5a5a';
        this.ctx.fillRect(x - 3, y + height - 3, this.garbageCanWidth + 6, 3);
    }
    
    drawHill(x, y, hillHeight) {
        // Draw a grassy hill with flat rounded top
        const hillWidth = this.garbageCanWidth + 40; // Hill extends beyond the can
        
        // Main hill shape with flat rounded top
        this.ctx.fillStyle = '#228B22'; // Forest green
        this.ctx.beginPath();
        this.ctx.moveTo(x - 20, y);
        
        // Create a flat-topped hill with smooth curves
        const centerX = x + this.garbageCanWidth / 2;
        const topY = y - hillHeight;
        const flatTopWidth = 40; // Width of the flat top
        
        // Left side curve to flat top
        this.ctx.quadraticCurveTo(centerX - 40, y - hillHeight * 0.7, centerX - flatTopWidth/2, topY);
        // Flat top
        this.ctx.lineTo(centerX + flatTopWidth/2, topY);
        // Right side curve from flat top
        this.ctx.quadraticCurveTo(centerX + 40, y - hillHeight * 0.7, x + this.garbageCanWidth + 20, y);
        
        this.ctx.closePath();
        this.ctx.fill();
        
        // Add some grass texture
        this.ctx.strokeStyle = '#32CD32'; // Lime green
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const grassX = x - 15 + (i * 8);
            const grassY = y - (hillHeight * 0.3) - (i * 3);
            this.ctx.beginPath();
            this.ctx.moveTo(grassX, grassY);
            this.ctx.lineTo(grassX + 2, grassY - 4);
            this.ctx.stroke();
        }
    }
    
    drawRopeWithKnot(x, ropeY, customLength = null) {
        const ropeWidth = 8;
        
        // Use custom length if provided, otherwise calculate from ropeY
        let ropeHeight;
        if (customLength) {
            ropeHeight = customLength; // Use the custom length directly
        } else {
            ropeHeight = ropeY - 50; // Fallback to original calculation
        }
        
        // Ensure rope doesn't extend too far down and has a minimum height
        const maxRopeHeight = Math.max(Math.min(ropeHeight, 200), 60); // Min 60px, Max 200px rope height
        
        // Draw rope
        this.ctx.fillStyle = '#8B4513'; // Brown rope
        this.ctx.fillRect(x + this.garbageCanWidth / 2 - ropeWidth / 2, 0, ropeWidth, maxRopeHeight);
        
        // Draw knot (thicker section) - positioned relative to the actual visible rope
        const knotY = maxRopeHeight - 30;
        const knotWidth = 16;
        const knotHeight = 20;
        
        this.ctx.fillStyle = '#654321'; // Darker brown for knot
        this.ctx.fillRect(x + this.garbageCanWidth / 2 - knotWidth / 2, knotY, knotWidth, knotHeight);
        
        // Draw knot details (loops)
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.arc(x + this.garbageCanWidth / 2 - 6, knotY + 5, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(x + this.garbageCanWidth / 2 + 6, knotY + 5, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw rope texture (small lines)
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < ropeHeight; i += 8) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + this.garbageCanWidth / 2 - ropeWidth / 2, i);
            this.ctx.lineTo(x + this.garbageCanWidth / 2 + ropeWidth / 2, i);
            this.ctx.stroke();
        }
    }
    
    drawGarbageMan() {
        const x = this.garbageMan.x;
        const y = this.garbageMan.y;
        
        // Update animation frame
        this.garbageMan.animationFrame += 0.2;
        
        // Draw the garbage man image
        if (this.garbageManImage.complete) {
            // Image is loaded, draw it
            const imageWidth = 80; // Adjust size as needed
            const imageHeight = 120; // Adjust size as needed
            
            // Add walking animation by slightly moving the image up and down
            const walkBounce = Math.sin(this.garbageMan.animationFrame * 2) * 2;
            
            this.ctx.drawImage(
                this.garbageManImage,
                x, y + walkBounce, // Position with walking bounce
                imageWidth, imageHeight
            );
        } else {
            // Fallback: draw a simple placeholder while image loads
            this.ctx.fillStyle = '#228B22';
            this.ctx.fillRect(x, y, 40, 60);
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText('Loading...', x, y + 30);
        }
    }
    
    drawFlag() {
        const flagX = this.canvasWidth - 100;
        const flagY = this.canvasHeight - 200; // Position at bottom right
        
        // Flag pole
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(flagX, flagY, 8, 200);
        
        // Flag
        this.ctx.fillStyle = '#0066cc';
        this.ctx.fillRect(flagX + 8, flagY + 10, 80, 50);
        
        // Flag text
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.font = 'bold 12px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('MINER', flagX + 48, flagY + 25);
        this.ctx.fillText('MEMPOOL', flagX + 48, flagY + 40);
        
        // Flag pole top
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(flagX + 4, flagY, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawScore() {
        this.ctx.fillStyle = '#0066cc';
        this.ctx.font = 'bold 32px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`Score: ${this.score}`, this.canvasWidth / 2, 20);
        
        if (this.highScore > 0) {
            this.ctx.font = 'bold 18px Orbitron';
            this.ctx.fillText(`High Score: ${this.highScore}`, this.canvasWidth / 2, 60);
        }
    }
    
    drawStartScreen() {
        this.draw();
    }
    
    updateScore() {
        this.currentScoreElement.textContent = this.score;
    }
    
    async claimToken() {
        const sparkAddress = document.getElementById('sparkAddress').value.trim();

        if (!sparkAddress) {
            alert('Please enter your Spark address to claim your reward.');
            return;
        }

        // Basic validation for Spark address format (starts with 'sp1' and has reasonable length)
        const lowerAddress = sparkAddress.toLowerCase();
        console.log('Validating address:', sparkAddress);
        console.log('Address length:', sparkAddress.length);
        console.log('Starts with sp1:', lowerAddress.startsWith('sp1'));
        console.log('Length >= 20:', sparkAddress.length >= 20);
        console.log('Raw address bytes:', Array.from(sparkAddress).map(c => c.charCodeAt(0)));
        
        if (!lowerAddress.startsWith('sp1') || sparkAddress.length < 20) {
            console.log('Validation failed!');
            alert('Please enter a valid Spark address (should start with "sp1" and be at least 20 characters long).');
            return;
        }
        
        console.log('Validation passed!');

        // Show loading state
        const claimButton = document.getElementById('claimTokenButton');
        const originalText = claimButton.textContent;
        claimButton.textContent = 'Claiming Reward...';
        claimButton.disabled = true;

        try {
            // Call backend API to claim token
            const response = await fetch('/api/claim/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sparkAddress: sparkAddress
                })
            });

            const result = await response.json();

            if (result.success) {
                // Show transaction details first
                alert(`🎉 Reward claimed successfully!\n\nYour reward has been sent to: ${sparkAddress}\n\nTransaction Hash: ${result.data.transactionHash}\n\nClick OK to continue.`);
                
                // Clear the input
                document.getElementById('sparkAddress').value = '';
                
                // Show "Thanks for Playing!" screen after user clicks OK
                this.showThanksForPlayingScreen();
            } else {
                // Show error message
                alert(`❌ Failed to claim reward: ${result.error}`);
            }
        } catch (error) {
            console.error('Error claiming token:', error);
            alert('❌ Network error. Please check your connection and try again.');
        } finally {
            // Reset button state
            claimButton.textContent = originalText;
            claimButton.disabled = false;
        }
    }
    
    showThanksForPlayingScreen() {
        console.log('Showing thanks for playing screen');
        // Hide the win screen
        this.winScreen.classList.remove('active');
        
        // Set the score on the thanks screen
        this.thanksScoreElement.textContent = this.score;
        
        // Show the thanks screen
        const thanksScreen = document.getElementById('thanksScreen');
        if (thanksScreen) {
            thanksScreen.classList.add('active');
            console.log('Thanks screen should be visible now');
        } else {
            console.error('Thanks screen element not found!');
        }
    }
    
    stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            this.gameLoopRunning = false;
        }
    }
    
    gameLoop() {
        // Always continue the game loop to keep screens visible
        if (this.gameState === 'playing') {
            this.update();
            this.draw();
        } else if (this.gameState === 'gameOver' || this.gameState === 'gameWin') {
            // Keep drawing the game state even when game is over/won
            this.draw();
        }
        
        // Continue the loop at 30 FPS using setInterval instead of requestAnimationFrame
        // This ensures consistent timing across all devices (web and mobile)
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new OrdiBird();
});
