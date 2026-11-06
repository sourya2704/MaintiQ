import { Instance, Instances } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/*
 * The website's warehouse after dark: a gradient sky dome with stars and a moon,
 * lit clerestory windows, and bloom so lamps, windows and the sign glow.
 * Only colours brighter than white (the emissive lamps) bloom, so paintwork stays crisp.
 */

export const NIGHT_FOG = "#0b1322";

/**
 * While bloom is on, the scene is drawn into this buffer instead of the screen. Shaders are
 * compiled per target, so the hall's warm-up compiles against it too (see LandingScene's Prepared).
 */
export const bloomTarget: { current: THREE.WebGLRenderTarget | null } = { current: null };

/** Inside-out sphere shaded from a navy horizon to a near-black zenith. Not fogged, not lit. */
export function SkyDome({ centerX }: { centerX: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: new THREE.Color(NIGHT_FOG) },
          mid: { value: new THREE.Color("#0a1630") },
          zenith: { value: new THREE.Color("#03050c") },
          glow: { value: new THREE.Color("#3a2a3c") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 horizon; uniform vec3 mid; uniform vec3 zenith; uniform vec3 glow;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.25, h));
            c = mix(c, zenith, smoothstep(0.25, 0.9, h));
            // faint warm light pollution low on the horizon, behind the plant
            c += glow * pow(1.0 - h, 6.0) * 0.35;
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh position={[centerX, 0, 0]} material={mat} renderOrder={-1}>
      <sphereGeometry args={[200, 32, 16]} />
    </mesh>
  );
}

function moonTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const halo = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  halo.addColorStop(0, "rgba(220,230,255,0.55)");
  halo.addColorStop(0.35, "rgba(160,180,230,0.12)");
  halo.addColorStop(1, "rgba(120,140,200,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, 256, 256);
  const disc = g.createRadialGradient(118, 118, 4, 128, 128, 30);
  disc.addColorStop(0, "#fbfcff");
  disc.addColorStop(1, "#d9e1f0");
  g.fillStyle = disc;
  g.beginPath();
  g.arc(128, 128, 30, 0, Math.PI * 2);
  g.fill();
  // a few soft maria so it is not a flat white dot
  g.fillStyle = "rgba(150,160,185,0.35)";
  for (const [x, y, r] of [[118, 120, 8], [136, 134, 6], [124, 140, 4], [140, 116, 5]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Moon() {
  const mat = useMemo(() => {
    const m = new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false });
    m.color.setScalar(1.6); // above white, so the disc blooms
    return m;
  }, []);
  return <sprite material={mat} position={[40, 70, -120]} scale={[34, 34, 1]} />;
}

/**
 * Stars as fixed-size points on the upper sky (pixel size does not shrink with distance, so they
 * stay visible on phones). A few are brighter than white and pick up a little bloom.
 */
function StarField({ count, centerX }: { count: number; centerX: number }) {
  const { geometry, material } = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const y = 0.06 + rnd() * 0.94; // above the horizon only
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([centerX + Math.cos(a) * r * 180, y * 180, Math.sin(a) * r * 180], i * 3);
      const b = rnd();
      const bright = b > 0.97 ? 2.2 : 0.35 + b * 0.75;
      tint.setHSL(0.58 + (rnd() - 0.5) * 0.12, 0.25, 0.85).multiplyScalar(bright);
      col.set([tint.r, tint.g, tint.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false });
    return { geometry: g, material: m };
  }, [count, centerX]);
  return <points geometry={geometry} material={material} />;
}

export function NightSky({ small, centerX }: { small: boolean; centerX: number }) {
  return (
    <>
      <SkyDome centerX={centerX} />
      <StarField count={small ? 900 : 1800} centerX={centerX} />
      <Moon />
    </>
  );
}

function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,214,150,1)");
  r.addColorStop(0.45, "rgba(255,190,120,0.45)");
  r.addColorStop(1, "rgba(255,170,100,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pools of warm light on the floor under each high-bay lamp: one additive draw call, no real lights. */
export function LightPools({ spots, y }: { spots: [number, number][]; y: number }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    [],
  );
  return (
    <Instances limit={64} material={mat}>
      <planeGeometry args={[7.5, 7.5]} />
      {spots.map(([x, z]) => (
        <Instance key={`${x}:${z}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} />
      ))}
    </Instances>
  );
}

/** Warm clerestory windows along both long walls, seen from outside during the arrival. */
export function LitWindows({ fromX, toX, halfW, y }: { fromX: number; toX: number; halfW: number; y: number }) {
  const mat = useMemo(() => {
    // not fogged: lit windows are what you see first of a building at night
    return new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc977").multiplyScalar(1.5), fog: false });
  }, []);
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let x = fromX + 3.5; x < toX - 2; x += 3.5) out.push(x);
    return out;
  }, [fromX, toX]);
  return (
    <Instances limit={64} material={mat}>
      <planeGeometry args={[2.4, 0.8]} />
      {xs.flatMap((x) =>
        [-1, 1].map((s) => (
          <Instance key={`${x}${s}`} position={[x, y, s * (halfW + 0.08)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} />
        )),
      )}
    </Instances>
  );
}

/**
 * Bloom pass. Takes over rendering while mounted (useFrame priority 1) and hands it back
 * to react-three-fiber when unmounted. Tone mapping moves into the pass so the glow is
 * computed on the bright, linear image.
 */
export function Bloom({ intensity = 1.1 }: { intensity?: number }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1, luminanceSmoothing: 0.25, intensity, radius: 0.72 });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    c.addPass(new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), vignette));
    bloomTarget.current = c.inputBuffer;
    return c;
  }, [gl, scene, camera, intensity]);
  useEffect(() => {
    const before = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping; // the pass tone maps instead
    return () => {
      gl.toneMapping = before;
      if (bloomTarget.current === composer.inputBuffer) bloomTarget.current = null;
      composer.dispose();
    };
  }, [gl, composer]);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size, viewport.dpr]);
  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}
