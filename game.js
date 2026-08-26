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

  const STATE = { START: 'start', PLAYING: 'playing', GAME_OVER: 'gameover' };

  const BEST_SCORE_KEY = 'claudeflappy_best_score';

  let state = STATE.START;
  let bird, pipes, score, best, timeSincePipe, lastTime, groundOffset;

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
    groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;

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
      if (score > best) {
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
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = '#c2b774';
    for (let x = -groundOffset; x < WIDTH; x += 24) {
      ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, 12, 10);
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#f57f17';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(5, -4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f57f17';
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 2, 0);
    ctx.lineTo(BIRD_RADIUS + 10, -3);
    ctx.lineTo(BIRD_RADIUS - 2, 6);
    ctx.closePath();
    ctx.fill();

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

  function drawGameOverOverlay() {
    drawCenteredPanel([
      { text: 'Game Over', font: 'bold 32px Segoe UI, sans-serif' },
      { text: `Score: ${score}   Best: ${best}`, font: '20px Segoe UI, sans-serif' },
      { text: 'Click, tap, or press Space to restart', font: '16px Segoe UI, sans-serif' },
    ]);
  }

  function render() {
    drawBackground();
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
  resetGame();
  requestAnimationFrame(loop);
})();
