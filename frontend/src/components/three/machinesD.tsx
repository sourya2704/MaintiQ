import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { ModelProps } from "./machinesA";
import { MotorUnit } from "./machinesA";
import { BoltRing, Box, Cyl, FLOOR, Gauge, Grille, Handwheel, M, Nameplate, Pipe, Spin, Torus, Turned, useHeat, Z_AXIS } from "./parts";

// Utilities and process plant: cooling tower, chiller, transformer, motor control centre,
// mixing tank, bucket elevator, screw compressor, dust collector, heat exchanger, packing machine.

// ------------------------------------------------------------------ induced-draft cooling tower cell

export function CoolingTower({ spin, hot }: ModelProps) {
  const m = M();
  const casing = useHeat(m.towerBlue, hot);
  return (
    <group>
      {/* cold-water basin, casing with louvred air inlets, fan deck */}
      <Box size={[2.0, 0.35, 2.0]} pos={[0, FLOOR + 0.175, 0]} mat={m.grout} />
      <Box size={[1.9, 1.3, 1.9]} pos={[0, FLOOR + 1.0, 0]} mat={casing} />
      {[1, -1].map((s) => (
        <Box key={s} size={[1.7, 0.6, 0.012]} pos={[0, FLOOR + 0.72, s * 0.956]} mat={m.louvreGrey} />
      ))}
      {[1, -1].map((s) => (
        <Box key={s} size={[0.012, 0.6, 1.7]} pos={[s * 0.956, FLOOR + 0.72, 0]} mat={m.louvreGrey} />
      ))}
      <Box size={[1.95, 0.06, 1.95]} pos={[0, FLOOR + 1.68, 0]} mat={casing} />
      {/* fan stack with guard and spinning blades */}
      <Turned profile={[[0.72, 0], [0.64, 0.25], [0.66, 0.5], [0.72, 0.62]]} pos={[0, FLOOR + 1.7, 0]} mat={casing} />
      <Spin speed={spin} axis="y" pos={[0, FLOOR + 2.0, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} size={[1.2, 0.012, 0.16]} pos={[0, 0, 0]} rot={[0.25, (i / 6) * Math.PI, 0]} mat={m.darkSteel} />
        ))}
        <Cyl r={0.1} len={0.12} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
      </Spin>
      <Grille r={0.7} pos={[0, FLOOR + 2.33, 0]} rot={[Math.PI / 2, 0, 0]} rings={5} />
      {/* hot-water inlet header, make-up and outlet pipes, ladder */}
      <Pipe points={[[1.6, FLOOR + 1.5, 0.4], [1.0, FLOOR + 1.5, 0.4], [0.96, FLOOR + 1.5, 0.4]]} r={0.07} mat={m.darkPaint} />
      <Pipe points={[[0.98, FLOOR + 0.2, -0.5], [1.6, FLOOR + 0.2, -0.5]]} r={0.08} mat={m.darkPaint} />
      <Handwheel pos={[1.35, FLOOR + 1.5, 0.52]} r={0.07} />
      {[-0.2, 0.2].map((z) => (
        <Box key={z} size={[0.03, 2.0, 0.03]} pos={[-1.02, FLOOR + 1.0, z]} mat={m.forkYellow} />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <Cyl key={i} r={0.012} len={0.4} pos={[-1.02, FLOOR + 0.2 + i * 0.27, 0]} rot={Z_AXIS} mat={m.forkYellow} />
      ))}
      <Nameplate pos={[0.4, FLOOR + 1.3, 0.956]} lines={["COOLING TOWER", "300 TR", "Flow 270 m3/h", "Fan 7.5 kW"]} w={0.26} />
    </group>
  );
}

// ------------------------------------------------------------------ water-cooled screw chiller

export function Chiller({ spin, hot, running }: ModelProps) {
  const m = M();
  const frame = useHeat(m.toolWhite, hot);
  return (
    <group>
      <Box size={[3.0, 0.14, 1.1]} pos={[0, FLOOR + 0.07, 0]} mat={m.darkPaint} />
      {/* evaporator (lower) and condenser (upper) shells with end bonnets */}
      {[[FLOOR + 0.45, 0.28, m.cladding], [FLOOR + 1.05, 0.25, m.motorBlue]].map(([y, r, mat], i) => (
        <group key={i}>
          <Cyl r={r as number} len={2.4} pos={[0, y as number, 0]} mat={mat as THREE.Material} />
          {[-1.25, 1.25].map((x) => (
            <Turned key={x} profile={[[(r as number) + 0.03, 0], [(r as number) + 0.03, 0.08], [(r as number) * 0.6, 0.14], [0, 0.15]]} pos={[x, y as number, 0]} rot={[0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]} mat={m.castIron} />
          ))}
          <BoltRing r={(r as number) + 0.01} count={12} at={[1.27, y as number, 0]} />
        </group>
      ))}
      {/* screw compressor with motor on top */}
      <Box size={[0.7, 0.32, 0.4]} pos={[-0.3, FLOOR + 1.45, 0]} mat={m.castRed} />
      <group position={[0.4, FLOOR + 1.45, 0]}>
        <MotorUnit r={0.18} len={0.55} paint={frame} spin={spin} plate={false} />
      </group>
      {/* refrigerant piping, chilled water nozzles, control panel */}
      <Pipe points={[[-0.6, FLOOR + 1.5, 0.15], [-0.9, FLOOR + 1.6, 0.25], [-1.0, FLOOR + 1.2, 0.3]]} r={0.04} mat={m.copper} />
      <Pipe points={[[0.2, FLOOR + 1.3, -0.18], [0.5, FLOOR + 0.9, -0.3], [0.6, FLOOR + 0.6, -0.3]]} r={0.035} mat={m.copper} />
      {[-0.95, -0.55].map((x, i) => (
        <group key={x}>
          <Pipe points={[[x, FLOOR + (i ? 1.05 : 0.45), 0.25], [x, FLOOR + (i ? 1.05 : 0.45), 0.6]]} r={0.07} mat={m.darkPaint} />
          <Cyl r={0.1} len={0.03} pos={[x, FLOOR + (i ? 1.05 : 0.45), 0.6]} rot={Z_AXIS} mat={m.darkPaint} />
        </group>
      ))}
      <Box size={[0.6, 0.9, 0.3]} pos={[1.1, FLOOR + 1.4, 0.2]} mat={m.panelRal} />
      <Box size={[0.3, 0.18, 0.012]} pos={[1.1, FLOOR + 1.6, 0.356]} mat={m.screen} />
      <Gauge pos={[0.95, FLOOR + 1.2, 0.36]} running={running} size={0.06} />
      <Gauge pos={[1.25, FLOOR + 1.2, 0.36]} running={running} size={0.06} />
      <Nameplate pos={[0, FLOOR + 0.45, 0.285]} lines={["SCREW CHILLER", "350 kW  R-134a", "CHW 7/12 °C", "COP 5.8"]} w={0.26} />
    </group>
  );
}

// ------------------------------------------------------------------ oil-filled distribution transformer

export function Transformer({ hot }: ModelProps) {
  const m = M();
  const tank = useHeat(m.trafoGrey, hot);
  return (
    <group>
      <Box size={[1.9, 0.12, 1.4]} pos={[0, FLOOR + 0.06, 0]} mat={m.grout} />
      <Box size={[1.1, 0.12, 0.75]} pos={[0, FLOOR + 0.18, 0]} mat={m.darkPaint} />
      {/* main tank with radiator fins on both sides */}
      <Box size={[1.1, 1.15, 0.7]} pos={[0, FLOOR + 0.82, 0]} mat={tank} />
      {[-1, 1].map((s) =>
        Array.from({ length: 8 }).map((_, i) => (
          <Box key={`${s}${i}`} size={[0.03, 0.95, 0.3]} pos={[-0.42 + i * 0.12, FLOOR + 0.8, s * 0.5]} mat={tank} />
        )),
      )}
      <Box size={[1.16, 0.06, 0.76]} pos={[0, FLOOR + 1.42, 0]} mat={tank} />
      {/* conservator tank, Buchholz relay pipe, breather */}
      <Cyl r={0.14} len={0.9} pos={[0, FLOOR + 1.85, -0.2]} mat={tank} />
      <Pipe points={[[0.3, FLOOR + 1.72, -0.2], [0.3, FLOOR + 1.45, -0.1]]} r={0.025} mat={tank} />
      <Box size={[0.08, 0.08, 0.08]} pos={[0.3, FLOOR + 1.6, -0.16]} mat={m.darkSteel} />
      <Cyl r={0.04} len={0.18} pos={[-0.5, FLOOR + 1.68, -0.2]} rot={[0, 0, 0]} mat={m.glass} />
      {/* HV bushings (tall porcelain) and LV bushings */}
      {[-0.32, 0, 0.32].map((x) => (
        <group key={x} position={[x, FLOOR + 1.45, 0.18]}>
          <Cyl r={0.04} len={0.4} pos={[0, 0.2, 0]} rot={[0, 0, 0]} mat={m.cream} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Cyl key={i} r={0.07} len={0.02} pos={[0, 0.06 + i * 0.07, 0]} rot={[0, 0, 0]} mat={m.cream} />
          ))}
          <Cyl r={0.015} len={0.1} pos={[0, 0.45, 0]} rot={[0, 0, 0]} mat={m.copper} />
        </group>
      ))}
      {[-0.3, -0.1, 0.1, 0.3].map((x) => (
        <group key={x} position={[x, FLOOR + 1.45, -0.05]}>
          <Cyl r={0.035} len={0.16} pos={[0, 0.08, 0]} rot={[0, 0, 0]} mat={m.cream} />
          <Cyl r={0.02} len={0.08} pos={[0, 0.2, 0]} rot={[0, 0, 0]} mat={m.copper} />
        </group>
      ))}
      {/* oil temperature indicator, drain valve, tap changer handle, earth bar */}
      <Gauge pos={[0.4, FLOOR + 1.1, 0.36]} running size={0.07} />
      <Handwheel pos={[-0.4, FLOOR + 0.35, 0.37]} r={0.05} />
      <Box size={[0.1, 0.2, 0.06]} pos={[-0.56, FLOOR + 1.2, 0]} mat={m.darkSteel} />
      <Box size={[0.03, 0.03, 0.9]} pos={[0.57, FLOOR + 0.25, 0]} mat={m.copper} />
      <Nameplate pos={[-0.15, FLOOR + 0.95, 0.353]} lines={["TRANSFORMER 1000 kVA", "11 kV / 433 V", "Dyn11  ONAN", "Z 5.0%"]} w={0.32} />
      {/* danger board */}
      <Box size={[0.2, 0.24, 0.005]} pos={[0.3, FLOOR + 0.7, 0.353]} mat={m.hazard} />
    </group>
  );
}

// ------------------------------------------------------------------ motor control centre (MCC) line-up

export function ControlPanel({ hot, running }: ModelProps) {
  const m = M();
  const cab = useHeat(m.panelRal, hot);
  return (
    <group>
      <Box size={[2.6, 0.1, 0.7]} pos={[0, FLOOR + 0.05, 0]} mat={m.darkPaint} />
      {[-0.975, -0.325, 0.325, 0.975].map((x, i) => (
        <group key={x} position={[x, FLOOR + 1.05, 0]}>
          <Box size={[0.64, 1.9, 0.6]} pos={[0, 0, 0]} mat={cab} />
          {/* withdrawable feeder drawers, each with handle, lamps and meter */}
          {Array.from({ length: i === 0 ? 2 : 5 }).map((_, k, arr) => {
            const h = 1.7 / arr.length;
            const y = 0.85 - h * (k + 0.5);
            return (
              <group key={k} position={[0, y, 0.302]}>
                <Box size={[0.58, h - 0.03, 0.01]} pos={[0, 0, 0]} mat={cab} />
                <Box size={[0.03, h * 0.4, 0.04]} pos={[0.22, 0, 0.02]} mat={m.black} />
                {[m.green, m.red, m.amber].map((mat, j) => (
                  <Cyl key={j} r={0.014} len={0.01} pos={[-0.2 + j * 0.05, h * 0.25, 0.01]} rot={Z_AXIS} mat={running && j === 0 ? m.green : mat} seg={10} />
                ))}
                <Box size={[0.08, 0.06, 0.008]} pos={[-0.02, -h * 0.15, 0.008]} mat={m.gaugeFace} />
              </group>
            );
          })}
          {i === 0 && <Box size={[0.26, 0.3, 0.012]} pos={[0, 0.55, 0.31]} mat={m.screen} />}
          {/* roof vent */}
          <Box size={[0.5, 0.06, 0.4]} pos={[0, 0.98, 0]} mat={m.louvreGrey} />
        </group>
      ))}
      {/* incoming cable trench cover and earthing strip */}
      <Box size={[2.6, 0.02, 0.4]} pos={[0, FLOOR + 0.11, 0.6]} mat={m.checker} />
      <Box size={[0.2, 0.24, 0.005]} pos={[-0.975, FLOOR + 0.45, 0.31]} mat={m.hazard} />
      <Nameplate pos={[0.65, FLOOR + 2.05, 0.302]} lines={["MCC-02  415 V", "Incomer 800 A", "Form 3b", "IP54"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ jacketed mixing vessel with top-entry agitator

export function MixingTank({ spin, hot, running }: ModelProps) {
  const m = M();
  const shell = useHeat(m.steel, hot);
  return (
    <group>
      {/* legs with load cells, dished bottom, shell, top head */}
      {Array.from({ length: 4 }).map((_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i}>
            <Cyl r={0.05} len={0.7} pos={[Math.cos(a) * 0.62, FLOOR + 0.35, Math.sin(a) * 0.62]} rot={[0, 0, 0]} mat={m.steel} />
            <Box size={[0.16, 0.06, 0.16]} pos={[Math.cos(a) * 0.62, FLOOR + 0.03, Math.sin(a) * 0.62]} mat={m.darkSteel} />
          </group>
        );
      })}
      <Turned profile={[[0, 0], [0.4, 0.06], [0.65, 0.2], [0.7, 0.3]]} pos={[0, FLOOR + 0.5, 0]} mat={shell} />
      <Cyl r={0.7} len={1.2} pos={[0, FLOOR + 1.4, 0]} rot={[0, 0, 0]} mat={shell} seg={48} />
      <Cyl r={0.73} len={0.7} pos={[0, FLOOR + 1.2, 0]} rot={[0, 0, 0]} mat={m.cladding} seg={48} />
      <Turned profile={[[0.7, 0], [0.6, 0.12], [0.3, 0.2], [0, 0.22]]} pos={[0, FLOOR + 2.0, 0]} mat={shell} />
      {/* manway, sight glass, nozzles, gearmotor on a lantern */}
      <Cyl r={0.17} len={0.12} pos={[0.35, FLOOR + 2.2, 0.15]} rot={[0, 0, 0]} mat={shell} />
      <BoltRing r={0.15} count={10} at={[0.35, FLOOR + 2.27, 0.15]} axis="y" />
      <Cyl r={0.07} len={0.04} pos={[-0.35, FLOOR + 2.2, 0.2]} rot={[0, 0, 0]} mat={m.glass} />
      <Box size={[0.3, 0.3, 0.3]} pos={[0, FLOOR + 2.4, 0]} mat={m.castIron} />
      <group position={[0, FLOOR + 2.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <MotorUnit r={0.15} len={0.45} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Spin speed={spin * 0.6} axis="y" pos={[0, FLOOR + 1.3, 0]}>
        <Cyl r={0.03} len={1.0} pos={[0, 0.5, 0]} rot={[0, 0, 0]} mat={m.chrome} />
      </Spin>
      <Pipe points={[[0, FLOOR + 0.5, 0], [0, FLOOR + 0.25, 0], [0.5, FLOOR + 0.2, 0.5], [1.1, FLOOR + 0.2, 0.5]]} r={0.05} mat={m.steel} />
      <Handwheel pos={[0.7, FLOOR + 0.3, 0.5]} r={0.06} />
      <Pipe points={[[-0.6, FLOOR + 2.1, -0.2], [-0.9, FLOOR + 2.5, -0.3], [-1.0, FLOOR + 2.6, -0.3]]} r={0.04} mat={m.steel} />
      <Gauge pos={[0.55, FLOOR + 1.6, 0.48]} running={running} size={0.06} rot={[0, 0.8, 0]} />
      <Nameplate pos={[0, FLOOR + 1.0, 0.735]} lines={["MIXING VESSEL", "5000 L  SS316", "Jacket 6 bar", "Agitator 45 rpm"]} w={0.26} />
    </group>
  );
}

// ------------------------------------------------------------------ bucket elevator

export function BucketElevator({ spin, hot }: ModelProps) {
  const m = M();
  const casing = useHeat(m.greenPaint, hot);
  const buckets = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (buckets.current) buckets.current.position.y = (buckets.current.position.y + dt * spin * 0.05) % 0.3;
  });
  return (
    <group>
      {/* boot section with inlet chute, two legs, head section with drive */}
      <Box size={[0.9, 0.6, 0.6]} pos={[0, FLOOR + 0.3, 0]} mat={casing} />
      <Box size={[0.4, 0.3, 0.5]} pos={[0.55, FLOOR + 0.55, 0]} rot={[0, 0, -0.6]} mat={casing} />
      {[-0.22, 0.22].map((x) => (
        <Box key={x} size={[0.32, 2.2, 0.4]} pos={[x, FLOOR + 1.7, 0]} mat={casing} />
      ))}
      {/* inspection door with window on the up leg, buckets visible inside */}
      <Box size={[0.26, 0.5, 0.01]} pos={[-0.22, FLOOR + 1.3, 0.205]} mat={m.darkGlass} />
      <group position={[-0.22, FLOOR + 1.1, 0.12]}>
        <group ref={buckets}>
          {[0, 0.3, 0.6].map((y) => (
            <Box key={y} size={[0.2, 0.08, 0.1]} pos={[0, y, 0]} mat={m.steel} />
          ))}
        </group>
      </group>
      <Box size={[0.95, 0.5, 0.6]} pos={[0, FLOOR + 3.05, 0]} mat={casing} />
      <Turned profile={[[0.475, 0], [0.3, 0.25], [0, 0.3]]} pos={[0, FLOOR + 3.3, 0]} mat={casing} />
      <Box size={[0.3, 0.3, 0.5]} pos={[-0.65, FLOOR + 2.85, 0]} rot={[0, 0, 0.6]} mat={casing} />
      <group position={[0.45, FLOOR + 3.05, 0.5]} rotation={[0, Math.PI / 2, 0]}>
        <MotorUnit r={0.13} len={0.35} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Box size={[0.25, 0.25, 0.2]} pos={[0.45, FLOOR + 3.05, 0.3]} mat={m.castIron} />
      {/* access ladder with cage */}
      {[0.55, 0.85].map((x) => (
        <Box key={x} size={[0.03, 2.6, 0.03]} pos={[x, FLOOR + 1.3, -0.35]} mat={m.forkYellow} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <Cyl key={i} r={0.012} len={0.3} pos={[0.7, FLOOR + 0.25 + i * 0.28, -0.35]} mat={m.forkYellow} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <Torus key={i} r={0.3} tube={0.012} pos={[0.7, FLOOR + 1.1 + i * 0.45, -0.6]} rot={[Math.PI / 2, 0, 0]} arc={Math.PI} mat={m.forkYellow} />
      ))}
      <Nameplate pos={[0, FLOOR + 0.35, 0.302]} lines={["BUCKET ELEVATOR", "Cap. 40 t/h", "Centres 3.2 m", "Drive 5.5 kW"]} w={0.26} />
    </group>
  );
}

// ------------------------------------------------------------------ packaged rotary screw air compressor

export function ScrewCompressor({ spin, hot, running }: ModelProps) {
  const m = M();
  const canopy = useHeat(m.toolWhite, hot);
  return (
    <group>
      <Box size={[1.7, 0.12, 0.95]} pos={[0, FLOOR + 0.06, 0]} mat={m.darkPaint} />
      {/* acoustic canopy with removable panels and cooling-air grilles */}
      <Box size={[1.6, 1.45, 0.9]} pos={[0, FLOOR + 0.85, 0]} mat={canopy} />
      <Box size={[0.6, 0.55, 0.012]} pos={[-0.4, FLOOR + 0.7, 0.456]} mat={m.louvreGrey} />
      <Box size={[0.012, 0.6, 0.7]} pos={[0.806, FLOOR + 1.1, 0]} mat={m.louvreGrey} />
      {[-0.45, 0.35].map((x) => (
        <Box key={x} size={[0.04, 0.14, 0.03]} pos={[x + 0.3, FLOOR + 0.85, 0.47]} mat={m.black} />
      ))}
      {/* cooler fan on the roof */}
      <Cyl r={0.36} len={0.08} pos={[0.3, FLOOR + 1.6, 0]} rot={[0, 0, 0]} mat={canopy} />
      <Spin speed={spin * 2} axis="y" pos={[0.3, FLOOR + 1.65, 0]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} size={[0.6, 0.01, 0.1]} pos={[0, 0, 0]} rot={[0.3, (i / 5) * Math.PI, 0]} mat={m.black} />
        ))}
      </Spin>
      <Grille r={0.34} pos={[0.3, FLOOR + 1.68, 0]} rot={[Math.PI / 2, 0, 0]} rings={4} />
      {/* controller with display, emergency stop, outlet and condensate drain */}
      <Box size={[0.32, 0.26, 0.04]} pos={[0.45, FLOOR + 1.25, 0.47]} mat={m.toolGrey} />
      <Box size={[0.18, 0.1, 0.01]} pos={[0.42, FLOOR + 1.29, 0.495]} mat={m.screen} />
      <Cyl r={0.03} len={0.03} pos={[0.56, FLOOR + 1.18, 0.5]} rot={Z_AXIS} mat={m.red} />
      <Gauge pos={[0.1, FLOOR + 1.25, 0.47]} running={running} size={0.06} />
      <Pipe points={[[-0.8, FLOOR + 1.3, 0.2], [-1.0, FLOOR + 1.3, 0.2], [-1.05, FLOOR + 2.0, 0.2]]} r={0.04} mat={m.darkSteel} />
      <Pipe points={[[-0.6, FLOOR + 0.2, 0.46], [-0.6, FLOOR + 0.1, 0.6], [-0.4, FLOOR + 0.03, 0.75]]} r={0.012} mat={m.hose} />
      <Nameplate pos={[0.4, FLOOR + 0.55, 0.456]} lines={["SCREW COMPRESSOR", "37 kW  7.5 bar", "FAD 6.2 m3/min", "Oil-injected"]} w={0.28} />
    </group>
  );
}

// ------------------------------------------------------------------ pulse-jet dust collector with cyclone

export function DustCollector({ spin, hot }: ModelProps) {
  const m = M();
  const body = useHeat(m.galvanized, hot);
  return (
    <group>
      {/* support structure, hopper, bag house, clean-air plenum with pulse valves */}
      {[[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.08, 1.0, 0.08]} pos={[x, FLOOR + 0.5, z]} mat={m.darkPaint} />
      ))}
      <Turned profile={[[0.12, 0], [0.75, 0.55]]} pos={[0, FLOOR + 0.55, 0]} seg={4} rot={[0, Math.PI / 4, 0]} mat={body} />
      <Box size={[1.1, 1.2, 1.0]} pos={[0, FLOOR + 1.7, 0]} mat={body} />
      <Box size={[1.12, 0.35, 1.02]} pos={[0, FLOOR + 2.47, 0]} mat={body} />
      {Array.from({ length: 4 }).map((_, i) => (
        <group key={i}>
          <Box size={[0.08, 0.12, 0.08]} pos={[-0.36 + i * 0.24, FLOOR + 2.72, 0.35]} mat={m.toolGrey} />
          <Pipe points={[[-0.36 + i * 0.24, FLOOR + 2.66, 0.35], [-0.36 + i * 0.24, FLOOR + 2.66, -0.4]]} r={0.015} mat={m.steel} />
        </group>
      ))}
      <Cyl r={0.12} len={1.0} pos={[0, FLOOR + 2.72, 0.5]} mat={m.toolGrey} />
      {/* access doors, rotary airlock at the hopper outlet */}
      <Box size={[0.4, 0.5, 0.012]} pos={[0, FLOOR + 1.7, 0.506]} mat={body} />
      {[0, 1].map((i) => (
        <Box key={i} size={[0.06, 0.04, 0.04]} pos={[0.15, FLOOR + 1.55 + i * 0.3, 0.52]} mat={m.black} />
      ))}
      <Box size={[0.24, 0.2, 0.24]} pos={[0, FLOOR + 0.45, 0]} mat={m.castIron} />
      <Spin speed={spin * 0.4} axis="z" pos={[0, FLOOR + 0.45, 0.13]}>
        <Box size={[0.18, 0.02, 0.01]} pos={[0, 0, 0]} mat={m.steel} />
      </Spin>
      {/* inlet cyclone and duct, exhaust fan on the side */}
      <Cyl r={0.25} len={0.6} pos={[-1.1, FLOOR + 1.9, 0]} rot={[0, 0, 0]} mat={body} />
      <Turned profile={[[0.06, 0], [0.25, 0.7]]} pos={[-1.1, FLOOR + 0.9, 0]} mat={body} />
      <Pipe points={[[-0.85, FLOOR + 2.05, 0], [-0.55, FLOOR + 2.05, 0]]} r={0.1} mat={body} />
      <Pipe points={[[-1.1, FLOOR + 2.2, 0], [-1.1, FLOOR + 2.7, 0], [-1.5, FLOOR + 2.8, 0]]} r={0.12} mat={body} />
      <group position={[0.95, FLOOR + 2.3, -0.3]}>
        <Cyl r={0.28} len={0.22} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.motorBlue} />
        <group position={[0, 0, -0.35]} rotation={[0, Math.PI / 2, 0]}>
          <MotorUnit r={0.1} len={0.26} paint={m.motorBlue} spin={spin} plate={false} />
        </group>
      </group>
      <Gauge pos={[0.4, FLOOR + 2.0, 0.51]} running size={0.06} />
      <Nameplate pos={[-0.3, FLOOR + 2.0, 0.506]} lines={["DUST COLLECTOR", "36 bags", "6000 m3/h", "dP < 150 mmWC"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ shell-and-tube heat exchanger

export function HeatExchanger({ hot, running }: ModelProps) {
  const m = M();
  const shell = useHeat(m.boilerRed, hot);
  const cy = FLOOR + 0.75;
  return (
    <group>
      {[-0.8, 0.8].map((x) => (
        <group key={x}>
          <Box size={[0.14, 0.5, 0.7]} pos={[x, FLOOR + 0.25, 0]} mat={m.darkPaint} />
          <Box size={[0.3, 0.03, 0.8]} pos={[x, FLOOR + 0.015, 0]} mat={m.darkPaint} />
        </group>
      ))}
      <Cyl r={0.35} len={2.3} pos={[0, cy, 0]} mat={shell} seg={48} />
      {/* channel head with pass partition flange and bolted cover; floating head at the far end */}
      {[-1.2, 1.2].map((x) => (
        <group key={x}>
          <Cyl r={0.42} len={0.08} pos={[x, cy, 0]} mat={shell} />
          <BoltRing r={0.39} count={16} at={[x + (x > 0 ? 0.045 : -0.045), cy, 0]} />
        </group>
      ))}
      <Cyl r={0.36} len={0.3} pos={[-1.4, cy, 0]} mat={m.castIron} />
      <Turned profile={[[0.36, 0], [0.3, 0.08], [0, 0.12]]} pos={[1.24, cy, 0]} rot={[0, 0, -Math.PI / 2]} mat={shell} />
      {/* shell-side and tube-side nozzles with flanges */}
      {[[-0.7, 1], [0.7, -1]].map(([x, s]) => (
        <group key={x}>
          <Cyl r={0.09} len={0.3} pos={[x, cy + s * 0.45, 0]} rot={[0, 0, 0]} mat={shell} />
          <Cyl r={0.14} len={0.03} pos={[x, cy + s * 0.6, 0]} rot={[0, 0, 0]} mat={shell} />
        </group>
      ))}
      {[0.2, -0.2].map((y) => (
        <Pipe key={y} points={[[-1.4, cy + y, 0.25], [-1.4, cy + y, 0.6], [-1.6, cy + y, 0.8]]} r={0.07} mat={m.darkPaint} />
      ))}
      <Gauge pos={[-0.7, cy + 0.72, 0.1]} running={running} size={0.06} />
      <Gauge pos={[-1.4, cy + 0.45, 0.2]} running={running} size={0.05} />
      <Cyl r={0.02} len={0.15} pos={[0.2, cy + 0.42, 0]} rot={[0, 0, 0]} mat={m.brass} />
      <Nameplate pos={[0, cy, 0.352]} lines={["HEAT EXCHANGER", "Shell 10 bar", "Tube 16 bar", "Area 48 m2"]} w={0.24} />
    </group>
  );
}

// ------------------------------------------------------------------ vertical form-fill-seal packing machine

export function Packer({ spin, hot, running }: ModelProps) {
  const m = M();
  const frame = useHeat(m.steel, hot);
  const jaws = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (jaws.current) jaws.current.scale.x = running && spin > 0 ? 0.6 + Math.abs(Math.sin(clock.elapsedTime * 2.5)) * 0.4 : 1;
  });
  return (
    <group>
      {/* stainless frame and guarded front with windows */}
      <Box size={[1.1, 1.6, 0.9]} pos={[0, FLOOR + 0.8, 0]} mat={frame} />
      <Box size={[0.8, 0.9, 0.012]} pos={[0, FLOOR + 1.05, 0.456]} mat={m.glass} />
      {/* forming tube, sealing jaws, falling bags */}
      <Cyl r={0.1} len={0.6} pos={[0, FLOOR + 1.3, 0.3]} rot={[0, 0, 0]} mat={m.chrome} />
      <group ref={jaws} position={[0, FLOOR + 0.92, 0.3]}>
        <Box size={[0.36, 0.06, 0.08]} pos={[0, 0, 0]} mat={m.toolGrey} />
      </group>
      {[0.6, 0.35].map((y) => (
        <Box key={y} size={[0.18, 0.2, 0.06]} pos={[0, FLOOR + y, 0.3]} mat={m.amber} />
      ))}
      {/* multihead weigher on top: dispersion cone and buckets in a ring */}
      <Box size={[0.9, 0.12, 0.9]} pos={[0, FLOOR + 1.66, 0]} mat={frame} />
      <Cyl r={0.15} len={0.6} pos={[0, FLOOR + 2.0, 0]} rot={[0, 0, 0]} mat={frame} />
      <Spin speed={spin * 0.3} axis="y" pos={[0, FLOOR + 2.0, 0]}>
        <Turned profile={[[0, 0.38], [0.4, 0.28], [0.42, 0.26]]} pos={[0, 0, 0]} mat={m.chrome} />
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <Box key={i} size={[0.12, 0.16, 0.08]} pos={[Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38]} rot={[0, -a, 0]} mat={frame} />;
        })}
      </Spin>
      {/* film reel at the back, discharge conveyor, HMI */}
      <Spin speed={spin * 0.5} axis="z" pos={[0, FLOOR + 0.7, -0.6]}>
        <Cyl r={0.28} len={0.5} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.cream} />
      </Spin>
      <Box size={[1.4, 0.05, 0.35]} pos={[0.9, FLOOR + 0.25, 0.45]} mat={m.rubber} />
      {[0.4, 1.4].map((x) => (
        <Box key={x} size={[0.04, 0.25, 0.3]} pos={[x, FLOOR + 0.12, 0.45]} mat={frame} />
      ))}
      <Box size={[0.36, 0.28, 0.06]} pos={[0.65, FLOOR + 1.35, 0.4]} rot={[0, -0.4, 0]} mat={m.toolGrey} />
      <Box size={[0.26, 0.16, 0.01]} pos={[0.66, FLOOR + 1.37, 0.44]} rot={[0, -0.4, 0]} mat={m.screen} />
      <Nameplate pos={[-0.3, FLOOR + 0.35, 0.452]} lines={["VFFS PACKER", "60 bags/min", "Film 520 mm", "10-head weigher"]} w={0.24} />
    </group>
  );
}
