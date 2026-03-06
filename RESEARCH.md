# Snakelike: Snake × Roguelike Game — Technical Research Report

## Executive Summary

This report covers the full technical research needed to build a web-based Phaser 3 game combining classic Snake mechanics with roguelike dungeon crawling. The game features a snake (headed by a green `@`) navigating procedurally generated ASCII dungeons, eating rats to grow, avoiding/killing bouncing enemies, fog of war, level progression with increasing difficulty, and retro synthesized sound effects. The research covers: Phaser 3 setup and ASCII rendering, procedural dungeon generation (BSP algorithm), snake movement on a grid, enemy "bounce patrol" AI, fog of war (shadowcasting), camera scrolling, retro audio synthesis, and key game design considerations. An existing game called "Snakelike" on Steam provides prior art and design inspiration.

---

## Table of Contents

1. [Prior Art: Existing Snake×Roguelike Games](#1-prior-art)
2. [Technology Stack](#2-technology-stack)
3. [Phaser 3 Setup & ASCII Rendering](#3-phaser-3-setup--ascii-rendering)
4. [Procedural Dungeon Generation](#4-procedural-dungeon-generation)
5. [Snake Movement & Growth Mechanics](#5-snake-movement--growth-mechanics)
6. [Enemy AI: Bounce Patrol Pattern](#6-enemy-ai-bounce-patrol-pattern)
7. [Fog of War](#7-fog-of-war)
8. [Camera & Viewport](#8-camera--viewport)
9. [Audio: Retro Beeps & Bleeps](#9-audio-retro-beeps--bleeps)
10. [Level Progression System](#10-level-progression-system)
11. [Game Design Questions & Recommendations](#11-game-design-questions--recommendations)
12. [Recommended Architecture](#12-recommended-architecture)
13. [Key Resources Summary](#13-key-resources-summary)
14. [Confidence Assessment](#14-confidence-assessment)
15. [Footnotes](#15-footnotes)

---

## 1. Prior Art

### "Snakelike" (Steam / itch.io)

An existing game called **Snakelike** by Placate The Cattin directly combines Snake and roguelike mechanics[^1][^2]. Key design elements:

- **Turn-based, grid-based** movement — every player move triggers enemy moves
- Snake grows by eating items; body segments serve as inventory and health
- Procedurally generated dungeons with permadeath
- Body segments can hold armor/weapons; spells are cast by arranging body into patterns
- Longer snake = more power but higher risk of self-trapping

**Key takeaway for your design**: Your game differs from Snakelike in that it's **real-time** (continuous snake movement like the classic arcade game), not turn-based. This makes corridor width and enemy AI timing critical design elements.

### Vyperspace

Another Snake/roguelike hybrid by iLKke, blending snake mechanics with asteroid-style gameplay in grid-based levels[^3].

---

## 2. Technology Stack

| Component | Recommended Technology | Notes |
|-----------|----------------------|-------|
| Game Engine | **Phaser 3.90.0** | Latest stable (2025), CDN or npm[^4] |
| Dungeon Generation | **Custom BSP** or **ROT.js Digger** | ROT.js has proven room+corridor generators[^5] |
| FOV / Fog of War | **mrpas** npm package or custom shadowcasting | JS port available, works great for grid-based games[^6] |
| Audio | **Web Audio API** (via `scene.sound.context`) | No external assets needed — programmatic synthesis[^7] |
| Build Tool | None required (single HTML file possible) | Or use Vite/webpack for dev experience |

---

## 3. Phaser 3 Setup & ASCII Rendering

### Minimal Boilerplate

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Snakelike</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/phaser/3.90.0/phaser.min.js"></script>
  <style>body { margin: 0; background: #000; }</style>
</head>
<body>
<script>
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  scene: { preload, create, update }
};
const game = new Phaser.Game(config);
</script>
</body>
</html>
```
[^4]

### ASCII Rendering Approach

There are two main approaches for rendering ASCII characters in Phaser 3[^8]:

**Option A: Text Objects (Simpler, good for prototyping)**
```javascript
// Create a grid of text objects
for (let y = 0; y < mapHeight; y++) {
  for (let x = 0; x < mapWidth; x++) {
    const char = dungeonMap[y][x];
    const color = getColorForChar(char);
    this.add.text(x * TILE_SIZE, y * TILE_SIZE, char, {
      fontFamily: 'monospace',
      fontSize: `${TILE_SIZE}px`,
      color: color
    });
  }
}
```

**Option B: Bitmap Font Tileset (Better performance)**
- Pre-render ASCII glyphs into a spritesheet (e.g., 16×16 per glyph)
- Use Phaser's `Tilemap` system for rendering
- Much better performance for large maps (100×100+ tiles)

**Recommendation**: Start with Text Objects for rapid prototyping. If performance becomes an issue (likely with fog of war re-rendering), switch to a bitmap font tileset or use object pooling to only render visible tiles.

### ASCII Character Map

| Entity | Character | Color |
|--------|-----------|-------|
| Snake head | `@` | Green (`#00ff00`) |
| Snake body | `o` or `O` | Green (`#00cc00`) |
| Wall | `#` | White/Gray (`#888888`) |
| Floor | `.` | Dark gray (`#333333`) |
| Rat (food) | `r` | Yellow (`#ffff00`) |
| Baddie | `B` or `b` | Red (`#ff0000`) |
| Staircase | `>` | Cyan (`#00ffff`) |
| Fog (unexplored) | ` ` (space) | Black |
| Fog (explored, not visible) | Dimmed version | Half-brightness |

---

## 4. Procedural Dungeon Generation

### Algorithm: Binary Space Partitioning (BSP)

BSP is the most reliable algorithm for generating rooms connected by corridors — exactly what a roguelike dungeon needs[^9][^10].

```
┌───────────────────────────────────────┐
│           Full Dungeon Area           │
│                                       │
│    ┌─────────┐   ┌──────────────┐     │
│    │  Room 1  │───│   Room 2     │     │
│    │         │   │              │     │
│    └─────────┘   └──────┬───────┘     │
│                         │             │
│    ┌─────────┐   ┌──────┴───────┐     │
│    │  Room 3  │───│   Room 4     │     │
│    │         │   │              │     │
│    └─────────┘   └──────────────┘     │
│                                       │
└───────────────────────────────────────┘
```

### BSP Algorithm Steps

1. **Start** with the entire dungeon as one rectangle
2. **Recursively split** into sub-rectangles (alternating horizontal/vertical)
3. **Place rooms** randomly within each leaf rectangle
4. **Connect sibling rooms** with corridors along the split axis
5. **Ensure connectivity** by traversing the BSP tree

### Critical Design Constraint: Corridor Width

**Corridors MUST be at least 3 tiles wide** for a snake game. A 1-tile-wide corridor means the snake cannot turn — it would immediately collide with walls. With 3-wide corridors, the snake has room to make 90° turns.

```
Standard roguelike corridor (1 wide — BAD for snake):
####.####
####.####

Snake-friendly corridor (3 wide — GOOD):
###...###
###...###
###...###
```

**Implementation approach**:
```javascript
function generateCorridor(x1, y1, x2, y2, grid, corridorWidth = 3) {
  const halfW = Math.floor(corridorWidth / 2);
  // Horizontal segment
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    for (let dy = -halfW; dy <= halfW; dy++) {
      grid[y1 + dy][x] = FLOOR;
    }
  }
  // Vertical segment
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      grid[y][x2 + dx] = FLOOR;
    }
  }
}
```

### Alternative: ROT.js Digger

ROT.js provides a ready-made `ROT.Map.Digger` that generates rooms and corridors[^5]:

```javascript
import { Map } from 'rot-js';
const digger = new Map.Digger(80, 40);
const grid = [];
digger.create((x, y, value) => {
  grid[y] = grid[y] || [];
  grid[y][x] = value === 0 ? '.' : '#';
});
const rooms = digger.getRooms();
const corridors = digger.getCorridors();
```

**Caveat**: ROT.js generates 1-wide corridors by default. You would need to post-process corridors to widen them, or write a custom generator from scratch.

### Dungeon Scaling Per Level

| Level | Map Width | Map Height | Rooms (approx) |
|-------|-----------|------------|-----------------|
| 1     | 40        | 30         | 4–5             |
| 2     | 45        | 33         | 5–6             |
| 3     | 50        | 36         | 6–7             |
| N     | 40 + (N-1)*5 | 30 + (N-1)*3 | 4 + N       |

---

## 5. Snake Movement & Growth Mechanics

### Real-Time Grid Movement

Since this is a real-time snake game (not turn-based), the snake moves automatically at a set interval, and the player changes direction with WASD/Arrow keys[^11].

```javascript
// Core snake state
const snake = {
  segments: [{x: 10, y: 10}],  // Head is segments[0]
  direction: {x: 1, y: 0},     // Moving right
  moveTimer: 0,
  moveInterval: 200,            // ms between moves
  growing: false
};

function updateSnake(delta) {
  snake.moveTimer += delta;
  if (snake.moveTimer >= snake.moveInterval) {
    snake.moveTimer = 0;
    
    const head = snake.segments[0];
    const newHead = {
      x: head.x + snake.direction.x,
      y: head.y + snake.direction.y
    };
    
    // Check wall collision
    if (isWall(newHead.x, newHead.y)) {
      gameOver(); return;
    }
    
    // Check self-collision
    if (snake.segments.some(s => s.x === newHead.x && s.y === newHead.y)) {
      gameOver(); return;
    }
    
    // Move: add new head
    snake.segments.unshift(newHead);
    
    // Remove tail unless growing
    if (!snake.growing) {
      snake.segments.pop();
    } else {
      snake.growing = false;
    }
    
    // Check rat consumption
    checkRatPickup(newHead);
  }
}
```

### Input Handling

```javascript
function create() {
  // Arrow keys
  this.cursors = this.input.keyboard.createCursorKeys();
  
  // WASD
  this.wasd = {
    W: this.input.keyboard.addKey('W'),
    A: this.input.keyboard.addKey('A'),
    S: this.input.keyboard.addKey('S'),
    D: this.input.keyboard.addKey('D')
  };
}

function handleInput() {
  const dir = snake.direction;
  if ((cursors.left.isDown || wasd.A.isDown) && dir.x !== 1) {
    snake.direction = {x: -1, y: 0};
  } else if ((cursors.right.isDown || wasd.D.isDown) && dir.x !== -1) {
    snake.direction = {x: 1, y: 0};
  } else if ((cursors.up.isDown || wasd.W.isDown) && dir.y !== 1) {
    snake.direction = {x: 0, y: -1};
  } else if ((cursors.down.isDown || wasd.S.isDown) && dir.y !== -1) {
    snake.direction = {x: 0, y: 1};
  }
}
```

### Growth Mechanic

When the snake eats a rat:
1. Set `snake.growing = true` (tail doesn't retract on next move)
2. Remove the rat from the map
3. Play a "bleep" sound
4. Decrement remaining rats counter

---

## 6. Enemy AI: Bounce Patrol Pattern

The specified enemy behavior is a "bounce patrol" pattern — enemies move in one direction until hitting a wall, then shift 1–5 tiles perpendicular before reversing[^12].

### State Machine

```
┌──────────────┐     Wall hit     ┌───────────────┐
│  MOVING      │─────────────────▶│  SHIFTING     │
│  (primary    │                  │  (1-5 tiles   │
│   direction) │◀─────────────────│   perpendic.) │
└──────────────┘   Shift done     └───────────────┘
```

### Implementation

```javascript
class Baddie {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.primaryDir = randomCardinal();   // e.g., {x:1, y:0}
    this.state = 'MOVING';
    this.shiftRemaining = 0;
    this.shiftDir = null;
    this.alive = true;
    this.moveTimer = 0;
    this.moveInterval = 300;  // slightly slower than snake
  }

  update(delta, grid, snake) {
    if (!this.alive) return;
    this.moveTimer += delta;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;

    if (this.state === 'MOVING') {
      const nx = this.x + this.primaryDir.x;
      const ny = this.y + this.primaryDir.y;
      
      if (isWall(nx, ny)) {
        // Hit a wall — start shifting
        this.state = 'SHIFTING';
        this.shiftRemaining = 1 + Math.floor(Math.random() * 5); // 1-5
        this.shiftDir = perpendicular(this.primaryDir); // 90° turn
        this.primaryDir = { x: -this.primaryDir.x, y: -this.primaryDir.y }; // reverse
      } else {
        this.x = nx;
        this.y = ny;
      }
    } else if (this.state === 'SHIFTING') {
      const nx = this.x + this.shiftDir.x;
      const ny = this.y + this.shiftDir.y;
      
      if (isWall(nx, ny)) {
        // Can't shift further — go back to moving
        this.state = 'MOVING';
      } else {
        this.x = nx;
        this.y = ny;
        this.shiftRemaining--;
        if (this.shiftRemaining <= 0) {
          this.state = 'MOVING';
        }
      }
    }

    // Check collision with snake tail (NOT head)
    this.checkTailCollision(snake);
  }

  checkTailCollision(snake) {
    // Baddies die when they hit the snake's tail (segments[1..n])
    for (let i = 1; i < snake.segments.length; i++) {
      if (this.x === snake.segments[i].x && this.y === snake.segments[i].y) {
        this.alive = false;
        playBeep(scene, 200, 200, 'sawtooth'); // death sound
        return;
      }
    }
  }
}

function perpendicular(dir) {
  // Returns one of the two perpendicular directions (random choice)
  if (dir.x !== 0) {
    return Math.random() < 0.5 ? {x:0, y:1} : {x:0, y:-1};
  } else {
    return Math.random() < 0.5 ? {x:1, y:0} : {x:-1, y:0};
  }
}
```

### Death Condition

Baddies die **only** when they collide with the snake's **tail** (body segments, excluding the head). This creates a strategic dynamic:
- Longer snake = more "weapon" (tail area) to kill baddies
- Player must maneuver to position tail in the baddie's path
- Head-on collision with a baddie could mean **damage or game over** (design decision needed)

---

## 7. Fog of War

### Algorithm: Shadowcasting (MRPAS)

The MRPAS (Mingos' Restrictive Precise Angle Shadowcasting) algorithm is the gold standard for roguelike FOV in JavaScript[^6][^13].

### Implementation with mrpas npm package

```javascript
// npm install mrpas
import { Mrpas } from 'mrpas';

const FOV_RADIUS = 8;
const fov = new Mrpas(mapWidth, mapHeight, (x, y) => {
  return grid[y][x] !== '#'; // transparent if not a wall
});

function computeVisibility(playerX, playerY) {
  // Reset visibility
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      tiles[y][x].visible = false;
    }
  }
  
  fov.compute(
    playerX, playerY, FOV_RADIUS,
    (x, y) => tiles[y]?.[x]?.visible ?? false,    // isVisible
    (x, y) => {                                     // setVisible
      if (tiles[y] && tiles[y][x]) {
        tiles[y][x].visible = true;
        tiles[y][x].explored = true;
      }
    }
  );
}
```

### Three-Tier Rendering

| State | Rendering | Description |
|-------|-----------|-------------|
| **Visible** | Full color + entities shown | Currently in line of sight |
| **Explored** | Dimmed (50% opacity), no entities | Previously seen but not currently visible |
| **Unexplored** | Black/empty | Never been visible |

```javascript
function renderTile(x, y) {
  const tile = tiles[y][x];
  if (tile.visible) {
    // Full brightness
    return { char: tile.char, color: tile.color, alpha: 1.0 };
  } else if (tile.explored) {
    // Dimmed — show terrain but not entities
    return { char: tile.char, color: '#444444', alpha: 0.5 };
  } else {
    // Unexplored — black
    return { char: ' ', color: '#000000', alpha: 0 };
  }
}
```

### FOV Radius by Snake Head

The FOV should be computed from the **snake's head position** (the `@` symbol). As the snake moves, the fog updates. This creates tension as the player can only see a limited area around the head[^14].

---

## 8. Camera & Viewport

Since dungeons grow larger than the screen, the camera must follow the snake head[^15].

```javascript
function create() {
  // Set world bounds to dungeon size
  this.cameras.main.setBounds(
    0, 0,
    mapWidth * TILE_SIZE,
    mapHeight * TILE_SIZE
  );
  
  // Follow the snake head
  this.cameras.main.startFollow(snakeHeadSprite, true, 0.1, 0.1);
  
  // Optional: deadzone for less jittery scrolling
  this.cameras.main.setDeadzone(100, 100);
}
```

### HUD / UI Layer

Use a separate camera or `setScrollFactor(0)` for fixed UI elements (level number, rats remaining, score):

```javascript
const hudText = this.add.text(10, 10, 'Level 1 | Rats: 5 | Baddies: 5', {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#ffffff'
});
hudText.setScrollFactor(0); // Fixed to screen, doesn't scroll
```

---

## 9. Audio: Retro Beeps & Bleeps

Phaser 3 exposes the Web Audio API context at `scene.sound.context`, enabling programmatic sound synthesis with zero external audio files[^7].

### Core Beep Function

```javascript
function playBeep(scene, frequency = 440, duration = 100, type = 'square', volume = 0.1) {
  const ctx = scene.sound.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;  // 'square', 'sawtooth', 'triangle', 'sine'
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
  
  osc.onended = () => {
    gain.disconnect();
    osc.disconnect();
  };
}
```

### Sound Effect Map

| Event | Frequency (Hz) | Duration (ms) | Waveform | Description |
|-------|----------------|---------------|----------|-------------|
| Eat rat | 880 | 80 | Square | High-pitched blip |
| Baddie dies | 200→100 sweep | 200 | Sawtooth | Descending buzz |
| Level complete | 440→880 sweep | 400 | Triangle | Ascending chime |
| Snake dies | 100 | 500 | Sawtooth | Low rumble |
| Staircase appears | 660, 880 seq. | 100 each | Square | Two-note fanfare |
| Move (optional) | 1200 | 20 | Sine | Subtle tick |

### Sweep Effect (Pitch Change)

```javascript
function playSweep(scene, startFreq, endFreq, duration = 200) {
  const ctx = scene.sound.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration / 1000);
  gain.gain.value = 0.1;
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}
```

---

## 10. Level Progression System

### Rules (from specification)

| Level | Rats | Baddies | Map Size | Trigger for Next Level |
|-------|------|---------|----------|----------------------|
| 1 | 5 | 5 | 40×30 | All baddies dead → staircase appears |
| 2 | 6 | 6 | 45×33 | All baddies dead → staircase appears |
| 3 | 7 | 7 | 50×36 | All baddies dead → staircase appears |
| N | 4+N | 4+N | (35+5N)×(27+3N) | All baddies dead → staircase appears |

### Level Transition Flow

```
[All baddies dead] 
    → Play fanfare sound
    → Place staircase `>` in a random room
    → Player moves snake to staircase
    → Generate new dungeon (larger)
    → Place more rats & baddies
    → Reset snake position (keep length)
    → Increment level counter
```

### Staircase Placement

Place the `>` in the room **farthest from the snake's current position** (using Manhattan distance or BFS) to ensure the player must navigate to it.

---

## 11. Game Design Questions & Recommendations

These are the open design questions that should be resolved before or during implementation:

### Q1: What happens when the snake head hits a baddie?

**Options:**
- (a) **Game over** (classic Snake style — harsh but simple)
- (b) **Lose body segments** (snake shrinks by 1-3 segments — more roguelike)
- (c) **Nothing** (baddies are only dangerous as obstacles blocking your path)

**Recommendation**: Option (b) — lose 1 segment per hit. If the snake has no body segments left (just the head), the next hit = game over. This rewards growth and creates tension.

### Q2: Does the snake start moving immediately, or wait for first input?

**Recommendation**: Wait for first keypress. Classic Snake usually starts with the snake moving, but in a dungeon it's better to let the player orient themselves first.

### Q3: What is the snake's starting length?

**Options**: 1 (just the head), 3 (classic Snake starting length)  
**Recommendation**: Start at length 1 (just `@`). Growing from nothing makes eating the first rat feel meaningful.

### Q4: Does the snake speed increase with levels?

**Recommendation**: Keep speed constant or increase very slightly. The increasing dungeon complexity and number of enemies already raises difficulty.

### Q5: What happens if you eat all rats but baddies remain?

The spec says baddies must die for the staircase. Rats grow the snake. If the player eats all rats, they have maximum length (maximum "tail weapon") to hunt remaining baddies with.

### Q6: Can the snake die from self-collision?

**Recommendation**: Yes — this is a core Snake mechanic and adds crucial tension in tight corridors.

### Q7: Does the FOV follow the head or illuminate the whole snake?

**Recommendation**: FOV radiates from the **head only**. This keeps the fog tight and creates more atmosphere. The tail behind you fades into explored-but-dim territory.

### Q8: Is the game loop real-time or turn-based?

Given the spec says "controller by WASD OR arrow keys" and describes classic snake mechanics, **real-time with a tick-based movement interval** (e.g., move every 150-250ms) is the right fit. This is classic Snake behavior — continuous movement with directional changes.

### Q9: What color scheme for the background?

**Recommendation**: Pure black (`#000000`) background. This is the classic roguelike terminal aesthetic and makes the colored ASCII characters pop.

### Q10: Should there be a score display?

**Recommendation**: Show a minimal HUD: `Level: N | Rats: X | Baddies: Y | Length: Z`

---

## 12. Recommended Architecture

### File Structure

```
snakelike/
├── index.html          # Entry point with Phaser CDN
├── js/
│   ├── game.js         # Phaser config & main game initialization
│   ├── scenes/
│   │   ├── BootScene.js     # Loading/initialization
│   │   ├── GameScene.js     # Main gameplay
│   │   └── GameOverScene.js # Death screen
│   ├── entities/
│   │   ├── Snake.js         # Snake state & movement
│   │   ├── Baddie.js        # Enemy AI
│   │   └── Rat.js           # Food item
│   ├── systems/
│   │   ├── DungeonGenerator.js  # BSP dungeon generation
│   │   ├── FogOfWar.js          # MRPAS visibility
│   │   ├── AsciiRenderer.js     # Grid rendering
│   │   └── AudioManager.js      # Beep/bleep synthesis
│   └── utils/
│       └── constants.js     # Colors, sizes, symbols
└── package.json        # (optional, for npm deps like mrpas)
```

### Game Loop Architecture

```
┌─────────────────────────────────────────────┐
│                 GameScene                     │
│                                              │
│  update(time, delta) {                       │
│    1. handleInput()        // Read WASD/arrows│
│    2. updateSnake(delta)   // Move snake      │
│    3. updateBaddies(delta) // Move enemies     │
│    4. checkCollisions()    // Rats, baddies    │
│    5. computeFOV()         // From snake head  │
│    6. render()             // Draw ASCII grid  │
│    7. updateHUD()          // Score/status     │
│  }                                           │
│                                              │
└─────────────────────────────────────────────┘
```

### Performance Considerations

- **Only render visible tiles**: Skip rendering tiles that are outside the camera viewport
- **Object pooling**: Reuse Phaser Text objects rather than creating/destroying each frame
- **Dirty rendering**: Only update tiles whose visibility state changed since last frame
- **Limit FOV computation**: Only recompute when the snake head moves to a new tile

---

## 13. Key Resources Summary

| Resource | Type | URL | Use Case |
|----------|------|-----|----------|
| Phaser 3.90.0 CDN | Library | [cdnjs](https://cdnjs.cloudflare.com/ajax/libs/phaser/3.90.0/phaser.min.js) | Game engine |
| ROT.js | Library | [GitHub](https://github.com/ondras/rot.js) | Dungeon generation |
| mrpas | npm Package | [npm](https://www.npmjs.com/package/mrpas) | FOV/shadowcasting |
| RogueBasin BSP Tutorial | Article | [RogueBasin](https://roguebasin.com/index.php/Basic_BSP_Dungeon_generation) | Dungeon gen algorithm |
| Phaser ASCII Roguelike Tutorial | Tutorial | [GitHub Pages](https://jamesskemp.github.io/PhaserTutorials/Ascii-Roguelike-Tutorial/) | Phaser + ASCII rendering |
| Phaser Camera API | Docs | [Phaser Docs](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) | Camera follow/bounds |
| Snakelike (prior art) | Game | [Steam](https://store.steampowered.com/app/845110/Snakelike/) | Design reference |
| Web Audio API | MDN | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) | Audio synthesis |

---

## 14. Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Phaser 3 setup & rendering | **High** | Well-documented, many examples |
| BSP dungeon generation | **High** | Proven algorithm, easy to implement in JS |
| Corridor width (3-wide) | **High** | Critical for playability; custom implementation needed |
| Snake movement | **High** | Classic, well-understood pattern |
| Enemy bounce AI | **Medium-High** | Simple state machine, but tuning (speed, shift distance) will need playtesting |
| MRPAS fog of war | **High** | npm package exists; well-tested |
| Web Audio synthesis | **High** | Native browser API, no deps needed |
| Performance at scale | **Medium** | Large maps with many text objects may need optimization |
| Real-time vs turn-based | **Medium** | Spec implies real-time; this creates challenges with corridor navigation that need playtesting |
| ROT.js corridor widening | **Low-Medium** | ROT.js generates 1-wide corridors; post-processing or custom generator needed |

### Assumptions Made
- The game is **real-time** (not turn-based) based on the classic Snake analogy
- Snake head collision with baddie = damage (not instant death)
- Rats are static items placed in rooms
- The snake keeps its length between levels
- No inventory system beyond length
- Single-player, single-session (no save/load)

---

## 15. Footnotes

[^1]: [Snakelike on Steam](https://store.steampowered.com/app/845110/Snakelike/) — Existing Snake×Roguelike game by Placate The Cattin
[^2]: [Snakelike - RogueBasin](https://www.roguebasin.com/index.php/Snakelike) — RogueBasin entry with mechanics overview
[^3]: [Vyperspace by iLKke](https://ilkke.itch.io/vyperspace) — Another Snake hybrid game
[^4]: [Phaser 3.90.0 Download](https://phaser.io/download/stable) — Latest Phaser CDN
[^5]: [ROT.js - GitHub](https://github.com/ondras/rot.js/) — ROguelike Toolkit in JavaScript
[^6]: [mrpas - npm](https://www.npmjs.com/package/mrpas/v/2.0.0) — MRPAS FOV algorithm for JS
[^7]: [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) — Advanced audio synthesis
[^8]: [Phaser ASCII Roguelike Tutorial](https://jamesskemp.github.io/PhaserTutorials/Ascii-Roguelike-Tutorial/) — Rendering ASCII tiles in Phaser 3
[^9]: [BSP Dungeon Generation - RogueBasin](https://roguebasin.com/index.php/Basic_BSP_Dungeon_generation) — Authoritative BSP algorithm reference
[^10]: [Procedural Map Generation with BSP](https://maxgcoding.com/dungeon-gen-with-bsp) — BSP implementation guide
[^11]: [Grid Movement in Phaser 3](https://phaser.io/examples/v3.85.0/tilemap/view/grid-movement) — Official Phaser grid movement example
[^12]: [Enemy Movement System on 2D Grid - GameDev Stack Exchange](https://gamedev.stackexchange.com/questions/214698/enemy-movement-system-on-a-2d-grid-zelda-like) — Grid-based enemy patrol patterns
[^13]: [MRPAS - RogueBasin](https://www.roguebasin.com/index.php/Restrictive_Precise_Angle_Shadowcasting) — Algorithm details
[^14]: [Field of View for Roguelike - Phaser](https://phaser.io/news/2021/07/field-of-view-for-a-roguelike-tutorial) — FOV implementation in Phaser
[^15]: [Phaser Camera API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) — Camera follow and bounds
