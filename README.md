# ollama-decision-pacman

Pac-Man played by a **local, on-device decision model** through Ollama's `/v1/systemone` (Jev-style) API. A live panel on the right shows every request the model receives (`state` + typed `questions`) and every answer it returns (choice, per-option probabilities, confidence, latency).

No cloud, no API key: the game, the model and the inference all run on one desktop machine.

![demo](docs/demo.gif)

<sub>`tev1:4b` on a Mac mini (M4, 16 GB), played back at **2x speed**. Each decision takes about 1 s on this machine. The game pauses while the model thinks (lock-step), so latency never changes the outcome.</sub>

## Test environment

Everything in this repo was built and measured on this machine:

| | |
|---|---|
| Machine | Mac mini (Mac16,10) |
| Chip | Apple M4, 10-core CPU (4 performance + 6 efficiency) |
| Memory | 16 GB unified memory |
| OS | macOS 26.6 |
| Ollama | 0.40.2 |
| Node.js | 24.21 |

## Requirements

- [Ollama](https://ollama.com) 0.35.1 or newer (provides `/v1/systemone`)
- Node.js 20 or newer
- At least one decision model: `tev1`, `nimble`, `clef-flash`, …

## Quick start

```bash
ollama pull tev1:4b        # default model (alternatives: nimble, tev1:0.8b, clef-flash)
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/v1` and `/api` to `localhost:11434`, so there is no backend to run. Set `OLLAMA_HOST` to point at another Ollama server.

Controls: `Space` pause · `N` single step · `R` reset · switch **Mode** to *Keyboard* to play with the arrow keys. The model picker also contains `heuristic (no model)`, a rule-based baseline for comparison.

## How it works

- **Lock-step loop.** Pac-Man only asks the model at junctions, corners, dead ends, or when a ghost is closing in along a corridor. The simulation pauses until the answer arrives. One request is in flight at a time.
- **Facts go in the criteria, not the map.** Decision models are classifiers, not path planners. The `move` question is a `choice` whose options are *only the legal directions*. Each option's description carries facts precomputed with BFS: distance to the nearest pellet, pellets nearby, distance to the nearest ghost, power pellets, and edible ghosts. `state` holds a short situation summary and an 11×11 ASCII view.
- **Display-only signal.** A `noul` question (`danger`) is shown in the panel but does not drive behavior.
- **Failure handling.** On timeout (20 s), error, or an invalid choice, the game falls back to the heuristic and marks the row red in the history.

Example request (trimmed):

```json
{
  "model": "tev1:4b",
  "state": {
    "situation": "Pac-Man is at column 6, row 5, heading right. Score 530, 3 lives, 195 pellets left.",
    "map": "Legend: # wall, . pellet, o power pellet, P Pac-Man, G ghost, b edible ghost.\n..."
  },
  "questions": {
    "move": {
      "type": "choice",
      "instructions": "Which direction should Pac-Man move? Never move toward a nearby dangerous ghost. ...",
      "criteria": {
        "up": "nearest pellet 5 tiles away, 4 pellets within 8 tiles, no dangerous ghost this way",
        "right": "nearest pellet 1 tile away, 15 pellets within 8 tiles, caution: ghost Blinky 6 tiles away"
      }
    },
    "danger": { "type": "noul", "instructions": "Is a dangerous ghost within 3 tiles of Pac-Man?" }
  }
}
```

| File | Role |
|---|---|
| `src/maze.ts` | 28×31 tile map and movement helpers |
| `src/game.ts` | Game state, tick, collisions, when to ask (`needsDecision`) |
| `src/ghosts.ts` | Ghost AI (targeting + randomness, "smartness" slider) |
| `src/features.ts` | Per-direction features, request builder, heuristic |
| `src/decision.ts` | `/v1/systemone` client |
| `src/render.ts`, `src/panel.ts`, `src/main.ts` | Canvas, live panel, main loop |

## Benchmarks

Headless runs with 80 decisions per model through the real endpoint, on the machine above (2026-10-10). The first, model-loading request is excluded from latency.

| Model | p50 | p95 | Agrees with heuristic | Score (1 game) | Memory (`ollama ps`) |
|---|---|---|---|---|---|
| tev1:0.8b | 176 ms | 216 ms | 20% | 450 | 6.8 GB |
| **tev1:4b** (default) | 1013 ms | 1324 ms | 81% | 3220 | 12 GB |
| nimble (9B) | 2293 ms | 3500 ms | 73% | 2210 | 17 GB (system free memory dropped to 11%) |

Ghosts are partly random, so scores come from a single game each and are only indicative. `tev1:0.8b` is fast but barely eats any pellets in 80 decisions; it is effectively not making useful choices.

## The limits of a 16 GB M4 Mac mini

This project works on a base M4 Mac mini, but it is clearly at the edge of what this machine can do:

- **About 1 second per decision** with the best practical model (`tev1:4b`). Real-time play, where the model decides on every 140 ms game tick, is not possible. The lock-step design exists only to hide that.
- **9B models do not fit comfortably.** `nimble` runs, but at about 2.3 s per decision. `ollama ps` reported 17 GB, more than the machine's physical memory, and free system memory fell to 11% during the run.
- **`clef-flash` (11–12 GB) was not tested.** With macOS, a browser and the dev server also running, it leaves no realistic headroom on 16 GB.
- **Small models are fast but not smart enough.** `tev1:0.8b` hits real-time latency (~176 ms) but its choices are close to useless here.
- **Memory hygiene matters.** Ollama keeps a model loaded for 5 minutes after the last request. Run `ollama ps` and `ollama stop <model>` so that two models are never resident at once.

For reference, Ollama's announcement reports **~91 ms per decision for `nimble` on an M5 Max MacBook Pro**: roughly 25× faster than the same model on this machine, and fast enough to play in real time.

## Looking ahead

The gap between "works with a pause" and "plays in real time" is mostly hardware and model size, and both are moving quickly.

High-end Apple silicon already reaches sub-100 ms decisions for a 9B decision model today. As future generations (M6 and beyond) and other local AI hardware bring more memory bandwidth and larger unified memory to everyday desktops and laptops, and as decision models become smaller and better distilled, we expect this kind of loop to run comfortably on-device, even on entry-level machines: a model reading structured state and making a typed decision in tens of milliseconds, privately and at no per-call cost.

Pac-Man is a toy, but the pattern is the same one behind real-time game agents, UI automation, routing and moderation. This repo is meant as a small, honest data point for where that pattern stands on today's entry-level hardware.

## Troubleshooting

- **"no decision model installed"**: run `ollama pull tev1:4b`. Only models whose names contain `tev1`, `nimble` or `clef` are listed.
- **The first decision takes several seconds**: that is the model loading into memory. Later decisions are faster.
- **Memory stays full after closing the game**: the model is still loaded. Run `ollama stop <model>`, or wait 5 minutes.

## Credits

- Inspired by [Ollama now supports Jev-style decision models](https://ollama.com/blog/ollama-now-supports-jev-style-decision-models).
- This is an unofficial fan project and is not affiliated with or endorsed by Bandai Namco, owner of the PAC-MAN trademark. The maze and graphics were written from scratch for this repository.

## License

[MIT](LICENSE)
