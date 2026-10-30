// The game's side of classes: join a class with the code your teacher shares,
// and your correct answers chip away at the class's weekly raid boss while the
// Wisdom you earn climbs the class's effort leaderboard. Talks to the class
// server (server/api/class.js on Vercel). Answers are batched and sent every
// so often, so play never waits on the network.

export const API_URL = 'https://singaporescape-api.vercel.app/api/class';
const FLUSH_MS = 15000;          // send batched answers at most this often

export class Classroom {
  constructor() {
    this.code = null;            // class code, once joined
    this.student = null;         // the name you joined as
    this.name = null;            // the class's name
    this.pending = { correct: 0, wisdom: 0 };   // not yet sent
    this.claimed = null;         // week whose raid reward you've collected
    this.view = null;            // the last class view from the server (not saved)
    this._timer = null;
  }

  get joined() { return !!this.code; }

  async call(body) {
    if (typeof fetch === 'undefined') throw new Error('No network.');
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `The class server said ${res.status}.`);
    return out;
  }

  async create(name, pin) { return this.call({ action: 'create', name, pin }); }

  async join(code, student) {
    const v = await this.call({ action: 'join', code: code.toUpperCase().trim(), student });
    this.code = v.code; this.student = student; this.name = v.name; this.view = v;
    return v;
  }

  leave() { this.code = this.student = this.name = this.view = null; this.pending = { correct: 0, wisdom: 0 }; }

  async refresh() {
    if (!this.joined) return null;
    this.view = await this.call({ action: 'info', code: this.code, student: this.student });
    return this.view;
  }

  async reset(pin) {
    this.view = await this.call({ action: 'reset', code: this.code, pin, student: this.student });
    return this.view;
  }

  /** A study answer: queue it, and send the batch a little later. */
  record(correct, wisdom) {
    if (!this.joined) return;
    if (correct) this.pending.correct++;
    this.pending.wisdom += Math.max(0, Math.round(wisdom));
    if (!this._timer && typeof setTimeout !== 'undefined' && typeof document !== 'undefined') {
      this._timer = setTimeout(() => { this._timer = null; this.flush().catch(() => {}); }, FLUSH_MS);
    }
  }

  /** Send queued answers. On failure they stay queued for the next try. */
  async flush() {
    if (!this.joined || (!this.pending.correct && !this.pending.wisdom)) return this.view;
    const batch = this.pending;
    this.pending = { correct: 0, wisdom: 0 };
    try {
      this.view = await this.call({ action: 'progress', code: this.code, student: this.student, correct: batch.correct, wisdom: batch.wisdom });
      return this.view;
    } catch (e) {
      this.pending.correct += batch.correct; this.pending.wisdom += batch.wisdom;
      throw e;
    }
  }

  /** The raid reward, once per week after the boss falls. */
  canClaim() { return !!(this.view?.raid?.defeated && this.claimed !== this.view.week); }

  serialize() { return this.code ? { code: this.code, student: this.student, name: this.name, pending: this.pending, claimed: this.claimed } : null; }

  load(d) {
    if (!d || typeof d !== 'object' || typeof d.code !== 'string') return;
    this.code = d.code; this.student = typeof d.student === 'string' ? d.student : null;
    this.name = typeof d.name === 'string' ? d.name : null;
    this.claimed = typeof d.claimed === 'string' ? d.claimed : null;
    if (d.pending) this.pending = { correct: Number(d.pending.correct) || 0, wisdom: Number(d.pending.wisdom) || 0 };
  }
}
