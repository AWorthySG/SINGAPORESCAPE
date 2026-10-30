// The hawker stall: a five-day Economics simulation. Each day you read the
// news, set a price for your chicken rice and decide how many plates to cook.
// Customers follow a demand curve (Qd = a - b·P) that the day's news shifts or
// tilts; unsold plates are wasted. Afterwards you see what happened, which
// curve moved and why, and the best price you could have charged.

export const DAYS = 5;
export const BASE = { a: 120, b: 15, cost: 1.5, rent: 30 };   // demand intercept and slope, cost per plate, daily rent

// The day's news. `a` shifts demand, `b` multiplies its slope (higher = more
// price elastic), `cost` changes the cost of each plate. `why` is the lesson.
export const EVENTS = [
  { id: 'normal', news: 'An ordinary weekday in Kampong Glam.',
    why: 'Nothing shifted today: this is your baseline demand and cost.' },
  { id: 'lunch_crowd', news: 'A new office tower opens next to the hawker centre.', a: 40,
    why: 'More buyers means demand shifts right: more plates are wanted at every price, so the best price and quantity both rise.' },
  { id: 'school_hols', news: 'School holidays: many families have gone overseas.', a: -35,
    why: 'Fewer buyers means demand shifts left: fewer plates are wanted at every price, so the best price and quantity both fall.' },
  { id: 'rice_up', news: 'Rice and chicken prices jump at the wet market (+$1.00 a plate).', cost: 1.0,
    why: 'Higher costs reduce supply: each plate costs more to make, so it pays to charge more and cook fewer.' },
  { id: 'competitor', news: 'A rival chicken rice stall opens two doors down.', b: 1.6,
    why: 'A close substitute makes demand more price elastic: customers walk away quickly if you charge too much, so the best price falls.' },
  { id: 'rain', news: 'Heavy rain all day: fewer people are out.', a: -20,
    why: 'Bad weather shifts demand left for the day.' },
  { id: 'festival', news: 'A food festival brings tourists who want to try the famous chicken rice.', a: 60, b: 0.8,
    why: 'Demand shifts right and becomes less elastic (tourists care less about price), so you can charge noticeably more.' },
  { id: 'chicken_sale', news: 'Your supplier has a sale on chicken (−$0.50 a plate).', cost: -0.5,
    why: 'Lower costs increase supply: each plate is cheaper to make, so the best price falls a little and you can sell more.' },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** A new five-day run: an ordinary first day, then four different events. */
export function newRun(rand = Math.random) {
  const pool = EVENTS.filter((e) => e.id !== 'normal').map((e) => e.id);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { day: 0, events: ['normal', ...pool.slice(0, DAYS - 1)], results: [] };
}

/** The market on a given event. */
export function params(eventId) {
  const e = EVENT_BY_ID[eventId] || EVENTS[0];
  return { a: BASE.a + (e.a || 0), b: BASE.b * (e.b || 1), cost: BASE.cost + (e.cost || 0), rent: BASE.rent };
}

const r2 = (v) => Math.round(v * 100) / 100;

/** One trading day at a price, with this many plates cooked. */
export function simulate(p, price, cooked) {
  const wanted = Math.max(0, Math.round(p.a - p.b * price));
  const sold = Math.min(wanted, cooked);
  const revenue = r2(sold * price);
  const cost = r2(cooked * p.cost + p.rent);
  return { price, cooked, wanted, sold, unsold: cooked - sold, missed: wanted - sold, revenue, cost, profit: r2(revenue - cost) };
}

/** The best price (to 10 cents) and plates for the day, and the profit it makes.
 *  With a straight-line demand curve and a fixed cost per plate, profit peaks
 *  at P = (a/b + cost) / 2, cooking exactly what's demanded. */
export function best(p) {
  const price = Math.round(((p.a / p.b + p.cost) / 2) * 10) / 10;
  const cooked = Math.max(0, Math.round(p.a - p.b * price));
  return simulate(p, price, cooked);
}

/** Play a day in a run, returning its result (with the best for comparison). */
export function playDay(run, price, cooked) {
  const ev = run.events[run.day];
  const p = params(ev);
  const res = { event: ev, ...simulate(p, price, cooked), best: best(p) };
  run.results.push(res);
  run.day++;
  return res;
}

/** Totals for a finished run: your profit, the best possible, and a 0..1 score. */
export function summary(run) {
  const profit = r2(run.results.reduce((s, r) => s + r.profit, 0));
  const bestTotal = r2(run.results.reduce((s, r) => s + r.best.profit, 0));
  return { profit, best: bestTotal, score: bestTotal > 0 ? Math.max(0, Math.min(1, profit / bestTotal)) : 0 };
}
