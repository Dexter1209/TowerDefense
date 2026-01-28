const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = 900;
canvas.height = 600;
const background = new Image();
background.src = 'grass_background.png'; // path to your image

//global variables
const cellSize = 100;
const cellGap = 3;
let numberOfResources = 75;
let enemiesInterval = 1800; // Interval for spawning enemies
let frame = 0;
let gameOver = false;
let indScore = 0; // Individual score for each enemy defeated
let gainedScore = 0;
let score = 100;
const winningScore = 50000;
let chosenDefender = 1;
let gameStartTime = Date.now();

// Background Music
const bgMusic = new Audio('bgm/grass_day.ogg'); // put your file path here
bgMusic.loop = true;   // loop forever
bgMusic.volume = 0.5;  // 0.0 (silent) → 1.0 (full volume)

// Planting cooldown system (Plants vs Zombies style)
const plantingCooldowns = {
    1: { cooldown: 0, maxCooldown: 300 }, // Bellsprout: 5 seconds
    2: { cooldown: 0, maxCooldown: 240 }, // Floette: 4 seconds  
    3: { cooldown: 0, maxCooldown: 420 }, // Carnivine: 7 seconds
    4: { cooldown: 0, maxCooldown: 1020 }, // Ferroseed: 17 seconds
    5: { cooldown: 0, maxCooldown: 540 }  // Tropius: 9 seconds
};

const gameGrid = [];
const defenders = [];
const enemies = [];
const enemyPositions = [];
const projectiles = [];
const resources = [];
let parasectSpawnQueue = []; // queue for delayed Parasect spawns

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
    constructor(x, y, power) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.power = power;
        this.speed = 2.75;
    } 
    update() {
        this.x += this.speed;
    }
    draw() {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
    }
}

class GustProjectile extends Projectiles {
    constructor(x, y, power) {
        super(x, y, power);
        this.width = 15;
        this.height = 15;
        this.speed = 3.75;
    }
    draw() {
        ctx.fillStyle = 'lightblue';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
    }
}

function handleProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
        projectiles[i].update();
        projectiles[i].draw();

        for (let j = 0; j < enemies.length; j++) {
            if (enemies[j] && projectiles[i] && collision(projectiles[i], enemies[j])) {
                enemies[j].takeDamage(projectiles[i].power); // Use new damage method
                
                // Knockback effect for Tropius gust
                if (projectiles[i] instanceof GustProjectile) {
                    if (Math.random() < 0.4) { // 40% chance
                    enemies[j].x += 20; 
                    }
                }

                projectiles.splice(i, 1); // Remove projectile after hit
                i--; // Adjust index after removal
                break; // Exit inner loop to avoid issues with removed projectile
            }
        }
        
        if (projectiles[i] && projectiles[i].x > canvas.width - cellSize) {
            projectiles.splice(i, 1); // Remove projectile if it goes off screen
            i--; // Adjust index after removal
        }
    }
}

//defenders
const defenderBellsprout = new Image();
defenderBellsprout.src = 'defenderBellsprout.png'; // Example enemy image
const defenderFloette = new Image();
defenderFloette.src = 'defenderFloette.png'; // Example enemy image
const defenderCarnivine = new Image();
defenderCarnivine.src = 'defenderCarnivine.png';
const defenderFerroseed = new Image();
defenderFerroseed.src = 'defenderFerroseed.png'; // Ferroseed sprite
const defenderTropius = new Image();
defenderTropius.src = 'defenderTropius.png'; // Tropius sprite

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
            this.cost = 100;
            this.damage = 25; // Bellsprout
            this.health = 100;
            this.maxHealth = 100;
            this.attackCooldown = 0;
            this.attackCooldownTime = 180; // 3 seconds between shots
        } else if (this.chosenDefender === 2) {
            this.cost = 50;
            this.damage = 40; // Floette doesn't shoot, just here for consistency
            this.health = 75;
            this.maxHealth = 75;

            // 🌸 random production interval setup
            this.resourceDropCooldown = 0;
            this.nextResourceDrop = Math.floor(Math.random() * 1200 + 1200);
            this.isFirstDrop = true; // flag to check later
        } else if (this.chosenDefender === 3) {
            this.cost = 150;
            this.damage = 40; // Carnivine (melee)
            this.attackCooldown = 0; // cooldown for melee attacks
            this.attackCooldownTime = 80; // ~1.3 seconds between attacks
            this.attackRange = cellSize * 2; // 2 tiles in front
            this.health = 175;
            this.maxHealth = 175;
            this.whipFrames = 0; // counts how many frames the whip is visible
        } else if (this.chosenDefender === 4) {
            this.cost = 200;
            this.damage = 10; // Very small counter damage
            this.health = 1500; // Tanky
            this.maxHealth = 1500;
            this.counterCooldown = 0; // Prevents constant damage ticks
            this.counterCooldownTime = 100; // Counter attack cooldown
        } else if (this.chosenDefender === 5) {
            this.cost = 275;
            this.damage = 85;   // Heavier than Bellsprout
            this.health = 250;  // Reasonable durability
            this.maxHealth = 250;
            this.shootRate = 350; // Slower fire rate (higher value = slower)
            this.attackCooldown = 0;
            this.attackCooldownTime = 350; // ~5.8 seconds between shots
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
            ctx.drawImage(defenderBellsprout, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                          this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);

        } else if (this.chosenDefender === 2) {
            ctx.drawImage(defenderFloette, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                          this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);

        } else if (this.chosenDefender === 3) {
            ctx.drawImage(defenderCarnivine, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                          this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);

            // Vine whip animation — draw right after an attack
            if (this.whipFrames > 0) {
                ctx.strokeStyle = 'green';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(this.x + this.width, this.y + this.height / 2);
                ctx.lineTo(this.x + this.width + this.attackRange, this.y + this.height / 2);
                ctx.stroke();

                this.whipFrames--; // decrease every frame
            }
        } else if (this.chosenDefender === 4) {
            ctx.drawImage(defenderFerroseed, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
                          this.spriteWidth, this.spriteHeight, this.x, this.y, this.width, this.height);
        } else if (this.chosenDefender === 5) {
            ctx.drawImage(defenderTropius, this.frameX * this.spriteWidth, this.frameY * this.spriteHeight,
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
            if (this.shooting && this.canAttack) {
                this.timer++;
                // Bellsprout fires projectiles
                if (this.timer % this.attackCooldownTime === 0) {
                    projectiles.push(new Projectiles(this.x + 70, this.y + 50, this.damage));
                    this.timer = 0;
                }
            } else {
                this.timer = 0;
            }
        } else if (this.chosenDefender === 2) {
            // Floette: resource generator with random timings
            this.resourceDropCooldown++;

            if (this.resourceDropCooldown >= this.nextResourceDrop && score < winningScore && this.canAttack) {
                resources.push({
                    x: this.x + this.width / 2 - 15,
                    y: this.y + this.height / 2 - 15,
                    width: 30,
                    height: 30,
                    amount: 50,
                    draw: function() {
                        ctx.fillStyle = 'gold';
                        ctx.fillRect(this.x, this.y, this.width, this.height);
                        ctx.fillStyle = 'white';
                        ctx.font = '20px Arial';
                        ctx.fillText(this.amount, this.x + 5, this.y + 20);
                    }
                });

                floatingMessages.push(
                    new FloatingMessage('+50', this.x + this.width / 2, this.y, 20, 'gold')
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
        } else if (this.chosenDefender === 3) {
            // Carnivine melee defender
            if (this.attackCooldown > 0) {
                this.attackCooldown--;
            }

            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
        
                // Check if enemy is in the same row
                if (enemy.y === this.y) {
                    // Check if enemy is within 2 tiles in front
                    let distance = enemy.x - this.x;
                    if (distance > 0 && distance <= this.attackRange) {
                        // Attack if cooldown ready and can attack
                        if (this.attackCooldown === 0 && this.canAttack) {
                            enemy.takeDamage(this.damage); // Use new damage method
                            this.attackCooldown = this.attackCooldownTime; // use the cooldown time
                            this.whipFrames = 10; // trigger animation in draw()
                        }
                        break; // only attack one enemy at a time
                    }
                }
            }
        } else if (this.chosenDefender === 5) {
            if (this.shooting && this.canAttack) {
                this.timer++;
                if (this.timer % this.attackCooldownTime === 0) {
                    projectiles.push(new GustProjectile(this.x + 70, this.y + 40, this.damage));
                    this.timer = 0;
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
                enemy.movement = 0; // stop moving when attacking

                enemy.attackTimer++;
                if (enemy.attackTimer >= enemy.attackInterval) {
                    defender.takeDamage(enemy.damage); // Use new damage method
                    enemy.attackTimer = 0;
                }

                if (defender.chosenDefender === 4) {
                    if (defender.counterCooldown === 0) {
                        enemy.takeDamage(defender.damage); // Use new damage method
                        defender.counterCooldown = 100;
                    }
                }

                if (defender.health <= 0) {
                    defenders.splice(i, 1);
                    i--;
                    enemy.movement = enemy.speed; // resume moving after killing defender
                    break;
                }
            }
        }

        if (defender.chosenDefender === 4 && defender.counterCooldown > 0) {
            defender.counterCooldown--;
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
    ctx.drawImage(defenderBellsprout, 0, 0, 64, 64, -3, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 100", card1.x + 5, card1.y + card1.height - 8);
    
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
    ctx.drawImage(defenderFloette, 0, 0, 64, 64, 75, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 50", card2.x + 5, card2.y + card2.height - 8);
    
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
    ctx.drawImage(defenderCarnivine, 0, 0, 64, 64, 160, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 150", card3.x + 5, card3.y + card3.height - 8);
    
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
    ctx.drawImage(defenderFerroseed, 0, 0, 64, 64, 245, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 75", card4.x + 5, card4.y + card4.height - 8);
    
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
    ctx.drawImage(defenderTropius, 0, 0, 64, 64, 325, 5, 194/2, 194/2);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Cost: 275", card5.x + 5, card5.y + card5.height - 8);
    
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
const enemyElgyem = new Image();
enemyElgyem.src = 'enemyElgyem.png'; // Example enemy image
enemyTypes.push(enemyElgyem);
const enemyGligar = new Image();
enemyGligar.src = 'enemyGligar.png'; // Example enemy image
enemyTypes.push(enemyGligar);
const enemyCrustle = new Image();
enemyCrustle.src = 'enemyCrustle.png'; // Example enemy image
enemyTypes.push(enemyCrustle);
const enemyVenipede = new Image();
enemyVenipede.src = 'enemyVenipede.png';
enemyTypes.push(enemyVenipede);
const enemyParasect = new Image();
enemyParasect.src = 'enemyParasect.png';
enemyTypes.push(enemyParasect);

class Enemy {
    constructor(verticalPosition) {
        this.x = canvas.width;
        this.y = verticalPosition;
        this.width = cellSize - cellGap * 2;
        this.height = cellSize - cellGap * 2;

        // ===== Enemy Selection =====
        const venipedeThreshold = winningScore * 0.10; // 10%
        const parasectThreshold = winningScore * 0.30; // 25%
        const crustleThreshold = winningScore * 0.50; // 40%

        if (score >= crustleThreshold) {
            // All enemies can spawn now
            const rand = Math.random();
            if (rand < 0.3) this.enemyType = enemyElgyem;
            else if (rand < 0.65) this.enemyType = enemyGligar;
            else if (rand < 0.85) this.enemyType = enemyVenipede;
            else if (rand < 0.95) this.enemyType = enemyParasect;
            else this.enemyType = enemyCrustle;
        } else if (score >= parasectThreshold) {
            // Parasect unlocks (in groups of 3)
            if (Math.random() < 0.33) this.enemyType = enemyParasect;
            else if (Math.random() < 0.5) this.enemyType = enemyVenipede;
            else if (Math.random() < 0.75) this.enemyType = enemyElgyem;
            else this.enemyType = enemyGligar;
        } else if (score >= venipedeThreshold) {
            // Venipede unlocks
            if (Math.random() < 0.4) this.enemyType = enemyVenipede;
            else if (Math.random() < 0.7) this.enemyType = enemyElgyem;
            else this.enemyType = enemyGligar;
        } else {
            // Early game – only Elgyem and Gligar
            if (Math.random() < 0.5) this.enemyType = enemyElgyem;
            else this.enemyType = enemyGligar;
        }

        // ===== Stats per Enemy =====
        if (this.enemyType === enemyElgyem) {
            this.health = 100;
            this.damage = 20;
            this.attackInterval = 80;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.35;

        } else if (this.enemyType === enemyGligar) {
            this.health = 200;
            this.damage = 30;
            this.attackInterval = 90;
            this.speed = (Math.random() * 0.2 + 0.6) * 0.45;

        } else if (this.enemyType === enemyVenipede) {
            this.health = 250;         // Quite tanky
            this.damage = 10;          // Low damage
            this.attackInterval = 65; 
            this.speed = (Math.random() * 0.3 + 0.6); // Fast

        } else if (this.enemyType === enemyParasect) {
            this.health = 400;         // Tanky
            this.damage = 35;          // Medium damage
            this.attackInterval = 100;
            this.speed = 0.25;         // Very slow

        } else if (this.enemyType === enemyCrustle) {
            this.health = 1800;        // Extremely tanky
            this.damage = 65;
            this.attackInterval = 200;
            this.speed = (Math.random() * 0.1 + 0.2);

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
    
    if (elapsedTime >= 15 && frame % enemiesInterval === 0 && score < winningScore) {
    let verticalPosition = Math.floor(Math.random() * 5 + 1) * cellSize + cellGap;
    const newEnemy = new Enemy(verticalPosition);

    if (newEnemy.enemyType === enemyParasect) {
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
        if (!localStorage.getItem('grassLevelCompleted')) {
            localStorage.setItem('grassLevelCompleted', 'true');
            localStorage.setItem('grassLevelScore', score.toString());
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
    if (chosenDefender === 1) defenderCost = 100;
    if (chosenDefender === 2) defenderCost = 50;
    if (chosenDefender === 3) defenderCost = 150;
    if (chosenDefender === 4) defenderCost = 75;
    if (chosenDefender === 5) defenderCost = 275;

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
    handleFloatingMessages();
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