import { LANTERN_COLORS, SEED_WISHES, SUTRAS, type Sign, type Sutra, ZEN_LINES } from '../data/content';

export type WishView = { text: string; ago: string; color: string; mine?: boolean };

export type UIHandlers = {
  onEnter: () => void;
  onSound: () => void;
  onTime: () => void;
  onSetTime: (t: string) => void;
  onInteract: () => void;
  onNavigate: (id: string) => void;
  onWishes: () => WishView[];
  onIncense: (text: string) => void;
  onLantern: (text: string, color: string) => void;
  onRibbon: (text: string) => void;
  onSign: () => Sign;
  onMeditateStart: (minutes: number) => void;
  onMeditateEnd: (minutes: number, elapsed: number) => void;
  onSutraDone: (lines: number) => void;
  onSutraClose: (lines: number) => void;
  onChantStart: (id: string, minutes: number) => void;
  onChantKnock: (knocks: number) => void;
  onChantEnd: (minutes: number, knocks: number, elapsed: number, completed: boolean) => void;
  onChantCancel: () => void;
  onReset: () => void;
  onTeleport: (id: string) => void;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function formatShichen(d = new Date()) {
  const h = d.getHours();
  const names = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const idx = Math.floor(((h + 1) % 24) / 2);
  return `${names[idx]}时`;
}

export class UI {
  h: UIHandlers;
  private merit = 0;
  private panelOpen = false;
  private loadingHiding = false;
  private lastFocus: HTMLElement | null = null;
  private toastTimer = 0;
  private medTimer = 0;
  private medEnd = 0;
  private medMinutes = 0;
  private medStart = 0;
  private breathTimer = 0;
  private sutraWired = false;
  private sutraLines: string[] = [];
  private sutraIndex = 0;
  private sutraDrawn = 0;
  private chantSutra: Sutra = SUTRAS[0];
  private chantMinutes = 15;
  private chantKnocks = 0;
  private chantRunning = false;
  private chantTotal = 0;
  private chantStartAt = 0;
  private chantLineIndex = 0;
  private chantTimer = 0;
  private chantKnockTimer = 0;
  private chantLineTimer = 0;
  private chantVoiceAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  private chantVoiceOn = this.chantVoiceAvailable;
  private chantVoiceTimer = 0;
  private chantSpeechWatchdog = 0;
  private chantSpeechSeq = 0;
  private voiceMuted = true;
  private sutraCtx: CanvasRenderingContext2D | null = null;
  private sutraGuideCtx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private lastPoint: { x: number; y: number } | null = null;
  private strokeLen = 0;

  el: Record<string, HTMLElement> = {};

  constructor(handlers: UIHandlers) {
    this.h = handlers;
    const ids = [
      'intro', 'enter', 'loading', 'loading-text', 'hud', 'hud-place', 'hud-caption', 'hud-people',
      'prompt', 'prompt-btn', 'prompt-label', 'prompt-hint', 'merit-value', 'tool-time-label',
      'tool-map', 'tool-wishes', 'tool-time', 'tool-sound', 'tool-more', 'btn-quiet', 'btn-sutra',
      'panel', 'panel-body', 'panel-close', 'panel-backdrop', 'panels', 'meditate', 'breath-text',
      'meditate-time', 'meditate-end', 'sutra', 'sutra-guide', 'sutra-ink', 'sutra-line-label',
      'sutra-prev', 'sutra-next', 'sutra-clear', 'sutra-finish', 'sutra-close', 'toast',
      'chant', 'chant-setup', 'chant-session', 'chant-sutras', 'chant-durations',
      'chant-start', 'chant-cancel', 'chant-name', 'chant-timer', 'chant-bar',
      'chant-line', 'chant-knocks', 'chant-fish', 'chant-end', 'chant-voice',
      'joystick', 'joystick-knob', 'mobile-action', 'mobile-action-label', 'visit-count', 'intro-clock',
      'intro-sound', 'tool-sound',
    ];
    for (const id of ids) {
      const e = document.getElementById(id);
      if (e) this.el[id] = e;
    }
    this.bind();
    this.setClock();
  }

  private bind() {
    this.el.enter?.addEventListener('click', () => this.h.onEnter());
    this.el['intro-sound']?.addEventListener('click', () => this.h.onSound());
    this.el['tool-sound']?.addEventListener('click', () => this.h.onSound());
    this.el['tool-time']?.addEventListener('click', () => this.h.onTime());
    this.el['tool-map']?.addEventListener('click', () => this.openNav());
    this.el['tool-wishes']?.addEventListener('click', () => this.openWishes(this.h.onWishes()));
    this.el['tool-more']?.addEventListener('click', () => this.openMore());
    this.el['prompt-btn']?.addEventListener('click', () => this.h.onInteract());
    this.el['mobile-action']?.addEventListener('click', () => this.h.onInteract());
    this.el['panel-close']?.addEventListener('click', () => this.closePanel());
    this.el['panel-backdrop']?.addEventListener('click', () => this.closePanel());
    this.el['btn-sutra']?.addEventListener('click', () => this.openSutra());
    this.el['btn-quiet']?.addEventListener('click', () => this.openMeditateChoice());
    this.el['meditate-end']?.addEventListener('click', () => this.endMeditation(true));
    this.el['sutra-close']?.addEventListener('click', () => this.closeSutra());
    this.el['sutra-prev']?.addEventListener('click', () => this.sutraGo(-1));
    this.el['sutra-next']?.addEventListener('click', () => this.sutraGo(1));
    this.el['sutra-clear']?.addEventListener('click', () => this.clearInk());
    this.el['sutra-finish']?.addEventListener('click', () => this.finishSutra());
    this.el['chant-start']?.addEventListener('click', () => this.startChantSession());
    this.el['chant-cancel']?.addEventListener('click', () => this.cancelChant());
    this.el['chant-end']?.addEventListener('click', () => this.finishChant());
    this.el['chant-fish']?.addEventListener('click', () => this.knockChant());
    this.el['chant-voice']?.addEventListener('click', () => this.toggleChantVoice());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.el.chant?.hidden) { if (this.chantRunning) this.finishChant(); else this.cancelChant(); }
        else if (!this.el.sutra?.hidden) this.closeSutra();
        else if (this.panelOpen) this.closePanel();
        else if (!this.el.meditate?.hidden) this.endMeditation(true);
      }
    });
    window.addEventListener('resize', () => {
      if (!this.el.sutra?.hidden) this.resizeSutra();
    });
  }

  /* ---------- 开场 / 加载 ---------- */

  setLoading(text: string) {
    if (this.loadingHiding) return;
    if (this.el['loading-text']) this.el['loading-text'].textContent = text;
    if (this.el.loading) this.el.loading.hidden = false;
  }

  hideLoading() {
    const l = this.el.loading;
    if (!l) return;
    this.loadingHiding = true;
    l.classList.add('is-out');
    window.setTimeout(() => { l.hidden = true; }, 800);
  }

  showIntro() {
    if (this.el.intro) this.el.intro.hidden = false;
  }

  setVisit(n: number) {
    if (this.el['visit-count']) this.el['visit-count'].textContent = String(n);
  }

  setClock() {
    if (this.el['intro-clock']) this.el['intro-clock'].textContent = '山中 · 黄昏';
  }

  setIntroTime(label: string) {
    if (this.el['intro-clock']) this.el['intro-clock'].textContent = `山中 · ${label}`;
  }

  enterTemple() {
    this.el.intro?.classList.add('is-hidden');
    const hud = this.el.hud;
    if (hud) {
      hud.hidden = false;
      requestAnimationFrame(() => hud.classList.add('is-in'));
    }
  }

  syncSound(on: boolean) {
    this.voiceMuted = !on;
    if (this.chantRunning) {
      if (!on) {
        this.stopChantSpeech();
        this.startChantFallback();
      } else if (this.chantVoiceAvailable && this.chantVoiceOn) {
        window.clearInterval(this.chantLineTimer);
        this.speakChantLine();
      }
    }
    const label = on ? '声音开' : '声音关';
    document.querySelectorAll('.sound-toggle').forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      const l = b.querySelector('.sound-label');
      if (l) l.textContent = label;
    });
  }

  setTimeLabel(label: string) {
    if (this.el['tool-time-label']) this.el['tool-time-label'].textContent = label;
  }

  setPlace(name: string) {
    if (this.el['hud-place']) this.el['hud-place'].textContent = name;
  }

  setCaption(text: string) {
    if (this.el['hud-caption']) this.el['hud-caption'].textContent = text;
  }

  setPeople(n: number, online = true) {
    const el = this.el['hud-people'];
    if (!el) return;
    el.textContent = online ? `在线 ${n} 人` : `山中 ${n} 人`;
    el.title = '实时在线人数；院落里的行走者不计入';
  }

  setMerit(n: number) {
    this.merit = n;
    if (this.el['merit-value']) this.el['merit-value'].textContent = String(n);
  }

  bumpMerit(n = 1) {
    this.setMerit(this.merit + n);
    const v = this.el['merit-value'];
    if (v) {
      v.classList.remove('bump');
      void v.offsetWidth;
      v.classList.add('bump');
    }
  }

  showPrompt(label: string, hint: string) {
    if (!this.el.prompt) return;
    if (this.el['prompt-label']) this.el['prompt-label'].textContent = label;
    if (this.el['prompt-hint']) this.el['prompt-hint'].textContent = hint;
    this.el.prompt.hidden = false;
    const m = this.el['mobile-action'];
    const ml = this.el['mobile-action-label'];
    if (m) m.hidden = !this.isTouch();
    if (ml) ml.textContent = label;
  }

  hidePrompt() {
    if (this.el.prompt) this.el.prompt.hidden = true;
    const m = this.el['mobile-action'];
    if (m) m.hidden = true;
  }

  isTouch() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  toast(text: string, ms = 2600) {
    const t = this.el.toast;
    if (!t) return;
    window.clearTimeout(this.toastTimer);
    t.textContent = text;
    t.classList.add('is-on');
    this.toastTimer = window.setTimeout(() => t.classList.remove('is-on'), ms);
  }

  /* ---------- 面板 ---------- */

  openPanel(html: string) {
    if (!this.el.panels) return;
    this.el.toast?.classList.remove('is-on');
    this.lastFocus = document.activeElement as HTMLElement;
    this.sutraCloseGuard();
    if (this.el['panel-body']) this.el['panel-body'].innerHTML = html;
    this.el.panels.hidden = false;
    this.panelOpen = true;
    this.el['panel']?.scrollTo({ top: 0 });
    window.setTimeout(() => this.el['panel-close']?.focus({ preventScroll: true }), 30);
  }

  closePanel() {
    if (!this.el.panels) return;
    this.el.panels.hidden = true;
    this.panelOpen = false;
    if (this.el['panel-body']) this.el['panel-body'].innerHTML = '';
    this.lastFocus?.focus({ preventScroll: true });
  }

  private sutraCloseGuard() {
    // 面板与经卷不会同时出现
    if (this.el.sutra && !this.el.sutra.hidden) this.closeSutra();
  }

  get panelVisible() {
    return this.panelOpen;
  }

  get overlayOpen() {
    return this.panelOpen || !(this.el.sutra?.hidden ?? true) || !(this.el.meditate?.hidden ?? true) || !(this.el.chant?.hidden ?? true);
  }

  get chantOpen() {
    return !(this.el.chant?.hidden ?? true);
  }

  openZen(text: string, from: string) {
    this.openPanel(`
      <p class="panel-kicker">碑上旧话 · ${esc(from)}</p>
      <h2 class="panel-title" style="font-size:24px;line-height:1.9;letter-spacing:0.14em;margin-top:18px">${esc(text)}</h2>
      <p class="panel-lede" style="margin-top:24px">风把字磨浅了，意思还在。站一会儿，再走。</p>
      <div class="panel-sep">空山</div>
      <div class="about-note">这是一块可以反复读的碑。读完了，山还是那座山。</div>
    `);
  }

  openWishNote(text: string, from: string) {
    this.openPanel(`
      <p class="panel-kicker">${esc(from)} · 一个陌生人的心愿</p>
      <h2 class="panel-title" style="font-size:22px;line-height:2;letter-spacing:0.08em;font-weight:400;margin-top:20px">“${esc(text)}”</h2>
      <p class="panel-lede" style="margin-top:22px">写这句话的人已经走了。你读到了，它就不算落空。</p>
      <div class="panel-sep">山中</div>
      <p class="form-note">愿望留在这台设备里。若你也想留一句，可以去香炉前，或者银杏树下。</p>
    `);
  }

  /* ---------- 上香 ---------- */

  openIncense(initialWish = '') {
    this.openPanel(`
      <p class="panel-kicker">香炉前 · 香已点燃</p>
      <h2 class="panel-title">留一句话</h2>
      <p class="panel-lede">香已经插进炉里了。想说什么，就写在这里；不写也很好，烟会替你待一会儿。</p>
      <div class="panel-sep">香炉前</div>
      <form id="incense-form">
        <div class="field">
          <label class="field-label" for="incense-text"><span>心里的话（可不写）</span><span class="count"><span id="incense-count">0</span> / 40</span></label>
          <textarea id="incense-text" class="textarea" maxlength="40" rows="3" placeholder="例如：愿家里人都平安，愿我今晚睡个好觉。">${esc(initialWish)}</textarea>
        </div>
        <div class="form-foot">
          <p class="form-note">写下的字只保存在你的浏览器里，不会上传。香已经点过了，不必再点。</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn-ghost" id="incense-silent">不必了</button>
            <button type="submit" class="btn-primary">留下这句话</button>
          </div>
        </div>
      </form>
    `);
    const input = document.getElementById('incense-text') as HTMLTextAreaElement | null;
    const count = document.getElementById('incense-count');
    input?.addEventListener('input', () => { if (count) count.textContent = String(input.value.length); });
    setTimeout(() => {
      this.el.panel?.scrollTo({ top: 0 });
      input?.focus({ preventScroll: true });
    }, 120);
    document.getElementById('incense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (input?.value ?? '').trim();
      this.closePanel();
      this.h.onIncense(text);
    });
    document.getElementById('incense-silent')?.addEventListener('click', () => {
      this.closePanel();
    });
  }

  /* ---------- 供灯 / 红绸 ---------- */

  openLantern() {
    const colors = LANTERN_COLORS.map((c, i) => `
      <button type="button" class="choice" data-color="${c.id}" aria-pressed="${i === 0}">
        <span class="choice-dot" style="color:${c.glow};background:${c.color}"></span>${c.name}
      </button>`).join('');
    this.openPanel(`
      <p class="panel-kicker">放生池 · 莲灯</p>
      <h2 class="panel-title">放一盏灯</h2>
      <p class="panel-lede">池水很静，灯会替你漂一会儿。可以写一个名字，也可以只写一句话。</p>
      <div class="panel-sep">选一盏</div>
      <div class="choice-row" id="lantern-colors">${colors}</div>
      <form id="lantern-form">
        <div class="field">
          <label class="field-label" for="lantern-text"><span>灯上的字（可不写）</span><span class="count"><span id="lantern-count">0</span> / 40</span></label>
          <textarea id="lantern-text" class="textarea" maxlength="40" rows="3" placeholder="例如：愿所有走夜路的人，都能看见灯。"></textarea>
        </div>
        <div class="form-foot">
          <p class="form-note">灯与字只留在这台设备的浏览器里。给别人的祝福，也先留给自己看。</p>
          <button type="submit" class="btn-primary">放进池里</button>
        </div>
      </form>
    `);
    let color = LANTERN_COLORS[0].id;
    document.querySelectorAll<HTMLElement>('#lantern-colors .choice').forEach((b) => {
      b.addEventListener('click', () => {
        color = b.dataset.color ?? 'gold';
        document.querySelectorAll('#lantern-colors .choice').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      });
    });
    const input = document.getElementById('lantern-text') as HTMLTextAreaElement | null;
    const count = document.getElementById('lantern-count');
    input?.addEventListener('input', () => { if (count) count.textContent = String(input.value.length); });
    document.getElementById('lantern-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (input?.value ?? '').trim();
      this.closePanel();
      this.h.onLantern(text, color);
    });
  }

  openRibbon() {
    this.openPanel(`
      <p class="panel-kicker">银杏树下 · 红绸</p>
      <h2 class="panel-title">系一条红绸</h2>
      <p class="panel-lede">老银杏见过很多个秋天。把一句话系在低一些的枝上，风吹过的时候，它会替你念一遍。</p>
      <form id="ribbon-form">
        <div class="field">
          <label class="field-label" for="ribbon-text"><span>红绸上的字</span><span class="count"><span id="ribbon-count">0</span> / 30</span></label>
          <input id="ribbon-text" class="input" maxlength="30" placeholder="例如：愿此去前程似锦" />
        </div>
        <div class="form-foot">
          <p class="form-note">红绸会系在树冠低处。写下的字只保存在你的浏览器里。</p>
          <button type="submit" class="btn-primary">系上</button>
        </div>
      </form>
    `);
    const input = document.getElementById('ribbon-text') as HTMLInputElement | null;
    const count = document.getElementById('ribbon-count');
    input?.addEventListener('input', () => { if (count) count.textContent = String(input.value.length); });
    input?.focus({ preventScroll: true });
    document.getElementById('ribbon-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (input?.value ?? '').trim();
      if (!text) { this.toast('写一句话再系上吧'); return; }
      this.closePanel();
      this.h.onRibbon(text);
    });
  }

  /* ---------- 心愿墙 ---------- */

  openWishes(wishes: WishView[]) {
    const items = wishes.map((w) => {
      const color = LANTERN_COLORS.find((c) => c.id === w.color)?.glow ?? '#d8c8a0';
      return `<div class="wish-item${w.mine ? ' is-mine' : ''}">
        <span class="wish-dot" style="background:${color};color:${color}"></span>
        <div class="wish-body"><span>${esc(w.text)}</span><span class="wish-meta">${w.mine ? '我 · ' : ''}${esc(w.ago)}</span></div>
      </div>`;
    }).join('');
    this.openPanel(`
      <p class="panel-kicker">山中留言 · 无声</p>
      <h2 class="panel-title">心愿</h2>
      <p class="panel-lede">这里没有回复，也没有点赞。写下的人已经走了，你只是恰好路过。</p>
      <div class="wish-grid">${items || '<p class="wish-empty">还没有人留下什么。</p>'}</div>
      <div class="form-foot">
        <p class="form-note">其中一部分是山里常住留下的旧愿，另一部分是你自己写下的。所有内容都只存在这台设备上。</p>
        <button class="btn-ghost" id="wishes-to-incense" type="button">去上香</button>
      </div>
    `);
    document.getElementById('wishes-to-incense')?.addEventListener('click', () => {
      this.closePanel();
      this.h.onTeleport('incense');
    });
  }

  /* ---------- 求签 ---------- */

  openSign(previous: Sign | null, canDraw: boolean) {
    this.openPanel(`
      <p class="panel-kicker">观音灵签 · 一日一签</p>
      <h2 class="panel-title">求签</h2>
      <p class="panel-lede">不是问吉凶，只是借一段旧话，照一照此刻的心。摇签之前，先在心里把问题说清楚。</p>
      <div id="sign-stage" class="sign-stage">
        <div class="tube-wrap">
          <div class="tube" id="sign-tube">
            <div class="tube-sticks"></div>
            <span class="tube-label">观音灵签</span>
            <span class="stick-out" id="sign-stick"></span>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:26px;align-items:center">
          ${canDraw
            ? '<button class="btn-primary" id="sign-draw" type="button">摇一支签</button>'
            : '<button class="btn-primary" id="sign-read" type="button">读今日的签</button>'}
          <span style="font-size:9px;letter-spacing:0.12em;color:var(--muted)">静一点，再摇</span>
        </div>
        <div id="sign-result"></div>
      </div>
    `);
    const draw = document.getElementById('sign-draw');
    const read = document.getElementById('sign-read');
    const tube = document.getElementById('sign-tube');
    const stick = document.getElementById('sign-stick');
    const result = document.getElementById('sign-result');

    const reveal = (sign: Sign) => {
      if (!result) return;
      tube?.classList.remove('shaking');
      stick?.classList.add('is-out');
      window.setTimeout(() => {
        if (!this.el['panel-body']) return;
        this.el['panel-body'].innerHTML = `
          <p class="panel-kicker">观音灵签 · 一日一签</p>
          <h2 class="panel-title">今日一签</h2>
          <p class="panel-lede">摇签已毕。签文是一面镜子，不必急着信，也不必急着不信。</p>
          <div class="panel-sep">第 ${sign.n} 签</div>
          ${this.signHTML(sign)}
        `;
        this.bindSignKeep();
        this.el.panel?.scrollTo({ top: 0 });
      }, 380);
    };

    if (read && previous) {
      read.addEventListener('click', () => reveal(previous));
    }
    if (draw) {
      draw.addEventListener('click', () => {
        if (!tube) return;
        tube.classList.add('shaking');
        (draw as HTMLButtonElement).disabled = true;
        window.setTimeout(() => {
          const sign = this.h.onSign();
          reveal(sign);
        }, 1600);
      });
    }
  }

  signHTML(s: Sign) {
    const lvlColor = s.level === '上签' ? 'var(--gold)' : s.level === '下签' ? 'var(--pine)' : 'var(--ink-soft)';
    return `<div class="sign-result">
      <div class="sign-head">
        <div class="sign-number"><span>${s.n}</span><small>第 ${s.n} 签</small></div>
        <div>
          <h3 class="sign-title">${s.level} · ${s.keyword}</h3>
          <p class="sign-sub">${s.palace} · 【${s.ancient}】</p>
        </div>
        <div style="margin-left:auto;color:${lvlColor};font-family:var(--serif);font-size:10px;letter-spacing:0.2em">观<br/>音<br/>灵<br/>签</div>
      </div>
      <div class="sign-poem">${s.poem.map((p) => `<span>${p}</span>`).join('')}</div>
      <div class="sign-note">${s.note}</div>
      <p class="sign-reading">${s.reading}</p>
      <div class="sign-taken">
        <span class="form-note">签文只是一面镜子。今天怎么过，还是你说了算。</span>
        <button class="btn-small" id="sign-keep" type="button">收进衣袋</button>
      </div>
      <span class="sign-keyword">${s.keyword}</span>
    </div>`;
  }

  bindSignKeep() {
    document.getElementById('sign-keep')?.addEventListener('click', () => this.closePanel());
  }

  /* ---------- 静坐 ---------- */

  openMeditateChoice() {
    this.openPanel(`
      <p class="panel-kicker">禅堂 · 静坐</p>
      <h2 class="panel-title">坐一会儿</h2>
      <p class="panel-lede">不用盘腿，也不用闭眼。把肩放下来，跟着呼吸就好。坐不住的时候，随时可以起身。</p>
      <div class="panel-sep">坐多久</div>
      <div class="choice-row" id="meditate-choices">
        <button type="button" class="choice" data-min="3"><span class="choice-seal">三</span>三分钟</button>
        <button type="button" class="choice" data-min="5"><span class="choice-seal">五</span>五分钟</button>
        <button type="button" class="choice" data-min="10"><span class="choice-seal">十</span>十分钟</button>
        <button type="button" class="choice" data-min="20"><span class="choice-seal">廿</span>二十分钟</button>
      </div>
      <div class="form-foot">
        <p class="form-note">开始后，山里会替你安静下来。功德不是目的，只是坐过的痕迹。</p>
      </div>
    `);
    document.querySelectorAll<HTMLElement>('#meditate-choices .choice').forEach((b) => {
      b.addEventListener('click', () => {
        const min = Number(b.dataset.min ?? 3);
        this.closePanel();
        this.startMeditation(min);
      });
    });
  }

  startMeditation(minutes: number) {
    document.body.classList.add('meditating');
    this.medMinutes = minutes;
    this.medStart = performance.now();
    this.medEnd = this.medStart + minutes * 60_000;
    this.el.meditate.hidden = false;
    this.el.meditate.classList.remove('is-out');
    this.updateMedTimer();
    this.breathCycle(0);
    this.medTimer = window.setInterval(() => this.updateMedTimer(), 500);
    this.h.onMeditateStart(minutes);
  }

  private breathCycle(start: number) {
    if (!this.el['breath-text']) return;
    const texts = ['吸气', '呼气'];
    let i = 0;
    this.el['breath-text'].textContent = texts[0];
    window.clearInterval(this.breathTimer);
    this.breathTimer = window.setInterval(() => {
      i = (i + 1) % 2;
      if (this.el['breath-text']) this.el['breath-text'].textContent = texts[i];
    }, 5000);
    void start;
  }

  private updateMedTimer() {
    const remain = Math.max(0, this.medEnd - performance.now());
    const totalSec = Math.ceil(remain / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    if (this.el['meditate-time']) this.el['meditate-time'].textContent = `${mm}:${ss}`;
    if (remain <= 0) this.endMeditation(false);
  }

  endMeditation(early: boolean) {
    if (this.el.meditate.hidden) return;
    document.body.classList.remove('meditating');
    window.clearInterval(this.medTimer);
    window.clearInterval(this.breathTimer);
    const elapsed = (performance.now() - this.medStart) / 1000;
    this.el.meditate.classList.add('is-out');
    window.setTimeout(() => {
      this.el.meditate.hidden = true;
      this.el.meditate.classList.remove('is-out');
    }, 800);
    this.h.onMeditateEnd(early ? Math.round(elapsed / 60) : this.medMinutes, elapsed);
  }

  /* ---------- 抄经 ---------- */

  openSutra() {
    this.el.sutra.hidden = false;
    this.sutraLines = [];
    this.sutraIndex = 0;
    this.sutraDrawn = 0;
    this.setupSutra();
    window.setTimeout(() => this.resizeSutra(), 30);
  }

  private setupSutra() {
    const full = '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。舍利子，色不异空，空不异色，色即是空，空即是色，受想行识，亦复如是。舍利子，是诸法空相，不生不灭，不垢不净，不增不减。是故空中无色，无受想行识，无眼耳鼻舌身意，无色声香味触法，无眼界，乃至无意识界。无无明，亦无无明尽，乃至无老死，亦无老死尽。无苦集灭道，无智亦无得。以无所得故，菩提萨埵，依般若波罗蜜多故，心无挂碍，无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。三世诸佛，依般若波罗蜜多故，得阿耨多罗三藐三菩提。故知般若波罗蜜多，是大神咒，是大明咒，是无上咒，是无等等咒，能除一切苦，真实不虚。故说般若波罗蜜多咒，即说咒曰：揭谛揭谛，波罗揭谛，波罗僧揭谛，菩提萨婆诃。';
    // 去掉标点，按每行 14 字排版
    const chars = [...full.replace(/[，。：；、]/g, '')];
    for (let i = 0; i < chars.length; i += 14) this.sutraLines.push(chars.slice(i, i + 14).join(''));
    this.updateSutraLabel();
    if (this.sutraWired) return;
    this.sutraWired = true;
    const ink = this.el['sutra-ink'] as HTMLCanvasElement;
    const guide = this.el['sutra-guide'] as HTMLCanvasElement;
    this.sutraCtx = ink.getContext('2d');
    this.sutraGuideCtx = guide.getContext('2d');
    const pos = (e: PointerEvent) => {
      const r = ink.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (ink.width / r.width), y: (e.clientY - r.top) * (ink.height / r.height) };
    };
    ink.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ink.setPointerCapture(e.pointerId);
      this.drawing = true;
      this.lastPoint = pos(e);
      this.strokeLen = 0;
      this.drawDot(this.lastPoint.x, this.lastPoint.y);
    });
    ink.addEventListener('pointermove', (e) => {
      if (!this.drawing || !this.sutraCtx || !this.lastPoint) return;
      const p = pos(e);
      const d = Math.hypot(p.x - this.lastPoint.x, p.y - this.lastPoint.y);
      this.strokeLen += d;
      const w = Math.max(3, 11 - Math.min(8, d * 0.22));
      this.sutraCtx.strokeStyle = 'rgba(38,34,26,0.86)';
      this.sutraCtx.lineWidth = w;
      this.sutraCtx.lineCap = 'round';
      this.sutraCtx.lineJoin = 'round';
      this.sutraCtx.beginPath();
      this.sutraCtx.moveTo(this.lastPoint.x, this.lastPoint.y);
      this.sutraCtx.lineTo(p.x, p.y);
      this.sutraCtx.stroke();
      this.lastPoint = p;
      this.sutraDrawn = Math.max(this.sutraDrawn, this.strokeLen);
    });
    const end = (e: PointerEvent) => {
      this.drawing = false;
      this.lastPoint = null;
      try { ink.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    ink.addEventListener('pointerup', end);
    ink.addEventListener('pointercancel', end);
    ink.addEventListener('pointerleave', () => { this.drawing = false; this.lastPoint = null; });
  }

  private drawDot(x: number, y: number) {
    if (!this.sutraCtx) return;
    this.sutraCtx.fillStyle = 'rgba(38,34,26,0.86)';
    this.sutraCtx.beginPath();
    this.sutraCtx.arc(x, y, 3.2, 0, Math.PI * 2);
    this.sutraCtx.fill();
  }

  private resizeSutra() {
    const ink = this.el['sutra-ink'] as HTMLCanvasElement;
    const guide = this.el['sutra-guide'] as HTMLCanvasElement;
    if (!ink || !guide) return;
    const rect = ink.parentElement!.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [ink, guide]) {
      c.width = Math.max(300, Math.floor(rect.width * dpr));
      c.height = Math.max(200, Math.floor(rect.height * dpr));
    }
    this.sutraCtx = ink.getContext('2d');
    this.sutraGuideCtx = guide.getContext('2d');
    this.clearInk();
    this.renderGuide();
  }

  private renderGuide() {
    const ctx = this.sutraGuideCtx;
    const c = this.el['sutra-guide'] as HTMLCanvasElement;
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const line = this.sutraLines[this.sutraIndex] ?? '';
    if (!line) return;
    const dpr = c.width / (c.getBoundingClientRect().width || c.width);
    const padX = 18 * dpr;
    const usable = c.width - padX * 2;
    const cell = usable / 14;
    const size = Math.min(cell * 0.78, c.height * 0.46);
    ctx.font = `${size}px "Kaiti SC", "KaiTi", "Songti SC", "STKaiti", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(62,52,36,0.16)';
    for (let i = 0; i < 14; i++) {
      const ch = line[i] ?? '';
      if (!ch) continue;
      const x = padX + cell * (i + 0.5);
      const y = c.height * 0.5;
      // 米字格
      if (i % 2 === 0) {
        ctx.strokeStyle = 'rgba(120,102,72,0.09)';
        ctx.lineWidth = 1 * dpr;
        ctx.strokeRect(x - cell * 0.46, y - cell * 0.5, cell * 0.92, cell * 0.98);
      }
      ctx.fillStyle = 'rgba(62,52,36,0.17)';
      ctx.fillText(ch, x, y);
    }
    // 竖线提示
    ctx.strokeStyle = 'rgba(120,102,72,0.06)';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(padX, c.height * 0.08, usable, c.height * 0.84);
  }

  private clearInk() {
    const ink = this.el['sutra-ink'] as HTMLCanvasElement;
    if (!ink || !this.sutraCtx) return;
    this.sutraCtx.clearRect(0, 0, ink.width, ink.height);
    this.sutraDrawn = 0;
  }

  private updateSutraLabel() {
    const l = this.el['sutra-line-label'];
    if (l) l.textContent = `第 ${this.sutraIndex + 1} 行 · 共 ${this.sutraLines.length} 行`;
  }

  private sutraGo(dir: number) {
    const next = this.sutraIndex + dir;
    if (next < 0) { this.toast('已经是第一行了'); return; }
    if (next >= this.sutraLines.length) { this.toast('已经写到经尾了，可以回向。'); return; }
    this.sutraIndex = next;
    this.clearInk();
    this.renderGuide();
    this.updateSutraLabel();
  }

  private finishSutra() {
    this.h.onSutraDone(this.sutraIndex + 1);
    this.closeSutra(true);
    this.toast('愿以此功德，回向给此刻的你', 3600);
  }

  closeSutra(silent = false) {
    if (this.el.sutra.hidden) return;
    this.el.sutra.hidden = true;
    this.clearInk();
    if (!silent) this.h.onSutraClose(this.sutraIndex + 1);
  }

  /* ---------- 诵经 ---------- */

  openChantSetup() {
    this.chantRunning = false;
    this.chantMinutes = 15;
    this.chantSutra = SUTRAS[0];
    this.chantKnocks = 0;
    this.el.chant.hidden = false;
    this.el['chant-setup'].hidden = false;
    this.el['chant-session'].hidden = true;
    document.body.classList.add('chanting');
    this.renderChantSetup();
    this.updateChantVoiceButton();
  }

  private renderChantSetup() {
    if (this.el['chant-sutras']) {
      this.el['chant-sutras'].innerHTML = SUTRAS.map((s) => `
        <button class="chant-sutra" type="button" data-sutra="${s.id}" aria-pressed="${s.id === this.chantSutra.id}">
          <b>${esc(s.short)}</b><span>${esc(s.name)}</span>
        </button>`).join('');
      this.el['chant-sutras'].querySelectorAll<HTMLElement>('[data-sutra]').forEach((b) => {
        b.addEventListener('click', () => {
          const found = SUTRAS.find((x) => x.id === b.dataset.sutra);
          if (!found) return;
          this.chantSutra = found;
          this.el['chant-sutras'].querySelectorAll('[data-sutra]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        });
      });
    }
    if (this.el['chant-durations']) {
      this.el['chant-durations'].innerHTML = [5, 15, 30].map((m) => `
        <button type="button" data-min="${m}" aria-pressed="${m === this.chantMinutes}">${m} 分钟</button>`).join('');
      this.el['chant-durations'].querySelectorAll<HTMLElement>('[data-min]').forEach((b) => {
        b.addEventListener('click', () => {
          this.chantMinutes = Number(b.dataset.min) || 15;
          this.el['chant-durations'].querySelectorAll('[data-min]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        });
      });
    }
  }

  startChantSession() {
    if (this.chantRunning) return;
    this.chantRunning = true;
    this.el['chant-setup'].hidden = true;
    this.el['chant-session'].hidden = false;
    this.chantKnocks = 0;
    this.chantLineIndex = 0;
    this.chantTotal = this.chantMinutes * 60;
    this.chantStartAt = performance.now();
    if (this.el['chant-name']) this.el['chant-name'].textContent = this.chantSutra.name;
    if (this.el['chant-knocks']) this.el['chant-knocks'].textContent = '已敲 0 声';
    this.updateChantLine();
    this.updateChantClock();
    this.h.onChantStart(this.chantSutra.id, this.chantMinutes);
    window.clearInterval(this.chantTimer);
    window.clearInterval(this.chantKnockTimer);
    window.clearInterval(this.chantLineTimer);
    this.stopChantSpeech();
    this.updateChantVoiceButton();
    this.chantTimer = window.setInterval(() => this.updateChantClock(), 250);
    this.chantKnockTimer = window.setInterval(() => this.knockChant(), 4200);
    if (this.chantVoiceAvailable && this.chantVoiceOn && !this.voiceMuted) {
      this.speakChantLine();
    } else {
      this.startChantFallback();
    }
    window.setTimeout(() => { if (this.chantRunning) this.knockChant(); }, 1400);
  }

  private updateChantLine() {
    const lines = this.chantSutra.lines;
    if (!lines.length) return;
    const line = lines[this.chantLineIndex % lines.length];
    this.chantLineIndex += 1;
    if (this.el['chant-line']) this.el['chant-line'].textContent = line;
  }

  private updateChantVoiceButton() {
    const b = this.el['chant-voice'];
    if (!b) return;
    b.hidden = !this.chantVoiceAvailable;
    b.textContent = this.chantVoiceOn ? '人声 · 开' : '人声 · 关';
    b.setAttribute('aria-pressed', String(this.chantVoiceOn));
    b.title = this.chantVoiceAvailable ? '用浏览器自带中文语音朗读经文' : '此浏览器不支持语音合成';
  }

  private startChantFallback() {
    window.clearInterval(this.chantLineTimer);
    this.chantLineTimer = window.setInterval(() => this.updateChantLine(), 16000);
  }

  private stopChantSpeech() {
    this.chantSpeechSeq += 1;
    window.clearTimeout(this.chantVoiceTimer);
    window.clearTimeout(this.chantSpeechWatchdog);
    this.chantVoiceTimer = 0;
    this.chantSpeechWatchdog = 0;
    if (this.chantVoiceAvailable) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
  }

  private speakChantLine() {
    if (!this.chantRunning || !this.chantVoiceAvailable || !this.chantVoiceOn || this.voiceMuted) return;
    const text = (this.el['chant-line']?.textContent || '').trim();
    if (!text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const seq = ++this.chantSpeechSeq;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    const voices = synth.getVoices();
    const zh = voices.find((v) => /^zh/i.test(v.lang)) || voices.find((v) => /Chinese|中文|普通话|Ting|Mei|Sin/i.test(v.name));
    if (zh) utterance.voice = zh;
    utterance.onend = () => {
      window.clearTimeout(this.chantSpeechWatchdog);
      if (seq !== this.chantSpeechSeq || !this.chantRunning || !this.chantVoiceOn || this.voiceMuted) return;
      this.updateChantLine();
      this.chantVoiceTimer = window.setTimeout(() => this.speakChantLine(), 1500);
    };
    utterance.onerror = () => {
      window.clearTimeout(this.chantSpeechWatchdog);
      if (seq !== this.chantSpeechSeq || !this.chantRunning) return;
      this.chantVoiceTimer = window.setTimeout(() => {
        if (!this.chantRunning) return;
        this.updateChantLine();
        this.speakChantLine();
      }, 2500);
    };
    synth.speak(utterance);
    window.clearTimeout(this.chantSpeechWatchdog);
    this.chantSpeechWatchdog = window.setTimeout(() => {
      if (seq !== this.chantSpeechSeq || !this.chantRunning || !this.chantVoiceOn || this.voiceMuted) return;
      if (synth.speaking) return;
      this.updateChantLine();
      this.speakChantLine();
    }, Math.max(9000, text.length * 420 + 3000));
  }

  toggleChantVoice() {
    if (!this.chantVoiceAvailable) return;
    this.chantVoiceOn = !this.chantVoiceOn;
    this.updateChantVoiceButton();
    if (!this.chantRunning) return;
    if (this.chantVoiceOn && !this.voiceMuted) {
      window.clearInterval(this.chantLineTimer);
      this.stopChantSpeech();
      this.speakChantLine();
    } else {
      this.stopChantSpeech();
      this.startChantFallback();
    }
  }

  private updateChantClock() {
    if (!this.chantRunning) return;
    const elapsed = (performance.now() - this.chantStartAt) / 1000;
    const remain = Math.max(0, this.chantTotal - elapsed);
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(Math.floor(remain % 60)).padStart(2, '0');
    if (this.el['chant-timer']) this.el['chant-timer'].textContent = `${mm}:${ss}`;
    if (this.el['chant-bar']) this.el['chant-bar'].style.width = `${Math.min(100, (elapsed / this.chantTotal) * 100)}%`;
    if (remain <= 0) this.endChantSession(true);
  }

  knockChant() {
    if (!this.chantRunning) return;
    this.chantKnocks += 1;
    this.h.onChantKnock(this.chantKnocks);
    if (this.el['chant-knocks']) this.el['chant-knocks'].textContent = `已敲 ${this.chantKnocks} 声`;
    const fish = this.el['chant-fish'];
    if (fish) {
      fish.classList.remove('is-knock');
      void fish.offsetWidth;
      fish.classList.add('is-knock');
    }
  }

  finishChant() {
    this.endChantSession(false);
  }

  private endChantSession(completed: boolean) {
    if (!this.chantRunning) return;
    const elapsed = (performance.now() - this.chantStartAt) / 1000;
    const minutes = this.chantMinutes;
    const knocks = this.chantKnocks;
    this.chantRunning = false;
    window.clearInterval(this.chantTimer);
    window.clearInterval(this.chantKnockTimer);
    window.clearInterval(this.chantLineTimer);
    this.stopChantSpeech();
    this.el.chant.hidden = true;
    document.body.classList.remove('chanting');
    this.h.onChantEnd(minutes, knocks, elapsed, completed);
  }

  cancelChant() {
    if (this.chantRunning) {
      this.endChantSession(false);
      return;
    }
    this.el.chant.hidden = true;
    document.body.classList.remove('chanting');
    this.h.onChantCancel();
  }

  /* ---------- 导览 ---------- */

  openNav() {
    const activities = [
      ['incense', '香', '上香', '香炉'],
      ['bow', '拜', '礼佛', '大殿'],
      ['muyu', '鱼', '木鱼', '大殿前'],
      ['bell', '钟', '撞钟', '钟楼'],
      ['drum', '鼓', '击鼓', '鼓楼'],
      ['sign', '签', '求签', '藏经阁前'],
      ['sutra', '经', '抄经', '经桌'],
      ['lantern', '灯', '放灯', '放生池'],
      ['ribbon', '绸', '系绸', '银杏树'],
      ['chant', '诵', '诵经', '大殿蒲团'],
      ['quiet', '坐', '静坐', '大殿'],
    ];
    const list = activities.map(([id, glyph, name, hint]) => `
      <button class="map-item" data-go="${id}" type="button">
        <span class="map-glyph">${glyph}</span>
        <span class="map-item-name">${name}</span>
        <span class="map-item-hint">${hint}</span>
      </button>`).join('');
    this.openPanel(`
      <p class="panel-kicker">山中路径 · 十二处</p>
      <h2 class="panel-title">导览</h2>
      <p class="panel-lede">不必按顺序走。想去哪里，点一下，山会把你送到附近。</p>
      <div class="map-wrap">
        <div class="map-figure">${this.mapSVG()}</div>
        <div class="map-list">${list}</div>
      </div>
      <div class="about-note">走累了，随时可以回山门。所有地方都不会上锁。</div>
    `);
    document.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.go!;
        this.closePanel();
        this.h.onTeleport(id);
      });
    });
  }

  private mapSVG() {
    const px = (x: number) => 168 + x * 3.4;
    const py = (z: number) => 190 - (z - 4) * 2.9;
    return `<svg viewBox="0 0 340 360" role="img" aria-label="空山平面图">
      <rect x="0" y="0" width="340" height="360" fill="#efe7d6"/>
      <rect x="6" y="6" width="328" height="348" fill="none" stroke="rgba(60,55,40,0.16)"/>
      <path d="M${px(0)} ${py(55)} L${px(0)} ${py(42)} L${px(0)} ${py(22)} L${px(0)} ${py(9)} L${px(0)} ${py(-4)} L${px(0)} ${py(-23)}" stroke="#c9bda2" stroke-width="7" fill="none"/>
      <path d="M${px(-12)} ${py(6)} L${px(-15)} ${py(-2)} L${px(-15)} ${py(-26)} L${px(-7)} ${py(-29)}" stroke="#c9bda2" stroke-width="4" fill="none"/>
      <path d="M${px(12)} ${py(6)} L${px(15)} ${py(-2)} L${px(15)} ${py(-26)} L${px(7)} ${py(-29)}" stroke="#c9bda2" stroke-width="4" fill="none"/>
      <path d="M${px(15)} ${py(-8)} L${px(23)} ${py(-18)} L${px(26)} ${py(-24)}" stroke="#c9bda2" stroke-width="3" stroke-dasharray="3 3" fill="none"/>
      <ellipse cx="${px(0)}" cy="${py(15)}" rx="42" ry="21" fill="#a9c1b5" stroke="#6f8a7d" stroke-width="1"/>
      <path d="M${px(0)} ${py(23)} L${px(0)} ${py(7)}" stroke="#c9bda2" stroke-width="6"/>
      <text x="${px(0)}" y="${py(15)}" text-anchor="middle" font-size="8" fill="#3c5a4d" font-family="serif">放生池</text>
      <rect x="${px(-10)}" y="${py(46)}" width="20" height="72" fill="#b8765c" stroke="#6c4032" stroke-width="1"/>
      <text x="${px(0)}" y="${py(53)}" text-anchor="middle" font-size="9" fill="#fff2dc" font-family="serif">山门</text>
      <rect x="${px(-13)}" y="${py(10)}" width="26" height="22" fill="none" stroke="#8a7d63" stroke-width="1"/>
      <rect x="${px(-10)}" y="${py(8)}" width="20" height="18" fill="#d9cbb2" stroke="#7d6f55" stroke-width="1"/>
      <text x="${px(0)}" y="${py(-2)}" text-anchor="middle" font-size="9" fill="#3a3426" font-family="serif">大雄宝殿</text>
      <rect x="${px(-17)}" y="${py(11)}" width="18" height="18" fill="#c9bda2" stroke="#7d6f55" stroke-width="1"/>
      <text x="${px(-12)}" y="${py(13)}" text-anchor="middle" font-size="7.5" fill="#4a4130" font-family="serif">钟楼</text>
      <rect x="${px(7)}" y="${py(11)}" width="18" height="18" fill="#c9bda2" stroke="#7d6f55" stroke-width="1"/>
      <text x="${px(12)}" y="${py(13)}" text-anchor="middle" font-size="7.5" fill="#4a4130" font-family="serif">鼓楼</text>
      <rect x="${px(-8)}" y="${py(-31)}" width="58" height="20" fill="#c9bda2" stroke="#7d6f55" stroke-width="1"/>
      <text x="${px(0)}" y="${py(-20)}" text-anchor="middle" font-size="8" fill="#4a4130" font-family="serif">藏经阁</text>
      <circle cx="${px(27)}" cy="${py(-24)}" r="8" fill="#c9bda2" stroke="#7d6f55" stroke-width="1"/>
      <path d="M${px(27)} ${py(-31)} l7 12 h-14 z" fill="#a99b80" stroke="#7d6f55" stroke-width="0.8"/>
      <text x="${px(27)}" y="${py(-23)}" text-anchor="middle" font-size="6.5" fill="#4a4130" font-family="serif">塔</text>
      <circle cx="${px(-13)}" cy="${py(20)}" r="6" fill="#b9a44e" stroke="#8d7c35" stroke-width="0.8"/>
      <text x="${px(-13)}" y="${py(30)}" text-anchor="middle" font-size="7" fill="#5b4c22" font-family="serif">银杏</text>
      <circle cx="${px(9)}" cy="${py(8)}" r="2.6" fill="#7d7563"/>
      <text x="${px(9)}" y="${py(3)}" text-anchor="middle" font-size="6.5" fill="#5c5545" font-family="serif">碑</text>
      <text x="${px(0)}" y="${py(-38)}" text-anchor="middle" font-size="7" fill="#8a8574" font-family="serif">后山</text>
      <g transform="translate(300,332)" opacity="0.55">
        <path d="M0 -12 L5 6 L0 2 L-5 6 Z" fill="#5c5545"/>
        <text x="0" y="18" text-anchor="middle" font-size="7" fill="#5c5545" font-family="serif">北</text>
      </g>
    </svg>`;
  }

  /* ---------- 更多 / 设置 / 关于 ---------- */

  openMore() {
    this.openPanel(`
      <p class="panel-kicker">空山</p>
      <h2 class="panel-title">山中</h2>
      <p class="panel-lede">${esc(UI.aboutIntro())}</p>
      <div class="panel-sep">可以做</div>
      <div class="about-cols">
        <div>
          <h3 class="about-h">操作</h3>
          <ul class="about-list">
            <li><b>行走</b>W A S D / 方向键，或点击地面</li>
            <li><b>环顾</b>拖动画面；滚轮或双指缩放</li>
            <li><b>参拜</b>走近后按 E，或点提示</li>
            <li><b>导览</b>M 打开山中路径</li>
            <li><b>心愿</b>H 看看别人留下了什么</li>
            <li><b>静坐</b>Q；抄经 J；诵经 走近蒲团</li>
            <li><b>回山门</b>R（卡住时的退路）</li>
          </ul>
        </div>
        <div>
          <h3 class="about-h">这座山</h3>
          <p class="about-p">空山是一间可以随时走进来的数字寺院。没有注册，没有聊天，没有排行榜。</p>
          <p class="about-p">香、灯、红绸、签文都只保存在你的浏览器里。山里的其他身影，是常住与过客。</p>
        </div>
      </div>
      <div class="setting-actions">
        <button class="btn-ghost" id="more-settings" type="button">设置</button>
        <button class="btn-ghost" id="more-about" type="button">关于空山</button>
        <button class="btn-ghost" id="more-nav" type="button">寺院导览</button>
        <button class="btn-ghost" id="more-home" type="button">回山门</button>
      </div>
      <div class="about-note">${esc(UI.disclaimer())}</div>
    `);
    document.getElementById('more-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('more-about')?.addEventListener('click', () => this.openAbout());
    document.getElementById('more-nav')?.addEventListener('click', () => this.openNav());
    document.getElementById('more-home')?.addEventListener('click', () => { this.closePanel(); this.h.onTeleport('gate'); });
  }

  openAbout() {
    this.openPanel(`
      <p class="panel-kicker">关于 · 空山</p>
      <h2 class="panel-title">山中何所有</h2>
      <p class="panel-lede">“空山不见人，但闻人语响。”山不是空的，只是人声退得很远。</p>
      <div class="panel-sep">缘起</div>
      <div class="about-cols">
        <div>
          <p class="about-p">空山是一个独立完成的数字寺院实验。它想做的不是复原一座具体的古刹，而是把中国寺院里那些很轻的动作——上香、合掌、敲木鱼、系一条红绸——搬到一块发光的屏幕上。</p>
          <p class="about-p">院子里有钟楼、鼓楼、放生池、藏经阁和一座七层塔。你可以走进去，也可以什么都不做，只在银杏树下站一会儿。</p>
          <p class="about-p">这里没有许愿池式的交易，也没有“转发得好运”。功德只是山里的一个数字，不必当真。</p>
        </div>
        <div>
          <ul class="about-list">
            <li><b>声音</b>全部由浏览器实时合成：钟、磬、木鱼、鼓、风、水、鸟、虫与低频梵音。</li>
            <li><b>画面</b>WebGL 程序化生成，没有贴图库，也没有 3D 模型文件。</li>
            <li><b>存档</b>心愿、签文、功德存在本机 localStorage。</li>
            <li><b>隐私</b>没有账号，没有埋点，没有上传。</li>
            <li><b>无障碍</b>支持键盘操作；可开启系统“减少动态效果”。</li>
          </ul>
        </div>
      </div>
      <div class="panel-sep">参考与致谢</div>
      <p class="about-p">在体验结构上，空山参考了韩国线上寺院 <a href="https://sansatemple.com/" target="_blank" rel="noopener">산사 Sansatemple</a> 的“无声同坐”构想，以及中文互联网里“电子木鱼”的自嘲式安慰。建筑与器物参照中国汉传佛教寺院的常见形制：歇山屋顶、斗拱、朱柱、放生池、钟鼓楼、七层塔。签诗取自民间流传的观音灵签，今解为本站重写。</p>
      <p class="about-p">空山不是真实寺院，与任何宗教团体无关，也不提供宗教服务、法事或占卜。若你正在经历难以独自承受的事，请优先寻求现实中的人与专业帮助。</p>
      <div class="about-note">${esc(UI.disclaimer())}<br/>空山 · 第一版 · 二〇二六年冬</div>
    `);
  }

  openSettings(time = 'dusk') {
    this.openPanel(`
      <p class="panel-kicker">设置</p>
      <h2 class="panel-title">山中气候</h2>
      <p class="panel-lede">换一个时辰，山会换一种颜色。声音与画面都只在你的浏览器里。</p>
      <div class="setting-row">
        <div><div class="setting-name">时辰</div><p class="setting-desc">晨雾、日午、黄昏、夜钟</p></div>
        <div class="seg" id="time-seg">
          ${[['dawn', '晨'], ['noon', '午'], ['dusk', '昏'], ['night', '夜']].map(([id, n]) =>
            `<button type="button" data-time="${id}" aria-pressed="${time === id}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="setting-row">
        <div><div class="setting-name">寺院的声音</div><p class="setting-desc">钟声、风、鸟与梵音</p></div>
        <button class="btn-small" id="settings-sound" type="button">切换声音</button>
      </div>
      <div class="setting-row">
        <div><div class="setting-name">回到山门</div><p class="setting-desc">把位置放回入口的石阶</p></div>
        <button class="btn-small" id="settings-home" type="button">回去</button>
      </div>
      <div class="setting-actions">
        <button class="btn-ghost" id="settings-reset" type="button">清空我的山中记录</button>
      </div>
      <div class="about-note">清空会删除本机保存的心愿、红绸、签文与功德，无法恢复。</div>
    `);
    document.querySelectorAll<HTMLElement>('#time-seg button').forEach((b) => {
      b.addEventListener('click', () => {
        const t = b.dataset.time!;
        document.querySelectorAll('#time-seg button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        this.h.onSetTime(t);
      });
    });
    document.getElementById('settings-sound')?.addEventListener('click', () => this.h.onSound());
    document.getElementById('settings-home')?.addEventListener('click', () => {
      this.closePanel();
      this.h.onTeleport('gate');
    });
    document.getElementById('settings-reset')?.addEventListener('click', () => {
      if (confirm('确定要清空本机保存的记录吗？')) {
        this.h.onReset();
        this.closePanel();
        this.toast('山中记录已清空');
      }
    });
  }

  static aboutIntro() {
    return '山门常开，各自安静。点一炷香，敲三下木鱼，和陌生人一起，在大殿前坐一会儿。';
  }

  static disclaimer() {
    return '空山是一处虚构的数字寺院，不是真实宗教场所，也不提供任何形式的宗教服务。';
  }

  /* ---------- 功德 / 声音 ---------- */

  setTimeMode(mode: string) {
    this.setTimeLabel({ dawn: '清晨', noon: '日午', dusk: '黄昏', night: '夜' }[mode] ?? '黄昏');
  }
}
