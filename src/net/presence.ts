import { RESIDENT_SEAT, SEATS } from '../data/content';

export type SitResult = { ok: boolean; reason?: string };

/**
 * 极轻量的在线状态：只同步“哪个蒲团被谁占了”和在线人数。
 * 没有位置同步、没有聊天、没有身份。
 */
export class Presence {
  seats: (string | null)[] = new Array(SEATS.length).fill(null);
  count = 0;
  selfId: string | null = null;
  connected = false;
  resident = RESIDENT_SEAT;
  onUpdate: () => void = () => {};

  private ws: WebSocket | null = null;
  private pending: { seat: number; resolve: (r: SitResult) => void; timer: number } | null = null;
  private reconnectTimer = 0;
  private closed = false;
  private simulated = false;

  constructor() {
    this.seats[RESIDENT_SEAT] = 'resident';
  }

  connect() {
    if (this.closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.simulated = false;
        this.onUpdate();
      };
      ws.onmessage = (ev) => this.handle(ev.data);
      ws.onclose = () => {
        this.connected = false;
        this.selfId = null;
        this.count = 0;
        for (let i = 0; i < this.seats.length; i++) {
          if (this.seats[i] && this.seats[i] !== 'resident') this.seats[i] = null;
        }
        this.onUpdate();
        this.scheduleReconnect();
      };
      ws.onerror = () => { /* onclose 处理 */ };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), 5000);
  }

  private handle(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      this.selfId = String(msg.id);
      this.connected = true;
      this.count = Number(msg.count) || 1;
      if (Array.isArray(msg.seats)) this.seats = msg.seats as (string | null)[];
      this.onUpdate();
    } else if (msg.type === 'seats') {
      if (Array.isArray(msg.seats)) this.seats = msg.seats as (string | null)[];
      if (typeof msg.count === 'number') this.count = msg.count;
      this.onUpdate();
    } else if (msg.type === 'count') {
      this.count = Number(msg.count) || 0;
      this.onUpdate();
    } else if (msg.type === 'sit-ok') {
      if (this.pending) {
        window.clearTimeout(this.pending.timer);
        this.pending.resolve({ ok: true });
        this.pending = null;
      }
    } else if (msg.type === 'sit-denied') {
      if (this.pending) {
        window.clearTimeout(this.pending.timer);
        this.pending.resolve({ ok: false, reason: String(msg.reason ?? 'occupied') });
        this.pending = null;
      }
    }
  }

  freeSeats(): number[] {
    return this.seats
      .map((v, i) => (v === null ? i : -1))
      .filter((i) => i >= 0 && i !== RESIDENT_SEAT);
  }

  async sit(seat: number): Promise<SitResult> {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.seats[seat] && this.seats[seat] !== this.selfId) return { ok: false, reason: 'occupied' };
      return new Promise<SitResult>((resolve) => {
        const timer = window.setTimeout(() => {
          this.pending = null;
          resolve({ ok: false, reason: 'timeout' });
        }, 2500);
        this.pending = { seat, resolve, timer };
        this.ws!.send(JSON.stringify({ type: 'sit', seat }));
      });
    }
    // 静态预览 / 服务不可达时的单人模拟
    this.simulated = true;
    this.selfId = this.selfId ?? 'local';
    this.count = Math.max(1, this.count);
    this.seats[seat] = this.selfId;
    this.onUpdate();
    return { ok: true };
  }

  stand() {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stand' }));
    }
    if (this.simulated && this.selfId) {
      for (let i = 0; i < this.seats.length; i++) {
        if (this.seats[i] === this.selfId) this.seats[i] = null;
      }
      this.onUpdate();
    }
    this.simulated = false;
  }

  get online() {
    return this.connected;
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.reconnectTimer);
    if (this.pending) {
      window.clearTimeout(this.pending.timer);
      this.pending.resolve({ ok: false, reason: 'closed' });
      this.pending = null;
    }
    try { this.ws?.close(); } catch { /* noop */ }
  }
}
