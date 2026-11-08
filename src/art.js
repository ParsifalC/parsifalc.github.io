const INK = '#102319';
const LEAF = '#c0f4b0';
const MOSS = '#73977c';
const MIST = '#a9c5ad';

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

// Tag names, attribute names and child markup are owned by this module.
function element(name, attributes = {}, children = '') {
  const serialized = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ' ' + key + '="' + escapeHTML(value) + '"')
    .join('');
  return '<' + name + serialized + '>' + children + '</' + name + '>';
}

function group(children, attributes = {}) {
  return element('g', attributes, Array.isArray(children) ? children.join('') : children);
}

function path(d, options = {}) {
  const { accent = false, opacity = 1, width = 1, dash, pulse = false } = options;
  return element('path', {
    d,
    class: 'diagram-line' + (pulse ? ' route-pulse' : ''),
    opacity,
    'vector-effect': 'non-scaling-stroke',
    'stroke-dasharray': dash,
    style: 'fill:none;stroke:' + (accent ? LEAF : MOSS) + ';stroke-width:' + width,
  });
}

function route(d, options = {}) {
  return path(d, { opacity: 0.55, ...options }) + path(d, {
    accent: true,
    width: 1.3,
    opacity: 0.85,
    dash: '7 19',
    ...options,
    pulse: true,
  });
}

function circle(cx, cy, r, options = {}) {
  const { accent = false, fill = false, opacity = 1, width = 1, dash } = options;
  return element('circle', {
    cx, cy, r,
    class: fill ? 'diagram-node' : 'diagram-line',
    opacity,
    'stroke-dasharray': dash,
    'vector-effect': 'non-scaling-stroke',
    style: 'fill:' + (fill ? INK : 'none') + ';stroke:' + (accent ? LEAF : MOSS) + ';stroke-width:' + width,
  });
}

function rectangle(x, y, width, height, options = {}) {
  const { accent = false, fill = false, opacity = 1, radius = 2 } = options;
  return element('rect', {
    x, y, width, height, rx: radius,
    class: 'diagram-node',
    opacity,
    'vector-effect': 'non-scaling-stroke',
    style: 'fill:' + (fill ? INK : 'none') + ';stroke:' + (accent ? LEAF : MOSS) + ';stroke-width:1',
  });
}

function polygon(points, options = {}) {
  const { accent = false, fill = INK, opacity = 1 } = options;
  return element('polygon', {
    points: points.map((point) => point.join(',')).join(' '),
    class: 'diagram-node',
    opacity,
    'vector-effect': 'non-scaling-stroke',
    style: 'fill:' + fill + ';stroke:' + (accent ? LEAF : MOSS) + ';stroke-width:1',
  });
}

function diamond(x, y, radius, options = {}) {
  return polygon([[x, y - radius], [x + radius, y], [x, y + radius], [x - radius, y]], options);
}

function dot(cx, cy, r = 3, opacity = 1) {
  return element('circle', { cx, cy, r, opacity, class: 'diagram-accent' });
}

function label(x, y, text, options = {}) {
  const { dim = false, size = dim ? 12 : 14, maxWidth = 112 } = options;
  const fontSize = Math.max(size, dim ? 14 : 16);
  const value = String(text).toUpperCase();
  const naturalWidth = value.length * fontSize * 0.64 + Math.max(0, value.length - 1) * 0.7;
  return element('text', {
    x, y,
    class: dim ? 'diagram-dim' : 'diagram-text',
    style: 'font-size:' + fontSize + 'px;letter-spacing:.7px;fill:' + (dim ? MOSS : MIST),
    textLength: naturalWidth > maxWidth ? maxWidth : undefined,
    lengthAdjust: naturalWidth > maxWidth ? 'spacingAndGlyphs' : undefined,
  }, escapeHTML(value));
}

function wave(x, y, heights, options = {}) {
  const { step = 8, width = 3.4, opacity = 0.85 } = options;
  return heights.map((height, index) => element('rect', {
    x: x + index * step,
    y: y - height / 2,
    width, height, rx: width / 2,
    opacity,
    class: 'diagram-accent signal-bar',
  })).join('');
}

function check(x, y, size = 9) {
  return path('M' + (x - size) + ' ' + y + 'l' + size * 0.7 + ' ' + size * 0.7 + 'l' + size * 1.3 + ' ' + (-size * 1.4), { accent: true, width: 1.3 });
}

function registerMarks() {
  return path('M26 64V52H38M462 52H474V64M26 210V222H38M462 222H474V210', { opacity: 0.35, width: 0.7 });
}

function orchestration() {
  return group([
    route('M250 96V112H126V128M250 112V128M250 112H374V128'),
    route('M126 170V204H250M250 170V216M374 170V204H250'),
    circle(250, 78, 27, { opacity: 0.3, dash: '2 6' }),
    diamond(250, 78, 20, { accent: true }),
    path('M241 74H259M241 80H254M241 86H250', { accent: true }),
    label(250, 43, 'PLAN', { size: 15 }),
    ...[126, 250, 374].map((x) => circle(x, 149, 21, { fill: true })),
    circle(123, 146, 6, { accent: true }),
    path('M128 151L134 157', { accent: true, width: 1.3 }),
    path('M244 141L237 149L244 157M256 141L263 149L256 157', { accent: true }),
    check(374, 149),
    label(126, 190, 'EXPLORE', { maxWidth: 100 }),
    label(250, 190, 'BUILD', { maxWidth: 90 }),
    label(374, 190, 'REVIEW', { maxWidth: 100 }),
    circle(250, 219, 6, { accent: true }),
    dot(250, 219, 2),
    label(306, 224, 'RESULT', { dim: true, maxWidth: 74 }),
    dot(126, 112, 2),
    dot(374, 112, 2),
  ]);
}

function routing() {
  return group([
    path('M40 111H57M34 137H57M40 163H57', { opacity: 0.55 }),
    route('M99 137H194'),
    route('M276 126C321 126 324 78 388 78'),
    path('M277 137H388', { opacity: 0.65 }),
    route('M276 148C321 148 324 196 388 196', { opacity: 0.45, dash: '3 13' }),
    circle(78, 137, 21, { fill: true }),
    path('M68 130H88M68 137H83M68 144H87', { accent: true }),
    circle(235, 137, 52, { opacity: 0.25, dash: '1 6' }),
    circle(235, 137, 41, { fill: true, accent: true }),
    circle(235, 137, 32, { opacity: 0.4 }),
    label(235, 142, 'ROUTE', { size: 14, maxWidth: 66 }),
    ...[78, 137, 196].map((y, index) => circle(402, y, 14, { fill: true, accent: index === 0, opacity: index === 1 ? 0.65 : 1 })),
    check(402, 78, 6),
    dot(402, 137, 3, 0.5),
    path('M396 197A6 6 0 1 1 402 202M396 191V197H402', { accent: true }),
    label(78, 184, 'APP', { size: 15, maxWidth: 60 }),
    label(235, 216, 'POLICY', { dim: true, maxWidth: 82 }),
    label(401, 54, 'MODEL A', { maxWidth: 98 }),
    label(444, 142, 'B', { dim: true, maxWidth: 18 }),
    label(401, 229, 'FALLBACK', { dim: true, maxWidth: 112 }),
    path('M155 132L161 137L155 142', { accent: true, opacity: 0.7 }),
  ]);
}

function voice() {
  return group([
    path('M112 112H263M112 165H263', { opacity: 0.22 }),
    route('M113 87H261', { opacity: 0.5, dash: '5 22' }),
    route('M261 190H113', { opacity: 0.45, dash: '5 22' }),
    wave(126, 112, [6, 12, 23, 15, 29, 41, 22, 12, 31, 20, 10, 17, 6, 10, 5]),
    wave(126, 165, [5, 8, 18, 29, 15, 10, 24, 36, 20, 12, 22, 14, 6, 9, 5], { opacity: 0.5 }),
    circle(79, 137, 28, { fill: true }),
    rectangle(74, 120, 10, 22, { accent: true, radius: 5 }),
    path('M68 136V139A11 11 0 0 0 90 139V136M79 150V157M73 157H85', { accent: true }),
    circle(295, 137, 28, { fill: true, accent: true }),
    wave(284, 137, [10, 23, 34, 18], { step: 6, width: 3 }),
    route('M188 193V219H404V188', { opacity: 0.6, dash: '3 12' }),
    path('M365 101H356V187H365M439 101H448V187H439', { opacity: 0.7 }),
    ...[116, 144, 172].map((y) => group([
      check(372, y, 4),
      path('M386 ' + y + 'H434M386 ' + (y + 7) + 'H416', { opacity: 0.55 }),
    ])),
    label(188, 60, 'DIALOGUE', { dim: true, maxWidth: 112 }),
    label(79, 208, 'YOU', { size: 15, maxWidth: 52 }),
    label(295, 208, 'PARTNER', { maxWidth: 96 }),
    label(404, 83, 'COACH', { size: 15, maxWidth: 86 }),
  ]);
}

function learning() {
  const worksheet = group([
    path('M102 76H179L197 94V205H102Z', { width: 1.1 }),
    path('M179 76V94H197', { opacity: 0.7 }),
    path('M115 101H160M115 108H145', { opacity: 0.6 }),
    ...[124, 146, 168, 190].map((y, index) => group([
      circle(117, y, 3, { accent: index === 1 }),
      path('M129 ' + y + 'H181', { opacity: index === 1 ? 0.95 : 0.45, accent: index === 1 }),
    ])),
    rectangle(109, 137, 80, 18, { accent: true, radius: 0 }),
  ], { transform: 'rotate(-7 150 140)' });
  return group([
    path('M82 91V70H103M188 70H211V91M82 190V213H103M188 213H211V190', { opacity: 0.45 }),
    worksheet,
    route('M82 146H216', { opacity: 0.65, dash: '9 10' }),
    route('M211 146H263Q276 146 285 137H298'),
    circle(333, 137, 43, { opacity: 0.2, dash: '2 6' }),
    circle(333, 137, 33, { fill: true, accent: true }),
    check(333, 137, 13),
    route('M333 171V197H309V213M333 197V213M333 197H357V213', { opacity: 0.55 }),
    ...[309, 333, 357].map((x, index) => circle(x, 216, 5, { accent: index === 1, opacity: index === 1 ? 1 : 0.55 })),
    label(149, 51, 'CAPTURE', { size: 15, maxWidth: 110 }),
    label(333, 77, 'REVIEW', { size: 15, maxWidth: 102 }),
    label(416, 221, 'RECALL', { dim: true, maxWidth: 78 }),
  ]);
}

function rack(x, y) {
  return group([
    polygon([[x, y - 13], [x + 24, y], [x, y + 13], [x - 24, y]], { fill: '#1a3020' }),
    polygon([[x - 24, y], [x, y + 13], [x, y + 46], [x - 24, y + 33]], { fill: '#14281b' }),
    polygon([[x, y + 13], [x + 24, y], [x + 24, y + 33], [x, y + 46]], { fill: '#0e1f15' }),
    path('M' + (x - 18) + ' ' + (y + 12) + 'l12 6M' + (x - 18) + ' ' + (y + 22) + 'l12 6', { opacity: 0.65 }),
    path('M' + (x + 6) + ' ' + (y + 20) + 'l12 -6M' + (x + 6) + ' ' + (y + 30) + 'l12 -6', { opacity: 0.65 }),
    dot(x + 17, y + 12, 1.7, 0.85),
  ]);
}

function fleet() {
  return group([
    polygon([[250, 104], [442, 164], [250, 231], [58, 164]], { fill: 'none', opacity: 0.28 }),
    path('M154 134L346 198M346 134L154 198M106 181L298 119M202 119L394 181', { opacity: 0.15 }),
    route('M250 91V104L105 130M250 104V148M250 104L395 130'),
    path('M105 153L250 181L395 153', { opacity: 0.3, dash: '3 6' }),
    circle(250, 71, 20, { fill: true, accent: true }),
    circle(250, 71, 6, { accent: true }),
    path('M250 57V62M250 80V85M236 71H241M259 71H264', { accent: true }),
    rack(105, 130),
    rack(250, 149),
    rack(395, 130),
    label(250, 41, 'CONTROL', { maxWidth: 108 }),
    label(105, 204, 'NODE A', { maxWidth: 98 }),
    label(250, 224, 'NODE B', { maxWidth: 98 }),
    label(395, 204, 'NODE C', { maxWidth: 98 }),
  ]);
}

function discussion() {
  return group([
    path('M250 73C310 73 358 102 358 139S310 205 250 205S142 176 142 139S190 73 250 73Z', { opacity: 0.3 }),
    route('M250 73C310 73 358 102 358 139S310 205 250 205', { dash: '6 18', opacity: 0.8 }),
    path('M250 90V102M341 139H291M250 188V176M159 139H209', { opacity: 0.6, dash: '3 5' }),
    circle(250, 139, 44, { accent: true, opacity: 0.85 }),
    circle(250, 139, 36, { opacity: 0.3 }),
    label(250, 135, 'COMMON', { size: 13, maxWidth: 72 }),
    label(250, 153, 'GROUND', { size: 13, maxWidth: 72 }),
    ...[[250, 73], [358, 139], [250, 205], [142, 139]].map(([x, y], index) => group([
      circle(x, y, 16, { fill: true, accent: index === 0 }),
      path('M' + (x - 7) + ' ' + (y - 5) + 'h14v9h-8l-4 4v-4h-2Z', { accent: index === 0 }),
    ])),
    label(250, 45, 'PROPOSE', { maxWidth: 108 }),
    label(428, 144, 'REVIEW', { maxWidth: 79 }),
    label(250, 236, 'REFINE', { maxWidth: 100 }),
    label(71, 144, 'QUESTION', { size: 12, maxWidth: 86 }),
  ]);
}

function flow() {
  return group([
    route('M67 137H108V91H146M108 137V183H146'),
    route('M214 91H254V137H273M214 183H254V137'),
    route('M327 137H406'),
    route('M300 165V220H180V201', { opacity: 0.45, dash: '3 12' }),
    circle(58, 137, 9, { fill: true, accent: true }),
    dot(108, 137, 3),
    rectangle(146, 73, 68, 36, { fill: true, radius: 4 }),
    rectangle(146, 165, 68, 36, { fill: true, radius: 4 }),
    label(180, 96, 'BUILD', { size: 13, maxWidth: 57 }),
    label(180, 188, 'REVIEW', { size: 12, maxWidth: 58 }),
    diamond(300, 137, 28, { accent: true }),
    check(300, 137, 10),
    circle(421, 137, 15, { accent: true }),
    circle(421, 137, 8, { opacity: 0.45 }),
    label(58, 174, 'INPUT', { size: 12, maxWidth: 66 }),
    label(300, 190, 'APPROVE', { maxWidth: 106 }),
    label(421, 174, 'OUTPUT', { size: 12, maxWidth: 76 }),
    label(244, 240, 'REVISE', { dim: true, maxWidth: 80 }),
  ]);
}

function renew() {
  return group([
    circle(216, 139, 72, { opacity: 0.22, dash: '2 5' }),
    route('M216 67A72 72 0 1 1 144 139', { dash: '8 20' }),
    path('M139 133L144 140L151 135', { accent: true }),
    route('M86 139H161'),
    route('M288 139H334V91H389'),
    path('M334 139V192H389', { opacity: 0.5, dash: '4 7' }),
    circle(216, 139, 53, { fill: true }),
    rectangle(193, 118, 46, 39, { radius: 3, accent: true }),
    path('M193 129H239M204 113V123M228 113V123', { accent: true }),
    ...[204, 216, 228].flatMap((x) => [139, 149].map((y) => dot(x, y, 1.8, 0.7))),
    ...[0, 1, 2].map((index) => path('M50 ' + (125 + index * 13) + 'H80', { opacity: 1 - index * 0.2 })),
    circle(405, 91, 16, { accent: true, fill: true }),
    check(405, 91, 7),
    circle(405, 192, 16, { fill: true }),
    path('M401 185V199M409 185V199', { accent: true, width: 1.4 }),
    label(65, 181, 'TASKS', { maxWidth: 76 }),
    label(216, 237, 'RETRY', { dim: true, maxWidth: 80 }),
    label(405, 62, 'RENEW', { maxWidth: 84 }),
    label(405, 228, 'MANUAL', { maxWidth: 94 }),
  ]);
}

function message() {
  return group([
    route('M109 135H230M286 135H374'),
    rectangle(54, 118, 54, 35, { radius: 2 }),
    path('M55 120L81 139L107 120M55 151L72 136M107 151L90 136', { opacity: 0.8 }),
    ...[151, 179, 207].map((x, index) => rectangle(x, 131, 9, 8, { opacity: 0.35 + index * 0.2, radius: 0 })),
    diamond(258, 135, 28, { accent: true }),
    path('M251 126V144M265 126V144', { accent: true, width: 1.5 }),
    rectangle(332, 131, 10, 8, { accent: true, radius: 0 }),
    path('M375 114H435V151H407L395 162V151H375Z', { width: 1.1 }),
    path('M386 128H424M386 137H414', { opacity: 0.7 }),
    route('M258 163V208H389', { opacity: 0.45, dash: '3 13' }),
    circle(405, 208, 12, { fill: true }),
    check(405, 208, 5),
    label(81, 90, 'MESSAGE', { maxWidth: 98 }),
    label(258, 90, 'ONCE', { size: 15, maxWidth: 70 }),
    label(405, 90, 'HANDOFF', { maxWidth: 105 }),
    label(405, 241, 'CONFIRM', { dim: true, maxWidth: 98 }),
  ]);
}

function layout() {
  const tiles = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      tiles.push(rectangle(59 + column * 28, 97 + row * 28, 20, 20, { accent: row === 1 && column === 1, fill: row === 1 && column === 1, radius: 1 }));
    }
  }
  const orbitTiles = [-64, -32, 0, 32, 64].map((angle, index) => group([
    rectangle(380, 78, 24, 32, { accent: index === 2, fill: true, opacity: index === 2 ? 1 : 0.6, radius: 2 }),
  ], { transform: 'rotate(' + angle + ' 392 153)' }));
  return group([
    path('M51 189H144M211 189H292', { opacity: 0.25 }),
    tiles.join(''),
    route('M148 135H205', { dash: '3 14' }),
    ...[-22, 0, 22].map((angle, index) => group([
      rectangle(230, 97, 40, 76, { accent: index === 1, fill: true, opacity: index === 1 ? 1 : 0.65, radius: 3 }),
      path('M239 111H261M239 118H253', { opacity: 0.45 }),
    ], { transform: 'rotate(' + angle + ' 250 174)' })),
    route('M296 135H329', { dash: '3 14' }),
    path('M322 153A70 70 0 0 1 462 153', { opacity: 0.3 }),
    orbitTiles.join(''),
    dot(392, 153, 3, 0.6),
    label(98, 218, 'GRID', { size: 15, maxWidth: 80 }),
    label(250, 218, 'STACK', { size: 15, maxWidth: 84 }),
    label(392, 218, 'ORBIT', { size: 15, maxWidth: 84 }),
  ]);
}

function community() {
  const paper = (x, y, opacity) => group([
    path('M' + x + ' ' + y + 'h23l8 8v31h-31Z', { opacity }),
    path('M' + (x + 23) + ' ' + y + 'v8h8M' + (x + 7) + ' ' + (y + 17) + 'h17M' + (x + 7) + ' ' + (y + 24) + 'h12', { opacity: opacity * 0.6 }),
  ]);
  return group([
    paper(61, 76, 0.5),
    paper(84, 115, 1),
    paper(61, 163, 0.5),
    route('M115 135H193'),
    path('M91 95H133V135M91 183H133V135', { opacity: 0.35 }),
    path('M250 104Q223 91 196 97V172Q223 166 250 179Q277 166 304 172V97Q277 91 250 104Z', { accent: true, width: 1.1 }),
    path('M250 105V179M207 115Q222 112 239 118M207 128Q222 125 239 131M207 141Q222 138 239 144M261 118Q278 112 293 115M261 131Q278 125 293 128M261 144Q278 138 293 141', { opacity: 0.65 }),
    route('M306 135H349V84H389M349 135H413M349 135V188H389'),
    ...[[403, 84], [428, 135], [403, 188]].map(([x, y], index) => group([
      circle(x, y, 14, { fill: true, accent: index === 1 }),
      circle(x, y - 3, 3, { accent: index === 1 }),
      path('M' + (x - 6) + ' ' + (y + 7) + 'q6 -9 12 0', { accent: index === 1 }),
    ])),
    label(85, 229, 'SELECT', { maxWidth: 91 }),
    label(250, 229, 'EDIT', { size: 15, maxWidth: 74 }),
    label(411, 229, 'SHARE', { maxWidth: 84 }),
  ]);
}

function monitor() {
  return group([
    path('M54 75V203H323', { opacity: 0.6 }),
    ...[94, 138, 182].map((y) => path('M54 ' + y + 'H323', { opacity: 0.18, dash: '2 6' })),
    route('M68 171H99V123H129V171H166V94H198V171H237V134H267V171H314', { opacity: 0.85, dash: '8 20' }),
    circle(182, 94, 9, { accent: true, opacity: 0.4 }),
    dot(182, 94, 3),
    route('M182 84V63H344V135H387', { opacity: 0.7 }),
    circle(252, 134, 5, { opacity: 0.4, dash: '2 3' }),
    path('M267 134H300V171', { opacity: 0.2, dash: '3 5' }),
    circle(414, 135, 27, { fill: true, accent: true }),
    path('M404 139V130A10 10 0 0 1 424 130V139L428 144H400ZM410 150Q414 156 418 150M414 116V120', { accent: true }),
    label(182, 232, 'EVENTS', { size: 15, maxWidth: 96 }),
    label(414, 191, 'NOTIFY', { size: 14, maxWidth: 94 }),
    label(344, 224, 'FILTER', { dim: true, maxWidth: 80 }),
  ]);
}

function humor() {
  return group([
    route('M118 136H220'),
    route('M279 126C318 126 321 82 369 82M280 136H389M279 146C318 146 321 201 369 201'),
    circle(86, 136, 34, { opacity: 0.3, dash: '2 6' }),
    path('M68 140V132Q68 123 77 122M68 140H79V131H68M89 140V132Q89 123 98 122M89 140H100V131H89', { accent: true, width: 1.5 }),
    diamond(250, 136, 30, { accent: true }),
    path('M250 118L254 131L268 136L254 141L250 154L246 141L232 136L246 131Z', { accent: true }),
    path('M374 70H402M374 79H395M374 88H401M374 97H389', { opacity: 0.8 }),
    circle(405, 136, 16, { opacity: 0.65 }),
    wave(396, 136, [8, 19, 26, 13], { step: 5, width: 2.5 }),
    rectangle(369, 187, 31, 30, { opacity: 0.5, radius: 1 }),
    rectangle(376, 180, 31, 30, { fill: true, accent: true, radius: 1 }),
    path('M382 188H401M382 195H396', { opacity: 0.6 }),
    label(86, 211, 'PROMPT', { maxWidth: 94 }),
    label(250, 211, 'REMIX', { size: 15, maxWidth: 90 }),
    label(447, 87, 'TEXT', { size: 12, maxWidth: 49 }),
    label(449, 141, 'VOICE', { size: 11, maxWidth: 53 }),
    label(447, 207, 'SHARE', { size: 11, maxWidth: 54 }),
  ]);
}

function fallback() {
  return group([
    route('M126 137H218M282 137H374'),
    circle(102, 137, 24, { fill: true }),
    dot(102, 137, 4),
    diamond(250, 137, 32, { accent: true }),
    circle(250, 137, 10, { accent: true }),
    rectangle(374, 113, 48, 48, { radius: 4 }),
    check(398, 137, 9),
    label(102, 200, 'INPUT', { size: 15, maxWidth: 92 }),
    label(250, 200, 'PROCESS', { size: 15, maxWidth: 115 }),
    label(398, 200, 'OUTPUT', { size: 15, maxWidth: 104 }),
  ]);
}

const FALLBACK = {
  key: 'concept',
  label: 'PROJECT CONCEPT',
  description: '项目概念示意：输入经过处理后形成输出，连线表示处理顺序。',
  draw: fallback,
};

const DIAGRAMS = new Map([
  ['orchestration', { label: 'TASK ORCHESTRATION', description: '任务编排概念示意：规划节点将任务分配给探索、实现与复核节点，再汇聚执行结果。', draw: orchestration }],
  ['routing', { label: 'MODEL ROUTING', description: '模型路由概念示意：应用请求进入路由中心，按策略选择模型服务，并保留备用路径。', draw: routing }],
  ['voice', { label: 'VOICE / COACH', description: '口语练习概念示意：用户与语音伙伴双向交流，独立辅导通道在一旁整理反馈。', draw: voice }],
  ['learning', { label: 'LEARNING / REVIEW', description: '学习反馈概念示意：作业图片经过扫描和逐题核对，再连接到后续学习回顾。', draw: learning }],
  ['fleet', { label: 'FLEET CONTROL', description: '多节点管理概念示意：一个控制节点连接三个抽象工作负载，统一组织部署与检查。', draw: fleet }],
  ['discussion', { label: 'SHARED REASONING', description: '圆桌讨论概念示意：不同参与者围绕共同议题提出观点、复核和修订，逐步整理共识。', draw: discussion }],
  ['flow', { label: 'WORKFLOW / APPROVAL', description: '工作流概念示意：输入拆分为并行任务，汇入人工审批，获准后输出，也可返回修订。', draw: flow }],
  ['renew', { label: 'TASK LIFECYCLE', description: '资源任务概念示意：计划任务进入续期与重试循环，异常分支保留人工处理入口。', draw: renew }],
  ['message', { label: 'MESSAGE HANDOFF', description: '消息交互概念示意：消息经过一次性消费环节交给任务，并保留人工确认路径。', draw: message }],
  ['layout', { label: 'LAYOUT TRANSITION', description: '集合视图概念示意：相同内容在网格、叠放与环形排列之间切换，强调布局关系的连续性。', draw: layout }],
  ['community', { label: 'COLLECTIVE EDITING', description: '社区编辑概念示意：候选内容经过共同编辑整理成周报，再分享给不同读者。', draw: community }],
  ['monitor', { label: 'EVENT MONITOR', description: '事件提醒概念示意：抽象事件序列经过筛选与去重后触发提醒，曲线不代表真实价格或收益。', draw: monitor }],
  ['humor', { label: 'CREATIVE EXPRESSION', description: '创意内容概念示意：一个描述经过生成过程，形成文字、语音与分享卡片三种表达。', draw: humor }],
]);

/** Render a self-contained, inert diagram selected only by an allowlisted visual key. */
export function projectArt(project) {
  const visual = typeof project?.visual === 'string' ? project.visual : '';
  const diagram = DIAGRAMS.get(visual) ?? FALLBACK;
  const key = diagram === FALLBACK ? FALLBACK.key : visual;
  const graphic = element('svg', {
    viewBox: '0 0 500 270',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': diagram.description,
    focusable: 'false',
  }, group([
    registerMarks(),
    diagram.draw(),
  ], {
    'aria-hidden': 'true',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  return element('div', { class: 'project-art', 'data-visual': key }, [
    element('span', { class: 'art-label', 'aria-hidden': 'true', style: 'font-size:8px' }, escapeHTML(diagram.label)),
    graphic,
    element('button', { class: 'demo-button', type: 'button', 'data-action': 'demo', 'aria-pressed': 'false' }, escapeHTML('播放示意')),
    element('div', { class: 'art-foot', style: 'font-size:8px;letter-spacing:.6px' }, [
      element('span', {}, escapeHTML('CONCEPT DIAGRAM')),
      element('span', {}, escapeHTML('示意 · 非实时数据')),
    ].join('')),
  ].join(''));
}
