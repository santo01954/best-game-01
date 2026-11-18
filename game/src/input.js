// Keyboard and mouse: arrows/WASD steer, Space/Enter/click confirms, P or
// Escape pauses, M mutes. Clicks on the maze steer by tile: the game walks
// the shortest path to the clicked cell.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEY_DIRS = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null;

  /** Map a client point to logical field coordinates (letterboxed canvas). */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  function onKeyDown(event) {
    if (event.code in KEY_DIRS) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerDown(event) {
    actions |= ACTION_CONFIRM;
    click = toLogical(event.clientX, event.clientY);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  function direction() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const d = KEY_DIRS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  return {
    direction,
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    takeClick() {
      const out = click;
      click = null;
      return out;
    },
    hasKeyboardInput() {
      return held.size > 0;
    },
  };
}
