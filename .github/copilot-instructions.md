# SN@KELIKE — Copilot Instructions

## Running the Game

No build step. Open `index.html` in a browser, or serve locally:

```sh
npx serve .
```

Phaser 3.90.0 is loaded from CDN in `index.html`. There are no tests, linter, or package.json.

## Architecture

All game logic lives in a single file: `game.js` (~1150 lines).

**Phaser scenes** (registered in order):
- `TitleScene` — splash screen; any keypress starts `GameScene`
- `GameScene` — core game loop (dungeon generation, snake, entities, FOV, rendering)
- `GameOverScene` — score display, leaderboard fetch, optional name entry

**Standalone utility sections** (top of `game.js`, above the scenes):
- Global constants (tile size, colors, AI states, scoring weights, `DIR` object)
- Audio synthesis functions using the Web Audio API
- Leaderboard helpers (`fetchLeaderboard`, `submitToLeaderboard`, `getPersonalBest`)
- BSP dungeon generator (`BSPNode`, `splitBSP`, `createRooms`, `connectRooms`, etc.)
- FOV engine (`computeFOV` + `castRay` using Bresenham line algorithm)

**Scene-to-scene data flow** — passed via `scene.start(key, data)`:
- `GameScene → GameScene` (level up): `{ level, snakeLength, baddiesKilled, maxSnakeLength, score }`
- `GameScene → GameOverScene`: same fields plus `length`

## Key Conventions

**Grid layout**
- All 2D arrays are indexed `[y][x]` (row-major).
- Tile constants: `WALL = 0`, `FLOOR = 1`.
- Visibility constants: `UNEXPLORED = 0`, `EXPLORED = 1`, `VISIBLE = 2`.
- Map dimensions scale with level: `(35 + 5*level)` wide × `(27 + 3*level)` tall.

**Entity representation**
- Snake: `this.snake` — array of `{x, y}` objects; index 0 is the head.
- Rats, baddies, staircase: plain `{x, y}` objects (baddies also carry AI state).
- Entity lookup during rendering uses a flat key: `key = y * mapW + x`.

**ASCII rendering**
- Every tile is a Phaser `Text` object in `this.displayGrid[y][x]`.
- Characters: `@` head, `o` body, `r` rat, `B` baddie, `>` staircase, `#` wall, `.` floor.
- Dirty tracking via `this.prevRender[y][x]` (stores `char+color` string) prevents redundant `setText` calls.
- Only tiles in the camera viewport ± 3 tile padding are evaluated each frame.

**Timing**
- Snake moves every `200 ms` (`this.snakeMoveInterval`).
- Baddies move every `300 ms` (`this.baddieMoveInterval`).
- Neither timer runs until the player gives their first directional input.

**Baddie AI** — two-state bounce patrol:
- `AI_MOVING`: advance in `primaryDirection`; on wall hit, reverse direction and enter `AI_SHIFTING`.
- `AI_SHIFTING`: sidestep 1–5 tiles in a perpendicular direction, then return to `AI_MOVING`.

**Scoring formula** (recalculated live, not accumulated):
```
score = (level × 100) + (baddiesKilled × 15) + (maxSnakeLength × 5)
```
Constants: `POINTS_PER_LEVEL`, `POINTS_PER_KILL`, `POINTS_PER_MAX_LENGTH`.

**Staircase unlock** — appears only after all baddies are dead; placed in the room farthest from the snake's head.

**Leaderboard** — external API at `https://snakelike-leaderboard.vercel.app/api/leaderboard`. Personal best is persisted in `localStorage` under key `snakelike_best`. Name entries are limited to 12 alphanumeric characters.

**Audio** — all sound effects are synthesized via `Web Audio API` (`scene.sound.context`). No audio files. Add new sounds by following the `playBeep` / oscillator pattern already used.
