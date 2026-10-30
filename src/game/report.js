// The learning report card: a summary of a student's mastery per learning
// objective that they can copy, download or print and hand in through any LMS
// (as an assignment submission). It carries a check code computed from its
// contents, so a teacher can spot a report that was edited by hand. It isn't
// tamper-proof (everything runs in the browser), just a deterrent.
import { SUBJECTS, TOPICS } from '../data/questions.js';

// FNV-1a over the report text, as 8 base-36 characters.
function checkCode(text) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return ((h1 % 1679616).toString(36).padStart(4, '0') + (h2 % 1679616).toString(36).padStart(4, '0')).toUpperCase();
}

/** Build the report for a learning record. Returns { rows, totals, text, code }. */
export function buildReport(learning, { name = 'Student', date = new Date() } = {}) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const rows = TOPICS.map((t) => {
    const s = learning.topics[t.id] || { correct: 0, wrong: 0 };
    const answered = s.correct + s.wrong;
    return {
      id: t.id, subject: t.subject, topic: t.name,
      mastery: Math.round(learning.progress(t.id) * 100), mastered: learning.isMastered(t.id),
      correct: s.correct, wrong: s.wrong, accuracy: answered ? Math.round((s.correct / answered) * 100) : null,
    };
  });
  const answered = rows.reduce((n, r) => n + r.correct + r.wrong, 0);
  const correct = rows.reduce((n, r) => n + r.correct, 0);
  const totals = {
    wisdom: learning.level, mastered: learning.masteredCount(), topics: TOPICS.length,
    answered, accuracy: answered ? Math.round((correct / answered) * 100) : null,
    streak: learning.daily?.streak || 0, bestStreak: learning.daily?.best || 0,
    openMistakes: learning.mistakes?.length || 0, hawkerBest: learning.hawker?.best || 0,
  };
  const lines = [
    'SingaporeScape learning report',
    `Student: ${name}`,
    `Date: ${day}`,
    `Wisdom level: ${totals.wisdom} · Topics mastered: ${totals.mastered}/${totals.topics} · Questions answered: ${answered}${totals.accuracy !== null ? ` (${totals.accuracy}% correct)` : ''}`,
    `Daily revision streak: ${totals.streak} (best ${totals.bestStreak}) · Open mistakes to revisit: ${totals.openMistakes}`,
  ];
  for (const sb of SUBJECTS) {
    lines.push('', `${sb.name}:`);
    for (const r of rows.filter((x) => x.subject === sb.id)) {
      lines.push(`  ${r.mastered ? '[MASTERED]' : `[${String(r.mastery).padStart(3)}%]   `} ${r.topic}: ${r.correct} right, ${r.wrong} wrong${r.accuracy !== null ? ` (${r.accuracy}%)` : ''}`);
    }
  }
  if (totals.hawkerBest) lines.push('', `Hawker stall best weekly profit: $${totals.hawkerBest.toFixed(2)}`);
  const body = lines.join('\n');
  const code = checkCode(body);
  return { rows, totals, code, text: `${body}\n\nCheck code: ${code}` };
}

/** Does a pasted report's check code match its contents? */
export function verifyReport(text) {
  const m = /\n\nCheck code: ([0-9A-Z]{8})\s*$/.exec(text);
  return !!m && checkCode(text.slice(0, m.index)) === m[1];
}
