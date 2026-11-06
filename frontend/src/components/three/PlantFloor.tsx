import { Billboard, Grid, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FLOOR, MachineMesh, type MachineKind } from "./MachineModel";
import { MAT, statusColor, useOnScreen } from "./shared";
import { Studio } from "./Studio";
import { useTheme } from "../../lib/theme";

export interface FloorMachine {
  id: string;
  asset_code: string;
  name: string;
  kind: MachineKind;
  status: string;
  symptoms: string[];
  openIncidents: number;
}

const STATION_SCALE = 0.8;
const GROUND = FLOOR * STATION_SCALE;

/** Asset tag drawn to a canvas texture, so it lives in the scene (no DOM overlay). */
function Label({ code, sub, color, hover }: { code: string; sub: string; color: string; hover: boolean }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 104;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1c232b";
    g.beginPath();
    g.roundRect(0, 0, 256, 104, 14);
    g.fill();
    g.fillStyle = color;
    g.fillRect(0, 0, 12, 104);
    g.textAlign = "left";
    g.fillStyle = "#f2f4f6";
    g.font = "600 42px 'IBM Plex Mono', monospace";
    g.fillText(code, 30, 50);
    g.fillStyle = "#9cc0e4";
    g.font = "26px 'IBM Plex Mono', monospace";
    g.fillText(sub, 30, 86);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [code, sub, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const s = hover ? 1.12 : 1;
  return (
    <Billboard position={[0, 1.55, 0]}>
      <mesh scale={[1.5 * s, 0.61 * s, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Station({ m, position, onSelect }: { m: FloorMachine; position: [number, number, number]; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const turn = useRef<THREE.Group>(null);
  useCursor(hover);
  useFrame((_, dt) => {
    if (turn.current) turn.current.rotation.y = THREE.MathUtils.damp(turn.current.rotation.y, hover ? 0.25 : 0, 4, dt);
  });
  return (
    <group position={position}>
      <group
        ref={turn}
        scale={STATION_SCALE}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(m.id);
        }}
      >
        <MachineMesh kind={m.kind} status={m.status} symptoms={m.symptoms} highlight={hover} />
        <mesh visible={false}>
          <boxGeometry args={[3.2, 2, 2]} />
        </mesh>
      </group>
      <Label code={m.asset_code} sub={m.openIncidents > 0 ? `${m.openIncidents} open` : "no open faults"} color={statusColor(m.status)} hover={hover} />
    </group>
  );
}

function CameraRig({ anchor, extent }: { anchor: React.RefObject<HTMLDivElement | null>; extent: number }) {
  useFrame(({ camera, pointer }, dt) => {
    // Scrolling through the section lowers the camera from an overview to floor level.
    let p = 0.5;
    const el = anchor.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      p = THREE.MathUtils.clamp(-(r.top - 56) / travel, 0, 1);
      p = p * p * (3 - 2 * p);
    }
    const height = THREE.MathUtils.lerp(extent * 1.1 + 5, 2.6, p);
    const dist = THREE.MathUtils.lerp(extent * 0.55 + 4, extent * 0.85 + 5.5, p);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 1.5, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, height + pointer.y * 0.6, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, dist, 3, dt);
    camera.lookAt(0, -0.2, 0);
  });
  return null;
}

/** Live 3D plant floor: every machine as a model, marked by status and animated by its open symptoms. */
export default function PlantFloor({
  machines,
  onSelect,
  className = "",
  trackRef,
}: {
  machines: FloorMachine[];
  onSelect: (id: string) => void;
  className?: string;
  /** Element whose scroll position drives the camera (a tall wrapper around a sticky canvas). */
  trackRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(machines.length))));
  const spacing = 3.8;
  const rows = Math.ceil(machines.length / cols);
  const layout = useMemo(
    () =>
      machines.map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return [(col - (cols - 1) / 2) * spacing, 0, (row - (rows - 1) / 2) * spacing] as [number, number, number];
      }),
    [machines, cols, rows],
  );
  const extent = Math.max(cols, rows) * spacing * 0.5;
  const dark = useTheme().theme === "dark";
  const onScreen = useOnScreen(anchor);
  const bg = dark ? "#121920" : "#e6eaee";
  useEffect(() => {
    MAT.concrete.color.set(dark ? "#3b434c" : "#c7ccd1");
  }, [dark]);

  return (
    <div ref={anchor} className={className}>
      <Canvas camera={{ position: [0, 10, 12], fov: 42 }} dpr={[1, 1.5]} shadows frameloop={onScreen ? "always" : "never"} gl={{ antialias: true }}>
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 16, 40]} />
        <Studio shadowExtent={extent + 4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND - 0.002, 0]} material={MAT.concrete} receiveShadow>
          <planeGeometry args={[80, 80]} />
        </mesh>
        <Grid
          position={[0, GROUND - 0.001, 0]}
          infiniteGrid
          cellSize={1}
          cellThickness={0.5}
          cellColor={dark ? "#26303a" : "#c3cad1"}
          sectionSize={spacing}
          sectionThickness={0.9}
          sectionColor={dark ? "#3a4654" : "#a5afb9"}
          fadeDistance={34}
          fadeStrength={1.5}
        />
        {machines.map((m, i) => (
          <Station key={m.id} m={m} position={layout[i]} onSelect={onSelect} />
        ))}
        <CameraRig anchor={trackRef ?? anchor} extent={extent} />
      </Canvas>
    </div>
  );
}
