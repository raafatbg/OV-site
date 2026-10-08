/* ══════════════════════════════════════════════════
   OmniVora — 3D layer
   Dependency-free canvas renderer (perspective projection,
   depth-shaded points and lines). Any <canvas data-3d="…">
   is mounted automatically:
     globe   — point-cloud sphere, sync arcs, orbit rings
               (data-home="lat,lon" pins a home marker that arcs leave from)
     geo     — geodesic wireframe with a counter-rotating core
     knot    — torus-knot ribbon with travelling packets
     sync    — scroll-driven offline-first story: terminals ⇄ cloud
               (reads data-progress 0..1, written by home.js)
     pos     — POS terminal          phone — mobile app
     bars    — live 3D bar chart     neural — node graph with pulses
     rails   — payment gyroscope     stack — isolated tenant layers
     omvi    — home hero wordmark as a 3D point cloud: dust is printed into
               "OMVI" by a crimson beam while the page loads (data-print),
               glides into place (data-settle), ripples under the pointer,
               gets LiDAR-swept, and dissolves back to dust on scroll
     eco     — home hero: a POS terminal on a turntable with app, dashboard,
               payments and cloud orbiting it; HTML [data-anchor] siblings of
               the canvas are pinned to the 3D objects as floating labels
   Optional attributes: data-color, data-accent, data-scale, data-wait.
   A parent can set data-hover="1" on the canvas to spin it faster.
   Pauses off-screen; renders one still frame under reduced motion.
   ══════════════════════════════════════════════════ */
(function () {
  const TAU = Math.PI * 2;
  const D = 3.4; // camera distance in model units (sphere radius = 1)
  const BUCKETS = 6;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
  const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // Rotate around Y (yaw) then X (pitch) into `out` at offset `o`.
  function rotInto(out, o, x, y, z, cx, sx, cy, sy) {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    out[o] = x1;
    out[o + 1] = y * cx - z1 * sx;
    out[o + 2] = y * sx + z1 * cx;
  }

  // Shared pointer state: normalised (-1..1) for camera tilt, raw client px for ripples.
  // Render quality shared by every scene (lowered at runtime on slow devices).
  // big = full-width canvases (hero, sync): normal pixel density is plenty for soft line art
  const QUALITY = { dpr: 1.5, big: 1, points: innerWidth < 760 ? 0.85 : 1 };

  const pointer = { x: 0, y: 0, cx: -1e4, cy: -1e4, active: false };
  const track = (x, y) => {
    pointer.x = (x / innerWidth) * 2 - 1;
    pointer.y = (y / innerHeight) * 2 - 1;
    pointer.cx = x; pointer.cy = y; pointer.active = true;
  };
  addEventListener('mousemove', (e) => track(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) track(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchend', () => { pointer.active = false; }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.active = false; });

  /* ═══════ geometry helpers (flat segment lists: x1,y1,z1,x2,y2,z2,…) ═══════ */
  function ring(radius, u, v, steps, c) {
    const o = c || [0, 0, 0];
    const segs = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU, b = ((i + 1) / steps) * TAU;
      for (const t of [a, b]) {
        segs.push(o[0] + radius * (Math.cos(t) * u[0] + Math.sin(t) * v[0]),
          o[1] + radius * (Math.cos(t) * u[1] + Math.sin(t) * v[1]),
          o[2] + radius * (Math.cos(t) * u[2] + Math.sin(t) * v[2]));
      }
    }
    return segs;
  }

  function box(cx, cy, cz, w, h, d) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const segs = [];
    e.forEach(([a, b]) => segs.push(...c[a], ...c[b]));
    return segs;
  }

  // Rectangle in the XY plane (facing the camera) and in the XZ plane (lying flat).
  function rect(cx, cy, cz, w, h) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    return [x0, y0, cz, x1, y0, cz, x1, y0, cz, x1, y1, cz, x1, y1, cz, x0, y1, cz, x0, y1, cz, x0, y0, cz];
  }
  function rectFlat(cx, cy, cz, w, d) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    return [x0, cy, z0, x1, cy, z0, x1, cy, z0, x1, cy, z1, x1, cy, z1, x0, cy, z1, x0, cy, z1, x0, cy, z0];
  }

  function xform(segs, fn) {
    const out = new Array(segs.length);
    for (let i = 0; i < segs.length; i += 3) {
      const p = fn(segs[i], segs[i + 1], segs[i + 2]);
      out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2];
    }
    return out;
  }
  const move = (segs, dx, dy, dz) => xform(segs, (x, y, z) => [x + dx, y + dy, z + dz]);
  const tiltX = (ang, py, pz) => (x, y, z) => {
    const c = Math.cos(ang), s = Math.sin(ang), yy = y - py, zz = z - pz;
    return [x, py + yy * c - zz * s, pz + yy * s + zz * c];
  };
  function rotVec(v, axis, a) {
    const c = Math.cos(a), s = Math.sin(a);
    if (axis === 'x') return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
    if (axis === 'y') return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  }

  /* ═══════ models ═══════ */
  function fibonacciSphere(n) {
    const pts = new Float32Array(n * 3);
    const g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      pts[i * 3] = Math.cos(g * i) * r;
      pts[i * 3 + 1] = y;
      pts[i * 3 + 2] = Math.sin(g * i) * r;
    }
    return pts;
  }

  function globeGrid() {
    let segs = [];
    [-60, -30, 0, 30, 60].forEach((lat) => {
      const y = Math.sin((lat * Math.PI) / 180), r = Math.cos((lat * Math.PI) / 180);
      segs = segs.concat(ring(r, [1, 0, 0], [0, 0, 1], 44, [0, y, 0]));
    });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      segs = segs.concat(ring(1, [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], 44));
    }
    return new Float32Array(segs);
  }

  const latLon = (lat, lon) => {
    const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
  };

  function icosphere() {
    const t = (1 + Math.sqrt(5)) / 2;
    const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
    let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (cache.has(key)) return cache.get(key);
      const va = verts[a], vb = verts[b];
      verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]));
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    faces = faces.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    const edges = new Set();
    faces.forEach(([a, b, c]) => [[a, b], [b, c], [c, a]].forEach(([p, q]) => edges.add(p < q ? p + '_' + q : q + '_' + p)));
    const segs = [];
    edges.forEach((k) => { const [p, q] = k.split('_').map(Number); segs.push(...verts[p], ...verts[q]); });
    return { verts: verts.flat(), segs };
  }

  function knotPoint(t, p, q) {
    const r = 2 + Math.cos(q * t);
    return [(r * Math.cos(p * t)) / 3.1, (r * Math.sin(p * t)) / 3.1, (Math.sin(q * t) / 3.1) * 1.4];
  }

  function knotSegs(p, q, steps, phase) {
    const segs = [];
    for (let i = 0; i < steps; i++) {
      segs.push(...knotPoint((i / steps) * TAU + phase, p, q), ...knotPoint(((i + 1) / steps) * TAU + phase, p, q));
    }
    return segs;
  }

  // A countertop POS terminal: tilted screen on a stand, UI lines + key grid on the screen.
  function terminalModel(s) {
    const tilt = tiltX(-0.28, 0.25 * s, 0);
    const z = 0.036 * s;
    const body = [].concat(
      xform(box(0, 0.25 * s, 0, 1.1 * s, 0.72 * s, 0.06 * s), tilt),
      box(0, -0.2 * s, -0.04 * s, 0.12 * s, 0.5 * s, 0.1 * s),
      box(0, -0.48 * s, 0, 0.72 * s, 0.06 * s, 0.46 * s));
    const ui = xform([].concat(
      rect(0, 0.25 * s, z, 0.96 * s, 0.58 * s),
      [-0.4 * s, 0.44 * s, z, -0.02 * s, 0.44 * s, z],
      [-0.4 * s, 0.32 * s, z, -0.1 * s, 0.32 * s, z],
      [-0.4 * s, 0.2 * s, z, -0.05 * s, 0.2 * s, z],
      [-0.4 * s, 0.08 * s, z, -0.16 * s, 0.08 * s, z]), tilt);
    let keys = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) keys = keys.concat(rect(0.17 * s + c * 0.16 * s, 0.4 * s - r * 0.13 * s, z, 0.12 * s, 0.09 * s));
    return { body, ui, keys: xform(keys, tilt) };
  }

  /* ═══════ stage ═══════ */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Per-kind motion: spin speed (rad/s) and whether to sway instead of fully rotating.
  const MOTION = {
    globe: { spin: 0.12, pitch: 0.32 }, geo: { spin: 0.16, pitch: 0.45 }, knot: { spin: 0.2, pitch: 0.45 },
    sync: { sway: 0.3, yaw: -0.35, pitch: 0.28 }, pos: { sway: 0.55, yaw: -0.4, pitch: 0.18 },
    phone: { sway: 0.6, yaw: -0.35, pitch: 0.12 }, bars: { spin: 0.18, pitch: 0.5 }, neural: { spin: 0.15, pitch: 0.3 },
    rails: { spin: 0.1, pitch: 0.35 }, stack: { spin: 0.14, pitch: 0.55 },
    eco: { sway: 0.22, yaw: 0.35, pitch: 0.3 }, omvi: { sway: 0, yaw: 0, pitch: 0 },
  };

  function Stage(canvas, reduced) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kind = MOTION[canvas.dataset['3d']] ? canvas.dataset['3d'] : 'geo';
    // data-color may name a CSS custom property (e.g. "--hero-ink") so a theme can recolour the scene
    // Attributes may name a CSS custom property (e.g. data-color="--hero-ink") so a theme can
    // restyle the scene; anything unreadable falls back to a safe default, never to whatever
    // colour the canvas happened to use last.
    const css = getComputedStyle(canvas);
    const read = (v, fallback) => {
      if (!v) return fallback;
      const out = v.startsWith('--') ? css.getPropertyValue(v).trim() : v.trim();
      return out || fallback;
    };
    this.color = read(canvas.dataset.color, '#fffef9');
    this.accent = read(canvas.dataset.accent, '#de434c');
    this.accentRgb = hexToRgb(this.accent);
    const gk = parseFloat(read(canvas.dataset.glow, '1'));
    this.glowK = isFinite(gk) ? gk : 1; // 0 turns the soft accent glow off (light backgrounds)
    this.scale = parseFloat(canvas.dataset.scale || '1');
    this.reduced = reduced;
    this.visible = true;
    this.mx = 0; this.my = 0;
    this.t = 0; this.last = null; this.boost = 0;
    this.startedAt = null;
    this.small = innerWidth < 760;
    this.buf = new Float32Array(8192 * 3);
    this.build();
    this.resize();
  }

  Stage.prototype.build = function () {
    const k = this.kind;
    if (k === 'globe') {
      this.pts = fibonacciSphere(this.small ? 300 : 540);
      this.grid = globeGrid();
      const tilt = 0.42;
      this.orbitU = [1, 0, 0]; this.orbitV = [0, Math.sin(tilt), Math.cos(tilt)];
      this.orbits = [ring(1.34, this.orbitU, this.orbitV, 120), ring(1.58, [Math.cos(0.9), Math.sin(0.9), 0], norm([-Math.sin(0.9) * 0.3, Math.cos(0.9) * 0.3, 1]), 140)];
      this.arcs = [];
      this.maxArcs = this.small ? 4 : 7;
      const home = (this.canvas.dataset.home || '').split(',').map(Number);
      this.home = home.length === 2 && home.every(isFinite) ? latLon(home[0], home[1]) : null;
    } else if (k === 'geo') {
      const ico = icosphere();
      this.verts = ico.verts; this.segs = ico.segs;
      this.core = box(0, 0, 0, 0.84, 0.84, 0.84);
      this.coreInner = ring(0.62, [1, 0, 0], [0, 1, 0], 64).concat(ring(0.62, [0, 1, 0], [0, 0, 1], 64), ring(0.62, [1, 0, 0], [0, 0, 1], 64));
    } else if (k === 'knot') {
      this.strands = [knotSegs(2, 3, 300, 0), knotSegs(2, 3, 300, 0.035), knotSegs(2, 3, 300, -0.035)];
    } else if (k === 'sync') {
      const ico = icosphere();
      this.cloudPos = [0, 0.78, 0];
      this.cloud = move(xform(ico.segs, (x, y, z) => [x * 0.3, y * 0.3, z * 0.3]), ...this.cloudPos);
      this.terms = [[-1.05, -0.52, 0.1], [0, -0.6, 0.5], [1.05, -0.52, 0.1]].map((p) => {
        const m = terminalModel(0.42);
        return { pos: p, body: move(m.body, ...p), ui: move(m.ui, ...p), keys: move(m.keys, ...p), top: [p[0], p[1] + 0.3, p[2]] };
      });
      this.floor = [];
      for (let i = -3; i <= 3; i++) {
        this.floor.push(i * 0.4, -0.75, -1.2, i * 0.4, -0.75, 1.2, -1.2, -0.75, i * 0.4, 1.2, -0.75, i * 0.4);
      }
    } else if (k === 'pos') {
      const m = terminalModel(1.25);
      this.body = m.body; this.ui = m.ui; this.keys = m.keys;
      this.receipt = [0.62, -0.5, 0.05];
    } else if (k === 'phone') {
      this.body = box(0, 0, 0, 0.64, 1.25, 0.07);
      const z = 0.04;
      this.ui = [].concat(rect(0, 0, z, 0.54, 1.08), rect(0, 0.36, z, 0.44, 0.22), rect(0, 0.06, z, 0.44, 0.22),
        [-0.22, -0.18, z, 0.12, -0.18, z, -0.22, -0.26, z, 0.04, -0.26, z]);
      this.dots = [[-0.14, -0.46, z], [0, -0.46, z], [0.14, -0.46, z]];
    } else if (k === 'bars') {
      this.floor = [];
      for (let i = 0; i <= 4; i++) this.floor.push(-1 + i * 0.5, -0.6, -0.75, -1 + i * 0.5, -0.6, 0.75);
      for (let j = 0; j <= 3; j++) this.floor.push(-1, -0.6, -0.75 + j * 0.5, 1, -0.6, -0.75 + j * 0.5);
    } else if (k === 'neural') {
      const layers = [3, 5, 5, 2], xs = [-0.95, -0.32, 0.32, 0.95];
      this.layers = layers.map((n, l) => Array.from({ length: n }, (_, i) => [xs[l], (i - (n - 1) / 2) * 0.38, Math.sin(i * 1.9 + l) * 0.25]));
      this.edges = [];
      for (let l = 0; l < 3; l++) this.layers[l].forEach((a) => this.layers[l + 1].forEach((b) => this.edges.push(...a, ...b)));
      this.nodes = this.layers.flat().flat();
      this.pulses = [];
    } else if (k === 'stack') {
      this.platesY = [-0.5, 0, 0.5];
    } else if (k === 'omvi') {
      this.buildOmvi();
    } else if (k === 'eco') {
      const FLOOR = -0.62;
      this.floorY = FLOOR;
      const m = terminalModel(0.82);
      const lift = FLOOR + 0.51 * 0.82;
      this.term = { body: move(m.body, 0, lift, 0), ui: move(m.ui, 0, lift, 0), keys: move(m.keys, 0, lift, 0) };
      this.hub = [0, lift + 0.42, 0];
      // turntable: concentric rings, tick marks and spokes
      let plat = [].concat(ring(1.32, [1, 0, 0], [0, 0, 1], 120, [0, FLOOR, 0]), ring(1.0, [1, 0, 0], [0, 0, 1], 96, [0, FLOOR, 0]), ring(0.62, [1, 0, 0], [0, 0, 1], 72, [0, FLOOR, 0]));
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU, r2 = i % 4 === 0 ? 1.44 : 1.38;
        plat.push(Math.cos(a) * 1.32, FLOOR, Math.sin(a) * 1.32, Math.cos(a) * r2, FLOOR, Math.sin(a) * r2);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        plat.push(Math.cos(a) * 0.62, FLOOR, Math.sin(a) * 0.62, Math.cos(a) * 1.0, FLOOR, Math.sin(a) * 1.0);
      }
      this.plat = plat;
      const ico = icosphere();
      this.cloudPos = [0, 0.86, 0];
      this.cloud = xform(ico.segs, (x, y, z) => [x * 0.2, y * 0.2 + 0.86, z * 0.2]);
      this.sats = [
        { name: 'phone', a: 0.35, r: 1.5, y: 0.28 },
        { name: 'dash', a: 2.45, r: 1.55, y: 0.02 },
        { name: 'pay', a: 4.4, r: 1.45, y: 0.4 },
      ];
      // atmospheric dust
      const dust = fibonacciSphere(this.small ? 90 : 180);
      for (let i = 0; i < dust.length; i += 3) { const k = 1.7 + ((i * 7919) % 100) / 100; dust[i] *= k; dust[i + 1] *= k * 0.8; dust[i + 2] *= k; }
      this.dust = dust;
      this.anchors = {};
      const host = this.canvas.parentElement;
      if (host) host.querySelectorAll('[data-anchor]').forEach((el) => { this.anchors[el.dataset.anchor] = el; });
    }
  };

  Stage.prototype.resize = function () {
    const big = this.canvas.clientWidth * this.canvas.clientHeight > 500000;
    const dpr = Math.min(devicePixelRatio || 1, big ? QUALITY.big : QUALITY.dpr);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = this.canvas.width; this.h = this.canvas.height;
    const r = this.canvas.getBoundingClientRect();
    this.boxLeft = r.left; this.boxTop = r.top + scrollY;
  };

  Stage.prototype.start = function (now) { if (this.startedAt === null) this.startedAt = now; };

  Stage.prototype.project = function (x, y, z) {
    const k = D / (D - z);
    return [this.cx + x * k * this.R, this.cy - y * k * this.R, (z + 1.6) / 3.2];
  };

  // Rotate + project a single model point.
  Stage.prototype.pt = function (p) {
    const o = [0, 0, 0];
    rotInto(o, 0, p[0], p[1], p[2], this.rcx, this.rsx, this.rcy, this.rsy);
    return this.project(o[0], o[1], o[2]);
  };

  // Rotate + project + stroke a segment list, batching by depth bucket for speed.
  Stage.prototype.strokeSegs = function (segs, color, width, alpha, rot) {
    const [cx, sx, cy, sy] = rot || [this.rcx, this.rsx, this.rcy, this.rsy];
    const ctx = this.ctx, n = segs.length / 6;
    const out = this.buf;
    for (let i = 0; i < n; i++) {
      rotInto(out, i * 6, segs[i * 6], segs[i * 6 + 1], segs[i * 6 + 2], cx, sx, cy, sy);
      rotInto(out, i * 6 + 3, segs[i * 6 + 3], segs[i * 6 + 4], segs[i * 6 + 5], cx, sx, cy, sy);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width * this.dpr;
    for (let b = 0; b < BUCKETS; b++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        const depth = clamp(((out[o + 2] + out[o + 5]) / 2 + 1) / 2, 0, 0.999);
        if (Math.floor(depth * BUCKETS) !== b) continue;
        const k1 = D / (D - out[o + 2]), k2 = D / (D - out[o + 5]);
        ctx.moveTo(this.cx + out[o] * k1 * this.R, this.cy - out[o + 1] * k1 * this.R);
        ctx.lineTo(this.cx + out[o + 3] * k2 * this.R, this.cy - out[o + 4] * k2 * this.R);
        any = true;
      }
      if (!any) continue;
      ctx.globalAlpha = clamp(alpha * (0.12 + 0.88 * Math.pow((b + 0.5) / BUCKETS, 1.6)), 0, 1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // Rotate + project + fill a point list as depth-sized dots.
  Stage.prototype.fillPoints = function (pts, color, size, alpha) {
    const ctx = this.ctx, n = pts.length / 3, out = this.buf;
    for (let i = 0; i < n; i++) rotInto(out, i * 3, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], this.rcx, this.rsx, this.rcy, this.rsy);
    ctx.fillStyle = color;
    for (let b = 0; b < BUCKETS; b++) {
      ctx.beginPath();
      const f = (b + 0.5) / BUCKETS;
      const r = size * (0.45 + 0.9 * f) * this.dpr * clamp(this.R / 260, 0.5, 1.6);
      for (let i = 0; i < n; i++) {
        const z = out[i * 3 + 2];
        const depth = clamp((z + 1) / 2, 0, 0.999);
        if (Math.floor(depth * BUCKETS) !== b) continue;
        const k = D / (D - z);
        const x = this.cx + out[i * 3] * k * this.R, y = this.cy - out[i * 3 + 1] * k * this.R;
        // tiny dots read the same as squares and are far cheaper than arcs
        if (r < 2.2) ctx.rect(x - r, y - r, r * 2, r * 2);
        else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      }
      ctx.globalAlpha = clamp(alpha * (0.1 + 0.9 * Math.pow(f, 1.8)), 0, 1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Stage.prototype.glow = function (radius, a, x, y) {
    a *= this.glowK;
    if (a <= 0) return;
    const ctx = this.ctx, [r, g, b] = this.accentRgb;
    const gx = x === undefined ? this.cx : x, gy = y === undefined ? this.cy : y;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
  };

  Stage.prototype.dot = function (x, y, r, color, a) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * this.dpr, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  Stage.prototype.pulseRing = function (x, y, phase, a) {
    const ctx = this.ctx;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = this.dpr;
    ctx.globalAlpha = clamp(a * (1 - phase), 0, 1);
    ctx.beginPath(); ctx.arc(x, y, (3 + phase * 14) * this.dpr, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  };

  /* ═══════ globe ═══════ */
  Stage.prototype.spawnArc = function (now) {
    const n = this.pts.length / 3;
    const pick = () => { const i = (Math.random() * n) | 0; return [this.pts[i * 3], this.pts[i * 3 + 1], this.pts[i * 3 + 2]]; };
    let a = this.home && Math.random() < 0.7 ? this.home : pick(), b = pick(), tries = 0;
    // keep arcs a readable length: ~35°–120° apart
    while (tries++ < 20) {
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (dot < 0.82 && dot > -0.5) break;
      b = pick();
    }
    this.arcs.push({ a, b, born: now, dur: 1700 + Math.random() * 1200, omega: Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) });
  };

  Stage.prototype.arcPoint = function (arc, u) {
    const { a, b, omega } = arc;
    const s = Math.sin(omega) || 1;
    const wa = Math.sin((1 - u) * omega) / s, wb = Math.sin(u * omega) / s;
    const lift = 1 + Math.sin(Math.PI * u) * omega * 0.22;
    return [(a[0] * wa + b[0] * wb) * lift, (a[1] * wa + b[1] * wb) * lift, (a[2] * wa + b[2] * wb) * lift];
  };

  Stage.prototype.drawGlobe = function (now, intro) {
    this.glow(this.R * 1.6, 0.09 * intro);
    this.strokeSegs(this.grid, this.color, 0.8, 0.22 * intro);
    this.strokeSegs(this.orbits[0], this.color, 0.9, 0.35 * intro);
    this.strokeSegs(this.orbits[1], this.accent, 0.9, 0.4 * intro);
    this.fillPoints(this.pts, this.color, 1.6, 0.95 * intro);

    // satellites riding the inner orbit
    const sat = (ang, col, r) => {
      const u = this.orbitU, v = this.orbitV;
      const [x, y, d] = this.pt([1.34 * (Math.cos(ang) * u[0] + Math.sin(ang) * v[0]), 1.34 * (Math.cos(ang) * u[1] + Math.sin(ang) * v[1]), 1.34 * (Math.cos(ang) * u[2] + Math.sin(ang) * v[2])]);
      this.dot(x, y, r * (0.6 + d * 0.8), col, intro * (0.35 + 0.65 * d));
    };
    sat(this.t * 0.55, this.color, 2.6);
    sat(this.t * 0.55 + Math.PI, this.accent, 2.2);

    // home marker (e.g. Beirut): steady dot + expanding pulse
    if (this.home) {
      const [x, y, d] = this.pt(this.home);
      if (d > 0.35) {
        this.pulseRing(x, y, (this.t * 0.6) % 1, intro * d);
        this.dot(x, y, 3.4, this.accent, intro * (0.4 + 0.6 * d));
      }
    }

    // sync arcs: packets travelling between nodes, trail fades behind the head
    if (!this.reduced) {
      while (this.arcs.length < this.maxArcs && Math.random() < 0.06) this.spawnArc(now);
    } else if (!this.arcs.length) {
      for (let i = 0; i < this.maxArcs; i++) { this.spawnArc(0); this.arcs[i].born = -this.arcs[i].dur * (0.5 + i * 0.07); }
    }
    const ctx = this.ctx;
    this.arcs = this.arcs.filter((arc) => {
      const life = ((this.reduced ? 0 : now) - arc.born) / arc.dur; // 0..1 travel, 1..1.6 fade
      if (life > 1.6) return false;
      const head = clamp(life, 0, 1);
      const fade = life > 1 ? 1 - (life - 1) / 0.6 : 1;
      const steps = 28;
      ctx.beginPath();
      let depthSum = 0, hx = 0, hy = 0, hd = 0;
      for (let i = 0; i <= steps; i++) {
        const [x, y, d] = this.pt(this.arcPoint(arc, (i / steps) * head));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        depthSum += d; hx = x; hy = y; hd = d;
      }
      const depth = depthSum / (steps + 1);
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1.3 * this.dpr;
      ctx.globalAlpha = clamp(intro * fade * (0.15 + 0.75 * depth), 0, 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const A = this.pt(arc.a);
      this.dot(A[0], A[1], 2, this.accent, intro * fade * (0.2 + 0.7 * A[2]));
      if (life < 1) {
        this.dot(hx, hy, 6, this.accent, intro * 0.18 * hd);
        this.dot(hx, hy, 2.3, this.color, intro * (0.4 + 0.6 * hd));
      } else {
        const B = this.pt(arc.b);
        this.pulseRing(B[0], B[1], (life - 1) / 0.6, intro * (0.2 + 0.7 * B[2]));
        this.dot(B[0], B[1], 2.2, this.accent, intro * fade * (0.2 + 0.7 * B[2]));
      }
      return true;
    });
  };

  /* ═══════ geo / knot ═══════ */
  Stage.prototype.drawGeo = function (now, intro) {
    this.glow(this.R * 1.4, 0.07 * intro);
    this.strokeSegs(this.segs, this.color, 1, 0.55 * intro);
    this.fillPoints(this.verts, this.color, 2, 0.9 * intro);
    // counter-rotating core
    const a2 = -this.t * 0.6, b2 = this.t * 0.35 + 0.5;
    const r1 = [Math.cos(b2), Math.sin(b2), Math.cos(a2), Math.sin(a2)];
    const r2 = [Math.cos(a2), Math.sin(a2), Math.cos(b2), Math.sin(b2)];
    this.strokeSegs(this.core, this.accent, 1.3, 0.95 * intro, r1);
    this.strokeSegs(this.coreInner, this.accent, 0.8, 0.35 * intro, r2);
  };

  Stage.prototype.drawKnot = function (now, intro) {
    this.glow(this.R * 1.4, 0.07 * intro);
    this.strokeSegs(this.strands[0], this.color, 1.7, 0.95 * intro);
    this.strokeSegs(this.strands[1], this.color, 0.8, 0.5 * intro);
    this.strokeSegs(this.strands[2], this.color, 0.8, 0.5 * intro);
    const ctx = this.ctx;
    for (let k = 0; k < 2; k++) {
      const head = (this.t * 0.09 + k * 0.5) % 1;
      ctx.beginPath();
      let hx = 0, hy = 0, hd = 0;
      for (let i = 0; i <= 24; i++) {
        const [x, y, d] = this.pt(knotPoint((head - (24 - i) * 0.004) * TAU, 2, 3));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        hx = x; hy = y; hd = d;
      }
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.globalAlpha = intro * (0.3 + 0.7 * hd);
      ctx.stroke();
      ctx.globalAlpha = 1;
      this.dot(hx, hy, 7, this.accent, intro * 0.2 * hd);
      this.dot(hx, hy, 2.6, this.accent, intro * (0.4 + 0.6 * hd));
    }
  };

  /* ═══════ sync: online → offline (queueing) → reconnect (flush) ═══════ */
  Stage.prototype.drawSync = function (now, intro) {
    const p = clamp(parseFloat(this.canvas.dataset.progress || '0'), 0, 1);
    const off = smooth(0.3, 0.38, p) * (1 - smooth(0.64, 0.72, p)); // 0 online … 1 offline
    const flush = smooth(0.68, 0.96, p); // reconnect: queued sales fly to the cloud
    const queued = Math.round(smooth(0.36, 0.62, p) * 5);
    const synced = smooth(0.9, 1, p);
    const ctx = this.ctx;

    this.strokeSegs(this.floor, this.color, 0.7, 0.18 * intro);

    // cloud
    const C = this.pt(this.cloudPos);
    this.glow(this.R * (0.7 + synced * 0.5), (0.08 + 0.18 * synced) * (1 - off * 0.8) * intro, C[0], C[1]);
    this.strokeSegs(this.cloud, off > 0.5 ? this.color : this.accent, 1, (0.85 - off * 0.55) * intro);

    const cloudBottom = [this.cloudPos[0], this.cloudPos[1] - 0.3, this.cloudPos[2]];
    this.terms.forEach((term, ti) => {
      this.strokeSegs(term.body, this.color, 1.1, 0.9 * intro);
      this.strokeSegs(term.ui, this.color, 0.8, 0.6 * intro);
      this.strokeSegs(term.keys, this.accent, 0.9, 0.85 * intro);

      // link line: solid when online, dashed + broken when offline
      ctx.setLineDash(off > 0.5 ? [4 * this.dpr, 6 * this.dpr] : []);
      this.strokeSegs([...term.top, ...cloudBottom], off > 0.5 ? this.accent : this.color, 1, (0.55 - off * 0.25) * intro);
      ctx.setLineDash([]);

      const mid = this.pt([(term.top[0] + cloudBottom[0]) / 2, (term.top[1] + cloudBottom[1]) / 2, (term.top[2] + cloudBottom[2]) / 2]);
      if (off > 0.05) {
        const s = 5 * this.dpr;
        ctx.strokeStyle = this.accent; ctx.lineWidth = 1.6 * this.dpr; ctx.globalAlpha = off * intro;
        ctx.beginPath(); ctx.moveTo(mid[0] - s, mid[1] - s); ctx.lineTo(mid[0] + s, mid[1] + s); ctx.moveTo(mid[0] + s, mid[1] - s); ctx.lineTo(mid[0] - s, mid[1] + s); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // live packets while online
      const online = 1 - off;
      if (online > 0.05 && flush < 0.05) {
        for (let k = 0; k < 3; k++) {
          const u = (this.t * 0.45 + k / 3 + ti * 0.21) % 1;
          const [x, y, d] = this.pt([lerp(term.top[0], cloudBottom[0], u), lerp(term.top[1], cloudBottom[1], u), lerp(term.top[2], cloudBottom[2], u)]);
          this.dot(x, y, 2.4, this.accent, online * intro * (0.5 + 0.5 * d) * Math.sin(u * Math.PI));
        }
      }

      // status light on each terminal
      const L = this.pt([term.pos[0] - 0.24, term.pos[1] + 0.42, term.pos[2] + 0.03]);
      const blink = off > 0.5 ? 0.4 + 0.6 * Math.abs(Math.sin(this.t * 4)) : 1;
      this.dot(L[0], L[1], 2.6, off > 0.5 ? this.accent : this.color, intro * blink);

      // queued sales stack up beside the till, then fly home on reconnect
      const count = p > 0.67 ? 5 : queued;
      for (let j = 0; j < count; j++) {
        const stackPos = [term.pos[0] + 0.32, term.pos[1] - 0.12 + j * 0.1, term.pos[2] + 0.05];
        const f = easeInOut(clamp(flush * 1.9 - j * 0.18 - ti * 0.08, 0, 1));
        if (f >= 1) continue;
        const pos = [lerp(stackPos[0], cloudBottom[0], f), lerp(stackPos[1], cloudBottom[1], f) + Math.sin(f * Math.PI) * 0.25, lerp(stackPos[2], cloudBottom[2], f)];
        const sz = 0.075 * (1 - f * 0.5);
        this.strokeSegs(box(pos[0], pos[1], pos[2], sz, sz * 0.8, sz), this.accent, 1.1, intro * 0.95);
      }
    });

    if (synced > 0) {
      this.pulseRing(C[0], C[1], (this.t * 0.8) % 1, synced * intro);
      this.dot(C[0], C[1], 3.2, this.accent, synced * intro);
    }
  };

  /* ═══════ service minis ═══════ */
  Stage.prototype.drawPos = function (now, intro) {
    this.glow(this.R * 1.2, 0.07 * intro);
    this.strokeSegs(this.body, this.color, 1.2, 0.95 * intro);
    this.strokeSegs(this.ui, this.color, 0.9, 0.6 * intro);
    // keys light up one after another, like a cashier ringing up a sale
    const active = Math.floor(this.t * 2.2) % 6;
    for (let i = 0; i < 6; i++) {
      const seg = this.keys.slice(i * 24, i * 24 + 24);
      this.strokeSegs(seg, this.accent, i === active ? 1.8 : 0.9, (i === active ? 1 : 0.55) * intro);
    }
    // receipt printing out of the base
    const len = 0.2 + 0.35 * ((this.t * 0.3) % 1);
    const [rx, ry, rz] = this.receipt;
    const paper = [].concat(rect(rx, ry + len / 2, rz, 0.26, len), [rx - 0.08, ry + len - 0.08, rz, rx + 0.08, ry + len - 0.08, rz, rx - 0.08, ry + len - 0.15, rz, rx + 0.04, ry + len - 0.15, rz]);
    this.strokeSegs(paper, this.color, 0.9, 0.7 * intro);
  };

  Stage.prototype.drawPhone = function (now, intro) {
    this.glow(this.R * 1.1, 0.07 * intro);
    this.strokeSegs(this.body, this.color, 1.3, 0.95 * intro);
    this.strokeSegs(this.ui, this.color, 0.9, 0.6 * intro);
    const active = Math.floor(this.t * 0.8) % 3;
    this.dots.forEach((d, i) => { const P = this.pt(d); this.dot(P[0], P[1], i === active ? 3 : 2, i === active ? this.accent : this.color, intro); });
    // notification card sliding down from the top edge
    const ph = (this.t * 0.35) % 1;
    const y = 0.72 - smooth(0, 0.2, ph) * 0.14 + smooth(0.75, 1, ph) * 0.3;
    const a = smooth(0, 0.15, ph) * (1 - smooth(0.75, 0.95, ph));
    this.strokeSegs(rect(0, y, 0.09, 0.5, 0.13), this.accent, 1.4, a * intro);
    this.strokeSegs([-0.18, y, 0.09, 0.12, y, 0.09], this.accent, 1, a * intro);
  };

  Stage.prototype.drawBars = function (now, intro) {
    this.glow(this.R * 1.2, 0.06 * intro);
    this.strokeSegs(this.floor, this.color, 0.7, 0.3 * intro);
    const top = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const h = (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(this.t * 1.1 + i * 0.9 + j * 1.7))) * intro;
        const x = -0.75 + i * 0.5, z = -0.5 + j * 0.5;
        this.strokeSegs(box(x, -0.6 + h / 2, z, 0.26, h, 0.26), j === 0 ? this.accent : this.color, j === 0 ? 1.2 : 0.9, j === 0 ? 0.95 : 0.6);
        if (j === 0) top.push([x, -0.6 + h + 0.12, z]);
      }
    }
    // trend line over the accent series
    const segs = [];
    for (let i = 0; i < top.length - 1; i++) segs.push(...top[i], ...top[i + 1]);
    this.strokeSegs(segs, this.accent, 1.4, 0.9 * intro);
    top.forEach((p) => { const P = this.pt(p); this.dot(P[0], P[1], 2.4, this.accent, intro); });
  };

  Stage.prototype.drawNeural = function (now, intro) {
    this.glow(this.R * 1.2, 0.06 * intro);
    this.strokeSegs(this.edges, this.color, 0.7, 0.32 * intro);
    this.fillPoints(this.nodes, this.color, 3.2, 0.95 * intro);
    // signals hop layer to layer
    if (!this.reduced && this.pulses.length < 7 && Math.random() < 0.08) {
      const a = this.layers[0][(Math.random() * 3) | 0];
      this.pulses.push({ l: 0, a, b: this.layers[1][(Math.random() * 5) | 0], u: 0 });
    }
    this.pulses = this.pulses.filter((p) => {
      p.u += 0.025 * (1 + this.boost);
      if (p.u >= 1) {
        if (p.l >= 2) { const B = this.pt(p.b); this.pulseRing(B[0], B[1], 0.3, intro); return false; }
        p.l++; p.a = p.b; p.u = 0;
        const next = this.layers[p.l + 1];
        p.b = next[(Math.random() * next.length) | 0];
      }
      const [x, y, d] = this.pt([lerp(p.a[0], p.b[0], p.u), lerp(p.a[1], p.b[1], p.u), lerp(p.a[2], p.b[2], p.u)]);
      this.dot(x, y, 2.6, this.accent, intro * (0.5 + 0.5 * d));
      return true;
    });
  };

  Stage.prototype.drawRails = function (now, intro) {
    this.glow(this.R * 1.2, 0.08 * intro);
    const t = this.t;
    const rings = [
      [0.95, rotVec([1, 0, 0], 'y', t * 0.7), rotVec([0, 1, 0], 'y', t * 0.7), this.color],
      [0.78, rotVec([0, 1, 0], 'x', t * 0.9), rotVec([0, 0, 1], 'x', t * 0.9), this.color],
      [0.6, rotVec([1, 0, 0], 'z', -t * 1.2), rotVec([0, 0, 1], 'z', -t * 1.2), this.accent],
    ];
    rings.forEach(([r, u, v, col]) => this.strokeSegs(ring(r, u, v, 72), col, 1.1, 0.85 * intro));
    // the coin at the centre, spinning on its edge
    const cu = rotVec([1, 0, 0], 'y', t * 2.2), cv = [0, 1, 0];
    this.strokeSegs(ring(0.3, cu, cv, 48), this.accent, 1.6, intro);
    this.strokeSegs(ring(0.22, cu, cv, 40), this.accent, 0.8, 0.6 * intro);
    // tiny nodes riding the outer ring = settled transactions
    for (let k = 0; k < 3; k++) {
      const a = t * 1.3 + (k * TAU) / 3, [, u, v] = rings[0];
      const P = this.pt([0.95 * (Math.cos(a) * u[0] + Math.sin(a) * v[0]), 0.95 * (Math.cos(a) * u[1] + Math.sin(a) * v[1]), 0.95 * (Math.cos(a) * u[2] + Math.sin(a) * v[2])]);
      this.dot(P[0], P[1], 2.6, this.accent, intro * (0.4 + 0.6 * P[2]));
    }
  };

  Stage.prototype.drawStack = function (now, intro) {
    this.glow(this.R * 1.2, 0.06 * intro);
    const active = Math.floor(this.t * 0.7) % 3;
    // shared platform spine
    this.strokeSegs([0, -0.85, 0, 0, 0.85, 0], this.accent, 1.2, 0.7 * intro);
    this.platesY.forEach((y0, i) => {
      const y = y0 + Math.sin(this.t * 1.2 + i * 1.4) * 0.04 + (1 - intro) * (i - 1) * 0.4;
      const on = i === active;
      this.strokeSegs(box(0, y, 0, 1.4, 0.06, 0.95), on ? this.accent : this.color, on ? 1.4 : 1, on ? 1 : 0.6 * intro);
      let cells = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cells = cells.concat(rectFlat(-0.42 + c * 0.42, y + 0.035, -0.22 + r * 0.44, 0.3, 0.3));
      this.strokeSegs(cells, on ? this.accent : this.color, 0.8, (on ? 0.85 : 0.35) * intro);
      const N = this.pt([0, y, 0]);
      this.dot(N[0], N[1], on ? 3.4 : 2.2, this.accent, intro);
    });
  };

  /* ═══════ eco: the home-hero product ecosystem ═══════ */
  Stage.prototype.satPos = function (sat) {
    const ang = sat.a + this.t * 0.13;
    return [Math.cos(ang) * sat.r, sat.y + Math.sin(this.t * 0.9 + sat.a) * 0.06, Math.sin(ang) * sat.r];
  };

  // Quadratic curve from a to b, lifted at the middle.
  const curve = (a, b, lift, u) => {
    const c = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
    const i = 1 - u;
    return [i * i * a[0] + 2 * i * u * c[0] + u * u * b[0], i * i * a[1] + 2 * i * u * c[1] + u * u * b[1], i * i * a[2] + 2 * i * u * c[2] + u * u * b[2]];
  };

  Stage.prototype.drawEco = function (now, intro) {
    const t = this.t, ctx = this.ctx;
    this.glow(this.R * 1.9, 0.09 * intro);
    this.fillPoints(this.dust, this.color, 1.1, 0.4 * intro);

    // turntable rotates slowly under everything; a progress arc sweeps the middle ring
    const spin = [this.rcx, this.rsx, Math.cos(this.yaw + t * 0.06), Math.sin(this.yaw + t * 0.06)];
    this.strokeSegs(this.plat, this.color, 0.8, 0.42 * intro, spin);
    const sweep = ((t * 0.18) % 1) * TAU, arc = [];
    for (let i = 0; i < 40; i++) {
      const a0 = (i / 40) * sweep, a1 = ((i + 1) / 40) * sweep;
      arc.push(Math.cos(a0) * 1.16, this.floorY, Math.sin(a0) * 1.16, Math.cos(a1) * 1.16, this.floorY, Math.sin(a1) * 1.16);
    }
    this.strokeSegs(arc, this.accent, 1.6, 0.85 * intro, spin);

    // links + packets: terminal hub ⇄ each satellite and the cloud
    const targets = this.sats.map((s) => [s.name, this.satPos(s)]).concat([['cloud', [0, this.cloudPos[1] - 0.2, 0]]]);
    targets.forEach(([name, p], i) => {
      const pts = [];
      for (let k = 0; k <= 20; k++) pts.push(curve(this.hub, p, 0.32, k / 20));
      const segs = [];
      for (let k = 0; k < 20; k++) segs.push(...pts[k], ...pts[k + 1]);
      ctx.setLineDash([3 * this.dpr, 5 * this.dpr]);
      this.strokeSegs(segs, this.color, 0.9, 0.5 * intro);
      ctx.setLineDash([]);
      for (let k = 0; k < 2; k++) {
        let u = (t * 0.32 + k * 0.5 + i * 0.17) % 1;
        if (k === 1) u = 1 - u; // one packet each way
        const [x, y, d] = this.pt(curve(this.hub, p, 0.32, u));
        this.dot(x, y, 5, this.accent, 0.15 * intro * d);
        this.dot(x, y, 2.2, k ? this.color : this.accent, intro * (0.4 + 0.6 * d) * Math.sin(u * Math.PI));
      }
    });

    // terminal on the turntable (keys ring up a sale)
    this.strokeSegs(this.term.body, this.color, 1.3, 0.95 * intro);
    this.strokeSegs(this.term.ui, this.color, 0.9, 0.6 * intro);
    const active = Math.floor(t * 2.2) % 6;
    for (let i = 0; i < 6; i++) this.strokeSegs(this.term.keys.slice(i * 24, i * 24 + 24), this.accent, i === active ? 1.8 : 0.9, (i === active ? 1 : 0.55) * intro);
    const H = this.pt(this.hub);
    this.pulseRing(H[0], H[1], (t * 0.7) % 1, 0.8 * intro);

    // cloud spinning on its own axis
    this.strokeSegs(this.cloud, this.accent, 1, 0.85 * intro, [this.rcx, this.rsx, Math.cos(this.yaw + t * 0.5), Math.sin(this.yaw + t * 0.5)]);

    // satellites
    this.sats.forEach((sat) => {
      const [x, y, z] = this.satPos(sat);
      if (sat.name === 'phone') {
        const body = move(box(0, 0, 0, 0.3, 0.56, 0.035), x, y, z);
        const scr = move([].concat(rect(0, 0.02, 0.02, 0.24, 0.44), [-0.08, 0.16, 0.02, 0.08, 0.16, 0.02, -0.08, 0.08, 0.02, 0.04, 0.08, 0.02]), x, y, z);
        this.strokeSegs(body, this.color, 1.1, 0.95 * intro);
        this.strokeSegs(scr, this.color, 0.8, 0.6 * intro);
        const ph = (t * 0.4) % 1, a = smooth(0, 0.15, ph) * (1 - smooth(0.7, 0.9, ph));
        this.strokeSegs(move(rect(0, 0.3 - smooth(0, 0.2, ph) * 0.08, 0.04, 0.22, 0.07), x, y, z), this.accent, 1.2, a * intro);
      } else if (sat.name === 'dash') {
        let segs = rectFlat(x, y - 0.18, z, 0.62, 0.4);
        const tops = [];
        for (let i = 0; i < 4; i++) {
          const h = 0.06 + 0.28 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.1));
          const bx = x - 0.21 + i * 0.14;
          segs = segs.concat(box(bx, y - 0.18 + h / 2, z, 0.08, h, 0.08));
          tops.push([bx, y - 0.18 + h + 0.04, z]);
        }
        this.strokeSegs(segs, this.color, 1, 0.85 * intro);
        const trend = [];
        for (let i = 0; i < 3; i++) trend.push(...tops[i], ...tops[i + 1]);
        this.strokeSegs(trend, this.accent, 1.4, 0.9 * intro);
      } else {
        const cu = rotVec([1, 0, 0], 'y', t * 1.8);
        this.strokeSegs(ring(0.17, cu, [0, 1, 0], 40, [x, y, z]), this.accent, 1.5, intro);
        this.strokeSegs(ring(0.12, cu, [0, 1, 0], 32, [x, y, z]), this.accent, 0.8, 0.6 * intro);
        this.strokeSegs(ring(0.3, [1, 0, 0], [0, 0, 1], 48, [x, y - 0.02, z]), this.color, 0.8, 0.45 * intro);
      }
    });

    // pin the HTML labels to their 3D anchors
    const place = (name, p, minDepth) => {
      const el = this.anchors[name];
      if (!el) return;
      const [x, y, d] = this.pt(p);
      const vis = clamp((d - minDepth) / 0.15, 0, 1) * intro;
      const offset = el.dataset.align === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
      el.style.transform = `translate3d(${(x / this.dpr).toFixed(1)}px, ${(y / this.dpr).toFixed(1)}px, 0) ${offset}`;
      el.style.opacity = vis.toFixed(3);
    };
    place('terminal', [0, this.floorY, 1.0], -1);
    place('cloud', [0, this.cloudPos[1] + 0.3, 0], -1);
    this.sats.forEach((sat) => { const p = this.satPos(sat); place(sat.name, [p[0], p[1] + (sat.name === 'phone' ? 0.42 : 0.3), p[2]], 0.38); });
  };

  /* ═══════ omvi: point-cloud wordmark (home hero) ═══════ */
  // "OMVI" is rasterised once in the logotype face and sampled into a few thousand
  // points with real depth — a dense front face, extruded edge walls and a faint
  // back face — then simulated as springs: dust → printed by a crimson beam while
  // the page loads → settled (breathing, LiDAR sweeps, pointer ripple) → back to
  // dust as the hero scrolls away.
  Stage.prototype.buildOmvi = function () {
    this.ready = false;
    const go = () => {
      if (this.ready) return;
      try { this.sampleOmvi(); } catch (e) { return; } // CSS wordmark stays as the fallback
      this.ready = true;
      const hero = this.canvas.closest('.hero');
      if (hero) hero.classList.add('omvi-live');
      if (this.reduced) this.render(0);
    };
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('800 100px Archivo', 'OMVI'), new Promise((r) => setTimeout(r, 3000))]).then(go, go);
    } else go();
  };

  Stage.prototype.sampleOmvi = function () {
    const FS = 260;
    const off = document.createElement('canvas');
    const g = off.getContext('2d', { willReadFrequently: true });
    const setFont = () => { g.font = `800 ${FS}px Archivo, Inter, sans-serif`; if ('fontStretch' in g) g.fontStretch = 'expanded'; };
    setFont();
    const m = g.measureText('OMVI');
    const asc = Math.ceil(m.actualBoundingBoxAscent || FS * 0.72);
    const desc = Math.ceil(m.actualBoundingBoxDescent || 1);
    const left = Math.ceil(m.actualBoundingBoxLeft || 0);
    const right = Math.ceil(m.actualBoundingBoxRight || m.width);
    const pad = 6;
    off.width = left + right + pad * 2;
    off.height = asc + desc + pad * 2;
    setFont();
    g.fillStyle = '#ffffff';
    g.textBaseline = 'alphabetic';
    g.fillText('OMVI', pad + left, pad + asc);
    const W = off.width, H = off.height;
    const img = g.getImageData(0, 0, W, H).data;
    const ink = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      return x >= 0 && y >= 0 && x < W && y < H && img[(y * W + x) * 4 + 3] > 127;
    };
    let inked = 0;
    for (let i = 3; i < img.length; i += 4) if (img[i] > 127) inked++;
    const budget = (this.small ? 1100 : innerWidth > 1400 ? 3800 : 2800) * QUALITY.points;
    const step = Math.max(1.5, Math.sqrt(inked / budget));

    // model units: cap height = 1, baseline at y = -0.5
    const baseY = pad + asc;
    const toX = (x) => x / asc;
    const toY = (y) => (baseY - y) / asc - 0.5;
    const DEPTH = 0.32;
    const pts = []; // x, y, z, role (0 face, 2 back, 3 dot), edge
    let row = 0;
    for (let y = pad; y <= baseY + desc; y += step * 0.866, row++) {
      // hex packing: every other row shifted half a step — even, organic, no moiré
      for (let x = (row % 2) * step * 0.5; x < W; x += step) {
        if (!ink(x, y)) continue;
        const X = toX(x + (Math.random() - 0.5) * step * 0.18);
        const Y = toY(y + (Math.random() - 0.5) * step * 0.18);
        const e = step * 1.1;
        const edge = !ink(x + e, y) || !ink(x - e, y) || !ink(x, y + e) || !ink(x, y - e) ? 1 : 0;
        pts.push(X, Y, 0, 0, edge);
        if (!edge && Math.random() < 0.16) pts.push(X, Y, -DEPTH, 2, 0);
      }
    }
    // the brand dot: a crimson disc, its rim extruded like the letters
    const r = 0.085, dcx = toX(pad + left + right) + 0.075 + r, dcy = -0.5 + r;
    const dn = this.small ? 60 : 140;
    for (let i = 0; i < dn; i++) {
      const rr = r * Math.sqrt((i + 0.5) / dn), a = i * 2.39996;
      pts.push(dcx + Math.cos(a) * rr, dcy + Math.sin(a) * rr, 0, 3, 0);
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      pts.push(dcx + Math.cos(a) * r, dcy + Math.sin(a) * r, 0, 3, 1);
    }

    const F = 5, n = pts.length / F;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < n; i++) { const x = pts[i * F]; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const shift = (minX + maxX) / 2;
    this.unitsW = maxX - minX;
    this.depth = DEPTH;
    this.n = n;
    this.ox = new Float32Array(n); this.oy = new Float32Array(n); this.oz = new Float32Array(n);
    this.pk = new Uint8Array(n); // per-point role: 0 face, 2 back, 3 dot
    this.edge = new Uint8Array(n); // front points on a glyph edge carry an extrusion wall line
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.home3 = new Float32Array(n * 3);
    this.heat = new Float32Array(n);
    this.on = new Uint8Array(n);
    this.seed = new Float32Array(n);
    this.sx = new Float32Array(n); this.sy = new Float32Array(n); this.sd = new Float32Array(n);
    this.bx = new Float32Array(n); this.by = new Float32Array(n);
    const U = this.unitsW;
    for (let i = 0; i < n; i++) {
      const x = pts[i * F] - shift, y = pts[i * F + 1], z = pts[i * F + 2];
      this.ox[i] = x; this.oy[i] = y; this.oz[i] = z;
      this.pk[i] = pts[i * F + 3];
      this.edge[i] = pts[i * F + 4];
      this.seed[i] = Math.random();
      // dust home: a loose ellipsoid around the word (also where it dissolves to)
      const u = Math.random() * TAU, v = Math.acos(2 * Math.random() - 1), rr = 0.35 + Math.random() * 0.65;
      const i3 = i * 3;
      this.home3[i3] = Math.cos(u) * Math.sin(v) * rr * U * 0.85;
      this.home3[i3 + 1] = Math.cos(v) * rr * 1.5;
      this.home3[i3 + 2] = Math.sin(u) * Math.sin(v) * rr * 1.6;
      if (this.reduced) {
        this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.on[i] = 1;
      } else {
        this.pos[i3] = this.home3[i3]; this.pos[i3 + 1] = this.home3[i3 + 1]; this.pos[i3 + 2] = this.home3[i3 + 2];
      }
    }
    this.buckets = Array.from({ length: 12 }, () => new Int32Array(n));
    this.bucketN = new Int32Array(12);
  };

  Stage.prototype.drawOmvi = function () {
    if (!this.ready) return;
    const ctx = this.ctx, n = this.n, w = this.w, h = this.h, dpr = this.dpr;
    const ds = this.canvas.dataset;
    const num = (v, d) => { const f = parseFloat(v); return isFinite(f) ? clamp(f, 0, 1) : d; };
    const print = this.reduced ? 1 : num(ds.print, 1);
    const settle = this.reduced ? 1 : num(ds.settle, 1);
    // cached on resize — measuring the layout every frame stalls the pointer and scrolling
    const rect = { left: this.boxLeft || 0, top: (this.boxTop || 0) - scrollY, height: this.h / dpr };
    const exit = this.reduced ? 0 : clamp(-rect.top / (rect.height * 0.85), 0, 1);
    const ex = exit * exit;
    const t = this.t;

    // layout: big and centred while it prints, then settles to the foot of the hero
    const U = this.unitsW;
    const mobile = w / dpr < 760;
    const capLoad = Math.min((w * (mobile ? 0.86 : 0.64)) / U, h * 0.3);
    const capFinal = mobile ? (w * 0.84) / U : Math.min((w * 0.6) / U, h * 0.25);
    const cap = lerp(capLoad, capFinal, settle);
    const cx = w / 2;
    const cyFinal = mobile ? h * 0.72 : h - h * 0.075 - capFinal * 0.5;
    const cy = lerp(h * 0.5, cyFinal, settle);

    // camera: slow sway + pointer tilt, so the extruded walls catch the eye
    const yaw = Math.sin(t * 0.35) * 0.07 + this.mx * 0.16;
    const pitch = 0.12 + Math.sin(t * 0.27) * 0.03 + this.my * 0.08;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const CAM = 7, ZC = -this.depth / 2;
    const proj = (x, y, z, out) => {
      z -= ZC;
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const k = CAM / (CAM - z2);
      out[0] = cx + x1 * k * cap; out[1] = cy - y1 * k * cap; out[2] = z2;
      return out;
    };
    const q = [0, 0, 0];

    // print beam height (units): baseline → cap top
    const beamY = -0.56 + print * 1.12;
    // LiDAR sweep: every 7 s a vertical beam crosses the word
    const phase = t % 7;
    const sweeping = settle >= 1 && !this.reduced && phase < 2.4;
    const scanX = -U * 0.62 + (phase / 2.4) * U * 1.24;

    const mxp = (pointer.cx - rect.left) * dpr, myp = (pointer.cy - rect.top) * dpr;
    const RAD = 120 * dpr, RAD2 = RAD * RAD;
    const hover = pointer.active && !this.reduced;
    const P = this.pos, V = this.vel, D = this.home3;

    // Sleep: the spring sim only runs while something is happening (loading, settling,
    // a sweep, the pointer moving, the hero scrolling) and for a moment after.
    const moved = hover && Math.abs(pointer.cx - (this.lastPx || 0)) + Math.abs(pointer.cy - (this.lastPy || 0)) > 0.5;
    this.lastPx = pointer.cx; this.lastPy = pointer.cy;
    if (print < 1 || settle < 1 || sweeping || moved || Math.abs(ex - (this.lastEx || 0)) > 1e-4) this.wakeUntil = t + 1.6;
    this.lastEx = ex;
    const awake = t < (this.wakeUntil || 0);
    this.restable = false;

    if (!this.reduced && awake) {
      // fixed 60 Hz sub-steps keep the motion identical on every refresh rate
      const steps = clamp(Math.round((this.dt || 1 / 60) * 60), 1, 2);
      for (let st = 0; st < steps; st++) {
        for (let i = 0; i < n; i++) {
          const i3 = i * 3;
          if (!this.on[i] && this.oy[i] <= beamY) { this.on[i] = 1; this.heat[i] = 1; V[i3 + 2] += 0.05; }
          const sd = this.seed[i];
          let tx, ty, tz, kS;
          if (this.on[i]) {
            tx = this.ox[i] + (D[i3] - this.ox[i]) * ex;
            ty = this.oy[i] + (D[i3 + 1] - this.oy[i]) * ex;
            tz = this.oz[i] + (D[i3 + 2] - this.oz[i]) * ex;
            kS = 0.09;
            const near = hover && Math.abs(this.sx[i] - mxp) < RAD && Math.abs(this.sy[i] - myp) < RAD;
            if (!near && this.heat[i] < 0.02 &&
                Math.abs(tx - P[i3]) + Math.abs(ty - P[i3 + 1]) + Math.abs(tz - P[i3 + 2]) < 2e-4 &&
                Math.abs(V[i3]) + Math.abs(V[i3 + 1]) + Math.abs(V[i3 + 2]) < 2e-4) {
              if (!(sweeping && Math.abs(this.ox[i] - scanX) < 0.14)) continue;
            }
          } else {
            const a = t * 0.06 + sd * TAU;
            tx = D[i3] + Math.sin(a) * 0.09; ty = D[i3 + 1] + Math.cos(a * 1.3) * 0.07; tz = D[i3 + 2];
            kS = 0.02;
          }
          if (hover && this.on[i] && st === 0) {
            const dx = this.sx[i] - mxp, dy = this.sy[i] - myp, d2 = dx * dx + dy * dy;
            if (d2 < RAD2 && d2 > 1) {
              const d = Math.sqrt(d2), f = 1 - d / RAD, ff = f * f * 0.035 * steps;
              V[i3] += (dx / d) * ff; V[i3 + 1] -= (dy / d) * ff; V[i3 + 2] += ff * 0.6;
              if (f * 0.9 > this.heat[i]) this.heat[i] = f * 0.9;
            }
          }
          V[i3] = (V[i3] + (tx - P[i3]) * kS) * 0.84;
          V[i3 + 1] = (V[i3 + 1] + (ty - P[i3 + 1]) * kS) * 0.84;
          V[i3 + 2] = (V[i3 + 2] + (tz - P[i3 + 2]) * kS) * 0.84;
          P[i3] += V[i3]; P[i3 + 1] += V[i3 + 1]; P[i3 + 2] += V[i3 + 2];
          if (sweeping && this.on[i]) {
            const dd = Math.abs(this.ox[i] - scanX);
            if (dd < 0.14) { const hh = (1 - dd / 0.14) * 0.85; if (hh > this.heat[i]) this.heat[i] = hh; }
          }
          this.heat[i] *= 0.955;
        }
      }
    }

    // project front points (and the back end of each wall), bucket by colour/alpha
    const B = this.buckets, BN = this.bucketN;
    BN.fill(0);
    const DEPTH = this.depth;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      proj(P[i3], P[i3 + 1], P[i3 + 2], q);
      this.sx[i] = q[0]; this.sy[i] = q[1]; this.sd[i] = q[2];
      if (this.edge[i]) { proj(P[i3], P[i3 + 1], P[i3 + 2] - DEPTH, q); this.bx[i] = q[0]; this.by[i] = q[1]; }
      const kd = this.pk[i];
      // light from above: the top of each letter reads a touch brighter
      const lit = kd === 0 ? 0.78 + 0.22 * clamp(this.oy[i] + 0.5, 0, 1) : 1;
      let a = this.on[i] ? (kd === 2 ? 0.22 : 1) * lit : 0.16;
      a *= clamp(0.62 + this.sd[i] * 1.1, 0.25, 1) * (1 - ex * 0.55);
      const hot = kd === 3 || this.heat[i] > 0.3;
      const b = (hot ? 6 : 0) + Math.min(5, Math.floor(a * 6));
      B[b][BN[b]++] = i;
    }

    // 1) extrusion walls: a fine line from every edge point back into depth
    ctx.lineWidth = 0.9 * dpr;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? this.accent : this.color;
      ctx.globalAlpha = (pass ? 0.55 : 0.3) * (1 - ex * 0.6);
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        if (!this.edge[i] || !this.on[i]) continue;
        const hot = this.pk[i] === 3 || this.heat[i] > 0.3;
        if (hot !== (pass === 1)) continue;
        ctx.moveTo(this.sx[i], this.sy[i]);
        ctx.lineTo(this.bx[i], this.by[i]);
        any = true;
      }
      if (any) ctx.stroke();
    }

    // 2) points: back face first (dim), then the front face on top
    const unit = clamp(cap / 150, 0.75, 1.7) * dpr;
    for (let layer = 0; layer < 2; layer++) {
      for (let b = 0; b < 12; b++) {
        const cnt = BN[b];
        if (!cnt) continue;
        ctx.fillStyle = b >= 6 ? this.accent : this.color;
        ctx.globalAlpha = ((b % 6) + 0.5) / 6;
        const list = B[b];
        ctx.beginPath();
        for (let j = 0; j < cnt; j++) {
          const i = list[j], kd = this.pk[i];
          if ((kd === 2) !== (layer === 0)) continue;
          const sz = unit * (kd === 3 ? 1.6 : kd === 2 ? 0.95 : 1.5) * (this.on[i] ? 1 : 0.8);
          ctx.rect(this.sx[i] - sz / 2, this.sy[i] - sz / 2, sz, sz);
        }
        ctx.fill();
      }
    }

    // beams: the horizontal print line while loading, the vertical LiDAR sweep after
    const beam = (x0, y0, x1, y1, alpha) => {
      ctx.strokeStyle = this.accent;
      ctx.globalAlpha = 0.18 * alpha; ctx.lineWidth = 7 * dpr;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalAlpha = 0.9 * alpha; ctx.lineWidth = 1.3 * dpr;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    };
    if (!this.reduced && print > 0 && print < 1) {
      const a0 = proj(-U * 0.62, beamY, 0, [0, 0, 0]), a1 = proj(U * 0.62, beamY, 0, [0, 0, 0]);
      beam(a0[0], a0[1], a1[0], a1[1], 1);
    }
    if (sweeping) {
      const fade = Math.sin((phase / 2.4) * Math.PI) * 0.6;
      const a0 = proj(scanX, -0.62, 0, [0, 0, 0]), a1 = proj(scanX, 0.62, 0, [0, 0, 0]);
      beam(a0[0], a0[1], a1[0], a1[1], fade);
    }
    ctx.globalAlpha = 1;
  };

  /* ═══════ frame ═══════ */
  Stage.prototype.render = function (now) {
    if (!this.w) { this.resize(); if (!this.w) return; }
    // Hero canvases sit at the top of the page: once scrolled past, stop drawing outright.
    if ((this.kind === 'omvi' || this.kind === 'eco') && this.boxTop !== undefined) {
      const top = this.boxTop - scrollY;
      if (top + this.h / this.dpr <= 1 || top >= innerHeight) return;
    }
    // A resting point-cloud OMVI keeps its last frame: no clear, no redraw, until the
    // pointer, scroll, loader state or the next LiDAR sweep changes something.
    if (this.kind === 'omvi' && this.ready && !this.reduced && this.restable) {
      const dt = this.last === null ? 0 : clamp(now - this.last, 0, 50) / 1000;
      this.last = now;
      this.t += dt;
      const ds = this.canvas.dataset;
      const sig = pointer.cx + '|' + pointer.cy + '|' + scrollY + '|' + ds.print + '|' + ds.settle + '|' + (this.t % 7 < 2.4);
      if (sig === this.restSig) return;
      this.restSig = sig;
    } else {
      this.restSig = null;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.startedAt === null && !this.reduced) return;

    const age = this.reduced ? 99999 : now - this.startedAt;
    const intro = easeOut(age / 1800);

    // hover boost + accumulated time (so speeding up never jumps the animation)
    this.boost += ((this.canvas.dataset.hover === '1' ? 1 : 0) - this.boost) * 0.06;
    const dt = this.last === null ? 0 : clamp(now - this.last, 0, 50) / 1000;
    this.last = now;
    if (!this.reduced) this.t += dt * (1 + this.boost * 1.8);
    this.dt = dt;

    // ease pointer for a weighty, inertial feel
    this.mx += (pointer.x - this.mx) * 0.09;
    this.my += (pointer.y - this.my) * 0.05;

    const m = MOTION[this.kind];
    const scroll = this.kind === 'globe' && !this.canvas.dataset.home ? clamp(scrollY / innerHeight, 0, 1.5) : 0;
    const spin = (1 - intro) * 2.4;
    const yaw = m.sway !== undefined
      ? m.yaw + Math.sin(this.t * 0.5) * m.sway + this.mx * 0.4 + spin
      : 0.6 + this.t * m.spin + this.mx * 0.45 + spin + scroll * 0.9;
    const pitch = m.pitch + this.my * 0.22 + scroll * 0.35 + (this.kind === 'knot' ? Math.sin(this.t * 0.3) * 0.3 : 0);

    this.cx = this.w / 2 + this.mx * this.w * 0.015;
    this.cy = this.h / 2 + this.my * this.h * 0.015;
    this.R = Math.min(this.w, this.h) * 0.3 * this.scale * (0.55 + 0.45 * intro) * (1 + scroll * 0.18);
    this.rcx = Math.cos(pitch); this.rsx = Math.sin(pitch); this.rcy = Math.cos(yaw); this.rsy = Math.sin(yaw);
    this.yaw = yaw; this.pitch = pitch;

    const draw = { globe: this.drawGlobe, geo: this.drawGeo, knot: this.drawKnot, sync: this.drawSync, pos: this.drawPos,
      phone: this.drawPhone, bars: this.drawBars, neural: this.drawNeural, rails: this.drawRails, stack: this.drawStack, eco: this.drawEco, omvi: this.drawOmvi }[this.kind];
    draw.call(this, now, intro);
  };

  /* ═══════ boot ═══════ */
  function boot() {
    const canvases = document.querySelectorAll('canvas[data-3d]');
    if (!canvases.length || !canvases[0].getContext) return;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    const stages = Array.from(canvases).map((c) => new Stage(c, reduced));
    const now = () => performance.now();

    const renderAll = (t) => stages.forEach((s) => s.visible && s.render(t));

    const onResize = () => { stages.forEach((s) => s.resize()); if (reduced) stages.forEach((s) => s.render(0)); };
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(onResize);
      stages.forEach((s) => ro.observe(s.canvas));
    } else {
      addEventListener('resize', onResize);
    }

    if (reduced) {
      stages.forEach((s) => s.render(0));
      // the sync story still follows the scroll position, one still frame at a time
      document.addEventListener('ov:progress', () => stages.forEach((s) => s.kind === 'sync' && s.render(0)));
      return;
    }

    // Each scene starts its intro the first time it scrolls into view. The home
    // hero globe (data-wait) holds for the preloader hand-off (ov:hero).
    let released = false;
    const io = 'IntersectionObserver' in window && new IntersectionObserver((entries) => entries.forEach((e) => {
      const s = stages.find((st) => st.canvas === e.target);
      if (!s) return;
      s.visible = e.isIntersecting;
      if (e.isIntersecting && (released || !s.canvas.hasAttribute('data-wait'))) s.start(now());
    }), { rootMargin: '0px 0px -10% 0px' });
    if (io) stages.forEach((s) => io.observe(s.canvas));
    else stages.forEach((s) => s.start(now()));

    const release = () => {
      released = true;
      stages.forEach((s) => { if (s.canvas.hasAttribute('data-wait') && s.visible) s.start(now()); });
    };
    document.addEventListener('ov:hero', release, { once: true });
    setTimeout(release, 4500);

    // Adaptive quality: if frames run long, drop pixel density (then particle count) so the
    // pointer and scroll stay responsive on slower laptops and phones.
    // It measures the time the 3D actually takes to draw (not the frame rate).
    let samples = [], settledAt = performance.now() + 1500;
    const adapt = (cost, t) => {
      if (t < settledAt) return;
      samples.push(cost);
      if (samples.length < 45) return;
      const med = samples.sort((a, b) => a - b)[22];
      samples = [];
      if (med > 9 && (QUALITY.big > 0.6 || QUALITY.dpr > 0.75)) {
        QUALITY.big = Math.max(0.6, QUALITY.big - 0.2);
        QUALITY.dpr = Math.max(0.75, QUALITY.dpr - 0.25);
        stages.forEach((s) => s.resize());
        settledAt = t + 1000;
      }
    };
    // 30 fps is plenty for slow ambient 3D and halves the processor work
    let lastFrame = 0;
    const loop = (t) => {
      if (t - lastFrame >= 31) {
        lastFrame = t;
        const t0 = performance.now();
        renderAll(t);
        adapt(performance.now() - t0, t);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
