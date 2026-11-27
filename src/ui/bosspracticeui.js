import { TICK_MS } from '../config.js';
import { getNpc } from '../data/npcs.js';
import { bossPracticeTip, knownBossMove, makePracticeDrill, practiceHit, practiceResponse, PRACTICE_BOSS, PRACTICE_RESPONSES, PRACTICE_SIZE, PRACTICE_START } from '../game/bosspractice.js';

export function openBossPractice(ui, id) {
  const move = knownBossMove(id);
  if (!move?.hazards?.length) return;
  ui.openModal(`Practice · ${getNpc(id).name}`, (body) => {
    body.innerHTML = '<div class="boss-practice"><p class="modal-hint"></p>'
      + '<details class="drill-signature"><summary>Rehearse the signature response</summary><p></p><div class="drill-answers"></div><p class="drill-feedback" role="status"></p></details>'
      + '<label>Ground attack pattern <select></select></label>'
      + '<button type="button" class="ui-pill drill-start">Start drill</button><p class="drill-status" role="status"></p>'
      + '<div class="drill-board" tabindex="0" aria-label="Practice tiles. Move with arrow keys or tap an adjacent tile."></div></div>';
    body.querySelector('.modal-hint').textContent = `${move.name}. ${move.desc} Practice uses no supplies.`;
    body.querySelector('.drill-signature p').textContent = 'The boss begins its signature move. How do you respond?';
    const response = practiceResponse(move);
    for (const [key, label] of Object.entries(PRACTICE_RESPONSES)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-pill';
      button.textContent = label;
      button.addEventListener('click', () => {
        body.querySelector('.drill-feedback').textContent = key === response
          ? `Good response. ${bossPracticeTip(null, move)}`
          : `Try again. Think about what ${move.name} does first.`;
      });
      body.querySelector('.drill-answers').appendChild(button);
    }
    const status = body.querySelector('.drill-status'), board = body.querySelector('.drill-board'), select = body.querySelector('select');
    const start = body.querySelector('.drill-start');
    for (const pattern of move.hazards) {
      const option = document.createElement('option');
      option.value = pattern;
      option.textContent = pattern.charAt(0).toUpperCase() + pattern.slice(1);
      select.appendChild(option);
    }
    const cells = [];
    for (let y = 0; y < PRACTICE_SIZE; y++) for (let x = 0; x < PRACTICE_SIZE; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.tabIndex = -1;
      cell.setAttribute('aria-label', `Tile ${x + 1}, ${y + 1}`);
      cell.addEventListener('click', () => steer(x, y));
      cells.push({ cell, x, y });
      board.appendChild(cell);
    }
    let position = PRACTICE_START, squares = [], running = false, caught = false, movedAt = -Infinity;
    const draw = () => {
      for (const { cell, x, y } of cells) {
        const here = position.x === x && position.y === y;
        cell.classList.toggle('current', here);
        cell.classList.toggle('danger', practiceHit(squares, { x, y }));
        const boss = x === PRACTICE_BOSS.x && y === PRACTICE_BOSS.y;
        cell.textContent = here ? '●' : boss ? '◆' : '';
      }
    };
    function steer(x, y) {
      if (!running || x < 0 || y < 0 || x >= PRACTICE_SIZE || y >= PRACTICE_SIZE) return;
      const step = Math.max(Math.abs(position.x - x), Math.abs(position.y - y));
      const now = performance.now();
      if (step !== 1 || now - movedAt < 100) return;
      position = { x, y };
      movedAt = now;
      draw();
    }
    board.addEventListener('keydown', (event) => {
      const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const v = vectors[event.key];
      if (!v) return;
      event.preventDefault();
      steer(position.x + v[0], position.y + v[1]);
    });
    const finish = (elapsed) => {
      if (!board.isConnected) return;
      for (const square of squares) {
        if (square.follow && !square.aimed && elapsed >= square.delay - 2) {
          square.cx = position.x;
          square.cy = position.y;
          square.aimed = true;
        }
      }
      const due = squares.filter((s) => s.delay <= elapsed);
      caught ||= practiceHit(due, position);
      squares = squares.filter((s) => s.delay > elapsed);
      draw();
      if (squares.length) {
        setTimeout(() => finish(elapsed + 1), TICK_MS);
      } else {
        running = false;
        start.disabled = select.disabled = false;
        status.textContent = caught ? `Caught by the ${select.value}. ${bossPracticeTip(select.value)}` : 'Dodged! Try another pattern or repeat this one.';
      }
    };
    select.addEventListener('change', () => { status.textContent = bossPracticeTip(select.value); });
    start.addEventListener('click', () => {
      if (running) return;
      position = PRACTICE_START;
      movedAt = -Infinity;
      caught = false;
      running = true;
      start.disabled = select.disabled = true;
      squares = makePracticeDrill(ui.game, select.value);
      status.textContent = 'Move out of the marked tiles before the attack lands.';
      draw();
      board.focus();
      setTimeout(() => finish(1), TICK_MS);
    });
    status.textContent = bossPracticeTip(select.value);
    draw();
  });
}
