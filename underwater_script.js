const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = 900;
canvas.height = 600;
const background = new Image();
background.src = 'underwater_background.png'; // path to your image

//global variables
const cellSize = 100;
const cellGap = 3;
let numberOfResources = 50;
let enemiesInterval = 2000; // Interval for spawning enemies
let frame = 0;
let gameOver = false;
let indScore = 0; // Individual score for each enemy defeated
let gainedScore = 0;
let score = 100;
const winningScore = 150000;
let chosenDefender = 1;
let gameStartTime = Date.now();

// Background Music
const bgMusic = new Audio('bgm/underwater.ogg'); // put your file path here
bgMusic.loop = true;   // loop forever
bgMusic.volume = 0.5;  // 0.0 (silent) → 1.0 (full volume)

// Planting cooldown system (Plants vs Zombies style)
const plantingCooldowns = {
    1: { cooldown: 0, maxCooldown: 240 }, // Chinchou: 4 seconds
    2: { cooldown: 0, maxCooldown: 300 }, // Seadra: 5 seconds  
    3: { cooldown: 0, maxCooldown: 1080 }, // Corsola: 18 seconds
    4: { cooldown: 0, maxCooldown: 1500 }, // Lumineon: 25 seconds
    5: { cooldown: 0, maxCooldown: 720 }  // Clawitzer: 12 seconds
};

const gameGrid = [];
const defenders = [];
const enemies = [];
const enemyPositions = [];
const projectiles = [];
const resources = [];
let parasectSpawnQueue = []; // queue for delayed Parasect spawns
let screenFlashes = [];

/*const defenderCooldowns = {
    Bellsprout: { cooldown: 300, timer: 0 }, // ~5 sec @60fps
    Floette: { cooldown: 240, timer: 0 }     // ~10 sec @60fps
    Carnivine: { cooldown: 450, timer: 0 }     // ~10 sec @60fps
    Ferroseed: { cooldown: 1000, timer: 0 }     // ~10 sec @60fps
    Tropius: { cooldown: 500, timer: 0 }     // ~10 sec @60fps
};*/

//mouse
const mouse = {
    x: 10,
    y: 10,  
    width: 0.1,
    height: 0.1,
    clicked: false
};
canvas.addEventListener('mousedown', function() {
    mouse.clicked = true;
});
canvas.addEventListener('mouseup', function() {
    mouse.clicked = false;
});


let canvasPosition = canvas.getBoundingClientRect();
canvas.addEventListener('mousemove', function(event) {
    mouse.x = event.x - canvasPosition.left;
    mouse.y = event.y - canvasPosition.top;
});
canvas.addEventListener('mouseleave', function() {
    mouse.x = undefined;
    mouse.y = undefined;
});

//game board
const controlsBar = {
    width: canvas.width,
    height: cellSize,
};

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = cellSize;
        this.height = cellSize;
    }
    draw(){
        if (mouse.x && mouse.y && collision(this, mouse)) {
        ctx.strokeStyle = 'black';
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}
}

function createGrid() {
    for (let y = cellSize; y < canvas.height; y += cellSize) {
        for (let x = 0; x < canvas.width; x += cellSize) {
            gameGrid.push(new Cell(x, y));
        }
    }
}

createGrid();

function handleGameGrid() {
    for (let i = 0; i < gameGrid.length; i++) {
        gameGrid[i].draw();
    }
}
console.log(gameGrid);

//projectiles
class Projectiles {
    constructor(x, y, power, pierce = 1) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.power = power;
        this.speed = 2.75;
        this.pierce = pierce;
        this.alreadyHit = new Set(); // track enemies this projectile already hit
    } 
    update() {
        this.x += this.speed;
    }
    draw() {
        ctx.fillStyle = '#4EACDE';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
    }
}

class bubbleProjectile extends Projectiles {
    constructor(x, y, power) {
        super(x, y, power, 1);
        this.width = 15;
        this.height = 15;
        this.speed = 3.25;
    }
    draw() {
        ctx.fillStyle = 'lightblue';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4EACDE';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

class waterProjectile extends Projectiles {
    constructor(x, y, power) {
        super(x, y, power, 2);
        this.width = 10;
        this.height = 10;
        this.speed = 3;
    }
    draw() {
        ctx.fillStyle = '#4EACDE';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'lightblue';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

class pulseProjectile extends Projectiles {
    constructor(x, y, power) {
        super(x, y, power, 3);
        this.width = 15;
        this.height = 15;
        this.speed = 4;
    }
    draw() {
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#482DE3';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

function handleProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
        projectiles[i].update();
        projectiles[i].draw();

        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (enemy && projectiles[i] && !projectiles[i].alreadyHit.has(enemy) &&
                collision(projectiles[i], enemy)) {
        
                enemy.health -= projectiles[i].power;
                projectiles[i].pierce--;
                projectiles[i].alreadyHit.add(enemy); // mark this enemy as hit
        
                if (projectiles[i].pierce <= 0) {
                    projectiles.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
        
        if (projectiles[i] && projectiles[i].x > canvas.width - cellSize) {
            projectiles.splice(i, 1); 
            i--; 
        }
    }
}

//defenders
const defenderChinchou = new Image();
defenderChinchou.src = 'defenderChinchou.png'; // Example enemy image
const defenderSeadra = new Image();
defenderSeadra.src = 'defenderSeadra.png'; // Example enemy image
const defenderCorsola = new Image();
defenderCorsola.src = 'defenderCorsola.png';
const defenderLumineon = new Image();
defenderLumineon.src = 'defenderLumineon.png';
const defenderClawitzer = new Image();
defenderClawitzer.src = 'defenderClawitzer.png'; // Tropius sprite

class Defender {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = cellSize - cellGap * 2;
        this.height = cellSize - cellGap * 2;
        this.shooting = false;
        this.produceResources = false; // Flag to indicate if the defender produces resources
        this.health = 50;
        this.projectiles = [];
        this.timer = 0;
        this.frameX = 0;
        this.frameY = 0;
        this.minFrame = 0;
        this.maxFrame = 3; // Assuming 4 frames for animation
        this.spriteWidth = 64; // Width of each frame in the sprite sheet
        this.spriteHeight = 64; // Height of each frame in the sprite sheet
        this.chosenDefender = chosenDefender; // Store the chosen defender type
        this.pulses = []; // Add this line

        // Cooldown system (Plants vs Zombies style)
        this.placementCooldown = 180; // Start with full cooldown time
        this.placementCooldownTime = 180; // 3 seconds at 60fps
        this.canAttack = false;
        
        // Enhanced health system
        this.maxHealth = this.health;
        this.damageFlash = 0;
        this.healFlash = 0;
        this.healthBarWidth = this.width;
        this.healthBarHeight = 10;
        
        // Assign cost and damage based on defender type
        if (this.chosenDefender === 1) {
            this.cost = 50;
            this.damage = 40; 
            this.health = 75;
            this.maxHealth = 75;
            this.resourceDropCooldown = 0;
            this.nextResourceDrop = Math.floor(Math.random() * 1150 + 1150);
            this.isFirstDrop = true;
        } else if (this.chosenDefender === 2) {
            this.cost = 125;
            this.damage = 20;
            this.shootRate = 120;
            this.health = 120;
            this.maxHealth = 120;
            this.attackCooldown = 0;
            this.attackCooldownTime = 120; // ~2.3 seconds between shots
        } else if (this.chosenDefender === 3) {
            this.cost = 75;
            this.damage = 15;
            this.attackRange = cellSize * 1; // 3 tiles in front
            this.shootRate = 200;
            this.health = 1050;
            this.maxHealth = 1050;
            this.attackCooldown = 0;
            this.attackCooldownTime = 200; // ~2.3 seconds between shots
        } else if (this.chosenDefender === 4) {
            this.cost = 225;
            this.damage = 10; // passive AoE damage
            this.health = 200;
            this.maxHealth = 200;
            this.aoeCooldown = 0;
            this.aoeCooldownTime = 120;
        } else if (this.chosenDefender === 5) {
            this.cost = 350;
            this.damage = 65;
            this.shootRate = 250;
            this.health = 200;
            this.maxHealth = 200;
            this.attackCooldown = 0;
            this.attackCooldownTime = 250; // ~2.3 seconds between shots
        }

        this.resourceDropCooldown = 0; // Cooldown for resource drop
    }
    draw() {
        // Draw enhanced health bar
        this.drawHealthBar();
        
        // Draw damage/heal flash effects
        if (this.damageFlash > 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            this.damageFlash--;
        }
        
        if (this.healFlash > 0) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            this.healFlash--;
        }

        // Draw cooldown indicator
        if (!this.canAttack) {
            const cooldownProgress = 1 - (this.placementCooldown / this.placementCooldownTime);
            const barWidth = this.width * cooldownProgress;
            
            // Cooldown background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(this.x, this.y - 15, this.width, 10);
            
            // Cooldown progress bar
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x, this.y - 15, barWidth, 10);
            
            // Cooldown text
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Planting...', this.x + this.width/2, this.y - 20);
        }

        if (this.chosenDefender === 1) {
        ctx.drawImage(defenderChinchou, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                      this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);

    } else if (this.chosenDefender === 2) {
        ctx.drawImage(defenderSeadra, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                      this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);

    } else if (this.chosenDefender === 3) {
        ctx.drawImage(defenderCorsola, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                      this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);
    } else if (this.chosenDefender === 4) {
        this.pulses.forEach(pulse => {
            ctx.beginPath();
            ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 0, 255, ${pulse.alpha})`; // blue pulse
            ctx.lineWidth = 5;
            ctx.stroke();
        });
        
        ctx.drawImage(defenderLumineon, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                  this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);
    } else if (this.chosenDefender === 5) {
        ctx.drawImage(defenderClawitzer, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                  this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);
    }
}
    
    drawHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = this.healthBarWidth * healthPercent;
        
        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(this.x, this.y, this.healthBarWidth, this.healthBarHeight);
        
        // Health bar fill
        if (healthPercent > 0.6) {
            ctx.fillStyle = '#00ff00'; // Green for high health
        } else if (healthPercent > 0.3) {
            ctx.fillStyle = '#ffff00'; // Yellow for medium health
        } else {
            ctx.fillStyle = '#ff0000'; // Red for low health
        }
        ctx.fillRect(this.x, this.y, barWidth, this.healthBarHeight);
        
        // Health bar border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.healthBarWidth, this.healthBarHeight);
        
        // Health text
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.health) + '/' + this.maxHealth, this.x + this.width/2, this.y - 18);
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.damageFlash = 10; // Flash red for 10 frames
        
        // Create damage number effect
        floatingMessages.push(new FloatingMessage('-' + amount, this.x + this.width/2, this.y - 30, 16, 'red'));
        
        // Screen shake effect for heavy damage
        if (amount > 20) {
            this.screenShake = 5;
        }
    }
    
    heal(amount) {
        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        const actualHeal = this.health - oldHealth;
        
        if (actualHeal > 0) {
            this.healFlash = 10; // Flash green for 10 frames
            floatingMessages.push(new FloatingMessage('+' + actualHeal, this.x + this.width/2, this.y - 30, 16, 'green'));
        }
    }
    update() {
        if (frame % 8 === 0) {
            if (this.frameX < this.maxFrame) {
                this.frameX++;
            } else {
                this.frameX = this.minFrame;
            }
        }

        // Handle placement cooldown (Plants vs Zombies style)
        if (this.placementCooldown > 0) {
            this.placementCooldown--;
            if (this.placementCooldown === 0) {
                this.canAttack = true;
                // Show "Ready!" message
                floatingMessages.push(new FloatingMessage('Ready!', this.x + this.width/2, this.y - 20, 20, 'green'));
            }
        }
        
        if (this.chosenDefender === 1) {
            // Morelull: resource generator with random timings
            this.resourceDropCooldown++;

            if (this.resourceDropCooldown >= this.nextResourceDrop && score < winningScore && this.canAttack) {
                let random = Math.random();
                let amount = random < 0.2 ? 75 : 25;
                let width = random < 0.2 ? 45 : 30;
                let height = random < 0.2 ? 45 : 30;
                let color = random < 0.2 ? 'gold' : 'purple';

                resources.push({
                    amount: amount, // 20% chance for 75, else 25
                    x: this.x + this.width / 2 - 15,
                    y: this.y + this.height / 2 - 15,
                    width: width,
                    height: height,

                    draw: function() {
                        ctx.fillStyle = color;
                        ctx.fillRect(this.x, this.y, this.width, this.height);
                        ctx.fillStyle = 'white';
                        ctx.font = '20px Arial';
                        ctx.fillText(this.amount, this.x + 5, this.y + 20);
                    }
                });

                floatingMessages.push(
                    new FloatingMessage(random < 0.2 ? '75' : '25', this.x + this.width / 2, this.y, 20, 'gold')
                );

                // reset timer and roll a new random delay
                this.resourceDropCooldown = 0;
                if (this.isFirstDrop) {
                    // after first sparkle, go back to slower cycle
                    this.isFirstDrop = false;
                    this.nextResourceDrop = Math.floor(Math.random() * 1200 + 1200); 
                    // ~16–33s
                } else {
                    // normal random cycle
                    this.nextResourceDrop = Math.floor(Math.random() * 1200 + 1200);
                }
            }

        } else if (this.chosenDefender === 2) {
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
        
                // Check if enemy is in the same row
                if (enemy.y === this.y) {
                    // Check if enemy is within 2 tiles in front
                        // Attack if cooldown ready and can attack
                        if (this.shooting && this.canAttack) {
                            this.timer++;
                            // Oddish fires projectiles
                            if (this.timer % this.attackCooldownTime === 0) {
                                projectiles.push(new waterProjectile(this.x + 70, this.y + 50, this.damage));
                                this.timer = 0;
                            }
                        } else {
                            this.timer = 0;
                        }
                        break; // only attack one enemy at a time
                }
            }
        } else if (this.chosenDefender === 3) {
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
        
                // Check if enemy is in the same row
                if (enemy.y === this.y) {
                    // Check if enemy is within 3 tiles in front
                    let distance = enemy.x - this.x;
                    if (distance > 0 && distance <= this.attackRange) {
                        // Attack if cooldown ready and can attack
                        if (this.shooting && this.canAttack) {
                            this.timer++;
                            // Oddish fires projectiles
                            if (this.timer % this.attackCooldownTime === 0) {
                                projectiles.push(new bubbleProjectile(this.x + 70, this.y + 50, this.damage));
                                this.timer = 0;
                            }
                        } else {
                            this.timer = 0;
                        }
                        break; // only attack one enemy at a time
                    }
                }
            }
        } else if (this.chosenDefender === 4) { 
            this.aoeCooldown++;
        
            if (this.aoeCooldown >= this.aoeCooldownTime && this.canAttack) {
                this.aoeCooldown = 0;
        
                // Stun AoE
                enemies.forEach(enemy => {
                        enemy.stun(600); // stun for 3 seconds (60fps * 3)
                });
        
                // Add pulse effect
                // Add pulse effect
                    this.pulses.push({
                        x: this.x + this.width / 2,
                        y: this.y + this.height / 2,
                        radius: 10,
                        alpha: 1,
                    });

                    // 🌟 Add screen flash effect
                    screenFlashes.push(new ScreenFlash('rgba(173,216,230,1)', 40));
        
                // 💥 Remove this defender from the game
                const index = defenders.indexOf(this);
                if (index > -1) {
                    defenders.splice(index, 1);
                }
            }
        
            // Update pulses
            this.pulses.forEach(pulse => {
                pulse.radius += 5;
                pulse.alpha -= 0.03;
            });
        
            this.pulses = this.pulses.filter(p => p.alpha > 0);
        } else if (this.chosenDefender === 5) {
            if (this.shooting) {
                this.timer++;
                if (this.timer % this.shootRate === 0) {
                    projectiles.push(new pulseProjectile(this.x + 70, this.y + 40, this.damage));
                }
            } else {
                this.timer = 0;
            }
        }
    }
}

function handleDefenders() {
    for (let i = 0; i < defenders.length; i++) {
        const defender = defenders[i];
        defender.draw();
        defender.update();

        // Shooting state
        defender.shooting = enemyPositions.includes(defender.y);

        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];

            if (collision(defender, enemy)) {
                if (enemy.stunned) {
                    enemy.movement = 0;      // stay stopped
                    enemy.attackTimer = 0;   // reset attack so no damage
                    continue;                // skip attacking while stunned
                }
            
                enemy.movement = 0; // stop moving when attacking
            
                enemy.attackTimer++;
                if (enemy.attackTimer >= enemy.attackInterval) {
                    defender.takeDamage(enemy.damage);
                    enemy.attackTimer = 0;
                }

                if (defender.health <= 0) {
                    defenders.splice(i, 1);
                    i--;
                    enemy.movement = enemy.speed; // resume moving after killing defender
                    break;
                }
            }
        }
    }

    // After all defenders processed, move enemies that aren't colliding
    for (let j = 0; j < enemies.length; j++) {
        let isColliding = false;
        for (let i = 0; i < defenders.length; i++) {
            if (collision(defenders[i], enemies[j])) {
                isColliding = true;
                break;
            }
        }
        if (!isColliding) {
            enemies[j].movement = enemies[j].speed;
            enemies[j].attackTimer = 0;
        }
    }
}

const card1 = {
    x: 10,
    y: 10,
    width: 70,
    height: 85
}

const card2 = {
    x: 90,
    y: 10,
    width: 70,
    height: 85
}

const card3 = {
    x: 170,
    y: 10,
    width: 70,
    height: 85
};

const card4 = {
    x: 250,
    y: 10,
    width: 70,
    height: 85
};

const card5 = {
    x: 330,
    y: 10,
    width: 70,
    height: 85
};

function chooseDefender() {
    let card1stroke = "black";
    let card2stroke = "black";
    let card3stroke = "black";
    let card4stroke = "black";
    let card5stroke = "black";

    if (chosenDefender === 1) card1stroke = 'yellow';
    if (chosenDefender === 2) card2stroke = 'yellow';
    if (chosenDefender === 3) card3stroke = 'yellow';
    if (chosenDefender === 4) card4stroke = 'yellow';
    if (chosenDefender === 5) card5stroke = 'yellow';
    
    // Check cooldown status for visual feedback
    const card1OnCooldown = plantingCooldowns[1].cooldown > 0;
    const card2OnCooldown = plantingCooldowns[2].cooldown > 0;
    const card3OnCooldown = plantingCooldowns[3].cooldown > 0;
    const card4OnCooldown = plantingCooldowns[4].cooldown > 0;
    const card5OnCooldown = plantingCooldowns[5].cooldown > 0;

    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = card1stroke;
    ctx.strokeRect(card1.x, card1.y, card1.width, card1.height);
    ctx.fillRect(card1.x, card1.y, card1.width, card1.height);
    ctx.drawImage(defenderChinchou, 0, 0, 64, 64, -3, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 50", card1.x + 5, card1.y + card1.height - 8);
    
    // Draw cooldown overlay if on cooldown
    if (card1OnCooldown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(card1.x, card1.y, card1.width, card1.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const remainingTime = Math.ceil(plantingCooldowns[1].cooldown / 60);
        ctx.fillText(remainingTime + 's', card1.x + card1.width/2, card1.y + card1.height/2);
        ctx.textAlign = 'left';
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = card2stroke;
    ctx.strokeRect(card2.x, card2.y, card2.width, card2.height);
    ctx.fillRect(card2.x, card2.y, card2.width, card2.height);
    ctx.drawImage(defenderSeadra, 0, 0, 64, 64, 75, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 125", card2.x + 5, card2.y + card2.height - 8);
    
    // Draw cooldown overlay if on cooldown
    if (card2OnCooldown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(card2.x, card2.y, card2.width, card2.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const remainingTime = Math.ceil(plantingCooldowns[2].cooldown / 60);
        ctx.fillText(remainingTime + 's', card2.x + card2.width/2, card2.y + card2.height/2);
        ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = card3stroke;
    ctx.strokeRect(card3.x, card3.y, card3.width, card3.height);
    ctx.fillRect(card3.x, card3.y, card3.width, card3.height);
    ctx.drawImage(defenderCorsola, 0, 0, 64, 64, 160, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 75", card3.x + 5, card3.y + card3.height - 8);
    
    // Draw cooldown overlay if on cooldown
    if (card3OnCooldown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(card3.x, card3.y, card3.width, card3.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const remainingTime = Math.ceil(plantingCooldowns[3].cooldown / 60);
        ctx.fillText(remainingTime + 's', card3.x + card3.width/2, card3.y + card3.height/2);
        ctx.textAlign = 'left';
    }

    // Draw Ferroseed card
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = card4stroke;
    ctx.strokeRect(card4.x, card4.y, card4.width, card4.height);
    ctx.fillRect(card4.x, card4.y, card4.width, card4.height);
    ctx.drawImage(defenderLumineon, 0, 0, 64, 64, 245, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 225", card4.x + 5, card4.y + card4.height - 8);
    
    // Draw cooldown overlay if on cooldown
    if (card4OnCooldown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(card4.x, card4.y, card4.width, card4.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const remainingTime = Math.ceil(plantingCooldowns[4].cooldown / 60);
        ctx.fillText(remainingTime + 's', card4.x + card4.width/2, card4.y + card4.height/2);
        ctx.textAlign = 'left';
    }

    // draw Tropius card
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = card5stroke;
    ctx.strokeRect(card5.x, card5.y, card5.width, card5.height);
    ctx.fillRect(card5.x, card5.y, card5.width, card5.height);
    ctx.drawImage(defenderClawitzer, 0, 0, 64, 64, 325, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 350", card5.x + 5, card5.y + card5.height - 8);
    
    // Draw cooldown overlay if on cooldown
    if (card5OnCooldown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(card5.x, card5.y, card5.width, card5.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const remainingTime = Math.ceil(plantingCooldowns[5].cooldown / 60);
        ctx.fillText(remainingTime + 's', card5.x + card5.width/2, card5.y + card5.height/2);
        ctx.textAlign = 'left';
    }
}

//FLoating Message
const floatingMessages = [];
class FloatingMessage {
    constructor(value, x, y, size, color) {
        this.value = value;
        this.x = x;
        this.y = y;
        this.size = size;
        this.lifeSpan = 0;
        this.color = color;
        this.opacity = 1;
        this.maxLifeSpan = 120; // Increased duration
        this.velocityX = (Math.random() - 0.5) * 2; // Random horizontal movement
        this.velocityY = -1; // Upward movement
        this.gravity = 0.05; // Gravity effect
        this.bounce = 0.7; // Bounce effect
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += this.gravity;
        
        // Bounce off ground
        if (this.y > 600) {
            this.y = 600;
            this.velocityY = -this.velocityY * this.bounce;
        }
        
        this.lifeSpan++;
        if (this.opacity > 0.01) {
            this.opacity -= 0.02;
        }
    }
    
    draw() {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = this.size + 'px Arial';
        ctx.textAlign = 'center';
        
        // Add shadow for better visibility
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.fillText(this.value, this.x, this.y);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}

class ScreenFlash {
    constructor(color = 'rgba(173,216,230,1)', duration = 30) { 
        // default: bright light blue flash, ~0.5 sec @ 60fps
        this.color = color;
        this.alpha = 1;
        this.duration = duration;
        this.timer = 0;
    }
    update() {
        this.timer++;
        this.alpha = 1 - this.timer / this.duration; // fade out
    }
    draw() {
        ctx.fillStyle = this.color.replace('1)', this.alpha + ')'); 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function handleFloatingMessages() {
    for (let i = 0; i < floatingMessages.length; i++) {
        floatingMessages[i].update();
        floatingMessages[i].draw();
        if (floatingMessages[i].lifeSpan > floatingMessages[i].maxLifeSpan) {
            floatingMessages.splice(i, 1); // Remove message after its lifespan
            i--; // Adjust index after removal
        }
    }
}

//enemies
const enemyTypes = [];
const enemyFrillishM = new Image();
enemyFrillishM.src = 'enemyFrillishM.png'; // Example enemy image
enemyTypes.push(enemyFrillishM);

const enemyFrillishF = new Image();
enemyFrillishF.src = 'enemyFrillishF.png'; // Example enemy image
enemyTypes.push(enemyFrillishF);

const enemyDewpider = new Image();
enemyDewpider.src = 'enemyDewpider.png';
enemyTypes.push(enemyDewpider);

const enemyMareanie = new Image();
enemyMareanie.src = 'enemyMareanie.png';
enemyTypes.push(enemyMareanie);

const enemyWishiwashi = new Image();
enemyWishiwashi.src = 'enemyWishiwashi.png'; // Example enemy image
enemyTypes.push(enemyWishiwashi);

const enemyToxapex = new Image();
enemyToxapex.src = 'enemyToxapex.png';
enemyTypes.push(enemyToxapex);

const enemyBruxish = new Image();
enemyBruxish.src = 'enemyBruxish.png'; // Example enemy image
enemyTypes.push(enemyBruxish);

const enemyCarvanha = new Image();
enemyCarvanha.src = 'enemyCarvanha.png'; // Example enemy image
enemyTypes.push(enemyCarvanha);

const enemyJellicentM = new Image();
enemyJellicentM.src = 'enemyJellicentM.png';
enemyTypes.push(enemyJellicentM);

const enemyJellicentF = new Image();
enemyJellicentF.src = 'enemyJellicentF.png'; // Example enemy image
enemyTypes.push(enemyJellicentF);

const enemySharpedo = new Image();
enemySharpedo.src = 'enemySharpedo.png'; // Example enemy image
enemyTypes.push(enemySharpedo);

const enemyDhelmise = new Image();
enemyDhelmise.src = 'enemyDhelmise.png'; // Example enemy image
enemyTypes.push(enemyDhelmise);

const enemyGyarados = new Image();
enemyGyarados.src = 'enemyGyarados.png';
enemyTypes.push(enemyGyarados);

const enemyKyogre = new Image();
enemyKyogre.src = 'enemyKyogre.png'; // Example enemy image
enemyTypes.push(enemyKyogre);

class Enemy {
    constructor(verticalPosition) {
        this.x = canvas.width;
        this.y = verticalPosition;
        this.width = cellSize - cellGap * 2;
        this.height = cellSize - cellGap * 2;
        this.stunned = false;
        this.stunTimer = 0;

        // ===== Enemy Selection =====
        const dewpiderThreshold = winningScore * 0.005;
        const mareanieThreshold = winningScore * 0.009;
        const wishiwashiThreshold = winningScore * 0.015;
        const toxapexThreshold = winningScore * 0.07;
        const bruxishThreshold = winningScore * 0.095;
        const carvanhaThreshold = winningScore * 0.12;
        const jellicentThreshold = winningScore * 0.15;
        const dhelmiseThreshold = winningScore * 0.22;
        const sharpedoThreshold = winningScore * 0.30;
        const gyaradosThreshold = winningScore * 0.40;
        const kyogreThreshold = winningScore * 0.80;

        if (score >= kyogreThreshold) {
            // All enemies can spawn now
            const rand = Math.random();
            if (rand < 0.05) this.enemyType = enemyFrillishM;
            else if (rand < 0.10) this.enemyType = enemyFrillishF;
            else if (rand < 0.15) this.enemyType = enemyDewpider;
            else if (rand < 0.25) this.enemyType = enemyMareanie;
            else if (rand < 0.35) this.enemyType = enemyWishiwashi;
            else if (rand < 0.45) this.enemyType = enemyToxapex;
            else if (rand < 0.55) this.enemyType = enemyBruxish;
            else if (rand < 0.60) this.enemyType = enemyCarvanha;
            else if (rand < 0.72) this.enemyType = enemyJellicentM;
            else if (rand < 0.84) this.enemyType = enemyJellicentF;
            else if (rand < 0.91) this.enemyType = enemyDhelmise;
            else if (rand < 0.95) this.enemyType = enemySharpedo;
            else if (rand < 0.99) this.enemyType = enemyGyarados;
            else this.enemyType = enemyKyogre;
        } else if (score >= gyaradosThreshold) {
            const rand = Math.random();
            if (rand < 0.05) this.enemyType = enemyFrillishM;
            else if (rand < 0.10) this.enemyType = enemyFrillishF;
            else if (rand < 0.15) this.enemyType = enemyDewpider;
            else if (rand < 0.25) this.enemyType = enemyMareanie;
            else if (rand < 0.35) this.enemyType = enemyWishiwashi;
            else if (rand < 0.45) this.enemyType = enemyToxapex;
            else if (rand < 0.55) this.enemyType = enemyBruxish;
            else if (rand < 0.60) this.enemyType = enemyCarvanha;
            else if (rand < 0.72) this.enemyType = enemyJellicentM;
            else if (rand < 0.84) this.enemyType = enemyJellicentF;
            else if (rand < 0.91) this.enemyType = enemyDhelmise;
            else if (rand < 0.95) this.enemyType = enemySharpedo;
            else this.enemyType = enemyGyarados;
        } else if (score >= sharpedoThreshold) {
            const rand = Math.random();
            if (rand < 0.05) this.enemyType = enemyFrillishM;
            else if (rand < 0.10) this.enemyType = enemyFrillishF;
            else if (rand < 0.15) this.enemyType = enemyDewpider;
            else if (rand < 0.25) this.enemyType = enemyMareanie;
            else if (rand < 0.35) this.enemyType = enemyWishiwashi;
            else if (rand < 0.45) this.enemyType = enemyToxapex;
            else if (rand < 0.55) this.enemyType = enemyBruxish;
            else if (rand < 0.60) this.enemyType = enemyCarvanha;
            else if (rand < 0.72) this.enemyType = enemyJellicentM;
            else if (rand < 0.84) this.enemyType = enemyJellicentF;
            else if (rand < 0.91) this.enemyType = enemyDhelmise;
            else this.enemyType = enemySharpedo;
        } else if (score >= dhelmiseThreshold) {
            const rand = Math.random();
            if (rand < 0.05) this.enemyType = enemyFrillishM;
            else if (rand < 0.10) this.enemyType = enemyFrillishF;
            else if (rand < 0.15) this.enemyType = enemyDewpider;
            else if (rand < 0.25) this.enemyType = enemyMareanie;
            else if (rand < 0.35) this.enemyType = enemyWishiwashi;
            else if (rand < 0.45) this.enemyType = enemyToxapex;
            else if (rand < 0.54) this.enemyType = enemyBruxish;
            else if (rand < 0.67) this.enemyType = enemyCarvanha;
            else if (rand < 0.80) this.enemyType = enemyJellicentM;
            else if (rand < 0.90) this.enemyType = enemyJellicentF;
            else this.enemyType = enemyDhelmise;
        } else if (score >= jellicentThreshold) {
            const rand = Math.random();
            if (rand < 0.10) this.enemyType = enemyFrillishM;
            else if (rand < 0.20) this.enemyType = enemyFrillishF;
            else if (rand < 0.30) this.enemyType = enemyDewpider;
            else if (rand < 0.40) this.enemyType = enemyMareanie;
            else if (rand < 0.50) this.enemyType = enemyWishiwashi;
            else if (rand < 0.60) this.enemyType = enemyToxapex;
            else if (rand < 0.70) this.enemyType = enemyBruxish;
            else if (rand < 0.80) this.enemyType = enemyCarvanha;
            else if (rand < 0.90) this.enemyType = enemyJellicentM;
            else this.enemyType = enemyJellicentF;
        } else if (score >= carvanhaThreshold) {
            const rand = Math.random();
            if (rand < 0.05) this.enemyType = enemyFrillishM;
            else if (rand < 0.10) this.enemyType = enemyFrillishF;
            else if (rand < 0.20) this.enemyType = enemyDewpider;
            else if (rand < 0.36) this.enemyType = enemyMareanie;
            else if (rand < 0.49) this.enemyType = enemyWishiwashi;
            else if (rand < 0.62) this.enemyType = enemyToxapex;
            else if (rand < 0.85) this.enemyType = enemyBruxish;
            else this.enemyType = enemyCarvanha;
        } else if (score >= bruxishThreshold) {
            const rand = Math.random();
            if (rand < 0.10) this.enemyType = enemyFrillishM;
            else if (rand < 0.20) this.enemyType = enemyFrillishF;
            else if (rand < 0.40) this.enemyType = enemyDewpider;
            else if (rand < 0.55) this.enemyType = enemyMareanie;
            else if (rand < 0.70) this.enemyType = enemyWishiwashi;
            else if (rand < 0.85) this.enemyType = enemyToxapex;
            else this.enemyType = enemyBruxish;
        } else if (score >= toxapexThreshold) {
            const rand = Math.random();
            if (rand < 0.15) this.enemyType = enemyFrillishM;
            else if (rand < 0.30) this.enemyType = enemyFrillishF;
            else if (rand < 0.50) this.enemyType = enemyDewpider;
            else if (rand < 0.65) this.enemyType = enemyMareanie;
            else if (rand < 0.80) this.enemyType = enemyWishiwashi;
            else this.enemyType = enemyToxapex;
        } else if (score >= wishiwashiThreshold) {
            const rand = Math.random();
            if (rand < 0.15) this.enemyType = enemyFrillishM;
            else if (rand < 0.30) this.enemyType = enemyFrillishF;
            else if (rand < 0.60) this.enemyType = enemyDewpider;
            else if (rand < 0.80) this.enemyType = enemyMareanie;
            else this.enemyType = enemyWishiwashi;
        } else if (score >= mareanieThreshold) {
            const rand = Math.random();
            if (rand < 0.25) this.enemyType = enemyFrillishM;
            else if (rand < 0.50) this.enemyType = enemyFrillishF;
            else if (rand < 0.75) this.enemyType = enemyDewpider;
            else this.enemyType = enemyMareanie;
        } else if (score >= dewpiderThreshold) {
            const rand = Math.random();
            if (rand < 0.33) this.enemyType = enemyFrillishM;
            else if (rand < 0.66) this.enemyType = enemyFrillishF;
            else this.enemyType = enemyDewpider;
        } else {
            if (Math.random() < 0.5) this.enemyType = enemyFrillishM;
            else this.enemyType = enemyFrillishF;
        }

        // ===== Stats per Enemy =====
        if (this.enemyType === enemyFrillishM) {
            this.health = 200;
            this.damage = 30;
            this.attackInterval = 145;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.4;

        } else if (this.enemyType === enemyFrillishF) {
            this.health = 150;
            this.damage = 40;
            this.attackInterval = 140;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.55;

        } else if (this.enemyType === enemyDewpider) {
            this.health = 225;
            this.damage = 15;
            this.attackInterval = 45;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.6;

        } else if (this.enemyType === enemyMareanie) {
            this.health = 400;         // Quite tanky
            this.damage = 8;          // Low damage
            this.attackInterval = 30; 
            this.speed = (Math.random() * 0.2 + 0.6) * 0.3; // Fast

        } else if (this.enemyType === enemyWishiwashi) {
            this.health = 150;         // Tanky
            this.damage = 20;          // Medium damage
            this.attackInterval = 60; // Slower attack
            this.speed = (Math.random() * 0.25 + 0.5);

        } else if (this.enemyType === enemyToxapex) {
            this.health = 850;        // Early game enemy
            this.damage = 30;
            this.attackInterval = 150;
            this.speed = (Math.random() * 0.35 + 0.65) * 0.35;

        } else if (this.enemyType === enemyBruxish) {
            this.health = 400;        // Extremely tanky
            this.damage = 50;
            this.attackInterval = 190;
            this.speed = (Math.random() * 0.25 + 0.6); // Fast

        } else if (this.enemyType === enemyCarvanha) {
            this.health = 350;        // Extremely tanky
            this.damage = 25;
            this.attackInterval = 85;
            this.speed = (Math.random() * 0.1 + 0.6); // Fast

        } else if (this.enemyType === enemyJellicentM) {
            this.health = 600;        // Extremely tanky
            this.damage = 40;
            this.attackInterval = 140;
            this.speed = (Math.random() * 0.3 + 0.6) * 0.2;

        } else if (this.enemyType === enemyJellicentF) {
            this.health = 700;        // Extremely tanky
            this.damage = 25;
            this.attackInterval = 115;
            this.speed = (Math.random() * 0.3 + 0.6) * 0.25;

        } else if (this.enemyType === enemySharpedo) {
            this.health = 650;        // Extremely tanky
            this.damage = 100;
            this.attackInterval = 240;
            this.speed = (Math.random() * 0.2 + 0.6);

        } else if (this.enemyType === enemyDhelmise) {
            this.health = 100;        // Extremely tanky
            this.damage = 10;
            this.attackInterval = 50;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.15;

        } else if (this.enemyType === enemyGyarados) {
            this.health = 1000;        // Extremely tanky
            this.damage = 100;
            this.attackInterval = 200;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.15;

        } else if (this.enemyType === enemyKyogre) {
            this.health = 5550;        // Extremely tanky
            this.damage = 100;
            this.attackInterval = 200;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.15;

        } else {
            this.health = 100;
            this.damage = 20;
            this.attackInterval = 50;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.5;
        }

        this.movement = this.speed;
        this.attackTimer = 0;
        this.maxHealth = this.health;
        this.frameX = 0;
        this.frameY = 0;
        this.minFrame = 0;
        this.maxFrame = 3;
        this.spriteWidth = 64;
        this.spriteHeight = 64;
        
        // Enhanced health system
        this.damageFlash = 0;
        this.healthBarWidth = this.width;
        this.healthBarHeight = 10;
        this.screenShake = 0;
    }
    
    update() {
        if (this.stunned) {
            this.stunTimer--;
            if (this.stunTimer <= 0) {
                this.stunned = false;
            }
            return; // skip movement while stunned
        }

        this.x -= this.movement;
        if (frame % 20 === 0) { // Update frame every 10 frames for animation
            if (this.frameX < this.maxFrame) {
                this.frameX++;
            } else {
                this.frameX = this.minFrame; // Reset frame to the first frame
            }
        }
    }
    draw() {
        // Apply screen shake
        const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * 4 : 0;
        const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * 4 : 0;
        
        // Draw enhanced health bar
        this.drawHealthBar();
        
        // Draw damage flash effects
        if (this.damageFlash > 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.fillRect(this.x + shakeX, this.y + shakeY, this.width, this.height);
            this.damageFlash--;
        }

        if (this.stunned) {
            ctx.fillStyle = 'rgba(0,0,255,0.5)'; // blue overlay
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        // Draw enemy sprite with shake
        ctx.drawImage(this.enemyType, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                      this.spriteWidth, this.spriteHeight, this.x + shakeX, this.y + shakeY, this.width, this.height);
        
        // Reduce screen shake
        if (this.screenShake > 0) this.screenShake--;
    }
    
    drawHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = this.healthBarWidth * healthPercent;
        
        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(this.x, this.y, this.healthBarWidth, this.healthBarHeight);
        
        // Health bar fill
        if (healthPercent > 0.6) {
            ctx.fillStyle = '#00ff00'; // Green for high health
        } else if (healthPercent > 0.3) {
            ctx.fillStyle = '#ffff00'; // Yellow for medium health
        } else {
            ctx.fillStyle = '#ff0000'; // Red for low health
        }
        ctx.fillRect(this.x, this.y, barWidth, this.healthBarHeight);
        
        // Health bar border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.healthBarWidth, this.healthBarHeight);
        
        // Health text
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.health) + '/' + this.maxHealth, this.x + this.width/2, this.y - 13);
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.damageFlash = 8; // Flash red for 8 frames
        
        // Create damage number effect
        floatingMessages.push(new FloatingMessage('-' + amount, this.x + this.width/2, this.y - 25, 14, 'red'));
        
        // Screen shake effect for heavy damage
        if (amount > 15) {
            this.screenShake = 3;
        }
    }

    stun(duration) {
        this.stunned = true;
        this.stunTimer = duration;
    }
}

function handleEnemies() {
    let elapsedTime = (Date.now() - gameStartTime) / 1000; // in seconds
    for (let i = 0; i < enemies.length; i++) {
        enemies[i].update();
        enemies[i].draw();
        if (enemies[i].x < 0) {
            gameOver = true; // Game over if an enemy reaches the left side
        }
        if (enemies[i].health <= 0) {
            indScore = enemies[i].maxHealth/75; // Resources gained for defeating an enemy
            gainedScore += Math.floor(indScore + (0.1*(numberOfResources*(enemies[i].maxHealth)/score)));
            floatingMessages.push(new FloatingMessage('+' + gainedScore, enemies[i].x, enemies[i].y, 30, 'green'));
            score += gainedScore; // Increase score
            const findThisIndex = enemyPositions.indexOf(enemies[i].y);
            enemyPositions.splice(findThisIndex, 1); // Remove enemy position
            enemies.splice(i, 1); // Remove enemy if health is zero
            i--; // Adjust index after removal
        }
    }
    
    if (elapsedTime >= 20 && frame % enemiesInterval === 0 && score < winningScore) {
    let verticalPosition = Math.floor(Math.random() * 5 + 1) * cellSize + cellGap;
    const newEnemy = new Enemy(verticalPosition);

    if (newEnemy.enemyType === enemyCarvanha) {
        // Spawn the first Parasect right away
        enemies.push(newEnemy);
        enemyPositions.push(verticalPosition);

        // Queue 2 more Parasects with small delays
        for (let k = 1; k <= 2; k++) {
            let delay = k * 60; // ~1 second apart if 60fps

            // Choose adjacent lane if possible
            let possibleLanes = [];
            let currentLane = verticalPosition;
            if (currentLane > cellSize * 2) possibleLanes.push(currentLane - cellSize);
            if (currentLane < canvas.height - cellSize * 2) possibleLanes.push(currentLane + cellSize);

            let lane = possibleLanes.length > 0 
                ? possibleLanes[Math.floor(Math.random() * possibleLanes.length)] 
                : currentLane;

            parasectSpawnQueue.push({
                frame: frame + delay,
                position: lane
            });
        }
    } else {
        enemies.push(newEnemy);
        enemyPositions.push(verticalPosition);
    }

    if (enemiesInterval > 200) {
        enemiesInterval -= 70;
    }
}

// Process queued Parasects
for (let i = parasectSpawnQueue.length - 1; i >= 0; i--) {
    if (frame >= parasectSpawnQueue[i].frame) {
        enemies.push(new Enemy(parasectSpawnQueue[i].position));
        enemyPositions.push(parasectSpawnQueue[i].position);
        parasectSpawnQueue.splice(i, 1); // remove after spawning
    }
}

}

//resources
const amounts = [50, 50, 50, 50, 50, 50, 50, 50, 50, 75];

class Resource {
    constructor() {
        this.x = Math.random() * (canvas.width - cellSize);
        this.y = Math.floor(Math.random() * 5 + 1) * cellSize + 25; // Ensure resources are below the controls bar
        this.width = cellSize * 0.6;
        this.height = cellSize * 0.6;
        this.amount = amounts[Math.floor(Math.random() * amounts.length)];
    }
    draw() {
        ctx.fillStyle = 'gold';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(this.amount, this.x + 10, this.y + 30);
    }
}

function handleResources() {
    let elapsedTime = (Date.now() - gameStartTime) / 1000; // in seconds

    // Only start spawning after 5 seconds have passed
    if (elapsedTime >= 5 && frame % 1500 === 0 && score < winningScore) {
        resources.push(new Resource());
    }

    for (let i = 0; i < resources.length; i++) {
        resources[i].draw();
        if (resources[i] && mouse.x && mouse.y && collision(resources[i], mouse)) {
            floatingMessages.push(new FloatingMessage('+' + resources[i].amount, mouse.x, mouse.y, 30, 'green'));
            numberOfResources += resources[i].amount;
            resources.splice(i, 1);
            i--;
        }
    }
}

//utilities
function handleGameStatus() {
    ctx.fillStyle = 'black';
    ctx.font = '30px Arial';
    ctx.fillText('Resources: ' + numberOfResources, 500, 40);
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 500, 60);
    if (gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '50px Arial';
        ctx.fillText('Game Over', 135, 300);
    }
    if (score >= winningScore && enemies.length === 0) {
        ctx.fillStyle = 'yellow';
        ctx.font = '50px Arial';
        ctx.fillText('You Win with ' + score + ' points!', 150, 300);
        
        // Save level completion to localStorage
        if (!localStorage.getItem('underwaterLevelCompleted')) {
            localStorage.setItem('underwaterLevelCompleted', 'true');
            localStorage.setItem('underwaterLevelScore', score.toString());
        }
    }
}

canvas.addEventListener('click', function() {
    if (bgMusic.paused) {
        bgMusic.play().catch(err => console.log("Autoplay blocked:", err));
    }
if (collision(mouse, card1)) chosenDefender = 1;
else if (collision(mouse, card2)) chosenDefender = 2;
else if (collision(mouse, card3)) chosenDefender = 3;
else if (collision(mouse, card4)) chosenDefender = 4;
else if (collision(mouse, card5)) chosenDefender = 5;
else {
    const gridPositionX = mouse.x - (mouse.x % cellSize) + cellGap;
    const gridPositionY = mouse.y - (mouse.y % cellSize) + cellGap;
    if (gridPositionY < cellSize) return;
    for (let i = 0; i < defenders.length; i++) {
        if (defenders[i].x === gridPositionX && defenders[i].y === gridPositionY) {
            return;
        }
    }
    // Determine cost based on chosen defender
    let defenderCost = 100;
    if (chosenDefender === 1) defenderCost = 50;
    if (chosenDefender === 2) defenderCost = 125;
    if (chosenDefender === 3) defenderCost = 75;
    if (chosenDefender === 4) defenderCost = 225;
    if (chosenDefender === 5) defenderCost = 350;

    if (numberOfResources >= defenderCost) {
        // Check if this defender type is on cooldown
        if (plantingCooldowns[chosenDefender].cooldown > 0) {
            const remainingTime = Math.ceil(plantingCooldowns[chosenDefender].cooldown / 60);
            floatingMessages.push(new FloatingMessage('Cooldown: ' + remainingTime + 's', mouse.x, mouse.y, 20, 'red'));
        } else {
            defenders.push(new Defender(gridPositionX, gridPositionY));
            numberOfResources -= defenderCost;
            // Start cooldown for this defender type
            plantingCooldowns[chosenDefender].cooldown = plantingCooldowns[chosenDefender].maxCooldown;
        }
    } else {
        floatingMessages.push(new FloatingMessage('Not enough resources!', mouse.x, mouse.y, 20, 'red'));
    }
}});

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height); // Draw background image
    
    // Update planting cooldowns
    for (const type in plantingCooldowns) {
        if (plantingCooldowns[type].cooldown > 0) {
            plantingCooldowns[type].cooldown--;
        }
    }
    
    ctx.fillStyle = 'brown';
    ctx.fillRect(0, 0, controlsBar.width, controlsBar.height, 'black');
    handleGameGrid();
    handleDefenders();
    handleResources();
    handleProjectiles();
    handleEnemies();
    chooseDefender();
    handleGameStatus();
    handleFloatingMessages();// Handle screen flashes
    for (let i = 0; i < screenFlashes.length; i++) {
        screenFlashes[i].update();
        screenFlashes[i].draw();
        if (screenFlashes[i].timer >= screenFlashes[i].duration) {
            screenFlashes.splice(i, 1);
            i--;
        }
    }
    frame++;
    console.log(frame);
    if (!gameOver) requestAnimationFrame(animate);
}
animate();

function collision(first, second) {
    if (!((first.x > second.x + second.width) ||
          (first.x + first.width < second.x) ||
          (first.y > second.y + second.height) ||
          (first.y + first.height < second.y))){
                return true;
          };
}