const answer = eolymp.combine({
  choice: eolymp.pickOne("#choice"),
  board: eolymp.grid("#board", { rows: 3, cols: 3 }),
});

eolymp.widget({ answer });
