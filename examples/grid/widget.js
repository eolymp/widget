const board = eolymp.grid("#board", {
  rows: 5,
  cols: 5,
  values: ["", "R", "G", "B"],
  locked: (row, col) => row === 2 && col === 2,
  label: (row, col) => (row === 2 && col === 2 ? "★" : ""),
});

eolymp.widget({ answer: board });
