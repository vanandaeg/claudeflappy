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

    // Stack overlapping circles from bottom to top. The vertical step is
    // kept smaller than the combined radius of neighboring lobes so they
    // always overlap, however tall the tree is - otherwise tall/narrow
    // trees end up with lobes spaced too far apart to touch.
    const step = r * 0.8;
    const layers = Math.max(3, Math.round(tree.height / step) + 1);

    ctx.fillStyle = tree.shade ? '#3f6b47' : '#4f7d54';
    for (let i = 0; i < layers; i++) {
      const t = layers === 1 ? 0 : i / (layers - 1); // 0 at bottom, 1 at top
      const ly = bottomY - r * 0.5 - i * step;
      const jitter = Math.sin(i * 2.4 + tree.width) * r * 0.3;
      const lr = r * (1 - t * 0.3); // taper slightly toward the top
      ctx.beginPath();
      ctx.arc(cx + jitter, ly, lr, 0, Math.PI * 2);
      ctx.fill();
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

    // tail
    ctx.fillStyle = '#f9a825';
    ctx.beginPath();
    ctx.moveTo(-BIRD_RADIUS + 3, 0);
    ctx.lineTo(-BIRD_RADIUS - 8, -6);
    ctx.lineTo(-BIRD_RADIUS - 8, 6);
    ctx.closePath();
    ctx.fill();

    // body
    const bodyGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, BIRD_RADIUS + 2);
    bodyGrad.addColorStop(0, '#fff59d');
    bodyGrad.addColorStop(1, '#ffb300');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // wing (flaps continuously)
    ctx.save();
    ctx.translate(-3, 2);
    ctx.rotate(wingAngle);
    ctx.fillStyle = '#ef6c00';
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // head crest
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.moveTo(-3, -BIRD_RADIUS + 2);
    ctx.lineTo(1, -BIRD_RADIUS - 7);
    ctx.lineTo(5, -BIRD_RADIUS + 3);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(5, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(6.5, -5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7.3, -6.3, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = '#ff8f00';
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 3, -2);
    ctx.lineTo(BIRD_RADIUS + 11, 1);
    ctx.lineTo(BIRD_RADIUS - 3, 7);
    ctx.closePath();
    ctx.fill();
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

  function drawCenteredPanel(lines) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, HEIGHT / 2 - 90, WIDTH, 180);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.font = line.font || '20px Segoe UI, sans-serif';
      ctx.fillText(line.text, WIDTH / 2, HEIGHT / 2 - 40 + i * 36);
    });
  }

  function drawStartOverlay() {
    drawCenteredPanel([
      { text: 'Claude Flappy', font: 'bold 32px Segoe UI, sans-serif' },
      { text: 'Click, tap, or press Space to flap', font: '18px Segoe UI, sans-serif' },
      { text: `Best: ${best}`, font: '18px Segoe UI, sans-serif' },
    ]);
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
