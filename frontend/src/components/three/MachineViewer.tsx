import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { FLOOR, MachineMesh, type MachineVisual } from "./MachineModel";
import { prefersReducedMotion, scrollState } from "./shared";
import { Studio } from "./Studio";

function ScrollTurn({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = prefersReducedMotion();
  useFrame((_, dt) => {
    if (!ref.current || reduced) return;
    // Scrolling the page turns the machine on its spot.
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, -0.5 + scrollState.y * 0.003, 4, dt);
  });
  return <group ref={ref}>{children}</group>;
}

/** Interactive single-machine model: drag to orbit, scroll the page to turn it. */
export default function MachineViewer({ className = "", ...visual }: MachineVisual & { className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [3.6, 1.9, 4.2], fov: 38 }} dpr={[1, 2]} shadows gl={{ antialias: true }}>
        <color attach="background" args={["#ece4d6"]} />
        <Studio shadowExtent={4} />
        <ScrollTurn>
          <MachineMesh {...visual} />
        </ScrollTurn>
        <ContactShadows position={[0, FLOOR + 0.001, 0]} opacity={0.45} scale={7} blur={2.2} far={2} color="#3d2f22" />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          target={[0, -0.25, 0]}
          minPolarAngle={0.5}
          maxPolarAngle={1.4}
          autoRotate={!prefersReducedMotion()}
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
}
