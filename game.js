// ============================================================
// SN@KELIKE — Snake × Roguelike built with Phaser 3
// ============================================================

const TILE_SIZE = 16;
const FOV_RADIUS = 8;

// Tile types
const WALL = 0;
const FLOOR = 1;

// Visibility states
const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

// Colors
const COLOR_SNAKE_HEAD = '#00ff00';
const COLOR_SNAKE_BODY = '#00cc00';
const COLOR_WALL = '#888888';
const COLOR_FLOOR_VISIBLE = '#333333';
const COLOR_FLOOR_EXPLORED = '#1a1a1a';
const COLOR_RAT = '#ffff00';
const COLOR_BADDIE = '#ff0000';
const COLOR_STAIRCASE = '#00ffff';
const COLOR_LAVA = '#ff4400';
const COLOR_TRAP = '#aa00ff';
const COLOR_TELEPORTER = '#ff00ff';
const COLOR_POWERUP_SPEED = '#00ffff';
const COLOR_POWERUP_SHIELD = '#4488ff';
const COLOR_POWERUP_PHASE = '#cc88ff';
const COLOR_BOSS = '#ff6600';

// Baddie AI states
const AI_MOVING = 0;
const AI_SHIFTING = 1;

// Leaderboard
const LEADERBOARD_SIZE = 10;

// Scoring
const POINTS_PER_LEVEL = 100;
const POINTS_PER_KILL = 15;
const POINTS_PER_MAX_LENGTH = 5;

// Directions
const DIR = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

function oppositeDir(d) {
  return { x: -d.x, y: -d.y };
}

function dirsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function perpendicularDirs(d) {
  if (d.x === 0) return [DIR.LEFT, DIR.RIGHT];
  return [DIR.UP, DIR.DOWN];
}

// ============================================================
// AUDIO
// ============================================================

function isSoundEnabled() {
  try { return localStorage.getItem('snakelike_sound') !== 'off'; }
  catch (e) { return true; }
}

function playBeep(context, frequency, duration, type, volume) {
  if (!isSoundEnabled()) return;
  if (!context) return;
  try {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration / 1000);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) { /* ignore audio errors */ }
}

function playEatSound(ctx) {
  if (!isSoundEnabled()) return;
  playBeep(ctx, 880, 80, 'square', 0.08);
}

function playBaddieDeath(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playStaircaseAppear(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    // Triumphant chord: C-E-G played together with slight delays
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => { gain.disconnect(); osc.disconnect(); };
      }, i * 80);
    });
  } catch (e) {}
}

function playGameOver(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    // Descending tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
    // Low rumble underneath
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = 55;
    gain2.gain.setValueAtTime(0.06, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.start(); osc2.stop(ctx.currentTime + 1.0);
    osc2.onended = () => { gain2.disconnect(); osc2.disconnect(); };
  } catch (e) {}
}

function playLevelTransition(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    // 3-note ascending jingle: D-F#-A
    const notes = [587, 740, 880]; // D5, F#5, A5
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        osc.onended = () => { gain.disconnect(); osc.disconnect(); };
      }, i * 120);
    });
  } catch (e) {}
}

function playTrapSound(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playTeleportSound(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playLaserSound(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playBossMove(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playBossHit(ctx) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  } catch (e) {}
}

function playPowerupPickup(ctx, type) {
  if (!isSoundEnabled()) return;
  if (!ctx) return;
  try {
    const freqs = { speed: [600, 800, 1000], shield: [400, 500, 600], phase: [500, 700, 900] };
    const notes = freqs[type] || freqs.speed;
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
        osc.onended = () => { gain.disconnect(); osc.disconnect(); };
      }, i * 60);
    });
  } catch (e) {}
}

function playLevelStartDrone(ctx) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(65, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.0);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1.5);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
    // Eerie high overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(660, ctx.currentTime + 1.5);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.5);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.start(); osc2.stop(ctx.currentTime + 1.5);
    osc2.onended = () => { gain2.disconnect(); osc2.disconnect(); };
  } catch (e) {}
}

// ============================================================
// LEADERBOARD
// ============================================================

async function fetchLeaderboard() {
  try {
    const resp = await fetch('https://snakelike-leaderboard.vercel.app/api/leaderboard');
    const data = await resp.json();
    if (!data.dreamlo || !data.dreamlo.leaderboard || !data.dreamlo.leaderboard.entry) return [];
    const entries = data.dreamlo.leaderboard.entry;
    return Array.isArray(entries) ? entries : [entries];
  } catch (e) {
    return [];
  }
}

async function submitToLeaderboard(name, score, level, kills, maxLength) {
  return fetch('https://snakelike-leaderboard.vercel.app/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, level, kills, maxLength }),
  });
}

function getPersonalBest() {
  try { return parseInt(localStorage.getItem('snakelike_best') || '0'); }
  catch (e) { return 0; }
}

function setPersonalBest(score) {
  try { localStorage.setItem('snakelike_best', score.toString()); }
  catch (e) {}
}

function qualifiesForLeaderboard(score, entries) {
  if (entries.length < LEADERBOARD_SIZE) return true;
  const sorted = [...entries].sort((a, b) => Number(b.score) - Number(a.score));
  return score > Number(sorted[LEADERBOARD_SIZE - 1].score);
}

// ============================================================
// BSP DUNGEON GENERATION
// ============================================================

class BSPNode {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.left = null;
    this.right = null;
    this.room = null;
  }
}

function splitBSP(node, minSize) {
  if (node.w < minSize * 2 && node.h < minSize * 2) return;
  if (node.left) return;

  let splitH;
  if (node.w < minSize * 2) splitH = true;
  else if (node.h < minSize * 2) splitH = false;
  else splitH = Math.random() < 0.5;

  if (splitH) {
    if (node.h < minSize * 2) return;
    const split = minSize + Math.floor(Math.random() * (node.h - minSize * 2 + 1));
    node.left = new BSPNode(node.x, node.y, node.w, split);
    node.right = new BSPNode(node.x, node.y + split, node.w, node.h - split);
  } else {
    if (node.w < minSize * 2) return;
    const split = minSize + Math.floor(Math.random() * (node.w - minSize * 2 + 1));
    node.left = new BSPNode(node.x, node.y, split, node.h);
    node.right = new BSPNode(node.x + split, node.y, node.w - split, node.h);
  }

  splitBSP(node.left, minSize);
  splitBSP(node.right, minSize);
}

function createRooms(node, grid, rooms) {
  if (!node.left && !node.right) {
    const pad = 2;
    const rw = Math.max(4, Math.floor(Math.random() * (node.w - pad * 2 - 2)) + 4);
    const rh = Math.max(4, Math.floor(Math.random() * (node.h - pad * 2 - 2)) + 4);
    const rx = node.x + pad + Math.floor(Math.random() * Math.max(1, node.w - pad * 2 - rw));
    const ry = node.y + pad + Math.floor(Math.random() * Math.max(1, node.h - pad * 2 - rh));

    const finalW = Math.min(rw, node.w - pad * 2);
    const finalH = Math.min(rh, node.h - pad * 2);

    node.room = { x: rx, y: ry, w: finalW, h: finalH };
    rooms.push(node.room);

    for (let dy = 0; dy < finalH; dy++) {
      for (let dx = 0; dx < finalW; dx++) {
        const gy = ry + dy;
        const gx = rx + dx;
        if (gy > 0 && gy < grid.length - 1 && gx > 0 && gx < grid[0].length - 1) {
          grid[gy][gx] = FLOOR;
        }
      }
    }
    return node.room;
  }

  const leftRoom = node.left ? createRooms(node.left, grid, rooms) : null;
  const rightRoom = node.right ? createRooms(node.right, grid, rooms) : null;

  if (leftRoom && rightRoom) {
    connectRooms(leftRoom, rightRoom, grid);
  }

  return leftRoom || rightRoom;
}

function roomCenter(room) {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2)
  };
}

function connectRooms(roomA, roomB, grid) {
  const a = roomCenter(roomA);
  const b = roomCenter(roomB);

  // L-shaped corridor, 3 tiles wide
  if (Math.random() < 0.5) {
    carveHCorridor(grid, a.x, b.x, a.y);
    carveVCorridor(grid, a.y, b.y, b.x);
  } else {
    carveVCorridor(grid, a.y, b.y, a.x);
    carveHCorridor(grid, a.x, b.x, b.y);
  }
}

function carveHCorridor(grid, x1, x2, y) {
  const startX = Math.min(x1, x2);
  const endX = Math.max(x1, x2);
  const maxY = grid.length - 1;
  const maxX = grid[0].length - 1;
  for (let x = startX; x <= endX; x++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny > 0 && ny < maxY && x > 0 && x < maxX) {
        grid[ny][x] = FLOOR;
      }
    }
  }
}

function carveVCorridor(grid, y1, y2, x) {
  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);
  const maxY = grid.length - 1;
  const maxX = grid[0].length - 1;
  for (let y = startY; y <= endY; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      if (y > 0 && y < maxY && nx > 0 && nx < maxX) {
        grid[y][nx] = FLOOR;
      }
    }
  }
}

function generateDungeon(mapW, mapH, level) {
  const grid = [];
  for (let y = 0; y < mapH; y++) {
    grid[y] = new Array(mapW).fill(WALL);
  }

  const minLeaf = 10;
  const root = new BSPNode(0, 0, mapW, mapH);
  splitBSP(root, minLeaf);

  const rooms = [];
  createRooms(root, grid, rooms);

  // Ensure border is all walls
  for (let x = 0; x < mapW; x++) {
    grid[0][x] = WALL;
    grid[mapH - 1][x] = WALL;
  }
  for (let y = 0; y < mapH; y++) {
    grid[y][0] = WALL;
    grid[y][mapW - 1] = WALL;
  }

  // Place hazards
  const lavaTiles = [];
  const trapTiles = [];
  const teleporters = [];
  const occupied = new Set();

  function randomFloorInRoom(room) {
    for (let attempts = 0; attempts < 100; attempts++) {
      const x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (x <= 0 || x >= mapW - 1 || y <= 0 || y >= mapH - 1) continue;
      if (grid[y][x] !== FLOOR) continue;
      const key = y * mapW + x;
      if (occupied.has(key)) continue;
      return { x, y };
    }
    return null;
  }

  function randomCorridorFloor() {
    for (let attempts = 0; attempts < 200; attempts++) {
      const x = 2 + Math.floor(Math.random() * (mapW - 4));
      const y = 2 + Math.floor(Math.random() * (mapH - 4));
      if (grid[y][x] !== FLOOR) continue;
      let inRoom = false;
      for (const room of rooms) {
        if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
          inRoom = true; break;
        }
      }
      if (inRoom) continue;
      const key = y * mapW + x;
      if (occupied.has(key)) continue;
      return { x, y };
    }
    for (let y = 2; y < mapH - 2; y++) {
      for (let x = 2; x < mapW - 2; x++) {
        if (grid[y][x] === FLOOR && !occupied.has(y * mapW + x)) return { x, y };
      }
    }
    return null;
  }

  // Lava: 2-4 per level, placed in corridors
  const numLava = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numLava; i++) {
    const pos = randomCorridorFloor();
    if (pos) {
      lavaTiles.push(pos);
      occupied.add(pos.y * mapW + pos.x);
    }
  }

  // Traps: 3-6 per level, spread across different rooms
  const numTraps = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numTraps; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const pos = randomFloorInRoom(room);
    if (pos) {
      trapTiles.push(pos);
      occupied.add(pos.y * mapW + pos.x);
    }
  }

  // Teleporters: 1 pair per level
  if (rooms.length >= 2) {
    const r1 = rooms[Math.floor(Math.random() * rooms.length)];
    let r2 = rooms[Math.floor(Math.random() * rooms.length)];
    let tries = 0;
    while (r2 === r1 && tries < 20) { r2 = rooms[Math.floor(Math.random() * rooms.length)]; tries++; }
    const p1 = randomFloorInRoom(r1);
    const p2 = randomFloorInRoom(r2);
    if (p1 && p2) {
      teleporters.push({ x: p1.x, y: p1.y, pairX: p2.x, pairY: p2.y });
      teleporters.push({ x: p2.x, y: p2.y, pairX: p1.x, pairY: p1.y });
      occupied.add(p1.y * mapW + p1.x);
      occupied.add(p2.y * mapW + p2.x);
    }
  }

  return { grid, rooms, lavaTiles, trapTiles, teleporters };
}

// ============================================================
// FOV — Raycasting with Bresenham
// ============================================================

function computeFOV(grid, visibility, cx, cy, radius) {
  const mapH = grid.length;
  const mapW = grid[0].length;

  // Reset visible tiles to explored
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      if (visibility[y][x] === VISIBLE) {
        visibility[y][x] = EXPLORED;
      }
    }
  }

  // Mark center visible
  if (cy >= 0 && cy < mapH && cx >= 0 && cx < mapW) {
    visibility[cy][cx] = VISIBLE;
  }

  // Cast rays to perimeter of FOV circle
  const steps = radius * 8;
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const tx = cx + Math.round(Math.cos(angle) * radius);
    const ty = cy + Math.round(Math.sin(angle) * radius);
    castRay(grid, visibility, cx, cy, tx, ty, mapW, mapH);
  }
}

function castRay(grid, visibility, x0, y0, x1, y1, mapW, mapH) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    if (x < 0 || x >= mapW || y < 0 || y >= mapH) break;

    visibility[y][x] = VISIBLE;

    if (grid[y][x] === WALL) break;

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// ============================================================
// TITLE SCENE
// ============================================================

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    this.leaderboardEntries = null;
    fetchLeaderboard().then(entries => {
      this.leaderboardEntries = entries;
    }).catch(() => {
      this.leaderboardEntries = [];
    });

    this.wallChars = [];
    this.flameChars = [];
    this.flameEdgeChars = [];
    this.flameSet = new Set();
    this.handleChars = [];
    this.showTitle();

    // Show tutorial on first play
    try {
      if (!localStorage.getItem('snakelike_tutorial_seen')) {
        this.showTutorial();
      }
    } catch (e) {}
  }

  clearScreen() {
    this.children.removeAll();
    this.input.keyboard.removeAllListeners();
    if (this.switchTimer) { this.switchTimer.remove(); this.switchTimer = null; }
    this.wallChars = [];
    this.flameChars = [];
    this.flameEdgeChars = [];
    this.flameSet = new Set();
    this.handleChars = [];
    this.promptText = null;
  }

  createBorder() {
    const fontSize = 14;
    const charW = 8.4;
    const charH = 16;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cols = Math.floor(w / charW);
    const rows = Math.floor(h / charH);

    // Castle layout: battlements at top, solid walls on sides and bottom
    const wallThick = 12;
    const battlementHeight = 2;
    const merlonWidth = 4;
    const crenelWidth = 4;
    const solidTopRows = 2;
    const bottomRows = 2;

    // Torch centered in each side wall, radius = half wall minus 1
    const torchRow = solidTopRows + battlementHeight + 10;
    const torchLeftC = Math.floor(wallThick / 2);
    const torchRightC = cols - Math.floor(wallThick / 2) - 1;

    const grid = [];
    for (let r = 0; r < rows; r++) {
      let row = '';
      for (let c = 0; c < cols; c++) {
        // Bottom solid wall
        if (r >= rows - bottomRows) {
          row += '#'; continue;
        }
        // Top parapet (solid rows just below battlements)
        if (r >= battlementHeight && r < battlementHeight + solidTopRows) {
          row += '#'; continue;
        }
        // Battlements (alternating merlons and crenels, flush with side walls)
        if (r < battlementHeight) {
          if (c < wallThick || c >= cols - wallThick) {
            row += '#';
          } else {
            const inner = c - wallThick;
            const period = merlonWidth + crenelWidth;
            const phase = inner % period;
            if (phase < merlonWidth) {
              row += '#';
            } else {
              row += ' ';
            }
          }
          continue;
        }
        // Left wall
        if (c < wallThick) {
          row += '#'; continue;
        }
        // Right wall
        if (c >= cols - wallThick) {
          row += '#'; continue;
        }
        // Interior is empty
        row += ' ';
      }
      grid.push(row);
    }

    // Render every '#' as its own text object
    this.wallChars = [];
    const style = { fontFamily: 'monospace', fontSize: fontSize + 'px', color: '#444444' };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === '#') {
          const t = this.add.text(c * charW, r * charH, '#', { ...style });
          this.wallChars.push({ obj: t, r, c });
        }
      }
    }

    // Two torch flames on inner walls
    const flameRadius = (Math.floor(wallThick / 2) - 1) / 2;
    const flameCenters = [
      { r: torchRow, c: torchLeftC },
      { r: torchRow, c: torchRightC }
    ];

    this.flameChars = [];
    this.flameEdgeChars = [];
    for (const center of flameCenters) {
      for (const wc of this.wallChars) {
        const dr = wc.r - center.r;
        const dc = wc.c - center.c;
        const dist = Math.sqrt(dr * dr + dc * dc);
        if (dist < flameRadius) {
          this.flameChars.push({ obj: wc.obj, dist, center });
        } else if (dist >= flameRadius && dist < flameRadius + 1.5) {
          this.flameEdgeChars.push(wc.obj);
        }
      }
    }

    this.flameSet = new Set(this.flameChars.map(fc => fc.obj));

    // Torch wood handles — 1 char wide, 3 chars tall below each flame center
    this.handleChars = [];
    const handleStyle = { fontFamily: 'monospace', fontSize: fontSize + 'px', color: '#8B4513' };
    for (const center of flameCenters) {
      for (let i = 1; i <= 3; i++) {
        const hr = center.r + flameRadius + i;
        const hc = center.c;
        const t = this.add.text(hc * charW, hr * charH, '#', { ...handleStyle });
        this.handleChars.push(t);
      }
    }

    this.borderFlickerTimer = 0;
    this.flameTimer = 0;
  }

  addStartListener() {
    this.input.keyboard.on('keydown', () => {
      if (this.switchTimer) { this.switchTimer.remove(); this.switchTimer = null; }
      this.scene.start('TransitionScene', { level: 1, snakeLength: 1 });
    });
  }

  showTitle() {
    this.clearScreen();
    this.createBorder();
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, cy - 40, 'SN@KELIKE', {
      fontFamily: 'monospace', fontSize: '48px', color: '#00ff00'
    }).setOrigin(0.5);

    this.add.text(cx, cy - 5, 'Descend the Endless Dungeon. Consume. Grow. Survive.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#666666'
    }).setOrigin(0.5);

    this.promptText = this.add.text(cx, cy + 30, 'Press any key to start', {
      fontFamily: 'monospace', fontSize: '18px', color: '#888888'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 70, 'WASD or Arrow Keys to move', {
      fontFamily: 'monospace', fontSize: '14px', color: '#555555'
    }).setOrigin(0.5);

    this.addStartListener();

    this.switchTimer = this.time.delayedCall(3000, () => {
      this.showTitleLeaderboard();
    });
  }

  showTitleLeaderboard() {
    this.clearScreen();
    this.createBorder();
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, cy - 40, 'SN@KELIKE', {
      fontFamily: 'monospace', fontSize: '48px', color: '#00ff00'
    }).setOrigin(0.5);

    this.add.text(cx, cy - 5, 'Descend the Endless Dungeon. Consume. Grow. Survive.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#666666'
    }).setOrigin(0.5);

    const entries = this.leaderboardEntries || [];
    const sorted = [...entries].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, LEADERBOARD_SIZE);
    const startY = cy - 5;

    this.add.text(cx, startY, '── LEADERBOARD ──', {
      fontFamily: 'monospace', fontSize: '16px', color: '#00ffff'
    }).setOrigin(0.5);

    if (sorted.length === 0) {
      this.add.text(cx, startY + 25, 'No scores yet', {
        fontFamily: 'monospace', fontSize: '14px', color: '#555555'
      }).setOrigin(0.5);
    } else {
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const rank = String(i + 1).padStart(2);
        const displayName = entry.name.replace(/_\d+$/, '');
        const eName = displayName.substring(0, 12).padEnd(12);
        const eScore = String(Number(entry.score)).padStart(6);
        this.add.text(cx, startY + 25 + i * 22, `${rank}. ${eName} ${eScore}`, {
          fontFamily: 'monospace', fontSize: '14px', color: i < 3 ? '#ffff00' : '#aaaaaa'
        }).setOrigin(0.5);
      }
    }

    const bottom = this.cameras.main.height - 30;
    this.promptText = this.add.text(cx, bottom, 'Press any key to start', {
      fontFamily: 'monospace', fontSize: '18px', color: '#888888'
    }).setOrigin(0.5);

    this.addStartListener();

    this.switchTimer = this.time.delayedCall(8000, () => {
      this.showTitle();
    });
  }

  showTutorial() {
    // Remove any existing key listeners to prevent starting game during tutorial
    this.input.keyboard.removeAllListeners();
    if (this.switchTimer) { this.switchTimer.remove(); this.switchTimer = null; }

    this.tutorialStep = 0;
    const tips = [
      'Arrow keys or WASD to move',
      'Eat 🟡 rats to grow longer',
      'Lure 🔴 baddies into your body\nto kill them — head-on hits hurt YOU',
      'Kill all baddies to reveal\nthe staircase 🔵'
    ];

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    // Semi-transparent overlay
    this.tutorialOverlay = this.add.rectangle(cx, cy, cam.width + 200, cam.height + 200, 0x000000, 0.85).setDepth(300);

    this.tutorialTitle = this.add.text(cx, cy - 80, 'HOW TO PLAY', {
      fontFamily: 'monospace', fontSize: '28px', color: '#00ff00'
    }).setOrigin(0.5).setDepth(301);

    this.tutorialTip = this.add.text(cx, cy, tips[0], {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', align: 'center', lineSpacing: 6
    }).setOrigin(0.5).setDepth(301);

    this.tutorialProgress = this.add.text(cx, cy + 70, '1 / 4', {
      fontFamily: 'monospace', fontSize: '14px', color: '#555555'
    }).setOrigin(0.5).setDepth(301);

    this.tutorialPrompt = this.add.text(cx, cy + 100, 'Press SPACE or ENTER to continue', {
      fontFamily: 'monospace', fontSize: '14px', color: '#888888'
    }).setOrigin(0.5).setDepth(301);

    // Pulse the prompt
    this.tweens.add({
      targets: this.tutorialPrompt, alpha: 0.3,
      duration: 600, yoyo: true, repeat: -1
    });

    const advanceTutorial = (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      this.tutorialStep++;
      if (this.tutorialStep >= tips.length) {
        // Tutorial complete
        try { localStorage.setItem('snakelike_tutorial_seen', '1'); } catch(e) {}
        this.closeTutorial();
        return;
      }
      this.tutorialTip.setText(tips[this.tutorialStep]);
      this.tutorialProgress.setText(`${this.tutorialStep + 1} / ${tips.length}`);
    };

    this.input.keyboard.on('keydown', advanceTutorial);
  }

  closeTutorial() {
    if (this.tutorialOverlay) { this.tutorialOverlay.destroy(); this.tutorialOverlay = null; }
    if (this.tutorialTitle) { this.tutorialTitle.destroy(); this.tutorialTitle = null; }
    if (this.tutorialTip) { this.tutorialTip.destroy(); this.tutorialTip = null; }
    if (this.tutorialProgress) { this.tutorialProgress.destroy(); this.tutorialProgress = null; }
    if (this.tutorialPrompt) { this.tutorialPrompt.destroy(); this.tutorialPrompt = null; }
    // Re-add the start listener
    this.input.keyboard.removeAllListeners();
    this.addStartListener();
    // Restart the leaderboard switch timer
    this.switchTimer = this.time.delayedCall(3000, () => {
      this.showTitleLeaderboard();
    });
  }

  update(time, delta) {
    if (!this.wallChars || this.wallChars.length === 0) return;

    this.borderFlickerTimer += delta;
    this.flameTimer += delta;

    // Pulse "Press any key"
    if (this.promptText) {
      const pulse = Math.sin(time * 0.003) * 0.35 + 0.65;
      this.promptText.setAlpha(pulse);
    }

    // Sparse wall flicker — only 3-6 random non-flame '#'s shift shade each tick
    if (this.borderFlickerTimer > 180) {
      this.borderFlickerTimer = 0;
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const wc = this.wallChars[Math.floor(Math.random() * this.wallChars.length)];
        if (!this.flameSet.has(wc.obj)) {
          const gray = 30 + Math.floor(Math.random() * 50);
          const hex = gray.toString(16).padStart(2, '0');
          wc.obj.setColor('#' + hex + hex + hex);
          wc.obj.setAlpha(0.5 + Math.random() * 0.5);
        }
      }
    }

    // Flame glow — every 65ms
    if (this.flameTimer > 65) {
      this.flameTimer = 0;
      const flameColors = [
        '#ff0000', '#ff1a00', '#ff3300', '#ff4d00',
        '#ff6600', '#ff8800', '#ffaa00', '#ffbb00',
        '#ffcc00', '#ffdd00', '#ffee00', '#ffff00'
      ];
      const maxDist = Math.max(1, Math.floor(12 / 2) - 1);
      for (const fc of this.flameChars) {
        const intensity = 1 - (fc.dist / maxDist);
        const jitter = (Math.random() - 0.3) * 0.4;
        const t = Math.max(0, Math.min(1, intensity + jitter));
        const ci = Math.floor(t * (flameColors.length - 1));
        fc.obj.setColor(flameColors[ci]);
        fc.obj.setAlpha(0.4 + t * 0.6);
      }
      // Keep edge chars always gray to border the flame
      for (const obj of this.flameEdgeChars) {
        const gray = 50 + Math.floor(Math.random() * 30);
        const hex = gray.toString(16).padStart(2, '0');
        obj.setColor('#' + hex + hex + hex);
        obj.setAlpha(0.7 + Math.random() * 0.3);
      }
      // Subtle warm glow on torch handles
      const woodColors = ['#8B4513', '#7B3F10', '#9B4F1A', '#6B3510'];
      for (const obj of this.handleChars) {
        obj.setColor(woodColors[Math.floor(Math.random() * woodColors.length)]);
      }
    }
  }
}

// ============================================================
// TRANSITION SCENE — Title → Game cinematic
// ============================================================

class TransitionScene extends Phaser.Scene {
  constructor() { super('TransitionScene'); }

  init(data) {
    this.level = data.level || 1;
    this.snakeLength = data.snakeLength || 1;
    this.baddiesKilled = data.baddiesKilled || 0;
    this.maxSnakeLength = data.maxSnakeLength || 1;
    this.currentScore = data.score || 0;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2;
    const cy = H / 2;
    this.skipDone = false;

    // ======== Generate dungeon & entities ========
    const mapW = 35 + 5 * this.level;
    const mapH = 27 + 3 * this.level;
    const dungeon = generateDungeon(mapW, mapH, this.level);
    const grid = dungeon.grid;
    const rooms = dungeon.rooms;

    const startRoom = rooms[Math.floor(Math.random() * rooms.length)];
    const snakeX = Math.floor(startRoom.x + startRoom.w / 2);
    const snakeY = Math.floor(startRoom.y + startRoom.h / 2);
    const snakeArr = [{ x: snakeX, y: snakeY }];
    if (this.snakeLength > 1) {
      for (let i = 1; i < this.snakeLength; i++) {
        snakeArr.push({ x: snakeX, y: snakeY });
      }
    }

    const numRats = 4 + this.level;
    const ratsArr = [];
    for (let i = 0; i < numRats; i++) {
      ratsArr.push(this._findFloor(grid, mapW, mapH, rooms, snakeArr, ratsArr, []));
    }

    const numBaddies = 4 + this.level;
    const allDirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
    const baddiesArr = [];
    for (let i = 0; i < numBaddies; i++) {
      const pos = this._findFloor(grid, mapW, mapH, rooms, snakeArr, ratsArr, baddiesArr);
      baddiesArr.push({
        x: pos.x, y: pos.y,
        primaryDirection: allDirs[Math.floor(Math.random() * 4)],
        state: AI_MOVING, shiftRemaining: 0, shiftDirection: DIR.LEFT
      });
    }

    this.dungeonData = {
      grid, rooms, mapW, mapH,
      snakeX, snakeY,
      rats: ratsArr,
      baddies: baddiesArr,
      lavaTiles: dungeon.lavaTiles || [],
      trapTiles: dungeon.trapTiles || [],
      teleporters: dungeon.teleporters || []
    };

    // Find a floor tile adjacent to the snake for the intro staircase
    const tryDirs = [DIR.RIGHT, DIR.DOWN, DIR.LEFT, DIR.UP];
    this.introStairDir = null;
    for (const d of tryDirs) {
      const tx = snakeX + d.x;
      const ty = snakeY + d.y;
      if (tx > 0 && tx < mapW - 1 && ty > 0 && ty < mapH - 1 && grid[ty][tx] === FLOOR) {
        this.introStairDir = d;
        break;
      }
    }

    // ======== Target screen positions ========
    const gameCamX = snakeX * TILE_SIZE - W / 2;
    const gameCamY = snakeY * TILE_SIZE - H / 2;
    const snakeScreenX = snakeX * TILE_SIZE - gameCamX;
    const snakeScreenY = snakeY * TILE_SIZE - gameCamY;

    const pad = 3;
    const tSX = Math.max(0, Math.floor(gameCamX / TILE_SIZE) - pad);
    const tSY = Math.max(0, Math.floor(gameCamY / TILE_SIZE) - pad);
    const tEX = Math.min(mapW - 1, Math.ceil((gameCamX + W) / TILE_SIZE) + pad);
    const tEY = Math.min(mapH - 1, Math.ceil((gameCamY + H) / TILE_SIZE) + pad);

    const wallTargets = [];
    for (let ty = tSY; ty <= tEY; ty++) {
      for (let tx = tSX; tx <= tEX; tx++) {
        if (grid[ty][tx] === WALL) {
          wallTargets.push({ x: tx * TILE_SIZE - gameCamX, y: ty * TILE_SIZE - gameCamY });
        }
      }
    }
    for (let i = wallTargets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wallTargets[i], wallTargets[j]] = [wallTargets[j], wallTargets[i]];
    }

    const baddieScreenTargets = baddiesArr.map(b => ({
      x: b.x * TILE_SIZE - gameCamX, y: b.y * TILE_SIZE - gameCamY
    }));
    const ratScreenTargets = ratsArr.map(r => ({
      x: r.x * TILE_SIZE - gameCamX, y: r.y * TILE_SIZE - gameCamY
    }));

    // ======== Recreate title screen ========
    const fontSize = 14;
    const charW = 8.4;
    const charH = 16;
    const cols = Math.floor(W / charW);
    const rowCount = Math.floor(H / charH);
    const wallThick = 12;
    const battleH = 2;
    const merlonW = 4;
    const crenelW = 4;
    const solidTop = 2;
    const botRows = 2;
    const torchR = solidTop + battleH + 10;
    const torchLC = Math.floor(wallThick / 2);
    const torchRC = cols - Math.floor(wallThick / 2) - 1;
    const fRadius = (Math.floor(wallThick / 2) - 1) / 2;
    const fCenters = [{ r: torchR, c: torchLC }, { r: torchR, c: torchRC }];

    const bGrid = [];
    for (let r = 0; r < rowCount; r++) {
      let row = '';
      for (let c = 0; c < cols; c++) {
        if (r >= rowCount - botRows) { row += '#'; continue; }
        if (r >= battleH && r < battleH + solidTop) { row += '#'; continue; }
        if (r < battleH) {
          if (c < wallThick || c >= cols - wallThick) row += '#';
          else row += (c - wallThick) % (merlonW + crenelW) < merlonW ? '#' : ' ';
          continue;
        }
        if (c < wallThick || c >= cols - wallThick) { row += '#'; continue; }
        row += ' ';
      }
      bGrid.push(row);
    }

    const wallChars = [];
    const flameChars = [];
    const bStyle = { fontFamily: 'monospace', fontSize: fontSize + 'px', color: '#444444' };
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < cols; c++) {
        if (bGrid[r][c] !== '#') continue;
        let isFlame = false;
        for (const fc of fCenters) {
          if (Math.sqrt((r - fc.r) ** 2 + (c - fc.c) ** 2) < fRadius) { isFlame = true; break; }
        }
        const t = this.add.text(c * charW, r * charH, '#', { ...bStyle });
        if (isFlame) {
          const colors = ['#ff3300', '#ff6600', '#ffaa00', '#ffcc00'];
          t.setColor(colors[Math.floor(Math.random() * colors.length)]);
          t.setAlpha(0.6 + Math.random() * 0.4);
          flameChars.push(t);
        } else {
          t.setAlpha(0.5 + Math.random() * 0.5);
          wallChars.push(t);
        }
      }
    }

    const handles = [];
    for (const fc of fCenters) {
      for (let i = 1; i <= 3; i++) {
        handles.push(this.add.text(fc.c * charW, (fc.r + fRadius + i) * charH, '#', {
          fontFamily: 'monospace', fontSize: fontSize + 'px', color: '#8B4513'
        }));
      }
    }

    // Title letters (each as separate text object)
    const titleStr = 'SN@KELIKE';
    const titleFS = 48;
    const meas = this.add.text(-999, -999, titleStr, {
      fontFamily: 'monospace', fontSize: titleFS + 'px'
    });
    const titleTotalW = meas.width || (titleStr.length * titleFS * 0.6);
    const ltrW = titleTotalW / titleStr.length;
    meas.destroy();

    const titleX0 = cx - titleTotalW / 2;
    const titleY = cy - 40;
    const atIdx = titleStr.indexOf('@');
    const titleLetters = [];
    let atObj = null;

    for (let i = 0; i < titleStr.length; i++) {
      const t = this.add.text(titleX0 + i * ltrW + ltrW / 2, titleY, titleStr[i], {
        fontFamily: 'monospace', fontSize: titleFS + 'px', color: '#00ff00'
      }).setOrigin(0.5).setDepth(10);
      if (i === atIdx) atObj = t;
      else titleLetters.push({ obj: t, idx: i });
    }

    const prompt = this.add.text(cx, cy + 30, 'Press any key to start', {
      fontFamily: 'monospace', fontSize: '18px', color: '#888888'
    }).setOrigin(0.5);
    const instruct = this.add.text(cx, cy + 70, 'WASD or Arrow Keys to move', {
      fontFamily: 'monospace', fontSize: '14px', color: '#555555'
    }).setOrigin(0.5);

    // ======== ANIMATE ========
    this._playTransitionSound();

    // Subtitles fade
    this.tweens.add({ targets: [prompt, instruct], alpha: 0, duration: 150 });

    // Title letters scatter outward from @
    for (const { obj, idx } of titleLetters) {
      const side = idx < atIdx ? -1 : 1;
      const dist = Math.abs(idx - atIdx);
      this.tweens.add({
        targets: obj,
        x: obj.x + side * (200 + Math.random() * 350),
        y: obj.y + (Math.random() - 0.5) * 300,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        rotation: side * (0.5 + Math.random() * 2),
        duration: 450, delay: 50 + dist * 50,
        ease: 'Power3.easeIn'
      });
    }

    // @ pulse → fly → shrink to snake head
    if (atObj) {
      atObj.setDepth(20);
      this.tweens.add({
        targets: atObj,
        scaleX: 1.5, scaleY: 1.5,
        duration: 180, delay: 100,
        yoyo: true, ease: 'Sine.easeOut'
      });
      this.tweens.add({
        targets: atObj,
        x: snakeScreenX + TILE_SIZE / 2,
        y: snakeScreenY + TILE_SIZE / 2,
        scaleX: TILE_SIZE / titleFS,
        scaleY: TILE_SIZE / titleFS,
        duration: 650, delay: 350,
        ease: 'Power3.easeInOut'
      });
      // Green ghost trail behind flying @
      this.time.delayedCall(350, () => {
        this.time.addEvent({
          delay: 45, repeat: 13,
          callback: () => {
            if (!atObj || !atObj.active) return;
            const sz = Math.max(10, titleFS * atObj.scaleX);
            const ghost = this.add.text(atObj.x, atObj.y, '@', {
              fontFamily: 'monospace', fontSize: sz + 'px', color: '#00ff00'
            }).setOrigin(0.5).setAlpha(0.35).setDepth(15);
            this.tweens.add({
              targets: ghost, alpha: 0, scaleX: 0.4, scaleY: 0.4,
              duration: 250, onComplete: () => ghost.destroy()
            });
          }
        });
      });
    }

    // Flame chars scatter as rising sparks
    for (const f of flameChars) {
      const a = Math.random() * Math.PI * 2;
      const d = 150 + Math.random() * 450;
      this.tweens.add({
        targets: f,
        x: f.x + Math.cos(a) * d,
        y: f.y + Math.sin(a) * d - 80,
        alpha: 0, scaleX: 1.8, scaleY: 0.4,
        duration: 300 + Math.random() * 300,
        delay: 150 + Math.random() * 250,
        ease: 'Power2.easeOut'
      });
    }

    // Torch handles dissolve
    this.tweens.add({ targets: handles, alpha: 0, duration: 250, delay: 150 });

    // Wall #s — sort by distance from @ for shockwave stagger
    const atPx = atObj ? atObj.x : cx;
    const atPy = atObj ? atObj.y : cy;
    wallChars.sort((a, b) => {
      return ((a.x - atPx) ** 2 + (a.y - atPy) ** 2) -
             ((b.x - atPx) ** 2 + (b.y - atPy) ** 2);
    });
    const maxDiag = Math.sqrt(W * W + H * H);
    let wIdx = 0;

    // Wall → dungeon wall positions (Back easing for satisfying overshoot)
    const wMax = Math.max(0, Math.min(wallChars.length - numBaddies - numRats, wallTargets.length));
    for (let i = 0; i < wMax && wIdx < wallChars.length; i++) {
      const obj = wallChars[wIdx++];
      const tgt = wallTargets[i];
      const dist = Math.sqrt((obj.x - atPx) ** 2 + (obj.y - atPy) ** 2);
      const norm = dist / maxDiag;
      this.tweens.add({
        targets: obj,
        x: tgt.x, y: tgt.y, alpha: 1,
        duration: 600 + Math.random() * 200,
        delay: 300 + norm * 500,
        ease: 'Back.easeOut',
        onComplete: () => obj.setColor(COLOR_WALL)
      });
    }

    // Wall → baddie positions (flame streaks with spark trails)
    for (let i = 0; i < baddieScreenTargets.length && wIdx < wallChars.length; i++) {
      const obj = wallChars[wIdx++];
      const tgt = baddieScreenTargets[i];
      obj.setColor('#ff2200');
      const delay = 300 + Math.random() * 300;
      this.tweens.add({
        targets: obj,
        x: tgt.x, y: tgt.y,
        duration: 750, delay: delay,
        ease: 'Power4.easeIn',
        onUpdate: () => {
          const c = ['#ff0000', '#ff2200', '#ff4400', '#ff6600', '#ff8800', '#ffaa00'];
          obj.setColor(c[Math.floor(Math.random() * c.length)]);
        },
        onComplete: () => {
          obj.setText('B').setColor(COLOR_BADDIE).setFontSize(16);
          const burst = this.add.text(tgt.x, tgt.y, '#', {
            fontFamily: 'monospace', fontSize: '28px', color: '#ff4400'
          }).setOrigin(0.3).setAlpha(0.9).setDepth(5);
          this.tweens.add({
            targets: burst, alpha: 0, scaleX: 2.5, scaleY: 2.5,
            duration: 250, onComplete: () => burst.destroy()
          });
        }
      });
      // Fire spark trail
      this.time.delayedCall(delay, () => {
        this.time.addEvent({
          delay: 60, repeat: 10,
          callback: () => {
            if (!obj.active) return;
            const spark = this.add.text(
              obj.x + (Math.random() - 0.5) * 12,
              obj.y + (Math.random() - 0.5) * 12, '#', {
              fontFamily: 'monospace', fontSize: '10px', color: '#ffaa00'
            }).setAlpha(0.7);
            this.tweens.add({
              targets: spark, alpha: 0, y: spark.y - 20,
              duration: 200, onComplete: () => spark.destroy()
            });
          }
        });
      });
    }

    // Wall → rat positions (yellow streaks)
    for (let i = 0; i < ratScreenTargets.length && wIdx < wallChars.length; i++) {
      const obj = wallChars[wIdx++];
      const tgt = ratScreenTargets[i];
      obj.setColor('#ffff00');
      const delay = 350 + Math.random() * 300;
      this.tweens.add({
        targets: obj,
        x: tgt.x, y: tgt.y,
        duration: 700, delay: delay,
        ease: 'Power3.easeIn',
        onUpdate: () => {
          const c = ['#ffff00', '#ffee00', '#ffdd00', '#ffffff'];
          obj.setColor(c[Math.floor(Math.random() * c.length)]);
        },
        onComplete: () => obj.setText('r').setColor(COLOR_RAT).setFontSize(16)
      });
    }

    // Remaining wall #s: explode outward and dissolve
    for (let i = wIdx; i < wallChars.length; i++) {
      const obj = wallChars[i];
      const a = Math.random() * Math.PI * 2;
      const d = 200 + Math.random() * 600;
      const dist = Math.sqrt((obj.x - atPx) ** 2 + (obj.y - atPy) ** 2);
      const norm = dist / maxDiag;
      this.tweens.add({
        targets: obj,
        x: obj.x + Math.cos(a) * d,
        y: obj.y + Math.sin(a) * d,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 400 + Math.random() * 400,
        delay: 250 + norm * 400,
        ease: 'Power2.easeOut'
      });
    }

    // After morph: show staircase, auto-walk @ into it, then show dungeon message
    const stairDir = this.introStairDir;
    if (stairDir) {
      const stairSX = (snakeX + stairDir.x) * TILE_SIZE - gameCamX;
      const stairSY = (snakeY + stairDir.y) * TILE_SIZE - gameCamY;

      // Show staircase after walls settle
      const stairObj = this.add.text(stairSX + TILE_SIZE / 2, stairSY + TILE_SIZE / 2, '>', {
        fontFamily: 'monospace', fontSize: '16px', color: COLOR_STAIRCASE
      }).setOrigin(0.5).setDepth(20).setAlpha(0);

      this.time.delayedCall(1100, () => {
        this.tweens.add({ targets: stairObj, alpha: 1, duration: 300, ease: 'Sine.easeIn' });
      });

      // Auto-walk @ into the staircase
      this.time.delayedCall(1600, () => {
        if (atObj && atObj.active) {
          this.tweens.add({
            targets: atObj,
            x: stairSX + TILE_SIZE / 2,
            y: stairSY + TILE_SIZE / 2,
            duration: 300,
            ease: 'Linear',
            onComplete: () => {
              stairObj.setAlpha(0);
              this.cameras.main.shake(200, 0.006);
              this._showDungeonMessage();
            }
          });
        } else {
          this._showDungeonMessage();
        }
      });
    } else {
      // Fallback: no adjacent floor tile found, go straight to game
      this.time.delayedCall(1400, () => this._startGame());
    }

    this.initialDirection = null;
  }

  _showDungeonMessage() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2;
    const cy = H / 2;

    const overlay = this.add.rectangle(cx, cy, W + 200, H + 200, 0x000000, 0.85).setDepth(200);

    const msgText = this.add.text(cx, cy - 20,
      'You descend into the castle dungeon.\nThe walls are etched with murals\nof ancient sultans...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffcc00',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5).setDepth(201);

    const continueText = this.add.text(cx, cy + 60, 'Press any key to continue', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(201);

    this.tweens.add({
      targets: continueText, alpha: 0.3,
      duration: 600, yoyo: true, repeat: -1
    });

    this.time.delayedCall(300, () => {
      this.input.keyboard.once('keydown', () => {
        this._startGame();
      });
    });
  }

  _startGame() {
    if (this.skipDone) return;
    this.skipDone = true;
    this.scene.start('GameScene', {
      level: this.level,
      snakeLength: this.snakeLength,
      baddiesKilled: this.baddiesKilled,
      maxSnakeLength: this.maxSnakeLength,
      score: this.currentScore,
      preGenerated: this.dungeonData,
      initialDirection: this.initialDirection
    });
  }

  _findFloor(grid, mapW, mapH, rooms, snake, rats, baddies) {
    for (let i = 0; i < 1000; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (x <= 0 || x >= mapW - 1 || y <= 0 || y >= mapH - 1) continue;
      if (grid[y][x] !== FLOOR) continue;
      if (snake.some(s => s.x === x && s.y === y)) continue;
      if (rats.some(r => r.x === x && r.y === y)) continue;
      if (baddies.some(b => b.x === x && b.y === y)) continue;
      return { x, y };
    }
    for (let y = 1; y < mapH - 1; y++) {
      for (let x = 1; x < mapW - 1; x++) {
        if (grid[y][x] === FLOOR) return { x, y };
      }
    }
    return { x: 1, y: 1 };
  }

  _playTransitionSound() {
    try {
      const ctx = this.sound && this.sound.context;
      if (!ctx) return;

      // Rising whoosh
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(80, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.6);
      osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 1.0);
      g1.gain.setValueAtTime(0, ctx.currentTime);
      g1.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
      g1.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.6);
      g1.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.3);
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.start(); osc1.stop(ctx.currentTime + 1.3);
      osc1.onended = () => { g1.disconnect(); osc1.disconnect(); };

      // High shimmer
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2000, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(4000, ctx.currentTime + 0.8);
      g2.gain.setValueAtTime(0, ctx.currentTime);
      g2.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.2);
      g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(); osc2.stop(ctx.currentTime + 0.9);
      osc2.onended = () => { g2.disconnect(); osc2.disconnect(); };

      // Impact thud at ~1.2s
      setTimeout(() => {
        try {
          const osc3 = ctx.createOscillator();
          const g3 = ctx.createGain();
          osc3.type = 'triangle';
          osc3.frequency.setValueAtTime(80, ctx.currentTime);
          osc3.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.2);
          g3.gain.setValueAtTime(0.12, ctx.currentTime);
          g3.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
          osc3.connect(g3); g3.connect(ctx.destination);
          osc3.start(); osc3.stop(ctx.currentTime + 0.25);
          osc3.onended = () => { g3.disconnect(); osc3.disconnect(); };
        } catch (e) {}
      }, 1200);
    } catch (e) {}
  }
}

// ============================================================
// GAME OVER SCENE
// ============================================================

class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    this.level = data.level || 1;
    this.snakeLength = data.length || 1;
    this.baddiesKilled = data.baddiesKilled || 0;
    this.maxSnakeLength = data.maxSnakeLength || 1;
    this.score = data.score || ((this.level * POINTS_PER_LEVEL) + (this.baddiesKilled * POINTS_PER_KILL) + (this.maxSnakeLength * POINTS_PER_MAX_LENGTH));
    this.ratsEaten = data.ratsEaten || 0;
    this.timeSurvived = data.timeSurvived || 0;
    this.causeOfDeath = data.causeOfDeath || 'unknown';
    this.nameEntry = '';
    this.inputActive = false;

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Load personal bests
    let bests = {};
    try {
      bests = JSON.parse(localStorage.getItem('snakelike_bests') || '{}');
    } catch (e) {}

    // Check for new personal bests
    const newBests = {};
    const stats = {
      level: this.level,
      kills: this.baddiesKilled,
      maxLength: this.maxSnakeLength,
      ratsEaten: this.ratsEaten,
      timeSurvived: this.timeSurvived,
      score: this.score
    };
    for (const [key, val] of Object.entries(stats)) {
      if (val > (bests[key] || 0)) {
        newBests[key] = true;
        bests[key] = val;
      }
    }
    try {
      localStorage.setItem('snakelike_bests', JSON.stringify(bests));
    } catch (e) {}

    // Title
    this.add.text(cx, 40, 'GAME OVER', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff0000'
    }).setOrigin(0.5);

    this.add.text(cx, 75, `You reached depth ${this.level} of the Endless Dungeon`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#888888'
    }).setOrigin(0.5);

    // Cause of death
    this.add.text(cx, 95, `Cause of death: ${this.causeOfDeath}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#666666'
    }).setOrigin(0.5);

    // Stats displayed one-by-one with delays
    const statLines = [
      { label: 'Depth Reached', value: this.level, key: 'level' },
      { label: 'Baddies Killed', value: this.baddiesKilled, key: 'kills' },
      { label: 'Max Length', value: this.maxSnakeLength, key: 'maxLength' },
      { label: 'Rats Eaten', value: this.ratsEaten, key: 'ratsEaten' },
      { label: 'Time Survived', value: `${Math.floor(this.timeSurvived / 60)}m ${this.timeSurvived % 60}s`, key: 'timeSurvived' },
      { label: 'Final Score', value: this.score, key: 'score' }
    ];

    const startY = 125;
    const lineH = 28;

    statLines.forEach((stat, i) => {
      this.time.delayedCall(400 + i * 350, () => {
        const pb = newBests[stat.key] ? '  ★ NEW BEST!' : '';
        const color = newBests[stat.key] ? '#ffff00' : '#cccccc';
        this.add.text(cx, startY + i * lineH, `${stat.label}: ${stat.value}${pb}`, {
          fontFamily: 'monospace', fontSize: '16px', color: color
        }).setOrigin(0.5);
      });
    });

    // After all stats shown, load leaderboard
    const leaderboardDelay = 400 + statLines.length * 350 + 500;
    this.time.delayedCall(leaderboardDelay, () => {
      this.showLeaderboardSection(cx, startY + statLines.length * lineH + 15);
    });
  }

  showLeaderboardSection(cx, topY) {
    const loadingText = this.add.text(cx, topY, 'Loading leaderboard...', {
      fontFamily: 'monospace', fontSize: '14px', color: '#555555'
    }).setOrigin(0.5);

    fetchLeaderboard().then(entries => {
      loadingText.destroy();
      const qualifies = this.score > 0 && qualifiesForLeaderboard(this.score, entries);
      if (qualifies) {
        this.showNameEntry(cx, topY, entries);
      } else {
        this.showLeaderboard(cx, topY, entries);
        this.addRestartListener();
      }
    }).catch(() => {
      loadingText.destroy();
      this.addRestartListener();
    });
  }

  showNameEntry(cx, topY, entries) {
    this.add.text(cx, topY, 'NEW HIGH SCORE!', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffff00'
    }).setOrigin(0.5);

    this.add.text(cx, topY + 35, 'Enter your name:', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888'
    }).setOrigin(0.5);

    this.nameText = this.add.text(cx, topY + 65, '_', {
      fontFamily: 'monospace', fontSize: '24px', color: '#00ff00'
    }).setOrigin(0.5);

    this.inputActive = true;

    this.input.keyboard.on('keydown', (event) => {
      if (!this.inputActive) return;

      if (event.key === 'Enter' && this.nameEntry.length > 0) {
        this.inputActive = false;
        this.doSubmit(cx, topY, entries);
        return;
      }

      if (event.key === 'Backspace') {
        this.nameEntry = this.nameEntry.slice(0, -1);
      } else if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key) && this.nameEntry.length < 12) {
        this.nameEntry += event.key;
      }

      this.nameText.setText(this.nameEntry + '_');
    });
  }

  async doSubmit(cx, topY, entries) {
    const name = this.nameEntry.trim();
    if (!name) { this.inputActive = true; return; }

    this.nameText.setText('Submitting...');

    let finalEntries;
    try {
      await submitToLeaderboard(name, this.score, this.level, this.baddiesKilled, this.maxSnakeLength);
      finalEntries = await fetchLeaderboard();
    } catch (e) {
      finalEntries = entries;
    }

    // Clear name entry UI and show leaderboard in same area
    this.nameText.destroy();
    this.showLeaderboard(cx, topY, finalEntries);
    this.addRestartListener();
  }

  showLeaderboard(cx, startY, entries) {
    const sorted = [...entries].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, LEADERBOARD_SIZE);

    this.add.text(cx, startY, '── LEADERBOARD ──', {
      fontFamily: 'monospace', fontSize: '16px', color: '#00ffff'
    }).setOrigin(0.5);

    if (sorted.length === 0) {
      this.add.text(cx, startY + 25, 'No scores yet', {
        fontFamily: 'monospace', fontSize: '14px', color: '#555555'
      }).setOrigin(0.5);
    } else {
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const rank = String(i + 1).padStart(2);
        const displayName = entry.name.replace(/_\d+$/, '');
        const eName = displayName.substring(0, 12).padEnd(12);
        const eScore = String(Number(entry.score)).padStart(6);
        this.add.text(cx, startY + 25 + i * 22, `${rank}. ${eName} ${eScore}`, {
          fontFamily: 'monospace', fontSize: '14px', color: i < 3 ? '#ffff00' : '#aaaaaa'
        }).setOrigin(0.5);
      }
    }
  }

  addRestartListener() {
    const cx = this.cameras.main.centerX;
    const bottom = this.cameras.main.height - 30;
    this.add.text(cx, bottom, 'Press any key to restart', {
      fontFamily: 'monospace', fontSize: '18px', color: '#888888'
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown', () => {
      this.scene.start('TitleScene');
    });
  }
}

// ============================================================
// FLAVOR TEXT SCENE — Between levels
// ============================================================

const FLAVOR_TEXTS = [
  'The walls writhe as you descend deeper...',
  'Something slithers in the darkness below...',
  'The air grows thick with ancient dust...',
  'Echoes of forgotten creatures haunt these halls...',
  'The dungeon pulses with a heartbeat not your own...',
  'Deeper still... the stones whisper your name...',
  'A chill wind carries the scent of decay...',
  'The shadows move when you are not looking...',
  'You feel the weight of the earth above you...',
  'The darkness here has teeth...'
];

class FlavorTextScene extends Phaser.Scene {
  constructor() { super('FlavorTextScene'); }

  init(data) {
    this.nextLevel = data.level || 2;
    this.snakeLength = data.snakeLength || 1;
    this.baddiesKilled = data.baddiesKilled || 0;
    this.maxSnakeLength = data.maxSnakeLength || 1;
    this.currentScore = data.score || 0;
  }

  create() {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    const text = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];

    this.add.text(cx, cy, text, {
      fontFamily: 'monospace', fontSize: '18px', color: '#888888',
      align: 'center', wordWrap: { width: 600 }
    }).setOrigin(0.5).setAlpha(0);

    // Fade in
    this.tweens.add({
      targets: this.children.list[0],
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeIn'
    });

    // Transition to next level after 2 seconds
    this.time.delayedCall(2000, () => {
      this.scene.start('TransitionScene', {
        level: this.nextLevel,
        snakeLength: this.snakeLength,
        baddiesKilled: this.baddiesKilled,
        maxSnakeLength: this.maxSnakeLength,
        score: this.currentScore
      });
    });
  }
}

// ============================================================
// GAME SCENE
// ============================================================

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.level = data.level || 1;
    this.initialSnakeLength = data.snakeLength || 1;
    this.baddiesKilled = data.baddiesKilled || 0;
    this.maxSnakeLength = data.maxSnakeLength || 1;
    this.currentScore = data.score || 0;
    this.preGenerated = data.preGenerated || null;
    this.fromTransition = !!data.preGenerated;
    this.initialDirection = data.initialDirection || null;
  }

  updateScore() {
    this.currentScore = (this.level * POINTS_PER_LEVEL)
      + (this.baddiesKilled * POINTS_PER_KILL)
      + (this.maxSnakeLength * POINTS_PER_MAX_LENGTH);
  }

  create() {
    // Map dimensions & dungeon
    if (this.preGenerated) {
      this.mapW = this.preGenerated.mapW;
      this.mapH = this.preGenerated.mapH;
      this.grid = this.preGenerated.grid;
      this.rooms = this.preGenerated.rooms;
    } else {
      this.mapW = 35 + 5 * this.level;
      this.mapH = 27 + 3 * this.level;
      const dungeon = generateDungeon(this.mapW, this.mapH, this.level);
      this.grid = dungeon.grid;
      this.rooms = dungeon.rooms;
      this._dungeonHazards = dungeon;
    }

    // Visibility
    this.visibility = [];
    for (let y = 0; y < this.mapH; y++) {
      this.visibility[y] = new Array(this.mapW).fill(UNEXPLORED);
    }

    // Display grid
    this.displayGrid = [];
    for (let y = 0; y < this.mapH; y++) {
      this.displayGrid[y] = new Array(this.mapW).fill(null);
    }

    // Previous render state (for dirty tracking)
    this.prevRender = [];
    for (let y = 0; y < this.mapH; y++) {
      this.prevRender[y] = new Array(this.mapW).fill(null);
    }

    // Create all text objects
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const txt = this.add.text(x * TILE_SIZE, y * TILE_SIZE, '', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#000000',
          fixedWidth: TILE_SIZE,
          fixedHeight: TILE_SIZE,
          align: 'center'
        });
        txt.setOrigin(0, 0);
        this.displayGrid[y][x] = txt;
      }
    }

    // Place snake
    this.snake = [];
    let startX, startY;
    if (this.preGenerated) {
      startX = this.preGenerated.snakeX;
      startY = this.preGenerated.snakeY;
    } else {
      const startRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      startX = Math.floor(startRoom.x + startRoom.w / 2);
      startY = Math.floor(startRoom.y + startRoom.h / 2);
    }
    this.snake.push({ x: startX, y: startY });

    // Grow to initial length if carrying over from previous level
    if (this.initialSnakeLength > 1) {
      for (let i = 1; i < this.initialSnakeLength; i++) {
        this.snake.push({ x: startX, y: startY });
      }
    }

    this.direction = null;
    this.nextDirection = null;
    this.moving = false;
    this.growCount = 0;

    // Place rats
    if (this.preGenerated) {
      this.numRats = this.preGenerated.rats.length;
      this.rats = this.preGenerated.rats.map(r => ({ x: r.x, y: r.y }));
    } else {
      this.numRats = 4 + this.level;
      this.rats = [];
      for (let i = 0; i < this.numRats; i++) {
        this.rats.push(this.randomFloorTile());
      }
    }

    // Place baddies
    if (this.preGenerated) {
      this.numBaddies = this.preGenerated.baddies.length;
      this.baddies = this.preGenerated.baddies.map(b => ({
        x: b.x, y: b.y,
        primaryDirection: b.primaryDirection,
        state: b.state,
        shiftRemaining: b.shiftRemaining,
        shiftDirection: b.shiftDirection
      }));
    } else {
      const isBossLevel = this.level % 5 === 0;
      this.numBaddies = isBossLevel ? Math.floor((4 + this.level) / 2) : 4 + this.level;
      this.baddies = [];
      const allDirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
      for (let i = 0; i < this.numBaddies; i++) {
        const pos = this.randomFloorTile();
        this.baddies.push({
          x: pos.x, y: pos.y,
          primaryDirection: allDirs[Math.floor(Math.random() * 4)],
          state: AI_MOVING, shiftRemaining: 0, shiftDirection: DIR.LEFT
        });
      }
    }

    // Boss enemy (every 5th level)
    this.boss = null;
    this.bossFlashTimer = 0;
    if (this.level % 5 === 0) {
      const bossPos = this.randomFloorTile();
      this.boss = {
        x: bossPos.x, y: bossPos.y,
        hp: 3,
        maxHp: 3,
        flashing: false
      };
    }

    // Place hazards
    if (this.preGenerated) {
      this.lavaTiles = this.preGenerated.lavaTiles || [];
      this.trapTiles = this.preGenerated.trapTiles || [];
      this.teleporters = this.preGenerated.teleporters || [];
    } else if (this._dungeonHazards) {
      this.lavaTiles = this._dungeonHazards.lavaTiles || [];
      this.trapTiles = this._dungeonHazards.trapTiles || [];
      this.teleporters = this._dungeonHazards.teleporters || [];
      this._dungeonHazards = null;
    } else {
      this.lavaTiles = [];
      this.trapTiles = [];
      this.teleporters = [];
    }

    this.preGenerated = null;

    // Place power-ups
    this.powerups = [];
    const powerupTypes = ['speed', 'shield', 'phase'];
    for (let i = 0; i < 3; i++) {
      const pos = this.randomFloorTile();
      this.powerups.push({ x: pos.x, y: pos.y, type: powerupTypes[i] });
    }

    // Active power-up state
    this.activePowerup = null;
    this.shieldActive = false;
    this.phaseActive = false;
    this.originalSnakeMoveInterval = 200;

    this.staircase = null;
    this.staircasePlaced = false;

    // Audio context
    this.audioCtx = null;
    try {
      if (this.sound && this.sound.context) {
        this.audioCtx = this.sound.context;
      }
    } catch (e) {}

    // Camera
    this.cameras.main.setBounds(0, 0, this.mapW * TILE_SIZE, this.mapH * TILE_SIZE);

    // We'll use the head text object for camera follow
    this.headFollowObj = this.displayGrid[startY][startX];
    this.cameras.main.startFollow(this.headFollowObj, true, 0.15, 0.15);

    // HUD
    this.hudText = this.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    });
    this.hudText.setScrollFactor(0);
    this.hudText.setDepth(100);

    this.scoreText = this.add.text(this.cameras.main.width - 10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffff00',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    }).setOrigin(1, 0);
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(100);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');

    this.paused = false;
    this.pauseOverlay = null;
    this.keyESC = this.input.keyboard.addKey('ESC');
    this.keyP = this.input.keyboard.addKey('P');
    this.keySPACE = this.input.keyboard.addKey('SPACE');

    // Timers
    this.snakeMoveTimer = 0;
    this.snakeMoveInterval = 200;
    this.baddieMoveTimer = 0;
    this.baddieMoveInterval = 300;

    this.gameOver = false;

    // Run stats tracking
    this.ratsEaten = 0;
    this.gameStartTime = this.time.now;
    this.causeOfDeath = 'unknown';

    // Projectiles
    this.projectiles = [];
    this.projectileMoveTimer = 0;
    this.projectileMoveInterval = 100;

    // Initial FOV
    computeFOV(this.grid, this.visibility, this.snake[0].x, this.snake[0].y, FOV_RADIUS);

    playLevelStartDrone(this.audioCtx);

    // Render initial state
    this.renderMap();

    // If a direction was captured during transition, start moving immediately
    if (this.fromTransition && this.initialDirection) {
      this.direction = this.initialDirection;
      this.nextDirection = this.initialDirection;
      this.moving = true;
      this.snakeMoveTimer = this.snakeMoveInterval;
    }
  }

  randomFloorTile() {
    const maxAttempts = 1000;
    for (let i = 0; i < maxAttempts; i++) {
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      const x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (x <= 0 || x >= this.mapW - 1 || y <= 0 || y >= this.mapH - 1) continue;
      if (this.grid[y][x] !== FLOOR) continue;
      // Check not on snake
      if (this.snake && this.snake.some(s => s.x === x && s.y === y)) continue;
      // Check not on rats
      if (this.rats && this.rats.some(r => r.x === x && r.y === y)) continue;
      // Check not on baddies
      if (this.baddies && this.baddies.some(b => b.x === x && b.y === y)) continue;
      // Check not on staircase
      if (this.staircase && this.staircase.x === x && this.staircase.y === y) continue;
      // Check not on hazards
      if (this.lavaTiles && this.lavaTiles.some(l => l.x === x && l.y === y)) continue;
      if (this.trapTiles && this.trapTiles.some(t => t.x === x && t.y === y)) continue;
      if (this.teleporters && this.teleporters.some(t => t.x === x && t.y === y)) continue;
      if (this.powerups && this.powerups.some(p => p.x === x && p.y === y)) continue;
      return { x, y };
    }
    // Fallback: just find any floor tile
    for (let y = 1; y < this.mapH - 1; y++) {
      for (let x = 1; x < this.mapW - 1; x++) {
        if (this.grid[y][x] === FLOOR) return { x, y };
      }
    }
    return { x: 1, y: 1 };
  }

  update(time, delta) {
    if (this.gameOver) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyESC) || Phaser.Input.Keyboard.JustDown(this.keyP)) {
      this.togglePause();
    }
    if (this.paused) {
      if (this.keyM && Phaser.Input.Keyboard.JustDown(this.keyM)) {
        const current = isSoundEnabled();
        try { localStorage.setItem('snakelike_sound', current ? 'off' : 'on'); } catch(e) {}
        if (this.pauseSoundText) {
          this.pauseSoundText.setText(`Sound: ${!current ? 'ON' : 'OFF'}  [Press M to toggle]`);
        }
      }
      return;
    }

    // Read input
    this.handleInput();

    // Snake movement timer
    if (this.moving) {
      this.snakeMoveTimer += delta;
      if (this.snakeMoveTimer >= this.snakeMoveInterval) {
        this.snakeMoveTimer -= this.snakeMoveInterval;
        this.moveSnake();
      }
    }

    // Baddie movement timer (only after player starts moving)
    if (this.moving) {
      this.baddieMoveTimer += delta;
      if (this.baddieMoveTimer >= this.baddieMoveInterval) {
        this.baddieMoveTimer -= this.baddieMoveInterval;
        this.moveBaddies();
        this.moveBoss();
      }
    }

    // Projectile movement timer
    if (this.projectiles.length > 0) {
      this.projectileMoveTimer += delta;
      if (this.projectileMoveTimer >= this.projectileMoveInterval) {
        this.projectileMoveTimer -= this.projectileMoveInterval;
        this.moveProjectiles();
      }
    }

    // Update HUD
    const aliveRats = this.rats.length;
    const aliveBaddies = this.baddies.length;
    const canFire = this.snake.length >= 3 && this.direction;
    let hudStr = `Level: ${this.level}  Rats: ${aliveRats}  Baddies: ${aliveBaddies}  Length: ${this.snake.length}  ${canFire ? '[SPACE:Fire]' : ''}`;
    if (this.boss) {
      hudStr += `  Boss: ${'♥'.repeat(this.boss.hp)}${'♡'.repeat(this.boss.maxHp - this.boss.hp)}`;
    }
    if (this.activePowerup) {
      const icons = { speed: '⚡', shield: '🛡️', phase: '👻' };
      const secs = Math.ceil(this.activePowerup.remaining / 1000);
      hudStr += `  ${icons[this.activePowerup.type]} ${secs}s`;
    }
    this.hudText.setText(hudStr);
    this.scoreText.setText(`Score: ${this.currentScore}`);

    // Update power-up timer
    if (this.activePowerup) {
      this.activePowerup.remaining -= delta;
      if (this.activePowerup.remaining <= 0) {
        this.deactivatePowerup();
      }
    }

    // Boss flash timer
    if (this.boss && this.boss.flashing) {
      this.bossFlashTimer -= delta;
      if (this.bossFlashTimer <= 0) {
        this.boss.flashing = false;
      }
    }

    // Update camera follow target
    const head = this.snake[0];
    if (this.displayGrid[head.y] && this.displayGrid[head.y][head.x]) {
      const newTarget = this.displayGrid[head.y][head.x];
      if (this.headFollowObj !== newTarget) {
        this.headFollowObj = newTarget;
        this.cameras.main.startFollow(this.headFollowObj, true, 0.15, 0.15);
      }
    }

    this.renderMap();
  }

  handleInput() {
    let newDir = null;

    if (this.cursors.up.isDown || this.keyW.isDown) newDir = DIR.UP;
    else if (this.cursors.down.isDown || this.keyS.isDown) newDir = DIR.DOWN;
    else if (this.cursors.left.isDown || this.keyA.isDown) newDir = DIR.LEFT;
    else if (this.cursors.right.isDown || this.keyD.isDown) newDir = DIR.RIGHT;

    if (newDir) {
      if (!this.moving) {
        // First input — start moving
        this.direction = newDir;
        this.nextDirection = newDir;
        this.moving = true;
        this.snakeMoveTimer = this.snakeMoveInterval; // move immediately
      } else {
        // Can't reverse
        if (!this.direction || !dirsEqual(newDir, oppositeDir(this.direction))) {
          this.nextDirection = newDir;
        }
      }
    }

    // Fire projectile with SPACE
    if (Phaser.Input.Keyboard.JustDown(this.keySPACE) && this.direction && this.snake.length >= 3) {
      this.fireProjectile();
    }
  }

  fireProjectile() {
    this.snake.pop();
    this.snake.pop();

    const head = this.snake[0];
    this.projectiles.push({
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
      dx: this.direction.x,
      dy: this.direction.y
    });

    playLaserSound(this.audioCtx);
  }

  moveProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dx;
      p.y += p.dy;

      // Wall collision
      if (p.x <= 0 || p.x >= this.mapW - 1 || p.y <= 0 || p.y >= this.mapH - 1 ||
          this.grid[p.y][p.x] === WALL) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Baddie collision
      let hit = false;
      for (let j = this.baddies.length - 1; j >= 0; j--) {
        if (this.baddies[j].x === p.x && this.baddies[j].y === p.y) {
          this.baddies.splice(j, 1);
          this.baddiesKilled++;
          this.updateScore();
          playBaddieDeath(this.audioCtx);
          this.cameras.main.flash(100, 255, 255, 255, false, null, null, 0.2);
          hit = true;
          break;
        }
      }
      // Boss collision
      if (!hit && this.boss) {
        for (let oy = 0; oy < 2; oy++) {
          for (let ox = 0; ox < 2; ox++) {
            if (p.x === this.boss.x + ox && p.y === this.boss.y + oy) {
              this.boss.hp--;
              this.boss.flashing = true;
              this.bossFlashTimer = 300;
              playBossHit(this.audioCtx);
              this.cameras.main.shake(200, 0.01);
              if (this.boss.hp <= 0) {
                this.boss = null;
                this.baddiesKilled++;
                this.currentScore += 100;
                this.cameras.main.flash(200, 255, 200, 0, false, null, null, 0.4);
                playBaddieDeath(this.audioCtx);
                if (this.baddies.length === 0 && !this.staircasePlaced) {
                  this.placeStaircase();
                }
              }
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
      }
      if (hit) {
        this.projectiles.splice(i, 1);
        if (this.baddies.length === 0 && !this.boss && !this.staircasePlaced) {
          this.placeStaircase();
        }
      }
    }
  }

  moveSnake() {
    if (!this.direction) return;

    // Apply buffered direction
    if (this.nextDirection) {
      if (!dirsEqual(this.nextDirection, oppositeDir(this.direction))) {
        this.direction = this.nextDirection;
      }
    }

    const head = this.snake[0];
    const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= this.mapW || newHead.y < 0 || newHead.y >= this.mapH) {
      this.causeOfDeath = 'wall collision';
      this.doGameOver();
      return;
    }
    if (this.grid[newHead.y][newHead.x] === WALL) {
      if (this.phaseActive) {
        // Phase: pass through walls, find next floor tile in same direction
        let wx = newHead.x, wy = newHead.y;
        for (let step = 0; step < 20; step++) {
          wx += this.direction.x;
          wy += this.direction.y;
          if (wx <= 0 || wx >= this.mapW - 1 || wy <= 0 || wy >= this.mapH - 1) break;
          if (this.grid[wy][wx] === FLOOR) {
            newHead.x = wx;
            newHead.y = wy;
            break;
          }
        }
        if (this.grid[newHead.y][newHead.x] === WALL) {
          this.causeOfDeath = 'wall collision';
          this.doGameOver();
          return;
        }
      } else {
        this.causeOfDeath = 'wall collision';
        this.doGameOver();
        return;
      }
    }

    // Self-collision (check against body segments, not the tail if we're about to remove it)
    for (let i = 0; i < this.snake.length - (this.growCount > 0 ? 0 : 1); i++) {
      if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
        this.causeOfDeath = 'self collision';
        this.doGameOver();
        return;
      }
    }

    // Add new head
    this.snake.unshift(newHead);

    // Check growth
    let grewThisTick = false;
    if (this.growCount > 0) {
      this.growCount--;
      grewThisTick = true;
    } else {
      this.snake.pop();
    }

    // Check lava collision (instant death)
    for (const lava of this.lavaTiles) {
      if (newHead.x === lava.x && newHead.y === lava.y) {
        this.cameras.main.flash(200, 255, 68, 0, false, null, null, 0.5);
        this.causeOfDeath = 'lava';
        this.doGameOver();
        return;
      }
    }

    // Check trap collision (lose 1 segment)
    for (let i = this.trapTiles.length - 1; i >= 0; i--) {
      if (newHead.x === this.trapTiles[i].x && newHead.y === this.trapTiles[i].y) {
        if (this.snake.length <= 1) {
          this.causeOfDeath = 'trap';
          this.doGameOver();
          return;
        }
        this.snake.pop();
        this.trapTiles.splice(i, 1);
        playTrapSound(this.audioCtx);
        this.cameras.main.flash(100, 170, 0, 255, false, null, null, 0.2);
        break;
      }
    }

    // Check teleporter collision
    for (const tp of this.teleporters) {
      if (newHead.x === tp.x && newHead.y === tp.y) {
        this.snake[0].x = tp.pairX;
        this.snake[0].y = tp.pairY;
        playTeleportSound(this.audioCtx);
        this.cameras.main.flash(150, 255, 0, 255, false, null, null, 0.25);
        newHead.x = tp.pairX;
        newHead.y = tp.pairY;
        break;
      }
    }

    // Check power-up collision
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (newHead.x === pu.x && newHead.y === pu.y) {
        this.powerups.splice(i, 1);
        this.activatePowerup(pu.type);
        playPowerupPickup(this.audioCtx, pu.type);
        break;
      }
    }

    // Check body↔baddie collision (body kills baddie)
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      const b = this.baddies[i];
      for (let s = 1; s < this.snake.length; s++) {
        if (this.snake[s].x === b.x && this.snake[s].y === b.y) {
          this.baddies.splice(i, 1);
          this.baddiesKilled++;
          this.updateScore();
          playBaddieDeath(this.audioCtx);
          // White flash when killing baddie via body
          this.cameras.main.flash(100, 255, 255, 255, false, null, null, 0.2);
          break;
        }
      }
    }
    if (this.baddies.length === 0 && !this.boss && !this.staircasePlaced) {
      this.placeStaircase();
    }

    // Check body↔boss collision
    if (this.boss) {
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const tx = this.boss.x + ox;
          const ty = this.boss.y + oy;
          for (let s = 1; s < this.snake.length; s++) {
            if (this.snake[s].x === tx && this.snake[s].y === ty) {
              this.boss.hp--;
              this.boss.flashing = true;
              this.bossFlashTimer = 300;
              playBossHit(this.audioCtx);
              this.cameras.main.shake(200, 0.01);
              if (this.boss.hp <= 0) {
                this.boss = null;
                this.baddiesKilled++;
                this.currentScore += 100;
                this.cameras.main.flash(200, 255, 200, 0, false, null, null, 0.4);
                playBaddieDeath(this.audioCtx);
                if (this.baddies.length === 0 && !this.staircasePlaced) {
                  this.placeStaircase();
                }
              }
              break;
            }
          }
          if (!this.boss) break;
        }
        if (!this.boss) break;
      }
    }

    // Check rat collision
    for (let i = this.rats.length - 1; i >= 0; i--) {
      if (this.rats[i].x === newHead.x && this.rats[i].y === newHead.y) {
        this.rats.splice(i, 1);
        this.growCount++;
        this.ratsEaten++;
        if (this.snake.length + this.growCount > this.maxSnakeLength) {
          this.maxSnakeLength = this.snake.length + this.growCount;
          this.updateScore();
        }
        playEatSound(this.audioCtx);
        // Subtle green pulse when eating rat
        this.cameras.main.flash(120, 0, 255, 0, false, null, null, 0.15);
        break;
      }
    }

    // Check baddie-head collision (damage): always net -1 length
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      if (this.baddies[i].x === newHead.x && this.baddies[i].y === newHead.y) {
        if (this.shieldActive) {
          // Shield absorbs the hit
          this.shieldActive = false;
          this.activePowerup = null;
          this.cameras.main.flash(150, 68, 136, 255, false, null, null, 0.3);
          break;
        }
        const pops = grewThisTick ? 2 : 1;
        if (this.snake.length <= pops) {
          this.causeOfDeath = 'baddie damage';
          this.doGameOver();
          return;
        }
        for (let p = 0; p < pops; p++) this.snake.pop();
        // Screen shake + red flash on damage
        this.cameras.main.shake(150, 0.008);
        this.cameras.main.flash(100, 255, 0, 0, false, null, null, 0.3);
        break;
      }
    }

    // Check boss-head collision (damage)
    if (this.boss) {
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          if (newHead.x === this.boss.x + ox && newHead.y === this.boss.y + oy) {
            if (this.shieldActive) {
              this.shieldActive = false;
              this.activePowerup = null;
              this.cameras.main.flash(150, 68, 136, 255, false, null, null, 0.3);
            } else {
              const pops = grewThisTick ? 2 : 1;
              if (this.snake.length <= pops) {
                this.causeOfDeath = 'boss damage';
                this.doGameOver();
                return;
              }
              for (let p = 0; p < pops; p++) this.snake.pop();
              this.cameras.main.shake(150, 0.008);
              this.cameras.main.flash(100, 255, 0, 0, false, null, null, 0.3);
            }
            break;
          }
        }
      }
    }

    // Check staircase
    if (this.staircase && newHead.x === this.staircase.x && newHead.y === this.staircase.y) {
      playLevelTransition(this.audioCtx);
      this.scene.start('FlavorTextScene', { level: this.level + 1, snakeLength: this.snake.length, baddiesKilled: this.baddiesKilled, maxSnakeLength: this.maxSnakeLength, score: this.currentScore });
      return;
    }

    // Recompute FOV
    computeFOV(this.grid, this.visibility, newHead.x, newHead.y, FOV_RADIUS);
  }

  moveBaddies() {
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      const b = this.baddies[i];
      let nextX, nextY;

      if (b.state === AI_MOVING) {
        nextX = b.x + b.primaryDirection.x;
        nextY = b.y + b.primaryDirection.y;

        if (nextX <= 0 || nextX >= this.mapW - 1 || nextY <= 0 || nextY >= this.mapH - 1 ||
            this.grid[nextY][nextX] === WALL) {
          // Reverse and shift
          b.primaryDirection = oppositeDir(b.primaryDirection);
          b.state = AI_SHIFTING;
          b.shiftRemaining = 1 + Math.floor(Math.random() * 5);
          const perps = perpendicularDirs(b.primaryDirection);
          b.shiftDirection = perps[Math.floor(Math.random() * 2)];
          // Try shift move
          nextX = b.x + b.shiftDirection.x;
          nextY = b.y + b.shiftDirection.y;
          if (nextX <= 0 || nextX >= this.mapW - 1 || nextY <= 0 || nextY >= this.mapH - 1 ||
              this.grid[nextY][nextX] === WALL) {
            b.state = AI_MOVING;
            continue;
          }
          b.x = nextX;
          b.y = nextY;
          b.shiftRemaining--;
          if (b.shiftRemaining <= 0) b.state = AI_MOVING;
        } else {
          b.x = nextX;
          b.y = nextY;
        }
      } else {
        // SHIFTING state
        nextX = b.x + b.shiftDirection.x;
        nextY = b.y + b.shiftDirection.y;

        if (nextX <= 0 || nextX >= this.mapW - 1 || nextY <= 0 || nextY >= this.mapH - 1 ||
            this.grid[nextY][nextX] === WALL) {
          b.state = AI_MOVING;
          continue;
        }

        b.x = nextX;
        b.y = nextY;
        b.shiftRemaining--;
        if (b.shiftRemaining <= 0) b.state = AI_MOVING;
      }

      // Check if baddie on snake body (index 1+), baddie dies
      for (let s = 1; s < this.snake.length; s++) {
        if (this.snake[s].x === b.x && this.snake[s].y === b.y) {
          this.baddies.splice(i, 1);
          this.baddiesKilled++;
          this.updateScore();
          playBaddieDeath(this.audioCtx);
          // White flash when killing baddie
          this.cameras.main.flash(100, 255, 255, 255, false, null, null, 0.2);
          break;
        }
      }
    }

    // Check if baddie on snake head -> damage
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      const b = this.baddies[i];
      if (b.x === this.snake[0].x && b.y === this.snake[0].y) {
        if (this.shieldActive) {
          this.shieldActive = false;
          this.activePowerup = null;
          this.cameras.main.flash(150, 68, 136, 255, false, null, null, 0.3);
          continue;
        }
        if (this.snake.length <= 1) {
          this.causeOfDeath = 'baddie damage';
          this.doGameOver();
          return;
        }
        this.snake.pop();
        // Screen shake + red flash on damage
        this.cameras.main.shake(150, 0.008);
        this.cameras.main.flash(100, 255, 0, 0, false, null, null, 0.3);
      }
    }

    // Check if all baddies dead -> place staircase
    if (this.baddies.length === 0 && !this.boss && !this.staircasePlaced) {
      this.placeStaircase();
    }
  }

  moveBoss() {
    if (!this.boss) return;
    
    const head = this.snake[0];
    const b = this.boss;
    
    // Simple chase AI: move toward snake head
    let dx = 0, dy = 0;
    if (Math.abs(head.x - b.x) > Math.abs(head.y - b.y)) {
      dx = head.x > b.x ? 1 : (head.x < b.x ? -1 : 0);
    } else {
      dy = head.y > b.y ? 1 : (head.y < b.y ? -1 : 0);
    }
    
    const nx = b.x + dx;
    const ny = b.y + dy;
    
    // Check all 2x2 tiles the boss would occupy
    let canMove = true;
    for (let oy = 0; oy < 2; oy++) {
      for (let ox = 0; ox < 2; ox++) {
        const tx = nx + ox;
        const ty = ny + oy;
        if (tx <= 0 || tx >= this.mapW - 1 || ty <= 0 || ty >= this.mapH - 1) { canMove = false; break; }
        if (this.grid[ty][tx] === WALL) { canMove = false; break; }
      }
      if (!canMove) break;
    }
    
    if (canMove) {
      b.x = nx;
      b.y = ny;
    } else {
      // Try alternate direction
      const altDx = dx === 0 ? (Math.random() < 0.5 ? 1 : -1) : 0;
      const altDy = dy === 0 ? (Math.random() < 0.5 ? 1 : -1) : 0;
      const anx = b.x + altDx;
      const any = b.y + altDy;
      let canAlt = true;
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const tx = anx + ox;
          const ty = any + oy;
          if (tx <= 0 || tx >= this.mapW - 1 || ty <= 0 || ty >= this.mapH - 1) { canAlt = false; break; }
          if (this.grid[ty][tx] === WALL) { canAlt = false; break; }
        }
        if (!canAlt) break;
      }
      if (canAlt) {
        b.x = anx;
        b.y = any;
      }
    }
    
    playBossMove(this.audioCtx);
    
    // Check boss body collision with snake body (boss takes damage)
    for (let oy = 0; oy < 2; oy++) {
      for (let ox = 0; ox < 2; ox++) {
        const tx = b.x + ox;
        const ty = b.y + oy;
        for (let s = 1; s < this.snake.length; s++) {
          if (this.snake[s].x === tx && this.snake[s].y === ty) {
            b.hp--;
            b.flashing = true;
            this.bossFlashTimer = 300;
            playBossHit(this.audioCtx);
            this.cameras.main.shake(200, 0.01);
            if (b.hp <= 0) {
              this.boss = null;
              this.baddiesKilled++;
              this.currentScore += 100;
              this.cameras.main.flash(200, 255, 200, 0, false, null, null, 0.4);
              playBaddieDeath(this.audioCtx);
              if (this.baddies.length === 0 && !this.staircasePlaced) {
                this.placeStaircase();
              }
            }
            return;
          }
        }
      }
    }
    
    // Check boss collision with snake head (damage)
    for (let oy = 0; oy < 2; oy++) {
      for (let ox = 0; ox < 2; ox++) {
        const tx = b.x + ox;
        const ty = b.y + oy;
        if (this.snake[0].x === tx && this.snake[0].y === ty) {
          if (this.shieldActive) {
            this.shieldActive = false;
            this.activePowerup = null;
            this.cameras.main.flash(150, 68, 136, 255, false, null, null, 0.3);
            return;
          }
          if (this.snake.length <= 1) {
            this.causeOfDeath = 'boss damage';
            this.doGameOver();
            return;
          }
          this.snake.pop();
          this.cameras.main.shake(150, 0.008);
          this.cameras.main.flash(100, 255, 0, 0, false, null, null, 0.3);
          return;
        }
      }
    }
  }

  placeStaircase() {
    this.staircasePlaced = true;
    const head = this.snake[0];

    // Find room farthest from snake head
    let bestRoom = this.rooms[0];
    let bestDist = 0;
    for (const room of this.rooms) {
      const c = roomCenter(room);
      const d = Math.abs(c.x - head.x) + Math.abs(c.y - head.y);
      if (d > bestDist) {
        bestDist = d;
        bestRoom = room;
      }
    }

    // Collect unoccupied floor tiles in the farthest room
    const candidates = [];
    for (let dy = 0; dy < bestRoom.h; dy++) {
      for (let dx = 0; dx < bestRoom.w; dx++) {
        const tx = bestRoom.x + dx;
        const ty = bestRoom.y + dy;
        if (tx <= 0 || tx >= this.mapW - 1 || ty <= 0 || ty >= this.mapH - 1) continue;
        if (this.grid[ty][tx] !== FLOOR) continue;
        if (this.snake.some(s => s.x === tx && s.y === ty)) continue;
        if (this.rats.some(r => r.x === tx && r.y === ty)) continue;
        candidates.push({ x: tx, y: ty });
      }
    }

    if (candidates.length > 0) {
      const c = roomCenter(bestRoom);
      candidates.sort((a, b) => {
        const da = Math.abs(a.x - c.x) + Math.abs(a.y - c.y);
        const db = Math.abs(b.x - c.x) + Math.abs(b.y - c.y);
        return da - db;
      });
      this.staircase = candidates[0];
    } else {
      const c = roomCenter(bestRoom);
      this.staircase = { x: c.x, y: c.y };
    }

    // Remove any rat on the staircase tile
    for (let i = this.rats.length - 1; i >= 0; i--) {
      if (this.rats[i].x === this.staircase.x && this.rats[i].y === this.staircase.y) {
        this.rats.splice(i, 1);
      }
    }

    playStaircaseAppear(this.audioCtx);
  }

  doGameOver() {
    this.gameOver = true;
    playGameOver(this.audioCtx);
    const timeSurvived = Math.floor((this.time.now - this.gameStartTime) / 1000);
    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', {
        level: this.level,
        length: this.snake.length,
        baddiesKilled: this.baddiesKilled,
        maxSnakeLength: this.maxSnakeLength,
        score: this.currentScore,
        ratsEaten: this.ratsEaten || 0,
        timeSurvived: timeSurvived,
        causeOfDeath: this.causeOfDeath || 'unknown'
      });
    });
  }

  activatePowerup(type) {
    // Deactivate any current power-up first
    this.deactivatePowerup();

    if (type === 'speed') {
      this.activePowerup = { type: 'speed', remaining: 5000 };
      this.snakeMoveInterval = this.originalSnakeMoveInterval / 2;
    } else if (type === 'shield') {
      this.activePowerup = { type: 'shield', remaining: 30000 };
      this.shieldActive = true;
    } else if (type === 'phase') {
      this.activePowerup = { type: 'phase', remaining: 3000 };
      this.phaseActive = true;
    }
  }

  deactivatePowerup() {
    if (this.activePowerup) {
      if (this.activePowerup.type === 'speed') {
        this.snakeMoveInterval = this.originalSnakeMoveInterval;
      } else if (this.activePowerup.type === 'shield') {
        this.shieldActive = false;
      } else if (this.activePowerup.type === 'phase') {
        this.phaseActive = false;
      }
      this.activePowerup = null;
    }
  }

  togglePause() {
    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    this.paused = true;
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    this.pauseOverlay = this.add.rectangle(cx, cy, cam.width + 200, cam.height + 200, 0x000000, 0.7);
    this.pauseOverlay.setScrollFactor(0).setDepth(200);

    this.pauseTitle = this.add.text(cx, cy - 60, 'PAUSED', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.pauseSoundText = this.add.text(cx, cy, `Sound: ${isSoundEnabled() ? 'ON' : 'OFF'}  [Press M to toggle]`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.pauseControlsText = this.add.text(cx, cy + 35, 'WASD / Arrow Keys: Move\nSPACE: Fire projectile\nESC / P: Resume', {
      fontFamily: 'monospace', fontSize: '14px', color: '#666666', align: 'center', lineSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.pauseResumeText = this.add.text(cx, cy + 90, 'Press ESC or P to resume', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Sound toggle with M key while paused
    this.keyM = this.input.keyboard.addKey('M');
  }

  resumeGame() {
    this.paused = false;
    if (this.pauseOverlay) { this.pauseOverlay.destroy(); this.pauseOverlay = null; }
    if (this.pauseTitle) { this.pauseTitle.destroy(); this.pauseTitle = null; }
    if (this.pauseSoundText) { this.pauseSoundText.destroy(); this.pauseSoundText = null; }
    if (this.pauseControlsText) { this.pauseControlsText.destroy(); this.pauseControlsText = null; }
    if (this.pauseResumeText) { this.pauseResumeText.destroy(); this.pauseResumeText = null; }
  }

  renderMap() {
    const cam = this.cameras.main;
    // Calculate visible tile range (with some padding)
    const pad = 3;
    const startX = Math.max(0, Math.floor(cam.scrollX / TILE_SIZE) - pad);
    const startY = Math.max(0, Math.floor(cam.scrollY / TILE_SIZE) - pad);
    const endX = Math.min(this.mapW - 1, Math.ceil((cam.scrollX + cam.width) / TILE_SIZE) + pad);
    const endY = Math.min(this.mapH - 1, Math.ceil((cam.scrollY + cam.height) / TILE_SIZE) + pad);

    // Build entity lookup for visible area
    const entityMap = {};

    // Snake
    for (let i = 0; i < this.snake.length; i++) {
      const s = this.snake[i];
      const key = s.y * this.mapW + s.x;
      if (i === 0) {
        entityMap[key] = { char: '@', color: COLOR_SNAKE_HEAD };
      } else if (!entityMap[key]) {
        entityMap[key] = { char: 'o', color: COLOR_SNAKE_BODY };
      }
    }

    // Staircase (higher priority than rats/baddies)
    if (this.staircase) {
      const key = this.staircase.y * this.mapW + this.staircase.x;
      if (!entityMap[key]) entityMap[key] = { char: '>', color: COLOR_STAIRCASE };
    }

    // Rats
    for (const r of this.rats) {
      const key = r.y * this.mapW + r.x;
      if (!entityMap[key]) entityMap[key] = { char: 'r', color: COLOR_RAT };
    }

    // Baddies
    for (const b of this.baddies) {
      const key = b.y * this.mapW + b.x;
      if (!entityMap[key]) entityMap[key] = { char: 'B', color: COLOR_BADDIE };
    }

    // Boss (2x2)
    if (this.boss) {
      const bossChar = this.boss.flashing ? 'X' : 'D';
      const bossColor = this.boss.flashing ? '#ffffff' : COLOR_BOSS;
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const key = (this.boss.y + oy) * this.mapW + (this.boss.x + ox);
          entityMap[key] = { char: bossChar, color: bossColor };
        }
      }
    }

    // Lava tiles
    for (const lava of this.lavaTiles) {
      const key = lava.y * this.mapW + lava.x;
      if (!entityMap[key]) entityMap[key] = { char: '~', color: COLOR_LAVA, showExplored: true };
    }

    // Trap tiles
    for (const trap of this.trapTiles) {
      const key = trap.y * this.mapW + trap.x;
      if (!entityMap[key]) entityMap[key] = { char: '^', color: COLOR_TRAP, showExplored: true };
    }

    // Teleporters
    for (const tp of this.teleporters) {
      const key = tp.y * this.mapW + tp.x;
      if (!entityMap[key]) entityMap[key] = { char: 'O', color: COLOR_TELEPORTER };
    }

    // Projectiles
    for (const p of this.projectiles) {
      const key = p.y * this.mapW + p.x;
      if (!entityMap[key]) entityMap[key] = { char: '*', color: '#ffffff' };
    }

    // Power-ups
    for (const pu of this.powerups) {
      const key = pu.y * this.mapW + pu.x;
      if (!entityMap[key]) {
        const chars = { speed: '*', shield: '+', phase: '~' };
        const colors = { speed: COLOR_POWERUP_SPEED, shield: COLOR_POWERUP_SHIELD, phase: COLOR_POWERUP_PHASE };
        entityMap[key] = { char: chars[pu.type], color: colors[pu.type] };
      }
    }

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const vis = this.visibility[y][x];
        const txt = this.displayGrid[y][x];
        const key = y * this.mapW + x;

        let ch = '';
        let col = '#000000';

        if (vis === VISIBLE) {
          const entity = entityMap[key];
          if (entity) {
            ch = entity.char;
            col = entity.color;
          } else if (this.grid[y][x] === WALL) {
            ch = '#';
            col = COLOR_WALL;
          } else {
            ch = '.';
            col = COLOR_FLOOR_VISIBLE;
          }
        } else if (vis === EXPLORED) {
          const entity = entityMap[key];
          if (entity && entity.showExplored) {
            ch = entity.char;
            col = '#553300';
          } else if (this.grid[y][x] === WALL) {
            ch = '#';
            col = '#444444';
          } else {
            ch = '.';
            col = COLOR_FLOOR_EXPLORED;
          }
        }
        // UNEXPLORED: ch stays '' and col stays '#000000'

        // Dirty check
        const renderKey = ch + col;
        if (this.prevRender[y][x] !== renderKey) {
          txt.setText(ch);
          txt.setColor(col);
          this.prevRender[y][x] = renderKey;
        }
      }
    }
  }
}

// ============================================================
// PHASER CONFIG
// ============================================================

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  parent: document.body,
  scene: [TitleScene, TransitionScene, FlavorTextScene, GameScene, GameOverScene],
  audio: {
    disableWebAudio: false
  },
  render: {
    pixelArt: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
