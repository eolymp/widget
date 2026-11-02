const nodes = { A: [40, 130], B: [150, 40], C: [150, 220], D: [270, 40], E: [270, 220], F: [380, 130] };
const edges = [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "E"], ["D", "E"], ["D", "F"], ["E", "F"]];

const svg = (tag, attrs) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
};

for (const [a, b] of edges) {
  document.getElementById("edges").append(svg("line", { x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1] }));
}

for (const [id, [x, y]] of Object.entries(nodes)) {
  document.getElementById("nodes").append(svg("circle", { cx: x, cy: y, r: 22, "data-id": id }));
  const label = svg("text", { x, y });
  label.textContent = id;
  document.getElementById("nodes").append(label);
}

const adjacent = (a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const route = eolymp.pickPath("#map", {
  start: "A",
  canFollow: (from, to) => adjacent(from, to),
});

eolymp.widget({ answer: route });
