// The maze: generation, cell math and pathfinding. All randomness comes from
// the seeded generator, so the same seed always builds the same maze.

import { MAZE } from './config.js';

export const WALL = 1;
export const FLOOR = 0;

/** Carve a perfect maze with the recursive backtracker, over the odd cells. */
export function generateMaze(cols, rows, random) {
  const grid = [];
  for (let y = 0; y < rows; y += 1) {
    grid.push(new Array(cols).fill(WALL));
  }
  const stack = [[1, 1]];
  grid[1][1] = FLOOR;
  const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === WALL) {
        options.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, wx, wy] = options[Math.floor(random() * options.length)];
    grid[wy][wx] = FLOOR;
    grid[ny][nx] = FLOOR;
    stack.push([nx, ny]);
  }
  return grid;
}

export function isFloor(grid, cols, rows, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
  return grid[cy][cx] === FLOOR;
}

/** Every floor cell, in scan order. */
export function floorCells(grid, cols, rows) {
  const out = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (grid[y][x] === FLOOR) out.push([x, y]);
    }
  }
  return out;
}

/** Pixel centre of a cell, in logical coordinates. */
export function cellCenter(cx, cy) {
  return {
    x: MAZE.ox + cx * MAZE.cell + MAZE.cell / 2,
    y: MAZE.oy + cy * MAZE.cell + MAZE.cell / 2,
  };
}

/** The cell containing a logical pixel point. */
export function pixelToCell(x, y) {
  return [
    Math.floor((x - MAZE.ox) / MAZE.cell),
    Math.floor((y - MAZE.oy) / MAZE.cell),
  ];
}

/**
 * Breadth-first path from (sx, sy) to (tx, ty) over floor cells, as a list of
 * cells including both ends, or null when no path exists. `blocked` is a Set
 * of "x,y" keys treated as walls (the target itself is never blocked).
 */
export function bfsPath(grid, cols, rows, sx, sy, tx, ty, blocked) {
  if (sx === tx && sy === ty) return [[sx, sy]];
  const key = (x, y) => x + ',' + y;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!isFloor(grid, cols, rows, nx, ny)) continue;
      if (blocked && blocked.has(k) && !(nx === tx && ny === ty)) continue;
      prev.set(k, [cx, cy]);
      if (nx === tx && ny === ty) {
        const path = [[tx, ty]];
        let cur = [cx, cy];
        while (cur !== null) {
          path.push(cur);
          cur = prev.get(key(cur[0], cur[1]));
        }
        path.reverse();
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

/**
 * Steer along a route of cells (route[0] is the cell the mover is in): align
 * with each segment's line, then traverse it. Moving one axis at a time, in
 * the segment's own order, never wedges the mover into a corner the way a
 * diagonal line or a dominant-axis guess can.
 */
export function steerAlongRoute(px, py, route) {
  if (!route || route.length < 2) return { x: 0, y: 0 };
  let idx = 1;
  let centre = cellCenter(route[idx][0], route[idx][1]);
  while (idx < route.length - 1 && Math.hypot(centre.x - px, centre.y - py) < 8) {
    idx += 1;
    centre = cellCenter(route[idx][0], route[idx][1]);
  }
  const prev = route[idx - 1];
  const next = route[idx];
  const dx = centre.x - px;
  const dy = centre.y - py;
  if (next[0] !== prev[0]) {
    // Horizontal segment: align vertically with the row centre, then go.
    if (Math.abs(dy) > 4) return { x: 0, y: Math.sign(dy) };
    if (Math.abs(dx) > 4) return { x: Math.sign(dx), y: 0 };
    return { x: 0, y: 0 };
  }
  // Vertical segment: align horizontally with the column centre, then go.
  if (Math.abs(dx) > 4) return { x: Math.sign(dx), y: 0 };
  if (Math.abs(dy) > 4) return { x: 0, y: Math.sign(dy) };
  return { x: 0, y: 0 };
}
