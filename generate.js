#!/usr/bin/env node
/**
 * Builds every animated SVG in ./assets from config.json.
 *   node generate.js
 * No dependencies. All animation is SMIL (<animate>), which GitHub renders
 * inside <img> tags. Edit config.json, run this, commit.
 */
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const T = cfg.theme;
const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const MONO = "'JetBrains Mono','Fira Code','SF Mono',Consolas,'Liberation Mono','Courier New',monospace";
const SANS = "'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v, d = 3) => +Number(v).toFixed(d);
const len = s => [...String(s)].length;
const color = name => T[name] || name; // "accent3" -> hex, or a raw hex passes through
const ACCENTS = [T.accent, T.accent2, T.accent3, T.warm];

let seed = 11; // seeded so regenerating gives identical output
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const between = (a, b) => a + rnd() * (b - a);

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img">\n<defs>${defs}</defs>\n${body}\n</svg>\n`;

const write = (name, content) => {
  fs.writeFileSync(path.join(OUT, name), content);
  console.log('  ✓ assets/' + name);
};

/** <animate> driven by [seconds, value] points over a looping timeline of `dur` seconds. */
function track(attr, pts, dur, mode = 'discrete') {
  pts = pts.map(p => p.slice());
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
  if (pts[pts.length - 1][0] < dur) pts.push([dur, pts[pts.length - 1][1]]);
  const kt = pts.map(p => n(Math.min(1, p[0] / dur), 5)).join(';');
  const vals = pts.map(p => p[1]).join(';');
  return `<animate attributeName="${attr}" dur="${n(dur, 3)}s" repeatCount="indefinite" calcMode="${mode}" keyTimes="${kt}" values="${vals}"/>`;
}

/** Fade an element in at `s`, snap it away at `e`. */
const show = (s, e, dur, fade = 0.2) =>
  track('opacity', [[0, 0], [s, 0], [s + fade, 1], [e, 1], [e + 0.001, 0]], dur, 'linear');

/** Typewriter text revealed through an animated clip rect, with a following block cursor. */
function typed({ id, text, x, y, size = 18, fill, start, hideAt, dur, cps = 15, weight = 400, cursor }) {
  const chars = len(text), cw = size * 0.6, dt = 1 / cps, end = start + chars * dt;
  const wPts = [[0, 0]], xPts = [[0, x]];
  for (let k = 1; k <= chars; k++) {
    wPts.push([start + k * dt, k * cw]);
    xPts.push([start + k * dt, x + k * cw]);
  }
  wPts.push([hideAt, 0]);
  xPts.push([hideAt, x]);
  let out = `<clipPath id="${id}"><rect x="${x}" y="${n(y - size)}" width="0" height="${n(size * 1.5)}">${track('width', wPts, dur)}</rect></clipPath>`;
  out += `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${fill}" textLength="${n(chars * cw)}" xml:space="preserve" style="white-space:pre" clip-path="url(#${id})">${esc(text)}</text>`;
  if (cursor) {
    out += `<rect x="${x}" y="${n(y - size * 0.85)}" width="${n(size * 0.55)}" height="${n(size * 1.05)}" fill="${cursor}" opacity="0">${track('x', xPts, dur)}${track('opacity', [[0, 0], [start, 1], [Math.min(end + 0.4, hideAt), 0]], dur)}</rect>`;
  }
  return out;
}

/** A looping sine wave band. `W` must be a multiple of `period`. */
function wave({ W, H, y, amp, period, fill, opacity, dur, dir = 1 }) {
  let d = `M0 ${y} Q${period / 4} ${y - amp} ${period / 2} ${y}`;
  for (let x = period; x <= 2 * W; x += period / 2) d += ` T${x} ${y}`;
  d += ` V${H} H0 Z`;
  const [from, to] = dir > 0 ? [0, -W] : [-W, 0];
  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"><animateTransform attributeName="transform" type="translate" from="${from} 0" to="${to} 0" dur="${dur}s" repeatCount="indefinite"/></path>`;
}

/** Symbols drifting upward at random speeds. */
function floaters(symbols, W, H, count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const s = symbols[i % symbols.length];
    const dur = between(10, 20), size = between(14, 26);
    out += `<text x="${n(between(30, W - 30), 0)}" y="${H + 30}" font-family="${MONO}" font-size="${n(size, 0)}" fill="${ACCENTS[i % 4]}" fill-opacity="${n(between(0.12, 0.28), 2)}">${esc(s)}<animate attributeName="y" from="${H + 30}" to="-30" dur="${n(dur, 1)}s" begin="-${n(between(0, dur), 1)}s" repeatCount="indefinite"/></text>`;
  }
  return out;
}

// ---------- 1. banner ----------
function banner() {
  const W = 1000, H = 320, cx = 820, cy = 148;
  const p = cfg.profile;

  const defs = `
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.bg}"/><stop offset="1" stop-color="${T.panel}"/></linearGradient>
<linearGradient id="nm" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="600" y2="0" spreadMethod="reflect"><stop offset="0" stop-color="${T.accent}"/><stop offset=".5" stop-color="${T.accent2}"/><stop offset="1" stop-color="${T.accent3}"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="1080 0" dur="9s" repeatCount="indefinite"/></linearGradient>
<filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="38"/></filter>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="${T.border}" stroke-opacity=".35"/></pattern>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="20"/></clipPath>`;

  const drift = (vals, dur) => `<animateTransform attributeName="transform" type="translate" values="${vals}" dur="${dur}s" repeatCount="indefinite"/>`;
  const blobs = `
<circle cx="180" cy="70" r="140" fill="${T.accent}" fill-opacity=".26" filter="url(#blur)">${drift('0 0;70 40;0 0', 14)}</circle>
<circle cx="700" cy="300" r="150" fill="${T.accent2}" fill-opacity=".22" filter="url(#blur)">${drift('0 0;-60 -30;0 0', 17)}</circle>
<circle cx="${cx}" cy="${cy}" r="110" fill="${T.accent3}" fill-opacity=".13" filter="url(#blur)">${drift('0 0;20 20;0 0', 11)}</circle>`;

  // orbit
  const rings = [{ r: 72, dur: 24, dash: '4 9', dir: 1 }, { r: 112, dur: 38, dash: '2 10', dir: -1 }];
  let orbit = rings.map(g => `<circle cx="${cx}" cy="${cy}" r="${g.r}" stroke="${T.border}" stroke-width="1.5" stroke-dasharray="${g.dash}"/>`).join('');
  orbit += p.orbit.map(o => {
    const g = rings[o.ring], from = o.angle, to = o.angle + 360 * g.dir, nx = cx + g.r, ny = cy;
    return `<g><animateTransform attributeName="transform" type="rotate" from="${from} ${cx} ${cy}" to="${to} ${cx} ${cy}" dur="${g.dur}s" repeatCount="indefinite"/>
<circle cx="${nx}" cy="${ny}" r="17" fill="${T.panel}" stroke="${o.color}" stroke-width="2"/>
<text x="${nx}" y="${ny + 4.5}" text-anchor="middle" font-family="${SANS}" font-size="12" font-weight="700" fill="${o.color}">${esc(o.label)}<animateTransform attributeName="transform" type="rotate" from="${-from} ${nx} ${ny}" to="${-to} ${nx} ${ny}" dur="${g.dur}s" repeatCount="indefinite"/></text></g>`;
  }).join('');
  orbit += `<circle cx="${cx}" cy="${cy}" r="34" fill="${T.panel}" stroke="${T.accent}" stroke-opacity=".7" stroke-width="2"><animate attributeName="r" values="34;38;34" dur="3s" repeatCount="indefinite"/></circle>
<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="${MONO}" font-size="22" font-weight="700" fill="${T.accent}">${esc('</>')}</text>`;

  // typing cycle
  const cps = 18, hold = 1.8, gap = 0.35;
  let t = 0.4;
  const wins = p.typing.map(l => {
    const w = { start: t, hideAt: t + len(l) / cps + hold };
    t = w.hideAt + gap;
    return w;
  });
  const cycle = t;
  const cw = 22 * 0.6;
  const typing = p.typing.map((l, i) =>
    typed({ id: `t${i}`, text: l, x: 60 + cw * 2, y: 238, size: 22, fill: T.text, start: wins[i].start, hideAt: wins[i].hideAt, dur: cycle, cps, cursor: T.accent3 })
  ).join('');

  const waves =
    wave({ W, H, y: H - 46, amp: 12, period: 250, fill: T.accent, opacity: 0.16, dur: 16 }) +
    wave({ W, H, y: H - 34, amp: 10, period: 200, fill: T.accent2, opacity: 0.18, dur: 10, dir: -1 }) +
    wave({ W, H, y: H - 20, amp: 8, period: 500, fill: T.bg, opacity: 0.85, dur: 22 });

  const body = `<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#grid)"/>
${blobs}
${floaters(p.symbols, W, H, 14)}
${orbit}
<text x="60" y="66" font-family="${MONO}" font-size="16" fill="${T.muted}">${esc(p.greeting)}<animate attributeName="opacity" values="1;.55;1" dur="4s" repeatCount="indefinite"/></text>
<text x="60" y="130" font-family="${SANS}" font-size="54" font-weight="800" letter-spacing="-1" fill="url(#nm)">${esc(p.name)}</text>
<text x="62" y="172" font-family="${SANS}" font-size="20" fill="${T.text}" fill-opacity=".85">${esc(p.tagline)}</text>
<text x="60" y="238" font-family="${MONO}" font-size="22" font-weight="700" fill="${T.accent3}">$</text>
${typing}
${waves}
</g>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="19.5" stroke="${T.border}" stroke-width="1.5"/>`;
  write('banner.svg', svg(W, H, body, defs));
}

// ---------- 2. terminal ----------
function terminal() {
  const W = 900, rowH = 56, top = 84, size = 15, cps = 16, cw = size * 0.6;
  const blocks = cfg.terminal.blocks;
  const H = top + blocks.length * rowH + 40;

  let t = 0.9;
  const sched = blocks.map(b => {
    const cmdStart = t, outS = t + len(b.cmd) / cps + 0.3;
    t = outS + 0.7;
    return { cmdStart, outS };
  });
  const promptS = t, hide = promptS + 4.5, D = hide + 0.6, gone = hide + 0.55;

  let lines = '';
  blocks.forEach((b, i) => {
    const y = top + i * rowH, s = sched[i];
    lines += `<text x="28" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="700" fill="${T.accent3}" opacity="0">$${show(s.cmdStart, gone, D, 0.01)}</text>`;
    lines += typed({ id: `c${i}`, text: b.cmd, x: 28 + cw * 2, y, size, fill: T.text, start: s.cmdStart, hideAt: gone, dur: D, cps, cursor: T.accent3 });
    lines += `<text x="${28 + cw * 2}" y="${y + 25}" font-family="${MONO}" font-size="14" fill="${color(b.color)}" opacity="0" xml:space="preserve" style="white-space:pre">${esc(b.out)}${show(s.outS, gone, D, 0.25)}</text>`;
  });
  const py = top + blocks.length * rowH;
  lines += `<g opacity="0">${show(promptS, gone, D, 0.01)}
<text x="28" y="${py}" font-family="${MONO}" font-size="${size}" font-weight="700" fill="${T.accent3}">$</text>
<rect x="${28 + cw * 2}" y="${py - size * 0.85}" width="${n(size * 0.55)}" height="${n(size * 1.05)}" fill="${T.accent3}"><animate attributeName="opacity" values="1;0" dur="1s" calcMode="discrete" repeatCount="indefinite"/></rect></g>`;

  const body = `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="14" fill="${T.bg}" stroke="${T.border}" stroke-width="1.5"/>
<path d="M1 40V15a14 14 0 0 1 14-14H885a14 14 0 0 1 14 14V40Z" fill="${T.panel}"/>
<path d="M1 40H899" stroke="${T.border}"/>
<circle cx="24" cy="20" r="6" fill="#ff5f57"/><circle cx="44" cy="20" r="6" fill="#febc2e"/><circle cx="64" cy="20" r="6" fill="#28c840"/>
<text x="${W / 2}" y="25" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${T.muted}">${esc(cfg.terminal.title)}</text>
<g>${track('opacity', [[0, 1], [hide, 1], [gone, 0]], D, 'linear')}${lines}</g>`;
  write('terminal.svg', svg(W, H, body));
}

// ---------- 3. tech stack marquee ----------
function stack() {
  const W = 900, pillH = 36, gap = 14, H = 2 * pillH + gap + 32;
  const pw = name => Math.round(len(name) * 8.1 + 46);
  const row = (items, y, dir) => {
    let x = 0;
    const g = items.map(it => {
      const w = pw(it.name);
      const s = `<g transform="translate(${x} 0)"><rect width="${w}" height="${pillH}" rx="18" fill="${T.panel}" stroke="${it.color}" stroke-opacity=".5"/><circle cx="20" cy="18" r="5" fill="${it.color}"/><text x="34" y="23" font-family="${SANS}" font-size="14" font-weight="600" fill="${T.text}">${esc(it.name)}</text></g>`;
      x += w + gap;
      return s;
    }).join('');
    const total = x, dur = total / 38;
    const [from, to] = dir > 0 ? [0, -total] : [-total, 0];
    return `<g transform="translate(0 ${y})"><g><animateTransform attributeName="transform" type="translate" from="${from} 0" to="${to} 0" dur="${n(dur, 1)}s" repeatCount="indefinite"/>${g}<g transform="translate(${total} 0)">${g}</g></g></g>`;
  };
  const defs = `<linearGradient id="fadeG"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="fade"><rect width="${W}" height="${H}" fill="url(#fadeG)"/></mask>`;
  const body = `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="${T.bg}" stroke="${T.border}" stroke-width="1.5"/>
<g mask="url(#fade)">${row(cfg.stack.row1, 16, 1)}${row(cfg.stack.row2, 16 + pillH + gap, -1)}</g>`;
  write('stack.svg', svg(W, H, body, defs));
}

// ---------- 4. section titles ----------
function titles() {
  const W = 900, H = 56;
  cfg.sections.forEach(sec => {
    const defs = `<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.accent}"/><stop offset="1" stop-color="${T.accent2}"/></linearGradient>`;
    const body = `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="12" fill="${T.panel}" stroke="${T.border}" stroke-width="1.5"/>
<rect x="18" y="15" width="5" height="26" rx="2.5" fill="url(#bar)"><animate attributeName="height" values="26;14;26" dur="2.4s" repeatCount="indefinite"/><animate attributeName="y" values="15;21;15" dur="2.4s" repeatCount="indefinite"/></rect>
<text x="38" y="36" font-family="${SANS}" font-size="22" font-weight="700" fill="${T.text}">${esc(sec.title)}</text>
<text x="${W - 22}" y="35" text-anchor="end" font-family="${MONO}" font-size="13" fill="${T.muted}">${esc(sec.hint)}</text>
<path d="M14 54H886" stroke="${T.border}" stroke-width="2"/>
<path d="M14 54H886" stroke="${T.accent}" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="12 88"><animate attributeName="stroke-dashoffset" values="0;-100" dur="3.2s" repeatCount="indefinite"/></path>`;
    write(`title-${sec.id}.svg`, svg(W, H, body, defs));
  });
}

// ---------- 5. project cards ----------
const ICONS = {
  coffee: c => {
    const steam = [-16, -4, 8].map((x, i) =>
      `<path d="M${x} -10 q-5 -7 0 -14 q5 -7 0 -14" stroke-dasharray="5 8"><animate attributeName="stroke-dashoffset" values="0;-26" dur="${1.6 + i * 0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;.25;.9" dur="${2.2 + i * 0.4}s" repeatCount="indefinite"/></path>`).join('');
    return `<g stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<path d="M-26 -2 H18 V16 Q18 36 -4 36 Q-26 36 -26 16 Z" fill="${c}" fill-opacity=".14"/>
<path d="M18 6 h6 a9 9 0 0 1 0 18 h-6"/><path d="M-34 44 H28"/>${steam}</g>`;
  },
  progress: c => `<circle r="32" stroke="${c}" stroke-opacity=".18" stroke-width="6"/>
<circle r="32" stroke="${c}" stroke-width="6" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90)"><animate attributeName="stroke-dasharray" values="0 100;95 100;95 100;0 100" keyTimes="0;.5;.9;1" dur="6s" repeatCount="indefinite"/></circle>
<text y="5.5" text-anchor="middle" font-family="${MONO}" font-size="15" font-weight="700" fill="${c}">95%</text>`,
  plane: c => {
    const path = 'M-44 -26 C-26 -48 8 -46 20 6';
    return `<path d="${path}" stroke="${c}" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 6"><animate attributeName="stroke-dashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/></path>
<rect x="-6" y="8" width="48" height="30" rx="9" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-width="2.5"><animate attributeName="fill-opacity" values=".12;.12;.4;.12" keyTimes="0;.72;.8;1" dur="3.4s" repeatCount="indefinite"/></rect>
<path d="M0 38 l-6 9 l14 -9" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
<g stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0"><path d="M8 24 l5 5 l9 -10"/><path d="M18 24 l5 5 l9 -10"/><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.72;.8;.95;1" dur="3.4s" repeatCount="indefinite"/></g>
<g><animateMotion dur="3.4s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;1" keyTimes="0;.72;1" calcMode="linear" path="${path}"/><path d="M-7 -6 L11 0 L-7 6 L-3 0Z" fill="${c}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.72;.78;1" dur="3.4s" repeatCount="indefinite"/></path></g>`;
  },
  pulse: c => {
    const d = 'M-44 14 H-22 L-15 6 L-8 20 L1 -22 L11 34 L18 14 H44';
    return `<circle cx="-30" cy="-24" r="10" fill="${c}" fill-opacity=".4"><animate attributeName="r" values="10;22" dur="1.6s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values=".45;0" dur="1.6s" repeatCount="indefinite"/></circle>
<rect x="-33" y="-32" width="6" height="16" rx="1.5" fill="${c}"/><rect x="-38" y="-27" width="16" height="6" rx="1.5" fill="${c}"/>
<path d="${d}" stroke="${c}" stroke-opacity=".25" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="26 74"><animate attributeName="stroke-dashoffset" values="0;-100" dur="2.2s" repeatCount="indefinite"/></path>`;
  }
};

function wrap(text, max) {
  const lines = [];
  let cur = '';
  text.split(' ').forEach(w => {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}

function cards() {
  const W = 440, H = 250;
  cfg.projects.forEach((p, i) => {
    const c = p.color;
    const icon = (ICONS[p.icon] || (() => ''))(c);
    const desc = wrap(p.desc, 58).map((l, k) => `<text x="28" y="${124 + k * 19}" font-family="${SANS}" font-size="13" fill="${T.muted}">${esc(l)}</text>`).join('');
    let chips = '', x = 28, y = 186;
    p.tags.forEach(tag => {
      const w = Math.round(len(tag) * 6.8 + 22);
      if (x + w > 412) { x = 28; y += 30; }
      chips += `<g transform="translate(${x} ${y})"><rect width="${w}" height="22" rx="11" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-opacity=".45"/><text x="${w / 2}" y="15" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${c}">${esc(tag)}</text></g>`;
      x += w + 8;
    });
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.panel}"/><stop offset="1" stop-color="${T.bg}"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    const rect = `x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16"`;
    const body = `<rect ${rect} fill="url(#bg)"/>
<circle cx="366" cy="62" r="70" fill="url(#glow)"/>
<rect ${rect} stroke="${T.border}" stroke-width="1.5"/>
<rect ${rect} stroke="${c}" stroke-width="2" stroke-linecap="round" pathLength="1000" stroke-dasharray="150 850"><animate attributeName="stroke-dashoffset" values="0;-1000" dur="7s" repeatCount="indefinite"/></rect>
<rect ${rect} stroke="${T.accent2}" stroke-width="2" stroke-linecap="round" pathLength="1000" stroke-dasharray="80 920"><animate attributeName="stroke-dashoffset" values="-500;-1500" dur="7s" repeatCount="indefinite"/></rect>
<text x="28" y="36" font-family="${MONO}" font-size="12" fill="${c}">${esc(p.label)}</text>
<text x="28" y="68" font-family="${SANS}" font-size="24" font-weight="800" fill="${T.text}">${esc(p.title)}</text>
${desc}${chips}
<g transform="translate(366 62)">${icon}</g>`;
    write(`card-${p.id}.svg`, svg(W, H, body, defs));
  });
}

// ---------- 6. contact buttons ----------
function buttons() {
  cfg.contact.forEach((b, i) => {
    const w = Math.round(len(b.label) * 8.6 + 54), h = 44, c = b.color;
    const defs = `<clipPath id="pill"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="21"/></clipPath>`;
    const body = `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="21" fill="${T.panel}" stroke="${c}" stroke-opacity=".7" stroke-width="1.5"/>
<circle cx="22" cy="22" r="4.5" fill="${c}"><animate attributeName="r" values="4.5;6.5;4.5" dur="2s" repeatCount="indefinite"/></circle>
<text x="38" y="27" font-family="${SANS}" font-size="14" font-weight="700" fill="${T.text}">${esc(b.label)}</text>
<g clip-path="url(#pill)"><g><animateTransform attributeName="transform" type="translate" from="-60 0" to="${w + 60} 0" dur="3.6s" begin="${n(i * 0.45, 2)}s" repeatCount="indefinite"/><rect x="0" y="-4" width="26" height="52" fill="#fff" fill-opacity=".1" transform="skewX(-20)"/></g></g>`;
    write(`btn-${b.id}.svg`, svg(w, h, body, defs));
  });
}

// ---------- 7. footer ----------
function footer() {
  const W = 1000, H = 190, f = cfg.footer;
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.bg}"/><stop offset="1" stop-color="${T.panel}"/></linearGradient>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="20"/></clipPath>`;
  let stars = '';
  for (let i = 0; i < 16; i++) {
    stars += `<circle cx="${n(between(20, W - 20), 0)}" cy="${n(between(14, 110), 0)}" r="${n(between(1, 2.2), 1)}" fill="${ACCENTS[i % 4]}" opacity="0"><animate attributeName="opacity" values="0;.8;0" dur="${n(between(2.5, 5), 1)}s" begin="${n(between(0, 4), 1)}s" repeatCount="indefinite"/></circle>`;
  }
  const waves =
    wave({ W, H, y: H - 52, amp: 12, period: 250, fill: T.accent, opacity: 0.15, dur: 15 }) +
    wave({ W, H, y: H - 38, amp: 10, period: 200, fill: T.accent2, opacity: 0.18, dur: 11, dir: -1 }) +
    wave({ W, H, y: H - 22, amp: 8, period: 500, fill: T.bg, opacity: 0.85, dur: 20 });
  const body = `<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>${stars}
<text x="${W / 2}" y="76" text-anchor="middle" font-family="${SANS}" font-size="24" font-style="italic" fill="${T.text}">“${esc(f.quote)}”</text>
<text x="${W / 2}" y="108" text-anchor="middle" font-family="${MONO}" font-size="14" fill="${T.muted}">— ${esc(f.author)}</text>
${waves}</g>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="19.5" stroke="${T.border}" stroke-width="1.5"/>`;
  write('footer.svg', svg(W, H, body, defs));
}

console.log('Generating assets…');
banner(); terminal(); stack(); titles(); cards(); buttons(); footer();
console.log('Done.');
