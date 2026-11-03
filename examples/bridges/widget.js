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

const svg = "http://www.w3.org/2000/svg";
const map = document.getElementById("map");

const draw = (parent, tag, attributes, text) => {
  const element = document.createElementNS(svg, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  parent.append(element);
  return element;
};

for (const [from, to, planks] of bridges) {
  const [x1, y1] = islands[from];
  const [x2, y2] = islands[to];
  const bridge = draw(map, "g", { class: "bridge", "data-id": from + to, "aria-label": `Bridge ${from}–${to}, ${planks} planks` });
  draw(bridge, "line", { class: "hit", x1, y1, x2, y2 });
  draw(bridge, "line", { class: "deck", x1, y1, x2, y2 });
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  draw(bridge, "circle", { class: "cost", cx: mx, cy: my, r: 15 });
  draw(bridge, "text", { class: "cost-label", x: mx, y: my }, planks);
}

for (const [name, [x, y]] of Object.entries(islands)) {
  const island = draw(map, "g", { class: "island" });
  draw(island, "circle", { cx: x, cy: y, r: 30 });
  draw(island, "text", { x, y }, name);
}

const built = eolymp.pickMany(map, { items: "[data-id]" });

eolymp.widget({ answer: built });
