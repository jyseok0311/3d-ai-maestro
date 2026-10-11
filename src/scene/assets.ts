import * as THREE from 'three';

/**
 * Geometries shared by every instance of a model. Creating them once keeps
 * GPU memory flat no matter how many cohorts, robots or rooms exist.
 */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12).rotateZ(Math.PI / 2),
  lamp: new THREE.SphereGeometry(0.22, 10, 8),
  body: new THREE.CapsuleGeometry(0.38, 0.8, 3, 8).translate(0, 0.8, 0),
  head: new THREE.SphereGeometry(0.31, 10, 8).translate(0, 1.92, 0),
  marker: new THREE.OctahedronGeometry(0.5, 0),
};

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, flatShading: true, ...extra });

export const MAT = {
  tire: std('#15171a', { roughness: 1 }),
  robotShell: std('#e5e7eb', { roughness: 0.5 }),
  robotDark: std('#24272c', { metalness: 0.4 }),
  tray: std('#9ca3af', { metalness: 0.6, roughness: 0.4 }),
  skin: std('#f1c9a5', { roughness: 0.9 }),
  slab: std('#262a31'),
  lot: std('#191c21', { roughness: 1 }),
  podFloor: std('#2b3340'),
  wall: std('#3a3f47'),
  trim: std('#4f9dff'),
  doorFrame: std('#4b515b'),
  door: std('#8b929c', { metalness: 0.3 }),
  desk: std('#c8b08a'),
  glass: new THREE.MeshStandardMaterial({ color: '#cfe6ff', emissive: '#4f9dff', emissiveIntensity: 0.25, transparent: true, opacity: 0.12, roughness: 0.1, depthWrite: false }),
  rackFrame: std('#4f9dff', { metalness: 0.3, roughness: 0.6 }),
  rackShelf: std('#56606c', { metalness: 0.4 }),
  lineMark: new THREE.MeshBasicMaterial({ color: '#8fbfff' }),
  charger: std('#1f2937'),
};

const lampCache = new Map<string, THREE.MeshStandardMaterial>();
/** Emissive status-light material, cached per colour. */
export function lampMaterial(color: string): THREE.MeshStandardMaterial {
  let m = lampCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, toneMapped: false });
    lampCache.set(color, m);
  }
  return m;
}

const paintCache = new Map<string, THREE.MeshStandardMaterial>();
/** Solid paint material, cached per colour. */
export function paintMaterial(color: string): THREE.MeshStandardMaterial {
  let m = paintCache.get(color);
  if (!m) {
    m = std(color, { metalness: 0.25, roughness: 0.55 });
    paintCache.set(color, m);
  }
  return m;
}

/** Exponential smoothing for angles, taking the short way round. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

/** Text rendered to a canvas texture, for crisp in-world labels without DOM portals. */
export function labelTexture(code: string, name: string, active: boolean): THREE.CanvasTexture {
  const scale = 2;
  const font = `600 ${26 * scale}px 'Pretendard', 'Segoe UI', 'Malgun Gothic', sans-serif`;
  const codeFont = `700 ${22 * scale}px Consolas, monospace`;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = codeFont;
  const codeW = measure.measureText(code).width + 20 * scale;
  measure.font = font;
  const width = Math.ceil(codeW + measure.measureText(name).width + 44 * scale);
  const height = 52 * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(12,14,17,0.88)';
  ctx.strokeStyle = active ? '#4f9dff' : '#3a3f47';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.roundRect(2 * scale, 2 * scale, width - 4 * scale, height - 4 * scale, 8 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? '#4f9dff' : '#8b94a1';
  ctx.beginPath();
  ctx.roundRect(12 * scale, 12 * scale, codeW, height - 24 * scale, 4 * scale);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111';
  ctx.font = codeFont;
  ctx.fillText(code, 22 * scale, height / 2);
  ctx.fillStyle = active ? '#e6e8eb' : '#aeb5bf';
  ctx.font = font;
  ctx.fillText(name, codeW + 24 * scale, height / 2 + scale);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const SELECT_RING = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
