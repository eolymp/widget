# Tutorial: your first widget problem

This tutorial builds one widget problem from start to finish: the widget, the checker, and the problem on Eolymp. It takes the path a real task takes, so each step is one you will repeat for your own problems.

You need [Node.js](https://nodejs.org) 20 or later and an Eolymp space where you can create problems.

## The task

Five figures want to walk on stilts. There are six pairs of stilts of different heights. Put each figure on a pair of stilts so that the tops of all their hats are at the same height.

| Figure | 1 | 2 | 3 | 4 | 5 |   |
|---|---|---|---|---|---|---|
| Height | 12 | 9 | 6 | 10 | 11 | |
| **Stilts** | **1** | **2** | **3** | **4** | **5** | **6** |
| Height | 3 | 4 | 2 | 6 | 7 | 1 |

One pair of stilts is left over. The answer is figure 1 on stilts 6, figure 2 on stilts 2, figure 3 on stilts 5, figure 4 on stilts 1 and figure 5 on stilts 3: every hat ends at 13.

## 1. Split the task into statement, widget and checker

A widget problem has three parts, and each has one job:

- **The statement** holds all the text: the story, the rules, what to do. It is written in the console like any other statement.
- **The widget** is only the answer input: the figures and the stilts, which the participant drags. It has no text, no "Check" button, and never says whether an answer is right. The page around it already has the Submit button.
- **The checker** decides whether the answer is right.

So the statement for this task is the paragraph above. Everything that follows is about the other two parts.

## 2. Design the answer

When the participant submits, the widget hands Eolymp a JSON document: the answer. Only your widget and your checker ever read it, so choose the shape that makes the checker simple.

Here the question is "which stilts does each figure stand on", so the answer is a list with one stilts number per figure, counting from 0:

```json
[5, 1, 4, 0, 2]
```

That is the correct answer: figure 1 on stilts 6 (index 5), figure 2 on stilts 2 (index 1), and so on. While a figure is still off the stilts, the answer is `null`.

Rules of thumb:

- Record the final state, not the clicks that led to it.
- Use stable ids, never pixel positions or the order of elements on the page.
- Never put correctness into the answer, such as `"correct": true`. The checker decides.

## 3. Create the widget

Keep the widget and the checker side by side in one folder, with the checker outside the widget:

```sh
mkdir stilts && cd stilts
npx @eolymp/widget init widget
```

`init` creates a starter in `widget/`:

```
stilts/
└── widget/
    ├── index.html
    ├── widget.js
    ├── style.css
    ├── AGENTS.md
    ├── README.md
    └── lib/
        ├── widget-sdk.js
        └── widget-sdk.css
```

`lib/` is the SDK itself. It is copied into the widget because a widget may only load files from its own archive. Don't edit it.

Start the local host:

```sh
npx @eolymp/widget dev widget
```

and open http://localhost:4300. The page runs the widget the way Eolymp does, and shows next to it the answer the widget produces. Keep it open: it reloads when you save a file.

## 4. Lay out the figures and the stilts

The SDK has a helper for "drag things into places": `eolymp.slots`. It looks for elements with `data-item` (the things you drag) and `data-slot` (the places they go). Items not in a slot sit where they are in the page.

Replace `widget/index.html` with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stilts</title>
  <link rel="stylesheet" href="./lib/widget-sdk.css">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div class="scene" id="scene">
    <div class="tray">
      <div data-item="0" aria-label="Figure 1" style="--h: 12"></div>
      <div data-item="1" aria-label="Figure 2" style="--h: 9"></div>
      <div data-item="2" aria-label="Figure 3" style="--h: 6"></div>
      <div data-item="3" aria-label="Figure 4" style="--h: 10"></div>
      <div data-item="4" aria-label="Figure 5" style="--h: 11"></div>
    </div>
    <div class="yard">
      <div data-slot="0" aria-label="Stilts 1" style="--s: 3"></div>
      <div data-slot="1" aria-label="Stilts 2" style="--s: 4"></div>
      <div data-slot="2" aria-label="Stilts 3" style="--s: 2"></div>
      <div data-slot="3" aria-label="Stilts 4" style="--s: 6"></div>
      <div data-slot="4" aria-label="Stilts 5" style="--s: 7"></div>
      <div data-slot="5" aria-label="Stilts 6" style="--s: 1"></div>
    </div>
  </div>

  <script src="./lib/widget-sdk.js"></script>
  <script src="./widget.js"></script>
</body>
</html>
```

The heights live in the markup as CSS variables, `--h` for a figure and `--s` for stilts, so the stylesheet can draw them to scale later. The `aria-label`s name each element for screen readers and keyboard users.

Replace `widget/widget.js` with:

```js
const placement = eolymp.slots("#scene");

eolymp.widget({ answer: placement });
```

`eolymp.slots` turns the markup into a working drag-and-drop: by mouse, by touch, by tapping an item and then a slot, and by keyboard. Each slot holds one item, and dropping onto a full one swaps the two. `eolymp.widget` connects it to Eolymp: it reports the answer, keeps a draft while the participant works, and shows a past submission back.

Drag a figure onto stilts in the dev page. It works, unstyled, and the answer panel shows what `slots` produces:

```json
{ "0": [], "1": ["2"], "2": [], "3": [], "4": [], "5": [] }
```

That is the shape `slots` always uses: for each slot, the items in it. It is correct, but it is not the answer designed in step 2.

## 5. Turn the placement into your answer

A helper returns a `Value`: an object with `get()`, `set(value)`, `update(change)` and `subscribe(listener)`. `eolymp.widget` reads the answer with `get`, restores a saved one with `set`, and listens with `subscribe`. To answer in your own shape, wrap the helper's Value in one that translates both ways.

Replace `widget/widget.js` with:

```js
const figures = ["0", "1", "2", "3", "4"];
const stilts = ["0", "1", "2", "3", "4", "5"];
const placement = eolymp.slots("#scene");

const answer = {
  get() {
    const placed = placement.get();
    const chosen = figures.map((figure) => stilts.find((stilt) => placed[stilt].includes(figure)));
    return chosen.includes(undefined) ? null : chosen.map(Number);
  },
  set(value) {
    const list = Array.isArray(value) ? value : [];
    placement.set(Object.fromEntries(stilts.map((stilt) => [stilt, figures.filter((_, i) => String(list[i]) === stilt)])));
  },
  update(change) {
    answer.set(change(answer.get()));
  },
  subscribe(listener) {
    return placement.subscribe(() => listener(answer.get()));
  },
};

eolymp.widget({ answer });
```

- `get` finds the stilts under each figure. Until every figure is placed it returns `null`.
- `set` does the reverse: it builds the placement from a list. It is called when a draft or a past submission is restored, and it may receive anything, including an older shape or garbage, so it treats anything that is not a list as "nothing placed" instead of throwing.

Place all five figures and the answer panel shows a list such as `[5,1,4,0,2]`.

## 6. Draw it

The SDK's stylesheet gives items and slots a plain default look: cards and dashed boxes. This task needs figures and stilts drawn to scale instead. Replace `widget/style.css` with:

```css
:root {
  --u: 14px;
  --wood: #b98a4b;
  --body: #c9a27a;
  --hat: #3f4a5a;
}

:root[data-theme="dark"] {
  --wood: #9a7442;
  --body: #8f7055;
  --hat: #c7ced8;
}

.scene {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: center;
  gap: 32px;
}

.tray,
.yard {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.tray {
  min-height: calc(12 * var(--u));
}

.yard {
  height: calc(20 * var(--u));
  background: repeating-linear-gradient(to top, var(--ew-border) 0 1px, transparent 1px var(--u));
}

.yard [data-slot] {
  flex-direction: column;
  justify-content: flex-end;
  width: calc(3 * var(--u));
  min-width: 0;
  min-height: 0;
  padding: 0 0 calc(var(--s) * var(--u));
  border: 0;
  border-radius: 0;
  background: linear-gradient(var(--wood), var(--wood)) center bottom / 6px calc(var(--s) * var(--u)) no-repeat;
}

.yard [data-slot][data-over] {
  background-color: var(--ew-accent-soft);
}

[data-item] {
  width: calc(2.4 * var(--u));
  height: calc(var(--h) * var(--u));
  padding: 0;
  border: 0;
  border-radius: calc(1.2 * var(--u)) calc(1.2 * var(--u)) 4px 4px;
  background: linear-gradient(var(--hat) 0 calc(1.5 * var(--u)), var(--body) 0);
}
```

How it works:

- `--u` is one unit of height. A figure is `--h` units tall, a pole is `--s` units tall, and the lines behind the yard mark every unit so heights can be counted.
- Each slot is a column with its pole drawn as a background along the bottom and the same amount of bottom padding, so a figure dropped in it stands on top of the pole.
- `[data-over]` is set by the SDK on the slot under a dragged item. Here it tints the slot so the drop target is clear.
- Every colour is a variable, and `:root[data-theme="dark"]` redefines them. Eolymp tells the widget which theme the page uses, and the SDK sets `data-theme` on `<html>`. The SDK's own variables, such as `--ew-border` and `--ew-accent-soft`, already switch with it.
- There is no box around the scene. Eolymp shows the widget in a frame of its own, and a second frame inside it looks out of place.

## 7. Write the checker

A widget problem has no tests. Each submission is judged once, for 100 points, by the checker alone. The checker gets the widget's answer as the participant's output file; the input and answer files are empty, so the checker holds everything the task expects.

Create `checker.js` next to the `widget` folder, not inside it. Everything inside the widget folder is uploaded and can be read by the participant's browser, and the checker gives the solution away.

```js
const fs = require("fs");

const FIGURES = [12, 9, 6, 10, 11];
const STILTS = [3, 4, 2, 6, 7, 1];

const verdict = (message, code) => {
  console.log(message);
  process.exit(code);
};

let answer;
try {
  answer = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
} catch {
  verdict("The answer is not JSON.", 1);
}

const valid = (stilt) => Number.isInteger(stilt) && stilt >= 0 && stilt < STILTS.length;
if (!Array.isArray(answer) || answer.length !== FIGURES.length || !answer.every(valid)) {
  verdict("Not every figure is on stilts.", 1);
}
if (new Set(answer).size !== answer.length) {
  verdict("Two figures share the same stilts.", 1);
}

const tops = answer.map((stilt, figure) => FIGURES[figure] + STILTS[stilt]);
if (tops.every((top) => top === tops[0])) {
  verdict("All hats are level.", 0);
}
verdict(`The hats are at ${tops.join(", ")}.`, 1);
```

This is a checker in Eolymp mode. It is called with three files, input, output and answer, and the output file (`process.argv[3]`) holds the widget's JSON. It exits 0 for a correct answer and 1 for a wrong one, and what it prints is shown with the verdict.

Notice what it does not do:

- It never compares the answer with `[5,1,4,0,2]`. It checks the property the task asks for, that all hats are level, so any other correct placement would pass too.
- It never compares the JSON as text. `[5, 1, 4, 0, 2]` and `[5,1,4,0,2]` are the same answer.
- It trusts nothing. The answer comes from a browser, so the checker validates its shape before using it.

Try it on a few answers, with an empty file standing in for the input and answer files:

```sh
touch empty.txt
echo '[5,1,4,0,2]' > answer.json && node checker.js empty.txt answer.json empty.txt
# All hats are level.
echo '[3,1,4,0,2]' > answer.json && node checker.js empty.txt answer.json empty.txt
# The hats are at 18, 13, 13, 13, 13.
echo 'null' > answer.json && node checker.js empty.txt answer.json empty.txt
# Not every figure is on stilts.
```

`echo $?` after each one shows the exit code.

To give part of the score, print `points <n>` and exit with 7. The environment variable `TEST_COST` holds what the run is worth, 100 for a widget problem. For example, 20 points for every figure whose hat is at the most common height, placed just before the last line:

```js
const level = Math.max(...tops.map((top) => tops.filter((other) => other === top).length));
if (level < tops.length) {
  console.log(`points ${level * 20}`);
  process.exit(7);
}
```

## 8. Test it like a participant

Go back to the dev page and work through the same things Eolymp will do with the widget:

1. Place the figures as `[5,1,4,0,2]` and check the answer panel shows exactly that.
2. Press **Reload widget**: the figures must come back where they were. This is how a draft and a past submission are restored.
3. Paste `"garbage"` into **Restore an answer** and send it: the widget must not break.
4. Press **Start over**: everything goes back to the tray.
5. Switch **Mode** to view: the answer shows and nothing can be dragged.
6. Switch **Theme** to dark: everything stays readable.
7. Switch **Width** to phone: the yard moves under the tray and everything can still be tapped.

## 9. Pack and upload

```sh
npx @eolymp/widget pack widget
```

`pack` checks the folder against the platform's rules, such as no files loaded from other sites and only allowed file types, and writes `widget.zip`. Fix anything it reports before uploading.

In the [console](https://console.eolymp.com):

1. Open **Problems**, click **New problem** and choose **Widget**.
2. Write the statement: the task from the top of this page.
3. On the problem's **Widget** tab, **Upload** `widget.zip`.
4. On the same tab, set the **Checker**: a JavaScript program, Eolymp mode, with the contents of `checker.js`.
5. Try the widget in the preview and **Submit** `[5,1,4,0,2]`. It should be accepted. Submit a wrong placement too, and check that it is rejected with the checker's message.
6. **Publish** the problem.

The console side is described in full in the [Eolymp help center](https://support.eolymp.com/console/problems/widget).

## Where to go next

- [examples/](../examples) has a runnable widget for every helper. [examples/stilts](../examples/stilts) is this task with a numbered scale.
- [AGENTS.md](../AGENTS.md) is the full reference: every helper, its options and answer shape, and the rules for custom widgets. `init` copies it into every widget, so a coding assistant working in the folder reads it too.
- When no helper fits, keep the answer in `eolymp.state` and draw it yourself. [examples/cut](../examples/cut) drags line ends around a field this way.
