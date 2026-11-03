const SVG = "http://www.w3.org/2000/svg";
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

const meadow = document.getElementById("meadow");
const element = (name, attributes, parent) => {
  const node = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  parent.append(node);
  return node;
};

MUSHROOMS.forEach(([color, x, y, size]) =>
  element("circle", { class: "mushroom", "data-color": color, cx: x + size / 2, cy: y + size / 2, r: size / 2 }, document.getElementById("mushrooms")),
);

const round = (v) => Math.round(v * 10) / 10;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
  const lines = value.map((line) => {
    if (!Array.isArray(line) || line.length !== 4 || !line.every(Number.isFinite)) return null;
    const ends = extend({ x: line[0], y: line[1] }, { x: line[2], y: line[3] });
    return ends && [ends[0].x, ends[0].y, ends[1].x, ends[1].y];
  });
  return lines.includes(null) ? INITIAL : lines;
};

const lines = eolymp.state(INITIAL);
const answer = {
  get: lines.get,
  set: (value) => lines.set(normalize(value)),
  update: (change) => answer.set(change(lines.get())),
  subscribe: lines.subscribe,
};

const cuts = INITIAL.map(() => element("line", { class: "cut" }, document.getElementById("lines")));
const handles = INITIAL.flatMap((_, line) =>
  [0, 1].map((end) =>
    element("circle", {
      class: "handle",
      r: 10,
      tabindex: 0,
      role: "slider",
      "aria-label": `Line ${line + 1}, end ${end + 1}`,
      "data-line": line,
      "data-end": end,
    }, document.getElementById("handles")),
  ),
);

const point = (line, end) => ({ x: line[end * 2], y: line[end * 2 + 1] });

const move = (index, end, target) => {
  lines.update((current) =>
    current.map((line, i) => {
      if (i !== index) return line;
      const ends = [point(line, 0), point(line, 1)];
      ends[end] = target;
      return [ends[0].x, ends[0].y, ends[1].x, ends[1].y];
    }),
  );
};

const render = (current) => {
  meadow.toggleAttribute("data-readonly", eolymp.readonly());
  current.forEach((line, i) => {
    const [x1, y1, x2, y2] = line;
    Object.entries({ x1, y1, x2, y2 }).forEach(([key, value]) => cuts[i].setAttribute(key, value));
  });
  handles.forEach((handle) => {
    const { x, y } = point(current[handle.dataset.line], handle.dataset.end);
    handle.setAttribute("cx", x);
    handle.setAttribute("cy", y);
  });
};
lines.subscribe(render);
render(lines.get());

const local = (event) => {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(meadow.getScreenCTM().inverse());
  return {
    x: clamp(p.x, FIELD.left + 2, FIELD.right - 2),
    y: clamp(p.y, FIELD.top + 2, FIELD.bottom - 2),
  };
};

handles.forEach((handle) => {
  const index = Number(handle.dataset.line);
  const end = Number(handle.dataset.end);
  const other = () => point(lines.get()[index], 1 - end);

  handle.addEventListener("pointerdown", (event) => {
    if (eolymp.readonly()) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    handle.toggleAttribute("data-dragging", true);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    const ends = extend(other(), local(event));
    if (ends) move(index, end, ends[1]);
  });

  const release = () => handle.toggleAttribute("data-dragging", false);
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", release);

  handle.addEventListener("keydown", (event) => {
    if (eolymp.readonly()) return;
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const at = toPerimeter(point(lines.get()[index], end));
    const target = fromPerimeter(at + step * (event.shiftKey ? 1 : 5));
    const far = other();
    if (Math.hypot(target.x - far.x, target.y - far.y) < 1) return;
    move(index, end, { x: round(target.x), y: round(target.y) });
  });
});

eolymp.widget({ answer });
