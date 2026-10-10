import type { DecisionRequest, DirFeatures } from './features';
import type { DecisionResult } from './decision';
import type { Dir, Pos } from './maze';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(1)}%`);
const ms = (v: number) => `${Math.round(v)} ms`;

export function showRequest(n: number, req: DecisionRequest, feats: DirFeatures[]): void {
  $('inMove').textContent = `Move ${n} · ${req.model}`;
  $('inSituation').textContent = req.state.situation;
  $('inMap').textContent = req.state.map.split('\n').slice(1).join('\n');
  const criteria = (req.questions.move as { criteria: Record<string, string> }).criteria;
  $('inCriteria').innerHTML = feats
    .map((f) => {
      const cls = f.ghostDist !== null && f.ghostDist <= 3 ? ' class="danger"' : '';
      return `<tr><td>${f.dir}</td><td${cls}>${esc(criteria[f.dir])}</td></tr>`;
    })
    .join('');
  $('inRaw').textContent = JSON.stringify(req, null, 2);
}

export function showThinking(): void {
  $('outMeta').textContent = 'thinking…';
}

export function showResult(res: DecisionResult | null, chosen: Dir, options: Dir[], error: string | null, source: string): void {
  const probs = res?.move?.probabilities ?? {};
  $('outBars').innerHTML = options
    .map((d) => {
      const p = probs[d] ?? (res?.move ? 0 : d === chosen ? 1 : 0);
      return `<div class="bar${d === chosen ? ' chosen' : ''}"><span class="label">${d}</span>` +
        `<div class="track"><div class="fill" style="width:${(p * 100).toFixed(1)}%"></div></div>` +
        `<span class="val">${pct(p)}</span></div>`;
    })
    .join('');
  $('outChoice').textContent = chosen;
  $('outConf').textContent = pct(res?.move?.confidence);
  $('outDanger').textContent = pct(res?.danger);
  const tokens = res?.usage ? ` · ${res.usage.input_tokens ?? '?'} in / ${res.usage.output_tokens ?? 0} out` : '';
  const cached = res?.cached ? ` · ${res.cached} cached` : '';
  $('outMeta').textContent = res ? `${ms(res.ms)}${tokens}${cached}` : source;
  const errEl = $('outError');
  errEl.hidden = !error;
  errEl.textContent = error ? `${error} → fallback: ${source}` : '';
  $('outRaw').textContent = res ? JSON.stringify(res.raw, null, 2) : '';
}

export function addHistory(n: number, pos: Pos, choice: Dir, p: number | null, latency: number | null, event: string, fallback: boolean): void {
  const row = document.createElement('tr');
  if (fallback) row.className = 'fallback';
  row.innerHTML = `<td>${n}</td><td>${pos.x},${pos.y}</td><td>${choice}</td><td>${pct(p)}</td>` +
    `<td>${latency === null ? '–' : Math.round(latency)}</td><td>${esc(event)}</td>`;
  const body = $('history');
  body.prepend(row);
  while (body.children.length > 200) body.lastElementChild!.remove();
}

export function clearHistory(): void {
  $('history').innerHTML = '';
}

export function updateStats(decisions: number, latencies: number[], fallbacks: number): void {
  $('sDecisions').textContent = String(decisions);
  $('sFallback').textContent = String(fallbacks);
  if (!latencies.length) {
    for (const id of ['sLast', 'sAvg', 'sPct']) $(id).textContent = '–';
    return;
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  $('sLast').textContent = ms(latencies[latencies.length - 1]);
  $('sAvg').textContent = ms(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  $('sPct').textContent = `${Math.round(q(0.5))}/${Math.round(q(0.95))}`;
}
