import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { ModelProps } from "./machinesA";
import { MotorUnit } from "./machinesA";
import { BoltRing, Box, Cyl, FLOOR, Gauge, Grille, Handwheel, M, Nameplate, Pipe, Spin, Torus, Turned, useHeat, Z_AXIS, type Mat } from "./parts";

// ------------------------------------------------------------------ centrifugal fan (belt-driven, arrangement 9)

/** Scroll housing: a spiral side profile extruded to the housing width (along Z). */
function Scroll({ mat, width }: { mat: Mat; width: number }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const turns = 64;
    for (let i = 0; i <= turns; i++) {
      const a = (i / turns) * Math.PI * 1.65 + Math.PI * 0.35;
      const r = 0.42 + (i / turns) * 0.24;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.lineTo(0.66, 0.52); // outlet throat runs up to the discharge
    s.lineTo(0.66, 0.92);
    s.lineTo(0.12, 0.92);
    s.lineTo(Math.cos(Math.PI * 0.35) * 0.42, Math.sin(Math.PI * 0.35) * 0.42);
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 48 });
    g.translate(0, 0, -width / 2);
    return g;
  }, [width]);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

export function Fan({ spin, hot }: ModelProps) {
  const m = M();
  const housing = useHeat(m.motorBlue, hot);
  const cy = FLOOR + 0.82;
  return (
    <group>
      <Box size={[2.2, 0.12, 1.3]} pos={[0.2, FLOOR + 0.06, 0]} mat={m.grout} />
      {/* support stand */}
      <Box size={[1.5, 0.08, 0.9]} pos={[0, FLOOR + 0.16, 0]} mat={m.darkPaint} />
      {[-0.55, 0.55].map((x) => [-0.35, 0.35].map((z) => <Box key={`${x}${z}`} size={[0.08, 0.3, 0.08]} pos={[x, FLOOR + 0.34, z]} mat={m.darkPaint} />))}
      <group position={[-0.1, cy, 0]}>
        <Scroll mat={housing} width={0.46} />
        {/* inlet cone and guard on the front face */}
        <Turned profile={[[0.32, 0], [0.3, 0.06], [0.24, 0.16], [0.23, 0.2]]} pos={[0, 0, 0.24]} rot={[Math.PI / 2, 0, 0]} mat={housing} />
        <Grille r={0.26} pos={[0, 0, 0.45]} rings={5} />
        {/* impeller seen through the inlet: backward-curved blades */}
        <Spin speed={spin * 1.6} axis="z">
          <Cyl r={0.36} len={0.02} pos={[0, 0, -0.12]} rot={Z_AXIS} mat={m.galvanized} />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <Box key={i} size={[0.2, 0.012, 0.3]} pos={[Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0]} rot={[0, 0, a + 0.6]} mat={m.galvanized} />;
          })}
        </Spin>
        {/* discharge flange */}
        <Box size={[0.62, 0.05, 0.56]} pos={[0.39, 0.93, 0]} mat={housing} />
        <Nameplate pos={[-0.3, -0.25, 0.25]} lines={["CENTRIFUGAL FAN", "Q 4.2 m3/s", "dP 1650 Pa", "1180 rpm"]} w={0.24} />
      </group>
      {/* drive side: bearing pedestal, shaft, belt guard, motor on slide base */}
      <Box size={[0.2, 0.36, 0.2]} pos={[-0.1, FLOOR + 0.52, -0.42]} mat={m.castIron} />
      <Spin speed={spin * 1.6} axis="z" pos={[-0.1, cy, -0.5]}>
        <Cyl r={0.05} len={0.3} pos={[0, 0, 0]} rot={Z_AXIS} mat={m.steel} />
      </Spin>
      <group position={[0.3, FLOOR + 0.62, -0.62]}>
        <Box size={[0.95, 0.62, 0.16]} pos={[0, 0.06, 0]} mat={m.safetyOrange} />
        <Box size={[0.88, 0.55, 0.004]} pos={[0, 0.06, -0.082]} mat={m.louvreGrey} />
      </group>
      <group position={[0.7, FLOOR + 0.42, -0.3]} rotation={[0, Math.PI / 2, 0]}>
        <MotorUnit r={0.2} len={0.6} paint={m.motorBlue} spin={spin} plate={false} />
      </group>
      <Box size={[0.5, 0.08, 0.6]} pos={[0.7, FLOOR + 0.18, -0.3]} mat={m.darkSteel} />
    </group>
  );
}

// ------------------------------------------------------------------ diesel generator set in an acoustic canopy

export function Generator({ spin, hot, running }: ModelProps) {
  const m = M();
  const canopy = useHeat(m.gensetYellow, hot);
  const L = 2.6;
  const H = 1.25;
  const W = 1.05;
  const base = FLOOR + 0.16;
  return (
    <group>
      {/* base frame doubles as the fuel tank */}
      <Box size={[L + 0.1, 0.32, W + 0.1]} pos={[0, FLOOR + 0.16, 0]} mat={m.darkPaint} />
      <Cyl r={0.05} len={0.06} pos={[-0.9, FLOOR + 0.34, W / 2 + 0.02]} rot={Z_AXIS} mat={m.black} seg={8} />
      {/* canopy body, roof and louvred panels */}
      <Box size={[L, H, W]} pos={[0, base + 0.16 + H / 2, 0]} mat={canopy} />
      <Box size={[L + 0.06, 0.05, W + 0.06]} pos={[0, base + 0.16 + H + 0.02, 0]} mat={canopy} />
      {[-1, 1].map((side) => (
        <group key={side} position={[0, base + 0.16, (side * W) / 2]}>
          {/* two access doors with hinges and handles per side */}
          {[-0.62, 0.28].map((x) => (
            <group key={x}>
              <Box size={[0.82, H - 0.2, 0.012]} pos={[x, H / 2, side * 0.007]} mat={canopy} />
              <Box size={[0.7, 0.42, 0.004]} pos={[x, H / 2 + 0.12, side * 0.014]} mat={m.louvreYellow} />
              <Box size={[0.03, 0.14, 0.03]} pos={[x + 0.33, H / 2 - 0.12, side * 0.03]} mat={m.black} />
              {[0.2, H - 0.3].map((y) => (
                <Box key={y} size={[0.02, 0.08, 0.02]} pos={[x - 0.41, y, side * 0.015]} mat={m.darkSteel} />
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* radiator end: large louvred intake */}
      <Box size={[0.012, H - 0.16, W - 0.14]} pos={[L / 2 + 0.006, base + 0.16 + H / 2, 0]} mat={m.louvreYellow} />
      {/* control panel end with display, lamps and emergency stop */}
      <group position={[-L / 2 - 0.006, base + 0.16 + H * 0.62, 0]}>
        <Box size={[0.02, 0.42, 0.5]} pos={[0, 0, 0]} mat={m.panelGrey} />
        <Box size={[0.01, 0.13, 0.22]} pos={[-0.012, 0.08, -0.06]} mat={m.screen} />
        {[0, 1, 2].map((i) => (
          <Cyl key={i} r={0.016} len={0.01} pos={[-0.012, -0.08, -0.14 + i * 0.07]} rot={[0, 0, Math.PI / 2]} mat={i === 0 ? m.green : i === 1 ? m.amber : m.red} seg={12} />
        ))}
        <Cyl r={0.04} len={0.03} pos={[-0.02, -0.06, 0.17]} rot={[0, 0, Math.PI / 2]} mat={m.red} />
        <Box size={[0.01, 0.1, 0.1]} pos={[-0.012, -0.06, 0.17]} mat={m.amber} />
      </group>
      {/* exhaust: silencer on the roof, stack with rain cap */}
      <Cyl r={0.13} len={0.7} pos={[0.2, base + H + 0.32, -0.15]} mat={m.darkSteel} />
      <Cyl r={0.06} len={0.5} pos={[0.6, base + H + 0.58, -0.15]} rot={[0, 0, 0]} mat={m.darkSteel} />
      <Box size={[0.16, 0.012, 0.16]} pos={[0.6, base + H + 0.86, -0.15]} rot={[0, 0, 0.35]} mat={m.darkSteel} />
      {/* lifting eyes and earth boss */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <Torus key={`${sx}${sz}`} r={0.04} tube={0.012} pos={[sx * (L / 2 - 0.12), base + H + 0.24, sz * (W / 2 - 0.1)]} rot={[0, sz > 0 ? 0 : Math.PI, 0]} mat={m.darkSteel} />))}
      <Nameplate pos={[0.9, base + 0.5, W / 2 + 0.016]} lines={["DIESEL GENSET", "125 kVA  415 V", "1500 rpm  50 Hz", "Prime power"]} w={0.26} />
      {/* radiator fan just visible behind the louvres */}
      <Spin speed={running ? spin * 2 : 0} axis="x" pos={[L / 2 - 0.12, base + 0.16 + H / 2, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} size={[0.02, 0.4, 0.08]} pos={[0, 0, 0]} rot={[(i / 6) * Math.PI * 2, 0, 0]} mat={m.black} />
        ))}
      </Spin>
    </group>
  );
}

// ------------------------------------------------------------------ four-column hydraulic press

export function Press({ spin, hot, running }: ModelProps) {
  const m = M();
  const frame = useHeat(m.pressBlue, hot);
  const bedTop = FLOOR + 0.62;
  const crown = FLOOR + 2.0;
  const cols: [number, number][] = [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]];
  return (
    <group>
      {/* bed with checker-plate bolster and T-slots */}
      <Box size={[1.4, 0.6, 0.95]} pos={[0, FLOOR + 0.3, 0]} mat={frame} />
      <Box size={[1.1, 0.04, 0.72]} pos={[0, bedTop + 0.02, 0]} mat={m.checker} />
      {[-0.15, 0.15].map((z) => (
        <Box key={z} size={[1.05, 0.012, 0.04]} pos={[0, bedTop + 0.042, z]} mat={m.black} />
      ))}
      {/* chrome columns with lock nuts */}
      {cols.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cyl r={0.055} len={crown - bedTop} pos={[x, (crown + bedTop) / 2, z]} rot={[0, 0, 0]} mat={m.chrome} />
          <Cyl r={0.085} len={0.08} pos={[x, crown + 0.27, z]} rot={[0, 0, 0]} mat={m.steel} seg={6} />
          <Cyl r={0.085} len={0.08} pos={[x, bedTop + 0.08, z]} rot={[0, 0, 0]} mat={m.steel} seg={6} />
        </group>
      ))}
      {/* moving platen (ram) with hazard edge, travels when running */}
      <RamStroke running={running && spin > 0} bedTop={bedTop} crown={crown}>
        <Box size={[1.12, 0.22, 0.8]} pos={[0, 0, 0]} mat={frame} />
        <Box size={[1.13, 0.06, 0.81]} pos={[0, -0.1, 0]} mat={m.hazard} />
        {cols.map(([x, z]) => (
          <Cyl key={`${x}${z}`} r={0.075} len={0.24} pos={[x, 0, z]} rot={[0, 0, 0]} mat={m.darkSteel} />
        ))}
      </RamStroke>
      {/* crown with main cylinder */}
      <Box size={[1.35, 0.42, 0.9]} pos={[0, crown + 0.08, 0]} mat={frame} />
      <Cyl r={0.24} len={0.55} pos={[0, crown + 0.55, 0]} rot={[0, 0, 0]} mat={frame} />
      <Cyl r={0.28} len={0.05} pos={[0, crown + 0.83, 0]} rot={[0, 0, 0]} mat={frame} />
      <BoltRing r={0.24} count={10} at={[0, crown + 0.86, 0]} axis="y" />
      <Gauge pos={[0.3, crown + 0.16, 0.47]} running={running} size={0.07} />
      <Nameplate pos={[-0.35, crown + 0.08, 0.452]} lines={["HYDRAULIC PRESS", "1000 kN", "Stroke 400 mm", "Pmax 250 bar"]} w={0.26} />
      {/* light curtains on the front columns */}
      {[-0.5, 0.5].map((x) => (
        <Box key={x} size={[0.04, 0.9, 0.04]} pos={[x * 1.22, bedTop + 0.6, 0.48]} mat={m.amber} />
      ))}
      {/* power pack: oil tank, motor-pump, hoses to the cylinder */}
      <group position={[1.15, FLOOR, -0.05]}>
        <Box size={[0.6, 0.5, 0.65]} pos={[0, 0.25, 0]} mat={m.darkPaint} />
        <Cyl r={0.035} len={0.06} pos={[0, 0.3, 0.33]} rot={Z_AXIS} mat={m.oil} />
        <group position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <MotorUnit r={0.16} len={0.42} paint={m.motorBlue} spin={spin} plate={false} />
        </group>
      </group>
      <Pipe points={[[1.1, FLOOR + 0.55, 0.1], [0.95, crown, 0.2], [0.3, crown + 0.6, 0.2]]} r={0.025} mat={m.hose} />
      <Pipe points={[[1.2, FLOOR + 0.55, 0.15], [1.05, crown + 0.3, 0.05], [0.25, crown + 0.75, 0]]} r={0.025} mat={m.hose} />
      {/* two-hand control station */}
      <group position={[-0.95, FLOOR, 0.6]}>
        <Cyl r={0.04} len={1.0} pos={[0, 0.5, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
        <Box size={[0.5, 0.12, 0.2]} pos={[0, 1.05, 0]} mat={m.amber} />
        {[-0.15, 0.15].map((x) => (
          <Cyl key={x} r={0.04} len={0.04} pos={[x, 1.12, 0]} rot={[0, 0, 0]} mat={m.green} />
        ))}
        <Cyl r={0.045} len={0.05} pos={[0, 1.13, 0]} rot={[0, 0, 0]} mat={m.red} />
      </group>
    </group>
  );
}

/** The ram cycles down to the bolster and back while the press runs; parked at the top otherwise. */
function RamStroke({ children, running, bedTop, crown }: { children: ReactNode; running: boolean; bedTop: number; crown: number }) {
  const top = crown - 0.25;
  const bottom = bedTop + 0.55;
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const t = running ? (Math.sin(clock.elapsedTime * 0.9) + 1) / 2 : 1;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, bottom + (top - bottom) * t, 4, dt);
  });
  return (
    <group ref={ref} position={[0, top, 0]}>
      {children}
    </group>
  );
}

// ------------------------------------------------------------------ centre lathe

export function Lathe({ spin, hot }: ModelProps) {
  const m = M();
  const body = useHeat(m.machineGreen, hot);
  const bedY = FLOOR + 0.86;
  const L = 2.5;
  return (
    <group>
      {/* cabinet stands and chip tray */}
      {[-0.85, 0.85].map((x) => (
        <Box key={x} size={[0.55, 0.7, 0.62]} pos={[x, FLOOR + 0.35, 0]} mat={body} />
      ))}
      <Box size={[L, 0.06, 0.78]} pos={[0, FLOOR + 0.72, 0.02]} mat={m.darkSteel} />
      {/* bed with hardened ways */}
      <Box size={[L, 0.18, 0.5]} pos={[0, bedY - 0.06, 0]} mat={body} />
      {[-0.17, 0.17].map((z) => (
        <Box key={z} size={[L, 0.04, 0.07]} pos={[0, bedY + 0.05, z]} rot={[0, 0, 0]} mat={m.steel} />
      ))}
      <Box size={[L, 0.04, 0.03]} pos={[0, bedY + 0.05, 0.25]} rot={[Math.PI / 4, 0, 0]} mat={m.steel} />
      {/* lead screw and feed rod across the front */}
      <Cyl r={0.018} len={L - 0.2} pos={[0, bedY - 0.12, 0.3]} mat={m.steel} />
      <Cyl r={0.014} len={L - 0.2} pos={[0, bedY - 0.2, 0.3]} mat={m.steel} />
      {/* headstock with gear levers and the chuck */}
      <group position={[-L / 2 + 0.38, bedY + 0.28, 0]}>
        <Box size={[0.75, 0.46, 0.55]} pos={[0, 0, 0]} mat={body} />
        <Box size={[0.76, 0.04, 0.56]} pos={[0, 0.25, 0]} mat={body} />
        {[-0.2, 0, 0.2].map((x, i) => (
          <group key={x}>
            <Cyl r={0.012} len={0.12} pos={[x, 0.05, 0.32]} rot={Z_AXIS} mat={m.chrome} />
            <Cyl r={0.026} len={0.026} pos={[x, 0.05, 0.39]} rot={Z_AXIS} mat={i === 1 ? m.red : m.black} seg={16} />
          </group>
        ))}
        <Nameplate pos={[0.1, -0.13, 0.277]} lines={["CENTRE LATHE", "Swing 460 mm", "Centres 1500", "40-1800 rpm"]} w={0.22} />
        <Spin speed={spin} pos={[0.45, 0, 0]}>
          <Cyl r={0.15} len={0.12} pos={[0, 0, 0]} mat={m.darkSteel} seg={40} />
          {[0, 1, 2].map((i) => (
            <Box key={i} size={[0.05, 0.06, 0.04]} pos={[0.06, Math.cos((i * 2 * Math.PI) / 3) * 0.09, Math.sin((i * 2 * Math.PI) / 3) * 0.09]} rot={[(i * 2 * Math.PI) / 3, 0, 0]} mat={m.steel} />
          ))}
          <Cyl r={0.04} len={0.5} pos={[0.33, 0, 0]} mat={m.steel} />
        </Spin>
      </group>
      {/* quick-change gearbox below the headstock */}
      <Box size={[0.5, 0.26, 0.08]} pos={[-L / 2 + 0.33, bedY - 0.08, 0.29]} mat={body} />
      {/* carriage: saddle, apron with handwheel, cross slide, tool post */}
      <group position={[0.25, bedY, 0]}>
        <Box size={[0.36, 0.08, 0.62]} pos={[0, 0.1, 0]} mat={body} />
        <Box size={[0.4, 0.3, 0.08]} pos={[0, -0.06, 0.33]} mat={body} />
        <Handwheel pos={[-0.08, -0.06, 0.4]} r={0.08} mat={m.chrome} />
        <Box size={[0.22, 0.07, 0.4]} pos={[0, 0.18, 0]} mat={m.darkSteel} />
        <Box size={[0.12, 0.12, 0.12]} pos={[0, 0.28, 0.06]} mat={m.darkSteel} />
        <Box size={[0.03, 0.03, 0.16]} pos={[0, 0.27, -0.05]} mat={m.steel} />
        <Handwheel pos={[0, 0.18, 0.28]} r={0.05} mat={m.chrome} />
      </group>
      {/* tailstock */}
      <group position={[L / 2 - 0.3, bedY + 0.2, 0]}>
        <Box size={[0.26, 0.3, 0.36]} pos={[0, 0, 0]} mat={body} />
        <Cyl r={0.04} len={0.25} pos={[-0.22, 0.04, 0]} mat={m.steel} />
        <Turned profile={[[0.04, 0], [0.04, 0.02], [0, 0.07]]} pos={[-0.35, 0.04, 0]} rot={[0, 0, Math.PI / 2]} mat={m.steel} />
        <Handwheel pos={[0.18, 0.04, 0]} r={0.07} rot={[0, Math.PI / 2, 0]} mat={m.chrome} />
      </group>
      {/* chuck guard, coolant pipe, emergency stop */}
      <Box size={[0.22, 0.03, 0.4]} pos={[-L / 2 + 0.83, bedY + 0.52, 0]} rot={[0.3, 0, 0]} mat={m.glass} />
      <Pipe points={[[-0.2, bedY + 0.6, -0.25], [0.05, bedY + 0.55, -0.1], [0.15, bedY + 0.35, 0]]} r={0.012} mat={m.safetyOrange} />
      <Cyl r={0.035} len={0.04} pos={[-L / 2 + 0.38, bedY + 0.57, 0.2]} rot={[0, 0, 0]} mat={m.red} />
    </group>
  );
}

// ------------------------------------------------------------------ packaged fire-tube steam boiler

export function Boiler({ spin, hot, running }: ModelProps) {
  const m = M();
  const shell = useHeat(m.cladding, hot);
  const cy = FLOOR + 0.82;
  const L = 2.3;
  const R = 0.58;
  return (
    <group>
      {/* skid and saddles */}
      <Box size={[L + 0.3, 0.12, 1.1]} pos={[0, FLOOR + 0.06, 0]} mat={m.darkPaint} />
      {[-0.7, 0.7].map((x) => (
        <Box key={x} size={[0.16, 0.3, 0.9]} pos={[x, FLOOR + 0.24, 0]} mat={m.darkPaint} />
      ))}
      {/* clad shell with lagging bands */}
      <Cyl r={R} len={L} pos={[0, cy, 0]} mat={shell} seg={64} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Torus key={i} r={R + 0.004} tube={0.012} pos={[-L / 2 + 0.2 + i * 0.38, cy, 0]} mat={m.darkSteel} />
      ))}
      {/* front: hinged smokebox door with dogs, burner and blower */}
      <group position={[-L / 2, cy, 0]}>
        <Cyl r={R + 0.02} len={0.1} pos={[-0.05, 0, 0]} mat={m.boilerRed} seg={64} />
        <Turned profile={[[R - 0.02, 0], [R - 0.06, 0.06], [R * 0.5, 0.1], [0, 0.11]]} pos={[-0.1, 0, 0]} rot={[0, 0, Math.PI / 2]} mat={m.boilerRed} />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <Box key={i} size={[0.06, 0.05, 0.08]} pos={[-0.1, Math.cos(a) * (R - 0.04), Math.sin(a) * (R - 0.04)]} rot={[a, 0, 0]} mat={m.darkSteel} />;
        })}
        <Box size={[0.06, 0.18, 0.06]} pos={[-0.08, 0, R + 0.02]} mat={m.darkSteel} />
        {/* burner head and fan housing */}
        <Cyl r={0.14} len={0.3} pos={[-0.3, -0.05, 0]} mat={m.panelGrey} />
        <Box size={[0.36, 0.34, 0.3]} pos={[-0.55, -0.05, 0]} mat={m.safetyOrange} />
        <Box size={[0.004, 0.24, 0.2]} pos={[-0.733, -0.05, 0]} mat={m.louvreGrey} />
        <Spin speed={spin} axis="x" pos={[-0.74, -0.05, 0]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} size={[0.004, 0.18, 0.03]} pos={[0, 0, 0]} rot={[(i / 5) * Math.PI * 2, 0, 0]} mat={m.black} />
          ))}
        </Spin>
        <Pipe points={[[-0.55, -0.25, 0.1], [-0.55, -0.5, 0.25], [-0.3, -0.7, 0.4]]} r={0.018} mat={m.copper} />
      </group>
      {/* rear smokebox and flue stack */}
      <Cyl r={R + 0.02} len={0.12} pos={[L / 2 + 0.05, cy, 0]} mat={m.boilerRed} seg={64} />
      <Box size={[0.4, 0.5, 0.5]} pos={[L / 2 + 0.25, cy + 0.2, 0]} mat={m.boilerRed} />
      <Cyl r={0.15} len={1.4} pos={[L / 2 + 0.25, cy + 1.15, 0]} rot={[0, 0, 0]} mat={m.darkSteel} />
      <Torus r={0.155} tube={0.015} pos={[L / 2 + 0.25, cy + 1.2, 0]} rot={[Math.PI / 2, 0, 0]} mat={m.darkSteel} />
      {/* top: steam stop valve, twin safety valves, manhole */}
      <group position={[0.2, cy + R, 0]}>
        <Cyl r={0.08} len={0.18} pos={[0, 0.09, 0]} rot={[0, 0, 0]} mat={m.castIron} />
        <Cyl r={0.12} len={0.03} pos={[0, 0.19, 0]} rot={[0, 0, 0]} mat={m.castIron} />
        <Handwheel pos={[0, 0.34, 0]} r={0.1} rot={[Math.PI / 2, 0, 0]} />
        <Cyl r={0.025} len={0.12} pos={[0, 0.26, 0]} rot={[0, 0, 0]} mat={m.steel} />
        <Pipe points={[[0, 0.2, 0], [0.1, 0.3, 0], [0.5, 0.32, 0], [0.9, 0.32, -0.3]]} r={0.06} mat={m.cladding} />
      </group>
      {[-0.35, -0.55].map((x) => (
        <group key={x} position={[x, cy + R, -0.15]}>
          <Cyl r={0.05} len={0.2} pos={[0, 0.1, 0]} rot={[0, 0, 0]} mat={m.brass} />
          <Turned profile={[[0.06, 0], [0.07, 0.05], [0.03, 0.18], [0, 0.2]]} pos={[0, 0.2, 0]} mat={m.brass} />
        </group>
      ))}
      <Box size={[0.36, 0.06, 0.26]} pos={[-0.6, cy + R + 0.02, 0.2]} rot={[0, 0, 0]} mat={m.darkSteel} />
      {/* front-side gauges: level glass, pressure gauge, blowdown */}
      <group position={[-L / 2 + 0.25, cy, R]}>
        <Box size={[0.05, 0.42, 0.05]} pos={[0, 0.12, 0.05]} mat={m.castIron} />
        <Cyl r={0.018} len={0.3} pos={[0.04, 0.12, 0.07]} rot={[0, 0, 0]} mat={m.glass} />
        <Box size={[0.02, 0.1, 0.02]} pos={[0.04, 0.08, 0.072]} mat={m.oil} />
        <Gauge pos={[0.25, 0.32, 0.06]} running={running} size={0.09} />
        <Nameplate pos={[0.65, 0.1, 0.012]} lines={["STEAM BOILER", "2000 kg/h", "WP 10.5 bar", "IBR reg. 2026"]} w={0.28} />
        <Cyl r={0.04} len={0.2} pos={[0.1, -R + 0.05, 0.02]} rot={[0, 0, 0]} mat={m.castIron} />
        <Handwheel pos={[0.1, -R + 0.08, 0.1]} r={0.05} />
      </group>
      {/* access ladder at the rear */}
      <group position={[L / 2 - 0.25, FLOOR, R + 0.18]}>
        {[-0.18, 0.18].map((x) => (
          <Box key={x} size={[0.03, 1.5, 0.03]} pos={[x, 0.75, 0]} mat={m.safetyOrange} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <Cyl key={i} r={0.012} len={0.36} pos={[0, 0.2 + i * 0.24, 0]} mat={m.safetyOrange} />
        ))}
      </group>
    </group>
  );
}
