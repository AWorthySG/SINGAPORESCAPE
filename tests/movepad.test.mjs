import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MovePad } from '../src/engine/movepad.js';

test('a floating stick recentres on a second thumb and stops if the active touch is cancelled', (t) => {
  const listeners = () => {
    const handlers = new Map();
    return {
      addEventListener: (type, fn) => handlers.set(type, fn),
      fire: (type, e) => handlers.get(type)(e),
    };
  };
  const node = () => ({
    ...listeners(), style: {}, classList: new Set(), setAttribute() {},
    appendChild(child) { this.child = child; },
  });
  const root = node();
  const fakeWindow = { ...listeners(), innerWidth: 400, innerHeight: 800 };
  const fakeDocument = { ...listeners(), createElement: node };
  const original = { window: globalThis.window, document: globalThis.document };
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });

  let vector;
  const move = new MovePad({ setMoveInput: (x, y) => { vector = [x, y]; } }, root);
  const pad = move.el;
  const classes = new Set();
  pad.classList = { add: (key) => classes.add(key), remove: (key) => classes.delete(key) };
  pad.getBoundingClientRect = () => ({ left: 14, right: 122, top: 678, bottom: 786, width: 108, height: 108 });
  const capture = [];
  pad.setPointerCapture = (id) => capture.push(id);
  const pointer = (id, x, y, isPrimary = true) => ({
    pointerId: id, clientX: x, clientY: y, isPrimary, pointerType: 'touch',
    button: 0, preventDefault() {},
  });

  pad.fire('pointerdown', pointer(1, 68, 732));
  assert.deepEqual(vector, [0, 0]);
  fakeWindow.fire('pointermove', pointer(1, 114, 732));
  assert.deepEqual(vector, [1, 0]);
  pad.fire('pointerdown', pointer(2, 110, 720, false));
  pad.fire('pointerdown', pointer(3, 100, 700, false));

  fakeWindow.fire('pointerup', pointer(1, 114, 732));
  assert.deepEqual(capture, [1, 2]);
  assert.equal(pad.style.transform, 'translate(42px, -12px)');
  assert.deepEqual(vector, [0, 0]);
  fakeWindow.fire('pointermove', pointer(2, 110, 674, false));
  assert.deepEqual(vector, [0, -1]);
  pad.fire('pointerdown', pointer(3, 100, 700, false));
  fakeWindow.fire('pointercancel', pointer(2, 110, 674, false));
  assert.deepEqual(vector, [0, 0]);
  assert.equal(pad.style.transform, '');
  assert.equal(classes.has('active'), false);
});
