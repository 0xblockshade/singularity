import { useEffect, useRef } from "react";

function readVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Color tokens are stored as "R G B" channels — wrap for canvas. */
function readColor(name: string, channels: string, alpha = 1): string {
  return `rgb(${readVar(name, channels)}${alpha === 1 ? "" : ` / ${alpha}`})`;
}

interface Stage {
  key: string;
  label: string;
  sub: string;
  /** angle on the ring, radians (0 = right, clockwise as canvas y grows down) */
  angle: number;
  /** tint token */
  token: "signal" | "ember";
}

// Three stages arranged on a circle. The flow runs clockwise; the final arc —
// self-modification back to research — is the recursive edge that closes the loop.
const STAGES: Stage[] = [
  { key: "research", label: "RESEARCH", sub: "papers · news", angle: -Math.PI / 2, token: "signal" },
  { key: "insight", label: "INSIGHT", sub: "what it now sees", angle: Math.PI / 6, token: "signal" },
  { key: "selfmod", label: "SELF-MODIFICATION", sub: "rewrite a faculty", angle: (5 * Math.PI) / 6, token: "ember" },
];

const PARTICLES = 9;

/**
 * The recursive self-improvement loop, hand-rolled on canvas (no library, same
 * approach as the belief graph). Three stages sit on a circle; comets of light
 * travel the ring clockwise — teal while research becomes insight, warm ember as
 * insight rewrites a faculty — and the closing arc feeds back into research so
 * the whole thing visibly loops. Concentric echo rings rotate inward to read as
 * recursion (the loop nesting into itself). Honours prefers-reduced-motion by
 * rendering a single still frame.
 */
export function LoopDiagram({ cycles, faculties }: { cycles: number; faculties: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let t = 0;

    /** which stage token colours the arc at ring-parameter p (0..1, clockwise from research) */
    function arcToken(p: number): "signal" | "ember" {
      // research(0) → insight(1/3): signal. insight → selfmod(2/3): signal→ember.
      // selfmod → research(1): ember (the recursive feed-back).
      return p > 2 / 3 || (p > 1 / 3 && p < 2 / 3) ? "ember" : "signal";
    }

    function draw() {
      const c = ctx!;
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.31;

      const signal = readColor("--signal", "70 200 173");
      const ember = readColor("--ember", "214 154 92");
      const line = readColor("--line", "26 33 39");
      const ink = readColor("--ink", "217 224 230");
      const muted = readColor("--muted", "121 133 143");
      const faint = readColor("--faint", "74 84 92");
      const surface = readColor("--surface", "10 14 17");

      c.clearRect(0, 0, width, height);

      // recursion echo rings — concentric, rotating inward, fading toward the core
      const echoes = 5;
      for (let i = 0; i < echoes; i++) {
        const f = i / echoes;
        const rr = R * (1 - f * 0.82);
        const rot = t * 0.004 * (i % 2 === 0 ? 1 : -1) + i;
        c.save();
        c.translate(cx, cy);
        c.rotate(rot);
        c.beginPath();
        c.setLineDash([2, 10]);
        c.arc(0, 0, rr, 0, Math.PI * 2);
        c.strokeStyle = i % 2 === 0 ? readColor("--signal", "70 200 173", 0.18 * (1 - f)) : faint;
        c.globalAlpha = i % 2 === 0 ? 1 : 0.12 * (1 - f);
        c.lineWidth = 1;
        c.stroke();
        c.restore();
      }
      c.setLineDash([]);
      c.globalAlpha = 1;

      // the cycle path
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.strokeStyle = line;
      c.lineWidth = 1.5;
      c.stroke();

      // stage arc-parameters (0..1 clockwise from research at top)
      const stageP = (angle: number) => {
        // top (-90°) is p=0; clockwise increases p
        let p = (angle + Math.PI / 2) / (Math.PI * 2);
        p = ((p % 1) + 1) % 1;
        return p;
      };
      const pointAt = (p: number) => {
        const a = p * Math.PI * 2 - Math.PI / 2;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
      };

      // travelling comets
      const speed = reduce ? 0 : 0.0016;
      for (let i = 0; i < PARTICLES; i++) {
        const base = i / PARTICLES;
        const p = ((base + t * speed) % 1 + 1) % 1;
        const tail = 9;
        for (let k = tail; k >= 0; k--) {
          const pp = ((p - k * 0.006) % 1 + 1) % 1;
          const { x, y } = pointAt(pp);
          const tok = arcToken(pp);
          const col = tok === "ember" ? ember : signal;
          const headAlpha = k === 0 ? 0.95 : (1 - k / tail) * 0.4;
          const rad = k === 0 ? 3.2 : 2 * (1 - k / tail) + 0.4;
          c.beginPath();
          c.arc(x, y, rad, 0, Math.PI * 2);
          c.fillStyle = col;
          c.globalAlpha = headAlpha;
          c.fill();
          if (k === 0) {
            c.beginPath();
            c.arc(x, y, 8, 0, Math.PI * 2);
            c.globalAlpha = 0.16;
            c.fill();
          }
        }
      }
      c.globalAlpha = 1;

      // core readout
      const corePulse = reduce ? 1 : 1 + Math.sin(t * 0.03) * 0.06;
      c.beginPath();
      c.arc(cx, cy, R * 0.34 * corePulse, 0, Math.PI * 2);
      c.fillStyle = readColor("--signal", "70 200 173", 0.05);
      c.fill();
      c.textAlign = "center";
      c.fillStyle = ink;
      c.font = `600 ${Math.max(22, R * 0.2)}px ${readVar("--font-mono", "monospace")}`;
      c.fillText(String(cycles), cx, cy - R * 0.02);
      c.fillStyle = muted;
      c.font = `500 10px ${readVar("--font-mono", "monospace")}`;
      c.fillText("CYCLES", cx, cy + R * 0.14);
      c.fillStyle = faint;
      c.font = `500 9px ${readVar("--font-mono", "monospace")}`;
      c.fillText(`${faculties} faculties`, cx, cy + R * 0.26);

      // stage nodes
      for (const s of STAGES) {
        const p = stageP(s.angle);
        const { x, y } = pointAt(p);
        const col = s.token === "ember" ? ember : signal;
        const nodePulse = reduce ? 0 : Math.max(0, Math.sin(t * 0.03 + p * Math.PI * 2)) * 4;

        // glow
        c.beginPath();
        c.arc(x, y, 15 + nodePulse, 0, Math.PI * 2);
        c.fillStyle = s.token === "ember" ? readColor("--ember", "214 154 92", 0.12) : readColor("--signal", "70 200 173", 0.12);
        c.fill();

        // disc
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fillStyle = surface;
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = col;
        c.stroke();
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fillStyle = col;
        c.fill();

        // labels, pushed outward from the ring
        const outward = 1.32;
        const lx = cx + (x - cx) * outward;
        const ly = cy + (y - cy) * outward;
        const align: CanvasTextAlign = Math.abs(x - cx) < 4 ? "center" : x > cx ? "left" : "right";
        c.textAlign = align;
        c.textBaseline = "middle";
        c.fillStyle = ink;
        c.font = `600 11px ${readVar("--font-mono", "monospace")}`;
        c.fillText(s.label, lx, ly - 7);
        c.fillStyle = muted;
        c.font = `400 10px ${readVar("--font-sans", "sans-serif")}`;
        c.fillText(s.sub, lx, ly + 7);
      }
      c.textBaseline = "alphabetic";

      // "feeds back" annotation on the recursive arc (selfmod → research, left side)
      const fbP = (stageP(STAGES[2].angle) + stageP(STAGES[0].angle) + 1) / 2 % 1;
      const fb = pointAt(fbP);
      c.save();
      c.translate(cx + (fb.x - cx) * 0.72, cy + (fb.y - cy) * 0.72);
      c.textAlign = "center";
      c.fillStyle = ember;
      c.globalAlpha = reduce ? 0.7 : 0.55 + Math.sin(t * 0.05) * 0.3;
      c.font = `500 9px ${readVar("--font-mono", "monospace")}`;
      c.fillText("↻ FEEDS BACK", 0, 0);
      c.restore();
      c.globalAlpha = 1;
    }

    if (reduce) {
      draw();
    } else {
      const loop = () => {
        t += 1;
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [cycles, faculties]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={`Recursive self-improvement loop: research becomes insight, insight rewrites a faculty, and the change feeds back into better research. ${cycles} cycles run so far across ${faculties} faculties.`}
      className="relative h-[360px] w-full overflow-hidden rounded-xl border border-line bg-surface/40 sm:h-[460px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
