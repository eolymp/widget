# Examples

    npm run build
    node cli/index.js dev examples --entry grid/index.html

Swap `grid` for another folder:

| Example | Shows | Answer |
|---|---|---|
| `grid` | `grid` | `[[0,1],[1,0]]` |
| `path` | `pickPath` over a graph | `["A","B","D"]` |
| `slots` | `slots`, items into boxes | `{"fruit":["apple"],…}` |
| `order` | `sortable` | `["new","crescent",…]` |
| `parts` | `combine` of a `pickOne` and a `grid` | `{"choice":"B","board":[[…]]}` |
| `bridges` | `pickMany` on SVG: pick the bridges to build | `["AB","BE",…]` |
| `stilts` | `slots` wrapped in a custom answer: put each figure on stilts | `[5,1,4,0,2]` |
| `cut` | custom `state` with dragged SVG handles: place two lines | `[[x1,y1,x2,y2],[x1,y1,x2,y2]]` |
