const CX = 260;
const CY = 200;
const R = 108;

const STAGES = [
  {
    key: "research",
    lines: ["Research"],
    sub: "papers · news",
    angle: -Math.PI / 2,
    anchor: "middle" as const,
    labelDx: 0,
    labelDy: -26,
  },
  {
    key: "insight",
    lines: ["Insight"],
    sub: "what it sees",
    angle: Math.PI / 6,
    anchor: "start" as const,
    labelDx: 18,
    labelDy: 5,
  },
  {
    key: "selfmod",
    lines: ["Self-", "modification"],
    sub: "rewrite a faculty",
    angle: (5 * Math.PI) / 6,
    anchor: "end" as const,
    labelDx: -18,
    labelDy: -2,
  },
] as const;

/**
 * Minimal loop diagram: three nodes on a ring, hairline path, return mark.
 * Static SVG — no particles, glow, or pulse.
 */
export function LoopDiagram({ cycles, faculties }: { cycles: number; faculties: number }) {
  return (
    <div
      role="img"
      aria-label={`Recursive self-improvement loop: research becomes insight, insight rewrites a faculty, and the change feeds back into better research. ${cycles} cycles run so far across ${faculties} faculties.`}
      className="panel-shell"
    >
      <div className="relative mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
        <svg
          viewBox="0 0 520 400"
          className="mx-auto block h-auto w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
        >
          {/* main ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            stroke="rgb(var(--line))"
            strokeWidth="1.25"
          />

          {/* return path emphasis on the left */}
          <path
            d={describeArc(CX, CY, R, 130, 230)}
            stroke="rgb(var(--ink))"
            strokeWidth="1.25"
            strokeOpacity="0.35"
          />

          {/* direction marks */}
          {[
            -Math.PI / 2 + 0.85,
            Math.PI / 6 + 0.85,
            (5 * Math.PI) / 6 + 0.85,
          ].map((a) => (
            <path
              key={a}
              d={chevronOnRing(CX, CY, R, a)}
              stroke="rgb(var(--muted))"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* center stats */}
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            fill="rgb(var(--ink))"
            style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-sans)" }}
          >
            {cycles}
          </text>
          <text
            x={CX}
            y={CY + 16}
            textAnchor="middle"
            fill="rgb(var(--muted))"
            style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--font-sans)" }}
          >
            cycles
          </text>
          <text
            x={CX}
            y={CY + 32}
            textAnchor="middle"
            fill="rgb(var(--faint))"
            style={{ fontSize: 10, fontFamily: "var(--font-sans)" }}
          >
            {faculties} faculties
          </text>

          {/* nodes */}
          {STAGES.map((s) => {
            const x = CX + Math.cos(s.angle) * R;
            const y = CY + Math.sin(s.angle) * R;
            return (
              <g key={s.key}>
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="rgb(var(--bg))"
                  stroke="rgb(var(--ink))"
                  strokeWidth="1.5"
                />
                <circle cx={x} cy={y} r="2.25" fill="rgb(var(--ink))" />
                {s.lines.map((line, i) => (
                  <text
                    key={line}
                    x={x + s.labelDx}
                    y={y + s.labelDy + i * 15}
                    textAnchor={s.anchor}
                    fill="rgb(var(--ink))"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {line}
                  </text>
                ))}
                <text
                  x={x + s.labelDx}
                  y={y + s.labelDy + s.lines.length * 15}
                  textAnchor={s.anchor}
                  fill="rgb(var(--muted))"
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                >
                  {s.sub}
                </text>
              </g>
            );
          })}

          <text
            x={CX - R - 36}
            y={CY + 4}
            textAnchor="middle"
            fill="rgb(var(--faint))"
            style={{ fontSize: 10, fontFamily: "var(--font-sans)" }}
          >
            feeds back
          </text>
        </svg>
      </div>
    </div>
  );
}

function chevronOnRing(cx: number, cy: number, r: number, a: number): string {
  const x = cx + Math.cos(a) * r;
  const y = cy + Math.sin(a) * r;
  const tx = -Math.sin(a);
  const ty = Math.cos(a);
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const tipX = x + tx * 7;
  const tipY = y + ty * 7;
  const leftX = x - tx * 2 - nx * 5;
  const leftY = y - ty * 2 - ny * 5;
  const rightX = x - tx * 2 + nx * 5;
  const rightY = y - ty * 2 + ny * 5;
  return `M ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}
