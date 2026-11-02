import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, gearGeometry, prefersReducedMotion, statusColor } from "./shared";

export type MachineKind = "motor" | "pump" | "conveyor" | "compressor" | "generic";

export interface MachineVisual {
  kind: MachineKind;
  status: string; // operational | degraded | down | retired
  symptoms: string[]; // active symptom tags drive effects
  highlight?: boolean;
}

const steel = { color: COLORS.steel, metalness: 0.8, roughness: 0.35 };
const dark = { color: COLORS.steelDark, metalness: 0.7, roughness: 0.45 };

function Spinner({ children, speed, axis = "x" }: { children: React.ReactNode; speed: number; axis?: "x" | "y" | "z" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

/** Body material that glows hot when the machine has an overheating symptom. */
function HeatMaterial({ hot, base = steel }: { hot: boolean; base?: typeof steel }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current && hot) ref.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.3;
  });
  return <meshStandardMaterial ref={ref} {...base} emissive={hot ? "#ff3b1f" : "#000000"} emissiveIntensity={hot ? 0.5 : 0} />;
}

function Motor({ spin, hot }: { spin: number; hot: boolean }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 1.6, 40]} />
        <HeatMaterial hot={hot} />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]} position={[-0.68 + i * 0.17, 0, 0]}>
          <torusGeometry args={[0.64, 0.035, 8, 40]} />
          <meshStandardMaterial {...dark} />
        </mesh>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.86, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.58, 0.14, 32]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <Spinner speed={spin}>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[1.2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.7, 16]} />
          <meshStandardMaterial color="#c9d4ea" metalness={1} roughness={0.15} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[1.45, 0, 0]}>
          <boxGeometry args={[0.04, 0.32, 0.06]} />
          <meshStandardMaterial color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={0.6} />
        </mesh>
      </Spinner>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.45, 0.22, 0.4]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <mesh position={[0, -0.68, 0]}>
        <boxGeometry args={[1.5, 0.12, 0.9]} />
        <meshStandardMaterial {...dark} />
      </mesh>
    </group>
  );
}

function Pump({ spin, hot }: { spin: number; hot: boolean }) {
  const impeller = useMemo(() => gearGeometry(6, 0.32, 0.05, 0.12), []);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[-0.2, -0.05, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.55, 40]} />
        <HeatMaterial hot={hot} />
      </mesh>
      <mesh position={[-0.2, -0.05, 0.3]}>
        <torusGeometry args={[0.45, 0.06, 10, 40]} />
        <meshStandardMaterial color={COLORS.plasma} emissive={COLORS.plasma} emissiveIntensity={0.4} />
      </mesh>
      <Spinner speed={spin} axis="z">
        <mesh position={[-0.2, -0.05, 0.31]} geometry={impeller}>
          <meshStandardMaterial color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={0.5} metalness={0.6} />
        </mesh>
      </Spinner>
      <mesh position={[-0.2, 0.75, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 20]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[-1.05, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.7, 20]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.9, 32]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <boxGeometry args={[2.2, 0.12, 0.9]} />
        <meshStandardMaterial {...dark} />
      </mesh>
    </group>
  );
}

function Conveyor({ spin, hot }: { spin: number; hot: boolean }) {
  const boxes = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!boxes.current) return;
    boxes.current.children.forEach((b) => {
      b.position.x += dt * spin * 0.12;
      if (b.position.x > 1.4) b.position.x = -1.4;
    });
  });
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3, 0.08, 0.9]} />
        <meshStandardMaterial color="#1b2338" roughness={0.9} />
      </mesh>
      {[-1.4, -0.7, 0, 0.7, 1.4].map((x) => (
        <Spinner key={x} speed={-spin} axis="z">
          <mesh position={[x, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.95, 16]} />
            <HeatMaterial hot={hot} />
          </mesh>
        </Spinner>
      ))}
      <group ref={boxes}>
        {[-1.1, 0, 0.9].map((x, i) => (
          <mesh key={i} position={[x, 0.2, 0]}>
            <boxGeometry args={[0.38, 0.32, 0.38]} />
            <meshStandardMaterial color={i === 1 ? COLORS.ember : "#8a6a3d"} roughness={0.8} />
          </mesh>
        ))}
      </group>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, -0.45, 0]}>
          <boxGeometry args={[0.1, 0.7, 0.8]} />
          <meshStandardMaterial {...dark} />
        </mesh>
      ))}
    </group>
  );
}

function Compressor({ spin, hot }: { spin: number; hot: boolean }) {
  const pulley = useMemo(() => gearGeometry(8, 0.28, 0.08, 0.06), []);
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.48, 1.4, 8, 32]} />
        <HeatMaterial hot={hot} base={{ color: "#3b4c78", metalness: 0.6, roughness: 0.4 }} />
      </mesh>
      <mesh position={[-0.2, 0.5, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.55]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <Spinner speed={spin} axis="z">
        <mesh position={[0.6, 0.55, 0.2]} geometry={pulley}>
          <meshStandardMaterial color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={0.4} metalness={0.7} />
        </mesh>
      </Spinner>
      <mesh position={[0.5, 0.1, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.05, 24]} />
        <meshStandardMaterial color="#e2e8f0" emissive={COLORS.plasma} emissiveIntensity={0.3} />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, -0.75, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.7]} />
          <meshStandardMaterial {...dark} />
        </mesh>
      ))}
    </group>
  );
}

function Generic({ spin, hot }: { spin: number; hot: boolean }) {
  const geo = useMemo(() => gearGeometry(14, 0.75, 0.25), []);
  return (
    <group>
      <Spinner speed={spin} axis="z">
        <mesh geometry={geo}>
          <HeatMaterial hot={hot} />
        </mesh>
      </Spinner>
      <mesh position={[0, -0.75, 0]}>
        <boxGeometry args={[1.2, 0.12, 0.6]} />
        <meshStandardMaterial {...dark} />
      </mesh>
    </group>
  );
}

/** Particles: falling drops for leaks, rising puffs for smoke. */
function Particles({ kind, count = 14 }: { kind: "leak" | "smoke"; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, () => ({ t: Math.random(), x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.4 })), [count]);
  const m = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    seeds.forEach((s, i) => {
      s.t = (s.t + dt * (kind === "leak" ? 0.9 : 0.35)) % 1;
      if (kind === "leak") {
        m.position.set(s.x - 0.2, -0.2 - s.t * 0.7, s.z + 0.3);
        m.scale.setScalar(0.05);
      } else {
        m.position.set(s.x, 0.8 + s.t * 1.6, s.z);
        m.scale.setScalar(0.1 + s.t * 0.35);
      }
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 10, 10]} />
      {kind === "leak" ? (
        <meshStandardMaterial color={COLORS.plasma} emissive={COLORS.plasma} emissiveIntensity={0.8} transparent opacity={0.85} />
      ) : (
        <meshStandardMaterial color="#9aa3b5" transparent opacity={0.22} depthWrite={false} />
      )}
    </instancedMesh>
  );
}

/** A machine whose animation is driven by its real status and active symptom tags. */
export function MachineMesh({ kind, status, symptoms, highlight }: MachineVisual) {
  const shake = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = prefersReducedMotion();
  const running = status === "operational" || status === "degraded";
  const vibrating = symptoms.includes("vibration") && running && !reduced;
  const hot = symptoms.includes("overheating");
  const spin = reduced || !running ? 0 : status === "degraded" ? 2.2 : 4;
  const color = statusColor(status);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (shake.current) {
      const a = vibrating ? 0.025 : 0;
      shake.current.position.set(Math.sin(t * 61) * a, Math.sin(t * 47) * a * 0.6, Math.cos(t * 53) * a);
    }
    if (ring.current) ring.current.emissiveIntensity = (highlight ? 1.6 : 0.7) + Math.sin(t * 2.5) * 0.35;
  });

  const Body = { motor: Motor, pump: Pump, conveyor: Conveyor, compressor: Compressor, generic: Generic }[kind];
  return (
    <group>
      <group ref={shake}>
        <Body spin={spin} hot={hot} />
        {symptoms.includes("leak") && !reduced && <Particles kind="leak" />}
        {symptoms.includes("smoke_or_burning") && !reduced && <Particles kind="smoke" count={10} />}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <ringGeometry args={[1.45, 1.6, 64]} />
        <meshStandardMaterial ref={ring} color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.81, 0]}>
        <circleGeometry args={[1.45, 64]} />
        <meshStandardMaterial color="#0b1222" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
