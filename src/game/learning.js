// Learning progress: Wisdom (XP and level earned by answering study questions),
// mastery of each topic (learning objective), the Knowledge Codex cards and
// titles mastery unlocks, and the small subject perks it grants in the game.
// Kept apart from the combat/life skills so it can't disturb their balance.
import { SUBJECTS, TOPICS, TOPIC_BY_ID, QUESTIONS, QUESTIONS_BY_TOPIC } from '../data/questions.js';
import { levelForXp } from '../data/xp.js';

// A topic is mastered after this many correct answers, with most of the
// recent ones right (so a lucky streak at the start doesn't count).
export const MASTERY_CORRECT = 6;
export const MASTERY_RECENT = 5;      // look at the last 5 answers...
export const MASTERY_RECENT_OK = 4;   // ...and need at least 4 of them right
export const DAILY_COUNT = 5;   // questions in the daily revision
const XP_RIGHT = 60, XP_WRONG = 8, XP_REPEAT = 0.25;   // repeats of a question you already know earn less

// Perk strength per mastered topic in a subject, and the cap.
export const PERK_STEP = { econ: 0.03, math: 0.02, english: 0.025 };
export const PERK_CAP = { econ: 0.12, math: 0.08, english: 0.1 };

export class Learning {
  constructor() {
    this.xp = 0;
    this.topics = {};      // topicId -> { correct, wrong, recent: [1/0...], mastered }
    this.known = {};       // questionId -> times answered correctly
    this.title = null;     // chosen title (topic id whose title you wear)
    this.mistakes = [];    // question ids you got wrong and haven't since got right (bounties)
    this.daily = { date: null, streak: 0, best: 0 };   // last day the daily revision was finished
  }

  get level() { return levelForXp(this.xp); }

  stat(topicId) {
    return this.topics[topicId] || (this.topics[topicId] = { correct: 0, wrong: 0, recent: [], mastered: false });
  }

  isMastered(topicId) { return !!this.topics[topicId]?.mastered; }
  masteredIn(subjectId) { return TOPICS.filter((t) => t.subject === subjectId && this.isMastered(t.id)).length; }
  masteredCount() { return TOPICS.filter((t) => this.isMastered(t.id)).length; }

  /** 0..1 progress toward mastering a topic. */
  progress(topicId) {
    const s = this.topics[topicId];
    if (!s) return 0;
    if (s.mastered) return 1;
    const recentOk = s.recent.slice(-MASTERY_RECENT).reduce((a, b) => a + b, 0);
    return Math.min(0.95, (Math.min(s.correct, MASTERY_CORRECT) / MASTERY_CORRECT) * 0.7 + (recentOk / MASTERY_RECENT) * 0.3);
  }

  /** Pick the next question: from one topic, one subject, or anything. Questions
   *  you've got wrong or never seen come up first; ones you know well rarely. */
  pick({ topic = null, subject = null, ids = null, rand = Math.random } = {}) {
    let pool = ids ? QUESTIONS.filter((q) => ids.includes(q.id)) : topic ? QUESTIONS_BY_TOPIC[topic] || []
      : subject ? QUESTIONS.filter((q) => TOPIC_BY_ID[q.topic].subject === subject) : QUESTIONS;
    if (!pool.length) return null;
    if (pool.length > 1 && this._last) pool = pool.filter((q) => q.id !== this._last);
    const weight = (q) => 1 / (1 + 2 * (this.known[q.id] || 0)) * (this.isMastered(q.topic) ? 0.5 : 1);
    let total = 0;
    for (const q of pool) total += weight(q);
    let r = rand() * total;
    for (const q of pool) { r -= weight(q); if (r <= 0) return q; }
    return pool[pool.length - 1];
  }

  /** Record an answer. Returns { correct, xp, mastered (newly), levelUp }. */
  answer(question, correct) {
    this._last = question.id;
    const s = this.stat(question.topic);
    const before = this.level;
    let xp;
    // A bounty: a question you once got wrong, now answered right, pays double.
    const bounty = correct && this.mistakes.includes(question.id);
    if (correct) {
      s.correct++;
      xp = Math.round(XP_RIGHT * ((this.known[question.id] || 0) >= 2 ? XP_REPEAT : 1));
      this.known[question.id] = (this.known[question.id] || 0) + 1;
      if (bounty) { xp = XP_RIGHT * 2; this.mistakes = this.mistakes.filter((id) => id !== question.id); }
    } else {
      s.wrong++;
      xp = XP_WRONG;
      if (!this.mistakes.includes(question.id)) this.mistakes.push(question.id);
      if (this.mistakes.length > 60) this.mistakes.shift();
    }
    s.recent.push(correct ? 1 : 0);
    if (s.recent.length > 10) s.recent.shift();
    this.xp += xp;
    let mastered = false;
    if (!s.mastered && s.correct >= MASTERY_CORRECT
      && s.recent.slice(-MASTERY_RECENT).reduce((a, b) => a + b, 0) >= MASTERY_RECENT_OK) {
      s.mastered = true;
      mastered = true;
    }
    return { correct, xp, mastered, bounty, levelUp: this.level > before ? this.level : 0 };
  }

  /** Today's daily revision: five questions, bounties first, then your weakest topics. */
  dailySet(rand = Math.random) {
    const out = [];
    const take = (q) => { if (q && !out.includes(q)) out.push(q); };
    for (const id of this.mistakes.slice(0, 3)) take(QUESTIONS.find((q) => q.id === id));
    const weak = TOPICS.filter((t) => !this.isMastered(t.id)).sort((a, b) => this.progress(a.id) - this.progress(b.id));
    for (let i = 0; out.length < DAILY_COUNT && i < 40; i++) {
      const t = weak.length ? weak[i % Math.min(3, weak.length)] : null;
      take(this.pick(t ? { topic: t.id, rand } : { rand }));
    }
    return out;
  }

  dailyDone(today) { return this.daily.date === today; }

  /** Finish the daily revision. Returns { streak, coins } (or null if already done today). */
  finishDaily(today, yesterday) {
    if (this.daily.date === today) return null;
    this.daily.streak = this.daily.date === yesterday ? this.daily.streak + 1 : 1;
    this.daily.best = Math.max(this.daily.best || 0, this.daily.streak);
    this.daily.date = today;
    return { streak: this.daily.streak, coins: 150 + 50 * Math.min(this.daily.streak - 1, 6) };
  }

  /** Subject perks: { shop, crit, acc } from mastered topics. */
  perks() {
    const p = (id) => Math.min(PERK_CAP[id], this.masteredIn(id) * PERK_STEP[id]);
    return { shop: p('econ'), crit: p('math'), acc: p('english') };
  }

  /** Titles you've unlocked (one per mastered topic). */
  titles() { return TOPICS.filter((t) => this.isMastered(t.id)); }
  titleText() { return this.title && this.isMastered(this.title) ? TOPIC_BY_ID[this.title].title : null; }

  serialize() { return { xp: this.xp, topics: this.topics, known: this.known, title: this.title, mistakes: this.mistakes, daily: this.daily }; }

  load(d) {
    if (!d || typeof d !== 'object') return;
    if (typeof d.xp === 'number' && d.xp >= 0) this.xp = d.xp;
    if (d.topics && typeof d.topics === 'object') {
      for (const [id, s] of Object.entries(d.topics)) {
        if (!TOPIC_BY_ID[id] || !s || typeof s !== 'object') continue;
        this.topics[id] = {
          correct: Number(s.correct) || 0, wrong: Number(s.wrong) || 0,
          recent: Array.isArray(s.recent) ? s.recent.slice(-10).map((v) => (v ? 1 : 0)) : [],
          mastered: !!s.mastered,
        };
      }
    }
    if (d.known && typeof d.known === 'object') this.known = { ...d.known };
    if (typeof d.title === 'string' && TOPIC_BY_ID[d.title]) this.title = d.title;
    if (Array.isArray(d.mistakes)) this.mistakes = d.mistakes.filter((id) => QUESTIONS.some((q) => q.id === id)).slice(-60);
    if (d.daily && typeof d.daily === 'object') {
      this.daily = { date: typeof d.daily.date === 'string' ? d.daily.date : null,
        streak: Number(d.daily.streak) || 0, best: Number(d.daily.best) || 0 };
    }
  }
}

export { SUBJECTS, TOPICS };
