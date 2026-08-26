# Tasks — Claude Flappy

Tracking what's been built and what's left, in the order we tackled it.

## Done

- [x] Project scaffolded: `index.html`, `style.css`, `game.js`, `.gitignore`
- [x] Canvas game loop with delta-time updates
- [x] Bird physics: gravity + flap impulse, rotation based on velocity
- [x] Pipe spawning, scrolling, and despawning with randomized gap position
- [x] Collision detection: bird vs. pipes, bird vs. ground/ceiling
- [x] Scoring: increments per pipe passed, best score persisted via `localStorage`
- [x] Game states: start screen → playing → game over → restart
- [x] Input handling: spacebar, mouse click, and touch tap
- [x] Rendering: background, pipes, scrolling ground, bird, score, overlays
- [x] Git repo initialized and pushed to GitHub (`claudeflappy`, public)

## Ideas for later (not started)

- [ ] Difficulty ramp (pipes speed up / gap narrows as score increases)
- [ ] Sound effects (flap, score, collision)
- [ ] Sprite art instead of primitive shapes
- [ ] Pause functionality
- [ ] Mobile-friendly responsive canvas sizing
