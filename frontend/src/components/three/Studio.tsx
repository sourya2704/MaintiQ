import { Environment, Lightformer } from "@react-three/drei";

/**
 * Neutral plant lighting: soft sky/ground fill, one shadow-casting key light,
 * and a procedural reflection environment (no HDR download) so metal reads as metal.
 *
 * `night` keeps the same lights (so no shader has to be rebuilt when the theme changes)
 * but turns them into warm high-bay light from above and a cool, dim moon fill.
 */
export function Studio({
  shadows = true,
  shadowExtent = 8,
  shadowMap = 2048,
  night = false,
}: {
  shadows?: boolean;
  shadowExtent?: number;
  shadowMap?: number;
  night?: boolean;
}) {
  return (
    <>
      <hemisphereLight args={night ? ["#5a6a8c", "#14181f", 0.45] : ["#f7f9fb", "#6f7b87", 0.7]} />
      <directionalLight
        position={night ? [2, 10, 3] : [5, 9, 6]}
        intensity={night ? 1.05 : 2.3}
        color={night ? "#ffdcae" : "#fbfcfd"}
        castShadow={shadows}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />
      <directionalLight position={[-6, 4, -4]} intensity={night ? 0.55 : 0.5} color={night ? "#8fa8d8" : "#e6edf3"} />
      {/* keyed on the theme so the reflections are rendered again when it changes */}
      <Environment key={night ? "night" : "day"} resolution={256} frames={1}>
        <Lightformer form="rect" intensity={night ? 1.6 : 2.2} color={night ? "#ffd9a8" : "#ffffff"} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={night ? 0.35 : 1.2} color={night ? "#6f86b8" : "#f2f5f8"} position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={night ? 0.25 : 0.8} color={night ? "#4d5f86" : "#e3e8ed"} position={[6, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={night ? 0.5 : 0.6} color={night ? "#ffb870" : "#b7c4d1"} position={[0, 1, -6]} scale={3} />
      </Environment>
    </>
  );
}
