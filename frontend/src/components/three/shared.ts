import * as THREE from "three";

/** Involute-ish gear outline (trapezoid teeth) with a center bore and spoke cut-outs. */
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

/** Earthy status colours for floor markings and labels. */
export const STATUS = {
  operational: "#5f7a3a",
  degraded: "#c98a1e",
  down: "#b23a2e",
  retired: "#8a7660",
} as const;

export const statusColor = (status: string) => STATUS[status as keyof typeof STATUS] ?? STATUS.retired;

const std = (color: string, metalness: number, roughness: number) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

/** Shared real-world materials (one instance each, reused by every model). */
export const MAT = {
  motorPaint: std("#7d7468", 0.35, 0.5), // warm stone-grey enamel
  motorPaintDark: std("#5e564c", 0.35, 0.55),
  pumpCasting: std("#7a3b28", 0.3, 0.6), // oxide-red cast iron
  castIron: std("#4f4943", 0.55, 0.6),
  baseSteel: std("#3d3833", 0.5, 0.55),
  ochrePaint: std("#b98a2e", 0.25, 0.55), // conveyor frame / guards
  tankPaint: std("#d8c7a6", 0.2, 0.45), // cream receiver tank
  steel: std("#bdb7ad", 0.9, 0.28), // machined shafts and flanges
  brushedSteel: std("#9d978d", 0.8, 0.4),
  brass: std("#a8823f", 0.9, 0.32),
  copper: std("#a3623a", 0.9, 0.35),
  rubber: std("#262220", 0.0, 0.9),
  cable: std("#1f1b18", 0.1, 0.7),
  cardboard: std("#b08a5a", 0.0, 0.9),
  tape: std("#8a6a3f", 0.0, 0.7),
  gaugeFace: std("#f1ebdf", 0.0, 0.5),
  glass: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35 }),
  needle: std("#b23a2e", 0.2, 0.5),
  concrete: std("#c7ccd1", 0.0, 0.95),
};

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Shared scroll tracker (smoothed px/frame) for scroll-reactive scenes. */
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
