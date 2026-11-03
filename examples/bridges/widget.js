const islands = {
  A: [90, 90],
  B: [310, 60],
  C: [550, 100],
  D: [120, 310],
  E: [330, 230],
  F: [550, 320],
};

const bridges = [
  ["A", "B", 4],
  ["A", "D", 3],
  ["A", "E", 6],
  ["B", "C", 5],
  ["B", "E", 2],
  ["C", "E", 7],
  ["C", "F", 3],
  ["D", "E", 4],
  ["E", "F", 6],
  ["D", "F", 9],
];

const map = document.getElementById("map");
const svg = (tag, attrs, parent) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return parent.appendChild(element);
};

for (const [from, to, planks] of bridges) {
  const [x1, y1] = islands[from];
  const [x2, y2] = islands[to];
  const bridge = svg("g", { class: "bridge", "data-id": from + to, "aria-label": `Bridge ${from}–${to}, ${planks} planks` }, map);
  svg("line", { class: "hit", x1, y1, x2, y2 }, bridge);
  svg("line", { class: "deck", x1, y1, x2, y2 }, bridge);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  svg("circle", { class: "cost", cx: mx, cy: my, r: 15 }, bridge);
  svg("text", { class: "cost-label", x: mx, y: my }, bridge).textContent = planks;
}

for (const [name, [x, y]] of Object.entries(islands)) {
  const island = svg("g", { class: "island" }, map);
  svg("circle", { cx: x, cy: y, r: 30 }, island);
  svg("text", { x, y }, island).textContent = name;
}

const built = eolymp.pickMany(map, { items: "[data-id]" });

eolymp.widget({ answer: built });
