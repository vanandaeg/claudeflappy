(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const GROUND_HEIGHT = 80;
  const GRAVITY = 1500; // px/s^2
  const FLAP_VELOCITY = -420; // px/s
  const PIPE_SPEED = 160; // px/s
  const PIPE_GAP = 150; // px
  const PIPE_WIDTH = 60;
  const PIPE_SPAWN_INTERVAL = 1.5; // seconds
  const BIRD_RADIUS = 14;
  const BIRD_X = 90;
  const TREE_LAYER_WIDTH = WIDTH * 2;
  const TREE_SPEED = PIPE_SPEED * 0.35;

  const STATE = { START: 'start', PLAYING: 'playing', GAME_OVER: 'gameover' };

  const BEST_SCORE_KEY = 'claudeflappy_best_score';

  let state = STATE.START;
  let bird, pipes, score, best, timeSincePipe, lastTime, groundOffset, bgOffset, wingPhase, trees, isNewBest;

  function initTrees() {
    trees = [];
    let x = 0;
    while (x < TREE_LAYER_WIDTH) {
      const width = 40 + Math.random() * 35;
      trees.push({
        x,
        width,
        height: 60 + Math.random() * 65,
        shade: Math.random() > 0.5,
      });
      x += width + 20 + Math.random() * 45;
    }
  }

  function loadBest() {
    const stored = localStorage.getItem(BEST_SCORE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  function saveBest(value) {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  }

  function resetGame() {
    bird = {
      x: BIRD_X,
      y: HEIGHT / 2,
      baseY: HEIGHT / 2,
      velocity: 0,
      rotation: 0,
    };
    pipes = [];
    score = 0;
    timeSincePipe = PIPE_SPAWN_INTERVAL; // spawn first pipe immediately
    groundOffset = 0;
  }

  function spawnPipe() {
    const margin = 60;
    const minTop = margin;
    const maxTop = HEIGHT - GROUND_HEIGHT - margin - PIPE_GAP;
    const gapTop = Math.random() * (maxTop - minTop) + minTop;
    pipes.push({
      x: WIDTH,
      gapTop,
      passed: false,
    });
  }

  function flap() {
    if (state === STATE.START) {
      state = STATE.PLAYING;
      bird.velocity = FLAP_VELOCITY;
    } else if (state === STATE.PLAYING) {
      bird.velocity = FLAP_VELOCITY;
    } else if (state === STATE.GAME_OVER) {
      resetGame();
      state = STATE.START;
    }
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function checkCollisions() {
    if (bird.y + BIRD_RADIUS >= HEIGHT - GROUND_HEIGHT) {
      return true;
    }
    if (bird.y - BIRD_RADIUS <= 0) {
      bird.y = BIRD_RADIUS;
      bird.velocity = 0;
    }

    for (const pipe of pipes) {
      const birdLeft = bird.x - BIRD_RADIUS;
      const birdRight = bird.x + BIRD_RADIUS;
      const birdTop = bird.y - BIRD_RADIUS;
      const birdBottom = bird.y + BIRD_RADIUS;

      const hitsTop = rectsOverlap(
        birdLeft, birdTop, birdRight - birdLeft, birdBottom - birdTop,
        pipe.x, 0, PIPE_WIDTH, pipe.gapTop
      );
      const hitsBottom = rectsOverlap(
        birdLeft, birdTop, birdRight - birdLeft, birdBottom - birdTop,
        pipe.x, pipe.gapTop + PIPE_GAP, PIPE_WIDTH, HEIGHT - GROUND_HEIGHT - (pipe.gapTop + PIPE_GAP)
      );

      if (hitsTop || hitsBottom) return true;
    }

    return false;
  }

  function update(dt) {
    if (state !== STATE.GAME_OVER) {
      groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;
      bgOffset = (bgOffset + TREE_SPEED * dt) % TREE_LAYER_WIDTH;
      wingPhase += dt * 10;
    }

    if (state === STATE.START) {
      bird.y = bird.baseY + Math.sin(wingPhase * 0.6) * 8;
      bird.rotation = Math.sin(wingPhase * 0.6) * 0.15;
    }

    if (state !== STATE.PLAYING) return;

    bird.velocity += GRAVITY * dt;
    bird.y += bird.velocity * dt;
    bird.rotation = Math.max(-0.5, Math.min(1.2, bird.velocity / 600));

    timeSincePipe += dt;
    if (timeSincePipe >= PIPE_SPAWN_INTERVAL) {
      timeSincePipe = 0;
      spawnPipe();
    }

    for (const pipe of pipes) {
      pipe.x -= PIPE_SPEED * dt;
      if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
        pipe.passed = true;
        score++;
      }
    }
    pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -10);

    if (checkCollisions()) {
      state = STATE.GAME_OVER;
      isNewBest = score > best;
      if (isNewBest) {
        best = score;
        saveBest(best);
      }
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#70c5ce');
    grad.addColorStop(1, '#a4e4eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawTree(x, tree) {
    const baseY = HEIGHT - GROUND_HEIGHT;
    const trunkWidth = 8;
    const trunkHeight = 40;

    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(x + tree.width / 2 - trunkWidth / 2, baseY - trunkHeight, trunkWidth, trunkHeight);

    const cx = x + tree.width / 2;
    const bottomY = baseY - trunkHeight;
    const r = tree.width / 2;

    // Stack overlapping circles from bottom to top, bulging widest in the
    // middle and tapering at both ends - an oval silhouette reads as much
    // rounder than a straight vertical stack. The vertical step is kept
    // smaller than the lobes' combined radius so neighbors always overlap,
    // however tall the tree is.
    const step = r * 0.65;
    const layers = Math.max(3, Math.round(tree.height / step) + 1);

    ctx.fillStyle = tree.shade ? '#3f6b47' : '#4f7d54';
    for (let i = 0; i < layers; i++) {
      const t = layers === 1 ? 0.5 : i / (layers - 1); // 0 at bottom, 1 at top
      const bulge = Math.sin(t * Math.PI); // 0 at both ends, 1 in the middle
      const ly = bottomY - r * 0.5 - i * step;
      const lr = r * (0.7 + bulge * 0.45);

      ctx.beginPath();
      ctx.arc(cx, ly, lr, 0, Math.PI * 2);
      ctx.fill();

      if (bulge > 0.2) {
        const sideOffset = lr * 0.75;
        const sideR = lr * 0.7;
        ctx.beginPath();
        ctx.arc(cx - sideOffset, ly, sideR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + sideOffset, ly, sideR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTrees() {
    for (const tree of trees) {
      for (const dup of [0, -TREE_LAYER_WIDTH, TREE_LAYER_WIDTH]) {
        const sx = tree.x - bgOffset + dup;
        if (sx < -100 || sx > WIDTH + 100) continue;
        drawTree(sx, tree);
      }
    }
  }

  function drawPipes() {
    ctx.fillStyle = '#4caf50';
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 3;
    for (const pipe of pipes) {
      const bottomY = pipe.gapTop + PIPE_GAP;
      const bottomHeight = HEIGHT - GROUND_HEIGHT - bottomY;

      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapTop);
      ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.gapTop);

      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);
      ctx.strokeRect(pipe.x, bottomY, PIPE_WIDTH, bottomHeight);

      ctx.fillRect(pipe.x - 4, pipe.gapTop - 24, PIPE_WIDTH + 8, 24);
      ctx.strokeRect(pipe.x - 4, pipe.gapTop - 24, PIPE_WIDTH + 8, 24);

      ctx.fillRect(pipe.x - 4, bottomY, PIPE_WIDTH + 8, 24);
      ctx.strokeRect(pipe.x - 4, bottomY, PIPE_WIDTH + 8, 24);
    }
  }

  function drawGround() {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = '#4a2c15';
    for (let x = -groundOffset; x < WIDTH; x += 24) {
      ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, 12, 10);
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    const wingAngle = Math.sin(wingPhase) * 0.5;

    // tail feathers
    ctx.fillStyle = '#d84315';
    ctx.beginPath();
    ctx.moveTo(-BIRD_RADIUS + 4, -1);
    ctx.lineTo(-BIRD_RADIUS - 9, -7);
    ctx.lineTo(-BIRD_RADIUS - 4, 0);
    ctx.lineTo(-BIRD_RADIUS - 9, 7);
    ctx.closePath();
    ctx.fill();

    // feet, tucked under the belly
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, BIRD_RADIUS - 4);
    ctx.lineTo(-4, BIRD_RADIUS + 3);
    ctx.moveTo(-4, BIRD_RADIUS + 3);
    ctx.lineTo(-7, BIRD_RADIUS + 4);
    ctx.moveTo(-4, BIRD_RADIUS + 3);
    ctx.lineTo(-2, BIRD_RADIUS + 5);
    ctx.moveTo(4, BIRD_RADIUS - 4);
    ctx.lineTo(5, BIRD_RADIUS + 3);
    ctx.moveTo(5, BIRD_RADIUS + 3);
    ctx.lineTo(2, BIRD_RADIUS + 4);
    ctx.moveTo(5, BIRD_RADIUS + 3);
    ctx.lineTo(7, BIRD_RADIUS + 5);
    ctx.stroke();

    // body - back shading over a lighter belly for a rounder, less flat look
    ctx.fillStyle = '#ffca28';
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const backGrad = ctx.createLinearGradient(0, -BIRD_RADIUS, 0, 2);
    backGrad.addColorStop(0, '#f57f17');
    backGrad.addColorStop(1, 'rgba(245, 127, 23, 0)');
    ctx.fillStyle = backGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS - 1, BIRD_RADIUS - 3, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 249, 196, 0.85)';
    ctx.beginPath();
    ctx.ellipse(1, 5, BIRD_RADIUS - 6, BIRD_RADIUS - 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // wing (flaps continuously) with feather texture
    ctx.save();
    ctx.translate(-3, 2);
    ctx.rotate(wingAngle);
    const wingGrad = ctx.createLinearGradient(-9, 0, 9, 0);
    wingGrad.addColorStop(0, '#e65100');
    wingGrad.addColorStop(1, '#ff9800');
    ctx.fillStyle = wingGrad;
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(191, 54, 12, 0.6)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-2, 0 + i * 2.5);
      ctx.lineTo(7, 2 + i * 2.5);
      ctx.stroke();
    }
    ctx.restore();

    // head crest
    ctx.fillStyle = '#d84315';
    ctx.beginPath();
    ctx.moveTo(-4, -BIRD_RADIUS + 2);
    ctx.lineTo(0, -BIRD_RADIUS - 8);
    ctx.lineTo(2, -BIRD_RADIUS + 1);
    ctx.moveTo(0, -BIRD_RADIUS + 1);
    ctx.lineTo(4, -BIRD_RADIUS - 7);
    ctx.lineTo(6, -BIRD_RADIUS + 3);
    ctx.closePath();
    ctx.fill();

    // cheek blush
    ctx.fillStyle = 'rgba(255, 138, 101, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-2, 1, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // eye with brow and highlight
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(5, -5, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(6.3, -4.7, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(6.6, -4.7, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7.4, -5.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(5, -6.5, 5, -2.5, -0.5);
    ctx.stroke();

    // beak, curved and slightly hooked like a real bird's
    ctx.fillStyle = '#ff8f00';
    ctx.strokeStyle = '#c25e00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 3, -3);
    ctx.quadraticCurveTo(BIRD_RADIUS + 14, -2, BIRD_RADIUS + 12, 1);
    ctx.quadraticCurveTo(BIRD_RADIUS + 6, 3, BIRD_RADIUS - 3, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(194, 94, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 1, 1);
    ctx.lineTo(BIRD_RADIUS + 10, 0.5);
    ctx.stroke();

    ctx.restore();
  }

  function drawScore() {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 40px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(score, WIDTH / 2, 60);
    ctx.fillText(score, WIDTH / 2, 60);
  }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawStar(cx, cy, size, alpha) {
    ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? size : size * 0.42;
      const px = cx + Math.cos(angle) * rad;
      const py = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawStartOverlay() {
    const panelW = 300;
    const panelH = 220;
    const panelX = WIDTH / 2 - panelW / 2;
    const panelY = HEIGHT / 2 - panelH / 2;
    const pulse = (Math.sin(wingPhase * 0.8) + 1) / 2; // 0..1

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // twinkling stars around the card
    const starSpots = [
      [panelX - 6, panelY + 4],
      [panelX + panelW + 6, panelY + 18],
      [panelX + panelW - 2, panelY + panelH - 2],
      [panelX + 10, panelY + panelH + 10],
    ];
    starSpots.forEach(([sx, sy], i) => {
      const twinkle = (Math.sin(wingPhase * 0.9 + i * 1.7) + 1) / 2;
      drawStar(sx, sy, 5 + twinkle * 3, 0.4 + twinkle * 0.6);
    });

    // card with soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    const cardGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    cardGrad.addColorStop(0, '#e1f5fe');
    cardGrad.addColorStop(1, '#b3e5fc');
    drawRoundedRect(panelX, panelY, panelW, panelH, 22);
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.restore();

    drawRoundedRect(panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = '#0277bd';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';

    // title with a playful drop-shadow pop
    ctx.font = 'bold 30px Segoe UI, sans-serif';
    ctx.fillStyle = '#01579b';
    ctx.fillText('Claude Flappy', WIDTH / 2 + 2, panelY + 52);
    ctx.fillStyle = '#ffb300';
    ctx.fillText('Claude Flappy', WIDTH / 2, panelY + 50);

    ctx.fillStyle = '#01579b';
    ctx.font = '15px Segoe UI, sans-serif';
    ctx.fillText('Click, tap, or press Space to flap', WIDTH / 2, panelY + 86);

    ctx.fillStyle = '#0277bd';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    ctx.fillText(`\u{1F3C6} Best: ${best}`, WIDTH / 2, panelY + 116);

    // pulsing call-to-action pill
    const pillY = panelY + panelH - 42;
    const scale = 1 + pulse * 0.07;
    ctx.save();
    ctx.translate(WIDTH / 2, pillY);
    ctx.scale(scale, scale);
    drawRoundedRect(-95, -18, 190, 36, 18);
    ctx.fillStyle = `rgba(255, 179, 0, ${0.85 + pulse * 0.15})`;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap to Start', 0, 5);
    ctx.restore();
  }

  function drawGameOverOverlay() {
    const panelW = 280;
    const panelH = isNewBest ? 230 : 200;
    const panelX = WIDTH / 2 - panelW / 2;
    const panelY = HEIGHT / 2 - panelH / 2;

    // dim the scene behind the card
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // card with soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    const cardGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    cardGrad.addColorStop(0, '#fff8e1');
    cardGrad.addColorStop(1, '#ffe0b2');
    drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.restore();

    drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';

    ctx.fillStyle = '#d84315';
    ctx.font = 'bold 32px Segoe UI, sans-serif';
    ctx.fillText('Game Over', WIDTH / 2, panelY + 46);

    ctx.strokeStyle = 'rgba(230, 81, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(panelX + 28, panelY + 60);
    ctx.lineTo(panelX + panelW - 28, panelY + 60);
    ctx.stroke();

    ctx.fillStyle = '#6d4c25';
    ctx.font = '15px Segoe UI, sans-serif';
    ctx.fillText('SCORE', WIDTH / 2 - 58, panelY + 88);
    ctx.fillText('BEST', WIDTH / 2 + 58, panelY + 88);

    ctx.fillStyle = '#4e342e';
    ctx.font = 'bold 30px Segoe UI, sans-serif';
    ctx.fillText(score, WIDTH / 2 - 58, panelY + 120);

    ctx.fillStyle = isNewBest ? '#f9a825' : '#4e342e';
    ctx.fillText(best, WIDTH / 2 + 58, panelY + 120);

    let hintY = panelY + 152;
    if (isNewBest) {
      ctx.fillStyle = '#f9a825';
      ctx.font = 'bold 15px Segoe UI, sans-serif';
      ctx.fillText('★ New Best! ★', WIDTH / 2, panelY + 148);
      hintY = panelY + 182;
    }

    drawRoundedRect(WIDTH / 2 - 118, hintY - 15, 236, 30, 15);
    ctx.fillStyle = '#ff8f00';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.fillText('Click, tap, or Space to retry', WIDTH / 2, hintY + 5);
  }

  function render() {
    drawBackground();
    drawTrees();
    drawPipes();
    drawGround();
    drawBird();
    if (state === STATE.PLAYING || state === STATE.GAME_OVER) {
      drawScore();
    }
    if (state === STATE.START) drawStartOverlay();
    if (state === STATE.GAME_OVER) drawGameOverOverlay();
  }

  function loop(timestamp) {
    if (lastTime === undefined) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 1 / 30); // clamp to avoid big jumps after tab switch
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function handleFlapInput(e) {
    e.preventDefault();
    flap();
  }

  canvas.addEventListener('mousedown', handleFlapInput);
  canvas.addEventListener('touchstart', handleFlapInput, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      flap();
    }
  });

  best = loadBest();
  bgOffset = 0;
  wingPhase = 0;
  initTrees();
  resetGame();
  requestAnimationFrame(loop);
})();
