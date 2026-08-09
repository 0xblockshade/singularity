// Single data-access boundary. Every screen imports from here and nowhere else.
//
// Behaviour: hit the real API first. If the API is unreachable, errors, or
// responds "empty" (launch day, no runs yet), transparently fall back to the
// bundled sample fixtures and mark `sample: true` so the UI can say so.
//
// Set VITE_USE_SAMPLE=true to force fixtures even when the backend is up.

import {
  sampleBeliefs,
  sampleDispatchDetail,
  sampleDispatches,
  sampleImprovements,
  sampleMemory,
  sampleSelfModel,
  sampleSandboxStatus,
  sampleStatus,
} from "./fixtures";
import type {
  Belief,
  Dispatch,
  DispatchDetail,
  Improvement,
  MemoryVersion,
  SelfModel,
  SandboxStatus,
  Sourced,
  Status,
  TransmissionReceipt,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const FORCE_SAMPLE = import.meta.env.VITE_USE_SAMPLE === "true";

/** Returns null on any network/HTTP failure so callers can choose a fallback. */
async function tryGet<T>(path: string): Promise<T | null> {
  if (FORCE_SAMPLE) return null;
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function live<T>(data: T): Sourced<T> {
  return { data, sample: false };
}
function fixture<T>(data: T): Sourced<T> {
  return { data, sample: true };
}

export async function getStatus(): Promise<Sourced<Status>> {
  const res = await tryGet<Status>("/status");
  // "empty" = no name chosen and no run has happened yet.
  if (!res || (res.narrator_name === null && res.latest_run === null)) {
    return fixture(sampleStatus);
  }
  return live(res);
}

export async function getDispatches(limit = 50): Promise<Sourced<Dispatch[]>> {
  const res = await tryGet<Dispatch[]>(`/dispatches?limit=${limit}`);
  if (!res || res.length === 0) return fixture(sampleDispatches);
  return live(res);
}

export async function getDispatch(id: number): Promise<Sourced<DispatchDetail | null>> {
  const res = await tryGet<DispatchDetail>(`/dispatches/${id}`);
  if (!res) return fixture(sampleDispatchDetail(id));
  return live(res);
}

export async function getMemory(): Promise<Sourced<MemoryVersion[]>> {
  const res = await tryGet<MemoryVersion[]>("/memory");
  if (!res || res.length === 0) return fixture(sampleMemory);
  return live(res);
}

export async function getBeliefs(): Promise<Sourced<Belief[]>> {
  const res = await tryGet<Belief[]>("/beliefs");
  if (!res || res.length === 0) return fixture(sampleBeliefs);
  return live(res);
}

export async function getImprovements(limit = 100): Promise<Sourced<Improvement[]>> {
  const res = await tryGet<Improvement[]>(`/improvements?limit=${limit}`);
  if (!res || res.length === 0) return fixture(sampleImprovements);
  return live(res);
}

export async function getSelfModel(): Promise<Sourced<SelfModel>> {
  const res = await tryGet<SelfModel>("/self-model");
  if (!res || res.faculties.length === 0) return fixture(sampleSelfModel);
  return live(res);
}

export async function getSandboxStatus(): Promise<Sourced<SandboxStatus>> {
  const res = await tryGet<SandboxStatus>("/sandbox/status");
  if (!res || res.cycles === 0) return fixture(sampleSandboxStatus);
  return live(res);
}

/**
 * Send a transmission to the agent, unfiltered. The submitter is never told
 * whether it was flagged — success just means "received". Network/HTTP errors
 * throw so the form can show a real error state; a flagged-but-accepted
 * transmission is indistinguishable from any other success, by design.
 */
export async function postTransmission(body: string): Promise<TransmissionReceipt> {
  const res = await fetch(`${API_BASE}/api/transmissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`Transmission failed (${res.status})`);
  }
  return (await res.json()) as TransmissionReceipt;
}
