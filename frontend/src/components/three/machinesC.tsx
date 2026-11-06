import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { ModelProps } from "./machinesA";
import { MotorUnit } from "./machinesA";
import { BoltRing, Box, Cyl, FLOOR, Gauge, Handwheel, M, Nameplate, Pipe, Spin, Torus, Turned, useHeat, Z_AXIS, type V3 } from "./parts";

// Machine shop and plastics: machining centre, mill, radial drill, surface grinder, band saw,
// injection moulding machine, extruder, industrial robot, forklift and jib crane.

/** Operator panel on an arm: screen, keypad, red mushroom stop. Faces +Z. */
function ControlPendant({ pos, rot = [0, 0, 0] }: { pos: V3; rot?: V3 }) {
  const m = M();
  return (
    <group position={pos} rotation={rot}>
      <Box size={[0.44, 0.56, 0.1]} pos={[0, 0, 0]} mat={m.toolGrey} />
      <Box size={[0.3, 0.2, 0.01]} pos={[0, 0.12, 0.055]} mat={m.screen} />
      {Array.from({ length: 12 }).map((_, i) => (
        <Box key={i} size={[0.05, 0.03, 0.012]} pos={[-0.12 + (i % 4) * 0.08, -0.06 - Math.floor(i / 4) * 0.05, 0.056]} mat={m.black} />
      ))}
      <Cyl r={0.035} len={0.03} pos={[0.16, -0.2, 0.06]} rot={Z_AXIS} mat={m.red} />
    </group>
  );
}

/** Slides back and forth while running (machine tables, saw frames). */
function Shuttle({ children, axis, travel, speed, running }: { children: React.ReactNode; axis: "x" | "y" | "z"; travel: number; speed: number; running: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const target = running ? Math.sin(clock.elapsedTime * speed) * travel : 0;
    ref.current.position[axis] = THREE.MathUtils.damp(ref.current.position[axis], target, 4, dt);
  });
  return <group ref={ref}>{children}</group>;
}

// ------------------------------------------------------------------ vertical machining centre (enclosed CNC mill)

export function MachiningCentre({ spin, hot, running }: ModelProps) {
  const m = M();
  const shell = useHeat(m.toolWhite, hot);
  return (
    <group>
      <Box size={[2.2, 0.2, 1.6]} pos={[0, FLOOR + 0.1, 0]} mat={m.toolGrey} />
      {/* enclosure: side panels, roof, sliding doors with windows */}
      <Box size={[0.06, 1.9, 1.5]} pos={[-1.05, FLOOR + 1.15, 0]} mat={shell} />
      <Box size={[0.06, 1.9, 1.5]} pos={[1.05, FLOOR + 1.15, 0]} mat={shell} />
      <Box size={[2.16, 0.06, 1.5]} pos={[0, FLOOR + 2.1, 0]} mat={shell} />
      <Box size={[2.16, 1.9, 0.06]} pos={[0, FLOOR + 1.15, -0.72]} mat={shell} />
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, FLOOR + 1.15, 0.76]}>
          <Box size={[1.0, 1.5, 0.04]} pos={[0, 0.05, 0]} mat={shell} />
          <Box size={[0.66, 0.6, 0.012]} pos={[0, 0.25, 0.022]} mat={m.darkGlass} />
          <Box size={[0.05, 0.3, 0.05]} pos={[x > 0 ? -0.42 : 0.42, 0, 0.05]} mat={m.steel} />
        </group>
      ))}
      <Box size={[2.16, 0.32, 0.06]} pos={[0, FLOOR + 0.36, 0.76]} mat={m.toolGrey} />
      {/* inside, seen through the windows: column, spindle head, table with vice */}
      <Box size={[0.5, 1.5, 0.4]} pos={[0, FLOOR + 1.05, -0.45]} mat={m.toolGrey} />
      <Box size={[0.36, 0.42, 0.4]} pos={[0, FLOOR + 1.45, -0.15]} mat={m.toolGrey} />
      <Spin speed={spin * 4} axis="y" pos={[0, FLOOR + 1.12, -0.05]}>
        <Cyl r={0.06} len={0.26} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.steel} />
        <Cyl r={0.02} len={0.16} pos={[0, -0.2, 0]} rot={[0, 0, 0]} mat={m.chrome} />
      </Spin>
      <Shuttle axis="x" travel={0.25} speed={0.7} running={running && spin > 0}>
        <Box size={[1.2, 0.08, 0.5]} pos={[0, FLOOR + 0.72, 0.05]} mat={m.steel} />
        <Box size={[0.24, 0.12, 0.16]} pos={[0, FLOOR + 0.82, 0.05]} mat={m.toolGrey} />
      </Shuttle>
      {/* tool magazine drum on the side, operator panel, signal tower */}
      <Cyl r={0.42} len={0.2} pos={[-1.2, FLOOR + 1.45, -0.2]} mat={m.toolGrey} />
      <ControlPendant pos={[1.25, FLOOR + 1.3, 0.55]} rot={[0, -0.6, 0]} />
      {[0, 1, 2].map((i) => (
        <Cyl key={i} r={0.04} len={0.07} pos={[0.95, FLOOR + 2.18 + i * 0.07, -0.6]} rot={[0, 0, 0]} mat={[m.red, m.amber, m.green][i]} />
      ))}
      <Nameplate pos={[-0.55, FLOOR + 0.36, 0.795]} lines={["VMC 850", "Travel 850x500x500", "Spindle 8000 rpm", "24 tools"]} w={0.28} />
      {/* chip conveyor out the back, coolant tank */}
      <Box size={[0.4, 0.3, 0.9]} pos={[0.6, FLOOR + 0.35, -1.1]} rot={[0.35, 0, 0]} mat={m.toolGrey} />
      <Box size={[0.7, 0.4, 0.5]} pos={[-0.6, FLOOR + 0.2, -1.05]} mat={m.darkPaint} />
    </group>
  );
}

// ------------------------------------------------------------------ knee-type milling machine

export function Mill({ spin, hot, running }: ModelProps) {
  const m = M();
  const body = useHeat(m.greenPaint, hot);
  return (
    <group>
      <Box size={[0.75, 0.12, 0.85]} pos={[0, FLOOR + 0.06, -0.1]} mat={body} />
      {/* column and overarm ram with head */}
      <Box size={[0.55, 1.35, 0.6]} pos={[0, FLOOR + 0.8, -0.35]} mat={body} />
      <Cyl r={0.3} len={0.2} pos={[0, FLOOR + 1.55, -0.35]} rot={[0, 0, 0]} mat={body} />
      <Box size={[0.24, 0.24, 0.85]} pos={[0, FLOOR + 1.65, -0.05]} mat={body} />
      <Box size={[0.3, 0.42, 0.3]} pos={[0, FLOOR + 1.55, 0.35]} mat={body} />
      <group position={[0, FLOOR + 1.98, 0.35]}>
        <MotorUnit r={0.11} len={0.3} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Spin speed={spin * 3} axis="y" pos={[0, FLOOR + 1.22, 0.35]}>
        <Cyl r={0.04} len={0.2} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.chrome} />
        <Cyl r={0.05} len={0.06} pos={[0, -0.13, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
      </Spin>
      <Handwheel pos={[0.2, FLOOR + 1.45, 0.35]} r={0.06} rot={[0, Math.PI / 2, 0]} mat={m.chrome} />
      {/* knee, saddle and table with T-slots and hand wheels */}
      <Box size={[0.5, 0.45, 0.5]} pos={[0, FLOOR + 0.55, 0.15]} mat={body} />
      <Cyl r={0.05} len={0.55} pos={[0, FLOOR + 0.28, 0.32]} rot={[0, 0, 0]} mat={m.chrome} />
      <Box size={[0.45, 0.1, 0.4]} pos={[0, FLOOR + 0.83, 0.25]} mat={body} />
      <Shuttle axis="x" travel={0.22} speed={0.5} running={running && spin > 0}>
        <Box size={[1.25, 0.09, 0.3]} pos={[0, FLOOR + 0.92, 0.3]} mat={m.steel} />
        {[-0.07, 0, 0.07].map((z) => (
          <Box key={z} size={[1.24, 0.01, 0.02]} pos={[0, FLOOR + 0.97, 0.3 + z]} mat={m.black} />
        ))}
        <Box size={[0.2, 0.1, 0.12]} pos={[0.1, FLOOR + 1.01, 0.3]} mat={m.toolGrey} />
        <Handwheel pos={[0.68, FLOOR + 0.92, 0.3]} r={0.06} rot={[0, Math.PI / 2, 0]} mat={m.chrome} />
      </Shuttle>
      <Handwheel pos={[0, FLOOR + 0.83, 0.5]} r={0.06} mat={m.chrome} />
      <Nameplate pos={[0, FLOOR + 0.9, -0.044]} lines={["UNIVERSAL MILL", "Table 1250x300", "60-1800 rpm", "ISO 40"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ radial arm drilling machine

export function RadialDrill({ spin, hot }: ModelProps) {
  const m = M();
  const body = useHeat(m.toolGrey, hot);
  return (
    <group>
      <Box size={[1.9, 0.22, 0.9]} pos={[0.2, FLOOR + 0.11, 0]} mat={m.castIron} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Box key={i} size={[1.1, 0.012, 0.03]} pos={[0.5, FLOOR + 0.225, -0.2 + i * 0.2]} mat={m.black} />
      ))}
      {/* column with outer sleeve, arm elevating screw */}
      <Cyl r={0.17} len={1.9} pos={[-0.55, FLOOR + 1.17, 0]} rot={[0, 0, 0]} mat={body} />
      <Cyl r={0.2} len={0.2} pos={[-0.55, FLOOR + 0.32, 0]} rot={[0, 0, 0]} mat={body} />
      <Cyl r={0.022} len={1.5} pos={[-0.35, FLOOR + 1.15, 0.12]} rot={[0, 0, 0]} mat={m.steel} />
      <Box size={[0.3, 0.35, 0.3]} pos={[-0.55, FLOOR + 2.2, 0]} mat={body} />
      {/* radial arm and sliding drill head */}
      <Box size={[1.7, 0.24, 0.3]} pos={[0.25, FLOOR + 1.62, 0]} mat={body} />
      <Box size={[1.4, 0.03, 0.04]} pos={[0.35, FLOOR + 1.62, 0.17]} mat={m.steel} />
      <Box size={[0.38, 0.55, 0.42]} pos={[0.65, FLOOR + 1.58, 0.05]} mat={body} />
      <group position={[0.65, FLOOR + 2.05, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <MotorUnit r={0.11} len={0.3} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Spin speed={spin * 3} axis="y" pos={[0.65, FLOOR + 1.12, 0.05]}>
        <Cyl r={0.045} len={0.4} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.chrome} />
        <Cyl r={0.012} len={0.22} pos={[0, -0.3, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
      </Spin>
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[0.25, 0.018, 0.018]} pos={[0.65 + 0.2, FLOOR + 1.5, 0.05]} rot={[(i * Math.PI * 2) / 3, 0, 0]} mat={m.chrome} />
      ))}
      <Box size={[0.4, 0.3, 0.25]} pos={[0.85, FLOOR + 0.38, 0]} mat={m.castIron} />
      <Nameplate pos={[0.25, FLOOR + 1.62, 0.152]} lines={["RADIAL DRILL", "Arm 1250 mm", "Cap. 50 mm", "12 speeds"]} w={0.22} />
    </group>
  );
}

// ------------------------------------------------------------------ surface grinder

export function SurfaceGrinder({ spin, hot, running }: ModelProps) {
  const m = M();
  const body = useHeat(m.toolWhite, hot);
  return (
    <group>
      <Box size={[1.6, 0.95, 0.9]} pos={[0, FLOOR + 0.475, 0]} mat={body} />
      <Box size={[0.5, 1.1, 0.5]} pos={[0, FLOOR + 1.45, -0.32]} mat={body} />
      {/* wheel head with guard and spinning wheel */}
      <Box size={[0.36, 0.3, 0.6]} pos={[0, FLOOR + 1.45, 0.05]} mat={body} />
      <Torus r={0.18} tube={0.05} pos={[0.1, FLOOR + 1.22, 0.25]} rot={[0, Math.PI / 2, 0]} arc={Math.PI * 1.2} mat={m.toolGrey} />
      <Spin speed={spin * 5} axis="x" pos={[0.1, FLOOR + 1.22, 0.25]}>
        <Cyl r={0.17} len={0.05} pos={[0, 0, 0]} mat={m.panelGrey} />
      </Spin>
      {/* reciprocating magnetic chuck table */}
      <Shuttle axis="x" travel={0.35} speed={1.4} running={running && spin > 0}>
        <Box size={[1.3, 0.07, 0.42]} pos={[0, FLOOR + 1.0, 0.25]} mat={m.steel} />
        <Box size={[0.8, 0.05, 0.32]} pos={[0, FLOOR + 1.06, 0.25]} mat={m.checker} />
      </Shuttle>
      <Handwheel pos={[0, FLOOR + 0.7, 0.48]} r={0.1} mat={m.chrome} />
      <Handwheel pos={[0.5, FLOOR + 0.7, 0.48]} r={0.07} mat={m.chrome} />
      <Box size={[0.9, 0.06, 0.6]} pos={[0, FLOOR + 0.98, 0.25]} mat={m.toolGrey} />
      <ControlPendant pos={[0.68, FLOOR + 1.3, 0.3]} rot={[0, -0.4, 0]} />
      <Nameplate pos={[-0.45, FLOOR + 0.5, 0.452]} lines={["SURFACE GRINDER", "Table 600x300", "Wheel 300x40", "Flatness 0.005"]} w={0.26} />
    </group>
  );
}

// ------------------------------------------------------------------ horizontal band saw

export function BandSaw({ spin, hot, running }: ModelProps) {
  const m = M();
  const body = useHeat(m.forkYellow, hot);
  const bow = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (bow.current) bow.current.rotation.z = THREE.MathUtils.damp(bow.current.rotation.z, running && spin > 0 ? -0.12 - Math.sin(clock.elapsedTime * 0.4) * 0.1 : -0.25, 2, dt);
  });
  return (
    <group>
      <Box size={[1.6, 0.7, 0.6]} pos={[0, FLOOR + 0.35, 0]} mat={body} />
      <Box size={[1.7, 0.05, 0.7]} pos={[0, FLOOR + 0.72, 0]} mat={m.darkSteel} />
      {/* vice jaws and the bar being cut */}
      <Box size={[0.3, 0.18, 0.08]} pos={[0.1, FLOOR + 0.84, 0.15]} mat={m.toolGrey} />
      <Box size={[0.3, 0.18, 0.08]} pos={[0.1, FLOOR + 0.84, -0.15]} mat={m.toolGrey} />
      <Cyl r={0.07} len={2.4} pos={[0.6, FLOOR + 0.82, 0]} mat={m.steel} />
      {/* roller stand on the infeed side */}
      <Box size={[0.08, 0.7, 0.08]} pos={[1.6, FLOOR + 0.4, 0]} mat={m.darkSteel} />
      <Cyl r={0.04} len={0.4} pos={[1.6, FLOOR + 0.76, 0]} rot={Z_AXIS} mat={m.steel} />
      {/* hinged saw bow with blade wheels, blade, motor and coolant pipe */}
      <group ref={bow} position={[-0.75, FLOOR + 0.9, -0.25]}>
        <Box size={[1.5, 0.3, 0.12]} pos={[0.75, 0.25, 0]} mat={body} />
        {[0.1, 1.4].map((x) => (
          <group key={x}>
            <Cyl r={0.2} len={0.14} pos={[x, 0.2, 0.08]} rot={Z_AXIS} mat={body} />
            <Spin speed={spin * 2} axis="z" pos={[x, 0.2, 0.17]}>
              <Torus r={0.16} tube={0.015} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.steel} />
            </Spin>
          </group>
        ))}
        <Box size={[1.3, 0.025, 0.006]} pos={[0.75, 0.03, 0.25]} mat={m.chrome} />
        <group position={[1.45, 0.48, -0.05]}>
          <MotorUnit r={0.1} len={0.26} paint={m.motorBlue} spin={spin} plate={false} />
        </group>
        <Pipe points={[[0.6, 0.12, 0.2], [0.75, 0.0, 0.3], [0.85, -0.02, 0.27]]} r={0.01} mat={m.safetyOrange} />
      </group>
      <ControlPendant pos={[-0.95, FLOOR + 0.9, 0.35]} rot={[-0.3, 0.3, 0]} />
      <Nameplate pos={[0.4, FLOOR + 0.4, 0.302]} lines={["BAND SAW", "Cap. 260 mm", "Blade 27x0.9", "Coolant pump"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ injection moulding machine

export function InjectionMoulder({ spin, hot, running }: ModelProps) {
  const m = M();
  const frame = useHeat(m.toolWhite, hot);
  return (
    <group>
      <Box size={[3.4, 0.75, 0.85]} pos={[0, FLOOR + 0.375, 0]} mat={frame} />
      <Box size={[3.4, 0.03, 0.87]} pos={[0, FLOOR + 0.76, 0]} mat={m.toolGrey} />
      {/* clamping unit: fixed platen, moving platen on four tie bars, toggle cylinder */}
      <Box size={[0.12, 0.82, 0.8]} pos={[0.4, FLOOR + 1.18, 0]} mat={m.toolGrey} />
      {/* moving platen and mould half open and close each cycle */}
      <Shuttle axis="x" travel={0.12} speed={1.2} running={running && spin > 0}>
        <Box size={[0.12, 0.82, 0.8]} pos={[-0.7, FLOOR + 1.18, 0]} mat={m.toolGrey} />
        <Box size={[0.12, 0.45, 0.45]} pos={[-0.58, FLOOR + 1.18, 0]} mat={m.steel} />
      </Shuttle>
      <Box size={[0.15, 0.82, 0.8]} pos={[-1.55, FLOOR + 1.18, 0]} mat={m.toolGrey} />
      {[-0.3, 0.3].map((y) => [-0.3, 0.3].map((z) => <Cyl key={`${y}${z}`} r={0.035} len={1.5} pos={[-0.85, FLOOR + 1.18 + y, z]} mat={m.chrome} />))}
      <Cyl r={0.12} len={0.5} pos={[-1.85, FLOOR + 1.18, 0]} mat={m.toolGrey} />
      {/* mould halves between the platens */}
      <Box size={[0.25, 0.5, 0.5]} pos={[-0.25, FLOOR + 1.18, 0]} mat={m.steel} />
      {/* safety gate with window */}
      <Box size={[1.25, 0.7, 0.03]} pos={[-0.75, FLOOR + 1.2, 0.44]} mat={frame} />
      <Box size={[0.9, 0.4, 0.008]} pos={[-0.75, FLOOR + 1.25, 0.458]} mat={m.darkGlass} />
      {/* injection unit: barrel with heater bands, nozzle, hopper, screw drive */}
      <Cyl r={0.09} len={1.3} pos={[1.15, FLOOR + 1.12, 0]} mat={m.steel} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Cyl key={i} r={0.115} len={0.12} pos={[0.65 + i * 0.22, FLOOR + 1.12, 0]} mat={hot ? frame : m.copper} />
      ))}
      <Turned profile={[[0.06, 0], [0.03, 0.1], [0.015, 0.12]]} pos={[0.5, FLOOR + 1.12, 0]} rot={[0, 0, Math.PI / 2]} mat={m.steel} />
      <Turned profile={[[0.04, 0], [0.2, 0.32], [0.2, 0.5], [0, 0.5]]} pos={[1.15, FLOOR + 1.22, 0]} mat={m.cladding} />
      <Box size={[0.45, 0.4, 0.45]} pos={[1.75, FLOOR + 1.12, 0]} mat={m.toolGrey} />
      <ControlPendant pos={[0.3, FLOOR + 1.35, 0.5]} rot={[-0.2, 0, 0]} />
      {/* hydraulic hoses and oil tank under the frame */}
      <Pipe points={[[1.6, FLOOR + 0.8, 0.3], [1.3, FLOOR + 0.95, 0.38], [-1.5, FLOOR + 0.95, 0.38], [-1.7, FLOOR + 1.0, 0.25]]} r={0.022} mat={m.hose} />
      <Nameplate pos={[1.2, FLOOR + 0.4, 0.427]} lines={["INJECTION MOULDING", "Clamp 1200 kN", "Shot 280 g", "Screw D45"]} w={0.28} />
    </group>
  );
}

// ------------------------------------------------------------------ single-screw plastics extruder

export function Extruder({ spin, hot }: ModelProps) {
  const m = M();
  const frame = useHeat(m.darkPaint, hot);
  return (
    <group>
      <Box size={[3.0, 0.7, 0.6]} pos={[0, FLOOR + 0.35, 0]} mat={frame} />
      {/* drive motor and reduction gearbox at the feed end */}
      <group position={[-1.15, FLOOR + 0.98, 0]}>
        <MotorUnit r={0.22} len={0.6} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Box size={[0.5, 0.55, 0.55]} pos={[-0.5, FLOOR + 0.98, 0]} mat={m.castIron} />
      {/* feed throat and hopper with dryer */}
      <Box size={[0.2, 0.2, 0.2]} pos={[-0.12, FLOOR + 1.12, 0]} mat={m.steel} />
      <Turned profile={[[0.06, 0], [0.24, 0.3], [0.24, 0.7], [0, 0.72]]} pos={[-0.12, FLOOR + 1.22, 0]} mat={m.cladding} />
      {/* barrel with heater/cooler zones and fans */}
      <Cyl r={0.08} len={1.7} pos={[0.85, FLOOR + 0.98, 0]} mat={m.steel} />
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i}>
          <Cyl r={0.12} len={0.2} pos={[0.15 + i * 0.27, FLOOR + 0.98, 0]} mat={m.cladding} />
          <Box size={[0.16, 0.14, 0.16]} pos={[0.15 + i * 0.27, FLOOR + 0.8, 0]} mat={m.toolGrey} />
        </group>
      ))}
      {/* breaker plate, die head and the profile coming out */}
      <Cyl r={0.15} len={0.12} pos={[1.75, FLOOR + 0.98, 0]} mat={m.castIron} />
      <BoltRing r={0.12} count={8} at={[1.8, FLOOR + 0.98, 0]} />
      <Box size={[0.2, 0.35, 0.35]} pos={[1.9, FLOOR + 0.98, 0]} mat={m.steel} />
      <Pipe points={[[2.0, FLOOR + 0.98, 0], [2.4, FLOOR + 0.98, 0], [2.6, FLOOR + 0.98, 0]]} r={0.035} mat={m.safetyOrange} />
      <Box size={[0.05, 0.85, 0.05]} pos={[0.9, FLOOR + 1.1, -0.3]} mat={m.darkSteel} />
      <Box size={[0.08, 0.5, 0.4]} pos={[0.9, FLOOR + 1.55, -0.3]} mat={m.panelRal} />
      <Box size={[0.012, 0.18, 0.28]} pos={[0.945, FLOOR + 1.6, -0.3]} mat={m.screen} />
      <Nameplate pos={[0.2, FLOOR + 0.4, 0.302]} lines={["SINGLE-SCREW EXTRUDER", "D 65 mm  L/D 30", "Output 120 kg/h", "6 heat zones"]} w={0.3} />
    </group>
  );
}

// ------------------------------------------------------------------ six-axis industrial robot in a guarded cell

export function Robot({ spin, hot, running }: ModelProps) {
  const m = M();
  const arm = useHeat(m.robotOrange, hot);
  const j1 = useRef<THREE.Group>(null);
  const j2 = useRef<THREE.Group>(null);
  const j3 = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const on = running && spin > 0;
    const t = clock.elapsedTime;
    const d = (g: THREE.Group | null, axis: "x" | "y" | "z", v: number) => g && (g.rotation[axis] = THREE.MathUtils.damp(g.rotation[axis], on ? v : 0, 2, dt));
    d(j1.current, "y", Math.sin(t * 0.6) * 0.9);
    d(j2.current, "z", -0.4 + Math.sin(t * 0.8) * 0.25);
    d(j3.current, "z", 0.9 + Math.sin(t * 0.9 + 1) * 0.3);
  });
  return (
    <group>
      {/* cell floor, fence posts and mesh */}
      <Box size={[2.6, 0.03, 2.2]} pos={[0, FLOOR + 0.015, 0]} mat={m.checker} />
      {[[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.05, 1.4, 0.05]} pos={[x, FLOOR + 0.7, z]} mat={m.forkYellow} />
      ))}
      <Box size={[2.6, 1.2, 0.01]} pos={[0, FLOOR + 0.75, -1.1]} mat={m.louvreGrey} />
      <Box size={[0.01, 1.2, 2.2]} pos={[-1.3, FLOOR + 0.75, 0]} mat={m.louvreGrey} />
      {/* pedestal, base, turntable joint 1 */}
      <Cyl r={0.3} len={0.3} pos={[0, FLOOR + 0.15, 0]} rot={[0, 0, 0]} mat={m.darkPaint} />
      <group ref={j1} position={[0, FLOOR + 0.3, 0]}>
        <Cyl r={0.26} len={0.22} pos={[0, 0.11, 0]} rot={[0, 0, 0]} mat={arm} />
        <Box size={[0.32, 0.3, 0.36]} pos={[0, 0.35, 0]} mat={arm} />
        {/* lower arm on joint 2, with balancer cylinder */}
        <group ref={j2} position={[0, 0.45, 0]}>
          <Cyl r={0.14} len={0.42} pos={[0, 0, 0]} rot={Z_AXIS} mat={arm} />
          <Box size={[0.16, 0.9, 0.18]} pos={[0, 0.45, 0]} mat={arm} />
          <Cyl r={0.04} len={0.55} pos={[-0.12, 0.3, 0.12]} rot={[0, 0, 0.1]} mat={m.chrome} />
          {/* upper arm on joint 3, wrist and gripper */}
          <group ref={j3} position={[0, 0.9, 0]}>
            <Cyl r={0.12} len={0.36} pos={[0, 0, 0]} rot={Z_AXIS} mat={arm} />
        <Box size={[0.75, 0.13, 0.14]} pos={[0.38, 0, 0]} mat={arm} />
        <Cyl r={0.07} len={0.12} pos={[0.8, 0, 0]} mat={arm} />
        <Cyl r={0.05} len={0.08} pos={[0.9, 0, 0]} mat={m.darkSteel} />
        <Box size={[0.04, 0.12, 0.03]} pos={[0.98, 0, 0.04]} mat={m.steel} />
        <Box size={[0.04, 0.12, 0.03]} pos={[0.98, 0, -0.04]} mat={m.steel} />
        <Pipe points={[[0.1, 0.1, 0.08], [0.5, 0.14, 0.08], [0.85, 0.08, 0.06]]} r={0.015} mat={m.hose} />
      
          </group>
        </group>
      </group>
      {/* controller cabinet and teach pendant, outside the cell */}
      <Box size={[0.6, 1.0, 0.5]} pos={[1.65, FLOOR + 0.5, 0.6]} mat={m.panelRal} />
      <Box size={[0.2, 0.28, 0.05]} pos={[1.65, FLOOR + 0.75, 0.88]} mat={m.toolGrey} />
      {/* work: fixture table with parts */}
      <Box size={[0.7, 0.6, 0.5]} pos={[0.8, FLOOR + 0.3, -0.5]} mat={m.toolGrey} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[0.12, 0.08, 0.12]} pos={[0.6 + i * 0.18, FLOOR + 0.64, -0.5]} mat={m.steel} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ counterbalance forklift

export function Forklift({ spin, hot }: ModelProps) {
  const m = M();
  const body = useHeat(m.forkYellow, hot);
  return (
    <group rotation={[0, -0.4, 0]}>
      {/* chassis, counterweight, seat and overhead guard */}
      <Box size={[1.4, 0.5, 0.95]} pos={[0, FLOOR + 0.5, 0]} mat={body} />
      <Turned profile={[[0.48, 0], [0.48, 0.6], [0, 0.6]]} pos={[-0.7, FLOOR + 0.3, 0]} rot={[0, 0, Math.PI / 2]} seg={24} mat={m.darkPaint} />
      <Box size={[0.4, 0.35, 0.5]} pos={[-0.2, FLOOR + 0.92, 0]} mat={m.black} />
      <Box size={[0.4, 0.06, 0.45]} pos={[-0.15, FLOOR + 0.8, 0]} mat={m.black} />
      {[[-0.55, -0.4], [-0.55, 0.4], [0.45, -0.4], [0.45, 0.4]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.05, 1.15, 0.05]} pos={[x, FLOOR + 1.3, z]} rot={[0, 0, x > 0 ? -0.08 : 0]} mat={m.black} />
      ))}
      <Box size={[1.1, 0.04, 0.85]} pos={[-0.05, FLOOR + 1.88, 0]} mat={m.black} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} size={[0.03, 0.06, 0.85]} pos={[-0.5 + i * 0.22, FLOOR + 1.9, 0]} mat={m.black} />
      ))}
      {/* steering wheel and amber beacon */}
      <Torus r={0.12} tube={0.015} pos={[0.25, FLOOR + 1.12, 0]} rot={[0.5, Math.PI / 2, 0]} mat={m.black} />
      <Cyl r={0.05} len={0.08} pos={[-0.4, FLOOR + 1.94, -0.3]} rot={[0, 0, 0]} mat={m.amber} />
      {/* wheels */}
      {[[0.45, 0.48, 0.28], [0.45, -0.48, 0.28], [-0.5, 0.45, 0.24], [-0.5, -0.45, 0.24]].map(([x, z, r]) => (
        <group key={`${x}${z}`} position={[x, FLOOR + r, z]}>
          <Spin speed={spin * 0.3} axis="z">
            <Cyl r={r} len={0.2} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.rubber} />
          </Spin>
          <Cyl r={r * 0.55} len={0.21} pos={[0, 0, 0]} rot={Z_AXIS} mat={body} />
        </group>
      ))}
      {/* mast, carriage, forks and a loaded pallet */}
      {[-0.28, 0.28].map((z) => (
        <Box key={z} size={[0.08, 2.0, 0.1]} pos={[0.82, FLOOR + 1.1, z]} mat={m.darkPaint} />
      ))}
      <Cyl r={0.04} len={1.4} pos={[0.82, FLOOR + 0.9, 0]} rot={[0, 0, 0]} mat={m.chrome} />
      <Box size={[0.06, 0.45, 0.8]} pos={[0.9, FLOOR + 0.5, 0]} mat={m.darkPaint} />
      {[-0.22, 0.22].map((z) => (
        <Box key={z} size={[0.9, 0.04, 0.1]} pos={[1.35, FLOOR + 0.3, z]} mat={m.darkSteel} />
      ))}
      <Box size={[0.9, 0.12, 0.9]} pos={[1.38, FLOOR + 0.38, 0]} mat={m.cardboard} />
      <Box size={[0.8, 0.5, 0.8]} pos={[1.38, FLOOR + 0.69, 0]} mat={m.cardboard} />
      <Nameplate pos={[-0.3, FLOOR + 0.5, 0.477]} lines={["FORKLIFT 3.0 t", "Diesel", "Lift 4.5 m", "Insp. due 03/27"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ pillar jib crane with electric chain hoist

export function JibCrane({ spin, hot, running }: ModelProps) {
  const m = M();
  const steel = useHeat(m.forkYellow, hot);
  const slew = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const on = running && spin > 0;
    if (slew.current) slew.current.rotation.y = THREE.MathUtils.damp(slew.current.rotation.y, on ? Math.sin(clock.elapsedTime * 0.25) * 0.8 : 0.3, 1.5, dt);
    if (hook.current) hook.current.position.y = THREE.MathUtils.damp(hook.current.position.y, on ? -0.3 - (Math.sin(clock.elapsedTime * 0.5) + 1) * 0.35 : -0.6, 2, dt);
  });
  return (
    <group>
      {/* foundation plate with anchor bolts, pillar */}
      <Box size={[0.8, 0.06, 0.8]} pos={[-0.9, FLOOR + 0.03, 0]} mat={m.darkSteel} />
      {[[-1.2, -0.3], [-1.2, 0.3], [-0.6, -0.3], [-0.6, 0.3]].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.025} len={0.06} pos={[x, FLOOR + 0.08, z]} rot={[0, 0, 0]} mat={m.steel} seg={6} />
      ))}
      <Cyl r={0.15} len={2.4} pos={[-0.9, FLOOR + 1.26, 0]} rot={[0, 0, 0]} mat={steel} />
      <group ref={slew} position={[-0.9, FLOOR + 2.3, 0]}>
        <Cyl r={0.2} len={0.2} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={steel} />
        {/* I-beam boom with tie rod */}
        <Box size={[2.6, 0.04, 0.2]} pos={[1.3, 0.02, 0]} mat={steel} />
        <Box size={[2.6, 0.04, 0.2]} pos={[1.3, -0.24, 0]} mat={steel} />
        <Box size={[2.6, 0.24, 0.03]} pos={[1.3, -0.11, 0]} mat={steel} />
        <Pipe points={[[0, 0.55, 0], [1.8, -0.05, 0]]} r={0.02} mat={m.steel} />
        <Cyl r={0.04} len={0.5} pos={[0, 0.35, 0]} rot={[0, 0, 0]} mat={steel} />
        {/* trolley, chain hoist, pendant and hook */}
        <group position={[1.7, -0.32, 0]}>
          <Box size={[0.3, 0.1, 0.26]} pos={[0, 0, 0]} mat={m.darkPaint} />
          <Box size={[0.28, 0.32, 0.22]} pos={[0, -0.22, 0]} mat={m.safetyOrange} />
          <group ref={hook} position={[0, -0.6, 0]}>
            <Cyl r={0.012} len={0.5} pos={[0, 0.25, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
            <Box size={[0.1, 0.14, 0.07]} pos={[0, 0, 0]} mat={m.forkYellow} />
            <Torus r={0.05} tube={0.015} pos={[0, -0.11, 0]} rot={[0, 0, 0]} arc={Math.PI * 1.5} mat={m.steel} />
          </group>
          <Pipe points={[[0.1, -0.35, 0.05], [0.12, -1.2, 0.1], [0.12, -1.6, 0.1]]} r={0.008} mat={m.black} />
          <Box size={[0.07, 0.2, 0.05]} pos={[0.12, -1.7, 0.1]} mat={m.forkYellow} />
        </group>
      </group>
      <Nameplate pos={[-0.9, FLOOR + 1.2, 0.152]} lines={["SWL 1000 kg", "Jib 3 m", "Slew 360°", "Test 05/2026"]} w={0.2} />
      <Gauge pos={[-0.9, FLOOR + 0.5, 0.16]} running={running} size={0.05} />
    </group>
  );
}
