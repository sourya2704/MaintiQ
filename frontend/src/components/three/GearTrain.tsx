import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, gearGeometry, prefersReducedMotion, scrollState } from "./shared";

type GearSpec = { teeth: number; r: number; pos: [number, number, number]; color: string; dir: 1 | -1; emissive?: string };

/** Meshing gear ratios: angular speed scales with 1/teeth so the teeth stay in mesh. */
const GEARS: GearSpec[] = [
  { teeth: 24, r: 2.0, pos: [0, 0, 0], color: COLORS.steel, dir: 1, emissive: COLORS.ember },
  { teeth: 12, r: 1.05, pos: [2.95, 0.35, 0.05], color: COLORS.steelDark, dir: -1, emissive: COLORS.plasma },
  { teeth: 16, r: 1.38, pos: [-2.55, -1.75, -0.05], color: COLORS.steelDark, dir: -1 },
  { teeth: 10, r: 0.88, pos: [3.35, -1.95, 0.1], color: COLORS.steel, dir: 1, emissive: COLORS.ember },
  { teeth: 18, r: 1.55, pos: [-1.2, 2.95, -0.1], color: COLORS.steel, dir: -1 },
];

function Gear({ spec, speedRef }: { spec: GearSpec; speedRef: React.RefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => gearGeometry(spec.teeth, spec.r, 0.38), [spec.teeth, spec.r]);
  const hovered = useRef(false);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const boost = hovered.current ? 3 : 1;
    ref.current.rotation.z += (spec.dir * dt * (speedRef.current ?? 0.4) * boost * 24) / spec.teeth;
  });
  return (
    <mesh
      ref={ref}
      geometry={geo}
      position={spec.pos}
      castShadow
      onPointerOver={() => (hovered.current = true)}
      onPointerOut={() => (hovered.current = false)}
    >
      <meshStandardMaterial
        color={spec.color}
        metalness={0.85}
        roughness={0.32}
        emissive={spec.emissive ?? "#000000"}
        emissiveIntensity={spec.emissive ? 0.18 : 0}
      />
    </mesh>
  );
}

function Rig({ intensity }: { intensity: number }) {
  const group = useRef<THREE.Group>(null);
  const speed = useRef(0.4);
  const reduced = prefersReducedMotion();
  useFrame(({ pointer }, dt) => {
    // Scroll velocity spins the train faster; scroll position tilts it.
    const target = reduced ? 0 : 0.35 + Math.min(Math.abs(scrollState.velocity) * 0.12, 4);
    speed.current = THREE.MathUtils.damp(speed.current, target, 4, dt);
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.35 + pointer.y * 0.25 * intensity + scrollState.progress * 0.6, 3, dt);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, 0.45 + pointer.x * 0.35 * intensity, 3, dt);
    }
  });
  return (
    <group ref={group}>
      <Float speed={reduced ? 0 : 1.4} rotationIntensity={0.15} floatIntensity={0.4}>
        {GEARS.map((g, i) => (
          <Gear key={i} spec={g} speedRef={speed} />
        ))}
        {/* glowing axle pins */}
        {GEARS.map((g, i) => (
          <mesh key={`pin-${i}`} position={[g.pos[0], g.pos[1], g.pos[2] + 0.22]}>
            <cylinderGeometry args={[g.r * 0.2, g.r * 0.2, 0.5, 24]} />
            <meshStandardMaterial color={COLORS.graphite} emissive={i % 2 ? COLORS.plasma : COLORS.ember} emissiveIntensity={0.9} />
          </mesh>
        ))}
      </Float>
    </group>
  );
}

/** Interlocking 3D gear train. Spins with scroll velocity, tilts toward the cursor; hover a gear to rev it. */
export default function GearTrain({ className = "", intensity = 1 }: { className?: string; intensity?: number }) {
  return (
    <div className={className} aria-hidden>
      <Canvas camera={{ position: [0, 0, 11], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 8]} intensity={2.2} color="#dbe7ff" />
        <pointLight position={[-6, -3, 4]} intensity={40} color={COLORS.ember} />
        <pointLight position={[6, 3, 3]} intensity={30} color={COLORS.plasma} />
        <Rig intensity={intensity} />
      </Canvas>
    </div>
  );
}
