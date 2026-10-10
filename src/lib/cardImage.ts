type CardInput = {
  title: string;
  year: number | null;
  sentence: string;
  seeds: string[];
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

// The on-screen card uses img tags. This file is only the download, and it
// draws title tiles because poster pixels cannot be read into a canvas.
export async function renderCardPng(input: CardInput): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the card");

  ctx.fillStyle = "#070708";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const tileX = 90;
  const tileY = 180;
  const tileW = width - 180;
  const tileH = 900;
  roundRect(ctx, tileX, tileY, tileW, tileH, 28);
  ctx.fillStyle = "#16161a";
  ctx.fill();

  ctx.fillStyle = "#f7f4ee";
  ctx.font = "700 64px Segoe UI, sans-serif";
  drawCentered(ctx, input.title, width / 2, tileY + tileH / 2 - 80, tileW - 80, 76, 4);

  let cursor = tileY + tileH + 48;
  if (input.year != null) {
    ctx.fillStyle = "#e4b445";
    ctx.font = "650 36px Segoe UI, sans-serif";
    ctx.fillText(String(input.year), width / 2, cursor);
    cursor += 56;
  }

  ctx.fillStyle = "#d7d4cc";
  ctx.font = "400 32px Segoe UI, sans-serif";
  drawCentered(ctx, input.sentence, width / 2, cursor, tileW, 44, 5);

  const seeds = input.seeds.slice(0, 3);
  const seedW = 200;
  const seedH = 280;
  const gap = 24;
  const total = seeds.length * seedW + Math.max(0, seeds.length - 1) * gap;
  let seedX = (width - total) / 2;
  const seedY = 1500;
  ctx.font = "650 24px Segoe UI, sans-serif";
  for (const title of seeds) {
    roundRect(ctx, seedX, seedY, seedW, seedH, 16);
    ctx.fillStyle = "#16161a";
    ctx.fill();
    ctx.fillStyle = "#f7f4ee";
    drawCentered(ctx, title, seedX + seedW / 2, seedY + 96, seedW - 28, 30, 4);
    seedX += seedW + gap;
  }

  ctx.fillStyle = "#9a9aa2";
  ctx.font = "650 28px Segoe UI, sans-serif";
  ctx.fillText("Same taste. Better picks.", width / 2, 1820);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the image");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
