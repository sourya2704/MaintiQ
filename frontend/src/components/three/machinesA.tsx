import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import type * as THREE from "three";
import { BoltRing, Box, Cyl, FLOOR, Gauge, Grille, Handwheel, M, Nameplate, Pipe, Spin, Torus, Turned, useHeat, Z_AXIS, type Mat, type V3 } from "./parts";

export interface ModelProps {
  spin: number; // rad/s of rotating parts; 0 when stopped
  hot: boolean;
  running: boolean;
}

// ------------------------------------------------------------------ electric motor (TEFC, IEC foot-mounted)

/**
 * Totally enclosed fan-cooled induction motor, shaft along +X, centred on the shaft.
 * Cooling fins run the length of the frame; the fan cowl sits at the non-drive end (-X).
 */
export function MotorUnit({ r = 0.42, len = 1.1, paint, spin, plate = true }: { r?: number; len?: number; paint: Mat; spin: number; plate?: boolean }) {
  const m = M();
  const half = len / 2;
  const fins = 28;
  return (
    <group>
      {/* frame and cooling fins */}
      <Cyl r={r} len={len} pos={[0, 0, 0]} mat={paint} seg={56} />
      {Array.from({ length: fins }).map((_, i) => {
        const a = (i / fins) * Math.PI * 2;
        if (Math.sin(a) < -0.55) return null; // no fins where the feet are
        return <Box key={i} size={[len * 0.94, 0.07, 0.016]} pos={[0, Math.sin(a) * (r + 0.03), Math.cos(a) * (r + 0.03)]} rot={[a, 0, 0]} mat={paint} />;
      })}
      {/* drive-end shield with bearing cap */}
      <Turned profile={[[0, 0], [r * 0.98, 0], [r * 0.95, 0.06], [r * 0.6, 0.12], [r * 0.3, 0.14], [0, 0.14]]} pos={[half, 0, 0]} rot={[0, 0, -Math.PI / 2]} mat={paint} />
      <BoltRing r={r * 0.82} count={8} at={[half + 0.04, 0, 0]} />
      {/* shaft with key */}
      <Spin speed={spin}>
        <Cyl r={0.07} len={0.42} pos={[half + 0.32, 0, 0]} mat={m.steel} />
        <Box size={[0.22, 0.03, 0.03]} pos={[half + 0.36, 0.07, 0]} mat={m.darkSteel} />
      </Spin>
      {/* non-drive end: fan cowl with grille */}
      <Turned profile={[[r * 1.04, 0], [r * 1.06, 0.18], [r * 0.95, 0.28], [0, 0.3]]} pos={[-half, 0, 0]} rot={[0, 0, Math.PI / 2]} mat={paint} />
      <Grille r={r * 0.78} pos={[-half - 0.305, 0, 0]} rot={[0, Math.PI / 2, 0]} rings={5} />
      {/* feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <Box size={[0.2, r * 0.75, 0.12]} pos={[sx * half * 0.6, -r * 0.62, sz * r * 0.62]} mat={paint} />
            <Box size={[0.26, 0.05, 0.2]} pos={[sx * half * 0.6, -r - 0.02, sz * r * 0.7]} mat={paint} />
          </group>
        )),
      )}
      {/* terminal box with cable gland */}
      <Box size={[0.32, 0.18, 0.3]} pos={[0.05, r + 0.1, 0]} mat={paint} />
      <Box size={[0.34, 0.03, 0.32]} pos={[0.05, r + 0.2, 0]} mat={paint} />
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.012} len={0.02} pos={[0.05 + sx * 0.14, r + 0.22, sz * 0.13]} rot={[0, 0, 0]} mat={m.steel} seg={6} />))}
      <Cyl r={0.035} len={0.08} pos={[0.05, r + 0.1, -0.19]} rot={Z_AXIS} mat={m.brass} seg={6} />
      {/* lifting eye */}
      <Torus r={0.05} tube={0.014} pos={[-0.25, r + 0.07, 0]} rot={[0, 0, 0]} mat={m.steel} />
      {plate && <Nameplate pos={[-0.2, 0.05, r + 0.065]} lines={["3~ MOTOR IE3", "7.5 kW  1460 rpm", "415 V  14.2 A", "IP55  Ins. F"]} w={0.24} />}
    </group>
  );
}

/** Flexible jaw coupling between two shafts on X; spins with the drive. */
function Coupling({ x, spin, y = 0 }: { x: number; spin: number; y?: number }) {
  const m = M();
  return (
    <Spin speed={spin} pos={[x, y, 0]}>
      <Cyl r={0.11} len={0.1} pos={[-0.06, 0, 0]} mat={m.castIron} seg={24} />
      <Cyl r={0.11} len={0.1} pos={[0.06, 0, 0]} mat={m.castIron} seg={24} />
      <Cyl r={0.1} len={0.03} pos={[0, 0, 0]} mat={m.safetyOrange} seg={12} />
    </Spin>
  );
}

export function Motor({ spin, hot }: ModelProps) {
  const m = M();
  const body = useHeat(m.motorBlue, hot);
  return (
    <group position={[0, -0.12, 0]}>
      {/* slide rails on a plinth */}
      <Box size={[1.9, 0.18, 1.2]} pos={[0.1, FLOOR + 0.21, 0]} mat={m.grout} />
      {[-0.32, 0.32].map((z) => (
        <Box key={z} size={[1.5, 0.08, 0.14]} pos={[0.05, FLOOR + 0.34, z]} mat={m.darkPaint} />
      ))}
      <group position={[0, FLOOR + 0.84, 0]}>
        <MotorUnit paint={body} spin={spin} />
      </group>
      <Coupling x={0.95} y={FLOOR + 0.84} spin={spin} />
      {/* conduit from the terminal box down the back to the floor */}
      <Pipe points={[[0.05, FLOOR + 1.36, -0.19], [0.05, FLOOR + 1.4, -0.45], [0.05, FLOOR + 1.0, -0.66], [0.05, FLOOR + 0.3, -0.7], [-0.6, FLOOR + 0.05, -0.75]]} r={0.025} mat={m.hose} />
    </group>
  );
}

// ------------------------------------------------------------------ end-suction centrifugal pump set

/** Volute casing: a spiral that grows toward the discharge, made from a swept circle. */
function Volute({ mat }: { mat: Mat }) {
  const geo = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = t * Math.PI * 1.75 - Math.PI * 0.25;
      const rr = 0.26 + t * 0.07;
      pts.push([0, Math.sin(a) * rr, Math.cos(a) * rr] as V3);
    }
    return pts;
  }, []);
  return (
    <group>
      <Cyl r={0.3} len={0.2} pos={[0, 0, 0]} mat={mat} seg={40} />
      <Pipe points={geo} r={0.11} mat={mat} />
    </group>
  );
}

export function Pump({ spin, hot, running }: ModelProps) {
  const m = M();
  const casing = useHeat(m.pumpBlue, hot);
  const y = FLOOR + 0.58;
  return (
    <group>
      {/* grouted fabricated baseplate */}
      <Box size={[3.0, 0.14, 1.05]} pos={[0, FLOOR + 0.07, 0]} mat={m.grout} />
      <Box size={[2.85, 0.12, 0.9]} pos={[0, FLOOR + 0.2, 0]} mat={m.darkPaint} />
      <Box size={[2.85, 0.03, 0.92]} pos={[0, FLOOR + 0.27, 0]} mat={m.pumpBlue} />
      {/* casing: volute with axial suction (-X) and top discharge */}
      <group position={[-0.95, y, 0]}>
        <Volute mat={casing} />
        <Cyl r={0.16} len={0.28} pos={[-0.22, 0, 0]} mat={casing} />
        <Cyl r={0.21} len={0.04} pos={[-0.37, 0, 0]} mat={casing} />
        <BoltRing r={0.18} count={8} at={[-0.39, 0, 0]} />
        <Cyl r={0.12} len={0.3} pos={[0, 0.46, -0.1]} rot={[0, 0, 0]} mat={casing} />
        <Cyl r={0.17} len={0.04} pos={[0, 0.62, -0.1]} rot={[0, 0, 0]} mat={casing} />
        <BoltRing r={0.14} count={8} at={[0, 0.64, -0.1]} axis="y" />
        <Gauge pos={[0.16, 0.5, -0.1]} running={running} rot={[0, Math.PI / 2, 0]} />
        {/* casing foot and drain plug */}
        <Box size={[0.24, 0.22, 0.3]} pos={[0, -0.36, 0]} mat={casing} />
        <Cyl r={0.025} len={0.04} pos={[0, -0.28, 0.17]} rot={Z_AXIS} mat={m.brass} seg={6} />
      </group>
      {/* seal chamber and bearing frame */}
      <Cyl r={0.17} len={0.18} pos={[-0.68, y, 0]} mat={m.pumpBlue} />
      <Cyl r={0.13} len={0.38} pos={[-0.4, y, 0]} mat={m.pumpBlue} />
      <Box size={[0.3, 0.26, 0.22]} pos={[-0.4, y - 0.2, 0]} mat={m.pumpBlue} />
      <Cyl r={0.025} len={0.05} pos={[-0.4, y + 0.15, 0]} rot={[0, 0, 0]} mat={m.glass} />
      <Spin speed={spin} pos={[0, y, 0]}>
        <Cyl r={0.04} len={0.3} pos={[-0.08, 0, 0]} mat={m.steel} />
      </Spin>
      {/* coupling guard, open-mesh orange */}
      <Box size={[0.42, 0.34, 0.34]} pos={[0.02, y, 0]} mat={m.safetyOrange} />
      <Coupling x={0.02} y={y} spin={spin} />
      {/* motor */}
      {/* motor turned round so its shaft meets the coupling */}
      <group position={[0.78, y, 0]} rotation={[0, Math.PI, 0]}>
        <MotorUnit r={0.3} len={0.9} paint={m.motorBlue} spin={spin} plate />
      </group>
      {/* suction and discharge spools */}
      <Pipe points={[[-1.36, y, 0], [-1.5, y, 0]]} r={0.15} mat={m.darkPaint} />
      <Pipe points={[[-0.95, y + 0.66, -0.1], [-0.95, y + 0.9, -0.1], [-0.95, y + 1.0, -0.3]]} r={0.12} mat={m.darkPaint} />
      <Handwheel pos={[-0.95, y + 0.86, 0.08]} r={0.09} />
    </group>
  );
}

// ------------------------------------------------------------------ troughed belt conveyor

export function Conveyor({ spin, hot }: ModelProps) {
  const m = M();
  const frame = useHeat(m.frameOchre, hot);
  const len = 3.0;
  const top = FLOOR + 0.92;
  const belt = useMemo(() => {
    const mat = m.belt.clone();
    mat.map = m.belt.map!.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(1, 10);
    return mat;
  }, [m.belt]);
  return (
    <group>
      <BeltMover mat={belt} speed={spin * 0.04} />
      {/* stringers (channel) and legs with cross bracing */}
      {[-0.42, 0.42].map((z) => (
        <group key={z}>
          <Box size={[len, 0.16, 0.06]} pos={[0, top - 0.18, z]} mat={frame} />
          {[-1.25, 0, 1.25].map((x) => (
            <group key={x}>
              <Box size={[0.08, top - FLOOR - 0.26, 0.08]} pos={[x, (top - 0.26 + FLOOR) / 2, z]} mat={frame} />
              <Box size={[0.18, 0.02, 0.18]} pos={[x, FLOOR + 0.01, z]} mat={m.darkSteel} />
            </group>
          ))}
        </group>
      ))}
      {[-1.25, 0, 1.25].map((x) => (
        <Box key={x} size={[0.05, 0.05, 0.84]} pos={[x, FLOOR + 0.35, 0]} mat={frame} />
      ))}
      {/* troughing idler sets: centre roll plus two inclined wing rolls */}
      {Array.from({ length: 6 }).map((_, i) => {
        const x = -1.2 + i * 0.48;
        return (
          <group key={i} position={[x, top - 0.06, 0]}>
            <Box size={[0.06, 0.05, 0.86]} pos={[0, -0.08, 0]} mat={frame} />
            <Spin speed={spin * 2} axis="z">
              <Cyl r={0.045} len={0.3} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.darkSteel} />
            </Spin>
            {[-1, 1].map((s) => (
              <Cyl key={s} r={0.045} len={0.26} pos={[0, 0.07, s * 0.28]} rot={[Math.PI / 2 + s * 0.45, 0, 0]} mat={m.darkSteel} />
            ))}
          </group>
        );
      })}
      {/* head (drive) pulley with lagging, tail pulley with take-up */}
      <Spin speed={spin} axis="z" pos={[len / 2, top - 0.04, 0]}>
        <Cyl r={0.17} len={0.82} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.rubber} />
        <Cyl r={0.04} len={1.1} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.steel} />
      </Spin>
      <Spin speed={spin} axis="z" pos={[-len / 2, top - 0.04, 0]}>
        <Cyl r={0.15} len={0.82} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.darkSteel} />
        <Cyl r={0.04} len={1.1} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.steel} />
      </Spin>
      {[-0.52, 0.52].map((z) => (
        <group key={z}>
          <Box size={[0.2, 0.16, 0.08]} pos={[len / 2, top - 0.04, z]} mat={m.castIron} />
          <Box size={[0.32, 0.12, 0.08]} pos={[-len / 2 - 0.05, top - 0.04, z]} mat={m.castIron} />
        </group>
      ))}
      {/* shaft-mounted gear motor on the head pulley */}
      <group position={[len / 2, top - 0.04, 0.78]}>
        <Box size={[0.36, 0.34, 0.26]} pos={[0, 0, 0]} mat={m.castIron} />
        <group position={[0, 0.06, 0.32]} rotation={[0, Math.PI / 2, 0]}>
          <MotorUnit r={0.16} len={0.42} paint={m.motorBlue} spin={spin} plate={false} />
        </group>
        <Box size={[0.05, 0.6, 0.05]} pos={[0.12, -0.3, -0.02]} mat={m.darkSteel} />
      </group>
      {/* pull-wire emergency stop along the walkway side */}
      <Pipe points={[[-len / 2, top + 0.12, -0.5], [len / 2, top + 0.12, -0.5]]} r={0.006} mat={m.amber} />
      <Box size={[0.1, 0.14, 0.08]} pos={[len / 2 - 0.1, top + 0.08, -0.52]} mat={m.amber} />
      {/* product on the belt */}
      {[-0.8, 0.1, 0.9].map((x, i) => (
        <Box key={x} size={[0.36, 0.24 + i * 0.03, 0.3]} pos={[x, top + 0.14 + i * 0.015, 0]} rot={[0, i * 0.15, 0]} mat={m.cardboard} />
      ))}
    </group>
  );
}

/** Carrying and return belt; the tread texture scrolls so the belt visibly travels. */
function BeltMover({ mat, speed }: { mat: Mat; speed: number }) {
  useFrame((_, dt) => {
    const map = (mat as THREE.MeshStandardMaterial).map;
    if (map) map.offset.y -= dt * speed;
  });
  return (
    <group>
      <Box size={[3.0, 0.02, 0.8]} pos={[0, FLOOR + 0.92, 0]} mat={mat} />
      <Box size={[3.0, 0.02, 0.76]} pos={[0, FLOOR + 0.62, 0]} mat={mat} />
    </group>
  );
}

// ------------------------------------------------------------------ tank-mounted two-stage compressor

export function Compressor({ spin, hot, running }: ModelProps) {
  const m = M();
  const tank = useHeat(m.cream, hot);
  const ty = FLOOR + 0.48;
  return (
    <group>
      {/* horizontal receiver with dished ends on saddles */}
      <Cyl r={0.36} len={1.9} pos={[0, ty, 0]} mat={tank} seg={56} />
      {[-1, 1].map((s) => (
        <Turned key={s} profile={[[0.36, 0], [0.35, 0.06], [0.28, 0.14], [0.14, 0.19], [0, 0.2]]} pos={[s * 0.95, ty, 0]} rot={[0, 0, (-s * Math.PI) / 2]} mat={tank} />
      ))}
      {[-0.6, 0.6].map((x) => (
        <group key={x}>
          <Box size={[0.12, 0.2, 0.62]} pos={[x, FLOOR + 0.1, 0]} mat={m.darkPaint} />
          <Box size={[0.22, 0.02, 0.7]} pos={[x, FLOOR + 0.01, 0]} mat={m.darkPaint} />
        </group>
      ))}
      <Nameplate pos={[0.1, ty + 0.05, 0.362]} lines={["AIR RECEIVER", "270 L  12 bar", "Hydro test 18 bar", "Insp. 03/2026"]} w={0.28} />
      {/* deck plate */}
      <Box size={[1.3, 0.04, 0.62]} pos={[0, ty + 0.38, 0]} mat={m.darkPaint} />
      {/* V-twin pump: crankcase, two finned cylinders, heads, intercooler */}
      <group position={[-0.25, ty + 0.4, 0]}>
        <Box size={[0.42, 0.26, 0.36]} pos={[0, 0.13, 0]} mat={hot ? tank : m.castRed} />
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.13, 0.36, 0]} rotation={[0, 0, -s * 0.5]}>
            <Cyl r={0.1} len={0.26} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.castRed} />
            {Array.from({ length: 6 }).map((_, i) => (
              <Cyl key={i} r={0.14} len={0.012} pos={[0, -0.1 + i * 0.04, 0]} rot={[0, 0, 0]} mat={m.castRed} />
            ))}
            <Box size={[0.24, 0.07, 0.24]} pos={[0, 0.16, 0]} mat={m.castIron} />
          </group>
        ))}
        <Pipe points={[[-0.25, 0.5, 0.05], [-0.1, 0.62, 0.18], [0.1, 0.62, 0.18], [0.25, 0.5, 0.05]]} r={0.02} mat={m.copper} />
        <Pipe points={[[0.25, 0.48, 0], [0.4, 0.3, 0.1], [0.45, -0.05, 0.2], [0.45, -0.3, 0.2]]} r={0.022} mat={m.copper} />
        {/* flywheel with spokes, behind a belt guard */}
        <Spin speed={spin} axis="z" pos={[0, 0.13, 0.27]}>
          <Torus r={0.27} tube={0.03} pos={[0, 0, 0]} rot={[0, 0, 0]} mat={m.castRed} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} size={[0.5, 0.025, 0.02]} pos={[0, 0, 0]} rot={[0, 0, (i / 6) * Math.PI]} mat={m.castRed} />
          ))}
        </Spin>
        <Box size={[1.05, 0.62, 0.06]} pos={[0.32, 0.1, 0.37]} mat={m.safetyOrange} />
        <Box size={[0.98, 0.55, 0.004]} pos={[0.32, 0.1, 0.402]} mat={m.louvreGrey} />
      </group>
      {/* drive motor */}
      <group position={[0.45, ty + 0.62, -0.05]}>
        <MotorUnit r={0.18} len={0.5} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      {/* pressure switch, gauge, safety valve, drain */}
      <Box size={[0.14, 0.18, 0.1]} pos={[0.65, ty + 0.5, 0.24]} mat={m.panelGrey} />
      <Gauge pos={[0.82, ty + 0.5, 0.2]} running={running} />
      <Cyl r={0.025} len={0.16} pos={[0.95, ty + 0.46, 0]} rot={[0, 0, 0]} mat={m.brass} />
      <Turned profile={[[0.03, 0], [0.05, 0.03], [0.02, 0.1], [0, 0.12]]} pos={[0.95, ty + 0.54, 0]} mat={m.brass} />
      <Cyl r={0.02} len={0.1} pos={[0, FLOOR + 0.07, 0.2]} rot={[0, 0, 0]} mat={m.brass} />
    </group>
  );
}

// ------------------------------------------------------------------ helical gear reducer

export function Gearbox({ spin, hot }: ModelProps) {
  const m = M();
  const housing = useHeat(m.castIron, hot);
  const y = FLOOR + 0.55;
  return (
    <group>
      <Box size={[1.7, 0.16, 1.0]} pos={[0, FLOOR + 0.08, 0]} mat={m.grout} />
      {/* split housing: lower half, flange line, upper cover with ribs */}
      <Box size={[1.0, 0.44, 0.62]} pos={[0, y - 0.1, 0]} mat={housing} />
      <Box size={[1.08, 0.05, 0.7]} pos={[0, y + 0.14, 0]} mat={housing} />
      <Box size={[0.96, 0.3, 0.58]} pos={[0, y + 0.31, 0]} mat={housing} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} size={[0.03, 0.32, 0.64]} pos={[-0.4 + i * 0.16, y + 0.3, 0]} mat={housing} />
      ))}
      {/* flange bolts along the split line */}
      {Array.from({ length: 7 }).map((_, i) => [-0.33, 0.33].map((z) => <Cyl key={`${i}${z}`} r={0.018} len={0.04} pos={[-0.45 + i * 0.15, y + 0.18, z]} rot={[0, 0, 0]} mat={m.steel} seg={6} />))}
      {/* inspection cover, breather, oil sight glass, drain */}
      <Box size={[0.36, 0.03, 0.26]} pos={[0.1, y + 0.47, 0]} mat={m.darkPaint} />
      <Cyl r={0.03} len={0.1} pos={[-0.2, y + 0.52, 0]} rot={[0, 0, 0]} mat={m.brass} />
      <Cyl r={0.05} len={0.02} pos={[0.25, y - 0.15, 0.315]} rot={Z_AXIS} mat={m.oil} />
      <Torus r={0.055} tube={0.008} pos={[0.25, y - 0.15, 0.322]} rot={[0, 0, 0]} mat={m.steel} />
      {/* feet */}
      {[-0.42, 0.42].map((x) => (
        <Box key={x} size={[0.22, 0.06, 0.82]} pos={[x, FLOOR + 0.19, 0]} mat={housing} />
      ))}
      {/* lifting lugs */}
      {[-0.4, 0.4].map((x) => (
        <Torus key={x} r={0.05} tube={0.018} pos={[x, y + 0.5, 0]} rot={[0, Math.PI / 2, 0]} mat={housing} />
      ))}
      {/* high-speed input (left, upper) and low-speed output (right, lower, heavy) */}
      <Spin speed={spin} pos={[-0.5, y + 0.25, 0]}>
        <Cyl r={0.045} len={0.4} pos={[-0.2, 0, 0]} mat={m.steel} />
      </Spin>
      <Cyl r={0.11} len={0.06} pos={[-0.53, y + 0.25, 0]} mat={housing} />
      <Spin speed={spin / 6} pos={[0.5, y - 0.05, 0]}>
        <Cyl r={0.09} len={0.44} pos={[0.22, 0, 0]} mat={m.steel} />
        <Box size={[0.3, 0.035, 0.04]} pos={[0.28, 0.09, 0]} mat={m.darkSteel} />
      </Spin>
      <Cyl r={0.17} len={0.08} pos={[0.53, y - 0.05, 0]} mat={housing} />
      <BoltRing r={0.13} count={6} at={[0.58, y - 0.05, 0]} />
      <Nameplate pos={[-0.15, y - 0.08, 0.312]} lines={["HELICAL REDUCER", "i = 12.5", "Tmax 1850 Nm", "Oil VG 220  6 L"]} w={0.26} />
      {/* input motor on a lantern */}
      <group position={[-1.05, y + 0.25, 0]}>
        <MotorUnit r={0.2} len={0.55} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Box size={[0.42, 0.3, 0.42]} pos={[-1.05, FLOOR + 0.35, 0]} mat={m.darkPaint} />
    </group>
  );
}

