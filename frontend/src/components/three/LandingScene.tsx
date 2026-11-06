import { Instance, Instances, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { MachineMesh, type MachineKind } from "./MachineModel";
import { FLOOR, M } from "./parts";
import { prefersReducedMotion } from "./shared";
import { Studio } from "./Studio";
import { blobShadowTexture, cloudTexture, corrugatedTexture, signTexture, slabTexture } from "./textures";

/*
 * The public website's 3D: a portal-frame warehouse holding every modelled machine.
 * Visitors arrive above the clouds, the clouds part, the camera drops to the gate,
 * the roller shutter rolls up and we walk in; after that, scrolling moves along the aisle.
 *
 * Kept fast on phones by: instancing repeated structure (columns, trusses, lights, racks)
 * so each set is one draw call; hiding machines far from the camera; soft blob shadows
 * instead of real-time shadow maps; and lowering resolution when the frame rate drops.
 */

const GATE_X = -4; // front wall
const END_X = 66; // back wall
const HALF_W = 10; // walls at z = ±10
const EAVES = 8;
const RIDGE = 10.5;
const Y0 = FLOOR; // slab level

// Two rows facing the centre aisle, grouped the way a plant is laid out.
const LEFT: MachineKind[] = ["motor", "pump", "conveyor", "gearbox", "fan", "vmc", "mill", "lathe", "drill", "grinder", "saw", "robot", "transformer", "panel", "generator"];
const RIGHT: MachineKind[] = ["compressor", "screwcomp", "elevator", "mixer", "exchanger", "moulder", "extruder", "press", "packer", "crane", "chiller", "tower", "boiler", "dust", "forklift"];
const SYMPTOMS: Partial<Record<MachineKind, string[]>> = { motor: ["vibration"], pump: ["leak"], compressor: ["overheating"], panel: [] };
const SPACING = 4.2;
const START = 4;

const MACHINES = [
  ...LEFT.map((kind, i) => ({ kind, x: START + i * SPACING, z: -5, rotY: 0 })),
  ...RIGHT.map((kind, i) => ({ kind, x: START + i * SPACING, z: 5, rotY: Math.PI })),
];

type Key = { pos: THREE.Vector3Tuple; look: THREE.Vector3Tuple };

/** Camera stops for the page sections, inside the hall. */
export const STOPS: Key[] = [
  { pos: [0.5, 2.4, 0], look: [14, 0.4, 0] }, // entrance, looking down the aisle
  { pos: [8.5, 2.1, 1.6], look: [11.5, 0.1, -5] }, // drives, pumps, conveyors
  { pos: [18.5, 2.1, -1.6], look: [21.5, 0.2, 5] }, // mixing and process
  { pos: [29.5, 2.3, 1.6], look: [32.5, 0.3, -5] }, // machine shop
  { pos: [44, 2.6, -1.6], look: [48, 0.8, 5] }, // utilities: chiller, tower, boiler
  { pos: [53, 4.5, 0], look: [62, 0.5, 0] }, // the far end
  { pos: [62, 7.5, 6.5], look: [28, -0.5, 0] }, // looking back over the whole hall
];

// Arrival: above the clouds, down to the gate, inside to the first stop.
const INTRO: Key[] = [
  { pos: [-48, 30, 16], look: [-4, 6, 0] },
  { pos: [-34, 12, 8], look: [-4, 4, 0] },
  { pos: [-16, 3.2, 0], look: [-4, 2.8, 0] },
  { pos: [-9, 2.6, 0], look: [0, 2.2, 0] },
  STOPS[0],
];
const INTRO_SECONDS = 7;
const GATE_OPEN = [0.5, 0.72]; // part of the intro during which the shutter rolls up

const smooth = (f: number) => f * f * (3 - 2 * f);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function samplePath(keys: Key[], t: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const p = clamp01(t) * (keys.length - 1);
  const i = Math.min(Math.floor(p), keys.length - 2);
  const f = smooth(p - i);
  pos.set(...keys[i].pos).lerp(new THREE.Vector3(...keys[i + 1].pos), f);
  look.set(...keys[i].look).lerp(new THREE.Vector3(...keys[i + 1].look), f);
}

export interface SceneState {
  progress: { current: number }; // page section, fractional while scrolling
  intro: { current: number }; // 0..1 arrival sequence; 1 when done or skipped
}

function Rig({ state, onIntroDone }: { state: SceneState; onIntroDone: () => void }) {
  const { camera } = useThree();
  const reduced = prefersReducedMotion();
  const look = useRef(new THREE.Vector3(...INTRO[0].look));
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const done = useRef(false);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    if (state.intro.current < 1) {
      // real elapsed time, so slow devices skip frames instead of slowing the arrival down
      state.intro.current = reduced ? 1 : Math.min(1, state.intro.current + Math.min(dt, 0.25) / INTRO_SECONDS);
      samplePath(INTRO, state.intro.current, pos, tgt);
      camera.position.copy(pos);
      look.current.copy(tgt);
    } else {
      if (!done.current) {
        done.current = true;
        onIntroDone();
      }
      samplePath(STOPS, state.progress.current / (STOPS.length - 1), pos, tgt);
      const k = reduced ? 1 : 1 - Math.exp(-step * 3);
      camera.position.lerp(pos, k);
      look.current.lerp(tgt, k);
    }
    camera.lookAt(look.current);
  });
  return null;
}

// ------------------------------------------------------------------ outside: sky, clouds, yard

function Clouds({ intro }: { intro: { current: number } }) {
  const tex = cloudTexture();
  const puffs = useMemo(() => {
    const rnd = (i: number) => (Math.sin(i * 91.7) * 43758.5453) % 1;
    return Array.from({ length: 18 }, (_, i) => ({
      x: -46 + Math.abs(rnd(i)) * 34,
      y: 17 + Math.abs(rnd(i + 7)) * 9,
      z: (rnd(i + 3) * 2 - 0.0) * 18,
      s: 10 + Math.abs(rnd(i + 11)) * 10,
    }));
  }, []);
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(() => puffs.map(() => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 })), [puffs, tex]);
  useFrame(() => {
    const t = intro.current;
    const part = smooth(clamp01((t - 0.08) / 0.45)); // clouds slide apart early in the arrival
    if (group.current) {
      group.current.visible = t < 0.75;
      group.current.children.forEach((c, i) => {
        const p = puffs[i];
        c.position.set(p.x + part * 10, p.y + part * 4, p.z + Math.sign(p.z || 1) * part * 30);
      });
    }
    mats.forEach((m) => (m.opacity = 0.95 * (1 - smooth(clamp01((t - 0.3) / 0.35)))));
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} material={mats[i]} scale={[p.s * 1.6, p.s, 1]} position={[p.x, p.y, p.z]} />
      ))}
    </group>
  );
}

function Yard() {
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d7378", roughness: 0.95 }), []);
  const grass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7d8f6a", roughness: 1 }), []);
  const line = useMemo(() => new THREE.MeshBasicMaterial({ color: "#e8e3d0" }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, Y0 - 0.02, 0]} material={grass}>
        <planeGeometry args={[320, 320]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, Y0 - 0.01, 0]} material={asphalt}>
        <planeGeometry args={[36, 34]} />
      </mesh>
      {/* loading-bay road markings leading to the gate */}
      {[-3.5, 3.5].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[-16, Y0 - 0.005, z]} material={line}>
          <planeGeometry args={[24, 0.18]} />
        </mesh>
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-28 + i * 4, Y0 - 0.005, 0]} material={line}>
          <planeGeometry args={[1.8, 0.14]} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ the building

function Shell({ intro }: { intro: { current: number } }) {
  const m = M();
  const wall = useMemo(() => {
    const tex = corrugatedTexture("#8796a3").clone();
    tex.needsUpdate = true;
    tex.repeat.set(24, 2);
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide });
  }, []);
  const endWall = useMemo(() => {
    const tex = corrugatedTexture("#8796a3").clone();
    tex.needsUpdate = true;
    tex.repeat.set(7, 2);
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide });
  }, []);
  const roof = useMemo(() => {
    const tex = corrugatedTexture("#a9b2ba").clone();
    tex.needsUpdate = true;
    tex.repeat.set(30, 3);
    tex.rotation = Math.PI / 2;
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  }, []);
  const shutterMat = useMemo(() => {
    const tex = corrugatedTexture("#c7ccd0", true).clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 6);
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  }, []);
  const slab = useMemo(() => new THREE.MeshStandardMaterial({ map: slabTexture(), roughness: 0.55, metalness: 0.05 }), []);
  const sign = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture("MANTIQ", "Maintenance memory") }), []);
  const yellow = useMemo(() => new THREE.MeshBasicMaterial({ color: "#d9a21b" }), []);
  const shutter = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const open = smooth(clamp01((intro.current - GATE_OPEN[0]) / (GATE_OPEN[1] - GATE_OPEN[0])));
    if (shutter.current) {
      shutter.current.position.y = Y0 + 3 + open * 5.6;
      shutter.current.scale.y = 1 - open * 0.92;
    }
  });

  const len = END_X - GATE_X;
  const midX = (GATE_X + END_X) / 2;
  const pitch = Math.atan2(RIDGE - EAVES, HALF_W);
  const rafter = Math.hypot(HALF_W, RIDGE - EAVES);
  const gateW = 9;
  const gateH = 6;
  return (
    <group>
      {/* slab and aisle markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[midX, Y0, 0]} material={slab}>
        <planeGeometry args={[len, HALF_W * 2]} />
      </mesh>
      {[-2.3, 2.3].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[midX, Y0 + 0.004, z]} material={yellow}>
          <planeGeometry args={[len - 2, 0.12]} />
        </mesh>
      ))}
      {/* long walls, back wall, front wall around the gate opening */}
      {[-HALF_W, HALF_W].map((z) => (
        <mesh key={z} position={[midX, Y0 + EAVES / 2, z]} material={wall}>
          <boxGeometry args={[len, EAVES, 0.12]} />
        </mesh>
      ))}
      <mesh position={[END_X, Y0 + EAVES / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={endWall}>
        <boxGeometry args={[HALF_W * 2, EAVES, 0.12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[GATE_X, Y0 + EAVES / 2, s * (gateW / 2 + (HALF_W - gateW / 2) / 2)]} rotation={[0, Math.PI / 2, 0]} material={endWall}>
          <boxGeometry args={[HALF_W - gateW / 2, EAVES, 0.12]} />
        </mesh>
      ))}
      <mesh position={[GATE_X, Y0 + gateH + (EAVES - gateH) / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={endWall}>
        <boxGeometry args={[gateW, EAVES - gateH, 0.12]} />
      </mesh>
      {/* gable triangles */}
      {[GATE_X, END_X].map((x) => (
        <mesh key={x} position={[x, Y0 + EAVES, 0]} rotation={[0, Math.PI / 2, 0]} material={endWall}>
          <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-HALF_W, 0), new THREE.Vector2(HALF_W, 0), new THREE.Vector2(0, RIDGE - EAVES)])]} />
        </mesh>
      ))}
      {/* pitched roof */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[midX, Y0 + (EAVES + RIDGE) / 2, (s * HALF_W) / 2]} rotation={[s * pitch, 0, 0]} material={roof}>
          <boxGeometry args={[len + 0.6, 0.1, rafter + 0.4]} />
        </mesh>
      ))}
      {/* roller shutter, its drum box and guide rails; facade sign and canopy */}
      <mesh ref={shutter} position={[GATE_X - 0.1, Y0 + gateH / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={shutterMat}>
        <planeGeometry args={[gateW, gateH]} />
      </mesh>
      <mesh position={[GATE_X - 0.35, Y0 + gateH + 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.darkSteel}>
        <cylinderGeometry args={[0.4, 0.4, gateW + 0.3, 20]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[GATE_X - 0.15, Y0 + gateH / 2, s * (gateW / 2 + 0.08)]} material={m.forkYellow}>
          <boxGeometry args={[0.2, gateH, 0.16]} />
        </mesh>
      ))}
      <mesh position={[GATE_X - 0.08, Y0 + gateH + 1.15, 0]} rotation={[0, -Math.PI / 2, 0]} material={sign}>
        <planeGeometry args={[7.2, 1.8]} />
      </mesh>
      <mesh position={[GATE_X - 1.2, Y0 + gateH + 0.05, 0]} material={m.toolGrey}>
        <boxGeometry args={[2.4, 0.1, gateW + 1]} />
      </mesh>
      {/* bollards either side of the gate */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[GATE_X - 1.5, Y0 + 0.6, s * (gateW / 2 + 0.6)]} material={m.forkYellow}>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** Portal frames, purlins, high-bay lights and pallet racking: drawn as instances. */
function Structure() {
  const m = M();
  const bays = useMemo(() => {
    const out: number[] = [];
    for (let x = GATE_X + 7; x < END_X; x += 7) out.push(x);
    return out;
  }, []);
  const lensMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#fff7e6"), emissiveIntensity: 1.6 }), []);
  const pitch = Math.atan2(RIDGE - EAVES, HALF_W);
  const rafter = Math.hypot(HALF_W, RIDGE - EAVES);
  return (
    <group>
      <Instances limit={64} material={m.toolGrey}>
        <boxGeometry args={[0.35, 1, 0.3]} />
        {bays.flatMap((x) => [-HALF_W + 0.25, HALF_W - 0.25].map((z) => <Instance key={`c${x}${z}`} position={[x, Y0 + EAVES / 2, z]} scale={[1, EAVES, 1]} />))}
      </Instances>
      <Instances limit={64} material={m.toolGrey}>
        <boxGeometry args={[0.25, 0.4, 1]} />
        {bays.flatMap((x) => [-1, 1].map((s) => <Instance key={`r${x}${s}`} position={[x, Y0 + (EAVES + RIDGE) / 2 - 0.35, (s * HALF_W) / 2]} rotation={[s * pitch, 0, 0]} scale={[1, 1, rafter]} />))}
      </Instances>
      <Instances limit={32} material={m.darkSteel}>
        <boxGeometry args={[1, 0.12, 0.12]} />
        {[-7, -3.5, 0, 3.5, 7].map((z) => (
          <Instance key={`p${z}`} position={[(GATE_X + END_X) / 2, Y0 + EAVES + ((HALF_W - Math.abs(z)) / HALF_W) * (RIDGE - EAVES) - 0.5, z]} scale={[END_X - GATE_X, 1, 1]} />
        ))}
      </Instances>
      {/* high-bay lights on drop rods over the aisle and both rows */}
      <Instances limit={64} material={m.darkSteel}>
        <cylinderGeometry args={[0.3, 0.5, 0.3, 16, 1, true]} />
        {bays.flatMap((x) => [-5, 0, 5].map((z) => <Instance key={`h${x}${z}`} position={[x + 3.5, Y0 + EAVES - 1.2, z]} />))}
      </Instances>
      <Instances limit={64} material={lensMat}>
        <cylinderGeometry args={[0.46, 0.46, 0.02, 16]} />
        {bays.flatMap((x) => [-5, 0, 5].map((z) => <Instance key={`l${x}${z}`} position={[x + 3.5, Y0 + EAVES - 1.36, z]} />))}
      </Instances>
      {/* pallet racking along the back wall */}
      <Instances limit={64} material={m.safetyOrange}>
        <boxGeometry args={[0.1, 5, 0.1]} />
        {[-8, -4, 0, 4, 8].flatMap((z) => [END_X - 1.2, END_X - 2.4].map((x) => <Instance key={`u${x}${z}`} position={[x, Y0 + 2.5, z]} />))}
      </Instances>
      <Instances limit={64} material={m.motorBlue}>
        <boxGeometry args={[1.3, 0.12, 4]} />
        {[-6, -2, 2, 6].flatMap((z) => [1.2, 2.6, 4.0].map((y) => <Instance key={`b${y}${z}`} position={[END_X - 1.8, Y0 + y, z]} />))}
      </Instances>
      <Instances limit={64} material={m.cardboard}>
        <boxGeometry args={[1.1, 0.9, 1.1]} />
        {[-6, -2, 2, 6].flatMap((z) => [1.2, 2.6, 4.0].flatMap((y) => [-1.3, 0, 1.3].map((dz) => <Instance key={`k${y}${z}${dz}`} position={[END_X - 1.8, Y0 + y + 0.52, z + dz]} />)))}
      </Instances>
    </group>
  );
}

/** Hides a machine when the camera is outside or far along the aisle. */
function Near({ x, radius, children }: { x: number; radius: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.x > GATE_X - 6 && Math.abs(camera.position.x - x) < radius;
  });
  return <group ref={ref}>{children}</group>;
}

function Floor({ small }: { small: boolean }) {
  const blob = useMemo(() => new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }), []);
  return (
    <>
      {MACHINES.map((mc) => (
        <Near key={mc.kind} x={mc.x} radius={small ? 16 : 26}>
          <group position={[mc.x, 0, mc.z]} rotation={[0, mc.rotY, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y0 + 0.006, 0]} material={blob}>
              <planeGeometry args={[3.6, 2.6]} />
            </mesh>
            <MachineMesh kind={mc.kind} status="operational" symptoms={SYMPTOMS[mc.kind] ?? []} />
          </group>
        </Near>
      ))}
    </>
  );
}

export default function LandingScene({ state, onIntroDone, className = "" }: { state: SceneState; onIntroDone: () => void; className?: string }) {
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  const maxDpr = small ? 1.25 : 1.5;
  const [dpr, setDpr] = useState(maxDpr);
  return (
    <div className={className} aria-hidden>
      <Canvas camera={{ position: INTRO[0].pos, fov: small ? 62 : 48, near: 0.1, far: 260 }} dpr={dpr} gl={{ antialias: !small, powerPreference: "high-performance" }}>
        {/* drop resolution when frames slow down, raise it again when there is headroom */}
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} onFallback={() => setDpr(1)} />
        <color attach="background" args={["#cfdbe6"]} />
        <fog attach="fog" args={["#cfdbe6", 40, 150]} />
        {/* studio lights plus a reflection environment rendered once, so metal reads as metal; no shadow maps */}
        <Studio shadows={false} />
        <hemisphereLight args={["#f4f8fb", "#7f8a93", 0.5]} />
        <Clouds intro={state.intro} />
        <Yard />
        <Shell intro={state.intro} />
        <Structure />
        <Floor small={small} />
        <Rig state={state} onIntroDone={onIntroDone} />
      </Canvas>
    </div>
  );
}
