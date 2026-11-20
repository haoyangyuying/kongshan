import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 把一栋建筑里共用材质的静态网格合并，显著减少 draw call。
 * 跳过：InstancedMesh、点/线/精灵、透明材质、多材质、需要单独交互的（调用方不传）。
 */
export function mergeStatic(root: THREE.Group, opts: { keepNames?: string[] } = {}): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Mesh[] = [];
  const keep = new Set(opts.keepNames ?? []);

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    let anc: THREE.Object3D | null = m;
    while (anc) {
      if (anc.userData.noMerge) return;
      anc = anc.parent;
    }
    if (keep.has(m.name)) return;
    if (Array.isArray(m.material)) return;
    if (m.material.transparent) return;
    if (!m.geometry || !m.geometry.attributes.position) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    g.applyMatrix4(local);
    // 去掉不必要的属性，只保留 position / normal / uv
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    g.clearGroups();
    const arr = buckets.get(m.material) ?? [];
    arr.push(g);
    buckets.set(m.material, arr);
    remove.push(m);
  });

  for (const m of remove) m.parent?.remove(m);

  for (const [material, geos] of buckets) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (geos.length > 1) for (const g of geos) g.dispose();
  }
  return root;
}
