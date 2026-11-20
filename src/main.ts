import * as THREE from 'three';
import './style.css';
import { CameraRig } from './core/camera';
import { Player } from './core/player';
import { Soundscape, type TimeName } from './core/audio';
import { UI, type WishView } from './ui/ui';
import { World } from './world/world';
import { LANTERN_COLORS, SEATS, SEED_WISHES, SIGNS, ZEN_LINES, type Sign } from './data/content';
import { Presence } from './net/presence';

/* ============================================================
   存档
   ============================================================ */

type SavedWish = { text: string; color: string; ts: number };
type SavedLantern = { text: string; color: string };

type State = {
  visits: number;
  merit: number;
  wishes: SavedWish[];
  lanterns: SavedLantern[];
  ribbons: string[];
  sign: { n: number; date: string } | null;
  time: TimeName;
  muted: boolean;
};

const KEY = 'kongshan.v1';

function loadState(): State {
  const fallback: State = {
    visits: 0, merit: 0, wishes: [], lanterns: [], ribbons: [], sign: null, time: 'dusk', muted: false,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      ...fallback,
      ...parsed,
      wishes: Array.isArray(parsed.wishes) ? parsed.wishes.slice(-40) : [],
      lanterns: Array.isArray(parsed.lanterns) ? parsed.lanterns.slice(-12) : [],
      ribbons: Array.isArray(parsed.ribbons) ? parsed.ribbons.slice(-20) : [],
      time: parsed.time && ['dawn', 'noon', 'dusk', 'night'].includes(parsed.time) ? parsed.time : 'dusk',
    };
  } catch {
    return fallback;
  }
}

const state = loadState();
state.visits += 1;

let saveTimer = 0;
function save() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* 无痕模式可能禁用存储 */ }
  }, 250);
}

const today = () => new Date().toDateString();

/* ============================================================
   渲染器 / 场景
   ============================================================ */

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
const HQ = new URLSearchParams(location.search).has('hq');
const maxPR = Math.min(window.devicePixelRatio || 1, 1.35);
let pixelRatio = HQ ? maxPR : Math.min(maxPR, 1.15);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const noShadow = new URLSearchParams(location.search).has('noshadow');
renderer.shadowMap.enabled = !noShadow;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 600);
const camRig = new CameraRig(camera);
camRig.setIntro();

const world = new World(renderer, scene);
world.setTime(state.time, true);
const player = new Player(new THREE.Vector3(0, 0, 47.5));
scene.add(player.rig.root);
player.rig.root.rotation.y = Math.PI;
player.setLamp(state.time === 'night');
player.onStep = () => sound.step();

const sound = new Soundscape();
sound.applyTime(state.time, 0.1);

camRig.groundY = (x, z) => world.groundHeight(x, z);
camRig.blocked = (x, z) => world.cameraBlocked(x, z);

// 恢复灯与红绸
world.addRibbon('愿山中清净，人间无事', '旧绸');
for (const r of state.ribbons) world.addRibbon(r, '红绸');
for (const l of state.lanterns) world.addLantern(l.text || '一盏没有写字的灯', l.color, '莲灯');

/* ============================================================
   界面
   ============================================================ */

let entered = false;
let currentInteractive: string | null = null;
let bellCount = 0;
let spaceHeld = false;
let spaceTimer = 0;
let joystickActive = false;
let joystick = { x: 0, y: 0 };
const keys = new Set<string>();
const raycaster = new THREE.Raycaster();

const ui = new UI({
  onEnter: () => enterTemple(),
  onSound: () => toggleSound(),
  onTime: () => cycleTime(),
  onSetTime: (t) => setTime(t as TimeName),
  onInteract: () => interactNearest(),
  onNavigate: (id) => teleport(id),
  onWishes: () => wishViews(),
  onIncense: (text) => saveIncenseWish(text),
  onLantern: (text, color) => doLantern(text, color),
  onRibbon: (text) => doRibbon(text),
  onSign: () => drawSign(),
  onMeditateStart: (min) => beginMeditation(min),
  onMeditateEnd: (min, elapsed) => endMeditation(min, elapsed),
  onSutraDone: (lines) => finishSutra(lines),
  onSutraClose: (lines) => { if (lines > 1) ui.toast('经卷已收起，随时可以再写'); },
  onChantStart: () => { player.setChanting(true); sound.chime(392, 0.35); sound.chantStart(); },
  onChantKnock: () => { player.knockChant(); sound.woodblock(0.98 + Math.random() * 0.04); },
  onChantEnd: (minutes, knocks, elapsed, completed) => endChant(minutes, knocks, elapsed, completed),
  onChantCancel: () => cancelChant(),
  onReset: () => {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    window.location.reload();
  },
  onTeleport: (id) => teleport(id),
});

ui.setVisit(state.visits);
ui.setMerit(state.merit);
ui.syncSound(false);
ui.setTimeLabel({ dawn: '清晨', noon: '日午', dusk: '黄昏', night: '夜' }[state.time]);
ui.setIntroTime({ dawn: '清晨', noon: '日午', dusk: '黄昏', night: '夜' }[state.time]);
ui.setPeople(1);

const presence = new Presence();
presence.onUpdate = () => {
  const n = Math.max(1, presence.count || 1);
  ui.setPeople(n, presence.connected);
  world.setRemoteSeats(presence.seats, presence.selfId);
};
presence.connect();
ui.setPeople(1, false);

/* ============================================================
   进出山门
   ============================================================ */

function enterTemple() {
  if (entered) return;
  entered = true;
  ui.enterTemple();
  camRig.startFollow(player.yaw);
  if (!state.muted) {
    void sound.enable().then(() => {
      ui.syncSound(sound.enabled);
      if (player.chanting) sound.chantStart();
    });
  }
  save();
  window.setTimeout(() => {
    if (entered) ui.toast('山门已开 · 走近香炉，按 E 上香', 4600);
  }, 2400);
}

function toggleSound() {
  if (sound.enabled) {
    sound.disable();
    state.muted = true;
    ui.syncSound(false);
  } else {
    state.muted = false;
    void sound.enable().then(() => {
      ui.syncSound(sound.enabled);
      if (player.chanting) sound.chantStart();
    });
    ui.syncSound(true);
  }
  save();
}

function cycleTime() {
  const order: TimeName[] = ['dawn', 'noon', 'dusk', 'night'];
  const idx = order.indexOf(world.time);
  setTime(order[(idx + 1) % order.length]);
}

function setTime(t: TimeName) {
  world.setTime(t);
  sound.applyTime(t, 1.6);
  player.setLamp(t === 'night');
  const label = { dawn: '清晨', noon: '日午', dusk: '黄昏', night: '夜' }[t] ?? '黄昏';
  ui.setTimeLabel(label);
  ui.setIntroTime(label);
  state.time = t;
  save();
  ui.toast({ dawn: '晨雾起来了', noon: '日头正高', dusk: '黄昏了，灯会亮起来', night: '入夜了，听钟' }[t], 2200);
}

/* ============================================================
   互动
   ============================================================ */

function interactNearest() {
  if (!entered || ui.overlayOpen || player.busy || player.sitting) return;
  const it = world.nearest(player.pos);
  if (!it) return;
  interact(it.id);
}

function interact(id: string) {
  if (!entered || ui.overlayOpen || player.busy || player.sitting) return;
  switch (id) {
    case 'incense':
      lightIncense();
      break;
    case 'bow': {
      player.stop();
      player.playAction('bow', 4.2, () => {
        ui.bumpMerit(3);
        ui.toast('三拜已毕 · 功德 +3');
        state.merit = state.merit + 3;
        save();
      });
      for (const delay of [350, 1750, 3150]) {
        window.setTimeout(() => sound.woodblock(0.92), delay);
      }
      window.setTimeout(() => sound.chime(392, 0.35), 2000);
      break;
    }
    case 'muyu':
      knockMuyu();
      break;
    case 'bell': {
      player.stop();
      snapNear(-17, 7.8, Math.PI, true);
      player.setStrikeKind('bell');
      player.playAction('strike', 1.5);
      camRig.camera.position.set(-15.6, 2.6, 13.4);
      camRig.focus(new THREE.Vector3(-15.6, 2.6, 13.4), new THREE.Vector3(-17, 1.9, 7.2));
      window.setTimeout(() => camRig.clearFocus(), 2600);
      window.setTimeout(() => {
        sound.bell(1);
        world.strikeBell();
        camRig.shake(0.4);
        bellCount += 1;
        ui.bumpMerit(2);
        state.merit += 2;
        save();
        if (bellCount === 108) {
          sound.swell();
          ui.toast('一百零八响 · 愿烦恼随钟声散去', 5200);
        } else {
          ui.toast(`第 ${bellCount} 响 · 功德 +2`, 1800);
        }
      }, 720);
      break;
    }
    case 'drum': {
      player.stop();
      snapNear(17, 7.8, Math.PI, true);
      player.setStrikeKind('drum');
      player.playAction('strike', 1.3);
      camRig.camera.position.set(18.6, 2.6, 14.2);
      camRig.focus(new THREE.Vector3(18.6, 2.6, 14.2), new THREE.Vector3(17, 1.5, 7.0));
      window.setTimeout(() => camRig.clearFocus(), 2400);
      window.setTimeout(() => {
        sound.drum(1.25);
        sound.woodblock(0.55);
        world.strikeDrum();
        camRig.shake(0.18);
        ui.bumpMerit(1);
        state.merit += 1;
        save();
        ui.toast('暮鼓一声 · 功德 +1', 1600);
      }, 650);
      break;
    }
    case 'pagoda':
      startCircumambulation();
      break;
    case 'sign': {
      const canDraw = state.sign?.date !== today();
      const prev = state.sign ? SIGNS.find((s) => s.n === state.sign!.n) ?? null : null;
      ui.openSign(prev, canDraw);
      break;
    }
    case 'sutra':
      ui.openSutra();
      break;
    case 'lantern':
      player.stop();
      snapNear(0, 23.0, Math.PI);
      ui.openLantern();
      break;
    case 'ribbon':
      ui.openRibbon();
      break;
    case 'quiet':
      ui.openMeditateChoice();
      break;
    case 'chant':
      beginChant();
      break;
    case 'stele': {
      const line = player.pos.x >= 0 ? ZEN_LINES[0] : ZEN_LINES[1];
      ui.openZen(line.text, line.from);
      break;
    }
    default:
      break;
  }
}

function knockMuyu() {
  if (player.busy || player.sitting || ui.overlayOpen) return;
  player.playAction('knock', 0.42);
  sound.woodblock(0.95 + Math.random() * 0.1);
  world.knockMuyu();
  ui.bumpMerit(1);
  state.merit += 1;
  save();
}

function lightIncense() {
  snapNear(0, 5.95, Math.PI, true);
  player.playAction('incense', 3.4);
  camRig.camera.position.set(3.2, 2.5, 9.2);
  camRig.focus(new THREE.Vector3(3.2, 2.5, 9.2), new THREE.Vector3(0, 1.3, 5.0));
  window.setTimeout(() => camRig.clearFocus(), 4300);
  window.setTimeout(() => {
    sound.incenseLight();
    sound.chime(480, 0.45);
    world.plantIncense();
    ui.bumpMerit(3);
    state.merit += 3;
    save();
    ui.toast('香已插入炉中 · 功德 +3', 3600);
  }, 1900);
  window.setTimeout(() => { if (!ui.overlayOpen) ui.openIncense(); }, 3600);
}

function saveIncenseWish(text: string) {
  if (!text) {
    ui.toast('香已经点过了');
    return;
  }
  state.wishes.push({ text, color: 'gold', ts: Date.now() });
  state.wishes = state.wishes.slice(-40);
  state.merit += 1;
  ui.bumpMerit(1);
  save();
  sound.paper();
  ui.toast('话已留在山里 · 功德 +1', 3600);
}

function doLantern(text: string, color: string) {
  const message = text || '一盏没有写字的灯';
  snapNear(0, 23.0, Math.PI, true);
  player.playAction('lantern', 3.2);
  window.setTimeout(() => camRig.focus(new THREE.Vector3(4.4, 2.2, 20.8), new THREE.Vector3(0, 0.95, 22.6)), 260);
  window.setTimeout(() => camRig.clearFocus(), 5000);
  window.setTimeout(() => {
    world.addLantern(message, color, '莲灯', true, { x: 0.4, z: 21.45 });
    sound.waterDrop();
    window.setTimeout(() => sound.chime(640, 0.3), 450);
    ui.toast('灯已入水 · 会替你漂一会儿');
  }, 2350);
  state.lanterns.push({ text, color });
  state.lanterns = state.lanterns.slice(-12);
  if (text) {
    state.wishes.push({ text, color, ts: Date.now() });
    state.wishes = state.wishes.slice(-40);
  }
  ui.bumpMerit(2);
  state.merit += 2;
  save();
}

function doRibbon(text: string) {
  world.addRibbon(text, '红绸');
  state.ribbons.push(text);
  state.ribbons = state.ribbons.slice(-20);
  state.wishes.push({ text, color: 'cinnabar', ts: Date.now() });
  state.wishes = state.wishes.slice(-40);
  ui.bumpMerit(2);
  state.merit += 2;
  save();
  sound.paper();
  ui.toast('红绸系好了 · 风会替你念');
}

function drawSign(): Sign {
  const pool = SIGNS.filter((s) => s.n !== (state.sign?.n ?? -1));
  const sign = pool[Math.floor(Math.random() * pool.length)] ?? SIGNS[0];
  state.sign = { n: sign.n, date: today() };
  state.merit += 1;
  ui.bumpMerit(1);
  save();
  sound.chime(560, 0.4);
  window.setTimeout(() => ui.toast('签已入袋 · 功德 +1', 1800), 900);
  return sign;
}

/* ============================================================
   静坐 / 抄经
   ============================================================ */

function beginMeditation(minutes: number) {
  player.setChanting(false);
  sound.chantStop();
  player.stop();
  player.sitAt(0, -14.35, Math.PI);
  player.pos.y = 0.86;
  player.rig.root.position.y = 0.86;
  camRig.camera.position.set(3.4, 2.6, -9.2);
  camRig.focus(new THREE.Vector3(3.4, 2.35, -9.4), new THREE.Vector3(0, 2.9, -19.8));
  ui.hidePrompt();
  sound.chime(392, 0.5);
  window.setTimeout(() => sound.swell(), 1200);
  void minutes;
}

function endMeditation(minutes: number, elapsed: number) {
  camRig.clearFocus();
  player.stand();
  if (elapsed >= 30) {
    const gain = Math.max(1, Math.round(elapsed / 60));
    state.merit += gain;
    ui.bumpMerit(gain);
    save();
    ui.toast(`坐了 ${Math.floor(elapsed / 60)} 分 ${Math.floor(elapsed % 60)} 秒 · 功德 +${gain}`, 4200);
  } else {
    ui.toast('坐了一小会儿，也很好', 2600);
  }
  sound.chime(523, 0.4);
}

let localSeat = -1;
let chantStarting = false;

let circuiting = false;

async function startCircumambulation() {
  if (circuiting || player.busy || player.sitting || ui.overlayOpen) return;
  circuiting = true;
  player.stop();
  const prevSpeed = player.speed;
  player.speed = 4.2;
  ui.toast('绕塔一匝 · 慢慢走', 2200);
  const cx = 26;
  const cz = -26;
  const radius = 6.5;
  const startAngle = Math.atan2(player.pos.z - cz, player.pos.x - cx);
  const points = 10;
  for (let i = 1; i <= points; i++) {
    const a = startAngle + (i / points) * Math.PI * 2;
    player.moveTo(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const check = () => {
        const d = Math.hypot(player.pos.x - (cx + Math.cos(a) * radius), player.pos.z - (cz + Math.sin(a) * radius));
        if (d < 0.7 || performance.now() - started > 1500) resolve();
        else window.setTimeout(check, 60);
      };
      window.setTimeout(check, 60);
    });
  }
  player.stop();
  player.speed = prevSpeed;
  circuiting = false;
  state.merit += 5;
  ui.bumpMerit(5);
  save();
  sound.chime(440, 0.45);
  window.setTimeout(() => sound.swell(), 500);
  ui.toast('绕塔一匝 · 功德 +5', 3200);
}

async function beginChant() {
  if (!entered || ui.overlayOpen || player.busy || chantStarting) return;
  chantStarting = true;
  try {
    await beginChantInner();
  } finally {
    chantStarting = false;
  }
}

async function beginChantInner() {
  const free = presence.freeSeats();
  if (!free.length) {
    ui.toast('蒲团都有人了，在山里等一会儿再来', 3600);
    return;
  }
  const ranked = free
    .map((i) => ({ i, d: Math.hypot(player.pos.x - SEATS[i].x, player.pos.z - SEATS[i].z) }))
    .sort((a, b) => {
      const aClose = a.d < 0.85 ? 1 : 0;
      const bClose = b.d < 0.85 ? 1 : 0;
      return aClose - bClose || a.d - b.d;
    });
  let chosen = -1;
  for (const c of ranked) {
    const res = await presence.sit(c.i);
    if (res.ok) { chosen = c.i; break; }
  }
  if (chosen < 0) {
    ui.toast('蒲团刚被别人坐了，再试一次', 3200);
    return;
  }
  localSeat = chosen;
  player.stop();
  player.stand();
  const cx = SEATS[chosen].x;
  const cz = SEATS[chosen].z;
  player.moveTo(cx, cz);
  const started = performance.now();
  const settle = () => {
    const d = Math.hypot(player.pos.x - cx, player.pos.z - cz);
    if (d < 0.3 || performance.now() - started > 2200) {
      player.stop();
      player.sitAt(cx, cz, Math.PI);
      player.pos.y = 0.86;
      player.rig.root.position.y = 0.86;
      camRig.camera.position.set(-4.8, 2.2, -11.5);
      camRig.focus(new THREE.Vector3(-4.8, 2.2, -11.5), new THREE.Vector3(0, 1.15, -15.4));
      ui.openChantSetup();
      sound.chime(392, 0.3);
    } else {
      requestAnimationFrame(settle);
    }
  };
  requestAnimationFrame(settle);
}

function endChant(minutes: number, knocks: number, elapsed: number, completed: boolean) {
  camRig.clearFocus();
  player.setChanting(false);
  player.stand();
  sound.chantStop();
  presence.stand();
  localSeat = -1;
  const used = completed ? minutes : Math.max(0, elapsed / 60);
  const gain = Math.max(1, Math.round(used / 5) + (completed ? 1 : 0));
  state.merit += gain;
  ui.bumpMerit(gain);
  save();
  if (completed) {
    ui.toast(`诵经已毕 · ${minutes} 分钟 · 木鱼 ${knocks} 声 · 功德 +${gain}`, 5600);
    sound.chime(440, 0.4);
    window.setTimeout(() => sound.swell(), 800);
  } else if (elapsed >= 30) {
    ui.toast(`诵经 ${Math.floor(elapsed / 60)} 分钟 · 功德 +${gain}`, 4200);
    sound.chime(440, 0.35);
  } else {
    ui.toast('起身了，也很好', 2400);
    sound.chime(440, 0.25);
  }
}

function cancelChant() {
  camRig.clearFocus();
  player.setChanting(false);
  player.stand();
  sound.chantStop();
  presence.stand();
  localSeat = -1;
  ui.toast('改日再念', 2000);
}

function finishSutra(lines: number) {
  const gain = Math.max(2, lines * 2);
  state.merit += gain;
  ui.bumpMerit(gain);
  save();
  sound.chime(440, 0.45);
  window.setTimeout(() => sound.swell(), 900);
}

/* ============================================================
   导览 / 传送
   ============================================================ */

const SPOTS: Record<string, [number, number, number]> = {
  gate: [0, 0, 48],
  incense: [0, 0, 7.4],
  bow: [0, 0.86, -11.2],
  muyu: [4.7, 0.86, -12.2],
  bell: [-17, 0, 10.2],
  drum: [17, 0, 10.2],
  sign: [4.0, 0, -27.2],
  sutra: [-4.0, 0, -27.2],
  lantern: [0, 0, 24.4],
  ribbon: [-10.2, 0, 22.4],
  quiet: [0, 0.86, -14.2],
  chant: [0, 0.86, -13.8],
  pagoda: [26, 0, -19.2],
};

function snapNear(x: number, z: number, yaw: number, force = false) {
  const d = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (!force && d < 1.4) return;
  player.stop();
  player.stand();
  player.pos.set(x, world.groundHeight(x, z), z);
  player.rig.root.position.copy(player.pos);
  player.face(yaw);
}

function teleport(id: string) {
  const s = SPOTS[id];
  if (!s) return;
  player.stop();
  player.stand();
  player.pos.set(s[0], world.groundHeight(s[0], s[2]), s[2]);
  player.rig.root.position.set(player.pos.x, player.pos.y, player.pos.z);
  player.yaw = Math.PI;
  player.rig.root.rotation.y = Math.PI;
player.setLamp(state.time === 'night');
  camRig.startFollow(player.yaw);
  if (id === 'quiet') {
    window.setTimeout(() => ui.openMeditateChoice(), 420);
  } else if (id === 'chant') {
    window.setTimeout(() => beginChant(), 420);
  } else {
    ui.toast(`到了${world.place(player.pos).name}`, 1500);
  }
}

/* ============================================================
   输入：键盘 / 指针 / 摇杆
   ============================================================ */

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
  if (!entered) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      enterTemple();
    }
    return;
  }
  if (ui.chantOpen) {
    if (e.code === 'Space') { e.preventDefault(); ui.knockChant(); }
    return;
  }
  if (ui.overlayOpen) return;
  if (MOVE_KEYS.has(e.code)) {
    keys.add(e.code);
    e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'KeyE':
      e.preventDefault();
      interactNearest();
      break;
    case 'Space':
      e.preventDefault();
      if (!spaceHeld) {
        spaceHeld = true;
        if (world.nearest(player.pos)?.id === 'muyu') {
          knockMuyu();
          spaceTimer = window.setInterval(() => knockMuyu(), 380);
        }
      }
      break;
    case 'KeyQ':
      ui.openMeditateChoice();
      break;
    case 'KeyJ':
      ui.openSutra();
      break;
    case 'KeyM':
      ui.openNav();
      break;
    case 'KeyH':
      ui.openWishes(wishViews());
      break;
    case 'KeyT':
      cycleTime();
      break;
    case 'KeyP':
      toggleSound();
      break;
    case 'KeyR':
      teleport('gate');
      ui.toast('已回到山门');
      break;
    default:
      break;
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space') {
    spaceHeld = false;
    window.clearInterval(spaceTimer);
  }
});

window.addEventListener('blur', () => {
  keys.clear();
  spaceHeld = false;
  window.clearInterval(spaceTimer);
});

function keyboardMove() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (x === 0 && z === 0) return null;
  const forward = new THREE.Vector3(-Math.sin(camRig.yaw), 0, -Math.cos(camRig.yaw));
  const right = new THREE.Vector3(Math.cos(camRig.yaw), 0, -Math.sin(camRig.yaw));
  const dir = new THREE.Vector3().addScaledVector(right, x).addScaledVector(forward, z).normalize();
  return { x: dir.x, z: dir.z };
}

const isTouchDevice = (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

let down = false;
let downX = 0;
let downY = 0;
let downT = 0;
let moved = 0;
let lastPointer: { x: number; y: number } | null = null;
const activePointers = new Map<number, { x: number; y: number }>();
let pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
  if (isTouchDevice && e.pointerType !== 'mouse') return;
  if (!entered || ui.overlayOpen) return;
  canvas.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) {
    const [a, b] = [...activePointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    return;
  }
  down = true;
  downX = e.clientX;
  downY = e.clientY;
  downT = performance.now();
  moved = 0;
  lastPointer = { x: e.clientX, y: e.clientY };
  player.stop();
});

canvas.addEventListener('pointermove', (e) => {
  if (isTouchDevice && e.pointerType !== 'mouse') return;
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) {
    const [a, b] = [...activePointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) camRig.zoom((pinchDist - d) * 6);
    pinchDist = d;
    return;
  }
  if (!down || !lastPointer) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  moved += Math.abs(dx) + Math.abs(dy);
  lastPointer = { x: e.clientX, y: e.clientY };
  if (moved > 5) camRig.orbit(dx, dy);
});

function endPointer(e: PointerEvent) {
  if (isTouchDevice && e.pointerType !== 'mouse') return;
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) pinchDist = 0;
  if (!down) return;
  down = false;
  const dt = performance.now() - downT;
  if (moved < 8 && dt < 600 && entered && !ui.overlayOpen) {
    handleTap(e.clientX, e.clientY);
  }
  lastPointer = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

/* 触屏兜底：iPhone / 华为等自带浏览器上，PointerEvent 有时不完整 */
let touchDrag = false;
let touchStartX = 0;
let touchStartY = 0;
let touchStartT = 0;
let touchMoved = 0;
let touchLast: { x: number; y: number } | null = null;
let touchPinch = 0;

canvas.addEventListener('touchstart', (e) => {
  if (!entered || ui.overlayOpen) return;
  if (e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    touchPinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    touchDrag = false;
    return;
  }
  const t = e.touches[0];
  if (!t) return;
  touchDrag = true;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartT = performance.now();
  touchMoved = 0;
  touchLast = { x: t.clientX, y: t.clientY };
  player.stop();
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!entered || ui.overlayOpen) return;
  if (e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (touchPinch > 0) camRig.zoom((touchPinch - d) * 6);
    touchPinch = d;
    e.preventDefault();
    return;
  }
  const t = e.touches[0];
  if (!t || !touchDrag || !touchLast) return;
  const dx = t.clientX - touchLast.x;
  const dy = t.clientY - touchLast.y;
  touchMoved += Math.abs(dx) + Math.abs(dy);
  touchLast = { x: t.clientX, y: t.clientY };
  if (touchMoved > 5) camRig.orbit(dx, dy);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (!touchDrag) {
    if (e.touches.length < 2) touchPinch = 0;
    return;
  }
  const dt = performance.now() - touchStartT;
  if (touchMoved < 10 && dt < 650 && entered && !ui.overlayOpen) {
    handleTap(touchStartX, touchStartY);
  }
  touchDrag = false;
  touchLast = null;
  touchPinch = 0;
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  touchDrag = false;
  touchLast = null;
  touchPinch = 0;
});

canvas.addEventListener('wheel', (e) => {
  if (!entered || ui.overlayOpen) return;
  e.preventDefault();
  camRig.zoom(e.deltaY);
}, { passive: false });

function handleTap(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const wish = world.pickWish(raycaster);
  if (wish) {
    ui.openWishNote(wish.text, wish.from);
    return;
  }
  const zen = world.pickZen(raycaster);
  if (zen) {
    ui.openZen(zen.text, zen.from);
    return;
  }
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, point)) {
    if (Math.abs(point.x) < 39 && point.z > -42 && point.z < 56) {
      player.moveTo(point.x, point.z);
    }
  }
}

function setupJoystick() {
  const el = document.getElementById('joystick');
  if (!el) return;
  const knob = document.getElementById('joystick-knob') ?? el.querySelector<HTMLElement>('.joystick-knob');
  if (!knob) return;
  let rect: DOMRect | null = null;
  let pointerId = -1;
  let touchId = -1;

  const reset = () => {
    joystickActive = false;
    joystick = { x: 0, y: 0 };
    knob.style.transform = '';
    pointerId = -1;
    touchId = -1;
  };
  const moveTo = (cx: number, cy: number) => {
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = cx - centerX;
    let dy = cy - centerY;
    const max = rect.width * 0.42;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystick = { x: dx / max, y: dy / max };
    joystickActive = true;
  };
  const begin = (cx: number, cy: number) => {
    if (!entered || ui.overlayOpen) return;
    rect = el.getBoundingClientRect();
    moveTo(cx, cy);
  };

  if (isTouchDevice) {
    // 触屏：用 touch 事件，避免部分国产浏览器 PointerEvent 不完整
    el.addEventListener('touchstart', (e) => {
      if (!entered || ui.overlayOpen) return;
      const t = e.changedTouches[0];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      touchId = t.identifier;
      begin(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!joystickActive || touchId < 0) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId) {
          e.preventDefault();
          moveTo(t.clientX, t.clientY);
          return;
        }
      }
    }, { passive: false });

    const endTouch = (e: TouchEvent) => {
      if (touchId < 0) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId) {
          reset();
          return;
        }
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
    return;
  }

  // 桌面：pointer 事件 + window 级监听，手指移出摇杆也不会断
  el.addEventListener('pointerdown', (e) => {
    if (!entered || ui.overlayOpen) return;
    e.preventDefault();
    e.stopPropagation();
    pointerId = e.pointerId;
    try { el.setPointerCapture(pointerId); } catch { /* noop */ }
    begin(e.clientX, e.clientY);
  });
  window.addEventListener('pointermove', (e) => {
    if (!joystickActive || e.pointerId !== pointerId) return;
    e.preventDefault();
    moveTo(e.clientX, e.clientY);
  });
  const endPointer = (e: PointerEvent) => {
    if (e.pointerId === pointerId) reset();
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
}
setupJoystick();

/* ============================================================
   心愿墙
   ============================================================ */

function wishViews(): WishView[] {
  const own: WishView[] = state.wishes.map((w) => ({ text: w.text, color: w.color, ago: '刚刚', mine: true })).reverse();
  const seeds: WishView[] = SEED_WISHES.filter((s) => !own.some((o) => o.text === s.text)).map((s) => ({
    text: s.text, color: s.color, ago: s.ago, mine: false,
  }));
  return [...own, ...seeds];
}

/* ============================================================
   主循环
   ============================================================ */

// 预编译所有着色器，避免入园后的长时间卡顿
let perfLast = performance.now();
let perfFrames = 0;
let perfTimer = window.setInterval(() => {
  if (HQ) return;
  const now = performance.now();
  const elapsed = (now - perfLast) / 1000;
  perfLast = now;
  const fps = perfFrames / Math.max(0.5, elapsed);
  perfFrames = 0;
  if (fps < 26 && pixelRatio > 0.7) {
    pixelRatio = Math.max(0.7, pixelRatio - 0.1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  } else if (fps > 50 && pixelRatio < maxPR) {
    pixelRatio = Math.min(maxPR, pixelRatio + 0.05);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}, 2000);

let last = performance.now();
let lastPlace = '';
let promptCooldown = 0;
let started = false;
let warmFrames = 0;
const stageTexts = ['正在立梁', '正在扫阶', '正在点灯', '山里有点远，再等一会儿'];
let stageIndex = 0;
const stageTimer = window.setInterval(() => {
  if (started && warmFrames >= 3) { window.clearInterval(stageTimer); return; }
  ui.setLoading(stageTexts[Math.min(stageIndex++, stageTexts.length - 1)]);
}, 5200);
(window as unknown as Record<string, unknown>).__frames = 0;
(window as unknown as Record<string, unknown>).__sched = 0;
(window as unknown as Record<string, unknown>).__phase = 'init';
window.addEventListener('error', (e) => {
  (window as unknown as Record<string, unknown>).__lastError = String(e.message);
});

function frame(now: number) {
  (window as unknown as Record<string, number>).__frames++;
  (window as unknown as Record<string, unknown>).__phase = 'start';
  try {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.12, rawDt);
  last = now;

  // 移动
  if (entered && !ui.overlayOpen && !player.busy && !player.sitting) {
    const k = keyboardMove();
    if (k) {
      player.setMoveInput(k.x, k.z);
    } else if (joystickActive) {
      const forward = new THREE.Vector3(-Math.sin(camRig.yaw), 0, -Math.cos(camRig.yaw));
      const right = new THREE.Vector3(Math.cos(camRig.yaw), 0, -Math.sin(camRig.yaw));
      const dir = new THREE.Vector3().addScaledVector(right, joystick.x).addScaledVector(forward, -joystick.y);
      if (dir.lengthSq() > 0.01) {
        dir.normalize();
        player.setMoveInput(dir.x, dir.z);
      } else {
        player.setMoveInput(0, 0);
      }
    } else {
      player.setMoveInput(0, 0);
    }
  } else {
    player.setMoveInput(0, 0);
  }

  const tA = performance.now();
  player.update(dt, (x, z) => world.groundHeight(x, z), (x, z) => world.blocked(x, z));
  const tB = performance.now();
  camRig.update(Math.min(0.2, rawDt), player.pos, player.yaw);
  const tC = performance.now();
  world.update(dt, camera);
  const tD = performance.now();

  if (entered) {
    // 地点
    const place = world.place(player.pos);
    if (place.name !== lastPlace) {
      lastPlace = place.name;
      ui.setPlace(place.name);
      ui.setCaption(place.caption);
    }
    // 交互提示
    promptCooldown -= dt;
    if (promptCooldown <= 0) {
      promptCooldown = 0.15;
      const it = world.nearest(player.pos);
      const id = it?.id ?? null;
      if (id !== currentInteractive) {
        currentInteractive = id;
        if (it) ui.showPrompt(it.name, it.hint);
        else ui.hidePrompt();
      }
      if (ui.overlayOpen || player.busy || player.sitting) {
        if (currentInteractive) {
          currentInteractive = null;
          ui.hidePrompt();
        }
      }
    }
  }

  (window as unknown as Record<string, unknown>).__phase = 'preRender';
  renderer.render(scene, camera);
  perfFrames++;
  (window as unknown as Record<string, unknown>).__phase = 'postRender';
  const tE = performance.now();
  const tm = (window as unknown as Record<string, unknown>).__timing as Record<string, number> | undefined;
  const cur = { player: tB - tA, camera: tC - tB, world: tD - tC, render: tE - tD };
  if (!tm) (window as unknown as Record<string, unknown>).__timing = cur;
  else for (const k of Object.keys(cur) as (keyof typeof cur)[]) tm[k] = tm[k] * 0.9 + cur[k] * 0.1;
  if (started) warmFrames++;
  if (!started) started = true;
  else if (warmFrames === 3) {
    window.clearInterval(stageTimer);
    ui.hideLoading();
    window.setTimeout(() => { if (entered) return; camRig.setIntro(); ui.showIntro(); }, 900);
  }
  } catch (err) {
    console.error('[kongshan] frame error', err);
    (window as unknown as Record<string, unknown>).__lastError = String(err);
  }
  (window as unknown as Record<string, number>).__sched++;
  (window as unknown as Record<string, unknown>).__phase = 'scheduled';
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const HQ = new URLSearchParams(location.search).has('hq');
const maxPR = Math.min(window.devicePixelRatio || 1, 1.35);
let pixelRatio = HQ ? maxPR : Math.min(maxPR, 1.15);
renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  sound.setSuspended(document.hidden);
  if (!document.hidden) last = performance.now();
});

window.addEventListener('beforeunload', () => {
  presence.close();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
});

// 开发期调试
(window as unknown as Record<string, unknown>).__kongshan = { world, player, camRig, ui, state, renderer, scene, camera, presence };
