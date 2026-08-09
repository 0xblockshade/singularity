// Shapes mirror the backend API at /api. Kept in one place so the fixtures and
// the fetch layer can't drift from each other.

export interface LatestRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  note: string | null;
}

export interface Status {
  narrator_name: string | null;
  kill_switch: boolean;
  latest_run: LatestRun | null;
}

export interface Dispatch {
  id: number;
  run_id: number;
  title: string;
  body: string; // markdown
  published_at: string;
  model: string;
  narrator_name: string;
}

export type SourceKind = "transmission" | "signal";

export interface Source {
  id: number;
  dispatch_id: number;
  kind: SourceKind;
  ref_id: string;
}

export interface DispatchDetail extends Dispatch {
  sources: Source[];
}

export interface MemoryState {
  name: string;
  worldview: string;
}

export interface MemoryVersion {
  version: number;
  created_at: string;
  run_id: number;
  state_json: string;
  change_summary: string;
  state: MemoryState;
}

export interface Belief {
  id: number;
  concept: string;
  stance: string;
  confidence: number; // 0..1
  first_seen_run: number;
  last_changed_run: number;
  updated_at: string;
}

export interface TransmissionReceipt {
  id: number;
  received_at: string;
}

// --- Sandbox: recursive self-improvement -------------------------------------
// The agent studies AI research and rewrites its own analytical *faculties*
// (named methods/heuristics) — not its weights. Every change is sourced.

export interface Improvement {
  id: number;
  run_id: number;
  cycle: number;
  created_at: string;
  faculty: string;
  change: string; // short label, e.g. "sharpened"
  detail: string; // before → after feel
  rationale: string;
  cited_signals: number[]; // signal ids that prompted the change
}

export interface Faculty {
  name: string;
  current_method: string;
  times_revised: number;
  first_cycle: number;
  last_cycle: number;
}

export interface SelfModel {
  version: number;
  updated_at: string | null;
  reflection: string;
  faculties: Faculty[];
}

export interface SandboxStatus {
  cycles: number;
  faculty_count: number;
  latest_cycle_at: string | null;
}

// Every read returns whether the bundled sample data stood in for a real
// response, so the UI can flag it honestly.
export interface Sourced<T> {
  data: T;
  sample: boolean;
}
