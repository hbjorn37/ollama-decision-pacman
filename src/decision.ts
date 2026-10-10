import type { DecisionRequest } from './features';

export interface ChoiceAnswer {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number | null;
}

export interface DecisionResult {
  move: ChoiceAnswer | null;
  danger: number | null;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  cached: number | null;
  raw: unknown;
  ms: number;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? null : n;
};

function parseChoice(a: any): ChoiceAnswer | null {
  if (!a || typeof a.choice !== 'string') return null;
  const probabilities: Record<string, number> = {};
  for (const [k, v] of Object.entries(a.probabilities ?? {})) probabilities[k] = num(v) ?? 0;
  return { choice: a.choice, probabilities, confidence: num(a.confidence) };
}

export async function decide(req: DecisionRequest, timeoutMs: number): Promise<DecisionResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch('/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) throw new Error((raw as any)?.error ?? `HTTP ${res.status}`);
    const answers = (raw as any)?.answers ?? {};
    return {
      move: parseChoice(answers.move),
      danger: num(answers.danger?.noul),
      usage: (raw as any)?.usage ?? null,
      cached: num((raw as any)?.prompt_eval_cached_count),
      raw,
      ms: performance.now() - t0,
    };
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`timed out after ${timeoutMs} ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Installed models from Ollama, used to populate the model picker. */
export async function installedModels(): Promise<string[]> {
  try {
    const res = await fetch('/api/tags');
    const data = await res.json();
    return (data.models ?? []).map((m: any) => m.name as string);
  } catch {
    return [];
  }
}
