function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export class Pipe {
  constructor(x, width, gapTop, gapHeight, playHeight, speed) {
    this.x = x;
    this.width = width;
    this.gapTop = gapTop;
    this.gapHeight = gapHeight;
    this.playHeight = playHeight;
    this.speed = speed;
    this.scored = false;
    this.echoHighlightUntil = 0;
  }

  update() {
    this.x -= this.speed;
  }

  isOffscreen() {
    return this.x + this.width < 0;
  }

  getCollisionRects() {
    const topPipe = {
      x: this.x,
      y: 0,
      width: this.width,
      height: this.gapTop,
    };

    const bottomPipeY = this.gapTop + this.gapHeight;
    const bottomPipe = {
      x: this.x,
      y: bottomPipeY,
      width: this.width,
      height: this.playHeight - bottomPipeY,
    };

    return [topPipe, bottomPipe];
  }

  collidesWith(rect) {
    const [topPipe, bottomPipe] = this.getCollisionRects();
    return intersects(rect, topPipe) || intersects(rect, bottomPipe);
  }

  flashEcho(durationMs = 1000, now = getNow()) {
    this.echoHighlightUntil = Math.max(this.echoHighlightUntil, now + durationMs);
  }

  isEchoHighlighted(now = getNow()) {
    return this.echoHighlightUntil > now;
  }

  draw(ctx, now = getNow()) {
    const highlighted = this.isEchoHighlighted(now);
    const palette = highlighted
      ? {
          body: "#7d2029",
          dark: "#4f1119",
          light: "#d45c67",
          cap: "#a92f3c",
          glow: "rgba(232, 83, 102, 0.32)",
        }
      : {
          body: "#1a2232",
          dark: "#0d1422",
          light: "#31405a",
          cap: "#212c41",
          glow: "rgba(122, 144, 175, 0.08)",
        };
    const capHeight = 14;

    ctx.save();
    if (highlighted) {
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 12;
    }

    drawPipeBody(ctx, this.x, 0, this.width, this.gapTop, palette.body, palette.dark, palette.light);
    ctx.fillStyle = palette.cap;
    ctx.fillRect(this.x - 4, this.gapTop - capHeight, this.width + 8, capHeight);

    const bottomY = this.gapTop + this.gapHeight;
    drawPipeBody(
      ctx,
      this.x,
      bottomY,
      this.width,
      this.playHeight - bottomY,
      palette.body,
      palette.dark,
      palette.light
    );
    ctx.fillStyle = palette.cap;
    ctx.fillRect(this.x - 4, bottomY, this.width + 8, capHeight);
    ctx.restore();
  }
}

function drawPipeBody(ctx, x, y, width, height, body, dark, light) {
  ctx.fillStyle = body;
  ctx.fillRect(x, y, width, height);

  const step = 8;
  ctx.fillStyle = dark;
  for (let line = y; line < y + height; line += step * 2) {
    ctx.fillRect(x, line, width, 2);
  }

  ctx.fillStyle = light;
  ctx.fillRect(x + 4, y, 3, height);
  ctx.fillRect(x + width - 6, y, 2, height);
}

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
