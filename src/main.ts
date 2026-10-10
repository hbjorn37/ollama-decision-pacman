import { Dir } from './maze';
import { Game, newGame, needsDecision, tick } from './game';
import { ghostSettings } from './ghosts';
import { buildRequest, features, heuristicChoice } from './features';
import { decide, installedModels } from './decision';
import { render, WIDTH, HEIGHT } from './render';
import * as panel from './panel';

const HEURISTIC = 'heuristic (no model)';
const DECISION_MODEL = /nimble|clef|tev1/i;
const TIMEOUT_MS = 20000;

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext('2d')!;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const modelSel = el<HTMLSelectElement>('model');
const modeSel = el<HTMLSelectElement>('mode');
const speed = el<HTMLInputElement>('speed');
const smart = el<HTMLInputElement>('smart');
const playBtn = el<HTMLButtonElement>('play');

let game: Game = newGame();
let running = false; // starts once the model list has loaded
let stepOnce = false;
let pending = false;
let generation = 0; // bumps on reset so stale responses are ignored
let decided: Dir | null = null;
let keyDir: Dir | null = null;
let lastTick = performance.now();
let decisions = 0;
let fallbacks = 0;
let latencies: number[] = [];
let lastEvent = game.lastEvent;

function reset(): void {
  generation++;
  game = newGame();
  pending = false;
  decided = null;
  keyDir = null;
  decisions = fallbacks = 0;
  latencies = [];
  lastEvent = game.lastEvent;
  panel.clearHistory();
  panel.updateStats(0, latencies, 0);
}

/** Ask the selected model (or the heuristic) for Pac-Man's next heading. */
function requestDecision(): void {
  const feats = features(game);
  const options = feats.map((f) => f.dir);
  if (options.length === 1) { decided = options[0]; return; }

  const n = ++decisions;
  const model = modelSel.value;
  const req = buildRequest(game, model, feats);
  const pos = { ...game.pac };
  const event = game.lastEvent !== lastEvent ? game.lastEvent : '';
  lastEvent = game.lastEvent;
  panel.showRequest(n, req, feats);

  if (model === HEURISTIC) {
    decided = heuristicChoice(feats);
    panel.showResult(null, decided, options, null, 'heuristic');
    panel.addHistory(n, pos, decided, null, null, event, false);
    panel.updateStats(decisions, latencies, fallbacks);
    return;
  }

  pending = true;
  panel.showThinking();
  const gen = generation;
  decide(req, TIMEOUT_MS)
    .then((res) => {
      if (gen !== generation) return;
      const choice = res.move?.choice as Dir | undefined;
      const valid = choice !== undefined && options.includes(choice);
      decided = valid ? choice : heuristicChoice(feats);
      latencies.push(res.ms);
      if (!valid) fallbacks++;
      panel.showResult(res, decided, options, valid ? null : `invalid choice: ${choice}`, 'heuristic');
      panel.addHistory(n, pos, decided, res.move?.probabilities[decided] ?? null, res.ms, event, !valid);
    })
    .catch((err: Error) => {
      if (gen !== generation) return;
      decided = heuristicChoice(feats);
      fallbacks++;
      panel.showResult(null, decided, options, err.message, 'heuristic');
      panel.addHistory(n, pos, decided, null, null, `${event} error`.trim(), true);
    })
    .finally(() => {
      if (gen !== generation) return;
      pending = false;
      panel.updateStats(decisions, latencies, fallbacks);
      lastTick = performance.now() - Number(speed.value); // move immediately once decided
    });
}

function doTick(now: number): void {
  lastTick = now;
  if (game.status === 'gameover') return;
  const ai = modeSel.value === 'ai';
  if (ai && game.status === 'playing' && game.freeze === 0 && decided === null && needsDecision(game)) {
    requestDecision();
    if (pending) return;
  }
  tick(game, ai ? decided : keyDir);
  decided = null;
  stepOnce = false;
}

function frame(now: number): void {
  const tickMs = Number(speed.value);
  if ((running || stepOnce) && !pending && now - lastTick >= tickMs) doTick(now);
  const t = pending || (!running && !stepOnce) ? 1 : Math.min(1, (now - lastTick) / tickMs);
  render(ctx, game, t, pending);
  requestAnimationFrame(frame);
}

function setRunning(v: boolean): void {
  running = v;
  playBtn.textContent = v ? 'Pause' : 'Play';
}

const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (KEYS[e.key]) { keyDir = KEYS[e.key]; e.preventDefault(); }
  else if (e.key === ' ') { setRunning(!running); e.preventDefault(); }
  else if (e.key === 'n') stepOnce = true;
  else if (e.key === 'r') reset();
});
playBtn.onclick = () => setRunning(!running);
el('step').onclick = () => { setRunning(false); stepOnce = true; };
el('reset').onclick = reset;

const syncLabels = () => {
  el('speedVal').textContent = `${speed.value} ms`;
  el('smartVal').textContent = smart.value;
  ghostSettings.smartness = Number(smart.value);
};
speed.oninput = smart.oninput = syncLabels;
syncLabels();

installedModels().then((names) => {
  const models = names.filter((m) => DECISION_MODEL.test(m));
  for (const name of [...models, HEURISTIC]) modelSel.add(new Option(name, name));
  const preferred = models.find((m) => m.startsWith('tev1:4b')) ?? models[0] ?? HEURISTIC;
  modelSel.value = preferred;
  if (!models.length) panel.showResult(null, 'left', [], 'no decision model installed (ollama pull nimble)', 'heuristic');
  setRunning(true);
});

requestAnimationFrame(frame);
