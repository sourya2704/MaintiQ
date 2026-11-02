import { Billboard, Grid, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MachineMesh, type MachineKind } from "./MachineModel";
import { COLORS, statusColor } from "./shared";

export interface FloorMachine {
  id: string;
  asset_code: string;
  name: string;
  kind: MachineKind;
  status: string;
  symptoms: string[];
  openIncidents: number;
}

/** Label drawn to a canvas texture: lives in the 3D scene, no DOM overlay. */
function Label({ code, sub, color, hover }: { code: string; sub: string; color: string; hover: boolean }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 112;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(5,8,15,0.82)";
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(4, 4, 248, 104, 16);
    g.fill();
    g.stroke();
    g.textAlign = "center";
    g.fillStyle = color;
    g.font = "bold 40px 'JetBrains Mono', monospace";
    g.fillText(code, 128, 52);
    g.fillStyle = "#9aa8c4";
    g.font = "26px 'JetBrains Mono', monospace";
    g.fillText(sub, 128, 90);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [code, sub, color]);
  const s = hover ? 1.15 : 1;
  return (
    <Billboard position={[0, 1.7, 0]}>
      <mesh scale={[1.6 * s, 0.7 * s, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Station({
  m,
  position,
  onSelect,
}: {
  m: FloorMachine;
  position: [number, number, number];
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const lift = useRef<THREE.Group>(null);
  useCursor(hover);
  useFrame((_, dt) => {
    if (lift.current) {
      lift.current.position.y = THREE.MathUtils.damp(lift.current.position.y, hover ? 0.35 : 0, 6, dt);
      lift.current.rotation.y = THREE.MathUtils.damp(lift.current.rotation.y, hover ? 0.5 : 0, 4, dt);
    }
  });
  const color = statusColor(m.status);
  return (
    <group position={position}>
      <group ref={lift}>
        <group
          scale={0.8}
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
          {/* generous invisible hit box */}
          <mesh visible={false} position={[0, 0.1, 0]}>
            <boxGeometry args={[3, 2.2, 2]} />
          </mesh>
        </group>
      </group>
      <Label code={m.asset_code} sub={m.openIncidents > 0 ? `${m.openIncidents} open` : "clear"} color={color} hover={hover} />
    </group>
  );
}

function CameraRig({ anchor, extent }: { anchor: React.RefObject<HTMLDivElement | null>; extent: number }) {
  useFrame(({ camera, pointer }, dt) => {
    // Scroll through the section to fly from a high overview down to floor level.
    let p = 0.5;
    const el = anchor.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      p = THREE.MathUtils.clamp(-(r.top - 56) / travel, 0, 1);
      p = p * p * (3 - 2 * p); // ease in-out
    }
    const height = THREE.MathUtils.lerp(extent * 1.25 + 6, 3.2, p);
    const dist = THREE.MathUtils.lerp(extent * 0.6 + 4, extent * 0.9 + 6, p);
    const tx = pointer.x * 2.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, height + pointer.y * 1.2, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, dist, 3, dt);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Live 3D plant floor: every machine as a model coloured by status, animated by its open symptoms. */
export default function PlantFloor({
  machines,
  onSelect,
  className = "",
  trackRef,
}: {
  machines: FloorMachine[];
  onSelect: (id: string) => void;
  className?: string;
  /** Element whose scroll position drives the camera (e.g. a tall wrapper around a sticky canvas). */
  trackRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(machines.length))));
  const spacing = 4.2;
  const layout = useMemo(
    () =>
      machines.map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rows = Math.ceil(machines.length / cols);
        return [(col - (cols - 1) / 2) * spacing, 0, (row - (rows - 1) / 2) * spacing] as [number, number, number];
      }),
    [machines, cols],
  );
  const extent = Math.max(cols, Math.ceil(machines.length / cols)) * spacing * 0.5;

  return (
    <div ref={anchor} className={className}>
      <Canvas camera={{ position: [0, 12, 14], fov: 45 }} dpr={[1, 1.75]} shadows gl={{ antialias: true, alpha: true }}>
        <fog attach="fog" args={["#05080f", 14, 42]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[6, 12, 6]} intensity={2.4} castShadow />
        <pointLight position={[-8, 4, -6]} intensity={60} color={COLORS.plasma} />
        <pointLight position={[8, 3, 6]} intensity={50} color={COLORS.ember} />
        <Grid
          position={[0, -0.66, 0]}
          infiniteGrid
          cellSize={0.6}
          cellThickness={0.6}
          cellColor="#1f2b48"
          sectionSize={4.2}
          sectionThickness={1.2}
          sectionColor="#2f4170"
          fadeDistance={38}
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
