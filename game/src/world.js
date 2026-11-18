// The world: the maze, the player, crystals, sentries, the timer and the
// particles. Pure logic, no drawing and no DOM: step() advances the fixed
// simulation and reports what happened as event bits.

import { CRYSTAL, LIVES, MAZE, MOTES, BURST, PALETTE, PLAYER, PORTAL, SENTRY, TIME_LIMIT } from './config.js';
import { bfsPath, cellCenter, floorCells, generateMaze, isFloor, pixelToCell } from './maze.js';
import { shuffled } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_TIMEOUT = 16;

const START_CELL = [1, 1];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Does a circle at (x, y) with radius r overlap any wall cell? */
function hitsWall(grid, cols, rows, x, y, r) {
  const x0 = Math.floor((x - r - MAZE.ox) / MAZE.cell);
  const x1 = Math.floor((x + r - MAZE.ox) / MAZE.cell);
  const y0 = Math.floor((y - r - MAZE.oy) / MAZE.cell);
  const y1 = Math.floor((y + r - MAZE.oy) / MAZE.cell);
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      if (isFloor(grid, cols, rows, cx, cy)) continue;
      const left = MAZE.ox + cx * MAZE.cell;
      const top = MAZE.oy + cy * MAZE.cell;
      const nearX = Math.max(left, Math.min(x, left + MAZE.cell));
      const nearY = Math.max(top, Math.min(y, top + MAZE.cell));
      if (dist(x, y, nearX, nearY) < r) return true;
    }
  }
  return false;
}

export function createWorld(random) {
  const state = {
    grid: [],
    depth: 1,
    player: { x: 0, y: 0, face: 1 },
    crystals: [],
    sentries: [],
    particles: [],
    motes: [],
    score: 0,
    got: 0,
    lives: LIVES,
    timeLeft: TIME_LIMIT,
    elapsed: 0,
    invuln: 0,
    shake: 0,
    over: false,
    won: false,
    timedOut: false,
    exit: { cx: MAZE.cols - 2, cy: MAZE.rows - 2 },
  };

  function exitCenter() {
    return cellCenter(state.exit.cx, state.exit.cy);
  }

  function spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 160;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + random() * 0.4,
        maxLife: 0.85,
        color,
        size: 2 + random() * 3.5,
      });
    }
  }

  /** A patrol route: a path between two distant floor cells, walked ping-pong. */
  function makePatrol(floors) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const a = floors[Math.floor(random() * floors.length)];
      const b = floors[Math.floor(random() * floors.length)];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const path = bfsPath(state.grid, MAZE.cols, MAZE.rows, a[0], a[1], b[0], b[1], null);
      if (path && path.length >= 6) {
        return { path, at: random() * (path.length - 1), dir: random() < 0.5 ? 1 : -1 };
      }
    }
    const cell = floors[Math.floor(random() * floors.length)];
    return { path: [cell, cell], at: 0, dir: 1 };
  }

  function reset() {
    state.grid = generateMaze(MAZE.cols, MAZE.rows, random);
    const floors = floorCells(state.grid, MAZE.cols, MAZE.rows);
    const start = cellCenter(START_CELL[0], START_CELL[1]);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.face = 1;
    const far = (cell) => {
      const dStart = Math.abs(cell[0] - START_CELL[0]) + Math.abs(cell[1] - START_CELL[1]);
      const dExit = Math.abs(cell[0] - state.exit.cx) + Math.abs(cell[1] - state.exit.cy);
      return dStart > 2 && dExit > 1;
    };
    const spots = shuffled(floors.filter(far), random).slice(0, CRYSTAL.count);
    state.crystals = spots.map(([cx, cy], i) => {
      const c = cellCenter(cx, cy);
      return { cx, cy, x: c.x, y: c.y, taken: false, phase: (i * 0.7) % (Math.PI * 2) };
    });
    const count = Math.min(SENTRY.count + state.depth - 1, SENTRY.maxCount);
    state.sentries = [];
    for (let i = 0; i < count; i += 1) {
      state.sentries.push(makePatrol(floors));
    }
    state.particles = [];
    state.motes = [];
    for (let i = 0; i < MOTES; i += 1) {
      state.motes.push({
        x: MAZE.ox + random() * MAZE.cols * MAZE.cell,
        y: MAZE.oy + random() * MAZE.rows * MAZE.cell,
        phase: random() * Math.PI * 2,
        speed: 4 + random() * 8,
        size: 1 + random() * 1.8,
      });
    }
    state.got = 0;
    state.lives = LIVES;
    state.timeLeft = TIME_LIMIT;
    state.elapsed = 0;
    state.invuln = 0;
    state.shake = 0;
    state.over = false;
    state.won = false;
    state.timedOut = false;
  }

  /** Pixel centre of a sentry `at` cells along its patrol path (clamped). */
  function posAlong(sentry, at) {
    const last = sentry.path.length - 1;
    if (last <= 0) {
      const only = cellCenter(sentry.path[0][0], sentry.path[0][1]);
      return { x: only.x, y: only.y };
    }
    const clamped = Math.max(0, Math.min(last, at));
    const i = Math.min(Math.floor(clamped), Math.max(0, last - 1));
    const f = clamped - i;
    const a = cellCenter(sentry.path[i][0], sentry.path[i][1]);
    const b = cellCenter(sentry.path[i + 1][0], sentry.path[i + 1][1]);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function stepSentries(dt, active) {
    const baseSpeed = (SENTRY.speed + (state.depth - 1) * SENTRY.speedPerDepth) / MAZE.cell;
    for (const sentry of state.sentries) {
      const last = sentry.path.length - 1;
      if (last <= 0) continue;
      let speed = baseSpeed;
      if (active) {
        // Shadows shy from the light: a sentry the player nears flees along
        // its path, faster than its patrol, in whichever direction puts more
        // distance between it and the player. Cornered at a path end, it has
        // nowhere to run.
        const pos = posAlong(sentry, sentry.at);
        const player = state.player;
        if (dist(pos.x, pos.y, player.x, player.y) < SENTRY.fleeRadius) {
          const probe = baseSpeed * dt * 2;
          const ahead = posAlong(sentry, sentry.at + probe);
          const behind = posAlong(sentry, sentry.at - probe);
          const dAhead = dist(ahead.x, ahead.y, player.x, player.y);
          const dBehind = dist(behind.x, behind.y, player.x, player.y);
          sentry.dir = dAhead >= dBehind ? 1 : -1;
          speed = baseSpeed * SENTRY.fleeSpeed;
        }
      }
      sentry.at += sentry.dir * speed * dt;
      if (sentry.at >= last) {
        sentry.at = last;
        sentry.dir = -1;
      } else if (sentry.at <= 0) {
        sentry.at = 0;
        sentry.dir = 1;
      }
    }
  }

  /** Pixel centres of the sentries, for drawing and collisions. */
  function sentryPositions() {
    return state.sentries.map((sentry) => posAlong(sentry, sentry.at));
  }

  /**
   * Advance the world by dt seconds. `move` is a unit-ish {x, y} direction.
   * In attract mode (title screen) only the maze life moves: sentries patrol,
   * motes drift, crystals shimmer; the player, timer and lives wait.
   */
  function step(dt, move, attract) {
    state.elapsed += dt;
    stepSentries(dt, !attract && !state.over && !state.won);
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (attract || state.over || state.won) return 0;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.over = true;
      state.timedOut = true;
      return EVENT_OVER | EVENT_TIMEOUT;
    }
    if (state.invuln > 0) state.invuln -= dt;

    const p = state.player;
    const vx = (move?.x ?? 0) * PLAYER.speed;
    const vy = (move?.y ?? 0) * PLAYER.speed;
    if (vx !== 0) p.face = vx > 0 ? 1 : -1;
    const nx = p.x + vx * dt;
    if (!hitsWall(state.grid, MAZE.cols, MAZE.rows, nx, p.y, PLAYER.radius)) p.x = nx;
    const ny = p.y + vy * dt;
    if (!hitsWall(state.grid, MAZE.cols, MAZE.rows, p.x, ny, PLAYER.radius)) p.y = ny;

    let events = 0;
    for (const crystal of state.crystals) {
      if (crystal.taken) continue;
      if (dist(p.x, p.y, crystal.x, crystal.y) < CRYSTAL.radius) {
        crystal.taken = true;
        state.got += 1;
        state.score += CRYSTAL.points;
        spawnBurst(crystal.x, crystal.y, PALETTE.crystal, BURST);
        events |= EVENT_PICKUP;
      }
    }

    if (state.got >= state.crystals.length) {
      const exit = exitCenter();
      if (dist(p.x, p.y, exit.x, exit.y) < PORTAL.radius) {
        state.won = true;
        state.score += Math.ceil(state.timeLeft) * 5;
        spawnBurst(exit.x, exit.y, PALETTE.portal, BURST * 2);
        return events | EVENT_WIN;
      }
    }

    if (state.invuln <= 0) {
      for (const s of sentryPositions()) {
        if (dist(p.x, p.y, s.x, s.y) < SENTRY.hitRadius) {
          state.lives -= 1;
          state.shake = 1;
          spawnBurst(p.x, p.y, PALETTE.danger, BURST);
          events |= EVENT_HIT;
          if (state.lives <= 0) {
            state.over = true;
            return events | EVENT_OVER;
          }
          state.invuln = PLAYER.invulnerable;
          const start = cellCenter(START_CELL[0], START_CELL[1]);
          p.x = start.x;
          p.y = start.y;
          break;
        }
      }
    }
    return events;
  }

  function nextDepth() {
    state.depth += 1;
    state.score += 250;
    reset();
  }

  reset();

  return {
    state,
    step,
    reset,
    nextDepth,
    exitCenter,
    sentryPositions,
    playerCell() {
      return pixelToCell(state.player.x, state.player.y);
    },
  };
}
