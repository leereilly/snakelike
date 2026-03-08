<picture>
     <source media="(prefers-color-scheme: dark)" srcset="snakelike-dark.svg">
     <source media="(prefers-color-scheme: light)" srcset="snakelike-light.svg">
     <img alt="GitHub contribution graph snake game" src="snakelike-light.svg">
   </picture>

A Snake × Roguelike mashup built with [Phaser 3](https://phaser.io/) and GitHub Copilot Coding Agent. Guide your snake through procedurally generated dungeons, eat rats to grow, avoid baddies, and descend deeper via staircases. Built for the [7DRL Challenge](https://itch.io/jam/7drl-challenge-2026).

![](logo.jpg)

## Features

- **Procedural dungeons** - BSP-generated maps that grow larger each level
- **Fog of war** - raycasting FOV reveals the dungeon as you explore
- **Enemy AI** - baddies patrol corridors and deal damage on contact
- **Progression** - eat all the rats and kill all the baddies to unlock the staircase to the next level
- **Retro audio** - synthesized sound effects via the Web Audio API

## How to Play

| Key | Action |
|-----|--------|
| Arrow keys | Change direction |
| Any key | Start / Restart |

Eat 🟡 rats to grow. Avoid 🔴 baddies head-on — they shrink your snake. Kill baddies by luring them into your tail. Reach the 🔵 staircase to descend.

## Getting Started

No build step required. Open `index.html` in a browser or serve it locally:

```sh
npx serve .
```

## Scoring

Your score is calculated using an additive formula:

```
Score = (Level × 100) + (Baddies Killed × 15) + (Max Snake Length × 5)
```

| Action | Points |
|--------|--------|
| Reach a new dungeon level | +100 per level |
| Kill a baddie | +15 per kill |
| Grow your snake | +5 per unit of max length |

Every action matters - kill baddies, eat rats to grow, and push deeper into the dungeon. There's an online leaderboard to share your glory!
## License

See [LICENSE](LICENSE) for details.
