const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = 900;
canvas.height = 600;

//global variables
const cellSize = 100;
const cellGap = 3;
let numberOfResources = 1000;
let enemiesInterval = 600; // Interval for spawning enemies
let frame = 0;
let gameOver = false;
let gainedResources = 0;
let score = 0;
const winningScore = 5000;

const gameGrid = [];
const defenders = [];
const enemies = [];
const enemyPositions = [];
const projectiles = [];
const resources = [];

//mouse
const mouse = {
    x: 10,
    y: 10,  
    width: 0.1,
    height: 0.1,
};
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
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.power = 20;
        this.speed = 2;
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

function handleProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
        projectiles[i].update();
        projectiles[i].draw();

        for (let j = 0; j < enemies.length; j++) {
            if (enemies[j] && projectiles[i] && collision(projectiles[i], enemies[j])) {
                enemies[j].health -= projectiles[i].power; // Decrease enemy health
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
class Defender {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = cellSize - cellGap * 2;
        this.height = cellSize - cellGap * 2;
        this.shooting = false;
        this.health = 100;
        this.projectiles = [];
        this.timer = 0;
    }
    draw() {
        ctx.fillStyle = 'black';
        ctx.font = '30px Arial';
        ctx.fillText(Math.floor(this.health), this.x + 15, this.y + 30);
    }
    update() {
        if (this.shooting){
        this.timer++;
            if (this.timer % 180 === 0) {
                projectiles.push(new Projectiles(this.x + 70, this.y + 50));
            }
        } else {
            this.timer = 0; // Reset timer if not shooting
        }
    }
}

canvas.addEventListener('click', function() {
    const gridPositionX = mouse.x - (mouse.x % cellSize) + cellGap;
    const gridPositionY = mouse.y - (mouse.y % cellSize) + cellGap;
    if (gridPositionY < cellSize) return;
    for (let i = 0; i < defenders.length; i++) {
        if (defenders[i].x === gridPositionX && defenders[i].y === gridPositionY) {
            return; // Prevent placing a defender on an occupied cell
        }
    }
    let defenderCost = 100;
    if (numberOfResources >= defenderCost) {
        defenders.push(new Defender(gridPositionX, gridPositionY));
        numberOfResources -= defenderCost;
    }
});

function handleDefenders() {
    for (let i = 0; i < defenders.length; i++) {
        defenders[i].draw();
        defenders[i].update();
        if (enemyPositions.indexOf(defenders[i].y) !== -1) {
            defenders[i].shooting = true; // Start shooting if an enemy is in the same vertical position
        } else {
            defenders[i].shooting = false; // Stop shooting if no enemy is in the same
        }
        for (let j = 0; j < enemies.length; j++) {
            if (defenders[1] && collision(defenders[i], enemies[j])) {
                enemies[j].movement = 0; // Stop enemy movement on collision
                defenders[i].health -= 0.05; // Decrease defender health on collision
            }
            if (defenders[i] && defenders[i].health <= 0) {
                defenders.splice(i, 1); // Remove defender if health is zero
                i--; // Adjust index after removal
                enemies[j].movement = enemies[j].speed; // Resume enemy movement
                break; // Exit inner loop to avoid issues with removed defender
                
            }
        }
        /*if (defenders[i].shooting) {
            defenders[i].timer++;
            if (defenders[i].timer % 100 === 0) {
                defenders[i].projectiles.push(new Projectile(defenders[i].x, defenders[i].y));
            }
        }*/
    }
}

//enemies
class Enemy {
    constructor(verticalPosition) {
        this.x = canvas.width;
        this.y = verticalPosition;
        this.width = cellSize - cellGap * 2;
        this.height = cellSize - cellGap * 2;
        this.speed = Math.random() * 0.2 + 1; // Random speed between 0.1 and 0.3
        this.movement = this.speed;
        this.health = 100;
        this.maxHealth = this.health;
    }
    update() {
        this.x -= this.movement;
        if (this.x < 0) {
            this.health = 0; // Enemy reaches the left side of the canvas
        }
    }
    draw() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'black';
        ctx.font = '30px Arial';
        ctx.fillText(Math.floor(this.health), this.x + 15, this.y + 30);
    }
}

function handleEnemies() {
    for (let i = 0; i < enemies.length; i++) {
        enemies[i].update();
        enemies[i].draw();
        if (enemies[i].x < 0) {
            gameOver = true; // Game over if an enemy reaches the left side
        }
        if (enemies[i].health <= 0) {
            gainedResources = enemies[i].maxHealth/4; // Resources gained for defeating an enemy
            score += Math.floor(gainedResources + (numberOfResources*.50)); // Increase score
            numberOfResources += gainedResources; // Add resources to the total
            const findThisIndex = enemyPositions.indexOf(enemies[i].y);
            enemyPositions.splice(findThisIndex, 1); // Remove enemy position
            enemies.splice(i, 1); // Remove enemy if health is zero
            i--; // Adjust index after removal
        }
    }
    
    if (frame % enemiesInterval === 0 && score < winningScore) { // Spawn an enemy every 100 frames
        let verticalPosition = Math.floor(Math.random() * 5 + 1) * cellSize + cellGap;
        enemies.push(new Enemy(verticalPosition));
        enemyPositions.push(verticalPosition);
        if (enemiesInterval > 200) {
            enemiesInterval -= 70; // Increase difficulty by reducing interval
        }
    }
}

//resources
const amounts = [20, 30, 40, 50, 60];

class Resource {
    constructor() {
        this.x = Math.random() * (canvas.width - cellSize);
        this.y = Math.floor(Math.random() * 5 + 1) * cellSize + 25; // Ensure resources are below the controls bar
        this.width = cellSize * 0.6;
        this.height = cellSize * 0.6;
        this.amount = amounts[Math.floor(Math.random() * amounts.length)];
    }
    draw() {
        ctx.fillStyle = 'brown';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(this.amount, this.x + 10, this.y + 30);
    }
}

function handleResources() {
    if (frame % 500 === 0 && score < winningScore) { // Spawn a resource every 300
        resources.push(new Resource());
    }
    for (let i = 0; i < resources.length; i++) {
        resources[i].draw();
        if (resources[i] && mouse.x && mouse.y && collision(resources[i], mouse)) {
            numberOfResources += resources[i].amount; // Add resources to the total
            resources.splice(i, 1); // Remove resource after collection
            i--; // Adjust index after removal
        }
}
}

//utilities
function handleGameStatus() {
    ctx.fillStyle = 'black';
    ctx.font = '30px Arial';
    ctx.fillText('Resources: ' + numberOfResources, 20, 40);
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 20, 60);
    if (gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '50px Arial';
        ctx.fillText('Game Over', 135, 300);
    }
    if (score >= winningScore && enemies.length === 0) {
        ctx.fillStyle = 'green';
        ctx.font = '50px Arial';
        ctx.fillText('You Win with ' + score + ' points!', 150, 300);
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, controlsBar.width, controlsBar.height, 'black');
    handleGameGrid();
    handleDefenders();
    handleResources();
    handleProjectiles();
    handleEnemies();
    handleGameStatus();
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