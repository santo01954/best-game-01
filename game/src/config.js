// Lumen Maze: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Height of the HUD bar across the top of the screen. */
export const HUD_HEIGHT = 64;

/** The maze grid: 21 x 11 cells of 56 px, centred under the HUD. */
export const MAZE = { cols: 21, rows: 11, cell: 56, ox: 52, oy: 72 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  speed: 215,
  invulnerable: 1.5,
};

export const LIVES = 3;

/** Seconds on the clock when a depth starts. */
export const TIME_LIMIT = 120;

export const CRYSTAL = {
  count: 8,
  points: 100,
  /** Pickup radius around the crystal's centre. */
  radius: 26,
};

export const SENTRY = {
  count: 3,
  maxCount: 5,
  radius: 16,
  speed: 95,
  speedPerDepth: 10,
  /** Touch radius: player centre to sentry centre. */
  hitRadius: 30,
  /** Shadows shy from the player's light: inside this radius they flee. */
  fleeRadius: 140,
  /** Speed multiplier while fleeing (209 px/s: just below the player's 215). */
  fleeSpeed: 2.2,
};

export const PORTAL = {
  /** Radius within which the player enters the open portal. */
  radius: 30,
};

/** How many sparkle particles a crystal pickup bursts. */
export const BURST = 14;
/** Ambient dust motes drifting over the maze. */
export const MOTES = 26;

export const PALETTE = {
  bgTop: '#0a0d1c',
  bgBottom: '#141a30',
  floorA: '#161c32',
  floorB: '#1a2140',
  floorDot: '#232c4e',
  wall: '#2b3870',
  wallTop: '#4d63ad',
  wallSide: '#1e2750',
  player: '#ffd76a',
  playerCore: '#fff6d8',
  trail: 'rgba(255, 215, 106, 0.5)',
  crystal: '#5ff2ff',
  crystalCore: '#ffffff',
  sentry: '#160a2a',
  sentryRim: '#7a3cff',
  sentryEye: '#ff4d6d',
  portal: '#8affc1',
  portalCore: '#eafff3',
  panel: 'rgba(9, 13, 27, 0.84)',
  panelEdge: '#3d4c86',
  text: '#eef1f5',
  muted: '#9aa3ba',
  danger: '#ff5d5d',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-maze.best';
