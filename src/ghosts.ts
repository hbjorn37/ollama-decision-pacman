import { Dir, Pos, DELTA, GHOST_HOUSE_EXIT, GHOST_STARTS, OPPOSITE, openDirs, samePos, step, COLS, ROWS } from './maze';
import type { Game } from './game';

export type GhostMode = 'house' | 'chase' | 'frightened' | 'eaten';

export interface Ghost {
  name: string;
  color: string;
  pos: Pos;
  prev: Pos;
  dir: Dir;
  mode: GhostMode;
  releaseAt: number;
  target: (g: Game, self: Ghost) => Pos;
}

/** Probability a ghost follows its target at a junction instead of turning randomly. */
export const ghostSettings = { smartness: 0.7 };

const HOUSE_CENTER: Pos = { x: 13, y: 14 };

/** `now` is the current game tick; house release delays are relative to it. */
export function createGhosts(now = 0): Ghost[] {
  const mk = (name: string, color: string, i: number, delay: number, target: Ghost['target']): Ghost => ({
    name, color, pos: { ...GHOST_STARTS[i] }, prev: { ...GHOST_STARTS[i] }, dir: 'left',
    mode: delay === 0 ? 'chase' : 'house', releaseAt: now + delay, target,
  });
  return [
    mk('Blinky', '#ff3b3b', 0, 0, (g) => g.pac),
    mk('Pinky', '#ffb8ff', 1, 15, (g) => {
      const d = DELTA[g.pacDir];
      return { x: g.pac.x + d.x * 4, y: g.pac.y + d.y * 4 };
    }),
    mk('Inky', '#3bd6ff', 2, 40, (g) => {
      const b = g.ghosts[0].pos;
      const d = DELTA[g.pacDir];
      const ax = g.pac.x + d.x * 2, ay = g.pac.y + d.y * 2;
      return { x: 2 * ax - b.x, y: 2 * ay - b.y };
    }),
    mk('Clyde', '#ffb852', 3, 70, (g, self) =>
      Math.hypot(self.pos.x - g.pac.x, self.pos.y - g.pac.y) > 8 ? g.pac : { x: 0, y: ROWS - 1 }),
  ];
}

/** First step of a shortest ghost-passable path from `from` to `to` (BFS). */
function firstStepToward(from: Pos, to: Pos): Dir | null {
  const key = (p: Pos) => p.y * COLS + p.x;
  const seen = new Map<number, Dir>();
  const queue: Pos[] = [];
  for (const d of openDirs(from, true)) {
    const n = step(from, d);
    if (!seen.has(key(n))) { seen.set(key(n), d); queue.push(n); }
  }
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (samePos(p, to)) return seen.get(key(p))!;
    for (const d of openDirs(p, true)) {
      const n = step(p, d);
      if (!seen.has(key(n)) && !samePos(n, from)) { seen.set(key(n), seen.get(key(p))!); queue.push(n); }
    }
  }
  return null;
}

function chooseDir(gh: Ghost, target: Pos | null): Dir {
  const open = openDirs(gh.pos); // roaming ghosts never take the house door
  const forward = open.filter((d) => d !== OPPOSITE[gh.dir]);
  const options = forward.length ? forward : open;
  if (!target || Math.random() > ghostSettings.smartness) {
    return options[Math.floor(Math.random() * options.length)];
  }
  let best = options[0], bestDist = Infinity;
  for (const d of options) {
    const n = step(gh.pos, d);
    const dx = Math.min(Math.abs(n.x - target.x), COLS - Math.abs(n.x - target.x));
    const dist = Math.hypot(dx, n.y - target.y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

function moves(gh: Ghost, g: Game): boolean {
  if (gh.mode === 'eaten') return true;
  if (gh.mode === 'frightened') return g.tick % 2 === 0;
  return g.tick % 5 !== 0; // 80% of Pac-Man's speed
}

export function moveGhost(gh: Ghost, g: Game): void {
  gh.prev = gh.pos;
  if (!moves(gh, g)) return;

  if (gh.mode === 'house') {
    if (g.tick < gh.releaseAt) return;
    const d = firstStepToward(gh.pos, GHOST_HOUSE_EXIT);
    if (d) { gh.dir = d; gh.pos = step(gh.pos, d); }
    if (samePos(gh.pos, GHOST_HOUSE_EXIT)) gh.mode = g.frightLeft > 0 ? 'frightened' : 'chase';
    return;
  }
  if (gh.mode === 'eaten') {
    const d = firstStepToward(gh.pos, HOUSE_CENTER);
    if (d) { gh.dir = d; gh.pos = step(gh.pos, d); }
    if (samePos(gh.pos, HOUSE_CENTER)) { gh.mode = 'house'; gh.releaseAt = g.tick + 10; }
    return;
  }

  const d = chooseDir(gh, gh.mode === 'chase' ? gh.target(g, gh) : null);
  gh.dir = d;
  gh.pos = step(gh.pos, d);
}
