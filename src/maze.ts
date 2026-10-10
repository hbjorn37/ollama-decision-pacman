// Classic 28x31 layout. Legend:
//   #  wall          .  pellet        o  power pellet
//   -  ghost door    (space) empty floor
// Row 14 is the wrap-around tunnel.
const LAYOUT = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

export const COLS = 28;
export const ROWS = LAYOUT.length;

export type Tile = 'wall' | 'door' | 'floor';
export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Pos { x: number; y: number }

export const DIRS: Dir[] = ['up', 'left', 'down', 'right'];
export const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const PAC_START: Pos = { x: 13, y: 23 };
export const GHOST_HOUSE_EXIT: Pos = { x: 13, y: 11 };
export const GHOST_STARTS: Pos[] = [
  { x: 13, y: 11 },
  { x: 12, y: 14 },
  { x: 14, y: 14 },
  { x: 15, y: 14 },
];

for (const [i, row] of LAYOUT.entries()) {
  if (row.length !== COLS) throw new Error(`maze row ${i} has ${row.length} columns`);
}

export const tiles: Tile[][] = LAYOUT.map((row) =>
  [...row].map((c) => (c === '#' ? 'wall' : c === '-' ? 'door' : 'floor')),
);

/** Fresh pellet grid: 0 = none, 1 = pellet, 2 = power pellet. */
export function initialPellets(): number[][] {
  return LAYOUT.map((row) => [...row].map((c) => (c === '.' ? 1 : c === 'o' ? 2 : 0)));
}

export function wrapX(x: number): number {
  return (x + COLS) % COLS;
}

export function step(p: Pos, d: Dir): Pos {
  return { x: wrapX(p.x + DELTA[d].x), y: p.y + DELTA[d].y };
}

/** Whether a tile can be entered. Ghosts may pass the door; Pac-Man may not. */
export function passable(p: Pos, ghost = false): boolean {
  if (p.y < 0 || p.y >= ROWS) return false;
  const t = tiles[p.y][wrapX(p.x)];
  return t === 'floor' || (ghost && t === 'door');
}

export function openDirs(p: Pos, ghost = false): Dir[] {
  return DIRS.filter((d) => passable(step(p, d), ghost));
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}
