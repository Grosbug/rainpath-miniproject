export type RunHistoryEntry = {
  nodeId: string;
  enteredAt: string;
  outcome?: string;
};

/**
 * Parse a JSON-encoded history column back into the typed list. We don't run a
 * Zod parse here because every history row is written by this server (never user
 * input) and re-validating per-read on the hot path showed up in patient-run
 * detail timings. If a row ever turns out to be corrupted we'd see it at the
 * call-site when the simulation algorithms reject the bad shape.
 */
export function parseRunHistory(raw: string): RunHistoryEntry[] {
  return JSON.parse(raw) as RunHistoryEntry[];
}

export function serializeRunHistory(history: RunHistoryEntry[]): string {
  return JSON.stringify(history);
}

/**
 * Initial single-entry history pointing at the start node — used by both
 * `create()` and `reset()` so they always agree on the empty-run shape.
 */
export function initialHistoryAtStart(startNodeId: string): RunHistoryEntry[] {
  return [{ nodeId: startNodeId, enteredAt: new Date().toISOString() }];
}
