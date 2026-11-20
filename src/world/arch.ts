import * as THREE from 'three';
import { M, box, cyl, mesh, strut } from './materials';
import { plaqueTexture, stoneTexture, thousandBuddhaTexture } from './textures';

/* ============================================================
   屋顶：举折曲面 + 起翘翼角 + 瓦垄 + 正脊/戗脊 + 瓦当
   ============================================================ */

export type RoofOptions = {
  lift?: number;
  ridge?: boolean;
  dark?: boolean;
  segX?: number;
  segU?: number;
};

export function createRoof(width: number, depth: number, height: number, opts: RoofOptions = {}): THREE.Group {
  const g = new THREE.Group();
  const lift = opts.lift ?? 0.5;
  const ridge = opts.ridge !== false;
  const segX = opts.segX ?? 12;
  const segU = opts.segU ?? 14;
  const halfW = width / 2;
  const halfD = depth / 2;
  const roofMat = opts.dark ? M.roofDark : M.roof;
  const underMat = new THREE.MeshStandardMaterial({ color: '#2e2a22', roughness: 1, side: THREE.BackSide });

  const makeSlope = (sign: number) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segX; i++) {
      const x = (i / segX - 0.5) * width;
      for (let j = 0; j <= segU; j++) {
        const u = j / segU;
        const edge = Math.pow(Math.max(0, (u - 0.5) / 0.5), 2.2);
        const side = Math.pow(Math.abs(x) / halfW, 4);
        const y = height * Math.pow(1 - u, 1.5) + lift * edge * side;
        const z = sign * (u * halfD + 0.06 * edge * side);
        positions.push(x, y, z);
        uvs.push((x + halfW) / 1.15, (u * halfD) / 1.15);
      }
    }
    for (let i = 0; i < segX; i++) {
      for (let j = 0; j < segU; j++) {
        const a = i * (segU + 1) + j;
        const b = a + segU + 1;
        const c = a + 1;
        const d = b + 1;
        if (sign > 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  for (const sign of [1, -1]) {
    const geo = makeSlope(sign);
    g.add(mesh(geo, roofMat, 0, 0, 0, true, true));
    const under = mesh(geo.clone(), underMat, 0, -0.16, 0, false, false);
    under.scale.set(0.997, 1, 0.997);
    g.add(under);
  }

  // 檐口封边
  const eavePts = (sign: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24 - 0.5) * width;
      const side = Math.pow(Math.abs(x) / halfW, 4);
      pts.push(new THREE.Vector3(x, lift * side, sign * halfD));
    }
    return pts;
  };
  for (const sign of [1, -1]) {
    const curve = new THREE.CatmullRomCurve3(eavePts(sign));
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 30, 0.085, 5, false),
      new THREE.MeshStandardMaterial({ color: '#2c2923', roughness: 0.9 }),
    );
    tube.castShadow = true;
    g.add(tube);
  }

  // 瓦当
  const count = Math.max(8, Math.floor(width / 0.36));
  const tileGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.07, 8);
  tileGeo.rotateX(Math.PI / 2);
  const tileMesh = new THREE.InstancedMesh(tileGeo, M.roofDark, count * 2);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (const sign of [1, -1]) {
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1) - 0.5) * (width - 0.18);
      const side = Math.pow(Math.abs(x) / halfW, 4);
      dummy.position.set(x, lift * side - 0.02, sign * halfD + sign * 0.02);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tileMesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  tileMesh.castShadow = false;
  tileMesh.receiveShadow = true;
  g.add(tileMesh);

  if (ridge) {
    const ridgeLen = width * 0.62;
    const ridgeY = height + 0.16;
    g.add(box(ridgeLen, 0.36, 0.44, M.roofDark, 0, ridgeY, 0));
    g.add(box(ridgeLen * 0.98, 0.16, 0.54, M.roof, 0, ridgeY + 0.22, 0));
    // 鸱吻
    for (const s of [1, -1]) {
      const orn = new THREE.Group();
      orn.position.set((s * ridgeLen) / 2, ridgeY + 0.1, 0);
      orn.add(box(0.22, 0.72, 0.4, M.roofDark, 0, 0.3, 0));
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 5, 10, Math.PI * 1.1), M.roofDark);
      tail.rotation.set(0, Math.PI / 2, s > 0 ? -0.5 : 0.5);
      tail.position.set(s * 0.06, 0.66, 0);
      orn.add(tail);
      g.add(orn);
    }
    // 戗脊
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const start = new THREE.Vector3((sx * ridgeLen) / 2, ridgeY, 0);
        const end = new THREE.Vector3((sx * width) / 2 - sx * 0.1, lift + 0.05, (sz * depth) / 2 - sz * 0.1);
        const mid = new THREE.Vector3().lerpVectors(start, end, 0.55);
        mid.y += 0.16;
        const curve = new THREE.CatmullRomCurve3([start, mid, end]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.075, 5, false), M.roofDark);
        tube.castShadow = true;
        g.add(tube);
        // 翼角小兽
        const tip = mesh(new THREE.ConeGeometry(0.1, 0.3, 5), M.roofDark, end.x, end.y + 0.16, end.z);
        tip.rotation.z = sx * 0.4;
        g.add(tip);
      }
    }
  }

  // 山花
  const gy = height * 0.34;
  const zd = (halfD * (1 - Math.pow(gy / height, 1 / 1.5))) * 0.97;
  const shape = new THREE.Shape();
  shape.moveTo(-zd, gy);
  shape.lineTo(zd, gy);
  shape.lineTo(0, height * 0.97);
  shape.closePath();
  const gableGeo = new THREE.ShapeGeometry(shape);
  const gableMat = new THREE.MeshStandardMaterial({ color: '#e2d9c6', roughness: 0.96, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const gm = new THREE.Mesh(gableGeo, gableMat);
    gm.rotation.y = s * Math.PI / 2;
    gm.position.x = s * (halfW - 0.06);
    gm.receiveShadow = true;
    g.add(gm);
  }

  return g;
}

/* ============================================================
   斗拱、栏杆、台阶
   ============================================================ */

export function createDougong(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const s = scale;
  g.add(box(1.2 * s, 0.16 * s, 0.5 * s, M.redDark, 0, 0, 0));
  g.add(box(0.5 * s, 0.16 * s, 1.1 * s, M.redDark, 0, 0.17 * s, 0));
  g.add(box(1.5 * s, 0.13 * s, 0.32 * s, M.red, 0, 0.34 * s, 0));
  for (const x of [-0.62, 0, 0.62]) {
    g.add(box(0.16 * s, 0.3 * s, 0.3 * s, M.red, x * s, 0.24 * s, 0));
  }
  g.add(box(0.18 * s, 0.2 * s, 0.18 * s, M.goldDark, 0, 0.47 * s, 0));
  return g;
}

export function createRailing(length: number, along: 'x' | 'z' = 'x'): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(length / 1.5));
  for (let i = 0; i <= n; i++) {
    const t = (i / n - 0.5) * length;
    const post = box(0.18, 0.95, 0.18, M.stoneLight, 0, 0.47, 0);
    if (along === 'x') post.position.x = t;
    else post.position.z = t;
    g.add(post);
    if (i < n) {
      const rail = box(length / n, 0.12, 0.14, M.stoneLight, 0, 0.88, 0);
      const rail2 = box(length / n, 0.06, 0.1, M.stoneLight, 0, 0.52, 0);
      if (along === 'x') {
        rail.position.x = t + length / n / 2;
        rail2.position.x = t + length / n / 2;
      } else {
        rail.rotation.y = Math.PI / 2;
        rail.position.z = t + length / n / 2;
        rail2.rotation.y = Math.PI / 2;
        rail2.position.z = t + length / n / 2;
      }
      g.add(rail, rail2);
    }
  }
  return g;
}

export function createSteps(width: number, count: number, rise: number, run: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const h = rise * (i + 1);
    const step = box(width, h, run, M.stone, 0, h / 2, -i * run);
    step.receiveShadow = true;
    g.add(step);
  }
  // 垂带
  for (const s of [1, -1]) {
    const rail = box(0.4, 0.32, count * run, M.stoneDark, s * (width / 2 + 0.2), rise * count + 0.16, -((count - 1) * run) / 2);
    rail.rotation.x = -Math.atan2(rise * count, count * run) * 0.9;
    g.add(rail);
  }
  return g;
}

/* ============================================================
   大雄宝殿
   ============================================================ */

export function createHall(): { group: THREE.Group; lanterns: THREE.PointLight[] } {
  const g = new THREE.Group();
  const lights: THREE.PointLight[] = [];
  const W = 20;
  const D = 10;
  const H = 5.3;
  const baseY = 0.84;

  // 台基
  g.add(box(W + 6, 0.84, D + 6, M.stone, 0, 0.42, 0));
  g.add(box(W + 6.4, 0.14, D + 6.4, M.stoneLight, 0, 0.86, 0));
  const steps = createSteps(13, 6, 0.14, 0.42);
  steps.position.set(0, 0, D / 2 + 3 + 2.1);
  g.add(steps);

  // 地面与墙
  g.add(box(W - 0.5, 0.06, D - 0.5, M.stoneDark, 0, baseY + 0.03, 0));
  const backWall = box(W - 1.2, H, 0.4, M.plaster, 0, baseY + H / 2, -D / 2 + 0.2);
  g.add(backWall);
  g.add(box(W - 0.6, 0.5, 0.5, M.redDark, 0, baseY + 0.25, -D / 2 + 0.2));
  for (const s of [1, -1]) {
    const sideWall = box(0.4, H, D - 1.2, M.plaster, (s * (W - 0.4)) / 2, baseY + H / 2, 0);
    g.add(sideWall);
    // 侧墙木框
    g.add(box(0.5, 0.36, D - 0.8, M.redDark, (s * (W - 0.4)) / 2, baseY + H - 0.18, 0));
  }

  // 柱子
  const colX = [-9, -5.4, -1.8, 1.8, 5.4, 9];
  const columnGeo = new THREE.CylinderGeometry(0.27, 0.3, H, 10);
  for (const x of colX) {
    for (const z of [D / 2 - 0.35, -D / 2 + 0.55]) {
      const c = mesh(columnGeo, M.red, x, baseY + H / 2, z);
      g.add(c);
      g.add(cyl(0.42, 0.46, 0.22, 10, M.stoneLight, x, baseY + 0.11, z));
      const dg = createDougong(0.95);
      dg.position.set(x, baseY + H - 0.05, z);
      g.add(dg);
    }
  }

  // 额枋
  g.add(box(W + 0.8, 0.6, 0.5, M.redDark, 0, baseY + H + 0.2, D / 2 - 0.35));
  g.add(box(W + 0.8, 0.4, 0.38, M.red, 0, baseY + H + 0.62, D / 2 - 0.35));
  for (const s of [1, -1]) {
    g.add(box(0.5, 0.6, D + 0.4, M.redDark, s * (W / 2 - 0.2), baseY + H + 0.2, 0));
  }

  // 正面格扇（中间两间敞开）
  const doorW = 3.05;
  const doorH = 4.3;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 3.5;
    if (Math.abs(x) < 6) continue;
    const frame = new THREE.Group();
    frame.position.set(x, baseY + doorH / 2 + 0.1, D / 2 - 0.38);
    const panel = mesh(new THREE.PlaneGeometry(doorW, doorH), M.lattice, 0, 0, 0, false, true);
    panel.material = M.lattice;
    frame.add(panel);
    frame.add(box(doorW + 0.14, 0.12, 0.1, M.woodDark, 0, doorH / 2 + 0.04, 0.01));
    frame.add(box(doorW + 0.14, 0.12, 0.1, M.woodDark, 0, -doorH / 2 - 0.04, 0.01));
    frame.add(box(0.12, doorH, 0.1, M.woodDark, -doorW / 2 - 0.02, 0, 0.01));
    frame.add(box(0.12, doorH, 0.1, M.woodDark, doorW / 2 + 0.02, 0, 0.01));
    g.add(frame);
  }

  // 门楣与匾额
  g.add(box(W + 0.4, 0.7, 0.4, M.redDark, 0, baseY + H + 0.1, D / 2 + 0.1));
  const plaque = mesh(
    new THREE.PlaneGeometry(3.5, 1.15),
    new THREE.MeshStandardMaterial({ map: plaqueTexture('大雄宝殿'), roughness: 0.7, metalness: 0.05 }),
    0, baseY + H + 0.02, D / 2 + 0.34,
  );
  plaque.rotation.x = 0;
  g.add(plaque);
  // 柱联
  const coupletL = plaqueTexture('一花一世界', { vertical: true, bg: '#3a2a22' });
  const coupletR = plaqueTexture('一叶一如来', { vertical: true, bg: '#3a2a22' });
  for (const [x, tex] of [[-9, coupletL], [9, coupletR]] as const) {
    const c = mesh(new THREE.PlaneGeometry(0.52, 3.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), x, baseY + 3.1, D / 2 + 0.06);
    g.add(c);
  }

  // 屋顶
  const roof = createRoof(26, 16.5, 4.4, { lift: 0.7 });
  roof.position.y = baseY + H + 0.75;
  g.add(roof);
  // 檐下阴影板
  g.add(box(22, 0.18, 12, M.redDark, 0, baseY + H + 0.5, 0));

  // 内部：背屏、佛坛、佛像
  const screen = mesh(
    new THREE.PlaneGeometry(15, 4.8),
    new THREE.MeshStandardMaterial({ map: thousandBuddhaTexture(), roughness: 0.9, emissive: '#1a1208', emissiveIntensity: 0.6 }),
    0, baseY + 2.5, -D / 2 + 0.5,
  );
  g.add(screen);

  const altar = new THREE.Group();
  altar.position.set(0, baseY, -1.9);
  altar.add(box(9, 1.0, 1.5, M.woodDark, 0, 0.5, 0));
  altar.add(box(9.4, 0.12, 1.7, M.red, 0, 1.04, 0));
  // 供桌围布
  altar.add(box(8.4, 1.4, 0.08, new THREE.MeshStandardMaterial({ color: '#8d2f24', roughness: 0.9 }), 0, 0.35, 0.78));
  g.add(altar);

  return { group: g, lanterns: lights };
}

/* ============================================================
   山门
   ============================================================ */

export function createGate(): THREE.Group {
  const g = new THREE.Group();
  const wallH = 4.7;
  g.add(box(20, 0.5, 7, M.stone, 0, 0.25, 0));
  g.add(box(20.4, 0.12, 7.4, M.stoneLight, 0, 0.54, 0));

  const openings = [
    [-2.3, 2.3, 3.7],
    [-6.3, -4.4, 3.1],
    [4.4, 6.3, 3.1],
  ];
  const wallMat = new THREE.MeshStandardMaterial({ color: '#9b3f2e', roughness: 0.88 });
  // 实体墙段
  const segments: [number, number][] = [[-10, -6.3], [-4.4, -2.3], [2.3, 4.4], [6.3, 10]];
  for (const [a, b] of segments) {
    g.add(box(b - a, wallH, 2.2, wallMat, (a + b) / 2, 0.56 + wallH / 2, 0));
  }
  // 门洞上方
  for (const [a, b, h] of openings) {
    g.add(box(b - a, wallH - h, 2.2, wallMat, (a + b) / 2, 0.56 + h + (wallH - h) / 2, 0));
    // 门框
    g.add(box(b - a + 0.5, 0.32, 2.5, M.redDark, (a + b) / 2, 0.56 + h, 0));
    for (const s of [a, b]) g.add(box(0.22, h, 2.4, M.redDark, s, 0.56 + h / 2, 0));
    // 门槛
    g.add(box(b - a, 0.16, 0.3, M.stoneDark, (a + b) / 2, 0.62, 0));
  }
  // 墙体基座与压顶
  g.add(box(20, 0.5, 2.5, M.stoneDark, 0, 0.8, 0));
  g.add(box(20.4, 0.26, 2.7, M.redDark, 0, 0.56 + wallH + 0.1, 0));

  const roof = createRoof(22, 8.5, 3.0, { lift: 0.6 });
  roof.position.y = 0.56 + wallH + 0.28;
  g.add(roof);

  const plaque = mesh(
    new THREE.PlaneGeometry(2.6, 0.92),
    new THREE.MeshStandardMaterial({ map: plaqueTexture('空山', { bg: '#25322c' }), roughness: 0.72 }),
    0, 0.56 + wallH - 0.5, 1.35,
  );
  g.add(plaque);

  // 灯笼
  for (const x of [-4.9, 4.9]) {
    const l = createLantern(0.34, 1.1);
    l.position.set(x, 0.56 + 3.05, 1.5);
    g.add(l);
  }
  // 石狮
  for (const s of [1, -1]) {
    const lion = createLion();
    lion.position.set(s * 7.6, 0.56, 4.0);
    lion.rotation.y = s > 0 ? -0.25 : 0.25;
    g.add(lion);
  }
  return g;
}

/* ============================================================
   钟楼 / 鼓楼
   ============================================================ */

export function createTower(kind: 'bell' | 'drum'): { group: THREE.Group; bell?: THREE.Group; drum?: THREE.Mesh } {
  const g = new THREE.Group();
  const base = 9;
  g.add(box(base, 0.5, base, M.stone, 0, 0.25, 0));
  g.add(box(base + 0.4, 0.14, base + 0.4, M.stoneLight, 0, 0.55, 0));
  const floorY = 0.56;

  // 一层柱与栏杆
  const colH = 3.6;
  const colPositions: [number, number][] = [];
  for (const x of [-3.2, -1.1, 1.1, 3.2]) for (const z of [-3.2, 3.2]) colPositions.push([x, z]);
  for (const z of [-1.1, 1.1]) for (const x of [-3.2, 3.2]) colPositions.push([x, z]);
  for (const [x, z] of colPositions) {
    g.add(cyl(0.2, 0.22, colH, 8, M.red, x, floorY + colH / 2, z));
    g.add(cyl(0.28, 0.3, 0.14, 8, M.stoneLight, x, floorY + 0.07, z));
  }
  g.add(box(7.6, 0.42, 0.4, M.redDark, 0, floorY + colH, 0));
  g.add(box(0.4, 0.42, 7.6, M.redDark, 0, floorY + colH, 0));
  // 平座栏杆：正面留出入口
  for (const s of [-1, 1]) {
    const railFront = createRailing(2.2, 'x');
    railFront.position.set(s * 2.35, floorY + 0.1, 3.0);
    g.add(railFront);
  }
  const rail2 = createRailing(7.4, 'x');
  rail2.position.set(0, floorY + 0.1, -3.0);
  g.add(rail2);

  // 二层
  const upperY = floorY + colH + 0.1;
  g.add(box(6.2, 1.9, 6.2, M.plaster, 0, upperY + 0.95, 0));
  for (const x of [-2.8, 2.8]) for (const z of [-2.8, 2.8]) {
    g.add(cyl(0.16, 0.18, 2.2, 8, M.red, x, upperY + 1.1, z));
  }
  // 窗
  for (const s of [1, -1]) {
    const win = mesh(new THREE.PlaneGeometry(2.4, 1.2), M.lattice, 0, upperY + 1.1, s * 3.13);
    if (s < 0) win.rotation.y = Math.PI;
    g.add(win);
  }
  // 下层裙檐
  const skirt = createRoof(10.2, 10.2, 1.25, { lift: 0.45, ridge: false });
  skirt.position.y = floorY + colH + 0.3;
  g.add(skirt);
  // 上层屋顶
  const roof = createRoof(9, 9, 2.5, { lift: 0.55 });
  roof.position.y = upperY + 2.0;
  g.add(roof);

  if (kind === 'bell') {
    const bell = createBell(0.95);
    bell.userData.noMerge = true;
    bell.position.set(0, floorY + 1.35, 0);
    g.add(bell);
    const beam = box(5.4, 0.28, 0.3, M.woodDark, 0, floorY + 3.25, 0);
    g.add(beam);
    // 撞木由人物手持，不再固定在地上
    g.add(box(0.06, 1.4, 0.06, M.woodDark, 2.5, floorY + 2.3, 0));
    g.add(box(0.06, 1.4, 0.06, M.woodDark, -0.1, floorY + 2.3, 0));
    return { group: g, bell };
  }
  const drum = new THREE.Group();
  drum.userData.noMerge = true;
  drum.rotation.y = Math.PI / 2;
  const drumBody = cyl(0.95, 0.95, 1.25, 20, M.redDark, 0, 0, 0);
  drumBody.rotation.z = Math.PI / 2;
  drum.add(drumBody);
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d8c49c', roughness: 0.8 });
  for (const s of [1, -1]) {
    const skin = new THREE.Mesh(new THREE.CircleGeometry(0.94, 24), skinMat);
    skin.position.x = s * 0.63;
    skin.rotation.y = (s * Math.PI) / 2;
    drum.add(skin);
  }
  drum.position.set(0, floorY + 1.35, 0);
  g.add(drum);
  const stand = new THREE.Group();
  stand.add(box(2.9, 0.18, 1.4, M.redDark, 0, floorY + 0.3, 0));
  for (const s of [-1, 1]) stand.add(box(0.14, 1.0, 1.2, M.redDark, s * 1.2, floorY + 0.8, 0));
  g.add(stand);
  return { group: g, drum: drumBody };
}

/* ============================================================
   鼓 / 钟 / 灯笼 / 香炉 / 石灯
   ============================================================ */

export function createBell(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.12, 2.2),
    new THREE.Vector2(0.22, 2.14),
    new THREE.Vector2(0.34, 2.02),
    new THREE.Vector2(0.44, 1.7),
    new THREE.Vector2(0.5, 1.2),
    new THREE.Vector2(0.58, 0.5),
    new THREE.Vector2(0.72, 0.12),
    new THREE.Vector2(0.8, 0.04),
    new THREE.Vector2(0.7, 0),
    new THREE.Vector2(0.55, 0.06),
  ];
  const profile = pts.map((p) => p.multiplyScalar(scale));
  const geo = new THREE.LatheGeometry(profile, 28);
  const body = new THREE.Mesh(geo, M.bronze);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  g.add(cyl(0.34 * scale, 0.42 * scale, 0.16 * scale, 20, M.bronzeDark, 0, 2.24 * scale, 0));
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry((0.55 + i * 0.03) * scale, 0.018 * scale, 4, 28), M.bronzeDark);
    band.rotation.x = Math.PI / 2;
    band.position.y = (0.5 + i * 0.35) * scale;
    g.add(band);
  }
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16 * scale, 0.05 * scale, 6, 12), M.bronzeDark);
  loop.position.y = 2.34 * scale;
  g.add(loop);
  return g;
}

export function createLantern(radius = 0.36, height = 1.5): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(radius, 14, 12), M.lanternPaper, 0, 0, 0);
  body.scale.y = height / (radius * 2);
  g.add(body);
  // 竹骨
  const ringGeo = new THREE.TorusGeometry(radius * 1.005, 0.012, 4, 18);
  for (const y of [-0.35, 0, 0.35]) {
    const ring = new THREE.Mesh(ringGeo, M.goldDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y * height * 0.5;
    ring.scale.setScalar(Math.sqrt(Math.max(0.12, 1 - (y * 0.9) ** 2)));
    g.add(ring);
  }
  g.add(cyl(radius * 0.45, radius * 0.5, 0.1, 12, M.goldDark, 0, height / 2, 0));
  g.add(cyl(radius * 0.5, radius * 0.45, 0.1, 12, M.goldDark, 0, -height / 2, 0));
  g.add(box(0.02, 0.3, 0.02, M.black, 0, -height / 2 - 0.16, 0));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lanternGlow(), color: '#ffb268', transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.setScalar(radius * 6);
  g.add(glow);
  return g;
}

let _glow: THREE.Texture | null = null;
function lanternGlow(): THREE.Texture {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,200,0.9)');
  g.addColorStop(0.22, 'rgba(255,190,110,0.5)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

export function createStoneLantern(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 0.25, 1.1, M.stoneDark, 0, 0.12, 0));
  g.add(cyl(0.2, 0.26, 1.5, 6, M.stone, 0, 1.0, 0));
  g.add(box(0.95, 0.2, 0.95, M.stone, 0, 1.85, 0));
  const lightBox = box(0.7, 0.68, 0.7, M.stoneLight, 0, 2.28, 0);
  g.add(lightBox);
  const paneMat = M.glassWarm;
  for (const [x, z, ry] of [[0, 0.36, 0], [0, -0.36, Math.PI], [0.36, 0, Math.PI / 2], [-0.36, 0, -Math.PI / 2]] as const) {
    const pane = mesh(new THREE.PlaneGeometry(0.42, 0.42), paneMat, x, 2.28, z, false, false);
    pane.rotation.y = ry;
    g.add(pane);
  }
  const roofG = cyl(0.1, 0.85, 0.42, 4, M.stoneDark, 0, 2.83, 0);
  roofG.rotation.y = Math.PI / 4;
  g.add(roofG);
  g.add(box(0.14, 0.22, 0.14, M.stone, 0, 3.1, 0));
  g.scale.setScalar(scale);
  return g;
}

export function createLion(): THREE.Group {
  const g = new THREE.Group();
  const stone = M.stoneLight;
  g.add(box(1.2, 0.55, 1.5, stone, 0, 0.27, 0));
  g.add(box(0.9, 0.75, 1.15, stone, 0, 0.9, 0.05));
  const head = mesh(new THREE.IcosahedronGeometry(0.42, 1), stone, 0, 1.55, 0.42);
  g.add(head);
  // 鬃毛
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = mesh(new THREE.IcosahedronGeometry(0.17, 0), stone, Math.cos(a) * 0.4, 1.55 + Math.sin(a) * 0.35, 0.28);
    g.add(m);
  }
  for (const s of [1, -1]) {
    g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M.stoneDark, s * 0.22, 1.64, 0.66));
    const leg = box(0.22, 0.6, 0.28, stone, s * 0.32, 0.45, 0.52);
    g.add(leg);
  }
  g.add(box(0.5, 0.3, 0.35, stone, 0, 0.95, 0.6));
  return g;
}

/* ============================================================
   香炉
   ============================================================ */

export function createIncenseBurner(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 0.35, 2.6, M.stoneDark, 0, 0.17, 0));
  g.add(box(2.2, 0.2, 2.2, M.stone, 0, 0.42, 0));
  // 三足
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    g.add(cyl(0.12, 0.16, 0.65, 8, M.bronzeDark, Math.cos(a) * 0.62, 0.85, Math.sin(a) * 0.62));
  }
  const bodyPts = [
    new THREE.Vector2(0.55, 0.55),
    new THREE.Vector2(0.82, 0.68),
    new THREE.Vector2(0.95, 1.05),
    new THREE.Vector2(0.9, 1.3),
    new THREE.Vector2(0.78, 1.4),
    new THREE.Vector2(0.62, 1.35),
    new THREE.Vector2(0.55, 1.22),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 24), M.bronze);
  body.position.y = 0.3;
  body.castShadow = true;
  g.add(body);
  // 双耳
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 6, 14, Math.PI), M.bronze);
    ear.position.set(s * 0.85, 1.45, 0);
    ear.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(ear);
  }
  // 香灰
  const ash = mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshStandardMaterial({ color: '#6f6a5e', roughness: 1 }), 0, 1.62, 0);
  ash.rotation.x = -Math.PI / 2;
  g.add(ash);
  return g;
}

/* ============================================================
   藏经阁
   ============================================================ */

export function createLibrary(): THREE.Group {
  const g = new THREE.Group();
  const W = 16;
  const D = 10;
  g.add(box(W + 3, 0.6, D + 3, M.stone, 0, 0.3, 0));
  g.add(box(W + 3.4, 0.12, D + 3.4, M.stoneLight, 0, 0.64, 0));
  const floor = 0.66;
  g.add(box(W, 4.6, D, M.plaster, 0, floor + 2.3, 0));
  // 木构
  for (const x of [-W / 2 + 0.4, -W / 6, W / 6, W / 2 - 0.4]) {
    for (const z of [D / 2 - 0.2, -D / 2 + 0.2]) {
      g.add(cyl(0.2, 0.22, 4.6, 8, M.red, x, floor + 2.3, z));
    }
  }
  // 窗
  for (const x of [-5.2, 0, 5.2]) {
    g.add(mesh(new THREE.PlaneGeometry(3.1, 2.4), M.lattice, x, floor + 2.5, D / 2 + 0.02));
    g.add(box(3.3, 0.12, 0.12, M.woodDark, x, floor + 3.75, D / 2 + 0.03));
  }
  // 二层
  const upY = floor + 4.6;
  g.add(box(W - 1.2, 3.2, D - 1.2, M.plaster, 0, upY + 1.6, 0));
  for (const x of [-6.2, -2.1, 2.1, 6.2]) {
    g.add(cyl(0.14, 0.16, 3.3, 8, M.red, x, upY + 1.65, D / 2 - 0.75));
  }
  // 栏杆
  const rail = createRailing(W - 1, 'x');
  rail.position.set(0, upY + 0.1, D / 2 - 0.5);
  g.add(rail);
  // 窗
  for (const x of [-4.4, 0, 4.4]) {
    g.add(mesh(new THREE.PlaneGeometry(2.2, 1.5), M.lattice, x, upY + 1.9, D / 2 - 0.58));
  }
  // 匾
  const plaque = mesh(
    new THREE.PlaneGeometry(2.5, 0.85),
    new THREE.MeshStandardMaterial({ map: plaqueTexture('藏经阁', { bg: '#25322c' }), roughness: 0.75 }),
    0, floor + 4.0, D / 2 + 0.08,
  );
  g.add(plaque);
  // 双檐
  const skirt = createRoof(20, 14, 1.6, { lift: 0.5, ridge: false });
  skirt.position.y = floor + 4.5;
  g.add(skirt);
  const roof = createRoof(17, 11, 3.2, { lift: 0.6 });
  roof.position.y = upY + 3.2;
  g.add(roof);
  return g;
}

/* ============================================================
   七层塔
   ============================================================ */

export function createPagoda(): THREE.Group {
  const g = new THREE.Group();
  const stone = M.stoneLight;
  g.add(cyl(3.6, 3.9, 0.6, 8, M.stone, 0, 0.3, 0));
  g.add(cyl(3.2, 3.4, 0.5, 8, M.stoneLight, 0, 0.85, 0));
  let y = 1.1;
  for (let i = 0; i < 7; i++) {
    const r = 2.6 - i * 0.26;
    const h = 1.55 - i * 0.06;
    const body = cyl(r, r, h, 8, i % 2 === 0 ? M.plaster : M.red, 0, y + h / 2, 0);
    g.add(body);
    // 门洞
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const door = mesh(new THREE.PlaneGeometry(r * 0.42, h * 0.62), M.redDark, Math.cos(a) * (r - 0.02), y + h * 0.48, Math.sin(a) * (r - 0.02), false, false);
      door.rotation.y = -a + Math.PI / 2;
      g.add(door);
    }
    // 檐
    const eave = cyl(r + 1.15, r + 1.35, 0.22, 8, M.roofDark, 0, y + h + 0.08, 0);
    eave.rotation.y = Math.PI / 8;
    g.add(eave);
    // 起翘角
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const rr = r + 1.28;
      const tip = box(0.16, 0.12, 0.5, M.roofDark, Math.cos(a) * rr, y + h + 0.24, Math.sin(a) * rr);
      tip.rotation.y = -a;
      tip.rotation.z = 0.32;
      g.add(tip);
    }
    // 檐下铃
    if (i < 5) {
      for (const k of [0, 2, 4, 6]) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const bell = mesh(new THREE.ConeGeometry(0.1, 0.22, 6), M.goldDark, Math.cos(a) * (r + 1.15), y + h - 0.1, Math.sin(a) * (r + 1.15), false, false);
        bell.rotation.x = Math.PI;
        g.add(bell);
      }
    }
    y += h + 0.32;
  }
  // 塔刹
  g.add(cyl(0.16, 0.3, 2.4, 8, M.bronzeDark, 0, y + 1.0, 0));
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.04, 0.035, 4, 16), M.gold,);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + 0.35 + i * 0.33;
    g.add(ring);
  }
  const pearl = mesh(new THREE.SphereGeometry(0.16, 10, 8), M.gold, 0, y + 2.25, 0);
  g.add(pearl);
  return g;
}

/* ============================================================
   桥
   ============================================================ */

export function createBridge(length = 13, width = 3.4, rise = 0.9): { group: THREE.Group; heightAt: (zLocal: number) => number } {
  const g = new THREE.Group();
  const n = 28;
  const half = length / 2;
  const arch = (t: number) => Math.sin((t / length) * Math.PI) * rise + 0.02;

  // 连续拱面
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * length;
    const z = t - half;
    const y = arch(t);
    positions.push(-width / 2, y, z, width / 2, y, z);
    uvs.push(0, t / 2, 1, t / 2);
    if (i < n) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  deckGeo.setIndex(indices);
  deckGeo.computeVertexNormals();
  const deckMat = new THREE.MeshStandardMaterial({ color: '#9a9889', roughness: 0.96, map: stoneTexture('#7d7b6e') });
  deckMat.map!.repeat.set(2, 6);
  const deck = mesh(deckGeo, deckMat);
  g.add(deck);

  // 侧板与拱腹
  for (const s of [1, -1]) {
    const sidePos: number[] = [];
    const sideIdx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * length;
      const y = arch(t);
      sidePos.push(s * width / 2, y, t - half, s * width / 2, y - 0.34, t - half);
      if (i < n) {
        const a = i * 2;
        if (s > 0) sideIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else sideIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
    geo.setIndex(sideIdx);
    geo.computeVertexNormals();
    g.add(mesh(geo, M.stoneDark));
  }

  // 弧线栏杆
  for (const s of [1, -1]) {
    const railPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * length;
      railPts.push(new THREE.Vector3(s * (width / 2 - 0.06), arch(t) + 0.9, t - half));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 30, 0.055, 5, false), M.stoneLight);
    rail.castShadow = true;
    g.add(rail);
    const rail2Curve = new THREE.CatmullRomCurve3(railPts.map((p) => p.clone().setY(p.y - 0.42)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(rail2Curve, 30, 0.045, 5, false), M.stoneLight));
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * length;
      const z = t - half;
      const post = box(0.13, 0.92, 0.13, M.stoneLight, s * (width / 2 - 0.06), arch(t) + 0.46, z);
      g.add(post);
      // 望柱头
      g.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), M.stone, s * (width / 2 - 0.06), arch(t) + 0.96, z));
    }
  }

  // 桥墩
  for (const s of [1, -1]) {
    g.add(box(width + 0.8, 0.8, 0.7, M.stoneDark, 0, -0.35, s * (half - 0.6)));
  }

  return { group: g, heightAt: (z: number) => arch(z + half) };
}

/* ============================================================
   照壁 / 石碑
   ============================================================ */

export function createStele(text: string): { group: THREE.Group; plaque: THREE.Mesh } {
  const g = new THREE.Group();
  g.add(box(2.2, 0.3, 1.2, M.stoneDark, 0, 0.15, 0));
  g.add(box(1.5, 2.6, 0.36, M.stoneLight, 0, 1.5, 0));
  const plaque = mesh(
    new THREE.PlaneGeometry(1.05, 2.1),
    new THREE.MeshStandardMaterial({ map: plaqueTexture(text, { vertical: true, bg: '#b7b3a2', fg: '#3a3a31', border: '#7d7a6c' }), roughness: 0.95 }),
    0, 1.55, 0.19,
  );
  g.add(plaque);
  const cap = box(1.8, 0.25, 0.6, M.stoneDark, 0, 2.9, 0);
  g.add(cap);
  return { group: g, plaque };
}

/* ============================================================
   蒲团 / 供桌 / 木鱼 / 签筒 / 经桌
   ============================================================ */

export function createCushion(): THREE.Group {
  const g = new THREE.Group();
  const base = cyl(0.46, 0.5, 0.14, 20, M.cushionDark, 0, 0.07, 0);
  g.add(base);
  const top = mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.cushion, 0, 0.14, 0);
  top.scale.y = 0.32;
  g.add(top);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.016, 4, 24), M.goldDark);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.16;
  g.add(trim);
  return g;
}

export function createLowTable(w = 2.2, d = 0.9, h = 0.72): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.1, d, M.woodDark, 0, h, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.1, h, 0.1, M.woodDark, sx * (w / 2 - 0.12), h / 2, sz * (d / 2 - 0.1)));
  }
  g.add(box(w - 0.3, 0.04, d - 0.2, M.wood, 0, h + 0.07, 0));
  return g;
}

export function createMuyu(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.3, 16, 12), M.wood, 0, 0.26, 0);
  body.scale.set(1.2, 0.95, 0.9);
  g.add(body);
  const mouth = box(0.34, 0.1, 0.06, M.black, 0.16, 0.28, 0.24);
  mouth.rotation.z = -0.2;
  g.add(mouth);
  const handle = mesh(new THREE.TorusGeometry(0.06, 0.02, 5, 10), M.goldDark, -0.26, 0.32, 0);
  g.add(handle);
  const cushion = cyl(0.36, 0.4, 0.07, 16, M.cushionDark, 0, 0.035, 0);
  g.add(cushion);
  return g;
}

export function createMallet(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 0.55, 8, M.woodDark, 0, 0.27, 0));
  const head = mesh(new THREE.SphereGeometry(0.1, 10, 8), M.wood, 0, 0.56, 0);
  head.scale.set(1, 0.85, 1);
  g.add(head);
  return g;
}

export function createSignTube(): THREE.Group {
  const g = new THREE.Group();
  const tube = cyl(0.3, 0.28, 1.0, 16, M.wood, 0, 0.5, 0);
  g.add(tube);
  const inner = cyl(0.26, 0.26, 0.04, 16, M.black, 0, 1.0, 0);
  g.add(inner);
  // 签
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.13;
    const stick = box(0.035, 0.55, 0.012, M.paper, Math.cos(a) * r, 1.15, Math.sin(a) * r);
    stick.rotation.z = (Math.random() - 0.5) * 0.15;
    stick.rotation.y = a;
    g.add(stick);
  }
  // 红签头
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 20), M.red);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.82;
  g.add(band);
  return g;
}
