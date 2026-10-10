import { COLS, ROWS, Dir, Pos, OPPOSITE, openDirs, samePos, step, passable } from './maze';
import type { Game } from './game';

const NEAR = 8;

const tilesAway = (n: number) => `${n} tile${n === 1 ? '' : 's'} away`;

export interface DirFeatures {
  dir: Dir;
  pelletDist: number | null;
  powerDist: number | null;
  pelletsNear: number;
  ghostDist: number | null;
  ghostName: string | null;
  edibleDist: number | null;
  reverse: boolean;
}

/** BFS from the tile one step in `dir`, never passing back through Pac-Man's tile. */
function scan(g: Game, dir: Dir): DirFeatures {
  const f: DirFeatures = {
    dir, pelletDist: null, powerDist: null, pelletsNear: 0,
    ghostDist: null, ghostName: null, edibleDist: null, reverse: dir === OPPOSITE[g.pacDir],
  };
  const start = step(g.pac, dir);
  const dist = new Map<number, number>([[start.y * COLS + start.x, 1]]);
  const queue: Pos[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const d = dist.get(p.y * COLS + p.x)!;
    const v = g.pellets[p.y][p.x];
    if (v > 0) {
      f.pelletDist ??= d;
      if (v === 2) f.powerDist ??= d;
      if (d <= NEAR) f.pelletsNear++;
    }
    for (const gh of g.ghosts) {
      if (!samePos(gh.pos, p)) continue;
      if (gh.mode === 'chase' && f.ghostDist === null) { f.ghostDist = d; f.ghostName = gh.name; }
      if (gh.mode === 'frightened') f.edibleDist ??= d;
    }
    for (const nd of openDirs(p)) {
      const n = step(p, nd);
      const k = n.y * COLS + n.x;
      if (dist.has(k) || samePos(n, g.pac)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }
  return f;
}

export function features(g: Game): DirFeatures[] {
  return openDirs(g.pac).map((d) => scan(g, d));
}

export function describe(f: DirFeatures): string {
  const parts: string[] = [];
  if (f.ghostDist !== null && f.ghostDist <= 3) parts.push(`DANGER: ghost ${f.ghostName} only ${tilesAway(f.ghostDist)}`);
  if (f.edibleDist !== null) parts.push(`edible blue ghost ${tilesAway(f.edibleDist)} (+200 points)`);
  parts.push(f.pelletDist === null ? 'no pellets reachable this way' : `nearest pellet ${tilesAway(f.pelletDist)}`);
  parts.push(`${f.pelletsNear} pellets within ${NEAR} tiles`);
  if (f.powerDist !== null && f.powerDist <= 10) parts.push(`power pellet ${tilesAway(f.powerDist)}`);
  if (f.ghostDist === null) parts.push('no dangerous ghost this way');
  else if (f.ghostDist > 3 && f.ghostDist <= 7) parts.push(`caution: ghost ${f.ghostName} ${tilesAway(f.ghostDist)}`);
  else if (f.ghostDist > 7) parts.push(`nearest ghost ${tilesAway(f.ghostDist)} (safe)`);
  if (f.reverse) parts.push('turns back');
  return parts.join(', ');
}

/** 11x11 ASCII view centred on Pac-Man. */
export function asciiWindow(g: Game, r = 5): string {
  const lines: string[] = [];
  for (let y = g.pac.y - r; y <= g.pac.y + r; y++) {
    let line = '';
    for (let dx = -r; dx <= r; dx++) {
      const p = { x: g.pac.x + dx, y };
      if (y < 0 || y >= ROWS || p.x < 0 || p.x >= COLS) { line += ' '; continue; }
      const gh = g.ghosts.find((q) => samePos(q.pos, p) && q.mode !== 'house');
      if (samePos(p, g.pac)) line += 'P';
      else if (gh) line += gh.mode === 'chase' ? 'G' : gh.mode === 'frightened' ? 'b' : ' ';
      else if (!passable(p)) line += '#';
      else line += g.pellets[y][p.x] === 2 ? 'o' : g.pellets[y][p.x] === 1 ? '.' : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export interface DecisionRequest {
  model: string;
  state: Record<string, string>;
  questions: Record<string, unknown>;
}

export function buildRequest(g: Game, model: string, feats: DirFeatures[]): DecisionRequest {
  const criteria: Record<string, string> = {};
  for (const f of feats) criteria[f.dir] = describe(f);
  const fright = g.frightLeft > 0 ? ` Ghosts are blue and edible for ${g.frightLeft} more ticks.` : '';
  return {
    model,
    state: {
      situation: `Pac-Man is at column ${g.pac.x}, row ${g.pac.y}, heading ${g.pacDir}. ` +
        `Score ${g.score}, ${g.lives} lives, ${g.pelletsLeft} pellets left.${fright}`,
      map: `Legend: # wall, . pellet, o power pellet, P Pac-Man, G ghost, b edible ghost.\n${asciiWindow(g)}`,
    },
    questions: {
      move: {
        type: 'choice',
        instructions: 'Which direction should Pac-Man move? Never move toward a nearby dangerous ghost. ' +
          'Otherwise prefer the direction with the closest pellets, or chase edible blue ghosts.',
        criteria,
      },
      danger: {
        type: 'noul',
        instructions: 'Is a dangerous ghost within 3 tiles of Pac-Man?',
      },
    },
  };
}

/** Rule-based baseline: used as the "heuristic" model and as a fallback when a request fails. */
export function heuristicChoice(feats: DirFeatures[]): Dir {
  let best = feats[0], bestScore = -Infinity;
  for (const f of feats) {
    let s = 0;
    if (f.ghostDist !== null) s -= f.ghostDist <= 2 ? 1000 : f.ghostDist <= 4 ? 200 : 40 / f.ghostDist;
    if (f.edibleDist !== null) s += 60 / f.edibleDist;
    s += f.pelletDist === null ? -50 : 20 / f.pelletDist;
    s += f.pelletsNear;
    if (f.reverse) s -= 2;
    if (s > bestScore) { bestScore = s; best = f; }
  }
  return best.dir;
}
