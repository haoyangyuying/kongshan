import * as THREE from 'three';
import {
  createBridge, createGate, createHall, createIncenseBurner, createSteps,
  createLibrary, createLowTable, createMuyu, createPagoda,
  createSignTube, createStele, createStoneLantern, createTower, createMallet,
} from './arch';
import type { TimeName } from '../core/audio';
import { createAltarScene } from './interior';
import { mergeStatic } from './optimize';
import { M, box, cyl, mesh } from './materials';
import {
  createBamboo, createCloudSea, createDust, createFallenLeaves, createFallingLeaves, createFireflies, createGinkgo,
  createGrass, createGround, createLotusFlower, createMaple, createMist, createMoon, createMountains,
  createPine, createPond, createRocks, createShrubs, createSky, createSkyClouds, createSmoke, createStonePath, createSun, terrainHeight,
  type SkyUniforms,
} from './nature';
import { createMonk, createSimpleMonk, poseMonk, poseSimple, type SimpleRig } from './monk';
import { LANTERN_COLORS, RESIDENT_SEAT, SEATS, ZEN_LINES } from '../data/content';
import { pavingTexture } from './textures';

export type Interactive = {
  id: string;
  name: string;
  hint: string;
  pos: THREE.Vector3;
  radius: number;
};

type Preset = {
  label: string;
  skyTop: string;
  horizon: string;
  sunColor: string;
  sunDir: [number, number, number];
  sunInt: number;
  hemiSky: string;
  hemiGround: string;
  hemiInt: number;
  fog: string;
  fogDensity: number;
  exposure: number;
  stars: number;
  cloud: number;
  lantern: number;
  moon: number;
};

const PRESETS: Record<TimeName, Preset> = {
  dawn: {
    label: '清晨', skyTop: '#6f8b9c', horizon: '#e9dcc6', sunColor: '#ffd7a4',
    sunDir: [0.62, 0.32, -0.55], sunInt: 3.0, hemiSky: '#c3ced1', hemiGround: '#746c5b',
    hemiInt: 1.25, fog: '#b9c0bb', fogDensity: 0.0085, exposure: 1.16, stars: 0, cloud: 0.7,
    lantern: 0.35, moon: 0,
  },
  noon: {
    label: '日午', skyTop: '#5f8fb2', horizon: '#e6e3d2', sunColor: '#fff1d2',
    sunDir: [0.16, 0.9, -0.4], sunInt: 3.2, hemiSky: '#c3d4dd', hemiGround: '#77705e',
    hemiInt: 1.32, fog: '#c9d0c6', fogDensity: 0.006, exposure: 1.05, stars: 0, cloud: 0.5,
    lantern: 0.1, moon: 0,
  },
  dusk: {
    label: '黄昏', skyTop: '#2e4a64', horizon: '#e9b184', sunColor: '#ffbe76',
    sunDir: [-0.55, 0.22, -0.55], sunInt: 3.6, hemiSky: '#a7b2b4', hemiGround: '#6d6453',
    hemiInt: 1.15, fog: '#a9afa8', fogDensity: 0.0078, exposure: 1.17, stars: 0.08, cloud: 0.8,
    lantern: 0.85, moon: 0,
  },
  night: {
    label: '夜', skyTop: '#0a1521', horizon: '#283540', sunColor: '#cfdcf0',
    sunDir: [0.42, 0.55, -0.72], sunInt: 1.1, hemiSky: '#38495a', hemiGround: '#20241f',
    hemiInt: 0.55, fog: '#172229', fogDensity: 0.010, exposure: 1.24, stars: 1, cloud: 0.25,
    lantern: 1.45, moon: 1,
  },
};

type Current = {
  skyTop: THREE.Color; horizon: THREE.Color; sunColor: THREE.Color; sunDir: THREE.Vector3;
  sunInt: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiInt: number;
  fog: THREE.Color; fogDensity: number; exposure: number; stars: number; cloud: number;
  lantern: number; moon: number;
};

type Npc = {
  rig: SimpleRig;
  points: THREE.Vector3[];
  idx: number;
  speed: number;
  state: 'walk' | 'idle' | 'bow' | 'sit';
  timer: number;
  phase: number;
  yaw: number;
};

type FloatingLantern = {
  group: THREE.Group;
  wish: string;
  colorId: string;
  angle: number;
  radius: number;
  speed: number;
  bob: number;
  cx: number;
  cz: number;
  spawn: THREE.Vector3;
  spawnT: number;
};

export class World {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  time: TimeName = 'dusk';
  interactives: Interactive[] = [];
  onReadWish: (text: string, from: string) => void = () => {};
  onZen: (text: string, from: string) => void = () => {};

  private sky!: { mesh: THREE.Mesh; uniforms: SkyUniforms };
  private moon!: THREE.Sprite;
  private sunSprite!: THREE.Sprite;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private fill!: THREE.DirectionalLight;
  private current!: Current;
  private target!: Current;
  private fog!: THREE.FogExp2;
  private exposure = 1;
  private interiorLights: THREE.PointLight[] = [];
  private baseLights: number[] = [];
  private pond!: ReturnType<typeof createPond>;
  private bridge!: ReturnType<typeof createBridge>;
  private smoke!: ReturnType<typeof createSmoke>;
  private dust!: THREE.Points;
  private fireflies!: ReturnType<typeof createFireflies>;
  private leaves!: ReturnType<typeof createFallingLeaves>;
  private mist!: ReturnType<typeof createMist>;
  private cloudSea!: THREE.Group;
  private skyClouds!: ReturnType<typeof createSkyClouds>;
  private ginkgo!: ReturnType<typeof createGinkgo>;
  private npcs: Npc[] = [];
  private remoteVisitors = new Map<number, SimpleRig>();
  private lanterns: FloatingLantern[] = [];
  private lanternRoot = new THREE.Group();
  private ribbonRoot = new THREE.Group();
  private bell: THREE.Group | null = null;
  private bellSwing = 0;
  private bellSwingV = 0;
  private drum: THREE.Mesh | null = null;
  private drumPulse = 0;
  private muyu!: THREE.Group;
  private burner: THREE.Group | null = null;
  private incensePlanted: THREE.Group[] = [];
  private ripples: { mesh: THREE.Mesh; age: number }[] = [];
  private cat!: THREE.Group;
  private catTail!: THREE.Object3D;
  private petals: THREE.Object3D[] = [];
  private clock = 0;
  private placedLanternCount = 0;
  private sprites: THREE.Sprite[] = [];
  private mistMeshes: THREE.Mesh[] = [];
  private zenHits: THREE.Mesh[] = [];

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.current = this.toCurrent(PRESETS.dusk);
    this.target = this.toCurrent(PRESETS.dusk);
    this.build();
  }

  private toCurrent(p: Preset): Current {
    return {
      skyTop: new THREE.Color(p.skyTop), horizon: new THREE.Color(p.horizon),
      sunColor: new THREE.Color(p.sunColor), sunDir: new THREE.Vector3(...p.sunDir).normalize(),
      sunInt: p.sunInt, hemiSky: new THREE.Color(p.hemiSky), hemiGround: new THREE.Color(p.hemiGround),
      hemiInt: p.hemiInt, fog: new THREE.Color(p.fog), fogDensity: p.fogDensity,
      exposure: p.exposure, stars: p.stars, cloud: p.cloud, lantern: p.lantern, moon: p.moon,
    };
  }

  private build() {
    const scene = this.scene;
    scene.fog = new THREE.FogExp2(this.current.fog.getHex(), this.current.fogDensity);
    this.fog = scene.fog as THREE.FogExp2;

    // 天空、月、山、云
    this.sky = createSky();
    scene.add(this.sky.mesh);
    this.moon = createMoon();
    this.moon.material.opacity = 0;
    scene.add(this.moon);
    this.sunSprite = createSun();
    scene.add(this.sunSprite);
    const mountains = createMountains();
    mountains.name = 'mountains';
    mergeStatic(mountains);
    scene.add(mountains);
    this.cloudSea = createCloudSea();
    scene.add(this.cloudSea);
    this.skyClouds = createSkyClouds();
    scene.add(this.skyClouds.group);

    // 光照
    this.hemi = new THREE.HemisphereLight(this.current.hemiSky, this.current.hemiGround, this.current.hemiInt);
    scene.add(this.hemi);
    scene.add(new THREE.AmbientLight('#9fb2c2', 0.2));
    this.sun = new THREE.DirectionalLight(this.current.sunColor, this.current.sunInt);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -56;
    this.sun.shadow.camera.right = 56;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -56;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 230;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, -4);
    scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#a9c0d0', 0.9);
    this.fill.position.set(20, 30, 40);
    scene.add(this.fill);

    // 地形
    scene.add(createGround());

    // 前庭铺地
    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 15),
      new THREE.MeshStandardMaterial({ color: '#b9b5a4', roughness: 0.98, map: pavingTexture() }),
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(0, 0.025, 0.5);
    pave.receiveShadow = true;
    (pave.material as THREE.MeshStandardMaterial).map!.repeat.set(7, 4);
    scene.add(pave);
    scene.add(box(28.6, 0.16, 0.3, M.stoneDark, 0, 0.06, 8.2));
    scene.add(box(28.6, 0.16, 0.3, M.stoneDark, 0, 0.06, -7.2));
    scene.add(box(0.3, 0.16, 15.4, M.stoneDark, -14.1, 0.06, 0.5));
    scene.add(box(0.3, 0.16, 15.4, M.stoneDark, 14.1, 0.06, 0.5));

    // 路径
    const paths: [number, number][][] = [
      [[0, 58], [0, 41]],
      [[0, 34], [0, 22.5]],
      [[0, 8], [0, -5.5]],
      [[0, -24.6], [0, -27.6]],
      [[-8, 10], [-14, 11]],
      [[8, 10], [14, 11]],
      [[10, -4], [14.5, -8], [14.5, -26], [8, -28.2]],
      [[-10, -4], [-14.5, -8], [-14.5, -26], [-8, -28.2]],
      [[14.5, -12], [21, -18], [23, -21]],
      [[-9, 20], [-11.2, 20.4]],
    ];
    for (const p of paths) {
      const g = createStonePath(p, p[0][1] > 30 ? 3.8 : 3.0);
      mergeStatic(g);
      scene.add(g);
    }

    // 山门
    const gate = createGate();
    gate.position.set(0, 0, 38);
    mergeStatic(gate);
    scene.add(gate);

    // 大殿
    const hall = createHall();
    hall.group.position.set(0, 0, -16);
    mergeStatic(hall.group);
    scene.add(hall.group);

    // 殿内
    const altar = createAltarScene();
    altar.group.position.set(0, 0.86, -16);
    this.interiorLights = altar.lights;
    this.baseLights = altar.lights.map((l) => l.intensity);
    mergeStatic(altar.group);
    scene.add(altar.group);

    // 藏经阁、塔、钟鼓楼
    const library = createLibrary();
    library.position.set(0, 0, -36);
    mergeStatic(library);
    scene.add(library);

    const pagoda = createPagoda();
    pagoda.position.set(26, 0, -26);
    mergeStatic(pagoda);
    scene.add(pagoda);

    const bellTower = createTower('bell');
    bellTower.group.position.set(-17, 0, 6);
    mergeStatic(bellTower.group);
    scene.add(bellTower.group);
    this.bell = bellTower.bell ?? null;

    const drumTower = createTower('drum');
    drumTower.group.position.set(17, 0, 6);
    mergeStatic(drumTower.group);
    scene.add(drumTower.group);
    this.drum = drumTower.drum ?? null;
    for (const sx of [-17, 17]) {
      const towerLight = new THREE.PointLight('#ffc47a', 9, 9, 2);
      towerLight.position.set(sx, 2.3, 6);
      scene.add(towerLight);
    }
    for (const sx of [-17, 17]) {
      const steps = createSteps(4.2, 3, 0.18, 0.4);
      steps.position.set(sx, 0, 11.9);
      mergeStatic(steps);
      scene.add(steps);
    }

    // 放生池与桥
    this.pond = createPond(12, 6.6);
    mergeStatic(this.pond.statics);
    this.pond.group.position.set(0, 0, 15);
    scene.add(this.pond.group);
    this.bridge = createBridge(13, 3.4, 1.2);
    this.bridge.group.position.set(0, 0.02, 15);
    mergeStatic(this.bridge.group);
    scene.add(this.bridge.group);

    // 石灯
    for (const [x, z, s] of [[-5.2, 34, 1], [5.2, 34, 1], [-5.2, 12, 0.95], [5.2, 12, 0.95], [-9.2, -2, 0.9], [9.2, -2, 0.9]]) {
      const l = createStoneLantern(s as number);
      l.position.set(x as number, 0, z as number);
      mergeStatic(l);
      scene.add(l);
    }

    // 石碑
    let si = 0;
    for (const [x, z] of [[9.4, 7.2], [-9.4, 7.2]] as const) {
      const line = ZEN_LINES[si++ % ZEN_LINES.length];
      const stele = createStele(line.text);
      stele.group.position.set(x, 0, z);
      stele.group.rotation.y = x > 0 ? -0.35 : 0.35;
      stele.plaque.userData.zen = line;
      mergeStatic(stele.group, { keepNames: [] });
      scene.add(stele.group);
      // 合并后保留一个不可见的交互面，供拾取
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.6),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.set(x, 1.5, z);
      hit.rotation.y = stele.group.rotation.y;
      hit.userData.zen = line;
      scene.add(hit);
      this.zenHits = this.zenHits ?? [];
      this.zenHits.push(hit);
    }

    // 香炉
    const burner = createIncenseBurner();
    burner.scale.setScalar(0.82);
    burner.position.set(0, 0, 4);
    mergeStatic(burner);
    this.burner = burner;
    scene.add(burner);
    this.smoke = createSmoke(new THREE.Vector3(0, 1.75, 4), 90);
    this.smoke.points.visible = false;
    scene.add(this.smoke.points);

    // 木鱼桌（殿内右侧）
    const muyuTable = createLowTable(2.0, 0.9, 0.62);
    muyuTable.position.set(6.6, 0.86, -13.4);
    mergeStatic(muyuTable);
    scene.add(muyuTable);
    const muyu = createMuyu();
    muyu.position.set(6.6, 1.56, -13.4);
    this.muyu = muyu;
    scene.add(muyu);
    const mallet = createMallet();
    mallet.position.set(7.2, 1.58, -13.1);
    mallet.rotation.z = 0.6;
    scene.add(mallet);

    // 签桌 / 经桌
    this.buildSignTable();
    this.buildSutraTable();

    // 银杏、竹、松、枫
    this.ginkgo = createGinkgo(1);
    this.ginkgo.group.position.set(-13, 0, 20);
    scene.add(this.ginkgo.group);
    scene.add(this.ribbonRoot);
    this.ribbonRoot.position.set(-13, 0, 20);

    const bambooA = createBamboo(new THREE.Vector2(-25, 6), 8, 24, 140);
    scene.add(bambooA);
    const bambooB = createBamboo(new THREE.Vector2(32, -2), 6, 12, 60);
    scene.add(bambooB);

    const pines: [number, number, number][] = [
      [-22, 26, 1.1], [21, 25, 0.95], [-24, -12, 1.05], [22, 12, 1.0], [12.5, -31, 0.9],
      [-19, -33, 1.0], [-30, 34, 1.2], [31, 30, 1.2], [-31, -2, 1.1], [33, -4, 1.0],
    ];
    for (const [x, z, s] of pines) {
      const p = createPine(s);
      mergeStatic(p);
      p.position.set(x, terrainHeight(x, z), z);
      scene.add(p);
    }
    for (let i = 0; i < 16; i++) {
      const x = -34 + i * 4.4 + (Math.random() - 0.5) * 2;
      const z = -46 - Math.random() * 9;
      const p = createPine(0.9 + Math.random() * 0.5);
      mergeStatic(p);
      p.position.set(x, terrainHeight(x, z), z);
      scene.add(p);
    }
    for (const [x, z, s] of [[15, 28, 0.72], [-20, -3, 0.68], [24, 20, 0.75]] as const) {
      const m = createMaple(s);
      mergeStatic(m);
      m.position.set(x, terrainHeight(x, z), z);
      scene.add(m);
    }

    scene.add(createShrubs());
    scene.add(createFallenLeaves(new THREE.Vector3(-13, 0, 20), 260));
    scene.add(createGrass());
    scene.add(createRocks());

    // 猫
    this.cat = createCat();
    this.cat.position.set(7.4, 0, 19.2);
    this.cat.rotation.y = -1.2;
    scene.add(this.cat);
    this.catTail = this.cat.children.find((c) => c.name === 'tail') ?? this.cat;

    // 粒子
    this.dust = createDust(240);
    scene.add(this.dust);
    this.fireflies = createFireflies(46);
    scene.add(this.fireflies.points);
    this.leaves = createFallingLeaves(new THREE.Vector3(-13, 0, 20), 70);
    scene.add(this.leaves.mesh);
    this.mist = createMist(18);
    scene.add(this.mist.group);
    this.mist.group.children.forEach((c) => { if ((c as THREE.Mesh).isMesh) this.mistMeshes.push(c as THREE.Mesh); });
    for (const c of this.cloudSea.children) if ((c as THREE.Mesh).isMesh) this.mistMeshes.push(c as THREE.Mesh);

    // 漂浮莲灯根
    scene.add(this.lanternRoot);

    // 交互点
    this.interactives = [
      { id: 'incense', name: '上香', hint: '点一炷香，留一句话', pos: new THREE.Vector3(0, 0, 4), radius: 3.6 },
      { id: 'bow', name: '礼佛', hint: '在佛前拜三拜', pos: new THREE.Vector3(0, 0.86, -11.6), radius: 3.0 },
      { id: 'chant', name: '诵经', hint: '选一部经，坐下念', pos: new THREE.Vector3(0, 0.86, -13.8), radius: 2.6 },
      { id: 'muyu', name: '敲木鱼', hint: '敲一声，功德 +1', pos: new THREE.Vector3(6.6, 0.86, -12.6), radius: 2.8 },
      { id: 'bell', name: '撞钟', hint: '走进钟楼，听一声很长的钟', pos: new THREE.Vector3(-17, 0, 7.6), radius: 2.6 },
      { id: 'drum', name: '击鼓', hint: '走进鼓楼，暮鼓三声', pos: new THREE.Vector3(17, 0, 7.6), radius: 2.6 },
      { id: 'sign', name: '求签', hint: '摇一支签，读一段话', pos: new THREE.Vector3(6.2, 0, -26.8), radius: 3.2 },
      { id: 'sutra', name: '抄经', hint: '在经桌上抄一卷心经', pos: new THREE.Vector3(-6.2, 0, -26.8), radius: 3.2 },
      { id: 'lantern', name: '放灯', hint: '放一盏灯在池上', pos: new THREE.Vector3(0, 0, 23.4), radius: 3.4 },
      { id: 'ribbon', name: '系红绸', hint: '在银杏上系一条红绸', pos: new THREE.Vector3(-11.2, 0, 20.4), radius: 3.0 },
      { id: 'stele', name: '读碑', hint: '石上有一句旧话', pos: new THREE.Vector3(9.4, 0, 7.2), radius: 2.6 },
      { id: 'pagoda', name: '绕塔', hint: '沿七层塔走一匝', pos: new THREE.Vector3(26, 0, -19.2), radius: 3.2 },
    ];

    this.addColliders();

    // 常住与过客
    this.buildNpcs();

    // 初始时辰
    this.applyTime(0, true);
    this.setTime('dusk', true);
  }

  private buildSignTable() {
    const g = new THREE.Group();
    const table = createLowTable(2.4, 0.9, 0.72);
    table.position.set(6.2, 0, -28.6);
    g.add(table);
    const tube = createSignTube();
    tube.position.set(5.9, 0.78, -28.6);
    g.add(tube);
    const board = box(0.9, 1.5, 0.12, M.woodDark, 7.5, 0.75, -28.9);
    g.add(board);
    const plaque = mesh(
      new THREE.PlaneGeometry(0.66, 0.66),
      new THREE.MeshStandardMaterial({ map: this.textTexture('签'), roughness: 0.8 }),
      7.5, 1.16, -28.83,
    );
    g.add(plaque);
    mergeStatic(g);
    this.scene.add(g);
  }

  private buildSutraTable() {
    const g = new THREE.Group();
    const table = createLowTable(2.6, 1.1, 0.7);
    table.position.set(-6.2, 0, -28.6);
    g.add(table);
    // 摊开的经卷
    const paper = new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.92 });
    for (const s of [-1, 1]) {
      const p = box(1.0, 0.015, 0.72, paper, -6.2 + s * 0.51, 0.76, -28.55);
      p.rotation.z = s * 0.05;
      g.add(p);
    }
    g.add(box(0.06, 0.06, 0.8, M.woodDark, -6.2, 0.76, -28.55));
    g.add(cyl(0.06, 0.05, 0.28, 8, M.woodDark, -5.2, 0.9, -28.2));
    g.add(cyl(0.03, 0.045, 0.14, 8, M.black, -5.2, 1.07, -28.2));
    const board = box(0.9, 1.5, 0.12, M.woodDark, -7.5, 0.75, -28.9);
    g.add(board);
    const plaque = mesh(
      new THREE.PlaneGeometry(0.66, 0.66),
      new THREE.MeshStandardMaterial({ map: this.textTexture('经'), roughness: 0.8 }),
      -7.5, 1.16, -28.83,
    );
    g.add(plaque);
    mergeStatic(g);
    this.scene.add(g);
  }

  private textTexture(ch: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2a332c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#b08a4f';
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, 114, 114);
    ctx.fillStyle = '#e6cf9c';
    ctx.font = '72px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildNpcs() {
    const robes = ['#5d5f54', '#6a6355', '#555f57', '#6f6757', '#5a5c4f'];
    const loops: [number, number][][] = [
      [[3, 32], [3, 24], [0.8, 23], [0, 20], [0, 10], [0, 8.1], [2.5, 8.1], [3, 2]],
      [[0, 24], [0, 22], [-0.8, 20], [-0.8, 10], [0, 8.1], [-2.5, 8.1], [-3, 23]],
      [[-6, 34], [-6, 25], [-10, 24], [-10, 22], [-6, 22], [-3, 24]],
      [[16, -12], [20, -16], [18, -22], [14, -18]],
    ];
    for (let i = 0; i < loops.length; i++) {
      const rig = createSimpleMonk({
        robe: robes[i], sash: i % 2 ? '#7d3a2b' : '#6d5a3a', skin: '#d2ae88',
      });
      const points = loops[i].map(([x, z]) => new THREE.Vector3(x, 0, z));
      const npc: Npc = {
        rig, points, idx: 1, speed: 0.75 + Math.random() * 0.35, state: 'walk',
        timer: 0, phase: Math.random() * 10, yaw: 0,
      };
      rig.root.position.set(points[0].x, 0, points[0].z);
      this.scene.add(rig.root);
      this.npcs.push(npc);
    }
    // 殿内静坐者
    const sitter = createSimpleMonk({ robe: '#616356', sash: '#8a3e2d', skin: '#d5b28c' });
    sitter.root.position.set(SEATS[RESIDENT_SEAT].x, 0.86, SEATS[RESIDENT_SEAT].z);
    sitter.root.rotation.y = Math.PI;
    poseSimple(sitter, 'sit', 0, 0, 0);
    this.scene.add(sitter.root);
    // 钟楼前的人
    const bellNpc = createSimpleMonk({ robe: '#6b6152', sash: '#7b3a2b', skin: '#d6b48e' });
    bellNpc.root.position.set(-16.1, 0, 13.2);
    bellNpc.root.rotation.y = Math.PI * 0.9;
    bellNpc.root.scale.setScalar(0.98);
    const hatMat = new THREE.MeshStandardMaterial({ color: '#b39a63', roughness: 0.95, side: THREE.DoubleSide });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.18, 12), hatMat);
    hat.position.y = 0.84;
    hat.castShadow = true;
    bellNpc.root.add(hat);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 16), hatMat);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 0.76;
    bellNpc.root.add(brim);
    poseSimple(bellNpc, 'idle', 0, 0, 0);
    this.scene.add(bellNpc.root);
  }

  get peopleCount() {
    return this.npcs.length + 2; // 四位过客、殿内一位、钟楼前一位
  }

  /* ================= 时间 ================= */

  setTime(name: TimeName, instant = false) {
    this.time = name;
    const p = PRESETS[name];
    this.target = this.toCurrent(p);
    if (instant) {
      this.current = this.toCurrent(p);
      this.applyTime(0, true);
    }
  }

  private applyTime(dt: number, instant = false) {
    const k = instant ? 1 : Math.min(1, dt * 1.6);
    const c = this.current;
    const t = this.target;
    c.skyTop.lerp(t.skyTop, k);
    c.horizon.lerp(t.horizon, k);
    c.sunColor.lerp(t.sunColor, k);
    c.sunDir.lerp(t.sunDir, k).normalize();
    c.hemiSky.lerp(t.hemiSky, k);
    c.hemiGround.lerp(t.hemiGround, k);
    c.fog.lerp(t.fog, k);
    c.sunInt += (t.sunInt - c.sunInt) * k;
    c.hemiInt += (t.hemiInt - c.hemiInt) * k;
    c.fogDensity += (t.fogDensity - c.fogDensity) * k;
    c.exposure += (t.exposure - c.exposure) * k;
    c.stars += (t.stars - c.stars) * k;
    c.cloud += (t.cloud - c.cloud) * k;
    c.lantern += (t.lantern - c.lantern) * k;
    c.moon += (t.moon - c.moon) * k;

    this.sky.uniforms.uTop.value.copy(c.skyTop);
    this.sky.uniforms.uHorizon.value.copy(c.horizon);
    this.sky.uniforms.uSunColor.value.copy(c.sunColor);
    this.sky.uniforms.uSunDir.value.copy(c.sunDir);
    this.sky.uniforms.uStars.value = c.stars;
    this.sky.uniforms.uCloud.value = c.cloud;
    this.fog.color.copy(c.fog);
    this.fog.density = c.fogDensity;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiInt;
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunInt;
    this.sun.position.copy(c.sunDir).multiplyScalar(90);
    this.sun.position.y = Math.max(12, this.sun.position.y);
    this.renderer.toneMappingExposure = c.exposure;
    this.moon.material.opacity = c.moon;
    this.moon.position.copy(c.sunDir).multiplyScalar(300);
    this.sunSprite.material.opacity = Math.max(0, 1 - c.moon) * 0.9;
    this.sunSprite.position.copy(c.sunDir).multiplyScalar(300);
    this.sunSprite.scale.setScalar(70 + (1 - c.moon) * 18);
    this.moon.scale.setScalar(46 + c.moon * 10);

    // 灯火
    for (let i = 0; i < this.interiorLights.length; i++) {
      this.interiorLights[i].intensity = this.baseLights[i] * (0.52 + c.lantern * 0.55);
    }
    M.lanternPaper.emissiveIntensity = 0.35 + c.lantern * 0.7;
    M.glassWarm.emissiveIntensity = 0.4 + c.lantern * 0.6;

    // 水与粒子
    this.pond.uniforms.uSky.value.copy(c.horizon).multiplyScalar(0.62);
    this.pond.uniforms.uSunColor.value.copy(c.sunColor);
    this.pond.uniforms.uSunDir.value.copy(c.sunDir);
    this.pond.uniforms.uFogColor.value.copy(c.fog);
    this.pond.uniforms.uFogDensity.value = c.fogDensity;
    this.pond.uniforms.uDeep.value.set(c.stars > 0.5 ? '#15231f' : '#223b35');
    this.fireflies.material.opacity = Math.max(0, c.stars) * 0.9;
    this.leaves.mesh.visible = c.stars < 0.5;
    (this.dust.material as THREE.PointsMaterial).opacity = 0.08 + (1 - c.stars) * 0.32;
    if (this.mistMeshes.length) {
      for (const m of this.mistMeshes) {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = mat.userData?.base ?? mat.opacity;
      }
    }
  }

  /* ================= 更新 ================= */

  update(dt: number, camera: THREE.Camera) {
    this.clock += dt;
    const t = this.clock;
    this.applyTime(dt, false);
    this.sky.uniforms.uTime.value = t;
    this.sky.mesh.position.copy(camera.position);
    this.pond.update(dt, t);
    this.smoke.update(dt, t);
    this.fireflies.update(dt, t);
    this.leaves.update(dt, t);
    this.mist.update(dt, t);
    this.skyClouds.update(dt, t, camera);
    this.dust.rotation.y = t * 0.006;

    // 雾片朝向相机
    for (const m of this.mistMeshes) {
      if (m.parent === this.mist.group) {
        m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
      }
    }
    // 云海缓慢漂移
    for (const c of this.cloudSea.children) {
      const u = c.userData as { drift: number; base: THREE.Vector3 };
      c.position.x = u.base.x + Math.sin(t * 0.012 * 60 * u.drift) * 6;
      c.position.z = u.base.z + Math.cos(t * 0.009 * 60 * u.drift) * 4;
    }

    // 钟摆
    if (this.bell) {
      this.bellSwingV += -this.bellSwing * 9 * dt;
      this.bellSwingV *= Math.exp(-dt * 1.6);
      this.bellSwing += this.bellSwingV * dt;
      this.bell.rotation.z = this.bellSwing;
    }
    if (this.drum) {
      this.drumPulse *= Math.exp(-dt * 6);
      this.drum.scale.set(1 + this.drumPulse * 0.04, 1 - this.drumPulse * 0.05, 1 + this.drumPulse * 0.04);
    }
    if (this.muyu) {
      this.muyu.scale.y = 1 + Math.sin(t * 1.2) * 0.01;
    }

    // 红绸
    for (const r of this.ribbonRoot.children) {
      const ph = (r.userData.phase as number) ?? 0;
      r.rotation.z = Math.sin(t * 1.1 + ph) * 0.08;
      r.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.05;
    }
    // 树上的旧绸
    for (const r of this.ginkgo.ribbons) {
      const ph = (r.userData.phase as number) ?? 0;
      r.rotation.z = Math.sin(t * 1.1 + ph) * 0.08;
    }

    // 苏式：猫尾
    if (this.catTail) this.catTail.rotation.x = Math.sin(t * 0.9) * 0.25;

    // 莲灯漂移
    for (const l of this.lanterns) {
      l.angle += dt * l.speed;
      l.spawnT = Math.min(1, l.spawnT + dt / 3.4);
      const ease = 1 - Math.pow(1 - l.spawnT, 3);
      const ox = l.cx + Math.cos(l.angle) * l.radius;
      const oz = l.cz + Math.sin(l.angle) * l.radius * 0.62;
      const x = l.spawn.x + (ox - l.spawn.x) * ease;
      const z = l.spawn.z + (oz - l.spawn.z) * ease;
      l.group.position.set(x, 0.2 + Math.sin(t * 0.9 + l.bob) * 0.018, z);
      l.group.rotation.y = -l.angle;
      l.group.rotation.z = Math.sin(t * 0.7 + l.bob) * 0.03;
    }
    // 水面涟漪
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const k = 1 + r.age * 2.6;
      r.mesh.scale.set(k, k, k);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - r.age / 1.7));
      if (r.age > 1.7) {
        r.mesh.removeFromParent();
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.ripples.splice(i, 1);
      }
    }

    // NPC
    for (const npc of this.npcs) {
      this.updateNpc(npc, dt, t);
    }

    // 莲灯灯光（只取最近的一盏）
    const active = this.lanterns[this.lanterns.length - 1];
    if (active) active.group.rotation.y += 0;
  }

  private updateNpc(npc: Npc, dt: number, t: number) {
    npc.timer -= dt;
    const pos = npc.rig.root.position;
    if (npc.state === 'walk') {
      const target = npc.points[npc.idx];
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        npc.state = Math.random() > 0.4 ? 'idle' : 'bow';
        npc.timer = npc.state === 'bow' ? 2.4 : 2 + Math.random() * 4;
        npc.idx = (npc.idx + 1) % npc.points.length;
      } else {
        const step = npc.speed * dt;
        const nx = pos.x + (dx / d) * step;
        const nz = pos.z + (dz / d) * step;
        if (this.blocked(nx, nz)) {
          npc.state = 'idle';
          npc.timer = 1.2 + Math.random() * 1.8;
          npc.idx = (npc.idx + 1) % npc.points.length;
          return;
        }
        pos.x = nx;
        pos.z = nz;
        npc.yaw = Math.atan2(dx, dz);
        npc.phase += dt * 5.4;
        npc.rig.root.rotation.y = npc.yaw;
        pos.y = this.groundHeight(pos.x, pos.z);
        poseSimple(npc.rig, 'walk', t, npc.phase, 0);
      }
      return;
    }
    if (npc.timer <= 0) {
      npc.state = 'walk';
      npc.idx = (npc.idx + 1) % npc.points.length;
      return;
    }
    if (npc.state === 'bow') {
      const p = 1 - Math.abs((npc.timer % 1.2) / 0.6 - 1);
      poseSimple(npc.rig, 'bow', t, 0, Math.min(1, Math.max(0, p)));
    } else {
      poseSimple(npc.rig, 'idle', t, 0, 0);
    }
  }

  /* ================= 地面与碰撞 ================= */

  groundHeight(x: number, z: number) {
    let y = terrainHeight(x, z);
    // 山门台基
    if (Math.abs(x) < 10.2 && z > 34.4 && z < 41.6) {
      const edge = Math.min(z - 34.4, 41.6 - z);
      y = Math.max(y, Math.min(0.52, edge * 1.6));
    }
    // 大殿台基 + 前阶
    if (Math.abs(x) < 13.4 && z > -24.4 && z < -5.8) {
      let h = 0;
      if (z <= -8.1) h = 0.86;
      else if (Math.abs(x) < 7.2) h = 0.86 * Math.min(1, (-5.8 - z) / 2.3);
      else h = z < -7.9 ? 0.86 : 0;
      y = Math.max(y, h);
    }
    // 钟鼓楼台阶与楼面
    for (const sx of [-17, 17]) {
      if (Math.abs(x - sx) < 4.6 && z > 1.4 && z < 10.6) y = Math.max(y, 0.56);
      if (Math.abs(x - sx) < 2.2 && z >= 10.6 && z < 12.0) {
        y = Math.max(y, 0.56 * Math.min(1, (12.0 - z) / 1.4));
      }
    }
    // 石桥
    if (Math.abs(x) < 1.2 && z > 8.4 && z < 21.6) {
      y = Math.max(y, this.bridge.heightAt(z - 15) + 0.02);
    }
    return y;
  }

  private rects: { x0: number; x1: number; z0: number; z1: number }[] = [];
  private circles: { x: number; z: number; r: number }[] = [];

  addColliders() {
    this.rects = [
      // 山门墙体（留中门与两侧门）
      { x0: -10.2, x1: -6.3, z0: 36.8, z1: 39.2 },
      { x0: -4.4, x1: -2.3, z0: 36.8, z1: 39.2 },
      { x0: 2.3, x1: 4.4, z0: 36.8, z1: 39.2 },
      { x0: 6.3, x1: 10.2, z0: 36.8, z1: 39.2 },
      // 大殿侧墙、后墙、格扇
      { x0: -10.6, x1: -9.3, z0: -23.2, z1: -10.2 },
      { x0: 9.3, x1: 10.6, z0: -23.2, z1: -10.2 },
      { x0: -10.5, x1: 10.5, z0: -23.4, z1: -22.4 },
      { x0: -9.4, x1: -5.4, z0: -13.9, z1: -12.9 },
      { x0: 5.4, x1: 9.4, z0: -13.9, z1: -12.9 },
      // 佛坛
      { x0: -5.8, x1: 5.8, z0: -21.9, z1: -17.6 },
      // 藏经阁（钟鼓楼改为柱子碰撞，允许进楼）
      { x0: -9.2, x1: 9.2, z0: -41.2, z1: -30.8 },
      // 竹丛：不能穿进去
      { x0: -30, x1: -20.5, z0: -6, z1: 18 },
      { x0: 28.5, x1: 34, z0: -8, z1: 4 },
      // 大殿台基边缘：只能从前阶上殿，不能从侧面爬
      { x0: -13.6, x1: -6.45, z0: -8.45, z1: -7.85 },
      { x0: 6.45, x1: 13.6, z0: -8.45, z1: -7.85 },
      { x0: -13.7, x1: -13.05, z0: -24.5, z1: -8.0 },
      { x0: 13.05, x1: 13.7, z0: -24.5, z1: -8.0 },
      { x0: -13.6, x1: 13.6, z0: -24.7, z1: -24.2 },
      // 前阶垂带
      { x0: -7.05, x1: -6.4, z0: -8.45, z1: -5.8 },
      { x0: 6.4, x1: 7.05, z0: -8.45, z1: -5.8 },
    ];
    this.circles = [
      // 树
      { x: -13, z: 20, r: 1.15 },
      { x: 26, z: -26, r: 4.7 },
      { x: 9.4, z: 7.2, r: 1.1 },
      { x: -9.4, z: 7.2, r: 1.1 },
      { x: -22, z: 26, r: 1.0 },
      { x: 21, z: 25, r: 1.0 },
      { x: 15, z: 28, r: 0.85 },
      { x: -20, z: -3, r: 0.85 },
      { x: -24, z: -12, r: 1.0 },
      { x: 22, z: 12, r: 1.0 },
      { x: 12.5, z: -31, r: 0.9 },
      { x: -19, z: -33, r: 1.0 },
      { x: 24, z: 20, r: 0.85 },
      // 石灯
      { x: -5.2, z: 34, r: 0.55 },
      { x: 5.2, z: 34, r: 0.55 },
      { x: -5.2, z: 12, r: 0.55 },
      { x: 5.2, z: 12, r: 0.55 },
      { x: -9.2, z: -2, r: 0.5 },
      { x: 9.2, z: -2, r: 0.5 },
      // 猫、石狮
      { x: 7.4, z: 19.2, r: 0.5 },
      { x: 7.6, z: 42, r: 0.7 },
      { x: -7.6, z: 42, r: 0.7 },
      // 香炉
      { x: 0, z: 4, r: 1.55 },
      // 供桌 / 签桌 / 经桌 / 木鱼桌
      { x: 6.2, z: -28.6, r: 1.25 },
      { x: -6.2, z: -28.6, r: 1.25 },
      { x: 6.6, z: -13.4, r: 1.15 },
    ];
    // 殿内柱子
    for (const x of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
      for (const z of [-11.35, -20.45]) this.circles.push({ x, z, r: 0.34 });
    }
    // 钟 / 鼓本体，不能走进鼓里
    this.circles.push({ x: -17, z: 6, r: 1.1 }, { x: 17, z: 6, r: 1.35 });
    // 钟鼓楼一层柱子
    for (const sx of [-17, 17]) {
      for (const x of [-3.2, -1.1, 1.1, 3.2]) {
        for (const z of [-3.2, 3.2]) this.circles.push({ x: sx + x, z: 6 + z, r: 0.26 });
      }
      for (const z of [-1.1, 1.1]) {
        for (const x of [-3.2, 3.2]) this.circles.push({ x: sx + x, z: 6 + z, r: 0.26 });
      }
    }
  }

  blocked(x: number, z: number) {
    if (Math.abs(x) > 34 || z < -40 || z > 56) return true;
    const r = 0.42;
    for (const b of this.rects) {
      if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
    }
    for (const c of this.circles) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + r) ** 2) return true;
    }
    // 放生池（桥面除外）
    const px = x / 12.4;
    const pz = (z - 15) / 6.95;
    // 池水：按角色身体半径留边；桥面只留 1.2m 半宽
    const wx = x / 12.05;
    const wz = (z - 15) / 6.55;
    if (wx * wx + wz * wz < 1 && Math.abs(x) > 1.2) return true;
    return false;
  }

  /** 只挡墙、楼、树与台基，不挡矮桌/水面，供第三人称镜头拉近用 */
  cameraBlocked(x: number, z: number) {
    const r = 0.2;
    for (const b of this.rects) {
      if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
    }
    for (const c of [{ x: 26, z: -26, r: 4.7 }, { x: -13, z: 20, r: 1.4 }, { x: -24, z: -12, r: 1.2 }, { x: 22, z: 12, r: 1.2 }]) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + r) ** 2) return true;
    }
    return false;
  }

  nearest(pos: THREE.Vector3): Interactive | null {
    let best: Interactive | null = null;
    let bestD = Infinity;
    for (const it of this.interactives) {
      const dx = pos.x - it.pos.x;
      const dz = pos.z - it.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  /** 点击石碑 */
  pickZen(raycaster: THREE.Raycaster): { text: string; from: string } | null {
    const hits = raycaster.intersectObjects(this.zenHits, false);
    if (hits.length) {
      const z = hits[0].object.userData.zen as { text: string; from: string };
      if (z) return z;
    }
    return null;
  }

  /** 点击莲灯/红绸读取心愿 */
  pickWish(raycaster: THREE.Raycaster): { text: string; from: string } | null {
    const objs: THREE.Object3D[] = [];
    for (const l of this.lanterns) objs.push(l.group);
    for (const r of this.ribbonRoot.children) objs.push(r);
    const hits = raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.wish) return { text: o.userData.wish as string, from: (o.userData.from as string) ?? '灯' };
        o = o.parent;
      }
    }
    return null;
  }

  /* ================= 互动 ================= */

  strikeBell() {
    this.bellSwingV += 0.55;
    this.bellSwing = Math.max(this.bellSwing, 0.02);
  }

  strikeDrum() {
    this.drumPulse = 1;
  }

  knockMuyu() {
    this.muyu.scale.set(1.08, 0.92, 1.08);
    window.setTimeout(() => this.muyu.scale.set(1, 1, 1), 120);
  }

  boostIncense() {
    (this.smoke.points.material as THREE.PointsMaterial).opacity = 0.55;
    window.setTimeout(() => {
      (this.smoke.points.material as THREE.PointsMaterial).opacity = 0.22;
    }, 2600);
  }

  addLantern(wish: string, colorId: string, from = '灯', shore = false, spawnAt?: { x: number; z: number }) {
    const color = LANTERN_COLORS.find((c) => c.id === colorId) ?? LANTERN_COLORS[0];
    const g = new THREE.Group();
    const lotus = createLotusFlower();
    lotus.scale.setScalar(1.7);
    g.add(lotus);
    const shade = mesh(
      new THREE.CylinderGeometry(0.19, 0.16, 0.3, 12, 1, true),
      new THREE.MeshStandardMaterial({
        color: color.color, emissive: color.glow, emissiveIntensity: 1.6,
        roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.94,
      }),
      0, 0.3, 0,
    );
    g.add(shade);
    const flame = mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffe6b0' }), 0, 0.36, 0, false, false);
    g.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: color.glow, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(2.2);
    glow.position.y = 0.34;
    g.add(glow);
    this.sprites.push(glow);

    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * 3.4;
    const cx = Math.cos(angle) * 6;
    const cz = 15 + Math.sin(angle) * 2.6;
    const spawn = shore
      ? new THREE.Vector3(spawnAt?.x ?? 2.3, 0.2, spawnAt?.z ?? 21.1)
      : new THREE.Vector3(cx + Math.cos(angle) * radius, 0.2, cz + Math.sin(angle) * radius * 0.6);
    g.position.copy(spawn);
    if (shore) this.addRipple(spawn.x, spawn.z);
    g.userData.wish = wish;
    g.userData.from = from;
    g.traverse((o) => { o.userData.wish = wish; o.userData.from = from; });
    this.lanternRoot.add(g);
    this.lanterns.push({
      group: g, wish, colorId, angle, radius,
      speed: (0.02 + Math.random() * 0.03) * (Math.random() > 0.5 ? 1 : -1),
      bob: Math.random() * 6, cx, cz, spawn, spawnT: shore ? 0 : 1,
    });
    this.placedLanternCount++;
    while (this.lanterns.length > 14) {
      const old = this.lanterns.shift();
      if (old) {
        old.group.removeFromParent();
        this.sprites = this.sprites.filter((s) => !old.group.children.includes(s));
      }
    }
  }

  private addRipple(x: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.27, 32),
      new THREE.MeshBasicMaterial({ color: '#d5e3d6', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.19, z);
    this.scene.add(mesh);
    this.ripples.push({ mesh, age: 0 });
  }

  plantIncense() {
    if (!this.burner) return;
    this.smoke.points.visible = true;
    const cluster = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: '#6b4b32', roughness: 0.9 });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#ff7a32' });
    for (let i = 0; i < 3; i++) {
      const x = (Math.random() - 0.5) * 0.34;
      const z = (Math.random() - 0.5) * 0.34;
      const h = 0.26 + Math.random() * 0.05;
      const stick = cyl(0.013, 0.013, h * 2, 4, stickMat, x, 1.62 + h, z);
      stick.rotation.z = (Math.random() - 0.5) * 0.14;
      stick.rotation.x = (Math.random() - 0.5) * 0.14;
      cluster.add(stick);
      cluster.add(mesh(new THREE.SphereGeometry(0.018, 5, 5), emberMat, x, 1.62 + h * 2, z, false, false));
    }
    const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: '#ffb45e', transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    tipGlow.scale.setScalar(0.5);
    tipGlow.position.y = 2.14;
    cluster.add(tipGlow);
    this.burner.add(cluster);
    this.incensePlanted.push(cluster);
    while (this.incensePlanted.length > 9) {
      const old = this.incensePlanted.shift();
      old?.removeFromParent();
    }
    this.boostIncense();
  }

  addRibbon(wish: string, from = '红绸') {
    const g = new THREE.Group();
    const cloth = mesh(new THREE.PlaneGeometry(0.12, 0.7), new THREE.MeshStandardMaterial({
      color: '#b23a2c', roughness: 0.9, side: THREE.DoubleSide,
    }), 0, -0.36, 0, false, false);
    cloth.rotation.y = Math.random() * Math.PI;
    g.add(cloth);
    const tag = mesh(new THREE.PlaneGeometry(0.2, 0.26), M.paper, 0, -0.82, 0, false, false);
    tag.rotation.y = cloth.rotation.y;
    g.add(tag);
    const a = Math.random() * Math.PI * 2;
    const r = 1.6 + Math.random() * 2.2;
    g.position.set(Math.cos(a) * r, 2.5 + Math.random() * 1.4, Math.sin(a) * r);
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.wish = wish;
    g.userData.from = from;
    g.traverse((o) => { o.userData.wish = wish; });
    this.ribbonRoot.add(g);
  }

  /** 将场景布置的灯与绸恢复 */
  restore(wishes: { text: string; color: string }[]) {
    for (const w of wishes.slice(-10)) this.addLantern(w.text, w.color);
  }

  /** 其他真人访客坐下时，在对应蒲团上出现一个同伴 */
  setRemoteSeats(seats: (string | null)[], selfId: string | null) {
    const present = new Set<number>();
    for (let i = 0; i < SEATS.length; i++) {
      const owner = seats[i];
      if (i === RESIDENT_SEAT) continue;
      if (!owner || owner === selfId || owner === 'resident') continue;
      present.add(i);
      if (this.remoteVisitors.has(i)) continue;
      const robe = ['#5d5f54', '#6a6355', '#555f57', '#6f6757'][i % 4];
      const rig = createSimpleMonk({ robe, sash: i % 2 ? '#7d3a2b' : '#6d5a3a', skin: '#d2ae88' });
      rig.root.position.set(SEATS[i].x, 0.86, SEATS[i].z);
      rig.root.rotation.y = Math.PI;
      poseSimple(rig, 'sit', 0, 0, 0);
      this.scene.add(rig.root);
      this.remoteVisitors.set(i, rig);
    }
    for (const [i, rig] of this.remoteVisitors) {
      if (!present.has(i)) {
        rig.root.removeFromParent();
        this.remoteVisitors.delete(i);
      }
    }
  }

  /* ================= 地点 ================= */

  place(pos: THREE.Vector3) {
    if (pos.z > 34) return { name: '山门', caption: '山门常开' };
    if (pos.z > 21) return { name: '放生池', caption: '水清鱼自闲' };
    if (pos.z > 6) return { name: '前庭', caption: '香火未断' };
    if (pos.z > -8) return { name: '大殿前', caption: '檐下听风' };
    if (pos.z > -24) return { name: '大雄宝殿', caption: '一念不生' };
    if (pos.x > 16) return { name: '塔院', caption: '七级浮屠' };
    return { name: '藏经阁', caption: '经卷未合' };
  }

  get lanternCount() {
    return this.placedLanternCount;
  }
}

/* ---------- 小猫 ---------- */

function createCat(): THREE.Group {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#b98a5c', roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: '#6e4c31', roughness: 0.95 });
  const body = mesh(new THREE.SphereGeometry(0.2, 12, 10), fur, 0, 0.2, 0);
  body.scale.set(0.85, 1.1, 1.35);
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.14, 12, 10), fur, 0, 0.42, 0.17);
  g.add(head);
  for (const s of [1, -1]) {
    const ear = mesh(new THREE.ConeGeometry(0.055, 0.12, 4), dark, s * 0.085, 0.54, 0.17);
    g.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.018, 5, 4), new THREE.MeshBasicMaterial({ color: '#2b2a20' }), s * 0.055, 0.45, 0.29, false, false);
    g.add(eye);
  }
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.12, -0.18);
  const tm = mesh(new THREE.CapsuleGeometry(0.03, 0.36, 3, 6), dark, 0, 0.1, -0.18);
  tm.rotation.x = 1.0;
  tail.add(tm);
  g.add(tail);
  return g;
}

let _glowTex: THREE.Texture | null = null;
function glowTex(): THREE.Texture {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,244,210,1)');
  gr.addColorStop(0.24, 'rgba(255,200,120,0.55)');
  gr.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}
