import {
  Dir, Pos, PAC_START, initialPellets, openDirs, passable, samePos, step, OPPOSITE,
} from './maze';
import { Ghost, createGhosts, moveGhost } from './ghosts';

export const FRIGHT_TICKS = 45;
const START_LIVES = 3;

export interface Game {
  tick: number;
  pac: Pos;
  pacPrev: Pos;
  pacDir: Dir;
  ghosts: Ghost[];
  pellets: number[][];
  pelletsLeft: number;
  score: number;
  lives: number;
  level: number;
  frightLeft: number;
  ghostCombo: number;
  status: 'playing' | 'dead' | 'gameover';
  /** Ticks to wait (e.g. after losing a life) before play resumes. */
  freeze: number;
  lastEvent: string;
}

function countPellets(p: number[][]): number {
  return p.reduce((n, row) => n + row.filter((v) => v > 0).length, 0);
}

export function newGame(): Game {
  const pellets = initialPellets();
  return {
    tick: 0,
    pac: { ...PAC_START },
    pacPrev: { ...PAC_START },
    pacDir: 'left',
    ghosts: createGhosts(),
    pellets,
    pelletsLeft: countPellets(pellets),
    score: 0,
    lives: START_LIVES,
    level: 1,
    frightLeft: 0,
    ghostCombo: 0,
    status: 'playing',
    freeze: 0,
    lastEvent: 'start',
  };
}

function resetPositions(g: Game): void {
  g.pac = { ...PAC_START };
  g.pacPrev = { ...PAC_START };
  g.pacDir = 'left';
  g.ghosts = createGhosts(g.tick);
  g.frightLeft = 0;
  g.freeze = 10;
}

/**
 * Whether Pac-Man is at a point where a decision is meaningful:
 * a junction, a blocked heading, or a ghost closing in along the corridor.
 */
export function needsDecision(g: Game): boolean {
  const open = openDirs(g.pac);
  if (!passable(step(g.pac, g.pacDir))) return open.length > 0;
  if (open.length > 2) return true;
  if (open.length === 2 && !open.includes(OPPOSITE[g.pacDir])) return true; // corner
  // Straight corridor: only reconsider when a dangerous ghost is close ahead.
  let p = g.pac;
  for (let i = 0; i < 4; i++) {
    p = step(p, g.pacDir);
    if (!passable(p)) break;
    if (g.ghosts.some((gh) => gh.mode === 'chase' && samePos(gh.pos, p))) return true;
  }
  return false;
}

function collide(g: Game): void {
  for (const gh of g.ghosts) {
    if (!samePos(gh.pos, g.pac) && !(samePos(gh.pos, g.pacPrev) && samePos(gh.prev, g.pac))) continue;
    if (gh.mode === 'frightened') {
      g.ghostCombo++;
      const pts = 200 * 2 ** (g.ghostCombo - 1);
      g.score += pts;
      gh.mode = 'eaten';
      g.lastEvent = `ate ${gh.name} +${pts}`;
    } else if (gh.mode === 'chase') {
      g.lives--;
      g.lastEvent = `caught by ${gh.name}`;
      g.status = g.lives > 0 ? 'dead' : 'gameover';
      return;
    }
  }
}

/** Advance one tick. `dir` is the heading chosen for Pac-Man (by model or keyboard). */
export function tick(g: Game, dir: Dir | null): void {
  if (g.status === 'gameover') return;
  if (g.status === 'dead') {
    resetPositions(g);
    g.status = 'playing';
    return;
  }
  if (g.freeze > 0) {
    g.freeze--;
    return;
  }
  g.tick++;

  if (dir && passable(step(g.pac, dir))) g.pacDir = dir;
  g.pacPrev = g.pac;
  if (passable(step(g.pac, g.pacDir))) g.pac = step(g.pac, g.pacDir);

  const v = g.pellets[g.pac.y][g.pac.x];
  if (v > 0) {
    g.pellets[g.pac.y][g.pac.x] = 0;
    g.pelletsLeft--;
    g.score += v === 2 ? 50 : 10;
    if (v === 2) {
      g.frightLeft = FRIGHT_TICKS;
      g.ghostCombo = 0;
      for (const gh of g.ghosts) if (gh.mode === 'chase') gh.mode = 'frightened';
      g.lastEvent = 'power pellet!';
    }
  }

  collide(g);
  if (g.status !== 'playing') return;

  if (g.frightLeft > 0 && --g.frightLeft === 0) {
    for (const gh of g.ghosts) if (gh.mode === 'frightened') gh.mode = 'chase';
  }
  for (const gh of g.ghosts) moveGhost(gh, g);
  collide(g);
  if (g.status !== 'playing') return;

  if (g.pelletsLeft === 0) {
    g.level++;
    g.pellets = initialPellets();
    g.pelletsLeft = countPellets(g.pellets);
    g.lastEvent = `level ${g.level}`;
    resetPositions(g);
  }
}
