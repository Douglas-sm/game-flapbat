import { Bird } from "./bird.js";
import { Pipe } from "./pipe.js";

const ECHO_FLASH_MS = 1000;
const ECHO_WAVE_DEFINITIONS = [
  { angle: -0.48, curveY: -18 },
  { angle: 0, curveY: 0 },
  { angle: 0.48, curveY: 18 },
];

export class Game {
  constructor(options = {}) {
    this.width = options.width ?? 480;
    this.height = options.height ?? 640;
    this.floorHeight = options.floorHeight ?? 72;
    this.playHeight = this.height - this.floorHeight;

    this.gravity = 0.28;
    this.maxFallSpeed = 6;
    this.jumpForce = -4.8;

    this.pipeWidth = 58;
    this.pipeGap = 145;
    this.pipeSpacing = 210;
    this.pipeSpeed = 2.2;

    this.echoPulseInterval = options.echoPulseInterval ?? 26;
    this.echoWaveSpeed = options.echoWaveSpeed ?? 12;
    this.echoWaveTrail = options.echoWaveTrail ?? 58;
    this.echoMaxDistance = options.echoMaxDistance ?? 270;
    this.maxEchoParticles = options.maxEchoParticles ?? 180;

    this.bird = new Bird(120, this.height / 2, 18);
    this.pipes = [];
    this.echoWaves = [];
    this.echoParticles = [];

    this.reset();
  }

  reset() {
    this.dead = false;
    this.score = 0;
    this.ticks = 0;
    this.lastEchoPulseTick = -this.echoPulseInterval;
    this.bird.reset(120, this.playHeight / 2);
    this.pipes = [];
    this.echoWaves = [];
    this.echoParticles = [];

    this.spawnPipe(this.width + 120);
    this.spawnPipe(this.width + 120 + this.pipeSpacing);
  }

  spawnPipe(startX) {
    const minGapTop = 80;
    const maxGapTop = this.playHeight - this.pipeGap - 80;
    const gapTop = Math.floor(minGapTop + Math.random() * (maxGapTop - minGapTop));
    this.pipes.push(
      new Pipe(startX, this.pipeWidth, gapTop, this.pipeGap, this.playHeight, this.pipeSpeed)
    );
  }

  getNextPipe() {
    return this.pipes.find((pipe) => pipe.x + pipe.width >= this.bird.x - 8) ?? null;
  }

  getStateInputs() {
    const nextPipe = this.getNextPipe();

    if (!nextPipe) {
      return {
        inputs: [this.bird.y / this.playHeight, 0, 1, 0.35, 0.65],
        nextPipe: null,
      };
    }

    const distanceX = (nextPipe.x + nextPipe.width - this.bird.x) / this.width;
    const velocityNorm = (this.bird.velocityY + this.maxFallSpeed) / (this.maxFallSpeed * 2);
    const gapTopNorm = nextPipe.gapTop / this.playHeight;
    const gapBottomNorm = (nextPipe.gapTop + nextPipe.gapHeight) / this.playHeight;

    return {
      inputs: [
        clamp01(this.bird.y / this.playHeight),
        clamp01(velocityNorm),
        clamp01(distanceX),
        clamp01(gapTopNorm),
        clamp01(gapBottomNorm),
      ],
      nextPipe,
    };
  }

  step(shouldJump) {
    if (this.dead) {
      return { dead: true, score: this.score };
    }

    if (shouldJump) {
      this.bird.jump(this.jumpForce);
    }

    this.bird.update(this.gravity, this.maxFallSpeed);

    for (const pipe of this.pipes) {
      pipe.update();

      if (!pipe.scored && pipe.x + pipe.width < this.bird.x) {
        pipe.scored = true;
        this.score += 1;
      }

      if (pipe.collidesWith(this.bird.getBounds())) {
        this.dead = true;
      }
    }

    this.updateEchoEffects();
    this.pipes = this.pipes.filter((pipe) => !pipe.isOffscreen());

    const lastPipe = this.pipes[this.pipes.length - 1];
    if (lastPipe && lastPipe.x < this.width - this.pipeSpacing) {
      this.spawnPipe(this.width + 40);
    }

    const birdTop = this.bird.y - this.bird.size / 2;
    const birdBottom = this.bird.y + this.bird.size / 2;
    if (birdTop < 0 || birdBottom > this.playHeight) {
      this.dead = true;
    }

    this.ticks += 1;
    return { dead: this.dead, score: this.score };
  }

  updateEchoEffects() {
    this.maybeEmitEchoPulse();
    this.updateEchoWaves();
    this.updateEchoParticles();
  }

  maybeEmitEchoPulse() {
    if (this.ticks - this.lastEchoPulseTick < this.echoPulseInterval) {
      return;
    }

    this.lastEchoPulseTick = this.ticks;
    const originX = this.bird.x + this.bird.size * 0.35;
    const originY = this.bird.y;

    for (const definition of ECHO_WAVE_DEFINITIONS) {
      this.echoWaves.push({
        originX,
        originY,
        angle: definition.angle,
        curveY: definition.curveY,
        previousDistance: 0,
        distance: 0,
      });
    }
  }

  updateEchoWaves() {
    const activeWaves = [];

    for (const wave of this.echoWaves) {
      wave.previousDistance = wave.distance;
      wave.distance = Math.min(this.echoMaxDistance, wave.distance + this.echoWaveSpeed);

      const collision = this.findWaveCollision(wave, wave.previousDistance, wave.distance);
      if (collision) {
        collision.pipe.flashEcho(ECHO_FLASH_MS);
        this.spawnEchoParticles(collision.x, collision.y, wave.angle);
        continue;
      }

      if (wave.distance < this.echoMaxDistance) {
        activeWaves.push(wave);
      }
    }

    this.echoWaves = activeWaves;
  }

  findWaveCollision(wave, startDistance, endDistance) {
    const span = endDistance - startDistance;
    const steps = Math.max(1, Math.ceil(span / 3));

    for (let step = 0; step <= steps; step += 1) {
      const distance = startDistance + (span * step) / steps;
      const point = pointAlongWave(wave, distance);

      for (const pipe of this.pipes) {
        if (point.x < pipe.x - 6 || point.x > pipe.x + pipe.width + 6) {
          continue;
        }

        const hit = pipe.getCollisionRects().some((rect) => pointInRect(point, rect));
        if (hit) {
          return { pipe, x: point.x, y: point.y };
        }
      }
    }

    return null;
  }

  spawnEchoParticles(x, y, angle) {
    const spreadX = Math.cos(angle + Math.PI / 2);
    const spreadY = Math.sin(angle + Math.PI / 2);
    const amount = 12;

    for (let i = 0; i < amount; i += 1) {
      const offset = (Math.random() - 0.5) * 16;
      const life = 32 + Math.floor(Math.random() * 16);
      this.echoParticles.push({
        x: x + spreadX * offset,
        y: y + spreadY * offset,
        prevX: x,
        prevY: y,
        speed: 1.7 + Math.random() * 1.9,
        size: Math.random() > 0.7 ? 3 : 2,
        life,
        maxLife: life,
        driftX: (Math.random() - 0.5) * 0.45,
        driftY: (Math.random() - 0.5) * 0.45,
      });
    }

    if (this.echoParticles.length > this.maxEchoParticles) {
      this.echoParticles.splice(0, this.echoParticles.length - this.maxEchoParticles);
    }
  }

  updateEchoParticles() {
    const targetX = this.bird.x + this.bird.size * 0.15;
    const targetY = this.bird.y;
    const activeParticles = [];

    for (const particle of this.echoParticles) {
      particle.prevX = particle.x;
      particle.prevY = particle.y;

      const dx = targetX - particle.x;
      const dy = targetY - particle.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = particle.speed + (1 - particle.life / particle.maxLife) * 1.35;

      particle.x += (dx / distance) * pull + particle.driftX;
      particle.y += (dy / distance) * pull + particle.driftY;
      particle.driftX *= 0.92;
      particle.driftY *= 0.92;
      particle.life -= 1;

      if (particle.life > 0 && distance > 7) {
        activeParticles.push(particle);
      }
    }

    this.echoParticles = activeParticles;
  }

  draw(ctx, options = {}) {
    const simplified = options.simplified ?? false;
    const overlayText = options.overlayText ?? "";
    const now = getNow();

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    this.drawBackground(ctx, simplified);
    this.drawGround(ctx, simplified);

    for (const pipe of this.pipes) {
      pipe.draw(ctx, now);
    }

    this.drawEchoWaves(ctx, simplified);
    this.drawEchoParticles(ctx, simplified);
    this.bird.draw(ctx);
    this.drawScore(ctx);

    if (overlayText) {
      ctx.fillStyle = "rgba(3, 7, 13, 0.75)";
      ctx.fillRect(8, 8, 206, 22);
      ctx.strokeStyle = "#203245";
      ctx.strokeRect(8.5, 8.5, 205, 21);
      ctx.fillStyle = "#b9ddf4";
      ctx.font = "12px monospace";
      ctx.fillText(overlayText, 14, 23);
    }

    ctx.restore();
  }

  drawBackground(ctx, simplified) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.playHeight);
    gradient.addColorStop(0, "#02050a");
    gradient.addColorStop(0.45, "#08111a");
    gradient.addColorStop(1, "#0d1724");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.playHeight);

    drawMoon(ctx, this.width - 86, 74, simplified ? 22 : 28);

    ctx.fillStyle = "rgba(228, 236, 255, 0.12)";
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 61) % this.width;
      const y = 20 + ((i * 37) % Math.max(32, this.playHeight - 220));
      const size = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(x, y, size, size);
    }

    ctx.fillStyle = "rgba(92, 113, 145, 0.08)";
    for (let y = 118; y < this.playHeight - 120; y += 58) {
      ctx.fillRect(0, y, this.width, 2);
    }

    if (simplified) {
      return;
    }

    drawSilhouetteLayer(ctx, this.width, this.playHeight - 118, 34, 34, "#070c14");
    drawSilhouetteLayer(ctx, this.width, this.playHeight - 78, 28, 24, "#0b121b");
    drawSilhouetteLayer(ctx, this.width, this.playHeight - 42, 22, 12, "#111926");
  }

  drawGround(ctx, simplified) {
    ctx.fillStyle = "#0a0d13";
    ctx.fillRect(0, this.playHeight, this.width, this.floorHeight);
    ctx.fillStyle = "#1d2a3b";
    ctx.fillRect(0, this.playHeight, this.width, 6);

    const block = 16;
    for (let y = this.playHeight + 6; y < this.height; y += block) {
      for (let x = 0; x < this.width; x += block) {
        if (simplified) {
          ctx.fillStyle = (x / block + y / block) % 2 === 0 ? "#101823" : "#0b1119";
        } else {
          ctx.fillStyle = (x / block + y / block) % 2 === 0 ? "#121b27" : "#0d131c";
        }
        ctx.fillRect(x, y, block, block);
      }
    }
  }

  drawEchoWaves(ctx, simplified) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const wave of this.echoWaves) {
      const startDistance = Math.max(0, wave.distance - this.echoWaveTrail);
      const start = pointAlongWave(wave, startDistance);
      const end = pointAlongWave(wave, wave.distance);
      const controlDistance = startDistance + (wave.distance - startDistance) * 0.56;
      const controlPoint = pointAlongWave(wave, controlDistance);
      controlPoint.x += 10;
      controlPoint.y += wave.curveY;

      if (!simplified) {
        ctx.strokeStyle = "rgba(79, 170, 214, 0.2)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, end.x, end.y);
        ctx.stroke();
      }

      ctx.strokeStyle = simplified ? "rgba(126, 219, 255, 0.58)" : "rgba(148, 232, 255, 0.84)";
      ctx.lineWidth = simplified ? 2 : 3;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, end.x, end.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEchoParticles(ctx, simplified) {
    if (simplified) {
      return;
    }

    for (const particle of this.echoParticles) {
      const alpha = clamp01(particle.life / particle.maxLife);
      ctx.fillStyle = `rgba(155, 226, 255, ${alpha * 0.9})`;
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);

      ctx.fillStyle = `rgba(88, 153, 183, ${alpha * 0.36})`;
      ctx.fillRect(
        Math.round((particle.x + particle.prevX) / 2),
        Math.round((particle.y + particle.prevY) / 2),
        1,
        1
      );
    }
  }

  drawScore(ctx) {
    ctx.fillStyle = "rgba(3, 8, 14, 0.8)";
    ctx.fillRect(this.width - 96, 8, 88, 32);
    ctx.strokeStyle = "#223548";
    ctx.strokeRect(this.width - 95.5, 8.5, 87, 31);
    ctx.fillStyle = "#ecf3ff";
    ctx.font = "15px monospace";
    ctx.fillText(`Score ${this.score}`, this.width - 88, 29);
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function pointAlongWave(wave, distance) {
  return {
    x: wave.originX + Math.cos(wave.angle) * distance,
    y: wave.originY + Math.sin(wave.angle) * distance,
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function drawMoon(ctx, x, y, radius) {
  ctx.save();
  ctx.fillStyle = "rgba(209, 223, 242, 0.12)";
  ctx.beginPath();
  ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d7e2f1";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#07101a";
  ctx.beginPath();
  ctx.arc(x + radius * 0.42, y - radius * 0.15, radius * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSilhouetteLayer(ctx, width, baseY, step, heightVariance, color) {
  ctx.fillStyle = color;
  for (let x = 0; x < width + step; x += step) {
    const index = Math.floor(x / step);
    const height = 18 + ((index % 4) * heightVariance) / 3 + ((index % 2) * heightVariance) / 4;
    ctx.fillRect(x, baseY - height, step - 4, height);
  }
}

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
