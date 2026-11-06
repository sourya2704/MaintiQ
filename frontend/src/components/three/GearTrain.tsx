import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { gearGeometry, MAT, prefersReducedMotion, scrollState, useOnScreen } from "./shared";
import { Studio } from "./Studio";

type GearSpec = { teeth: number; r: number; pos: [number, number, number]; mat: THREE.Material; dir: 1 | -1 };

const brass = new THREE.MeshStandardMaterial({ color: "#b08d57", metalness: 0.95, roughness: 0.3 });
const bronze = new THREE.MeshStandardMaterial({ color: "#5d6b78", metalness: 0.9, roughness: 0.38 });

/** Meshing gear ratios: angular speed scales with 1/teeth so the teeth stay in mesh. */
const GEARS: GearSpec[] = [
  { teeth: 24, r: 2.0, pos: [0, 0, 0], mat: brass, dir: 1 },
  { teeth: 12, r: 1.05, pos: [2.95, 0.35, 0.05], mat: MAT.brushedSteel, dir: -1 },
  { teeth: 16, r: 1.38, pos: [-2.55, -1.75, -0.05], mat: bronze, dir: -1 },
  { teeth: 10, r: 0.88, pos: [3.35, -1.95, 0.1], mat: brass, dir: 1 },
  { teeth: 18, r: 1.55, pos: [-1.2, 2.95, -0.1], mat: MAT.brushedSteel, dir: -1 },
];

function Gear({ spec, speed }: { spec: GearSpec; speed: React.RefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => gearGeometry(spec.teeth, spec.r, 0.38), [spec.teeth, spec.r]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += (spec.dir * dt * (speed.current ?? 0.3) * 24) / spec.teeth;
  });
  return (
    <group position={spec.pos}>
      <mesh ref={ref} geometry={geo} material={spec.mat} castShadow receiveShadow />
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={MAT.steel}>
        <cylinderGeometry args={[spec.r * 0.2, spec.r * 0.2, 0.5, 24]} />
      </mesh>
    </group>
  );
}

function Rig() {
  const group = useRef<THREE.Group>(null);
  const speed = useRef(0.3);
  const reduced = prefersReducedMotion();
  useFrame(({ pointer }, dt) => {
    // Scrolling speeds the train up briefly; the cursor tilts it slightly.
    const target = reduced ? 0 : 0.3 + Math.min(Math.abs(scrollState.velocity) * 0.08, 2.5);
    speed.current = THREE.MathUtils.damp(speed.current, target, 3, dt);
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.3 + pointer.y * 0.12, 3, dt);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, 0.35 + pointer.x * 0.18, 3, dt);
    }
  });
  return (
    <group ref={group}>
      {GEARS.map((g, i) => (
        <Gear key={i} spec={g} speed={speed} />
      ))}
    </group>
  );
}

/** Interlocking brass and steel gear train; turns faster while the page scrolls. */
export default function GearTrain({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(box, "0px");
  return (
    <div ref={box} className={className} aria-hidden>
      <Canvas camera={{ position: [0, 0, 11], fov: 42 }} dpr={[1, 1.5]} frameloop={onScreen ? "always" : "never"} gl={{ antialias: true, alpha: true }}>
        <Studio shadows={false} />
        <Rig />
      </Canvas>
    </div>
  );
}
