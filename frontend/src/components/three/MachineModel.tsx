import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Compressor, Conveyor, Gearbox, Motor, Pump, type ModelProps } from "./machinesA";
import { Boiler, Fan, Generator, Lathe, Press } from "./machinesB";
import { Box, FLOOR, type V3 } from "./parts";
import { prefersReducedMotion, statusColor } from "./shared";

export { FLOOR };

export type MachineKind = "motor" | "pump" | "conveyor" | "compressor" | "gearbox" | "fan" | "generator" | "press" | "lathe" | "boiler";

export interface MachineVisual {
  kind: MachineKind;
  status: string; // operational | degraded | down | retired
  symptoms: string[]; // active symptom tags drive effects
  highlight?: boolean;
}

const MODELS: Record<MachineKind, (p: ModelProps) => React.ReactNode> = {
  motor: Motor,
  pump: Pump,
  conveyor: Conveyor,
  compressor: Compressor,
  gearbox: Gearbox,
  fan: Fan,
  generator: Generator,
  press: Press,
  lathe: Lathe,
  boiler: Boiler,
};

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

// Tall machines are drawn at a smaller scale so they fit the same camera framing.
const SCALE: Partial<Record<MachineKind, number>> = { press: 0.72, boiler: 0.82 };

const FOOTPRINT: Record<MachineKind, [number, number]> = {
  motor: [2.4, 1.6],
  pump: [3.4, 1.4],
  conveyor: [3.6, 2.0],
  compressor: [2.5, 1.2],
  gearbox: [2.6, 1.3],
  fan: [2.4, 1.7],
  generator: [3.0, 1.5],
  press: [2.8, 1.6],
  lathe: [2.9, 1.2],
  boiler: [3.4, 1.7],
};
// Where a leak drips from and where smoke rises, per machine.
const LEAK_ORIGIN: Record<MachineKind, V3> = {
  motor: [0.95, -0.15, 0.15],
  pump: [-0.68, -0.35, 0.18],
  conveyor: [1.5, 0.05, 0.3],
  compressor: [0, FLOOR + 0.13, 0.2],
  gearbox: [0.25, -0.4, 0.33],
  fan: [-0.1, -0.35, -0.42],
  generator: [-0.9, FLOOR + 0.3, 0.6],
  press: [1.15, -0.4, 0.33],
  lathe: [0, 0.05, 0.3],
  boiler: [-0.9, -0.3, 0.6],
};
const SMOKE_ORIGIN: Record<MachineKind, V3> = {
  motor: [0.05, 0.55, 0],
  pump: [0.85, 0.15, 0],
  conveyor: [1.5, 0.3, 0.8],
  compressor: [-0.25, 0.75, 0],
  gearbox: [0, 0.2, 0],
  fan: [0.7, -0.2, -0.3],
  generator: [0.6, 1.0, -0.15],
  press: [1.15, 0.1, 0],
  lathe: [-0.85, 0.5, 0],
  boiler: [1.4, 1.8, 0],
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

  const Model = MODELS[kind] ?? Gearbox;
  const [w, d] = FOOTPRINT[kind] ?? FOOTPRINT.gearbox;
  const s = SCALE[kind] ?? 1;
  return (
    <group>
      <group ref={shake}>
        {/* scale about the floor so the base stays on it */}
        <group scale={s} position={[0, FLOOR * (1 - s), 0]}>
          <Model spin={spin} hot={hot} running={running} />
        </group>
      </group>
      {symptoms.includes("leak") && !reduced && <Leak origin={LEAK_ORIGIN[kind] ?? LEAK_ORIGIN.gearbox} />}
      {symptoms.includes("smoke_or_burning") && !reduced && <Smoke origin={SMOKE_ORIGIN[kind] ?? SMOKE_ORIGIN.gearbox} />}
      <FloorMarking w={w} d={d} color={statusColor(status)} highlight={highlight} />
    </group>
  );
}
