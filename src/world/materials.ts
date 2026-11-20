import * as THREE from 'three';
import { latticeTexture, plasterTexture, roofTexture, stoneTexture, woodTexture } from './textures';

const cache = new Map<string, THREE.Material>();

type MatOpts = {
  color?: string;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture | null;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  flat?: boolean;
};

export function mat(key: string, opts: MatOpts = {}): THREE.MeshStandardMaterial {
  if (cache.has(key)) return cache.get(key) as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(opts.color ?? '#ffffff'),
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    map: opts.map ?? null,
    emissive: new THREE.Color(opts.emissive ?? '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: opts.flat ?? false,
  });
  cache.set(key, m);
  return m;
}

export const M = {
  get roof() {
    return mat('roof', { color: '#b9bdb3', roughness: 0.9, map: roofTexture() });
  },
  get roofDark() {
    return mat('roofDark', { color: '#8b918a', roughness: 0.92, map: roofTexture() });
  },
  get plaster() {
    return mat('plaster', { color: '#efe8d8', roughness: 0.95, map: plasterTexture() });
  },
  get stone() {
    return mat('stone', { color: '#c6c3b4', roughness: 0.95, map: stoneTexture('#9b998c') });
  },
  get stoneDark() {
    return mat('stoneDark', { color: '#a09e90', roughness: 0.97, map: stoneTexture('#7f7e72') });
  },
  get stoneLight() {
    return mat('stoneLight', { color: '#cbc7b6', roughness: 0.94, map: stoneTexture('#b9b5a4') });
  },
  get red() {
    return mat('red', { color: '#8a3628', roughness: 0.66, map: woodTexture('#7c3327') });
  },
  get redDark() {
    return mat('redDark', { color: '#5f271f', roughness: 0.7, map: woodTexture('#5a241d') });
  },
  get wood() {
    return mat('wood', { color: '#8a6a44', roughness: 0.8, map: woodTexture('#6f5236') });
  },
  get woodDark() {
    return mat('woodDark', { color: '#5c4630', roughness: 0.82, map: woodTexture('#4b3927') });
  },
  get lattice() {
    return mat('lattice', { color: '#f0e4ca', roughness: 0.9, map: latticeTexture('#e9dcc0', '#4a2c22') });
  },
  get gold() {
    return mat('gold', { color: '#c09a52', roughness: 0.38, metalness: 0.72 });
  },
  get goldDark() {
    return mat('goldDark', { color: '#8f6c36', roughness: 0.45, metalness: 0.6 });
  },
  get bronze() {
    return mat('bronze', { color: '#6d5736', roughness: 0.5, metalness: 0.62 });
  },
  get bronzeDark() {
    return mat('bronzeDark', { color: '#4b3d28', roughness: 0.55, metalness: 0.55 });
  },
  get cushion() {
    return mat('cushion', { color: '#77513c', roughness: 0.96 });
  },
  get cushionDark() {
    return mat('cushionDark', { color: '#5c3c2c', roughness: 0.96 });
  },
  get bark() {
    return mat('bark', { color: '#5a4a38', roughness: 1 });
  },
  get moss() {
    return mat('moss', { color: '#5d6b4a', roughness: 1 });
  },
  get black() {
    return mat('black', { color: '#22251f', roughness: 0.8 });
  },
  get paper() {
    return mat('paper', { color: '#e8d5a8', roughness: 0.9, emissive: '#3a2408', emissiveIntensity: 0.18 });
  },
  get lanternPaper() {
    return mat('lanternPaper', {
      color: '#c8613f', roughness: 0.72, emissive: '#d96a35', emissiveIntensity: 0.55, side: THREE.DoubleSide,
    });
  },
  get glassWarm() {
    return mat('glassWarm', { color: '#f6d49a', roughness: 0.4, emissive: '#ffb45e', emissiveIntensity: 0.8 });
  },
  get waterStone() {
    return mat('waterStone', { color: '#6f7166', roughness: 0.9 });
  },
};

/** 通用几何体助手 */
export function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  cast = true,
  receive = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

export function cyl(rt: number, rb: number, h: number, seg: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z);
}

/** 圆柱两点之间 */
export function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material, seg = 6): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r * 1.04, len, seg);
  const m = new THREE.Mesh(g, material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function canvasPlane(
  w: number,
  h: number,
  texture: THREE.Texture,
  opts: { emissive?: string; emissiveIntensity?: number } = {},
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: '#ffffff',
    roughness: 0.75,
    metalness: 0,
    emissive: new THREE.Color(opts.emissive ?? '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: THREE.DoubleSide,
  });
  return mesh(new THREE.PlaneGeometry(w, h), material);
}
