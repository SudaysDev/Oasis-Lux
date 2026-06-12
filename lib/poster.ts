// Client-only stylized "poster" generator — a free fallback when the paid
// Gemini image model is unavailable, so the AI generate-image feature still works.

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const start = y - ((lines.length - 1) * lh) / 2;
  lines.slice(0, 5).forEach((l, i) => ctx.fillText(l, x, start + i * lh));
}

export function makePoster(prompt: string): string {
  if (typeof document === "undefined") return "";
  const size = 768;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) % 360;

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, `hsl(${h} 80% 12%)`);
  bg.addColorStop(1, `hsl(${(h + 60) % 360} 75% 7%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6; i++) {
    const bx = (Math.sin(i * 12.9 + h) * 0.5 + 0.5) * size;
    const by = (Math.cos(i * 7.3 + h) * 0.5 + 0.5) * size;
    const br = 120 + ((i * 53 + h) % 200);
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    rg.addColorStop(0, `hsla(${(h + i * 45) % 360} 90% 62% / 0.45)`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let p = 0; p <= size; p += 48) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px system-ui, sans-serif";
  wrapText(ctx, prompt.trim().toUpperCase(), size / 2, size / 2, size - 120, 52);

  ctx.font = "600 18px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("OASIS LUX · AI", size / 2, size - 48);

  return c.toDataURL("image/png");
}
