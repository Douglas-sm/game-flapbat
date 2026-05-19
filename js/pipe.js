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
    this.echoRevealDuration = 0;
    this.echoRevealStartedAt = 0;
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
    if (!this.isEchoHighlighted(now)) {
      this.echoRevealStartedAt = now;
    }

    this.echoRevealDuration = durationMs;
    this.echoHighlightUntil = Math.max(this.echoHighlightUntil, now + durationMs);
  }

  isEchoHighlighted(now = getNow()) {
    return this.echoHighlightUntil > now;
  }

  getEchoRevealState(now = getNow()) {
    if (!this.isEchoHighlighted(now) || this.echoRevealDuration <= 0) {
      return {
        alpha: 0,
        outlineProgress: 0,
        fillProgress: 0,
      };
    }

    const remaining = this.echoHighlightUntil - now;
    const fadeProgress = clamp01(remaining / this.echoRevealDuration);
    const fadeWindow = 0.28;
    const alpha = fadeProgress > fadeWindow ? 1 : fadeProgress / fadeWindow;

    const elapsed = Math.max(0, now - this.echoRevealStartedAt);
    const introDuration = Math.min(520, Math.max(320, this.echoRevealDuration * 0.52));
    const introProgress = clamp01(elapsed / introDuration);
    const outlinePhase = 0.42;

    return {
      alpha,
      outlineProgress: clamp01(introProgress / outlinePhase),
      fillProgress: clamp01((introProgress - outlinePhase) / (1 - outlinePhase)),
    };
  }

  draw(ctx, now = getNow()) {
    const reveal = this.getEchoRevealState(now);
    const ghostPalette = {
      body: "#1a2232",
      dark: "#0d1422",
      light: "#31405a",
      cap: "#212c41",
      edge: "#5a6a86",
    };
    const revealPalette = {
      body: "#c33b4e",
      dark: "#7b1627",
      light: "#ff9ca9",
      cap: "#ff697e",
      edge: "#ffd5db",
      scan: "#fff0f3",
      glow: "rgba(255, 96, 121, 0.52)",
    };
    const capHeight = 14;
    const topSection = {
      x: this.x,
      y: 0,
      width: this.width,
      height: this.gapTop,
      anchor: "bottom",
      capRect: {
        x: this.x - 4,
        y: this.gapTop - capHeight,
        width: this.width + 8,
        height: capHeight,
      },
    };
    const bottomY = this.gapTop + this.gapHeight;
    const bottomSection = {
      x: this.x,
      y: bottomY,
      width: this.width,
      height: this.playHeight - bottomY,
      anchor: "top",
      capRect: {
        x: this.x - 4,
        y: bottomY,
        width: this.width + 8,
        height: capHeight,
      },
    };

    ctx.save();
    ctx.globalAlpha = 0.1;
    drawGhostPipeSection(ctx, topSection, ghostPalette);
    drawGhostPipeSection(ctx, bottomSection, ghostPalette);
    ctx.restore();

    if (reveal.alpha <= 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = reveal.alpha;
    ctx.shadowColor = revealPalette.glow;
    ctx.shadowBlur = 8 + reveal.outlineProgress * 12;

    drawPipeSection(ctx, topSection, revealPalette, reveal);
    drawPipeSection(ctx, bottomSection, revealPalette, reveal);
    ctx.restore();
  }
}

function drawGhostPipeSection(ctx, section, palette) {
  if (section.height <= 0) {
    return;
  }

  ctx.fillStyle = palette.body;
  ctx.fillRect(section.x, section.y, section.width, section.height);

  const step = 8;
  ctx.fillStyle = palette.dark;
  for (let line = section.y; line < section.y + section.height; line += step * 2) {
    ctx.fillRect(section.x, line, section.width, 2);
  }

  ctx.fillStyle = palette.light;
  ctx.fillRect(section.x + 4, section.y, 3, section.height);
  ctx.fillRect(section.x + section.width - 6, section.y, 2, section.height);
  ctx.fillStyle = palette.edge;
  ctx.fillRect(section.x + 10, section.y, 1, section.height);

  ctx.fillStyle = palette.cap;
  ctx.fillRect(
    section.capRect.x,
    section.capRect.y,
    section.capRect.width,
    section.capRect.height
  );
}

function drawPipeSection(ctx, section, palette, reveal) {
  if (section.height <= 0) {
    return;
  }

  drawProgressOutline(ctx, section.x, section.y, section.width, section.height, 2, reveal.outlineProgress, palette.edge);
  drawProgressOutline(
    ctx,
    section.capRect.x,
    section.capRect.y,
    section.capRect.width,
    section.capRect.height,
    2,
    reveal.outlineProgress,
    palette.cap
  );

  if (reveal.fillProgress <= 0) {
    return;
  }

  drawPipeBodyFill(ctx, section, palette, reveal.fillProgress);
  drawCapFill(ctx, section.capRect, palette, reveal.fillProgress);
}

function drawPipeBodyFill(ctx, section, palette, fillProgress) {
  const fillHeight = Math.max(1, Math.floor(section.height * fillProgress));
  const fillY = section.anchor === "bottom" ? section.y + section.height - fillHeight : section.y;

  ctx.save();
  ctx.beginPath();
  ctx.rect(section.x, section.y, section.width, section.height);
  ctx.clip();
  ctx.globalAlpha *= 0.2 + fillProgress * 0.8;

  ctx.fillStyle = palette.body;
  ctx.fillRect(section.x, fillY, section.width, fillHeight);

  const step = 8;
  ctx.fillStyle = palette.dark;
  for (let line = fillY; line < fillY + fillHeight; line += step * 2) {
    ctx.fillRect(section.x, line, section.width, 2);
  }

  ctx.fillStyle = palette.light;
  ctx.fillRect(section.x + 4, fillY, 3, fillHeight);
  ctx.fillRect(section.x + section.width - 6, fillY, 2, fillHeight);
  ctx.fillStyle = palette.edge;
  ctx.fillRect(section.x + 10, fillY, 1, fillHeight);
  ctx.restore();

  const scanY =
    section.anchor === "bottom" ? fillY : fillY + fillHeight - 2;
  const scanHeight = Math.min(3, Math.max(2, fillHeight));
  const scanTop = section.anchor === "bottom" ? scanY : scanY - (scanHeight - 2);

  ctx.save();
  ctx.globalAlpha *= 0.25 + (1 - fillProgress) * 0.75;
  ctx.fillStyle = palette.scan;
  ctx.fillRect(section.x - 2, scanTop, section.width + 4, scanHeight);
  ctx.restore();
}

function drawCapFill(ctx, rect, palette, fillProgress) {
  ctx.save();
  ctx.globalAlpha *= 0.15 + fillProgress * 0.85;
  ctx.fillStyle = palette.cap;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = palette.edge;
  ctx.fillRect(rect.x + 2, rect.y + 3, rect.width - 4, 2);
  ctx.restore();
}

function drawProgressOutline(ctx, x, y, width, height, thickness, progress, color) {
  if (progress <= 0 || width <= 0 || height <= 0) {
    return;
  }

  const topLength = width;
  const sideLength = height;
  const bottomLength = width;
  const leftLength = height;
  const perimeter = topLength + sideLength + bottomLength + leftLength;
  let remaining = perimeter * clamp01(progress);

  ctx.fillStyle = color;

  const drawSegment = (length, paint) => {
    if (remaining <= 0) {
      return;
    }

    const segmentLength = Math.min(length, remaining);
    paint(segmentLength);
    remaining -= segmentLength;
  };

  drawSegment(topLength, (segmentLength) => {
    ctx.fillRect(x, y, segmentLength, thickness);
  });
  drawSegment(sideLength, (segmentLength) => {
    ctx.fillRect(x + width - thickness, y, thickness, segmentLength);
  });
  drawSegment(bottomLength, (segmentLength) => {
    ctx.fillRect(x + width - segmentLength, y + height - thickness, segmentLength, thickness);
  });
  drawSegment(leftLength, (segmentLength) => {
    ctx.fillRect(x, y + height - segmentLength, thickness, segmentLength);
  });
}

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
