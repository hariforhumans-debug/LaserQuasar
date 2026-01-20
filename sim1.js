// --- 0. UI & STYLES ---
const uiHTML = `
<style>
    body { margin: 0; overflow: hidden; background: #111; display: flex; justify-content: center; align-items: center; height: 100vh; }
    canvas { background: #000; border: 4px solid #333; image-rendering: pixelated; box-shadow: 0 0 20px #000; }
    .game-ui-overlay {
        position: absolute; top: 0; left: 0; width: 800px; height: 600px;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        z-index: 100; background: rgba(0,0,0,0.85); font-family: 'Courier New', Courier, monospace;
    }
    .hidden { display: none !important; }
    .neon-button {
        background: #000; color: #0f0; border: 2px solid #0f0; padding: 15px 40px;
        font-size: 1.5rem; cursor: pointer; transition: 0.2s;
        box-shadow: 0 0 10px #0f0; text-transform: uppercase;
    }
    .neon-button:hover { background: #0f0; color: #000; }
    h1 { color: #fff; text-shadow: 0 0 10px #fff; margin-bottom: 20px; font-size: 3rem; }
    #hud { position: absolute; top: 10px; left: 10px; z-index: 50; pointer-events: none; }
    #kill-counter { position: absolute; top: 10px; right: 20px; color: #0f0; font-family: 'Courier New'; font-size: 24px; text-shadow: 0 0 10px #0f0; z-index: 50; }
    .bar-container { width: 200px; height: 20px; background: #333; border: 2px solid #fff; margin-bottom: 5px; position: relative; }
    .bar-fill { height: 100%; transition: width 0.1s; }
    #hp-fill { background: #f00; }
    #mana-fill { background: #00f; }
    .label { position: absolute; width: 100%; text-align: center; color: white; font-size: 12px; line-height: 20px; text-shadow: 1px 1px #000; font-weight: bold; }
</style>
<div id="kill-counter">KILLS: 0</div>
<div id="hud">
    <div class="bar-container"><div id="hp-fill" class="bar-fill" style="width: 100%;"></div><div class="label">HEALTH</div></div>
    <div class="bar-container"><div id="mana-fill" class="bar-fill" style="width: 100%;"></div><div class="label">MANA</div></div>
</div>
<div id="menu-screen" class="game-ui-overlay">
    <h1>RPG ADVENTURE</h1>
    <button id="start-btn" class="neon-button">START MISSION</button>
</div>
<div id="death-screen" class="game-ui-overlay hidden">
    <h1 style="color: #f00;">WASTED</h1>
    <button id="retry-btn" class="neon-button">RESPAWN</button>
</div>
`;
document.body.insertAdjacentHTML('beforeend', uiHTML);

const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

// --- 1. ASSETS ---
const SPRITE_DATA = {
    player: 'player.png', grass: 'grass.png', tree: 'tree.png', house: 'building.png',
    enemy: 'enemy.png', sword: 'sword.png', chest: 'chest.png', chest_open: 'open_chest.png',
    boss: 'boss.png', mana_potion: 'mana_potion.png', book: 'book.png', door: 'door.png',
    shadow_orb: 'shadow_orb.png', furniture: 'furniture.png' 
};

const images = {};
const sounds = { swing: new Audio('sword.mp3'), fireball: new Audio('fire.mp3'), pickup: new Audio('item.mp3'), bgm: new Audio('undertale.mp3') };
sounds.bgm.loop = true;

// --- 2. STATE ---
let houseData = JSON.parse(localStorage.getItem('houseStates')) || {};
let savedStats = JSON.parse(localStorage.getItem('playerSave')) || { hp: 100, maxHp: 100, mana: 100, maxMana: 100, hasMagic: false, kills: 0 };
let player = { ...savedStats, invuln: 0 };
let cameraX = 0, cameraY = 0, savedWorldX = 0, savedWorldY = 0;
let mouseX = 0, mouseY = 0, gameState = "menu", combatMode = "sword", currentHouseId = null;
let walkCycle = 0, lastTime = 0, spawnTimer = 0, isSwinging = false, swingProgress = 0, bookAngle = 0;
const keys = {}, worldObjects = new Map();
let enemies = [], fireballs = [], particles = [], bossOrbs = [];
let lastBossKillCount = 0;

function saveGame() {
    localStorage.setItem('playerSave', JSON.stringify({ hp: player.hp, maxHp: player.maxHp, mana: player.mana, maxMana: player.maxMana, hasMagic: player.hasMagic, kills: player.kills }));
    localStorage.setItem('houseStates', JSON.stringify(houseData));
    document.getElementById("kill-counter").innerText = `KILLS: ${player.kills}`;
}

// --- 3. UTILS ---
function removeWhite(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const t = c.getContext('2d'); t.drawImage(img, 0, 0);
    try {
        const d = t.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) { if (d.data[i] > 235 && d.data[i+1] > 235 && d.data[i+2] > 235) d.data[i+3] = 0; }
        t.putImageData(d, 0, 0);
    } catch(e) {}
    return c;
}

function getCell(gx, gy) {
    const id = `${gx},${gy}`;
    if (worldObjects.has(id)) return worldObjects.get(id);
    const seed = Math.abs(Math.sin(gx * 12.98 + gy * 78.23) * 43758) % 1;
    let obj = null;
    if (seed < 0.04) obj = { type: 'house', w: 180, h: 180, id: id };
    else if (seed < 0.20) obj = { type: 'tree', w: 100, h: 100 };
    if (obj) { obj.x = gx * 400 + (seed * 80); obj.y = gy * 400 + (seed * 80); obj.z = obj.y + obj.h; worldObjects.set(id, obj); }
    return obj;
}

// --- 4. INPUTS ---
document.getElementById("start-btn").onclick = () => { gameState = "overworld"; document.getElementById("menu-screen").classList.add("hidden"); sounds.bgm.play().catch(()=>{}); saveGame(); };
document.getElementById("retry-btn").onclick = () => { localStorage.clear(); location.reload(); };
window.onkeydown = e => keys[e.key.toLowerCase()] = true;
window.onkeyup = e => { keys[e.key.toLowerCase()] = false; if (e.key === 'r') combatMode = (combatMode === "sword") ? "magic" : "sword"; };
canvas.onmousemove = e => { const rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top; };
canvas.onmousedown = () => {
    if (gameState === "menu" || player.hp <= 0) return;
    if (combatMode === "sword" && !isSwinging) { isSwinging = true; swingProgress = 0; sounds.swing.currentTime = 0; sounds.swing.play(); }
    else if (combatMode === "magic" && player.hasMagic && player.mana >= 20) {
        player.mana -= 20; const ang = Math.atan2(mouseY - 300, mouseX - 400);
        fireballs.push({ x: cameraX, y: cameraY, vx: Math.cos(ang)*0.85, vy: Math.sin(ang)*0.85, life: 1000 }); sounds.fireball.play();
    }
};

// --- 5. MAIN LOOP ---
function mainLoop(timestamp) {
    const dt = timestamp - lastTime || 0; lastTime = timestamp;
    if (gameState === "menu") { requestAnimationFrame(mainLoop); return; }
    ctx.clearRect(0, 0, 800, 600);

    let mx = 0, my = 0;
    if (keys.w) my--; if (keys.s) my++; if (keys.a) mx--; if (keys.d) mx++;
    let spd = 0.38 * dt;
    let nx = cameraX + (mx ? (mx / Math.hypot(mx, my)) * spd : 0);
    let ny = cameraY + (my ? (my / Math.hypot(mx, my)) * spd : 0);

    if (gameState === "overworld") {
        cameraX = nx; cameraY = ny; if (mx || my) walkCycle += dt * 0.012;
        const o = getCell(Math.floor(nx/400), Math.floor(ny/400));
        if (o?.type === 'house' && Math.hypot(nx-(o.x+90), ny-(o.y+160)) < 45) {
            currentHouseId = o.id; savedWorldX = cameraX; savedWorldY = cameraY + 75;
            gameState = "interior"; cameraX = 400; cameraY = 400; 
        }
        spawnTimer += dt;
        if (spawnTimer > 3000) {
            let side = Math.random() * Math.PI * 2;
            enemies.push({ x: cameraX + Math.cos(side)*600, y: cameraY + Math.sin(side)*600, hp: 5, maxHp: 5, type: 'enemy', speed: 0.1, w:64, h:64 });
            spawnTimer = 0;
        }
        // BOSS SPAWN EVERY 5 KILLS
        if (player.kills > 0 && player.kills % 5 === 0 && player.kills !== lastBossKillCount && !enemies.some(e=>e.type==='boss')) {
            enemies.push({ x: cameraX, y: cameraY-500, hp: 50 + (player.kills * 2), maxHp: 50 + (player.kills * 2), type: 'boss', speed: 0.06, w: 150, h: 150 });
            lastBossKillCount = player.kills;
        }
    } else {
        if (nx > 120 && nx < 680) cameraX = nx; if (ny > 120 && ny < 480) cameraY = ny;
        if (cameraY > 470) { gameState = "overworld"; cameraX = savedWorldX; cameraY = savedWorldY; }
        if (keys.e && Math.hypot(cameraX-400, cameraY-200) < 65 && !houseData[currentHouseId]?.isOpen) {
            if(!houseData[currentHouseId]) houseData[currentHouseId] = {}; houseData[currentHouseId].isOpen = true;
            player.hasMagic = true; player.mana = player.maxMana; sounds.pickup.play(); saveGame();
        }
    }

    if (gameState === "overworld") {
        for (let x=-64; x<864; x+=64) for (let y=-64; y<664; y+=64) ctx.drawImage(images.grass, x-(cameraX%64), y-(cameraY%64), 64, 64);
    } else { ctx.drawImage(images.furniture, 400 - cameraX, 300 - cameraY, 800, 600); }

    // --- 360 DEGREE SWORD HIT DETECTION ---
    if (isSwinging) {
        const sAng = Math.atan2(mouseY-300, mouseX-400);
        enemies.forEach(en => {
            const dist = Math.hypot(cameraX - en.x, cameraY - en.y);
            const angToEn = Math.atan2(en.y - cameraY, en.x - cameraX);
            let diff = Math.abs(sAng - angToEn);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            // Radius check for North/South/East/West (Full circle hit)
            if (dist < 110 && diff < 1.6 && !en.hit) {
                en.hp -= 2; en.hit = true;
                if (en.hp <= 0 && !en.dead) { en.dead = true; player.kills++; saveGame(); }
            }
        });
    } else { enemies.forEach(en => en.hit = false); }
    enemies = enemies.filter(e => !e.dead);

    fireballs.forEach((fb, i) => {
        fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.life -= dt;
        enemies.forEach(en => { if (Math.hypot(fb.x-en.x, fb.y-en.y) < 55) { en.hp -= 4; fb.life = 0; if(en.hp<=0 && !en.dead){ en.dead=true; player.kills++; saveGame();} } });
        ctx.drawImage(images.mana_potion, fb.x-cameraX+400, fb.y-cameraY+300, 35, 35);
        if (fb.life <= 0) fireballs.splice(i, 1);
    });

    let renders = [];
    if (gameState === "overworld") {
        const cgX = Math.floor(cameraX/400), cgY = Math.floor(cameraY/400);
        for(let x=cgX-2; x<=cgX+2; x++) for(let y=cgY-2; y<=cgY+2; y++) { let o = getCell(x,y); if(o) renders.push(o); }
    } else {
        renders.push({ type: 'door', x: 370, y: 530, w: 60, h: 50, z: 600 });
        renders.push({ type: houseData[currentHouseId]?.isOpen?'chest_open':'chest', x:375, y:150, w:50, h:50, z:160 });
    }

    enemies.forEach(en => {
        const d = Math.hypot(cameraX-en.x, cameraY-en.y);
        en.x += ((cameraX-en.x)/d)*en.speed*dt; en.y += ((cameraY-en.y)/d)*en.speed*dt;
        if (d < 50 && player.invuln <= 0) { player.hp -= 20; player.invuln = 1000; }
        if (en.type === 'boss' && Math.random() < 0.03) {
            const ang = Math.atan2(cameraY-en.y, cameraX-en.x);
            bossOrbs.push({ x: en.x, y: en.y, vx: Math.cos(ang)*0.45, vy: Math.sin(ang)*0.45 });
        }
        renders.push({...en, z: en.y});
    });

    bossOrbs.forEach((o, i) => {
        o.x += o.vx * dt; o.y += o.vy * dt;
        renders.push({ type: 'shadow_orb', x: o.x-15, y: o.y-15, w: 45, h: 45, z: o.y });
        if (Math.hypot(o.x - cameraX, o.y - cameraY) < 40 && player.invuln <= 0) { player.hp -= 15; player.invuln = 700; bossOrbs.splice(i,1); }
    });

    renders.sort((a,b)=>a.z-b.z).forEach(o => {
        ctx.drawImage(images[o.type], o.x-cameraX+400, o.y-cameraY+300, o.w, o.h);
        if (o.hp) { ctx.fillStyle="#000"; ctx.fillRect(o.x-cameraX+400, o.y-cameraY+285, o.w, 8); ctx.fillStyle="#0f0"; ctx.fillRect(o.x-cameraX+400, o.y-cameraY+285, (o.hp/o.maxHp)*o.w, 8); }
    });

    // PLAYER CENTER
    ctx.save(); ctx.translate(400, 300);
    ctx.scale(1, 1 + Math.sin(walkCycle)*0.15);
    if(player.invuln > 0 && Math.floor(timestamp/100) % 2 === 0) ctx.globalAlpha = 0.3;
    ctx.drawImage(images.player, -32, -60, 64, 64);
    if (isSwinging) {
        swingProgress += 0.012 * dt; const ang = Math.atan2(mouseY-300, mouseX-400);
        ctx.save(); ctx.rotate(ang + (swingProgress * Math.PI)); ctx.drawImage(images.sword, 0, -70, 25, 80); ctx.restore();
        if (swingProgress >= 1) isSwinging = false;
    }
    ctx.restore();

    if (player.hasMagic && combatMode === "magic") {
        bookAngle += 0.07; ctx.drawImage(images.book, 400 + Math.cos(bookAngle)*65 - 18, 300 + Math.sin(bookAngle)*30 - 50, 40, 40);
    }

    document.getElementById("hp-fill").style.width = (player.hp/player.maxHp)*100 + "%";
    document.getElementById("mana-fill").style.width = (player.mana/player.maxMana)*100 + "%";
    if (player.invuln > 0) player.invuln -= dt;
    if (player.hp > 0) requestAnimationFrame(mainLoop); else document.getElementById("death-screen").classList.remove("hidden");
}

let loadedCount = 0;
for (let k in SPRITE_DATA) {
    const img = new Image(); img.src = SPRITE_DATA[k];
    img.onload = () => { images[k] = removeWhite(img); if(++loadedCount === Object.keys(SPRITE_DATA).length) requestAnimationFrame(mainLoop); };
}