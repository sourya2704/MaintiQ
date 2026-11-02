import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAT, prefersReducedMotion, statusColor } from "./shared";

export type MachineKind = "motor" | "pump" | "conveyor" | "compressor" | "generic";

export interface MachineVisual {
  kind: MachineKind;
  status: string; // operational | degraded | down | retired
  symptoms: string[]; // active symptom tags drive effects
  highlight?: boolean;
}

/** Floor level used by every model: bases sit on y = FLOOR. */
export const FLOOR = -0.8;
const X_AXIS: [number, number, number] = [0, 0, Math.PI / 2]; // rotate a Y-cylinder onto X
const Z_AXIS: [number, number, number] = [Math.PI / 2, 0, 0];

type V3 = [number, number, number];
type Mat = THREE.Material;

function Box({ size, pos, mat, rot }: { size: V3; pos: V3; mat: Mat; rot?: V3 }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Cyl({ r, len, pos, mat, rot = X_AXIS, rTop, seg = 32, theta }: { r: number; len: number; pos: V3; mat: Mat; rot?: V3; rTop?: number; seg?: number; theta?: number }) {
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, len, seg, 1, false, 0, theta ?? Math.PI * 2]} />
    </mesh>
  );
}

/** Body material that warms to a dull red glow when the machine is overheating. */
function useHeat(base: THREE.MeshStandardMaterial, hot: boolean) {
  const mat = useMemo(() => {
    if (!hot) return base;
    const m = base.clone();
    m.emissive = new THREE.Color("#c2410c");
    return m;
  }, [base, hot]);
  useEffect(() => () => void (mat !== base && mat.dispose()), [mat, base]);
  useFrame(({ clock }) => {
    if (hot) (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.22 + Math.sin(clock.elapsedTime * 2) * 0.1;
  });
  return mat;
}

function Spin({ children, speed, axis = "x" }: { children: React.ReactNode; speed: number; axis?: "x" | "y" | "z" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function BoltRing({ r, count, x, size = 0.022, axis = "x" }: { r: number; count: number; x: number; size?: number; axis?: "x" | "y" }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        const pos: V3 = axis === "x" ? [x, Math.cos(a) * r, Math.sin(a) * r] : [Math.cos(a) * r, x, Math.sin(a) * r];
        return <Cyl key={i} r={size} len={0.03} pos={pos} mat={MAT.steel} rot={axis === "x" ? X_AXIS : [0, 0, 0]} seg={6} />;
      })}
    </>
  );
}

function Gauge({ pos, running, rot = [0, 0, 0] as V3, size = 0.09 }: { pos: V3; running: boolean; rot?: V3; size?: number }) {
  const needle = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!needle.current) return;
    const target = running ? -0.6 + Math.sin(clock.elapsedTime * 3) * 0.03 : 1.1;
    needle.current.rotation.z = THREE.MathUtils.damp(needle.current.rotation.z, target, 3, dt);
  });
  return (
    <group position={pos} rotation={rot}>
      <Cyl r={size} len={0.04} pos={[0, 0, 0]} mat={MAT.brass} rot={Z_AXIS} />
      <Cyl r={size * 0.85} len={0.005} pos={[0, 0, 0.022]} mat={MAT.gaugeFace} rot={Z_AXIS} />
      <group ref={needle} position={[0, 0, 0.026]}>
        <Box size={[0.012, size * 0.75, 0.004]} pos={[0, size * 0.33, 0]} mat={MAT.needle} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ motor

/** Totally-enclosed fan-cooled induction motor body, shaft along +X, centred on the shaft axis. */
function MotorBody({ r = 0.48, len = 1.25, paint, spin, cable = false }: { r?: number; len?: number; paint: Mat; spin: number; cable?: boolean }) {
  const half = len / 2;
  const bell = useMemo(
    () =>
      new THREE.LatheGeometry(
        [new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.98, 0.05), new THREE.Vector2(r * 0.85, 0.12), new THREE.Vector2(r * 0.5, 0.18), new THREE.Vector2(r * 0.34, 0.2)],
        40,
      ),
    [r],
  );
  const fins = 22;
  const cableCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.05, r + 0.2, r * 0.38),
        new THREE.Vector3(0.05, r + 0.15, r + 0.25),
        new THREE.Vector3(0.1, 0, r + 0.4),
        new THREE.Vector3(0.25, FLOOR + 0.03, r + 0.6),
        new THREE.Vector3(0.9, FLOOR + 0.02, r + 0.7),
      ]),
    [r],
  );
  return (
    <group>
      {/* frame */}
      <Cyl r={r} len={len} pos={[0, 0, 0]} mat={paint} seg={48} />
      {Array.from({ length: fins }).map((_, i) => {
        const a = (i / fins) * Math.PI * 2;
        if (Math.sin(a) < -0.8) return null; // no fins where the feet are
        return (
          <mesh key={i} position={[0, Math.sin(a) * (r + 0.035), Math.cos(a) * (r + 0.035)]} rotation={[-a, 0, 0]} material={paint} castShadow>
            <boxGeometry args={[len * 0.94, 0.022, 0.075]} />
          </mesh>
        );
      })}
      {/* drive-end bell, bearing cap */}
      <mesh geometry={bell} position={[half, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={paint} castShadow />
      <Cyl r={r * 0.3} len={0.06} pos={[half + 0.22, 0, 0]} mat={MAT.castIron} />
      {/* non-drive-end fan cowl with grille */}
      <Cyl r={r + 0.05} len={len * 0.26} pos={[-half - len * 0.13, 0, 0]} mat={MAT.motorPaintDark} seg={48} />
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={[-half - len * 0.26 - 0.005, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={MAT.castIron}>
          <torusGeometry args={[(r + 0.03) * f, 0.012, 6, 40]} />
        </mesh>
      ))}
      {/* shaft with keyway and coupling hub (rotates) */}
      <Spin speed={spin}>
        <Cyl r={r * 0.15} len={0.38} pos={[half + 0.42, 0, 0]} mat={MAT.steel} />
        <Box size={[0.2, 0.015, 0.03]} pos={[half + 0.48, r * 0.15, 0]} mat={MAT.castIron} />
        <Cyl r={r * 0.27} len={0.1} pos={[half + 0.58, 0, 0]} mat={MAT.brushedSteel} />
        <BoltRing r={r * 0.19} count={6} x={half + 0.635} size={0.015} />
      </Spin>
      {/* terminal box, lifting eye, nameplate */}
      <Box size={[0.34, 0.2, 0.34]} pos={[0.05, r + 0.12, 0]} mat={paint} />
      <Box size={[0.37, 0.025, 0.37]} pos={[0.05, r + 0.23, 0]} mat={MAT.motorPaintDark} />
      <Cyl r={0.035} len={0.08} pos={[0.05, r + 0.12, 0.2]} mat={MAT.brass} rot={Z_AXIS} />
      <mesh position={[-half * 0.55, r + 0.07, 0]} material={MAT.steel} castShadow>
        <torusGeometry args={[0.055, 0.016, 10, 24]} />
      </mesh>
      <Box size={[0.24, 0.13, 0.006]} pos={[0.15, 0.05, r + 0.075]} mat={MAT.brass} />
      {cable && (
        <mesh material={MAT.cable} castShadow>
          <tubeGeometry args={[cableCurve, 40, 0.025, 8, false]} />
        </mesh>
      )}
    </group>
  );
}

function Motor({ spin, hot }: { spin: number; hot: boolean }) {
  const paint = useHeat(MAT.motorPaint, hot);
  const r = 0.48;
  const feetY = -r - 0.07;
  return (
    <group>
      <MotorBody r={r} paint={paint} spin={spin} cable />
      {[-0.38, 0.38].map((x) => (
        <group key={x}>
          <Box size={[0.26, 0.12, 0.2]} pos={[x, -r + 0.02, 0.33]} mat={paint} />
          <Box size={[0.26, 0.12, 0.2]} pos={[x, -r + 0.02, -0.33]} mat={paint} />
          <Box size={[0.3, 0.08, 0.98]} pos={[x, feetY, 0]} mat={paint} />
          {[-0.4, 0.4].map((z) => (
            <Cyl key={z} r={0.03} len={0.05} pos={[x, feetY + 0.06, z]} mat={MAT.steel} rot={[0, 0, 0]} seg={6} />
          ))}
        </group>
      ))}
      {/* fabricated base plate on the floor */}
      <Box size={[1.9, 0.12, 1.15]} pos={[0.1, FLOOR + 0.06, 0]} mat={MAT.baseSteel} />
      <Box size={[0.14, feetY - 0.04 - (FLOOR + 0.12), 1.0]} pos={[-0.38, (feetY - 0.04 + FLOOR + 0.12) / 2, 0]} mat={MAT.baseSteel} />
      <Box size={[0.14, feetY - 0.04 - (FLOOR + 0.12), 1.0]} pos={[0.38, (feetY - 0.04 + FLOOR + 0.12) / 2, 0]} mat={MAT.baseSteel} />
    </group>
  );
}

// ------------------------------------------------------------------ pump

function Pump({ spin, hot, running }: { spin: number; hot: boolean; running: boolean }) {
  const casting = useHeat(MAT.pumpCasting, hot);
  const shaftY = -0.15;
  return (
    <group>
      <Box size={[2.9, 0.12, 0.95]} pos={[0, FLOOR + 0.06, 0]} mat={MAT.baseSteel} />
      {/* driver motor, facing the pump (-X) */}
      <group position={[0.85, shaftY, 0]} rotation={[0, Math.PI, 0]}>
        <MotorBody r={0.32} len={0.85} paint={MAT.motorPaint} spin={spin} />
        <Box size={[0.6, 0.22, 0.5]} pos={[0, -0.43, 0]} mat={MAT.motorPaint} />
      </group>
      {/* coupling guard */}
      <Cyl r={0.2} len={0.42} pos={[0.04, shaftY, 0]} mat={MAT.ochrePaint} theta={Math.PI} />
      <Box size={[0.42, 0.02, 0.4]} pos={[0.04, shaftY - 0.005, 0]} mat={MAT.ochrePaint} />
      {/* bearing frame and pedestal */}
      <Cyl r={0.15} len={0.48} pos={[-0.42, shaftY, 0]} mat={MAT.castIron} />
      <Box size={[0.3, shaftY - (FLOOR + 0.12), 0.34]} pos={[-0.42, (shaftY + FLOOR + 0.12) / 2, 0]} mat={MAT.castIron} />
      {/* volute casing */}
      <group position={[-0.92, shaftY + 0.02, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={casting} castShadow receiveShadow>
          <torusGeometry args={[0.3, 0.17, 20, 48]} />
        </mesh>
        <Cyl r={0.44} len={0.2} pos={[0, 0, 0]} mat={casting} seg={48} />
        <Cyl r={0.36} len={0.06} pos={[0.13, 0, 0]} mat={casting} seg={48} />
        <BoltRing r={0.4} count={12} x={0.105} size={0.018} />
        {/* suction nozzle + flange */}
        <Cyl r={0.13} len={0.32} pos={[-0.26, 0, 0]} mat={casting} />
        <Cyl r={0.22} len={0.05} pos={[-0.43, 0, 0]} mat={casting} />
        <BoltRing r={0.18} count={8} x={-0.46} size={0.016} />
        {/* discharge nozzle (tangential) + flange */}
        <Cyl r={0.1} len={0.36} pos={[0, 0.5, 0.22]} mat={casting} rot={[0, 0, 0]} />
        <Cyl r={0.18} len={0.05} pos={[0, 0.69, 0.22]} mat={casting} rot={[0, 0, 0]} />
        <BoltRing r={0.14} count={8} x={0.72} size={0.014} axis="y" />
        <Cyl r={0.1} len={0.5} pos={[0, 0.96, 0.22]} mat={MAT.brushedSteel} rot={[0, 0, 0]} />
        <Gauge pos={[0.13, 0.45, 0.33]} running={running} rot={[0, 0.5, 0]} size={0.075} />
        {/* support foot */}
        <Box size={[0.22, 0.2, 0.4]} pos={[0, -0.45, 0]} mat={casting} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ conveyor

function beltTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2a2522";
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = "#1b1816";
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 6, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Conveyor({ spin, hot }: { spin: number; hot: boolean }) {
  const frame = useHeat(MAT.ochrePaint, hot);
  const belt = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: beltTexture(), roughness: 0.9 });
    return m;
  }, []);
  useEffect(() => () => {
    belt.map?.dispose();
    belt.dispose();
  }, [belt]);
  const cartons = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (belt.map) belt.map.offset.x -= dt * spin * 0.05;
    cartons.current?.children.forEach((b) => {
      b.position.x += dt * spin * 0.11;
      if (b.position.x > 1.35) b.position.x = -1.35;
    });
  });
  const top = 0.1;
  return (
    <group>
      {/* side channels */}
      {[-0.43, 0.43].map((z) => (
        <group key={z}>
          <Box size={[3.0, 0.2, 0.04]} pos={[0, 0, z]} mat={frame} />
          <Box size={[3.0, 0.03, 0.1]} pos={[0, 0.1, z - Math.sign(z) * 0.03]} mat={frame} />
          <Box size={[3.0, 0.03, 0.1]} pos={[0, -0.1, z - Math.sign(z) * 0.03]} mat={frame} />
        </group>
      ))}
      {/* legs + bracing */}
      {[-1.2, 1.2].map((x) => (
        <group key={x}>
          {[-0.43, 0.43].map((z) => (
            <Box key={z} size={[0.07, -FLOOR - 0.1, 0.07]} pos={[x, (FLOOR - 0.1) / 2, z]} mat={frame} />
          ))}
          <Box size={[0.04, 0.04, 0.86]} pos={[x, -0.45, 0]} mat={frame} />
          <Box size={[0.03, 0.03, 0.95]} pos={[x, -0.42, 0]} rot={[0.68, 0, 0]} mat={frame} />
          {[-0.43, 0.43].map((z) => (
            <Box key={`f${z}`} size={[0.16, 0.02, 0.16]} pos={[x, FLOOR + 0.01, z]} mat={MAT.baseSteel} />
          ))}
        </group>
      ))}
      {/* pulleys, idlers (rotate) */}
      {[-1.42, 1.42].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Spin speed={-spin} axis="z">
            <Cyl r={0.11} len={0.8} pos={[0, 0, 0]} mat={MAT.brushedSteel} rot={Z_AXIS} />
          </Spin>
          <Cyl r={0.04} len={0.95} pos={[0, 0, 0]} mat={MAT.steel} rot={Z_AXIS} />
        </group>
      ))}
      {[-0.85, -0.28, 0.28, 0.85].map((x) => (
        <Spin key={x} speed={-spin * 2} axis="z">
          <Cyl r={0.05} len={0.78} pos={[x, top - 0.065, 0]} mat={MAT.steel} rot={Z_AXIS} seg={20} />
        </Spin>
      ))}
      {/* belt: carry side, return side, end wraps */}
      <mesh position={[0, top + 0.012, 0]} material={belt} receiveShadow castShadow>
        <boxGeometry args={[2.84, 0.012, 0.74]} />
      </mesh>
      <mesh position={[0, -0.112, 0]} material={MAT.rubber}>
        <boxGeometry args={[2.84, 0.012, 0.74]} />
      </mesh>
      {[-1.42, 1.42].map((x) => (
        <Cyl key={x} r={0.122} len={0.74} pos={[x, 0, 0]} mat={MAT.rubber} rot={x > 0 ? Z_AXIS : [Math.PI / 2, 0, Math.PI]} theta={Math.PI} />
      ))}
      {/* cartons */}
      <group ref={cartons}>
        {[-1.0, 0.1, 0.95].map((x, i) => (
          <group key={i} position={[x, top + 0.17, (i - 1) * 0.06]}>
            <Box size={[0.42, 0.3, 0.38]} pos={[0, 0, 0]} mat={MAT.cardboard} />
            <Box size={[0.43, 0.005, 0.07]} pos={[0, 0.152, 0]} mat={MAT.tape} />
          </group>
        ))}
      </group>
      {/* gearmotor drive at the head end */}
      <group position={[1.42, 0, 0.72]}>
        <Box size={[0.3, 0.32, 0.2]} pos={[0, 0, -0.08]} mat={MAT.castIron} />
        <group position={[0, 0, 0.55]} rotation={[0, Math.PI / 2, 0]}>
          <MotorBody r={0.16} len={0.4} paint={MAT.motorPaint} spin={spin * 3} />
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ compressor

function Flywheel({ r }: { r: number }) {
  return (
    <group>
      <mesh material={MAT.castIron} castShadow>
        <torusGeometry args={[r, 0.035, 10, 48]} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} size={[0.03, r * 2 - 0.04, 0.025]} pos={[0, 0, 0]} rot={[0, 0, (i / 5) * Math.PI]} mat={MAT.castIron} />
      ))}
      <Cyl r={0.06} len={0.08} pos={[0, 0, 0]} mat={MAT.steel} rot={Z_AXIS} />
    </group>
  );
}

function FinnedCylinder({ pos, tilt }: { pos: V3; tilt: number }) {
  return (
    <group position={pos} rotation={[0, 0, tilt]}>
      {Array.from({ length: 7 }).map((_, i) => (
        <Cyl key={i} r={0.13} len={0.018} pos={[0, i * 0.04, 0]} mat={MAT.brushedSteel} rot={[0, 0, 0]} seg={28} />
      ))}
      <Cyl r={0.09} len={0.3} pos={[0, 0.12, 0]} mat={MAT.castIron} rot={[0, 0, 0]} />
      <Box size={[0.24, 0.07, 0.24]} pos={[0, 0.3, 0]} mat={MAT.castIron} />
    </group>
  );
}

function Compressor({ spin, hot, running }: { spin: number; hot: boolean; running: boolean }) {
  const tank = useHeat(MAT.tankPaint, hot);
  const tankY = FLOOR + 0.6;
  const deck = tankY + 0.44;
  const pipe = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.32, deck + 0.55, 0),
        new THREE.Vector3(-0.6, deck + 0.4, 0.15),
        new THREE.Vector3(-0.75, deck + 0.05, 0.2),
        new THREE.Vector3(-0.75, tankY + 0.35, 0.2),
      ]),
    [deck, tankY],
  );
  return (
    <group>
      {/* receiver tank on saddles */}
      <mesh position={[0, tankY, 0]} rotation={X_AXIS} material={tank} castShadow receiveShadow>
        <capsuleGeometry args={[0.42, 1.45, 12, 40]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <Box size={[0.12, tankY - 0.3 - FLOOR, 0.5]} pos={[x, (tankY - 0.3 + FLOOR) / 2, 0]} mat={MAT.baseSteel} />
          <Box size={[0.22, 0.03, 0.62]} pos={[x, FLOOR + 0.015, 0]} mat={MAT.baseSteel} />
        </group>
      ))}
      <Cyl r={0.025} len={0.12} pos={[0, tankY - 0.47, 0.1]} mat={MAT.brass} rot={[0, 0, 0]} />
      {/* deck plate */}
      <Box size={[1.25, 0.04, 0.7]} pos={[-0.05, deck, 0]} mat={MAT.baseSteel} />
      {/* V-twin pump: crankcase + finned cylinders */}
      <Box size={[0.42, 0.28, 0.36]} pos={[-0.3, deck + 0.16, 0]} mat={MAT.castIron} />
      <FinnedCylinder pos={[-0.42, deck + 0.3, 0]} tilt={0.5} />
      <FinnedCylinder pos={[-0.18, deck + 0.3, 0]} tilt={-0.5} />
      <mesh material={MAT.copper} castShadow>
        <tubeGeometry args={[pipe, 30, 0.025, 8, false]} />
      </mesh>
      {/* flywheel + motor pulley + belt (flywheel spins) */}
      <group position={[-0.3, deck + 0.2, 0.3]}>
        <Spin speed={spin * 0.6} axis="z">
          <Flywheel r={0.3} />
        </Spin>
      </group>
      <group position={[0.35, deck + 0.17, 0]} rotation={[0, Math.PI / 2, 0]}>
        <MotorBody r={0.16} len={0.45} paint={MAT.motorPaint} spin={spin} />
      </group>
      <group position={[0.35, deck + 0.17, 0.3]}>
        <Spin speed={spin} axis="z">
          <Cyl r={0.08} len={0.06} pos={[0, 0, 0]} mat={MAT.castIron} rot={Z_AXIS} />
        </Spin>
      </group>
      {[1, -1].map((s) => {
        const a = new THREE.Vector3(-0.3, deck + 0.2 + s * 0.3, 0.3);
        const b = new THREE.Vector3(0.35, deck + 0.17 + s * 0.08, 0.3);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        return <Box key={s} size={[a.distanceTo(b), 0.025, 0.04]} pos={[mid.x, mid.y, mid.z]} rot={[0, 0, ang]} mat={MAT.rubber} />;
      })}
      {/* pressure switch, gauge, safety valve */}
      <Box size={[0.14, 0.18, 0.1]} pos={[0.45, deck + 0.12, -0.25]} mat={MAT.motorPaintDark} />
      <Gauge pos={[0.6, tankY + 0.25, 0.38]} running={running} rot={[0, 0.3, 0]} />
      <Cyl r={0.03} len={0.14} pos={[-0.75, tankY + 0.42, -0.15]} mat={MAT.brass} rot={[0, 0, 0]} />
    </group>
  );
}

function Gearbox({ spin, hot }: { spin: number; hot: boolean }) {
  const housing = useHeat(MAT.castIron, hot);
  return (
    <group>
      <Box size={[1.6, 0.12, 1.0]} pos={[0, FLOOR + 0.06, 0]} mat={MAT.baseSteel} />
      <Box size={[0.9, 0.7, 0.7]} pos={[0, FLOOR + 0.47, 0]} mat={housing} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} size={[0.02, 0.6, 0.74]} pos={[-0.35 + i * 0.14, FLOOR + 0.47, 0]} mat={housing} />
      ))}
      <Spin speed={spin}>
        <Cyl r={0.06} len={0.4} pos={[0.6, FLOOR + 0.6, 0]} mat={MAT.steel} />
      </Spin>
      <Spin speed={spin * 0.25}>
        <Cyl r={0.1} len={0.4} pos={[-0.6, FLOOR + 0.35, 0]} mat={MAT.steel} />
      </Spin>
    </group>
  );
}

// ------------------------------------------------------------------ effects

/** Water drips from the machine and a damp patch spreads on the floor. */
function Leak({ origin }: { origin: V3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 8;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ t: i / count, dx: (Math.random() - 0.5) * 0.06 })), []);
  const m = useMemo(() => new THREE.Object3D(), []);
  const fall = origin[1] - FLOOR;
  useFrame((_, dt) => {
    if (!ref.current) return;
    seeds.forEach((s, i) => {
      s.t = (s.t + dt * 0.8) % 1;
      m.position.set(origin[0] + s.dx, origin[1] - s.t * s.t * fall, origin[2]);
      m.scale.set(0.018, 0.026, 0.018);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshPhysicalMaterial color="#d9d4cb" roughness={0.05} transmission={0.5} transparent opacity={0.8} />
      </instancedMesh>
      <mesh position={[origin[0], FLOOR + 0.003, origin[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 40]} />
        <meshStandardMaterial color="#5a4c3e" transparent opacity={0.35} roughness={0.15} metalness={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Smoke({ origin }: { origin: V3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 12;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ t: i / count, x: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.3 })), []);
  const m = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    seeds.forEach((s, i) => {
      s.t = (s.t + dt * 0.25) % 1;
      m.position.set(origin[0] + s.x * 0.6 + s.t * 0.25, origin[1] + s.t * 1.1, origin[2] + s.z * 0.6);
      m.scale.setScalar(0.04 + s.t * 0.17);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color="#6f675e" transparent opacity={0.16} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}

/** Painted floor-marking tape around the machine footprint, coloured by status. */
function FloorMarking({ w, d, color, highlight }: { w: number; d: number; color: string; highlight?: boolean }) {
  const t = 0.07;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = highlight ? 0.35 : 0;
  }, [highlight, color, mat]);
  const y = FLOOR + 0.002;
  return (
    <group>
      <Box size={[w, 0.004, t]} pos={[0, y, d / 2]} mat={mat} />
      <Box size={[w, 0.004, t]} pos={[0, y, -d / 2]} mat={mat} />
      <Box size={[t, 0.004, d]} pos={[w / 2, y, 0]} mat={mat} />
      <Box size={[t, 0.004, d]} pos={[-w / 2, y, 0]} mat={mat} />
    </group>
  );
}

const FOOTPRINT: Record<MachineKind, [number, number]> = {
  motor: [2.8, 2.2],
  pump: [3.4, 1.6],
  conveyor: [3.4, 2.0],
  compressor: [2.6, 1.6],
  generic: [2.0, 1.6],
};
const LEAK_ORIGIN: Record<MachineKind, V3> = {
  motor: [0.95, -0.1, 0.2],
  pump: [-1.15, -0.2, 0.15],
  conveyor: [0.6, -0.12, 0.3],
  compressor: [0, FLOOR + 0.13, 0.12],
  generic: [0, -0.3, 0.4],
};
const SMOKE_ORIGIN: Record<MachineKind, V3> = {
  motor: [0.05, 0.75, 0],
  pump: [0.85, 0.2, 0],
  conveyor: [1.42, 0.25, 0.9],
  compressor: [0.35, 0.4, 0],
  generic: [0, 0.1, 0],
};

/** A machine whose animation is driven by its real status and active symptom tags. */
export function MachineMesh({ kind, status, symptoms, highlight }: MachineVisual) {
  const shake = useRef<THREE.Group>(null);
  const reduced = prefersReducedMotion();
  const running = status === "operational" || status === "degraded";
  const vibrating = symptoms.includes("vibration") && running && !reduced;
  const hot = symptoms.includes("overheating");
  const spin = reduced || !running ? 0 : status === "degraded" ? 3 : 6;

  useFrame(({ clock }) => {
    if (!shake.current) return;
    const t = clock.elapsedTime;
    const a = vibrating ? 0.008 : 0;
    shake.current.position.set(Math.sin(t * 71) * a, Math.sin(t * 53) * a * 0.5, Math.cos(t * 61) * a);
  });

  const [w, d] = FOOTPRINT[kind];
  return (
    <group>
      <group ref={shake}>
        {kind === "motor" && <Motor spin={spin} hot={hot} />}
        {kind === "pump" && <Pump spin={spin} hot={hot} running={running} />}
        {kind === "conveyor" && <Conveyor spin={spin} hot={hot} />}
        {kind === "compressor" && <Compressor spin={spin} hot={hot} running={running} />}
        {kind === "generic" && <Gearbox spin={spin} hot={hot} />}
      </group>
      {symptoms.includes("leak") && !reduced && <Leak origin={LEAK_ORIGIN[kind]} />}
      {symptoms.includes("smoke_or_burning") && !reduced && <Smoke origin={SMOKE_ORIGIN[kind]} />}
      <FloorMarking w={w} d={d} color={statusColor(status)} highlight={highlight} />
    </group>
  );
}
