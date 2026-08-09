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

// Every read returns whether the bundled sample data stood in for a real
// response, so the UI can flag it honestly.
export interface Sourced<T> {
  data: T;
  sample: boolean;
}
