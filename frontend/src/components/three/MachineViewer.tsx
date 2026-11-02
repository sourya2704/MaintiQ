import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { MachineMesh, type MachineVisual } from "./MachineModel";
import { COLORS, prefersReducedMotion, scrollState } from "./shared";

function ScrollSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = prefersReducedMotion();
  useFrame((_, dt) => {
    if (!ref.current || reduced) return;
    // Scrolling the page turns the machine on its plinth.
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, -0.6 + scrollState.y * 0.004, 4, dt);
  });
  return <group ref={ref}>{children}</group>;
}

/** Interactive single-machine model: drag to orbit, scroll the page to turn it. */
export default function MachineViewer({ className = "", ...visual }: MachineVisual & { className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [4.8, 2.9, 5.8], fov: 40 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 5]} intensity={2.4} />
        <pointLight position={[-4, 2, -3]} intensity={40} color={COLORS.plasma} />
        <pointLight position={[3, 1, 4]} intensity={30} color={COLORS.ember} />
        <ScrollSpin>
          <MachineMesh {...visual} />
        </ScrollSpin>
        <ContactShadows position={[0, -0.82, 0]} opacity={0.5} scale={6} blur={2.4} far={2} />
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.5} maxPolarAngle={1.45} autoRotate={!prefersReducedMotion()} autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
