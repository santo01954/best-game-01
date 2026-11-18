// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over and depth cleared.
//
// ?seed=N fixes the maze. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, MAZE, STEP } from './config.js';
import { createRandom } from './random.js';
import { bfsPath, pixelToCell, isFloor, steerAlongRoute } from './maze.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, createRandom((seed ^ 0x9e3779b9) >>> 0));
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  /** Waypoints (cells) the click-to-move walk is following. */
  let waypoints = [];

  function announce(message) {
    status.textContent = message;
  }

  function freshStart() {
    world.state.depth = 1;
    world.state.score = 0;
    world.reset();
    waypoints = [];
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lights, two minutes, ${world.state.crystals.length} crystals.`);
  }

  function nextDepth() {
    world.nextDepth();
    waypoints = [];
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Depth ${world.state.depth}. Playing.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Depth cleared. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  /** The move for this step: keyboard wins, else the click-to-move walk. */
  function currentMove() {
    const keys = input.direction();
    if (keys.x !== 0 || keys.y !== 0) {
      waypoints = [];
      return keys;
    }
    if (waypoints.length === 0) return { x: 0, y: 0 };
    const p = world.state.player;
    const [pcx, pcy] = world.playerCell();
    while (waypoints.length > 0 && waypoints[0][0] === pcx && waypoints[0][1] === pcy) {
      waypoints.shift();
    }
    if (waypoints.length === 0) return { x: 0, y: 0 };
    return steerAlongRoute(p.x, p.y, [[pcx, pcy], ...waypoints]);
  }

  function handleClick(point) {
    if (!point || screen !== SCREEN_PLAY) return;
    const [cx, cy] = pixelToCell(point.x, point.y);
    const state = world.state;
    if (!isFloor(state.grid, MAZE.cols, MAZE.rows, cx, cy)) return;
    const [px, py] = world.playerCell();
    const route = bfsPath(state.grid, MAZE.cols, MAZE.rows, px, py, cx, cy, null);
    if (route && route.length > 1) {
      waypoints = route.slice(1);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) sound.toggleMute();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
        sound.click();
        freshStart();
        return;
      }
      if (screen === SCREEN_WIN) {
        sound.click();
        nextDepth();
        return;
      }
      if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        return;
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_PLAY) handleClick(input.takeClick());
    else input.takeClick();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    const events = world.step(STEP, currentMove(), false);
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_HIT) {
      sound.hit();
      waypoints = [];
      announce(world.state.lives === 1 ? 'Hit. 1 light left.' : `Hit. ${world.state.lives} lights left.`);
    }
    if (events & EVENT_WIN) {
      sound.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Maze. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
