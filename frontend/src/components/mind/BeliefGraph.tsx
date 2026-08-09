import { useEffect, useRef, useState } from "react";
import type { Belief } from "@/lib/types";
import { confidencePct } from "@/lib/utils";

interface Node {
  belief: Belief;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

function readVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Color tokens are stored as "R G B" channels — wrap for canvas. */
function readColor(name: string, channels: string): string {
  return `rgb(${readVar(name, channels)})`;
}

/**
 * Hand-rolled canvas constellation. No graph library. Each belief orbits a
 * central "mind" hub; a light spring+repulsion sim settles them, with
 * high-confidence beliefs pulled closer to the core. Recently-changed beliefs
 * pulse in ember. Hover for a readout, click to select.
 */
export function BeliefGraph({
  beliefs,
  latestRun,
  selectedId,
  onSelect,
  narratorName,
}: {
  beliefs: Belief[];
  latestRun: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  narratorName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const hoverRef = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(selectedId);
  const [hoverId, setHoverId] = useState<number | null>(null);
  selectedRef.current = selectedId;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // (re)build nodes, preserving positions where a belief already existed
    function build() {
      const prev = new Map(nodesRef.current.map((n) => [n.belief.id, n]));
      const cx = width / 2;
      const cy = height / 2;
      nodesRef.current = beliefs.map((b, i) => {
        const existing = prev.get(b.id);
        const angle = (i / Math.max(beliefs.length, 1)) * Math.PI * 2;
        const seed = 90 + (1 - b.confidence) * 120;
        return (
          existing ?? {
            belief: b,
            x: cx + Math.cos(angle) * seed,
            y: cy + Math.sin(angle) * seed,
            vx: 0,
            vy: 0,
            r: 7 + b.confidence * 20,
          }
        );
      });
      // refresh belief refs + radii in case data changed
      for (const n of nodesRef.current) {
        const b = beliefs.find((x) => x.id === n.belief.id);
        if (b) {
          n.belief = b;
          n.r = 7 + b.confidence * 20;
        }
      }
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodesRef.current.length === 0) build();
    }

    resize();
    build();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let t = 0;

    function step() {
      t += 1;
      const cx = width / 2;
      const cy = height / 2;
      const nodes = nodesRef.current;

      // physics
      for (const n of nodes) {
        // spring to hub; rest length shrinks with confidence
        const inner = Math.min(width, height) * 0.14;
        const ring = Math.min(width, height) * 0.3;
        const rest = inner + (1 - n.belief.confidence) * ring;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const pull = (dist - rest) * 0.012;
        n.vx -= (dx / dist) * pull;
        n.vy -= (dy / dist) * pull;

        // repulsion from siblings
        for (const m of nodes) {
          if (m === n) continue;
          const ax = n.x - m.x;
          const ay = n.y - m.y;
          const d2 = ax * ax + ay * ay || 0.001;
          const minD = n.r + m.r + 26;
          if (d2 < minD * minD) {
            const d = Math.sqrt(d2);
            const f = ((minD - d) / d) * 0.6;
            n.vx += (ax / d) * f;
            n.vy += (ay / d) * f;
          }
        }
      }
      for (const n of nodes) {
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.r + 4, Math.min(width - n.r - 4, n.x));
        n.y = Math.max(n.r + 4, Math.min(height - n.r - 4, n.y));
      }

      draw(cx, cy);
      raf = requestAnimationFrame(step);
    }

    function draw(cx: number, cy: number) {
      const c = ctx!;
      const nodes = nodesRef.current;
      const signal = readColor("--signal", "70 200 173");
      const ember = readColor("--ember", "214 154 92");
      const line = readColor("--line", "26 33 39");
      const ink = readColor("--ink", "217 224 230");
      const muted = readColor("--muted", "121 133 143");
      const surface = readColor("--surface", "10 14 17");
      c.clearRect(0, 0, width, height);

      // edges hub -> belief
      for (const n of nodes) {
        const changed = n.belief.last_changed_run === latestRun;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(n.x, n.y);
        c.strokeStyle = changed ? ember : line;
        c.globalAlpha = changed ? 0.5 : 0.25 + n.belief.confidence * 0.4;
        c.lineWidth = changed ? 1.4 : 0.8;
        c.stroke();
      }
      c.globalAlpha = 1;

      // hub
      const pulse = 1 + Math.sin(t * 0.04) * 0.12;
      c.beginPath();
      c.arc(cx, cy, 26 * pulse, 0, Math.PI * 2);
      c.fillStyle = signal;
      c.globalAlpha = 0.08;
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(cx, cy, 6, 0, Math.PI * 2);
      c.fillStyle = signal;
      c.fill();
      c.font = `600 11px ${readVar("--font-mono", "monospace")}`;
      c.fillStyle = muted;
      c.textAlign = "center";
      c.fillText(narratorName.toUpperCase(), cx, cy + 40);

      // nodes
      for (const n of nodes) {
        const changed = n.belief.last_changed_run === latestRun;
        const unresolved = n.belief.confidence < 0.5;
        const hovered = hoverRef.current === n.belief.id;
        const selected = selectedRef.current === n.belief.id;
        const base = changed ? ember : unresolved ? muted : signal;

        if (changed) {
          const ring = n.r + 6 + Math.sin(t * 0.08) * 3;
          c.beginPath();
          c.arc(n.x, n.y, ring, 0, Math.PI * 2);
          c.strokeStyle = ember;
          c.globalAlpha = 0.4;
          c.lineWidth = 1;
          c.stroke();
          c.globalAlpha = 1;
        }

        c.beginPath();
        c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        c.fillStyle = surface;
        c.fill();
        c.globalAlpha = unresolved ? 0.5 : 0.85;
        c.fillStyle = base;
        c.fill();
        c.globalAlpha = 1;

        c.lineWidth = selected ? 2.5 : hovered ? 1.8 : 1;
        c.strokeStyle = selected || hovered ? ink : base;
        c.stroke();

        if (n.r > 12 || hovered || selected) {
          c.font = `500 11px ${readVar("--font-sans", "sans-serif")}`;
          c.fillStyle = hovered || selected ? ink : muted;
          c.textAlign = "center";
          const label =
            n.belief.concept.length > 22
              ? n.belief.concept.slice(0, 21) + "…"
              : n.belief.concept;
          c.fillText(label, n.x, n.y + n.r + 14);
        }
      }
    }

    function pick(px: number, py: number): number | null {
      for (const n of nodesRef.current) {
        if (Math.hypot(px - n.x, py - n.y) <= n.r + 4) return n.belief.id;
      }
      return null;
    }

    function toLocal(e: PointerEvent): [number, number] {
      const rect = canvas!.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    function onMove(e: PointerEvent) {
      const [px, py] = toLocal(e);
      const id = pick(px, py);
      hoverRef.current = id;
      setHoverId(id);
      canvas!.style.cursor = id !== null ? "pointer" : "default";
    }
    function onClick(e: PointerEvent) {
      const [px, py] = toLocal(e);
      const id = pick(px, py);
      onSelect(id === selectedRef.current ? null : id);
    }
    function onLeave() {
      hoverRef.current = null;
      setHoverId(null);
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onClick);
    canvas.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onClick);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [beliefs, latestRun, narratorName, onSelect]);

  const hovered = beliefs.find((b) => b.id === hoverId);

  return (
    <div
      ref={wrapRef}
      className="relative h-[420px] w-full overflow-hidden rounded-xl border border-line bg-surface/40 sm:h-[520px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {hovered ? (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[16rem] rounded-lg border border-line bg-panel/95 p-3 backdrop-blur">
          <p className="font-mono text-xs font-semibold text-ink">{hovered.concept}</p>
          <p className="mt-1 text-xs leading-snug text-muted">{hovered.stance}</p>
          <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-signal">
            confidence {confidencePct(hovered.confidence)}
          </p>
        </div>
      ) : null}
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <ul className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-1.5 text-right">
      <LegendRow color="rgb(var(--signal))" label="held belief" />
      <LegendRow color="rgb(var(--muted))" label="unresolved (< 50%)" />
      <LegendRow color="rgb(var(--ember))" label="changed this run" />
    </ul>
  );
}
function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center justify-end gap-2">
      <span className="font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </li>
  );
}
