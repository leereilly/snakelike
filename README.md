# 🐍 SN@KELIKE

![](logo.jpg)

A Snake × Roguelike mashup built with [Phaser 3](https://phaser.io/) and GitHub Copilot Coding Agent. Guide your snake through procedurally generated dungeons, eat rats to grow, avoid baddies, and descend deeper via staircases. Built for the [7DRL Challenge](https://itch.io/jam/7drl-challenge-2026).

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

## License

See [LICENSE](LICENSE) for details.
