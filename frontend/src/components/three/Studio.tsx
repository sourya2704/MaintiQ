import { Environment, Lightformer } from "@react-three/drei";

/**
 * Warm workshop lighting: soft sky/ground fill, one shadow-casting key light,
 * and a procedural reflection environment (no HDR download) so metal reads as metal.
 */
export function Studio({ shadows = true, shadowExtent = 8 }: { shadows?: boolean; shadowExtent?: number }) {
  return (
    <>
      <hemisphereLight args={["#fff6e8", "#8a7660", 0.7]} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.3}
        color="#fff1dc"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#f0e2cc" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff4e2" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffe9cc" position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#e8dcc8" position={[6, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={0.6} color="#c9b08a" position={[0, 1, -6]} scale={3} />
      </Environment>
    </>
  );
}
