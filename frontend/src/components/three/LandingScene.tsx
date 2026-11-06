import { Grid } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { MachineMesh, type MachineKind } from "./MachineModel";
import { FLOOR, M } from "./parts";
import { prefersReducedMotion } from "./shared";
import { Studio } from "./Studio";

/** One production line: every modelled machine, laid out the way a plant groups them. */
const LINE: { kind: MachineKind; at: [number, number, number]; rotY?: number; symptoms?: string[]; status?: string }[] = [
  { kind: "conveyor", at: [-10, 0, 0] },
  { kind: "motor", at: [-6.4, 0, 0.4], symptoms: ["vibration"] },
  { kind: "pump", at: [-2.4, 0, 0], symptoms: ["leak"] },
  { kind: "gearbox", at: [1.4, 0, 0.3] },
  { kind: "press", at: [5.2, 0, 0] },
  { kind: "lathe", at: [8.9, 0, 0.3] },
  { kind: "boiler", at: [13.2, 0, 0] },
  { kind: "generator", at: [17.4, 0, 0.3] },
  { kind: "fan", at: [-7.5, 0, -4.6], rotY: 0.3 },
  { kind: "compressor", at: [3.5, 0, -4.6], symptoms: ["overheating"] },
];

/** Camera stops, one per page section: [position, look-at]. */
export const STOPS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [[3.5, 9, 19], [3.5, -0.5, -1]], // the whole line
  [[-6.0, 1.8, 5.6], [-8.2, -0.3, 0]], // conveyor and motor: speak the fault
  [[1.3, 1.9, 5.2], [-0.6, -0.3, 0]], // pump and gearbox: fixes from history and the web
  [[9.3, 2.1, 5.8], [7.0, -0.1, 0]], // press and lathe: mechanics on their phones
  [[18.2, 2.5, 6.4], [15.3, 0.1, 0]], // boiler and generator: safety and trust
  [[-3, 6, 11], [5, -0.6, -2]], // about
  [[3.5, 12, 22], [3.5, -0.5, -1]], // contact
];

function Rig({ progress }: { progress: { current: number } }) {
  const { camera } = useThree();
  const reduced = prefersReducedMotion();
  const look = useMemo(() => new THREE.Vector3(...STOPS[0][1]), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const p = Math.min(Math.max(progress.current, 0), STOPS.length - 1);
    const i = Math.floor(p);
    const f = p - i;
    const ease = f * f * (3 - 2 * f);
    const [a, b] = [STOPS[i], STOPS[Math.min(i + 1, STOPS.length - 1)]];
    pos.set(...a[0]).lerp(new THREE.Vector3(...b[0]), ease);
    tgt.set(...a[1]).lerp(new THREE.Vector3(...b[1]), ease);
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    camera.position.lerp(pos, k);
    look.lerp(tgt, k);
    camera.lookAt(look);
  });
  return null;
}

/** Full-screen 3D plant behind the landing page; `progress` is the section index (fractional while scrolling). */
export default function LandingScene({ progress, className = "" }: { progress: { current: number }; className?: string }) {
  // Phones get no shadows and a lower pixel ratio so the walk-through stays smooth.
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div className={className} aria-hidden>
      <Canvas camera={{ position: STOPS[0][0], fov: small ? 55 : 40 }} dpr={small ? [1, 1.25] : [1, 1.5]} shadows={!small} gl={{ antialias: !small, powerPreference: "high-performance" }}>
        <color attach="background" args={["#e6eaee"]} />
        <fog attach="fog" args={["#e6eaee", 18, 46]} />
        <Studio shadows={!small} shadowExtent={16} shadowMap={1024} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, FLOOR - 0.002, -1]} material={M().grout} receiveShadow>
          <planeGeometry args={[90, 60]} />
        </mesh>
        <Grid position={[0, FLOOR - 0.001, 0]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor="#c3cad1" sectionSize={4} sectionThickness={0.9} sectionColor="#a5afb9" fadeDistance={45} fadeStrength={1.5} />
        {/* walkway markings between the rows */}
        {[-2.2, 2.0].map((z) => (
          <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[3.5, FLOOR + 0.001, z]}>
            <planeGeometry args={[34, 0.09]} />
            <meshStandardMaterial color="#d9a21b" roughness={0.8} />
          </mesh>
        ))}
        {LINE.map((m) => (
          <group key={m.kind} position={m.at} rotation={[0, m.rotY ?? 0, 0]}>
            <MachineMesh kind={m.kind} status={m.status ?? "operational"} symptoms={m.symptoms ?? []} />
          </group>
        ))}
        <Rig progress={progress} />
      </Canvas>
    </div>
  );
}
