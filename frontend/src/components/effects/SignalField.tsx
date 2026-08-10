import { useEffect, useRef } from "react";

/**
 * Top-left landing hero — soft color bends + threads.
 * Always paints a CSS fallback; WebGL layers on top when available.
 */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uIntensity;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);

  // work in a space centered near the top-left of this canvas
  vec2 p = vec2(uv.x * aspect, 1.0 - uv.y) * 1.6;

  float t = uTime * 0.25;

  vec2 q = p;
  q /= 0.55 + 0.2 * dot(q, q);
  q += 0.2 * cos(t);

  vec3 sum = vec3(0.0);
  float cover = 0.0;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 s = q - fi * 0.015;
    vec2 r = sin(1.5 * (s.yx) + 2.0 * cos(s));
    vec2 warped = mix(s, r, 0.75);
    float m = length(warped + sin(5.0 * warped.y - 3.0 * t + fi) * 0.25);
    float w = 1.0 - exp(-6.0 / exp(5.0 * m));
    vec3 c = i == 0 ? uC0 : (i == 1 ? uC1 : uC2);
    sum += c * w;
    cover = max(cover, w);
  }

  float wave = 0.5 + 0.5 * sin(p.x * 2.0 + t * 1.5 + sin(p.y * 2.4 - t) * 0.8);
  float ribbon = smoothstep(0.32, 0.68, wave) * smoothstep(0.95, 0.52, wave);

  float threads = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float phase = t * (0.4 + fk * 0.08) + fk * 1.4;
    float y = sin(p.x * (1.4 + fk * 0.35) + phase) * (0.2 + fk * 0.04)
      + 0.15 + fk * 0.12;
    float d = abs(p.y - y);
    // wider soft falloff = less aliasing on filaments
    threads += smoothstep(0.045, 0.0, d) * (0.28 - fk * 0.04);
  }

  // canvas-local top-left falloff (uv.y=1 is top in our vert shader)
  float corner = 1.0 - smoothstep(0.08, 1.25, length(vec2(uv.x * 0.95, 1.0 - uv.y)));
  float mask = pow(max(corner, 0.0), 1.05);

  vec3 col = clamp(sum, 0.0, 1.0);
  col += uC0 * ribbon * 0.4;
  col += mix(uC0, uC1, 0.4) * threads * 0.55;
  col *= uIntensity;

  float n = hash(gl_FragCoord.xy + uTime);
  col += (n - 0.5) * 0.015;

  float alpha = clamp(cover * 0.7 + ribbon * 0.3 + threads * 0.42, 0.0, 1.0);
  alpha *= mask;

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function readChannels(name: string, fallback: string): [number, number, number] {
  if (typeof getComputedStyle === "undefined") {
    return fallback.split(/\s+/).map(Number) as [number, number, number];
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = (raw || fallback).split(/\s+/).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function toUnit(rgb: [number, number, number]): [number, number, number] {
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[SignalField]", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function SignalField({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;inset:0;display:block;width:100%;height:100%;";
    wrap.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "default",
    });

    if (!gl) return () => wrap.removeChild(canvas);
    wrap.classList.add("signal-field--live");

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return () => wrap.removeChild(canvas);

    const program = gl.createProgram();
    if (!program) return () => wrap.removeChild(canvas);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[SignalField]", gl.getProgramInfoLog(program));
      return () => wrap.removeChild(canvas);
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uC0 = gl.getUniformLocation(program, "uC0");
    const uC1 = gl.getUniformLocation(program, "uC1");
    const uC2 = gl.getUniformLocation(program, "uC2");
    const uIntensity = gl.getUniformLocation(program, "uIntensity");

    let raf = 0;
    let running = true;
    let start = performance.now();
    let colorsDirty = true;

    function syncColors() {
      if (!colorsDirty) return;
      colorsDirty = false;
      const signal = toUnit(readChannels("--signal", "125 170 245"));
      const ink = toUnit(readChannels("--ink", "250 250 250"));
      const muted = toUnit(readChannels("--muted", "161 161 170"));
      const light = document.documentElement.classList.contains("light");
      gl!.uniform3fv(uC0, signal);
      gl!.uniform3fv(uC1, [
        Math.min(1, signal[0] * 0.55 + ink[0] * 0.35),
        Math.min(1, signal[1] * 0.55 + ink[1] * 0.35),
        Math.min(1, signal[2] * 0.6 + ink[2] * 0.35),
      ]);
      gl!.uniform3fv(uC2, [
        muted[0] * 0.35 + signal[0] * 0.55,
        muted[1] * 0.35 + signal[1] * 0.55,
        muted[2] * 0.3 + signal[2] * 0.6,
      ]);
      gl!.uniform1f(uIntensity, light ? 0.8 : 1.1);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap!.clientWidth || 1;
      const h = wrap!.clientHeight || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.uniform2f(uRes, canvas.width, canvas.height);
    }

    function draw(now: number) {
      if (!running) return;
      const t = reduce ? 0 : (now - start) / 1000;
      syncColors();
      gl!.uniform1f(uTime, t);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    const onVisibility = () => {
      running = document.visibilityState !== "hidden";
      if (running && !reduce) {
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const themeObserver = new MutationObserver(() => {
      colorsDirty = true;
      if (reduce) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    syncColors();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduce) draw(performance.now());
    else raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentElement === wrap) wrap.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`signal-field pointer-events-none fixed left-0 top-14 z-[1] h-[min(72vh,38rem)] w-[min(90vw,44rem)] max-sm:top-[6.5rem] ${className}`}
      aria-hidden="true"
    />
  );
}
