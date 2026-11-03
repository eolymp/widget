# Tutorial: your first widget problem

[Українською](./tutorial.uk.md)

In this tutorial we'll build a complete widget problem together, from an empty folder to a problem participants can solve on Eolymp. It's a small task, but it goes through every step you'll take with your own problems.

You'll need [Node.js](https://nodejs.org) 20 or later and an [Eolymp space](https://console.eolymp.com) where you can create problems.

## The task

Five figures want to walk on stilts, and there are six pairs of stilts of different heights. The participant has to put each figure on stilts so that all the hats end up at the same height.

| Figure | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Height | 12 | 9 | 6 | 10 | 11 |

| Stilts | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Height | 3 | 4 | 2 | 6 | 7 | 1 |

The solution: every hat can reach height 13.

- Figure 1 → stilts 6 (12 + 1)
- Figure 2 → stilts 2 (9 + 4)
- Figure 3 → stilts 5 (6 + 7)
- Figure 4 → stilts 1 (10 + 3)
- Figure 5 → stilts 3 (11 + 2)

Stilts 4 are left over.

## 1. What we'll make

Every widget problem is made of three things:

- **A statement.** All the text goes here: the story, the rules, what to do. You write it in the console, like any other problem statement.
- **A widget.** A small web page under the statement where the participant builds the answer. Here, that's the figures and the stilts to drag them onto. It's only the answer input: no text, no "Check" button, and it never says whether the answer is right. The page already has a Submit button.
- **A checker.** A small program that gets the participant's answer and decides whether it's right.

For this task, the statement is the description and the two tables above (without the solution, of course). So most of this tutorial is about the widget and the checker.

## 2. Decide what the answer looks like

When the participant presses Submit, the widget hands over its answer as JSON. Nobody but your widget and your checker ever reads it, so pick whatever shape makes the checker easiest to write.

The question here is "which stilts does each figure stand on?", so let's answer with a list: one stilts number per figure, counting from 0. The solution above becomes:

```json
[5, 1, 4, 0, 2]
```

The first number is figure 1's stilts (5 is stilts 6, counting from 0), the second is figure 2's, and so on. Until every figure is on stilts, the answer is `null`.

A few rules of thumb for any task:

- Record the final state, not the clicks that led to it, unless the moves are part of the task (for example, "solve it in the fewest moves").
- Use stable ids, never pixel positions or the order of elements on the page.
- Never put correctness into the answer, such as `"correct": true`. The checker decides.

## 3. Create the widget

Make a folder for the problem and create the widget inside it. Later the checker goes next to the widget, not inside it; step 7 explains why.

```sh
mkdir stilts && cd stilts
npx @eolymp/widget init widget
```

`init` gives you a starter in `widget/`:

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

`lib/` is the SDK itself. It's copied in because a widget can only load files from its own archive, never from the internet. You won't need to touch it.

Now start the local preview:

```sh
npx @eolymp/widget dev widget
```

and open http://localhost:4300. It runs your widget the same way Eolymp will, and shows the answer next to it as you play. Keep it open while you work: it reloads every time you save a file.

## 4. Lay out the figures and the stilts

For "drag things into places" the SDK has a ready-made helper, `eolymp.slots`. You mark the things to drag with `data-item` and the places they go with `data-slot`, and it does the rest. Anything not yet in a slot stays where it is in the page.

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

Each figure carries its height in `--h` and each pair of stilts in `--s`, so later the stylesheet can draw them to scale. The `aria-label`s give every element a name for screen readers and keyboard users.

Now replace `widget/widget.js` with just two lines:

```js
const placement = eolymp.slots("#scene");

eolymp.widget({ answer: placement });
```

That's already a working widget. `eolymp.slots` makes the figures draggable with a mouse, by touch, by tapping a figure and then the stilts, and from the keyboard. Each pair of stilts holds one figure, and dropping onto a taken pair swaps them. `eolymp.widget` connects it all to Eolymp: it reports the answer, saves a draft as the participant works, and shows past submissions back.

Try it in the preview: drag a figure onto some stilts. It doesn't look like much yet, but it works, and the answer panel shows what `slots` reports:

```json
{ "0": [], "1": ["2"], "2": [], "3": [], "4": [], "5": [] }
```

That's `slots`' own format: every slot with the items in it. It's accurate, but it isn't the simple list we decided on in step 2. Let's fix that.

## 5. Turn the placement into your answer

Every helper gives you back a `Value`: an object with `get()`, `set(value)`, `update(change)` and `subscribe(listener)`. `eolymp.widget` uses `get` to read the answer, `set` to restore a saved one, and `subscribe` to hear about changes. To answer in your own format, wrap the helper's Value in your own object that translates in both directions.

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

- `get` looks up which stilts each figure is on. If any figure is still waiting, it returns `null`.
- `set` goes the other way: it takes a list and puts the figures in place. It runs when a draft or a past submission is restored, and it can be handed anything, even an old format or garbage. So instead of crashing on something unexpected, it treats it as "nothing placed yet".

Place all five figures and the answer panel now shows a list like `[5,1,4,0,2]`.

## 6. Draw it

Out of the box, the SDK draws items as cards and slots as dashed boxes. For this task we want figures and stilts drawn to scale instead. Replace `widget/style.css` with:

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

What's going on:

- `--u` is one unit of height. A figure is `--h` units tall and a pole `--s` units tall. The faint lines behind the stilts mark every unit, so participants can count.
- Each pair of stilts is drawn as a pole along the bottom of its slot, with the same amount of padding underneath, so a figure dropped there stands right on top of the pole.
- While a figure is dragged over stilts, the SDK marks them with `[data-over]`. We tint them so it's clear where the figure will land.
- All colours are variables, with a second set under `:root[data-theme="dark"]`. When the participant's page is dark, the SDK sets `data-theme="dark"` on `<html>` and the dark colours kick in. The SDK's own variables, like `--ew-border`, switch on their own.
- There's no box around the scene on purpose. Eolymp already shows the widget in a frame, and a box inside it looks like a second frame.

## 7. Write the checker

Unlike a programming problem, a widget problem has no tests. Each submission is checked once, worth 100 points, and the checker alone decides. It receives the widget's answer as the participant's "output file". The input and answer files are empty, so everything the task expects lives in the checker itself.

Create `checker.js` next to the `widget` folder, not inside it. Everything in the widget folder gets uploaded and is readable by anyone's browser, and a checker there would give the solution away.

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

This checker runs in Eolymp mode. It's called with three files (input, output and answer), and the output file, `process.argv[3]`, holds the widget's JSON. It exits with 0 when the answer is right and 1 when it's wrong, and whatever it prints is shown to the participant with the verdict.

A few things it deliberately doesn't do:

- It doesn't compare the answer with `[5,1,4,0,2]`. It checks what the task actually asks, that all hats are level, so any other correct placement passes too.
- It doesn't compare the JSON as text. `[5, 1, 4, 0, 2]` and `[5,1,4,0,2]` are the same answer.
- It doesn't trust the answer. It comes from a browser, so the checker checks its shape before using it.

Try it on a few answers. An empty file stands in for the input and answer files:

```sh
touch empty.txt
echo '[5,1,4,0,2]' > answer.json && node checker.js empty.txt answer.json empty.txt
# All hats are level.
echo '[3,1,4,0,2]' > answer.json && node checker.js empty.txt answer.json empty.txt
# The hats are at 18, 13, 13, 13, 13.
echo 'null' > answer.json && node checker.js empty.txt answer.json empty.txt
# Not every figure is on stilts.
```

Run `echo $?` after any of them to see the exit code.

Want to give partial credit? Print `points <n>` and exit with 7. The environment variable `TEST_COST` holds what the run is worth, which is 100 for a widget problem. For example, to give 20 points for every hat at the most common height, add this just before the last line:

```js
const level = Math.max(...tops.map((top) => tops.filter((other) => other === top).length));
if (level < tops.length) {
  console.log(`points ${level * 20}`);
  process.exit(7);
}
```

## 8. Test it like a participant

Back in the preview, put the widget through what Eolymp and participants will do with it:

1. Place the figures as `[5,1,4,0,2]` and check that the answer panel shows exactly that.
2. Press **Reload widget**. The figures should come back where they were: that's how drafts and past submissions are restored.
3. Paste `"garbage"` into **Restore an answer** and send it. The widget shouldn't break.
4. Press **Start over**. All figures go back to where they started.
5. Switch **Mode** to view. The answer is shown and nothing can be dragged.
6. Switch **Theme** to dark. Everything should stay easy to read.
7. Switch **Width** to phone. The stilts move under the figures and everything can still be tapped.

## 9. Pack and upload

```sh
npx @eolymp/widget pack widget
```

`pack` checks the folder against Eolymp's rules (nothing loaded from other sites, only allowed file types) and writes `widget.zip`. If it reports a problem, fix it before uploading.

Now, in the [console](https://console.eolymp.com):

1. Open **Problems**, click **New problem** and choose **Widget**.
2. Write the statement: the task from the top of this page.
3. On the problem's **Widget** tab, **Upload** `widget.zip`.
4. On the same tab, set the **Checker**: a JavaScript program, Eolymp mode, with the contents of `checker.js`.
5. Try the widget in the preview and **Submit** the solution. It should be accepted. Submit a wrong placement too, and check that it's rejected with the checker's message.
6. **Publish** the problem.

That's it: your first widget problem is live. The [Eolymp help center](https://support.eolymp.com/console/problems/widget) covers the console side in more detail.

## Where to go next

- [examples/](../examples) has a runnable widget for every helper. [examples/stilts](../examples/stilts) is this same task, with a numbered scale.
- [AGENTS.md](../AGENTS.md) is the full reference: every helper with its options and answer format, and the rules for custom widgets. `init` copies it into each new widget, so an AI assistant working in the folder reads it too.
- No helper fits your idea? Keep the answer in `eolymp.state` and draw everything yourself. [examples/cut](../examples/cut) does this to let participants drag the ends of lines around a field.
