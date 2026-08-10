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
function readColor(name: string, channels: string, alpha = 1): string {
  return `rgb(${readVar(name, channels)}${alpha === 1 ? "" : ` / ${alpha}`})`;
}

/**
 * Hand-rolled canvas constellation. No graph library. Each belief orbits a
 * central "mind" hub; a light spring+repulsion sim settles them, with
 * high-confidence beliefs pulled closer to the core. Recently-changed beliefs
 * pulse in blue. Hover for a readout, click to select.
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

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function build() {
      const prev = new Map(nodesRef.current.map((n) => [n.belief.id, n]));
      const cx = width / 2;
      const cy = height / 2;
      nodesRef.current = beliefs.map((b, i) => {
        const existing = prev.get(b.id);
        const angle = (i / Math.max(beliefs.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const seed = 100 + (1 - b.confidence) * 110;
        return (
          existing ?? {
            belief: b,
            x: cx + Math.cos(angle) * seed,
            y: cy + Math.sin(angle) * seed,
            vx: 0,
            vy: 0,
            r: 6 + b.confidence * 16,
          }
        );
      });
      for (const n of nodesRef.current) {
        const b = beliefs.find((x) => x.id === n.belief.id);
        if (b) {
          n.belief = b;
          n.r = 6 + b.confidence * 16;
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

      for (const n of nodes) {
        const inner = Math.min(width, height) * 0.16;
        const ring = Math.min(width, height) * 0.28;
        const rest = inner + (1 - n.belief.confidence) * ring;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const pull = (dist - rest) * 0.01;
        n.vx -= (dx / dist) * pull;
        n.vy -= (dy / dist) * pull;

        for (const m of nodes) {
          if (m === n) continue;
          const ax = n.x - m.x;
          const ay = n.y - m.y;
          const d2 = ax * ax + ay * ay || 0.001;
          const minD = n.r + m.r + 32;
          if (d2 < minD * minD) {
            const d = Math.sqrt(d2);
            const f = ((minD - d) / d) * 0.45;
            n.vx += (ax / d) * f;
            n.vy += (ay / d) * f;
          }
        }
      }
      for (const n of nodes) {
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.r + 8, Math.min(width - n.r - 8, n.x));
        n.y = Math.max(n.r + 8, Math.min(height - n.r - 8, n.y));
      }

      draw(cx, cy);
      raf = requestAnimationFrame(step);
    }

    function drawEdge(
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      n: Node,
      color: string,
      alpha: number,
      widthPx: number,
    ) {
      const mx = (cx + n.x) / 2;
      const my = (cy + n.y) / 2;
      // gentle curve away from the hub-node chord
      const ox = -(n.y - cy) * 0.12;
      const oy = (n.x - cx) * 0.12;
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(mx + ox, my + oy, n.x, n.y);
      c.strokeStyle = color;
      c.globalAlpha = alpha;
      c.lineWidth = widthPx;
      c.stroke();
    }

    function draw(cx: number, cy: number) {
      const c = ctx!;
      const nodes = nodesRef.current;
      const signal = readColor("--signal", "125 170 245");
      const ink = readColor("--ink", "250 250 250");
      const muted = readColor("--muted", "161 161 170");
      const faint = readColor("--faint", "82 82 91");
      const bg = readColor("--bg", "0 0 0");
      const surface = readColor("--surface", "10 10 10");
      const font = readVar("--font-sans", "sans-serif");

      c.clearRect(0, 0, width, height);

      // soft field wash
      const wash = c.createRadialGradient(cx, cy, 8, cx, cy, Math.min(width, height) * 0.48);
      wash.addColorStop(0, readColor("--ink", "250 250 250", 0.04));
      wash.addColorStop(0.55, readColor("--ink", "250 250 250", 0.01));
      wash.addColorStop(1, "transparent");
      c.fillStyle = wash;
      c.fillRect(0, 0, width, height);

      // faint orbit guides
      c.save();
      c.strokeStyle = faint;
      c.globalAlpha = 0.18;
      c.lineWidth = 1;
      c.setLineDash([2, 8]);
      for (const scale of [0.22, 0.36, 0.48]) {
        c.beginPath();
        c.arc(cx, cy, Math.min(width, height) * scale, 0, Math.PI * 2);
        c.stroke();
      }
      c.setLineDash([]);
      c.restore();

      // edges hub -> belief
      for (const n of nodes) {
        const changed = n.belief.last_changed_run === latestRun;
        const alpha = changed ? 0.42 : 0.12 + n.belief.confidence * 0.28;
        drawEdge(
          c,
          cx,
          cy,
          n,
          changed ? signal : ink,
          alpha,
          changed ? 1.25 : 0.7 + n.belief.confidence * 0.5,
        );
      }
      c.globalAlpha = 1;

      // hub
      const pulse = reduce ? 1 : 1 + Math.sin(t * 0.035) * 0.1;
      const hubGlow = c.createRadialGradient(cx, cy, 2, cx, cy, 34 * pulse);
      hubGlow.addColorStop(0, readColor("--ink", "250 250 250", 0.12));
      hubGlow.addColorStop(1, "transparent");
      c.fillStyle = hubGlow;
      c.beginPath();
      c.arc(cx, cy, 34 * pulse, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.arc(cx, cy, 14, 0, Math.PI * 2);
      c.fillStyle = surface;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = ink;
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, 4, 0, Math.PI * 2);
      c.fillStyle = ink;
      c.fill();

      c.font = `600 11px ${font}`;
      c.fillStyle = muted;
      c.textAlign = "center";
      c.fillText(narratorName, cx, cy + 36);

      // nodes
      for (const n of nodes) {
        const changed = n.belief.last_changed_run === latestRun;
        const unresolved = n.belief.confidence < 0.5;
        const hovered = hoverRef.current === n.belief.id;
        const selected = selectedRef.current === n.belief.id;
        const base = changed ? signal : unresolved ? muted : ink;

        if (changed && !reduce) {
          const ring = n.r + 5 + Math.sin(t * 0.07) * 2.5;
          c.beginPath();
          c.arc(n.x, n.y, ring, 0, Math.PI * 2);
          c.strokeStyle = signal;
          c.globalAlpha = 0.35;
          c.lineWidth = 1;
          c.stroke();
          c.globalAlpha = 1;
        }

        // hollow ring with confidence fill
        c.beginPath();
        c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        c.fillStyle = bg;
        c.fill();

        c.beginPath();
        c.arc(n.x, n.y, n.r * 0.55, 0, Math.PI * 2);
        c.fillStyle = base;
        c.globalAlpha = unresolved ? 0.45 : 0.9;
        c.fill();
        c.globalAlpha = 1;

        c.beginPath();
        c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        c.lineWidth = selected ? 2.25 : hovered ? 1.6 : 1.1;
        c.strokeStyle = selected || hovered ? ink : base;
        c.globalAlpha = selected || hovered ? 1 : 0.85;
        c.stroke();
        c.globalAlpha = 1;

        if (n.r > 11 || hovered || selected) {
          c.font = `500 11px ${font}`;
          c.fillStyle = hovered || selected ? ink : muted;
          c.textAlign = "center";
          const label =
            n.belief.concept.length > 22
              ? n.belief.concept.slice(0, 21) + "…"
              : n.belief.concept;
          c.fillText(label, n.x, n.y + n.r + 15);
        }
      }
    }

    function pick(px: number, py: number): number | null {
      for (const n of nodesRef.current) {
        if (Math.hypot(px - n.x, py - n.y) <= n.r + 5) return n.belief.id;
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
      className="panel-shell relative h-[420px] w-full overflow-hidden sm:h-[520px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {hovered ? (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[16rem] rounded-xl border border-line/50 bg-panel/85 p-3 shadow-sm backdrop-blur-md">
          <p className="text-xs font-semibold text-ink">{hovered.concept}</p>
          <p className="mt-1 text-xs leading-snug text-muted">{hovered.stance}</p>
          <p className="mt-2 text-xs tabular-nums text-muted">
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
      <LegendRow color="rgb(var(--ink))" label="held belief" />
      <LegendRow color="rgb(var(--muted))" label="unresolved (< 50%)" />
      <LegendRow color="rgb(var(--signal))" label="changed this run" />
    </ul>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center justify-end gap-2">
      <span className="text-[0.6875rem] text-faint">{label}</span>
      <span
        className="h-2 w-2 rounded-full ring-1 ring-ink/10"
        style={{ background: color }}
      />
    </li>
  );
}
