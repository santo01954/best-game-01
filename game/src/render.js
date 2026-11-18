// The renderer: every pixel of Lumen Maze. A fixed 1280x720 logical field is
// scaled to the window with letterboxing, so the game looks the same on any
// screen and the screenshots are exactly 1280x720.

import { CRYSTAL, FIELD, HUD_HEIGHT, MAZE, PALETTE, FONT, PLAYER, TIME_LIMIT } from './config.js';
import { cellCenter, isFloor } from './maze.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function rect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function frame() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    return {
      dpr, scale,
      ox: (w - FIELD.width * scale) / 2,
      oy: (h - FIELD.height * scale) / 2,
    };
  }

  function drawMaze(state, time) {
    const { grid } = state;
    for (let y = 0; y < MAZE.rows; y += 1) {
      for (let x = 0; x < MAZE.cols; x += 1) {
        const px = MAZE.ox + x * MAZE.cell;
        const py = MAZE.oy + y * MAZE.cell;
        if (grid[y][x] === 1) {
          ctx.fillStyle = PALETTE.wall;
          rect(ctx, px + 1, py + 1, MAZE.cell - 2, MAZE.cell - 2, 7);
          ctx.fill();
          ctx.fillStyle = PALETTE.wallTop;
          rect(ctx, px + 4, py + 4, MAZE.cell - 8, 7, 3);
          ctx.fill();
          ctx.fillStyle = PALETTE.wallSide;
          rect(ctx, px + 4, py + MAZE.cell - 10, MAZE.cell - 8, 6, 3);
          ctx.fill();
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
          ctx.fillRect(px, py, MAZE.cell, MAZE.cell);
          ctx.fillStyle = PALETTE.floorDot;
          ctx.beginPath();
          ctx.arc(px + MAZE.cell / 2, py + MAZE.cell / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // A soft glow where the maze meets the dark around it.
    ctx.strokeStyle = 'rgba(90, 120, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(MAZE.ox - 3, MAZE.oy - 3, MAZE.cols * MAZE.cell + 6, MAZE.rows * MAZE.cell + 6);
  }

  function drawMotes(state, time) {
    ctx.fillStyle = 'rgba(160, 180, 255, 0.28)';
    for (const mote of state.motes) {
      const x = mote.x + Math.sin(time * 0.35 + mote.phase) * 10;
      const y = mote.y + Math.cos(time * 0.28 + mote.phase) * 8;
      ctx.beginPath();
      ctx.arc(x, y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPortal(state, time, open) {
    const c = cellCenter(state.exit.cx, state.exit.cy);
    const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 44);
    glow.addColorStop(0, open ? 'rgba(138, 255, 193, 0.55)' : 'rgba(120, 130, 150, 0.25)');
    glow.addColorStop(1, 'rgba(138, 255, 193, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 26 - ring * 7;
      const start = time * (open ? 1.6 : 0.4) + ring * 2.1;
      ctx.strokeStyle = open ? PALETTE.portal : '#5a6378';
      ctx.globalAlpha = 0.95 - ring * 0.25;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, start, start + Math.PI * 1.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = open ? PALETTE.portalCore : '#7b8499';
    ctx.beginPath();
    ctx.arc(c.x, c.y, open ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    if (!open) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${state.got}/${state.crystals.length}`, c.x, c.y + 40);
    }
  }

  function drawCrystals(state, time) {
    for (const crystal of state.crystals) {
      if (crystal.taken) continue;
      const bob = Math.sin(time * 2.2 + crystal.phase) * 3;
      const y = crystal.y + bob;
      const squash = 0.55 + 0.45 * Math.abs(Math.sin(time * 1.8 + crystal.phase));
      const glow = ctx.createRadialGradient(crystal.x, y, 2, crystal.x, y, 26);
      glow.addColorStop(0, 'rgba(95, 242, 255, 0.5)');
      glow.addColorStop(1, 'rgba(95, 242, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(crystal.x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(crystal.x, y);
      ctx.scale(squash, 1);
      ctx.fillStyle = PALETTE.crystal;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.crystalCore;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSentries(world, time) {
    const positions = world.sentryPositions();
    positions.forEach((s, i) => {
      const bob = Math.sin(time * 3 + i * 1.7) * 2;
      const y = s.y + bob;
      const glow = ctx.createRadialGradient(s.x, y, 4, s.x, y, 34);
      glow.addColorStop(0, 'rgba(122, 60, 255, 0.45)');
      glow.addColorStop(1, 'rgba(122, 60, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, y, 34, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createRadialGradient(s.x - 5, y - 6, 2, s.x, y, 18);
      body.addColorStop(0, '#3a1a66');
      body.addColorStop(1, PALETTE.sentry);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(s.x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.sentryRim;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Eyes track the player.
      const dx = world.state.player.x - s.x;
      const dy = world.state.player.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const ex = (dx / len) * 3;
      const ey = (dy / len) * 3;
      ctx.fillStyle = PALETTE.sentryEye;
      ctx.beginPath();
      ctx.arc(s.x - 5 + ex, y - 2 + ey, 2.8, 0, Math.PI * 2);
      ctx.arc(s.x + 5 + ex, y - 2 + ey, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (state.invuln > 0 && Math.sin(time * 24) > 0.2) return; // blink while invulnerable
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
    glow.addColorStop(0, 'rgba(255, 215, 106, 0.65)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(p.x - 4, p.y - 5, 2, p.x, p.y, PLAYER.radius);
    body.addColorStop(0, PALETTE.playerCore);
    body.addColorStop(0.55, PALETTE.player);
    body.addColorStop(1, '#e09b2d');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 246, 216, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, time) {
    ctx.fillStyle = 'rgba(8, 11, 22, 0.88)';
    ctx.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, HUD_HEIGHT - 2, FIELD.width, 2);
    ctx.textBaseline = 'middle';
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${String(state.score).padStart(4, '0')}`, 28, HUD_HEIGHT / 2);
    ctx.fillStyle = PALETTE.crystal;
    ctx.fillText(`◆ ${state.got}/${state.crystals.length}`, 260, HUD_HEIGHT / 2);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`DEPTH ${state.depth}`, 430, HUD_HEIGHT / 2);
    // Timer bar and text.
    const frac = Math.max(0, state.timeLeft / TIME_LIMIT);
    const barX = 580;
    const barW = 300;
    ctx.fillStyle = '#232c4e';
    rect(ctx, barX, HUD_HEIGHT / 2 - 9, barW, 18, 9);
    ctx.fill();
    ctx.fillStyle = frac < 0.25 ? PALETTE.danger : PALETTE.portal;
    if (frac > 0) {
      rect(ctx, barX, HUD_HEIGHT / 2 - 9, Math.max(18, barW * frac), 18, 9);
      ctx.fill();
    }
    const secs = Math.ceil(state.timeLeft);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, barX + barW + 14, HUD_HEIGHT / 2);
    // Lives.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.player;
    let livesText = '';
    for (let i = 0; i < state.lives; i += 1) livesText += '● ';
    ctx.fillText(livesText.trimEnd(), FIELD.width - 28, HUD_HEIGHT / 2);
    ctx.textAlign = 'left';
  }

  function drawPanel(title, titleColor, lines, prompt, time) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const w = 700;
    const h = 300;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    rect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = titleColor;
    ctx.font = `900 54px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, y + 66);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 21px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, y + 128 + i * 32);
    });
    if (prompt) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 3.2);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText(prompt, FIELD.width / 2, y + h - 44);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function draw(world, screen, best) {
    const state = world.state;
    const time = state.elapsed;
    const { dpr, scale, ox, oy } = frame();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Deterministic shake: a function of elapsed time, never Math.random,
    // so a staged screenshot scene always renders the same frame.
    const sx = state.shake * 6 * Math.sin(time * 47);
    const sy = state.shake * 6 * Math.cos(time * 39);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx * scale), dpr * (oy + sy * scale));
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    bg.addColorStop(0, PALETTE.bgTop);
    bg.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawMaze(state, time);
    drawMotes(state, time);
    drawPortal(state, time, state.got >= state.crystals.length);
    drawCrystals(state, time);
    drawSentries(world, time);
    drawPlayer(state, time);
    drawParticles(state);
    drawHud(state, time);
    if (screen === SCREEN_TITLE) {
      drawPanel('LUMEN MAZE', PALETTE.gold, [
        'Gather every crystal, wake the portal, and escape the maze.',
        'The shadows patrol the corridors. Three lights, two minutes.',
        `Best score: ${best}`,
        'Move: WASD / Arrows / Click a tile  ·  Pause: P  ·  Mute: M',
      ], 'PRESS SPACE OR CLICK TO START', time);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PALETTE.text, ['The maze waits.'], 'PRESS P OR SPACE TO RESUME', time);
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE LIGHT FADES', PALETTE.danger, [
        state.timedOut ? 'Time ran out in the dark.' : 'The shadows caught your light.',
        `Score ${state.score}  ·  Best ${Math.max(best, state.score)}`,
      ], 'PRESS SPACE OR CLICK TO TRY AGAIN', time);
    } else if (screen === SCREEN_WIN) {
      drawPanel('DEPTH CLEARED!', PALETTE.portal, [
        `You escaped with ${Math.ceil(state.timeLeft)} seconds to spare.`,
        `Score ${state.score}  ·  Best ${Math.max(best, state.score)}`,
      ], 'PRESS SPACE FOR THE NEXT DEPTH', time);
    }
  }

  return { draw, frame };
}
