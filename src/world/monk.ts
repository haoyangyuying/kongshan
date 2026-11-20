import * as THREE from 'three';
import { M, box, cyl, mesh } from './materials';

export type MonkColors = {
  robe: string;
  robeDark: string;
  sash: string;
  skin: string;
  shoe: string;
};

export const DEFAULT_MONK: MonkColors = {
  robe: '#7a7565',
  robeDark: '#5f5b4d',
  sash: '#9a422e',
  skin: '#e3bf98',
  shoe: '#33322b',
};

export type MonkRig = {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  mallet: THREE.Group;
  woodfish: THREE.Group;
  striker: THREE.Group;
  drumstick: THREE.Group;
  incense: THREE.Group;
  lantern: THREE.Group;
  shadow: THREE.Mesh;
};

function blobTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

let _blob: THREE.Texture | null = null;
const faceLine = new THREE.MeshStandardMaterial({ color: '#4a3425', roughness: 0.8 });

export function createMonk(colors: MonkColors = DEFAULT_MONK): MonkRig {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.58;
  root.add(hips);

  const robeMat = new THREE.MeshStandardMaterial({ color: colors.robe, roughness: 0.95 });
  const robeDarkMat = new THREE.MeshStandardMaterial({ color: colors.robeDark, roughness: 0.95 });
  const sashMat = new THREE.MeshStandardMaterial({ color: colors.sash, roughness: 0.92 });
  const skinMat = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: colors.shoe, roughness: 0.9 });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#ded1b4', roughness: 0.9 });

  // 下裙
  const skirt = cyl(0.225, 0.35, 0.46, 14, robeMat, 0, -0.22, 0);
  hips.add(skirt);
  const hem = cyl(0.35, 0.35, 0.055, 14, robeDarkMat, 0, -0.44, 0);
  hips.add(hem);
  // 裙褶
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const fold = box(0.028, 0.4, 0.02, robeDarkMat, Math.cos(a) * 0.3, -0.24, Math.sin(a) * 0.3);
    fold.rotation.y = -a;
    hips.add(fold);
  }

  // 腿
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.105, 0, 0);
    const thigh = mesh(new THREE.CapsuleGeometry(0.062, 0.16, 4, 8), robeDarkMat, 0, -0.1, 0);
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.22;
    leg.add(knee);
    const shin = mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), robeDarkMat, 0, -0.09, 0);
    knee.add(shin);
    const shoe = mesh(new THREE.SphereGeometry(0.082, 8, 6), shoeMat, 0, -0.2, 0.035);
    shoe.scale.set(1.1, 0.62, 1.7);
    knee.add(shoe);
    return { leg, knee };
  };
  const { leg: legL, knee: kneeL } = makeLeg(1);
  const { leg: legR, knee: kneeR } = makeLeg(-1);
  hips.add(legL, legR);

  // 上身
  const torso = new THREE.Group();
  hips.add(torso);
  const chest = cyl(0.17, 0.215, 0.4, 14, robeMat, 0, 0.2, 0);
  chest.scale.z = 0.82;
  torso.add(chest);
  const belly = mesh(new THREE.SphereGeometry(0.2, 14, 10), robeMat, 0, 0.08, 0);
  belly.scale.set(1.06, 0.7, 0.86);
  torso.add(belly);
  const shoulders = mesh(new THREE.SphereGeometry(0.2, 14, 10), robeMat, 0, 0.4, 0);
  shoulders.scale.set(1.18, 0.55, 0.88);
  torso.add(shoulders);

  // 腰带与结
  torso.add(cyl(0.218, 0.225, 0.075, 14, sashMat, 0, 0.015, 0));
  const knot = mesh(new THREE.SphereGeometry(0.055, 8, 6), sashMat, 0, 0.02, -0.17);
  knot.scale.set(1.2, 0.9, 0.7);
  torso.add(knot);
  for (const s of [-1, 1]) {
    const end = box(0.065, 0.26, 0.02, sashMat, s * 0.055, -0.13, -0.18);
    end.rotation.z = s * 0.16;
    torso.add(end);
  }

  // 交领与袈裟
  for (const s of [1, -1]) {
    const collar = box(0.06, 0.26, 0.02, innerMat, s * 0.07, 0.37, 0.145);
    collar.rotation.z = s * 0.42;
    torso.add(collar);
  }
  const frontStrap = box(0.105, 0.58, 0.025, sashMat, 0.035, 0.25, 0.148);
  frontStrap.rotation.z = 0.4;
  torso.add(frontStrap);
  const backStrap = box(0.105, 0.58, 0.025, sashMat, 0.035, 0.25, -0.147);
  backStrap.rotation.z = 0.4;
  torso.add(backStrap);
  const shoulderWrap = box(0.16, 0.06, 0.3, sashMat, 0.14, 0.44, 0);
  torso.add(shoulderWrap);

  // 念珠
  const beadMat = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.62 });
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.019, 6, 5), beadMat, 26);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    dummy.position.set(Math.sin(a) * 0.155, 0.37 - Math.cos(a) * 0.02, Math.cos(a) * 0.12);
    dummy.scale.setScalar(i % 7 === 0 ? 1.35 : 1);
    dummy.updateMatrix();
    beads.setMatrixAt(i, dummy.matrix);
  }
  beads.castShadow = false;
  torso.add(beads);
  const guruBead = mesh(new THREE.SphereGeometry(0.028, 8, 6), beadMat, 0, 0.335, 0.165);
  torso.add(guruBead);

  // 手臂
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.215, 0.37, 0.005);
    const upper = mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8), robeMat, 0, -0.09, 0);
    arm.add(upper);
    // 宽袖
    const sleeve = cyl(0.072, 0.125, 0.26, 10, robeMat, 0, -0.13, 0);
    arm.add(sleeve);
    const sleeveEdge = cyl(0.128, 0.108, 0.05, 10, robeDarkMat, 0, -0.25, 0);
    arm.add(sleeveEdge);
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    arm.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.042, 0.13, 4, 8), skinMat, 0, -0.07, 0);
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -0.17;
    elbow.add(hand);
    const palm = mesh(new THREE.SphereGeometry(0.058, 8, 6), skinMat, 0, 0, 0);
    palm.scale.set(1.0, 1.25, 0.7);
    hand.add(palm);
    return { arm, elbow, hand };
  };
  const { arm: armL, elbow: elbowL, hand: handL } = makeArm(1);
  const { arm: armR, elbow: elbowR, hand: handR } = makeArm(-1);
  torso.add(armL, armR);

  // 头
  const head = new THREE.Group();
  head.position.y = 0.46;
  torso.add(head);
  head.add(cyl(0.055, 0.062, 0.09, 8, skinMat, 0, -0.02, 0));
  const skull = mesh(new THREE.SphereGeometry(0.175, 20, 16), skinMat, 0, 0.14, 0.005);
  skull.scale.set(1, 1.03, 0.98);
  head.add(skull);
  for (const s of [1, -1]) {
    const ear = mesh(new THREE.SphereGeometry(0.035, 8, 8), skinMat, s * 0.172, 0.13, 0);
    ear.scale.set(0.5, 1.5, 0.85);
    head.add(ear);
    // 闭眼
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 3, 10, Math.PI), faceLine);
    eye.position.set(s * 0.068, 0.165, 0.165);
    eye.rotation.z = Math.PI;
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.005, 3, 10, Math.PI), faceLine);
    brow.position.set(s * 0.068, 0.215, 0.157);
    brow.rotation.z = Math.PI * 1.04;
    head.add(brow);
  }
  // 鼻与嘴
  const nose = mesh(new THREE.SphereGeometry(0.022, 6, 5), skinMat, 0, 0.135, 0.175);
  nose.scale.set(1, 1.2, 0.8);
  head.add(nose);
  head.add(box(0.045, 0.006, 0.008, faceLine, 0, 0.1, 0.172));
  // 戒疤
  for (const [x, z] of [[0, 0.02], [-0.042, -0.03], [0.042, -0.03]]) {
    head.add(mesh(new THREE.SphereGeometry(0.013, 5, 4), new THREE.MeshStandardMaterial({ color: '#9a6448' }), x, 0.3, z));
  }
  // 腮红
  for (const s of [1, -1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.028, 6, 5), new THREE.MeshStandardMaterial({ color: '#d99b82', transparent: true, opacity: 0.35 }), s * 0.105, 0.12, 0.145, false, false);
    cheek.scale.set(1, 0.6, 0.3);
    head.add(cheek);
  }

  // 木槌
  const mallet = new THREE.Group();
  mallet.position.set(0, -0.2, 0.02);
  mallet.add(cyl(0.012, 0.012, 0.34, 6, M.woodDark, 0, -0.12, 0));
  const mhead = mesh(new THREE.SphereGeometry(0.055, 8, 6), M.wood, 0, -0.3, 0);
  mhead.scale.set(1, 1.2, 1);
  mallet.add(mhead);
  mallet.visible = false;
  handR.add(mallet);

  // 香
  const incense = new THREE.Group();
  incense.position.set(0, -0.03, 0.02);
  for (let i = 0; i < 3; i++) {
    const stick = cyl(0.006, 0.006, 0.34, 4, new THREE.MeshStandardMaterial({ color: '#7a5436' }), (i - 1) * 0.018, 0.1, 0);
    incense.add(stick);
    incense.add(mesh(new THREE.SphereGeometry(0.009, 4, 4), new THREE.MeshBasicMaterial({ color: '#ff8a3c' }), (i - 1) * 0.018, 0.27, 0));
  }
  incense.visible = false;
  handL.add(incense);

  // 放灯时手里的小莲灯
  const lantern = new THREE.Group();
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#e8b563', emissive: '#ffb45e', emissiveIntensity: 1.1,
    roughness: 0.85, side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.12, 10, 1, true), shadeMat);
  shade.position.y = 0.01;
  lantern.add(shade);
  const lPetals = new THREE.MeshStandardMaterial({ color: '#dca3a8', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 4, 1, true), lPetals);
    petal.position.set(Math.cos(a) * 0.07, -0.055, Math.sin(a) * 0.07);
    petal.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
    lantern.add(petal);
  }
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffe6b0' }));
  flame.position.y = 0.04;
  lantern.add(flame);
  lantern.position.set(0, -0.19, 0.02);
  lantern.visible = false;
  handL.add(lantern);

  // 坐着诵经时手里的小木鱼
  const woodfish = new THREE.Group();
  const fishBody = mesh(new THREE.SphereGeometry(0.12, 12, 8), M.wood, 0, 0, 0);
  fishBody.scale.set(1.0, 0.55, 0.75);
  woodfish.add(fishBody);
  woodfish.add(box(0.15, 0.018, 0.035, M.woodDark, 0, 0.055, 0.005));
  woodfish.add(mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12), M.woodDark, 0, 0.06, 0.04));
  woodfish.position.set(0, -0.12, 0.08);
  woodfish.visible = false;
  handL.add(woodfish);

  // 撞钟的长木槌（随人物和钟一起动）
  const striker = new THREE.Group();
  const strikeShaft = cyl(0.032, 0.04, 0.95, 8, M.wood, 0, 0, 0.38);
  strikeShaft.rotation.x = Math.PI / 2;
  striker.add(strikeShaft);
  striker.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), M.woodDark, 0, 0, 0.86));
  striker.position.set(0, -0.16, 0.08);
  striker.visible = false;
  handR.add(striker);

  // 击鼓的短鼓槌
  const drumstick = new THREE.Group();
  const dsShaft = cyl(0.02, 0.025, 0.46, 8, M.wood, 0, 0, 0.23);
  dsShaft.rotation.x = Math.PI / 2;
  drumstick.add(dsShaft);
  drumstick.add(mesh(new THREE.SphereGeometry(0.065, 10, 8), M.woodDark, 0, 0, 0.46));
  drumstick.position.set(0, -0.14, 0.05);
  drumstick.visible = false;
  handR.add(drumstick);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: (_blob ??= blobTexture()), transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m !== shadow) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return {
    root, hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR, handL, handR,
    mallet, woodfish, striker, drumstick, incense, lantern, shadow,
  };
}

export type PoseState = 'idle' | 'walk' | 'bow' | 'sit' | 'palms' | 'knock' | 'strike' | 'incense' | 'lantern' | 'wave';

/** 程序化姿态。progress 仅用于一次性动作。 */
export function poseMonk(rig: MonkRig, state: PoseState, t: number, walkPhase = 0, progress = 0) {
  const { hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR } = rig;
  hips.position.y = 0.58;
  hips.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0);
  torso.position.set(0, 0, 0);
  torso.scale.y = 1;
  head.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0.14);
  armR.rotation.set(0, 0, -0.14);
  elbowL.rotation.set(0, 0, 0);
  elbowR.rotation.set(0, 0, 0);
  legL.rotation.set(0, 0, 0.02);
  legR.rotation.set(0, 0, -0.02);
  kneeL.rotation.set(0, 0, 0);
  kneeR.rotation.set(0, 0, 0);
  rig.mallet.visible = false;
  rig.woodfish.visible = false;
  rig.striker.visible = false;
  rig.drumstick.visible = false;
  rig.incense.visible = false;
  rig.lantern.visible = false;

  const breathe = Math.sin(t * 1.4) * 0.012;
  torso.scale.y = 1 + breathe;
  head.position.y = 0.46 + Math.sin(t * 1.4 + 0.4) * 0.004;

  if (state === 'idle') {
    armL.rotation.z = 0.14 + Math.sin(t * 1.1) * 0.015;
    armR.rotation.z = -0.14 - Math.sin(t * 1.1) * 0.015;
    head.rotation.y = Math.sin(t * 0.23) * 0.08;
    torso.rotation.y = Math.sin(t * 0.18) * 0.03;
    return;
  }

  if (state === 'walk') {
    const p = walkPhase;
    const s = Math.sin(p);
    legL.rotation.x = s * 0.55;
    legR.rotation.x = -s * 0.55;
    kneeL.rotation.x = Math.max(0, -s) * 0.6;
    kneeR.rotation.x = Math.max(0, s) * 0.6;
    armL.rotation.x = -s * 0.45;
    armR.rotation.x = s * 0.45;
    armL.rotation.z = 0.18;
    armR.rotation.z = -0.18;
    elbowL.rotation.x = 0.16;
    elbowR.rotation.x = 0.16;
    hips.position.y = 0.58 + Math.abs(Math.cos(p)) * 0.022;
    torso.rotation.x = 0.05;
    torso.rotation.y = s * 0.05;
    head.rotation.y = -s * 0.04;
    return;
  }

  if (state === 'bow') {
    const bend = Math.sin(Math.min(1, progress) * Math.PI);
    torso.rotation.x = bend * 1.02;
    hips.position.y = 0.58 - bend * 0.05;
    head.rotation.x = bend * 0.2;
    armL.rotation.x = -bend * 0.8;
    armR.rotation.x = -bend * 0.8;
    armL.rotation.z = 0.5;
    armR.rotation.z = -0.5;
    elbowL.rotation.x = 0.85;
    elbowR.rotation.x = 0.85;
    return;
  }

  if (state === 'palms') {
    const raise = Math.sin(Math.min(1, progress) * Math.PI * 0.9);
    armL.rotation.x = -1.15 * raise;
    armR.rotation.x = -1.15 * raise;
    armL.rotation.z = 0.55 * raise;
    armR.rotation.z = -0.55 * raise;
    elbowL.rotation.x = 1.0 * raise;
    elbowR.rotation.x = 1.0 * raise;
    head.rotation.x = 0.06 * raise;
    return;
  }

  if (state === 'sit') {
    hips.position.y = 0.3;
    legL.rotation.z = 0.95;
    legR.rotation.z = -0.95;
    legL.rotation.x = -0.2;
    legR.rotation.x = -0.2;
    kneeL.rotation.x = 1.4;
    kneeR.rotation.x = 1.4;
    armL.rotation.x = -0.55;
    armR.rotation.x = -0.55;
    armL.rotation.z = 0.32;
    armR.rotation.z = -0.32;
    elbowL.rotation.x = 0.55;
    elbowR.rotation.x = 0.55;
    torso.rotation.x = 0.02;
    head.rotation.x = 0.03;
    return;
  }

  if (state === 'knock') {
    rig.mallet.visible = true;
    const swing = Math.sin(progress * Math.PI);
    armR.rotation.x = -0.55 - swing * 0.8;
    armR.rotation.z = -0.28;
    elbowR.rotation.x = 0.7 + swing * 0.5;
    armL.rotation.x = -0.95;
    armL.rotation.z = 0.4;
    elbowL.rotation.x = 0.85;
    torso.rotation.x = 0.08;
    head.rotation.x = 0.05;
    return;
  }

  if (state === 'lantern') {
    const t = Math.min(1, progress);
    const crouch = t < 0.3 ? (t / 0.3) * 0.35 : t < 0.7 ? 0.35 + ((t - 0.3) / 0.4) * 0.65 : Math.max(0, 1 - (t - 0.7) / 0.3);
    rig.lantern.visible = t < 0.72;
    hips.position.y = 0.58 - crouch * 0.22;
    legL.rotation.x = -0.18 * crouch;
    legR.rotation.x = -0.18 * crouch;
    kneeL.rotation.x = 0.55 * crouch;
    kneeR.rotation.x = 0.55 * crouch;
    torso.rotation.x = 0.08 + crouch * 0.22;
    armL.rotation.x = -0.7 - crouch * 0.55;
    armR.rotation.x = -0.7 - crouch * 0.55;
    armL.rotation.z = 0.25 - crouch * 0.08;
    armR.rotation.z = -0.25 + crouch * 0.08;
    elbowL.rotation.x = 0.9 - crouch * 0.42;
    elbowR.rotation.x = 0.9 - crouch * 0.42;
    head.rotation.x = 0.08 + crouch * 0.1;
    return;
  }

  if (state === 'strike') {
    const push = Math.sin(Math.min(1, progress) * Math.PI);
    armL.rotation.x = -0.72 - push * 0.7;
    armR.rotation.x = -0.72 - push * 0.7;
    armL.rotation.z = 0.24;
    armR.rotation.z = -0.24;
    elbowL.rotation.x = 0.45 + push * 0.12;
    elbowR.rotation.x = 0.45 + push * 0.12;
    torso.rotation.x = 0.1 + push * 0.16;
    hips.position.y = 0.58 - push * 0.03;
    legL.rotation.x = 0.12;
    legR.rotation.x = -0.12;
    return;
  }

  if (state === 'incense') {
    const t = Math.min(1, progress);
    const reach = t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
    const insert = t > 0.55 && t < 0.78 ? 1 : 0;
    rig.incense.visible = t < 0.62;
    armL.rotation.x = -0.65 - reach * 0.6;
    armR.rotation.x = -0.65 - reach * 0.6;
    armL.rotation.z = 0.34 - reach * 0.12;
    armR.rotation.z = -0.34 + reach * 0.12;
    elbowL.rotation.x = 1.1 - reach * 0.55;
    elbowR.rotation.x = 1.1 - reach * 0.55;
    torso.rotation.x = reach * 0.16 + insert * 0.12;
    hips.position.y = 0.58 - insert * 0.03;
    head.rotation.x = reach * 0.12;
    return;
  }

  if (state === 'wave') {
    armR.rotation.z = -1.6 + Math.sin(t * 4) * 0.3;
    armR.rotation.x = -0.2;
    elbowR.rotation.x = 0.2;
    return;
  }
}

/* ============================================================
   简化版人物：给山里的过客用
   ============================================================ */

export type SimpleRig = {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
};

export function createSimpleMonk(colors: { robe: string; sash: string; skin: string }): SimpleRig {
  const root = new THREE.Group();
  const robe = new THREE.MeshStandardMaterial({ color: colors.robe, roughness: 0.95 });
  const sash = new THREE.MeshStandardMaterial({ color: colors.sash, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.82 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#2c2c27', roughness: 0.95 });

  const torso = new THREE.Group();
  torso.position.y = 0.62;
  root.add(torso);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.42, 9), robe);
  body.position.y = 0.2;
  body.castShadow = true;
  torso.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.32, 0.46, 9), robe);
  skirt.position.y = -0.14;
  skirt.castShadow = true;
  torso.add(skirt);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.22, 0.06, 9), sash);
  belt.position.y = 0.02;
  torso.add(belt);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.02), sash);
  strap.position.set(0.02, 0.23, -0.13);
  strap.rotation.z = 0.42;
  torso.add(strap);

  const head = new THREE.Group();
  head.position.y = 0.49;
  torso.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6), skin);
  neck.position.y = -0.02;
  head.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skin);
  skull.position.y = 0.11;
  skull.castShadow = true;
  head.add(skull);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), skin);
    ear.scale.set(0.5, 1.4, 0.8);
    ear.position.set(s * 0.15, 0.11, 0);
    head.add(ear);
  }

  const makeArm = (s: number) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.21, 0.4, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 6), robe);
    mesh.position.y = -0.14;
    mesh.castShadow = true;
    arm.add(mesh);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.26, 7), robe);
    sleeve.position.y = -0.15;
    arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 5), skin);
    hand.position.y = -0.32;
    arm.add(hand);
    torso.add(arm);
    return arm;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  const makeLeg = (s: number) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.1, 0.62, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 3, 6), robe);
    mesh.position.y = -0.19;
    mesh.castShadow = true;
    leg.add(mesh);
    const shoeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), shoe);
    shoeMesh.scale.set(1, 0.6, 1.5);
    shoeMesh.position.set(0, -0.4, 0.04);
    leg.add(shoeMesh);
    root.add(leg);
    return leg;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({ map: (_blob ??= blobTexture()), transparent: true, depthWrite: false, opacity: 0.45 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);

  return { root, torso, head, armL, armR, legL, legR };
}

export function poseSimple(rig: SimpleRig, state: 'walk' | 'idle' | 'bow' | 'sit', t: number, phase = 0, progress = 0) {
  rig.torso.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.armL.rotation.set(0, 0, 0.14);
  rig.armR.rotation.set(0, 0, -0.14);
  rig.legL.rotation.set(0, 0, 0.02);
  rig.legR.rotation.set(0, 0, -0.02);
  rig.torso.position.y = 0.62;
  if (state === 'walk') {
    const s = Math.sin(phase);
    rig.legL.rotation.x = s * 0.55;
    rig.legR.rotation.x = -s * 0.55;
    rig.armL.rotation.x = -s * 0.4;
    rig.armR.rotation.x = s * 0.4;
    rig.torso.rotation.x = 0.04;
    rig.torso.position.y = 0.62 + Math.abs(Math.cos(phase)) * 0.02;
  } else if (state === 'bow') {
    const b = Math.sin(Math.min(1, progress) * Math.PI);
    rig.torso.rotation.x = b * 0.95;
    rig.armL.rotation.x = -b * 0.8;
    rig.armR.rotation.x = -b * 0.8;
    rig.head.rotation.x = b * 0.15;
  } else if (state === 'sit') {
    rig.torso.position.y = 0.46;
    rig.legL.rotation.x = -1.2;
    rig.legR.rotation.x = -1.2;
    rig.armL.rotation.x = -0.4;
    rig.armR.rotation.x = -0.4;
  } else {
    rig.head.rotation.y = Math.sin(t * 0.25) * 0.12;
    rig.torso.rotation.y = Math.sin(t * 0.2) * 0.03;
  }
}
