import { Environment, Lightformer } from "@react-three/drei";

/**
 * Neutral plant lighting: soft sky/ground fill, one shadow-casting key light,
 * and a procedural reflection environment (no HDR download) so metal reads as metal.
 */
export function Studio({ shadows = true, shadowExtent = 8, shadowMap = 2048 }: { shadows?: boolean; shadowExtent?: number; shadowMap?: number }) {
  return (
    <>
      <hemisphereLight args={["#f7f9fb", "#6f7b87", 0.7]} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.3}
        color="#fbfcfd"
        castShadow={shadows}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#e6edf3" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#f2f5f8" position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#e3e8ed" position={[6, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={0.6} color="#b7c4d1" position={[0, 1, -6]} scale={3} />
      </Environment>
    </>
  );
}
