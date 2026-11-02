import * as THREE from "three";

/** Involute-ish gear outline (trapezoid teeth) with a center bore. */
export function gearGeometry(teeth: number, radius: number, depth = 0.35, toothDepth = 0.22) {
  const shape = new THREE.Shape();
  const inner = radius - toothDepth;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [inner, a],
      [radius, a + step * 0.18],
      [radius, a + step * 0.48],
      [inner, a + step * 0.66],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, radius * 0.22, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  // spoke cut-outs
  const spokes = teeth > 14 ? 5 : 4;
  for (let i = 0; i < spokes; i++) {
    const a0 = (i / spokes) * Math.PI * 2 + 0.25;
    const a1 = a0 + (Math.PI * 2) / spokes - 0.5;
    const r0 = radius * 0.34;
    const r1 = inner * 0.78;
    if (r1 - r0 < 0.12) continue;
    const hole = new THREE.Path();
    hole.absarc(0, 0, r1, a0, a1, false);
    hole.absarc(0, 0, r0, a1, a0, true);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
  geo.center();
  return geo;
}

export const COLORS = {
  steel: "#7d8db3",
  steelDark: "#2a3654",
  graphite: "#151d33",
  ember: "#ff8a1f",
  plasma: "#22d3ee",
  ok: "#34d399",
  warn: "#fbbf24",
  alert: "#f43f5e",
  mute: "#63718f",
};

export const statusColor = (status: string) =>
  ({ operational: COLORS.ok, degraded: COLORS.warn, down: COLORS.alert, retired: COLORS.mute })[status] ?? COLORS.plasma;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Shared scroll velocity tracker (px/frame smoothed) for scroll-reactive scenes. */
export const scrollState = { y: 0, velocity: 0, progress: 0 };
if (typeof window !== "undefined") {
  let last = window.scrollY;
  const tick = () => {
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollState.velocity = scrollState.velocity * 0.85 + (y - last) * 0.15;
    scrollState.y = y;
    scrollState.progress = y / max;
    last = y;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
