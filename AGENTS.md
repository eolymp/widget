# Building an Eolymp widget

You are building the widget for an Eolymp **widget problem** (a Bebras-style task). Read this file completely before writing code.

## What a widget is

A widget is a small web page shown under the problem statement. The participant uses it to build an answer: they mark cells, draw a path, drag items into boxes, put things in order. When they submit, Eolymp asks the widget for the answer, a JSON document, and passes it to a **checker** program that grades it.

The widget is **only the answer input**. Eolymp's UI provides everything else:

| Belongs in the widget | Does NOT belong in the widget |
|---|---|
| The interactive picture: board, graph, items, slots | The question text, story, rules, examples. Put them in the statement. |
| Labels that are part of the picture (node names, cell letters) | Submit, Check, Reset or Next buttons. The page has its own submit. |
| | Any hint of whether the answer is right. No verdicts, no "Correct!", no scores. |
| | The answer key or grading logic. The bundle is public; grading happens only in the checker. |

## Files and hard constraints

A widget is a folder that gets zipped. `index.html` is the entry page. Everything must be inside the folder and referenced by a **relative** path (`./widget.js`, never `/widget.js` and never `https://...`).

The page runs in a sandboxed iframe with no same-origin access:

- **No network.** Scripts, styles, fonts and images from CDNs or other sites are blocked. `fetch` works only for files inside the bundle.
- **No storage.** `localStorage`, `sessionStorage` and cookies throw. Keep state in variables. Eolymp keeps drafts for you.
- **No popups, alerts, dialogs or navigation.**
- Accepted file types: `.html .htm .js .mjs .css .json .map .txt .wasm .svg .png .jpg .jpeg .gif .webp .ico .woff .woff2 .ttf .mp3 .ogg .wav .mp4 .webm`. `.md` files are skipped by `pack`.
- Limits: archive 5 MB; unpacked 50 MB; at most 1000 files, each up to 10 MB. The answer is at most 64 KB of JSON.

## Workflow

```sh
npx @eolymp/widget-sdk init my-widget   # starter: index.html, widget.js, style.css, lib/
npx @eolymp/widget-sdk dev my-widget    # http://localhost:4300 hosts it the way Eolymp does
npx @eolymp/widget-sdk pack my-widget   # checks the rules above, writes my-widget.zip
```

`dev` runs the widget under the production sandbox and a matching content policy, so anything that breaks on Eolymp breaks there too. It shows the live answer JSON and its size, switches between `solve` and `view` mode and between phone, tablet and desktop widths, and can send any answer back in. It reloads when files change and restores the last answer, as Eolymp does with drafts.

Upload the zip in the console: **Problems → your problem → Widget**.

## The smallest widget

```html
<!-- index.html -->
<link rel="stylesheet" href="./lib/widget-sdk.css">
<div id="board"></div>
<script src="./lib/widget-sdk.js"></script>
<script src="./widget.js"></script>
```

```js
// widget.js
const board = eolymp.grid("#board", { rows: 4, cols: 4 });
eolymp.widget({ answer: board });
```

This submits `[[0,1,0,0],[0,0,1,0],...]`, restores drafts and past submissions, locks itself in view mode, and reports its height. `lib/widget-sdk.js` defines the global `eolymp`.

With a bundler, use `import { grid, widget } from "@eolymp/widget-sdk"` and `import "@eolymp/widget-sdk/style.css"`. See "Using a bundler" below.

## Core API

### `eolymp.widget(definition)`

Call it **once**, after the DOM the widget needs exists. It can be called before Eolymp asks for anything; earlier requests wait for it.

```js
eolymp.widget({
  answer,            // a Value (see below); the usual way
  load(context) {},  // optional; may be async. context = { mode, locale, readonly }
  getHeight() {},    // optional; the document height is measured automatically
});
```

Lower-level alternative, when the answer doesn't live in a Value:

```js
eolymp.widget({
  getAnswer: () => ({ cells }),               // object or array; serialised for you
  reloadAnswer: (answer) => { /* show it */ }, // gets the parsed JSON
});
// then call eolymp.answerChanged() after every user change
```

### Values

Everything that holds part of an answer is a `Value`: `{ get(), set(v), update(fn), subscribe(fn) }`. Every helper below returns one. Pass a Value as `answer` and the SDK does the rest: it reads the answer from it, restores into it without echoing a change back, and reports every change as a draft.

- `eolymp.state(initial)` is a plain Value for custom widgets.
- `eolymp.combine({ a: valueA, b: valueB })` merges several Values into one answer `{ a, b }`. Use it for tasks with several parts.

### Mode

`load` receives `mode`: `"solve"` while the participant works, and `"view"` while a past submission is shown. In view mode the SDK sets `<html data-mode="view">`, and every helper ignores input. In custom code, check `eolymp.readonly()` before changing state. `eolymp.locale()` returns the page language.

`eolymp.submit()` asks the page to submit. You almost never want it, because the page has its own submit button.

## Helpers

All helpers take a root (an element or a CSS selector) and options, and return a Value. Items are identified by attributes you write in HTML or SVG, so the answer uses **your ids**, not DOM positions.

### `grid(root, { rows, cols, values?, initial?, label?, locked? })`

Builds a rows × cols board of buttons in `root`. A click moves a cell to the next value; Shift+click moves it back.

- `values`: the states a cell cycles through. The default is `[0, 1]`; colours could be `["", "R", "G", "B"]`.
- `label(r, c)`: fixed text in a cell, such as a letter.
- `locked(r, c)`: a given cell that can't be changed.
- Answer: `values[][]`, for example `[[0,1],[1,0]]`.
- Styling: `.ew-cell[data-state="0..5"]` gets a colour from `--ew-state-N`, `[data-value]` holds the raw value, and `--ew-cell` sets the cell size.

### `pickOne(root, { items?, initial? })`

Single choice among elements with `data-id`. Use it for "which picture / which node / where is the mine". Answer: `"B"` or `null`.

### `pickMany(root, { items?, initial?, max? })`

Toggles any number of elements, up to `max`. Answer: `["A", "D"]`, in pick order.

### `pickPath(root, { items?, start?, canFollow?, repeat?, max?, initial? })`

Builds a sequence of picks: a route, a word traced through letters, a walk through a graph.

- `start`: a fixed first element that can't be removed.
- `canFollow(from, to, path)`: return `false` to refuse a step, for example when two nodes are not adjacent. This is an input rule, not grading.
- Clicking the last element removes it. Clicking an earlier element cuts the path back to it, unless `repeat: true`, which allows revisiting.
- Answer: `["A", "B", "D"]`. Elements get `data-order="N"`.

The pick helpers work on HTML **and SVG** elements. Pass the `<svg>` as root and put `data-id` on the shapes. Picked elements get `[data-picked]`, which you can style.

### `slots(root, { items?, slots?, capacity?, initial? })`

Drag and drop. Elements with `data-item="id"` can be dragged into elements with `data-slot="id"`. Touch, mouse and keyboard all work. A user can also tap an item and then tap a slot.

- `capacity`: items per slot; the default is 1. Dropping onto a full slot with capacity 1 swaps the two items.
- Dropping outside any slot sends the item back to where it started in the HTML.
- Answer: every slot, always present: `{ "s1": ["apple"], "s2": [] }`.

### `sortable(root, { items?, initial? })`

Reorders the `data-id` children of `root` by dragging, or with the arrow keys. Answer: `["C", "A", "B"]`.

`items` is a CSS selector, if you need something other than the default attribute (`[data-id]`, `[data-item]`, `[data-slot]`). Use the form `[data-something]`; the id is read from that attribute.

## Custom widgets

When no helper fits, keep the answer in `eolymp.state` and render from it:

```js
const answer = eolymp.state({ lamps: [false, false, false] });

const render = ({ lamps }) => {
  lamps.forEach((on, i) => (buttons[i].dataset.on = on));
};
answer.subscribe(render);
render(answer.get());

buttons.forEach((button, i) =>
  button.addEventListener("click", () => {
    if (eolymp.readonly()) return;
    answer.update((a) => ({ lamps: a.lamps.map((on, j) => (j === i ? !on : on)) }));
  }),
);

eolymp.widget({ answer });
```

Rules for custom code:

- Never mutate the value in place. Create a new one with `set` or `update`, so that changes are reported.
- `set` may receive **any JSON** when an answer is restored: an old draft, an earlier version's shape, or garbage. Validate it, and fall back to an empty state instead of throwing.
- Ignore input when `eolymp.readonly()` is true.
- Use `<button>` for anything clickable, or give the element `tabindex="0"` and handle Enter and Space.

## Designing the answer

The answer is read by the checker, not by people. Make it easy to grade:

- Use **stable, meaningful ids** (`"A"`, `"apple"`, `"r2c3"`), not DOM indexes or pixel positions.
- Record only what the checker needs: the final state, not a history of clicks (unless the task is about the moves).
- Keep it deterministic. The same visible state must always produce the same JSON.
- If a task has several independent parts, use `combine` and grade each part in its own test (see below).
- Never put correctness into the answer, such as `"correct": true`. The checker decides.

## The checker

On every test the checker reads the widget's JSON as `output.txt`, and that test's expected data as `answer.txt`. Parse both as JSON; never compare them as text. A widget problem with several parts uses one test per part, and the checker reads `TEST_INDEX` from the environment to know which part to grade. Full guide: https://support.eolymp.com/coaching/problems/widget

## Look and layout

`widget-sdk.css` gives a clean default look: system font, transparent background, styled helpers. Theme it with CSS variables instead of overriding the helper rules:

```css
:root {
  --ew-accent: #0f766e;   /* picked, selected, focus */
  --ew-cell: 56px;        /* grid cell size */
  --ew-state-2: #f59e0b;  /* grid colour for value index 2 */
}
```

Variables: `--ew-font --ew-fg --ew-muted --ew-surface --ew-subtle --ew-border --ew-accent --ew-accent-soft --ew-accent-fg --ew-radius --ew-gap --ew-cell --ew-state-0 … --ew-state-5`. Layout classes: `.ew-row` (wrapping row), `.ew-stack` (column), `.ew-center` (centred, wrapping).

- It must work from **360px** wide (a phone) up to about 900px. Use `max-width: 100%` and scale SVGs with `viewBox`; never use a fixed page width.
- Keep the background transparent so the widget sits naturally on the page.
- The frame grows to the document's height automatically. Avoid `height: 100vh`, because it creates a feedback loop.

## Using a bundler (Vite, etc.)

```sh
npm install @eolymp/widget-sdk
```

```js
import { grid, widget } from "@eolymp/widget-sdk";
import "@eolymp/widget-sdk/style.css";
```

- Set `base: "./"` in `vite.config`, or the built page will reference `/assets/...`, which won't resolve on Eolymp.
- During development, run `npx @eolymp/widget-sdk dev --url http://localhost:5173/` to host the dev server inside the Eolymp-like host.
- Pack the build output: `npx @eolymp/widget-sdk pack dist`.

## Checklist before uploading

1. `pack` reports no errors and no warnings.
2. In `dev`: build an answer, check the JSON is what the checker expects, then press **Reload widget** and confirm the answer comes back exactly.
3. Switch to **view** mode: the answer shows and nothing can be changed.
4. Check the **Phone** width: nothing overflows and everything can be tapped.
5. The widget contains no question text, no buttons of its own, and nothing that reveals the correct answer.
