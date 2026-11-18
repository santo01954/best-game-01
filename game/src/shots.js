// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by an
// autopilot, so every frame is what a real game looks like and the same seed
// always gives the same frame.

import { MAZE, STEP } from './config.js';
import { bfsPath, cellCenter, pixelToCell, steerAlongRoute } from './maze.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const WIN_LIMIT_SECONDS = 400;
const END_LIMIT_SECONDS = 600;
/** Crystals the play scene's pilot collects before holding position. */
const PLAY_CRYSTAL_CAP = 4;

function routeTo(world, target) {
  const [px, py] = world.playerCell();
  return bfsPath(world.state.grid, MAZE.cols, MAZE.rows, px, py, target[0], target[1], null);
}

/**
 * A step along a route toward `dest` (a pixel point). When the route has one
 * cell left, the player is already in the destination cell, so it walks to
 * the destination point itself: stopping at the cell edge would leave it
 * just outside a crystal's pickup radius, frozen forever.
 */
function followRoute(world, route, dest) {
  const p = world.state.player;
  if (!route || route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1) {
    const dx = dest.x - p.x;
    const dy = dest.y - p.y;
    if (Math.hypot(dx, dy) < 6) return { x: 0, y: 0 };
    if (Math.abs(dx) > Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
    return { x: 0, y: Math.sign(dy) };
  }
  return steerAlongRoute(p.x, p.y, route);
}

/**
 * A collector pilot with a sticky target: the nearest untaken crystal, then
 * the exit. The maze is a tree, so there is exactly one path to any target
 * and blocking cells around sentries would strand the pilot: instead it
 * charges the route at full speed (the player is twice as fast as a sentry)
 * and accepts the odd hit. With a cap and a hold cell (the play scene), it
 * gathers that many crystals and then holds near the hold cell.
 */
function makeCollectorPilot(options = {}) {
  const cap = options.cap ?? Infinity;
  const hold = options.hold ?? null;
  let target = null;
  return (world) => {
    const state = world.state;
    if (state.got >= state.crystals.length) {
      target = [state.exit.cx, state.exit.cy];
    } else if (state.got >= cap && hold) {
      target = hold;
    } else {
      const kept = target && state.crystals.some((c) => !c.taken && c.cx === target[0] && c.cy === target[1]);
      if (!kept) {
        let best = null;
        let bestLen = Infinity;
        const [px, py] = world.playerCell();
        for (const c of state.crystals) {
          if (c.taken) continue;
          const path = bfsPath(state.grid, MAZE.cols, MAZE.rows, px, py, c.cx, c.cy, null);
          if (path && path.length < bestLen) {
            best = [c.cx, c.cy];
            bestLen = path.length;
          }
        }
        target = best;
      }
    }
    if (!target) return { x: 0, y: 0 };
    return followRoute(world, routeTo(world, target), cellCenter(target[0], target[1]));
  };
}

/** The doomed pilot: walks straight at the nearest sentry, again and again. */
function makeDoomedPilot() {
  return (world) => {
    const p = world.state.player;
    let best = null;
    let bestD = Infinity;
    for (const s of world.sentryPositions()) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return { x: 0, y: 0 };
    const [tx, ty] = pixelToCell(best.x, best.y);
    return followRoute(world, routeTo(world, [tx, ty]), best);
  };
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    const pilot = makeCollectorPilot({ cap: PLAY_CRYSTAL_CAP, hold: [1, 1] });
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, pilot(world), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const pilot = makeCollectorPilot({});
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, pilot(world), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  const pilot = makeDoomedPilot();
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const events = world.step(STEP, pilot(world), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
}
