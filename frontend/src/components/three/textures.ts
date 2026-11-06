import * as THREE from "three";

/**
 * Surface textures drawn once on a canvas in the browser and shared by every model:
 * painted steel with chips and grime, brushed and cast metal, rubber, galvanised
 * sheet, checker plate and engraved nameplates. Nothing is downloaded.
 */

const cache = new Map<string, THREE.Texture>();

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function finish(key: string, c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function speckle(g: CanvasRenderingContext2D, size: number, rnd: () => number, n: number, alpha: number, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${rnd() * alpha})`;
    const s = 1 + rnd() * 2;
    g.fillRect(rnd() * size, rnd() * size, s, s);
  }
}

/** Enamel on steel: slight orange-peel, chipped edges showing primer and bare metal, grime toward the bottom. */
export function paintTexture(color: string, wear = 0.5, seed = 1) {
  const key = `paint:${color}:${wear}:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 512;
  const [c, g] = canvas(size);
  const rnd = seeded(seed * 7919);
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  speckle(g, size, rnd, 9000, 0.07);
  speckle(g, size, rnd, 4000, 0.05, true);
  // grime gathers low down and in streaks
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "rgba(40,30,20,0)");
  grad.addColorStop(0.7, `rgba(40,30,20,${0.12 * wear})`);
  grad.addColorStop(1, `rgba(30,22,15,${0.35 * wear})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26 * wear; i++) {
    const x = rnd() * size;
    const h = 40 + rnd() * 160;
    const y = rnd() * size;
    const sg = g.createLinearGradient(0, y, 0, y + h);
    sg.addColorStop(0, "rgba(50,38,25,0.18)");
    sg.addColorStop(1, "rgba(50,38,25,0)");
    g.fillStyle = sg;
    g.fillRect(x, y, 2 + rnd() * 3, h);
  }
  // chips: primer ring around bare steel
  for (let i = 0; i < 70 * wear; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.5 + rnd() * 5;
    g.fillStyle = "rgba(150,70,45,0.65)";
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(170,165,155,0.9)";
    g.beginPath();
    g.ellipse(x, y, r * 0.9, r * 0.55, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  return finish(key, c);
}

/** Roughness: smooth paint with duller worn patches. */
export function paintRoughness(wear = 0.5, seed = 1) {
  const key = `paintR:${wear}:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, g] = canvas(size);
  const rnd = seeded(seed * 104729);
  g.fillStyle = "rgb(120,120,120)";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160 * wear; i++) {
    g.fillStyle = `rgba(230,230,230,${0.15 + rnd() * 0.3})`;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, 3 + rnd() * 14, 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, size, rnd, 3000, 0.25, true);
  return finish(key, c, [1, 1], false);
}

/** Machined/brushed steel: fine directional streaks. */
export function brushedTexture(base = "#b9b3a8") {
  const key = `brushed:${base}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 512;
  const [c, g] = canvas(size);
  const rnd = seeded(31);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const y = rnd() * size;
    const l = rnd() > 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${l},${l},${l},${0.04 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd();
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y + (rnd() - 0.5) * 3);
    g.stroke();
  }
  return finish(key, c);
}

/** Sand-cast iron: grainy surface with darker pits. */
export function castTexture(color: string, seed = 3) {
  const key = `cast:${color}:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 512;
  const [c, g] = canvas(size);
  const rnd = seeded(seed * 613);
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  speckle(g, size, rnd, 26000, 0.12);
  speckle(g, size, rnd, 9000, 0.08, true);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(20,15,10,${0.2 + rnd() * 0.3})`;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return finish(key, c);
}

/** Bump map for casting grain (grey = flat). */
export function grainBump(seed = 5) {
  const key = `grain:${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, g] = canvas(size);
  const rnd = seeded(seed * 211);
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, size, size);
  speckle(g, size, rnd, 9000, 0.35);
  speckle(g, size, rnd, 9000, 0.35, true);
  return finish(key, c, [3, 3], false);
}

/** Conveyor/drive belt: black rubber with a fine chevron tread and dust. */
export function rubberTexture(chevron = true) {
  const key = `rubber:${chevron}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, g] = canvas(size);
  const rnd = seeded(77);
  g.fillStyle = "#24201d";
  g.fillRect(0, 0, size, size);
  if (chevron) {
    g.strokeStyle = "rgba(255,255,255,0.07)";
    g.lineWidth = 6;
    for (let y = -size; y < size * 2; y += 28) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(size / 2, y + 22);
      g.lineTo(size, y);
      g.stroke();
    }
  }
  speckle(g, size, rnd, 2500, 0.12, true);
  return finish(key, c);
}

/** Hot-dip galvanised sheet: soft crystalline spangle. */
export function galvanizedTexture() {
  const key = "galv";
  if (cache.has(key)) return cache.get(key)!;
  const size = 512;
  const [c, g] = canvas(size);
  const rnd = seeded(91);
  g.fillStyle = "#a9aca9";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const l = 140 + rnd() * 60;
    g.fillStyle = `rgba(${l},${l + 3},${l},0.35)`;
    g.beginPath();
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 10 + rnd() * 30;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd() * 0.5;
      const rr = r * (0.6 + rnd() * 0.4);
      if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  }
  return finish(key, c);
}

/** Diamond checker plate for platforms and press beds. */
export function checkerTexture() {
  const key = "checker";
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, g] = canvas(size);
  g.fillStyle = "#8e8a84";
  g.fillRect(0, 0, size, size);
  const step = 32;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const odd = (x / step + y / step) % 2;
      g.save();
      g.translate(x + step / 2, y + step / 2);
      g.rotate(odd ? Math.PI / 4 : -Math.PI / 4);
      g.fillStyle = "rgba(255,255,255,0.28)";
      g.fillRect(-11, -2.5, 22, 5);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-11, 2.5, 22, 1.5);
      g.restore();
    }
  }
  return finish(key, c, [4, 4]);
}

/** Black/yellow hazard stripes for guards and press rams. */
export function hazardTexture() {
  const key = "hazard";
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, g] = canvas(size);
  g.fillStyle = "#1e1b18";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#d9a21b";
  for (let i = -size; i < size * 2; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 16, 0);
    g.lineTo(i + 16 - size, size);
    g.lineTo(i - size, size);
    g.fill();
  }
  return finish(key, c, [4, 1]);
}

/** Riveted aluminium nameplate with stamped text. */
export function nameplateTexture(lines: string[]) {
  const key = `plate:${lines.join("|")}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  c.height = 160;
  g.fillStyle = "#c9c4b8";
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = "#7d776c";
  g.lineWidth = 4;
  g.strokeRect(6, 6, 244, 148);
  g.fillStyle = "#3b352d";
  g.font = "bold 24px 'IBM Plex Mono', monospace";
  g.fillText(lines[0] ?? "", 20, 42);
  g.font = "16px 'IBM Plex Mono', monospace";
  lines.slice(1).forEach((l, i) => g.fillText(l, 20, 72 + i * 24));
  g.fillStyle = "#8b857a";
  for (const [x, y] of [[16, 16], [240, 16], [16, 144], [240, 144]]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Dark louvre slots for enclosures (genset canopy, control panels). */
export function louvreTexture(base: string) {
  const key = `louvre:${base}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let y = 18; y < size - 10; y += 22) {
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(20, y, size - 40, 8);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(20, y + 8, size - 40, 2);
  }
  return finish(key, c);
}
