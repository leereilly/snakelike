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

function playBeep(context, frequency, duration, type, volume) {
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
  playBeep(ctx, 880, 80, 'square', 0.08);
}

function playBaddieDeath(ctx) {
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
  if (!ctx) return;
  try {
    playBeep(ctx, 660, 100, 'square', 0.08);
    setTimeout(() => playBeep(ctx, 880, 100, 'square', 0.08), 120);
  } catch (e) {}
}

function playGameOver(ctx) {
  playBeep(ctx, 100, 500, 'sawtooth', 0.08);
}

function playLevelTransition(ctx) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
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

function generateDungeon(mapW, mapH) {
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

  return { grid, rooms };
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
    this.showTitle();
  }

  clearScreen() {
    this.children.removeAll();
    this.input.keyboard.removeAllListeners();
    if (this.switchTimer) { this.switchTimer.remove(); this.switchTimer = null; }
    this.wallChars = [];
    this.flameChars = [];
    this.flameEdgeChars = [];
    this.flameSet = new Set();
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
    const torchRow = solidTopRows + battlementHeight + 14;
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
    const flameRadius = Math.floor(wallThick / 2) - 1;
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

    this.borderFlickerTimer = 0;
    this.flameTimer = 0;
  }

  addStartListener() {
    this.input.keyboard.on('keydown', () => {
      if (this.switchTimer) { this.switchTimer.remove(); this.switchTimer = null; }
      this.scene.start('GameScene', { level: 1, snakeLength: 1 });
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
    }
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
    this.nameEntry = '';
    this.inputActive = false;

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, cy - 80, 'GAME OVER', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff0000'
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, `Level: ${this.level}   Kills: ${this.baddiesKilled}   Max Length: ${this.maxSnakeLength}   Score: ${this.score}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff'
    }).setOrigin(0.5);

    const loadingText = this.add.text(cx, cy + 30, 'Loading leaderboard...', {
      fontFamily: 'monospace', fontSize: '14px', color: '#555555'
    }).setOrigin(0.5);

    fetchLeaderboard().then(entries => {
      loadingText.destroy();
      const qualifies = this.score > 0 && qualifiesForLeaderboard(this.score, entries);
      if (qualifies) {
        this.showNameEntry(cx, cy, entries);
      } else {
        this.showLeaderboard(cx, cy + 20, entries);
        this.addRestartListener();
      }
    }).catch(() => {
      loadingText.destroy();
      this.addRestartListener();
    });
  }

  showNameEntry(cx, cy, entries) {
    this.add.text(cx, cy + 20, 'NEW HIGH SCORE!', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffff00'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 55, 'Enter your name:', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888'
    }).setOrigin(0.5);

    this.nameText = this.add.text(cx, cy + 85, '_', {
      fontFamily: 'monospace', fontSize: '24px', color: '#00ff00'
    }).setOrigin(0.5);

    this.inputActive = true;

    this.input.keyboard.on('keydown', (event) => {
      if (!this.inputActive) return;

      if (event.key === 'Enter' && this.nameEntry.length > 0) {
        this.inputActive = false;
        this.doSubmit(cx, cy, entries);
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

  async doSubmit(cx, cy, entries) {
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

    this.children.removeAll();
    this.input.keyboard.removeAllListeners();

    this.add.text(cx, cy - 80, 'GAME OVER', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff0000'
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, `Level: ${this.level}   Kills: ${this.baddiesKilled}   Max Length: ${this.maxSnakeLength}   Score: ${this.score}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff'
    }).setOrigin(0.5);

    this.showLeaderboard(cx, cy + 20, finalEntries);
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
      this.scene.start('GameScene', { level: 1, snakeLength: 1 });
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
  }

  updateScore() {
    this.currentScore = (this.level * POINTS_PER_LEVEL)
      + (this.baddiesKilled * POINTS_PER_KILL)
      + (this.maxSnakeLength * POINTS_PER_MAX_LENGTH);
  }

  create() {
    // Map dimensions
    this.mapW = 35 + 5 * this.level;
    this.mapH = 27 + 3 * this.level;

    // Generate dungeon
    const dungeon = generateDungeon(this.mapW, this.mapH);
    this.grid = dungeon.grid;
    this.rooms = dungeon.rooms;

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
    const startRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
    const startX = Math.floor(startRoom.x + startRoom.w / 2);
    const startY = Math.floor(startRoom.y + startRoom.h / 2);
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
    this.numRats = 4 + this.level;
    this.rats = [];
    for (let i = 0; i < this.numRats; i++) {
      this.rats.push(this.randomFloorTile());
    }

    // Place baddies
    this.numBaddies = 4 + this.level;
    this.baddies = [];
    const allDirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
    for (let i = 0; i < this.numBaddies; i++) {
      const pos = this.randomFloorTile();
      this.baddies.push({
        x: pos.x,
        y: pos.y,
        primaryDirection: allDirs[Math.floor(Math.random() * 4)],
        state: AI_MOVING,
        shiftRemaining: 0,
        shiftDirection: DIR.LEFT
      });
    }

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

    // Timers
    this.snakeMoveTimer = 0;
    this.snakeMoveInterval = 200;
    this.baddieMoveTimer = 0;
    this.baddieMoveInterval = 300;

    this.gameOver = false;

    // Initial FOV
    computeFOV(this.grid, this.visibility, this.snake[0].x, this.snake[0].y, FOV_RADIUS);

    // Render initial state
    this.renderMap();
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
      }
    }

    // Update HUD
    const aliveRats = this.rats.length;
    const aliveBaddies = this.baddies.length;
    this.hudText.setText(
      `Level: ${this.level}  Rats: ${aliveRats}  Baddies: ${aliveBaddies}  Length: ${this.snake.length}`
    );
    this.scoreText.setText(`Score: ${this.currentScore}`);

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
    if (newHead.x < 0 || newHead.x >= this.mapW || newHead.y < 0 || newHead.y >= this.mapH ||
        this.grid[newHead.y][newHead.x] === WALL) {
      this.doGameOver();
      return;
    }

    // Self-collision (check against body segments, not the tail if we're about to remove it)
    for (let i = 0; i < this.snake.length - (this.growCount > 0 ? 0 : 1); i++) {
      if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
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

    // Check body↔baddie collision (body kills baddie)
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      const b = this.baddies[i];
      for (let s = 1; s < this.snake.length; s++) {
        if (this.snake[s].x === b.x && this.snake[s].y === b.y) {
          this.baddies.splice(i, 1);
          this.baddiesKilled++;
          this.updateScore();
          playBaddieDeath(this.audioCtx);
          break;
        }
      }
    }
    if (this.baddies.length === 0 && !this.staircasePlaced) {
      this.placeStaircase();
    }

    // Check rat collision
    for (let i = this.rats.length - 1; i >= 0; i--) {
      if (this.rats[i].x === newHead.x && this.rats[i].y === newHead.y) {
        this.rats.splice(i, 1);
        this.growCount++;
        if (this.snake.length + this.growCount > this.maxSnakeLength) {
          this.maxSnakeLength = this.snake.length + this.growCount;
          this.updateScore();
        }
        playEatSound(this.audioCtx);
        break;
      }
    }

    // Check baddie-head collision (damage): always net -1 length
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      if (this.baddies[i].x === newHead.x && this.baddies[i].y === newHead.y) {
        const pops = grewThisTick ? 2 : 1;
        if (this.snake.length <= pops) {
          this.doGameOver();
          return;
        }
        for (let p = 0; p < pops; p++) this.snake.pop();
        break;
      }
    }

    // Check staircase
    if (this.staircase && newHead.x === this.staircase.x && newHead.y === this.staircase.y) {
      playLevelTransition(this.audioCtx);
      this.scene.start('GameScene', { level: this.level + 1, snakeLength: this.snake.length, baddiesKilled: this.baddiesKilled, maxSnakeLength: this.maxSnakeLength, score: this.currentScore });
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
          break;
        }
      }
    }

    // Check if baddie on snake head -> damage
    for (let i = this.baddies.length - 1; i >= 0; i--) {
      const b = this.baddies[i];
      if (b.x === this.snake[0].x && b.y === this.snake[0].y) {
        if (this.snake.length <= 1) {
          this.doGameOver();
          return;
        }
        this.snake.pop();
      }
    }

    // Check if all baddies dead -> place staircase
    if (this.baddies.length === 0 && !this.staircasePlaced) {
      this.placeStaircase();
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
    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', { level: this.level, length: this.snake.length, baddiesKilled: this.baddiesKilled, maxSnakeLength: this.maxSnakeLength, score: this.currentScore });
    });
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
          if (this.grid[y][x] === WALL) {
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
  scene: [TitleScene, GameScene, GameOverScene],
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
