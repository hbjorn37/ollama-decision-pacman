import { COLS, ROWS, Dir, Pos, tiles } from './maze';
import type { Game } from './game';

export const TILE = 20;
const HUD = 32;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE + HUD;

const ANGLE: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** Interpolate between two tiles; jumps (tunnel wrap) are not interpolated. */
function lerp(a: Pos, b: Pos, t: number): Pos {
  if (Math.abs(a.x - b.x) > 1) return b;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

let mazeCache: HTMLCanvasElement | null = null;

function drawMaze(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WIDTH;
  c.height = ROWS * TILE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tiles[y][x];
      if (t === 'wall') {
        ctx.fillStyle = '#1b2b8f';
        ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      } else if (t === 'door') {
        ctx.fillStyle = '#f7b6d2';
        ctx.fillRect(x * TILE, y * TILE + TILE / 2 - 2, TILE, 4);
      }
    }
  }
  return c;
}

export function render(ctx: CanvasRenderingContext2D, g: Game, t: number, thinking: boolean): void {
  mazeCache ??= drawMaze();
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#e8e8f0';
  ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SCORE ${g.score}`, 10, HUD / 2);
  ctx.fillText(`LV ${g.level}`, WIDTH / 2 - 20, HUD / 2);
  ctx.fillStyle = '#ffd400';
  for (let i = 0; i < g.lives; i++) {
    ctx.beginPath();
    ctx.moveTo(WIDTH - 20 - i * 22, HUD / 2);
    ctx.arc(WIDTH - 20 - i * 22, HUD / 2, 8, 0.25 * Math.PI, 1.75 * Math.PI);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, HUD);
  ctx.drawImage(mazeCache, 0, 0);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = g.pellets[y][x];
      if (!v) continue;
      ctx.fillStyle = '#ffd9b3';
      ctx.beginPath();
      ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, v === 2 ? 6 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const gh of g.ghosts) {
    const p = lerp(gh.prev, gh.pos, t);
    const cx = p.x * TILE + TILE / 2, cy = p.y * TILE + TILE / 2, r = TILE / 2 - 1;
    const flashing = gh.mode === 'frightened' && g.frightLeft < 12 && g.frightLeft % 2 === 0;
    if (gh.mode !== 'eaten') {
      ctx.fillStyle = gh.mode === 'frightened' ? (flashing ? '#ffffff' : '#2b4bff') : gh.color;
      ctx.beginPath();
      ctx.arc(cx, cy - 1, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r);
      for (let i = 0; i < 3; i++) ctx.lineTo(cx + r - (i * 2 + 1) * (r / 3), cy + r - (i % 2 === 0 ? 4 : 0));
      ctx.lineTo(cx - r, cy + r);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const pp = lerp(g.pacPrev, g.pac, t);
  const mouth = thinking ? 0.05 : 0.25 * Math.abs(Math.sin((g.tick + t) * Math.PI / 2));
  const a = ANGLE[g.pacDir];
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  ctx.moveTo(pp.x * TILE + TILE / 2, pp.y * TILE + TILE / 2);
  ctx.arc(pp.x * TILE + TILE / 2, pp.y * TILE + TILE / 2, TILE / 2 - 1, a + mouth * Math.PI, a + (2 - mouth) * Math.PI);
  ctx.fill();

  if (thinking) {
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pp.x * TILE + TILE / 2, pp.y * TILE + TILE / 2, TILE - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (g.status === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#ff5050';
    ctx.font = 'bold 36px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', WIDTH / 2, HEIGHT / 2);
    ctx.textAlign = 'start';
  }
}
