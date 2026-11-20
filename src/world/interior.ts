import * as THREE from 'three';
import { M, box, cyl, mesh, strut } from './materials';
import { createCushion, createLantern } from './arch';
import { plaqueTexture } from './textures';

function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
  g.addColorStop(0, 'rgba(255,232,170,0.42)');
  g.addColorStop(0.4, 'rgba(255,198,100,0.18)');
  g.addColorStop(0.72, 'rgba(255,170,60,0.07)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _halo: THREE.Texture | null = null;
function halo() {
  return (_halo ??= haloTexture());
}

/** 结跏趺坐佛像（程序化，风格化） */
export function createBuddha(scale = 1, bright = true): THREE.Group {
  const g = new THREE.Group();
  const gold = bright ? M.gold : M.bronze;
  const dark = bright ? M.goldDark : M.bronzeDark;
  const faceMat = new THREE.MeshStandardMaterial({
    color: bright ? '#c9a259' : '#8a7345',
    roughness: 0.5,
    metalness: 0.55,
  });

  // —— 莲座
  g.add(cyl(1.42, 1.55, 0.16, 24, dark, 0, 0.08, 0));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const petal = mesh(new THREE.SphereGeometry(0.32, 8, 6), gold, Math.cos(a) * 1.22, 0.22, Math.sin(a) * 1.22);
    petal.scale.set(0.45, 0.28, 0.9);
    petal.rotation.y = -a;
    petal.rotation.z = 0.35;
    g.add(petal);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const petal = mesh(new THREE.SphereGeometry(0.28, 8, 6), gold, Math.cos(a) * 0.95, 0.42, Math.sin(a) * 0.95);
    petal.scale.set(0.45, 0.3, 0.85);
    petal.rotation.y = -a;
    petal.rotation.z = 0.55;
    g.add(petal);
  }
  g.add(cyl(0.9, 1.12, 0.14, 20, dark, 0, 0.52, 0));

  // —— 结跏趺坐
  const lap = mesh(new THREE.SphereGeometry(1.08, 20, 12), gold, 0, 0.98, 0.06);
  lap.scale.set(1.18, 0.42, 0.86);
  g.add(lap);
  for (const s of [1, -1]) {
    const thigh = strut(
      new THREE.Vector3(s * 0.18, 0.92, 0.5),
      new THREE.Vector3(s * 0.95, 0.88, 0.16),
      0.26,
      gold,
      8,
    );
    g.add(thigh);
    const knee = mesh(new THREE.SphereGeometry(0.3, 12, 8), gold, s * 0.98, 0.92, 0.12);
    knee.scale.set(1, 0.75, 1);
    g.add(knee);
    // 脚
    const foot = mesh(new THREE.SphereGeometry(0.16, 10, 8), dark, s * 0.16, 1.12, 0.66);
    foot.scale.set(1.5, 0.7, 1.2);
    g.add(foot);
  }

  // —— 衣摆
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.62 + i * 0.1, 0.035, 4, 20, Math.PI * 0.95),
      dark,
    );
    arc.position.set(0, 0.88 + i * 0.015, 0.72 - i * 0.03);
    arc.rotation.x = Math.PI / 2 + 0.2;
    arc.rotation.z = Math.PI;
    g.add(arc);
  }

  // —— 躯干
  const profile: THREE.Vector2[] = [];
  const pts: [number, number][] = [
    [0.66, 0], [0.78, 0.28], [0.74, 0.62], [0.64, 1.0], [0.66, 1.28],
    [0.78, 1.55], [0.72, 1.78], [0.5, 1.94], [0.26, 2.0],
  ];
  for (const [r, y] of pts) profile.push(new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), gold);
  torso.scale.z = 0.74;
  torso.position.y = 0.95;
  torso.castShadow = true;
  torso.receiveShadow = true;
  g.add(torso);

  // 袈裟斜襟
  for (let i = 0; i < 3; i++) {
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.72 - i * 0.02, 0.032, 4, 24, Math.PI * 1.02), dark);
    sash.position.set(0.1, 2.72 + i * 0.02, 0.12);
    sash.rotation.set(Math.PI / 2 + 0.28, 0.25, -0.55);
    g.add(sash);
  }

  // —— 肩与手臂
  for (const s of [1, -1]) {
    const shoulder = mesh(new THREE.SphereGeometry(0.32, 12, 10), gold, s * 0.66, 2.72, 0.02);
    shoulder.scale.set(1, 0.92, 0.9);
    g.add(shoulder);
    const upper = strut(new THREE.Vector3(s * 0.78, 2.62, 0.02), new THREE.Vector3(s * 0.95, 2.02, 0.34), 0.17, gold, 8);
    g.add(upper);
    const fore = strut(new THREE.Vector3(s * 0.95, 2.02, 0.34), new THREE.Vector3(s * 0.36, 1.74, 0.6), 0.14, gold, 8);
    g.add(fore);
    const hand = mesh(new THREE.SphereGeometry(0.17, 10, 8), faceMat, s * 0.28, 1.72, 0.63);
    hand.scale.set(1.25, 0.55, 0.9);
    g.add(hand);
  }

  // —— 禅定印
  const bowl = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 5, 18), dark);
  bowl.rotation.x = Math.PI / 2;
  bowl.position.set(0, 1.78, 0.62);
  g.add(bowl);

  // —— 颈与头
  g.add(cyl(0.17, 0.2, 0.28, 12, faceMat, 0, 2.98, 0.02));
  const head = mesh(new THREE.SphereGeometry(0.42, 20, 16), faceMat, 0, 3.3, 0.02);
  head.scale.set(1, 1.1, 0.96);
  g.add(head);
  // 螺发
  for (let i = 0; i < 34; i++) {
    const phi = Math.acos(1 - (i % 17) / 18 * 0.62);
    const theta = i * 2.39996;
    const r = 0.42;
    const x = Math.sin(phi) * Math.cos(theta) * r;
    const z = Math.sin(phi) * Math.sin(theta) * r;
    const y = Math.cos(phi) * r * 1.1;
    const curl = mesh(new THREE.SphereGeometry(0.065, 6, 5), dark, x, 3.3 + y + 0.06, 0.02 + z);
    g.add(curl);
  }
  g.add(mesh(new THREE.SphereGeometry(0.15, 12, 8), dark, 0, 3.82, 0.0));
  // 耳
  for (const s of [1, -1]) {
    const ear = mesh(new THREE.SphereGeometry(0.11, 8, 8), faceMat, s * 0.4, 3.3, 0.02);
    ear.scale.set(0.7, 2.4, 1.0);
    g.add(ear);
  }
  // 面容（闭目）
  const lineMat = new THREE.MeshStandardMaterial({ color: '#4a3418', roughness: 0.7, metalness: 0.3 });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 4, 12, Math.PI), lineMat);
    eye.position.set(s * 0.16, 3.34, 0.4);
    eye.rotation.z = Math.PI;
    g.add(eye);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 4, 12, Math.PI), lineMat);
    brow.position.set(s * 0.16, 3.45, 0.37);
    brow.rotation.z = Math.PI * 1.05;
    g.add(brow);
  }
  const nose = mesh(new THREE.ConeGeometry(0.045, 0.12, 6), faceMat, 0, 3.27, 0.41);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);
  g.add(box(0.14, 0.016, 0.02, lineMat, 0, 3.17, 0.41));
  g.add(box(0.06, 0.014, 0.02, lineMat, 0, 3.2, 0.42));
  // 白毫
  g.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), M.paper, 0, 3.4, 0.42));

  // —— 背光
  const haloPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({
      map: halo(), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  haloPlane.position.set(0, 2.9, -0.62);
  g.add(haloPlane);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.035, 5, 48), M.goldDark);
  ring.position.set(0, 2.9, -0.58);
  g.add(ring);

  g.scale.setScalar(scale);
  return g;
}

/** 三世佛 + 供桌陈设 + 蒲团 + 幡 */
export function createAltarScene(): { group: THREE.Group; lights: THREE.PointLight[] } {
  const g = new THREE.Group();
  const lights: THREE.PointLight[] = [];

  const central = createBuddha(1.02, true);
  central.position.set(0, 0, -3.55);
  g.add(central);
  for (const s of [1, -1]) {
    const side = createBuddha(0.78, false);
    side.position.set(s * 2.9, 0, -3.35);
    side.rotation.y = -s * 0.12;
    g.add(side);
  }

  // 供桌
  g.add(box(9.0, 1.15, 1.3, M.woodDark, 0, 0.58, -1.75));
  g.add(box(9.4, 0.1, 1.5, M.red, 0, 1.2, -1.75));
  const cloth = new THREE.MeshStandardMaterial({ color: '#8e3125', roughness: 0.92 });
  g.add(box(8.3, 1.5, 0.06, cloth, 0, 0.55, -1.08));

  // 烛台
  for (const s of [1, -1]) {
    g.add(cyl(0.1, 0.16, 1.0, 8, M.goldDark, s * 3.2, 1.72, -1.7));
    g.add(cyl(0.2, 0.16, 0.06, 12, M.gold, s * 3.2, 2.24, -1.7));
    const candle = cyl(0.075, 0.08, 0.34, 10, M.paper, s * 3.2, 2.42, -1.7);
    g.add(candle);
    const flame = mesh(new THREE.ConeGeometry(0.045, 0.16, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), s * 3.2, 2.66, -1.7, false, false);
    g.add(flame);
    const pl = new THREE.PointLight('#ffc27a', 5, 5, 2);
    pl.position.set(s * 3.2, 2.7, -1.7);
    g.add(pl);
    lights.push(pl);
  }

  // 果盘
  for (const [x, color] of [[-1.6, '#d8892f'], [0, '#c9b05a'], [1.6, '#b7442e']] as const) {
    g.add(cyl(0.42, 0.3, 0.14, 16, M.goldDark, x, 1.34, -1.55));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.65 }), x + Math.cos(a) * 0.18, 1.48, -1.55 + Math.sin(a) * 0.18));
    }
  }

  // 香炉（小）
  const censer = new THREE.Group();
  censer.position.set(0, 1.28, -1.5);
  censer.add(cyl(0.2, 0.26, 0.28, 14, M.bronze, 0, 0.14, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    censer.add(cyl(0.025, 0.03, 0.16, 6, M.bronzeDark, Math.cos(a) * 0.17, -0.05, Math.sin(a) * 0.17));
  }
  g.add(censer);
  // 三炷香
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.05;
    g.add(cyl(0.008, 0.008, 0.42, 4, new THREE.MeshStandardMaterial({ color: '#6b4b32' }), x, 1.82, -1.5));
    g.add(mesh(new THREE.SphereGeometry(0.014, 5, 5), new THREE.MeshBasicMaterial({ color: '#ff8a3c' }), x, 2.03, -1.5, false, false));
  }

  // 磬
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.bronze);
  bowl.scale.y = 0.55;
  bowl.position.set(2.2, 1.28, -1.4);
  g.add(bowl);

  // 蒲团
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = createCushion();
      c.position.set((col - 1) * 2.1, 0, 1.0 + row * 1.15);
      g.add(c);
    }
  }

  // 长明灯
  for (const s of [1, -1]) {
    const lantern = createLantern(0.34, 1.15);
    lantern.position.set(s * 5.4, 4.15, 1.9);
    g.add(lantern);
    const pl = new THREE.PointLight('#ffb066', 7, 9, 2);
    pl.position.set(s * 5.4, 4.15, 1.9);
    g.add(pl);
    lights.push(pl);
    const front = createLantern(0.4, 1.3);
    front.position.set(s * 3.0, 3.5, 3.4);
    g.add(front);
  }

  // 幡
  const bannerTex = plaqueTexture('南无本师释迦牟尼佛', {
    vertical: true, bg: '#8d2f24', fg: '#e8cf9a', border: '#c9a86e',
  });
  for (const s of [1, -1]) {
    const banner = mesh(
      new THREE.PlaneGeometry(0.9, 3.6),
      new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.92 }),
      s * 6.6, 3.5, -2.4,
    );
    banner.rotation.y = s * 0.12;
    g.add(banner);
    const rod = box(1.0, 0.06, 0.06, M.goldDark, s * 6.6, 5.32, -2.4);
    g.add(rod);
  }

  // 顶部横梁
  for (const z of [-3.4, -0.6, 2.2]) {
    g.add(box(17, 0.24, 0.3, M.redDark, 0, 5.55, z));
  }

  // 主光源
  const key = new THREE.PointLight('#ffcf98', 46, 20, 2);
  key.position.set(0, 4.2, -2.2);
  g.add(key);
  lights.push(key);
  const frontFill = new THREE.PointLight('#ffd8ac', 16, 12, 2);
  frontFill.position.set(0, 4.4, 3.2);
  g.add(frontFill);
  lights.push(frontFill);

  return { group: g, lights };
}
