import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  brushedTexture,
  castTexture,
  checkerTexture,
  galvanizedTexture,
  grainBump,
  hazardTexture,
  louvreTexture,
  nameplateTexture,
  paintRoughness,
  paintTexture,
  rubberTexture,
} from "./textures";

export type V3 = [number, number, number];
export type Mat = THREE.Material;

/** Floor level used by every model: bases sit on y = FLOOR. */
export const FLOOR = -0.8;
export const X_AXIS: V3 = [0, 0, Math.PI / 2]; // lay a Y-cylinder along X
export const Z_AXIS: V3 = [Math.PI / 2, 0, 0]; // lay a Y-cylinder along Z

function painted(color: string, wear: number, seed: number, metalness = 0.3) {
  return new THREE.MeshStandardMaterial({
    map: paintTexture(color, wear, seed),
    roughnessMap: paintRoughness(wear, seed),
    roughness: 0.75,
    metalness,
    bumpMap: grainBump(seed),
    bumpScale: 0.6,
  });
}

function metal(base: string, roughness: number) {
  return new THREE.MeshStandardMaterial({ map: brushedTexture(base), metalness: 0.9, roughness });
}

function cast(color: string, seed: number) {
  return new THREE.MeshStandardMaterial({ map: castTexture(color, seed), metalness: 0.4, roughness: 0.8, bumpMap: grainBump(seed), bumpScale: 1.2 });
}

let made: ReturnType<typeof build> | null = null;

function build() {
  return {
    motorBlue: painted("#55687a", 0.45, 2),
    pumpBlue: painted("#2f4f6e", 0.55, 4),
    machineGreen: painted("#5b6b55", 0.5, 6), // classic lathe / machine-tool green
    gensetYellow: painted("#c9a23a", 0.4, 8),
    pressBlue: painted("#3d5c80", 0.35, 9),
    safetyOrange: painted("#c8642b", 0.5, 10),
    boilerRed: painted("#8f3b2a", 0.5, 11),
    cream: painted("#d8ccb2", 0.45, 12, 0.2),
    frameOchre: painted("#b98a2e", 0.55, 13),
    darkPaint: painted("#3b3732", 0.5, 14),
    panelGrey: painted("#a7a196", 0.35, 15, 0.2),
    toolWhite: painted("#d6dadd", 0.3, 16, 0.2), // machine-tool enclosure
    toolGrey: painted("#59636c", 0.35, 17),
    robotOrange: painted("#d9731c", 0.3, 18),
    forkYellow: painted("#d8a51c", 0.5, 19),
    panelRal: painted("#c9ccc4", 0.25, 20, 0.2), // RAL 7035 control panels
    trafoGrey: painted("#7a8691", 0.45, 23),
    towerBlue: painted("#6f8ea3", 0.4, 24, 0.1),
    greenPaint: painted("#3f6b4c", 0.5, 25),
    darkGlass: new THREE.MeshPhysicalMaterial({ color: "#2b3a44", roughness: 0.08, transmission: 0.3, transparent: true, opacity: 0.6 }),
    castIron: cast("#4b4640", 21),
    castRed: cast("#6e3324", 22),
    steel: metal("#c4beb3", 0.3),
    darkSteel: metal("#6f6a62", 0.45),
    chrome: new THREE.MeshStandardMaterial({ color: "#e8e6e1", metalness: 1, roughness: 0.12 }),
    brass: new THREE.MeshStandardMaterial({ map: brushedTexture("#b08a45"), metalness: 0.9, roughness: 0.3 }),
    copper: new THREE.MeshStandardMaterial({ color: "#a3623a", metalness: 0.9, roughness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ map: rubberTexture(false), roughness: 0.92, metalness: 0 }),
    belt: new THREE.MeshStandardMaterial({ map: rubberTexture(true), roughness: 0.9, metalness: 0 }),
    hose: new THREE.MeshStandardMaterial({ color: "#1b1917", roughness: 0.6, metalness: 0.1 }),
    galvanized: new THREE.MeshStandardMaterial({ map: galvanizedTexture(), metalness: 0.75, roughness: 0.45 }),
    cladding: new THREE.MeshStandardMaterial({ map: galvanizedTexture(), color: "#e2e4e4", metalness: 0.8, roughness: 0.35 }),
    checker: new THREE.MeshStandardMaterial({ map: checkerTexture(), metalness: 0.8, roughness: 0.45 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0.2 }),
    louvreYellow: new THREE.MeshStandardMaterial({ map: louvreTexture("#c9a23a"), roughness: 0.7, metalness: 0.3 }),
    louvreGrey: new THREE.MeshStandardMaterial({ map: louvreTexture("#6c675f"), roughness: 0.7, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: "#1d1a17", roughness: 0.6, metalness: 0.3 }),
    gaugeFace: new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#dfe9ec", roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.4 }),
    red: new THREE.MeshStandardMaterial({ color: "#b3261e", roughness: 0.45, metalness: 0.1 }),
    green: new THREE.MeshStandardMaterial({ color: "#2f7d3a", roughness: 0.45, metalness: 0.1 }),
    amber: new THREE.MeshStandardMaterial({ color: "#e0a526", roughness: 0.4, emissive: new THREE.Color("#5a3a00"), emissiveIntensity: 0.4 }),
    screen: new THREE.MeshStandardMaterial({ color: "#123129", roughness: 0.2, emissive: new THREE.Color("#2d8c6a"), emissiveIntensity: 0.5 }),
    oil: new THREE.MeshStandardMaterial({ color: "#7a5a1e", roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.85 }),
    cardboard: new THREE.MeshStandardMaterial({ color: "#a98457", roughness: 0.95 }),
    grout: new THREE.MeshStandardMaterial({ color: "#9b9488", roughness: 1 }),
    needle: new THREE.MeshStandardMaterial({ color: "#b23a2e", roughness: 0.5 }),
  };
}

/** Textured materials, built on first use (textures need the browser canvas). */
export function M() {
  return (made ??= build());
}

export function Box({ size, pos, mat, rot }: { size: V3; pos: V3; mat: Mat; rot?: V3 }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

export function Cyl({ r, len, pos, mat, rot = X_AXIS, rTop, seg = 32, open }: { r: number; len: number; pos: V3; mat: Mat; rot?: V3; rTop?: number; seg?: number; open?: boolean }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, len, seg, 1, open]} />
    </mesh>
  );
}

export function Torus({ r, tube, pos, mat, rot = [0, Math.PI / 2, 0] as V3, arc = Math.PI * 2 }: { r: number; tube: number; pos: V3; mat: Mat; rot?: V3; arc?: number }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow>
      <torusGeometry args={[r, tube, 12, 40, arc]} />
    </mesh>
  );
}

/** Pipe or hose following a smooth path through the given points. */
export function Pipe({ points, r, mat }: { points: V3[]; r: number; mat: Mat }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal", 0.2);
    return new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), r, 12, false);
  }, [points, r]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} castShadow />;
}

/** Lathe-turned solid (flanges, dished heads, bells) from a [radius, height] profile, axis along Y. */
export function Turned({ profile, pos, mat, rot, seg = 48 }: { profile: [number, number][]; pos: V3; mat: Mat; rot?: V3; seg?: number }) {
  const geo = useMemo(() => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), [profile, seg]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} castShadow receiveShadow />;
}

export function Spin({ children, speed, axis = "x", pos }: { children: ReactNode; speed: number; axis?: "x" | "y" | "z"; pos?: V3 }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed;
  });
  return (
    <group ref={ref} position={pos}>
      {children}
    </group>
  );
}

/** Ring of hex bolts on a flange face. `axis` is the flange's axis. */
export function BoltRing({ r, count, at, axis = "x", size = 0.02, mat }: { r: number; count: number; at: V3; axis?: "x" | "y" | "z"; size?: number; mat?: Mat }) {
  const rot: V3 = axis === "x" ? X_AXIS : axis === "z" ? Z_AXIS : [0, 0, 0];
  return (
    <group position={at}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.2;
        const c = Math.cos(a) * r;
        const s = Math.sin(a) * r;
        const p: V3 = axis === "x" ? [0, c, s] : axis === "y" ? [c, 0, s] : [c, s, 0];
        return <Cyl key={i} r={size} len={0.03} pos={p} mat={mat ?? M().steel} rot={rot} seg={6} />;
      })}
    </group>
  );
}

/** Dial gauge facing +Z (rotate the group to aim it). Needle settles when the machine runs. */
export function Gauge({ pos, running, rot = [0, 0, 0], size = 0.08 }: { pos: V3; running: boolean; rot?: V3; size?: number }) {
  const needle = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!needle.current) return;
    const target = running ? -0.6 + Math.sin(clock.elapsedTime * 3) * 0.03 : 1.1;
    needle.current.rotation.z = THREE.MathUtils.damp(needle.current.rotation.z, target, 3, dt);
  });
  return (
    <group position={pos} rotation={rot}>
      <Cyl r={size} len={0.04} pos={[0, 0, 0]} mat={M().brass} rot={Z_AXIS} />
      <Cyl r={size * 0.86} len={0.004} pos={[0, 0, 0.021]} mat={M().gaugeFace} rot={Z_AXIS} />
      <Cyl r={size * 0.86} len={0.004} pos={[0, 0, 0.027]} mat={M().glass} rot={Z_AXIS} />
      <group ref={needle} position={[0, 0, 0.025]}>
        <Box size={[0.01, size * 0.72, 0.003]} pos={[0, size * 0.3, 0]} mat={M().needle} />
      </group>
      <Cyl r={0.018} len={0.06} pos={[0, -size - 0.03, 0]} mat={M().brass} rot={[0, 0, 0]} seg={6} />
    </group>
  );
}

/** Stamped nameplate on a face; `rot` aims it, default facing +Z. */
export function Nameplate({ pos, lines, rot = [0, 0, 0], w = 0.26 }: { pos: V3; lines: string[]; rot?: V3; w?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: nameplateTexture(lines), metalness: 0.6, roughness: 0.4 }), [lines]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={pos} rotation={rot} material={mat}>
      <boxGeometry args={[w, w * 0.62, 0.006]} />
    </mesh>
  );
}

/** Body material that warms to a dull red glow when the machine is overheating. */
export function useHeat(base: THREE.Material, hot: boolean) {
  const mat = useMemo(() => {
    if (!hot) return base;
    const m = (base as THREE.MeshStandardMaterial).clone();
    m.emissive = new THREE.Color("#c2410c");
    return m;
  }, [base, hot]);
  useEffect(() => () => void (mat !== base && mat.dispose()), [mat, base]);
  useFrame(({ clock }) => {
    if (hot) (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.22 + Math.sin(clock.elapsedTime * 2) * 0.1;
  });
  return mat;
}

/** Hex nut/bolt head. */
export function Bolt({ pos, rot = [0, 0, 0], size = 0.025 }: { pos: V3; rot?: V3; size?: number }) {
  return <Cyl r={size} len={size * 0.8} pos={pos} rot={rot} mat={M().steel} seg={6} />;
}

/** Hand wheel (valve or machine handwheel) facing +Z. */
export function Handwheel({ pos, r = 0.08, rot = [0, 0, 0], mat }: { pos: V3; r?: number; rot?: V3; mat?: Mat }) {
  const m = mat ?? M().red;
  return (
    <group position={pos} rotation={rot}>
      <Torus r={r} tube={r * 0.12} pos={[0, 0, 0]} mat={m} rot={[0, 0, 0]} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[r * 2, r * 0.12, r * 0.1]} pos={[0, 0, 0]} rot={[0, 0, (i / 3) * Math.PI]} mat={m} />
      ))}
      <Cyl r={r * 0.22} len={r * 0.5} pos={[0, 0, 0]} mat={M().steel} rot={Z_AXIS} />
    </group>
  );
}

/** Mesh guard made of thin bars (fan inlets, coupling guards). */
export function Grille({ r, pos, rot = [0, 0, 0], rings = 4 }: { r: number; pos: V3; rot?: V3; rings?: number }) {
  return (
    <group position={pos} rotation={rot}>
      {Array.from({ length: rings }).map((_, i) => (
        <Torus key={i} r={(r * (i + 1)) / rings} tube={0.007} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={M().darkSteel} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} size={[r * 2, 0.012, 0.012]} pos={[0, 0, 0]} rot={[0, 0, (i / 6) * Math.PI]} mat={M().darkSteel} />
      ))}
    </group>
  );
}
