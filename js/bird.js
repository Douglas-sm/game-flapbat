export class Bird {
  constructor(x, y, size = 18) {
    this.size = size;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.velocityY = 0;
    this.flapFrame = 0;
  }

  update(gravity, maxFallSpeed) {
    this.velocityY = Math.min(this.velocityY + gravity, maxFallSpeed);
    this.y += this.velocityY;
    this.flapFrame = (this.flapFrame + 1) % 20;
  }

  jump(jumpForce) {
    this.velocityY = jumpForce;
  }

  getBounds() {
    const half = this.size / 2;
    return {
      x: this.x - half,
      y: this.y - half,
      width: this.size,
      height: this.size,
    };
  }

  draw(ctx) {
    const px = Math.max(2, Math.floor(this.size / 7));
    const left = Math.floor(this.x - px * 4);
    const top = Math.floor(this.y - px * 3);
    const wingsRaised = this.flapFrame < 10;

    const wingOuterY = wingsRaised ? top + px : top + px * 3;
    const wingInnerY = wingsRaised ? top + px * 2 : top + px * 4;
    const tipY = wingsRaised ? top : top + px * 5;

    fillPixels(ctx, left - px, wingOuterY, 3, 1, px, "#4a4f6a");
    fillPixels(ctx, left, wingInnerY, 3, 1, px, "#23283a");
    fillPixels(ctx, left + px * 7, wingOuterY, 3, 1, px, "#4a4f6a");
    fillPixels(ctx, left + px * 6, wingInnerY, 3, 1, px, "#23283a");

    fillPixels(ctx, left + px * 2, top + px, 4, 4, px, "#4f556f");
    fillPixels(ctx, left + px * 3, top, 1, 1, px, "#4f556f");
    fillPixels(ctx, left + px * 5, top, 1, 1, px, "#4f556f");
    fillPixels(ctx, left + px * 3, top + px * 2, 2, 2, px, "#8e96bf");
    fillPixels(ctx, left + px * 4, top + px * 5, 1, 1, px, "#2c3145");

    fillPixels(ctx, left, tipY, 1, 1, px, "#626b8c");
    fillPixels(ctx, left + px * 8, tipY, 1, 1, px, "#626b8c");
    fillPixels(ctx, left + px * 6, top + px * 2, 1, 1, px, "#fb6675");
    fillPixels(ctx, left + px * 6, top + px * 3, 1, 1, px, "#dce2f4");
  }
}

function fillPixels(ctx, x, y, cols, rows, pixelSize, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, cols * pixelSize, rows * pixelSize);
}
