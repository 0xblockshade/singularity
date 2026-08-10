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
  { key: "research", label: "Research", sub: "papers · news", angle: -Math.PI / 2, token: "signal" },
  { key: "insight", label: "Insight", sub: "what it now sees", angle: Math.PI / 6, token: "signal" },
  { key: "selfmod", label: "Self-modification", sub: "rewrite a faculty", angle: (5 * Math.PI) / 6, token: "ember" },
];

const PARTICLES = 7;

/**
 * The recursive self-improvement loop, hand-rolled on canvas (no library, same
 * approach as the belief graph). Three stages sit on a circle; comets of light
 * travel the ring clockwise — teal while research becomes insight, warm ember as
 * insight rewrites a faculty — and the closing arc feeds back into research so
 * the whole thing visibly loops. Honours prefers-reduced-motion by rendering a
 * single still frame.
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

    function stageP(angle: number) {
      let p = (angle + Math.PI / 2) / (Math.PI * 2);
      p = ((p % 1) + 1) % 1;
      return p;
    }

    function pointAt(cx: number, cy: number, R: number, p: number) {
      const a = p * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
    }

    function drawArcBand(
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      R: number,
      p0: number,
      p1: number,
      color: string,
      alpha: number,
      lineWidth: number,
    ) {
      const a0 = p0 * Math.PI * 2 - Math.PI / 2;
      const a1 = p1 * Math.PI * 2 - Math.PI / 2;
      c.beginPath();
      c.arc(cx, cy, R, a0, a1, false);
      c.strokeStyle = color;
      c.globalAlpha = alpha;
      c.lineWidth = lineWidth;
      c.lineCap = "round";
      c.stroke();
      c.globalAlpha = 1;
      c.lineCap = "butt";
    }

    function draw() {
      const c = ctx!;
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.3;
      const font = readVar("--font-sans", "sans-serif");

      const signal = readColor("--signal", "125 170 245");
      const ember = readColor("--ember", "161 161 170");
      const ink = readColor("--ink", "250 250 250");
      const muted = readColor("--muted", "161 161 170");
      const faint = readColor("--faint", "82 82 91");
      const surface = readColor("--surface", "10 10 10");
      const bg = readColor("--bg", "0 0 0");

      c.clearRect(0, 0, width, height);

      // soft center field
      const wash = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.35);
      wash.addColorStop(0, readColor("--ink", "250 250 250", 0.04));
      wash.addColorStop(0.55, readColor("--signal", "125 170 245", 0.03));
      wash.addColorStop(1, "transparent");
      c.fillStyle = wash;
      c.fillRect(0, 0, width, height);

      // base track
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.strokeStyle = faint;
      c.globalAlpha = 0.28;
      c.lineWidth = 1;
      c.stroke();
      c.globalAlpha = 1;

      // colored segment bands
      drawArcBand(c, cx, cy, R, 0, 1 / 3, signal, 0.55, 2.25);
      drawArcBand(c, cx, cy, R, 1 / 3, 2 / 3, signal, 0.28, 2);
      drawArcBand(c, cx, cy, R, 1 / 3, 2 / 3, ember, 0.35, 2);
      drawArcBand(c, cx, cy, R, 2 / 3, 1, ember, 0.6, 2.5);

      // travelling comets
      const speed = reduce ? 0 : 0.0014;
      for (let i = 0; i < PARTICLES; i++) {
        const base = i / PARTICLES;
        const p = ((base + t * speed) % 1 + 1) % 1;
        const tail = 10;
        for (let k = tail; k >= 0; k--) {
          const pp = ((p - k * 0.0055) % 1 + 1) % 1;
          const { x, y } = pointAt(cx, cy, R, pp);
          const tok = arcToken(pp);
          const col = tok === "ember" ? ember : signal;
          const headAlpha = k === 0 ? 0.95 : (1 - k / tail) * 0.35;
          const rad = k === 0 ? 2.8 : 1.6 * (1 - k / tail) + 0.35;
          c.beginPath();
          c.arc(x, y, rad, 0, Math.PI * 2);
          c.fillStyle = col;
          c.globalAlpha = headAlpha;
          c.fill();
          if (k === 0) {
            c.beginPath();
            c.arc(x, y, 7, 0, Math.PI * 2);
            c.globalAlpha = 0.1;
            c.fill();
          }
        }
      }
      c.globalAlpha = 1;

      // core readout
      const corePulse = reduce ? 1 : 1 + Math.sin(t * 0.028) * 0.05;
      c.beginPath();
      c.arc(cx, cy, R * 0.38 * corePulse, 0, Math.PI * 2);
      c.fillStyle = bg;
      c.globalAlpha = 0.55;
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(cx, cy, R * 0.38 * corePulse, 0, Math.PI * 2);
      c.strokeStyle = readColor("--line", "34 42 50", 0.8);
      c.lineWidth = 1;
      c.stroke();

      c.textAlign = "center";
      c.fillStyle = ink;
      c.font = `600 ${Math.max(22, R * 0.2)}px ${font}`;
      c.fillText(String(cycles), cx, cy - R * 0.02);
      c.fillStyle = muted;
      c.font = `500 10px ${font}`;
      c.fillText("cycles", cx, cy + R * 0.13);
      c.fillStyle = faint;
      c.font = `500 9px ${font}`;
      c.fillText(`${faculties} faculties`, cx, cy + R * 0.24);

      // stage nodes
      for (const s of STAGES) {
        const p = stageP(s.angle);
        const { x, y } = pointAt(cx, cy, R, p);
        const col = s.token === "ember" ? ember : signal;
        const nodePulse = reduce ? 0 : Math.max(0, Math.sin(t * 0.03 + p * Math.PI * 2)) * 3;

        c.beginPath();
        c.arc(x, y, 18 + nodePulse, 0, Math.PI * 2);
        c.fillStyle =
          s.token === "ember"
            ? readColor("--ember", "161 161 170", 0.1)
            : readColor("--signal", "125 170 245", 0.08);
        c.fill();

        c.beginPath();
        c.arc(x, y, 11, 0, Math.PI * 2);
        c.fillStyle = surface;
        c.fill();
        c.lineWidth = 1.75;
        c.strokeStyle = col;
        c.stroke();
        c.beginPath();
        c.arc(x, y, 3.5, 0, Math.PI * 2);
        c.fillStyle = col;
        c.fill();

        const outward = 1.38;
        const lx = cx + (x - cx) * outward;
        const ly = cy + (y - cy) * outward;
        const align: CanvasTextAlign = Math.abs(x - cx) < 4 ? "center" : x > cx ? "left" : "right";
        c.textAlign = align;
        c.textBaseline = "middle";
        c.fillStyle = ink;
        c.font = `600 12px ${font}`;
        c.fillText(s.label, lx, ly - 8);
        c.fillStyle = muted;
        c.font = `400 10px ${font}`;
        c.fillText(s.sub, lx, ly + 8);
      }
      c.textBaseline = "alphabetic";

      // "feeds back" annotation on the recursive arc
      const fbP = (((stageP(STAGES[2].angle) + stageP(STAGES[0].angle) + 1) / 2) % 1);
      const fb = pointAt(cx, cy, R, fbP);
      c.save();
      c.translate(cx + (fb.x - cx) * 0.68, cy + (fb.y - cy) * 0.68);
      c.textAlign = "center";
      c.fillStyle = ember;
      c.globalAlpha = reduce ? 0.65 : 0.5 + Math.sin(t * 0.045) * 0.25;
      c.font = `500 9px ${font}`;
      c.fillText("↻ feeds back", 0, 0);
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
      className="panel-shell relative h-[360px] w-full overflow-hidden sm:h-[460px]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
