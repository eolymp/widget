const FIELD = { left: 20, top: 25, right: 625, bottom: 330 };
const WIDTH = FIELD.right - FIELD.left;
const HEIGHT = FIELD.bottom - FIELD.top;
const PERIMETER = 2 * (WIDTH + HEIGHT);

const MUSHROOMS = [
  ["red", 110, 50, 35], ["red", 165, 120, 25], ["red", 475, 35, 25],
  ["red", 145, 155, 25], ["red", 415, 145, 25], ["red", 450, 130, 25],
  ["brown", 175, 235, 35], ["brown", 280, 305, 25], ["brown", 410, 255, 25],
  ["brown", 505, 265, 25], ["brown", 305, 80, 25], ["brown", 250, 75, 25],
  ["brown", 255, 30, 25], ["brown", 95, 295, 25], ["brown", 115, 270, 25],
];

const INITIAL = [1, 2].map((n) => {
  const y = FIELD.top + Math.floor((n * HEIGHT) / 3);
  return [FIELD.left, y, FIELD.right, y];
});

const attrs = (node, values) => {
  for (const [key, value] of Object.entries(values)) node.setAttribute(key, value);
  return node;
};
const svg = (tag, values, parent) =>
  parent.appendChild(attrs(document.createElementNS("http://www.w3.org/2000/svg", tag), values));

const meadow = document.getElementById("meadow");
for (const [color, x, y, size] of MUSHROOMS) {
  svg("circle", { class: "mushroom", "data-color": color, cx: x + size / 2, cy: y + size / 2, r: size / 2 }, document.getElementById("mushrooms"));
}

const round = (v) => Math.round(v * 10) / 10;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const ends = (line) => [{ x: line[0], y: line[1] }, { x: line[2], y: line[3] }];
const flat = ([a, b]) => [a.x, a.y, b.x, b.y];

const extend = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  let near = -Infinity;
  let far = Infinity;
  for (const [d, start, min, max] of [[dx, a.x, FIELD.left, FIELD.right], [dy, a.y, FIELD.top, FIELD.bottom]]) {
    if (Math.abs(d) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    const t1 = (min - start) / d;
    const t2 = (max - start) / d;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
  }
  if (near >= far) return null;
  return [near, far].map((t) => ({ x: round(a.x + dx * t), y: round(a.y + dy * t) }));
};

const toPerimeter = ({ x, y }) => {
  if (y <= FIELD.top) return x - FIELD.left;
  if (x >= FIELD.right) return WIDTH + (y - FIELD.top);
  if (y >= FIELD.bottom) return WIDTH + HEIGHT + (FIELD.right - x);
  return 2 * WIDTH + HEIGHT + (FIELD.bottom - y);
};

const fromPerimeter = (t) => {
  t = ((t % PERIMETER) + PERIMETER) % PERIMETER;
  if (t < WIDTH) return { x: FIELD.left + t, y: FIELD.top };
  if (t < WIDTH + HEIGHT) return { x: FIELD.right, y: FIELD.top + (t - WIDTH) };
  if (t < 2 * WIDTH + HEIGHT) return { x: FIELD.right - (t - WIDTH - HEIGHT), y: FIELD.bottom };
  return { x: FIELD.left, y: FIELD.bottom - (t - 2 * WIDTH - HEIGHT) };
};

const normalize = (value) => {
  if (!Array.isArray(value) || value.length !== INITIAL.length) return INITIAL;
  const lines = value.map((line) =>
    Array.isArray(line) && line.length === 4 && line.every(Number.isFinite) ? extend(...ends(line)) : null,
  );
  return lines.includes(null) ? INITIAL : lines.map(flat);
};

const lines = eolymp.state(INITIAL, normalize);

const move = (index, end, target) =>
  lines.update((current) =>
    current.map((line, i) => {
      if (i !== index) return line;
      const points = ends(line);
      points[end] = target;
      return flat(points);
    }),
  );

const cuts = INITIAL.map(() => svg("line", { class: "cut" }, document.getElementById("lines")));
const handles = INITIAL.flatMap((_, index) =>
  [0, 1].map((end) => ({
    index,
    end,
    node: svg("circle", { class: "handle", r: 10, tabindex: 0, role: "slider", "aria-label": `Line ${index + 1}, end ${end + 1}` }, document.getElementById("handles")),
  })),
);

const render = (current) => {
  current.forEach(([x1, y1, x2, y2], i) => attrs(cuts[i], { x1, y1, x2, y2 }));
  for (const { index, end, node } of handles) {
    const { x, y } = ends(current[index])[end];
    attrs(node, { cx: x, cy: y });
  }
};
lines.subscribe(render);
render(lines.get());

const local = (event) => {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(meadow.getScreenCTM().inverse());
  return { x: clamp(p.x, FIELD.left + 2, FIELD.right - 2), y: clamp(p.y, FIELD.top + 2, FIELD.bottom - 2) };
};

const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

for (const { index, end, node } of handles) {
  const own = () => ends(lines.get()[index])[end];
  const other = () => ends(lines.get()[index])[1 - end];

  node.addEventListener("pointerdown", (event) => {
    if (eolymp.readonly()) return;
    event.preventDefault();
    node.focus({ preventScroll: true });
    node.setPointerCapture(event.pointerId);
    node.toggleAttribute("data-dragging", true);
  });

  node.addEventListener("pointermove", (event) => {
    if (!node.hasPointerCapture(event.pointerId)) return;
    const points = extend(other(), local(event));
    if (points) move(index, end, points[1]);
  });

  const release = () => node.toggleAttribute("data-dragging", false);
  node.addEventListener("pointerup", release);
  node.addEventListener("pointercancel", release);

  node.addEventListener("keydown", (event) => {
    const arrow = ARROWS[event.key];
    if (!arrow || eolymp.readonly()) return;
    event.preventDefault();
    const from = own();
    const step = event.shiftKey ? 1 : 5;
    const toward = (p) => (p.x - from.x) * arrow[0] + (p.y - from.y) * arrow[1];
    const target = [step, -step].map((d) => fromPerimeter(toPerimeter(from) + d)).sort((a, b) => toward(b) - toward(a))[0];
    const far = other();
    if (toward(target) <= 0 || Math.hypot(target.x - far.x, target.y - far.y) < 1) return;
    move(index, end, { x: round(target.x), y: round(target.y) });
  });
}

eolymp.widget({ answer: lines });
