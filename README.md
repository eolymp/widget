# @eolymp/widget-sdk

The official toolkit for building **widget problems** on [Eolymp](https://eolymp.com): Bebras-style tasks where the participant answers by interacting with a picture rather than by writing code.

- **Protocol client.** Speaks Eolymp's widget protocol for you: answers, drafts, view mode, height.
- **Input helpers.** Grid, pick (single, multiple, path; works on SVG), drag-into-slots, sortable. Each handles mouse, touch and keyboard and locks itself in view mode.
- **Base CSS.** A clean default look you theme with CSS variables.
- **CLI.** `init` a starter, `dev` it in a local host that behaves like Eolymp, `pack` it into an upload-ready zip after checking the platform's rules.
- **[AGENTS.md](./AGENTS.md).** The complete guide: sandbox rules, every helper's answer shape, the checker, and a checklist before upload. `init` copies it into every new widget, so a coding assistant working there finds it.

## Quick start

```sh
npx @eolymp/widget-sdk init my-widget
npx @eolymp/widget-sdk dev my-widget      # open http://localhost:4300
npx @eolymp/widget-sdk pack my-widget     # → my-widget.zip
```

Upload the zip in the console under **Problems → your problem → Widget**.

```js
const board = eolymp.grid("#board", { rows: 4, cols: 4 });
eolymp.widget({ answer: board });
```

### With a bundler

```sh
npm install @eolymp/widget-sdk
```

```js
import { pickPath, widget } from "@eolymp/widget-sdk";
import "@eolymp/widget-sdk/style.css";

widget({ answer: pickPath("#map", { start: "A" }) });
```

Eolymp serves a widget from a subfolder (`/bundles/<id>/`), but Vite writes absolute paths like `/assets/index.js` by default, and those would point at the root of the asset host. Make Vite write relative paths:

```js
// vite.config.js
export default { base: "./" };
```

```sh
npx @eolymp/widget-sdk dev --url http://localhost:5173/   # host the Vite dev server like Eolymp does
npx @eolymp/widget-sdk pack dist                          # zip the build output
```

### Why the SDK is copied into the bundle

Widgets run under a content policy that allows scripts only from Eolymp's asset host, so a widget cannot load the SDK from a CDN. `init` copies `widget-sdk.js` and `widget-sdk.css` into `lib/`, and a bundler inlines them. The standalone build is also published at `@eolymp/widget-sdk/widget-sdk.js` (for example on jsDelivr or unpkg) to download, not to link.

## The principle

The widget is a **fancy input**, nothing more. The question, the rules, the submit button and the verdict all live in Eolymp's page. A widget with its own text or buttons looks out of place, and one that hints at correctness leaks the answer. Grading happens only in the problem's checker, which receives the widget's JSON as the participant's output.

## API

| Export | Returns | Answer shape |
|---|---|---|
| `widget({ answer, load?, getHeight? })` | — | registers the widget (call once) |
| `widget({ getAnswer, reloadAnswer?, load? })` | — | low-level form; call `answerChanged()` on change |
| `state(initial)` | `Value<T>` | whatever you put in |
| `combine({ a, b })` | `Value<{a, b}>` | `{ "a": …, "b": … }` |
| `grid(root, { rows, cols, values?, label?, locked? })` | `Value<V[][]>` | `[[0,1],[1,0]]` |
| `pickOne(root, { items? })` | `Value<string \| null>` | `"B"` |
| `pickMany(root, { items?, max? })` | `Value<string[]>` | `["A","D"]` |
| `pickPath(root, { start?, canFollow?, repeat?, max? })` | `Value<string[]>` | `["A","B","D"]` |
| `slots(root, { items?, slots?, capacity? })` | `Value<Record<string,string[]>>` | `{"s1":["x"],"s2":[]}` |
| `sortable(root, { items? })` | `Value<string[]>` | `["C","A","B"]` |
| `mode()`, `readonly()`, `locale()` | | current host context |
| `answerChanged()`, `submit()` | | events to the host |

A `Value<T>` is `{ get(), set(v), update(fn), subscribe(fn) }`. The details and the rules for custom widgets are in [AGENTS.md](./AGENTS.md). Runnable samples are in [examples/](./examples).

## Protocol

For hosts, tests, and anyone writing a widget without this SDK. The types are exported from `@eolymp/widget-sdk/protocol`.

The widget runs in `<iframe sandbox="allow-scripts allow-forms">`, so it has an opaque origin. Messages go through `postMessage` with target `"*"`, and each side accepts only messages whose `event.source` is the other side's window: the host accepts its own frame, and the widget accepts `window.parent`. Every message carries `protocol: "eolymp.widget.v1"`, and anything without it is ignored.

**Host → widget: requests**, `{ protocol, id, request }`. The widget must reply to each one with `{ protocol, id, response }` or `{ protocol, id, error }`.

| `request` | `response` | Meaning |
|---|---|---|
| `{ type: "load", mode: "solve" \| "view", locale }` | `{ height? }` | Start. Sent once per page load. The host shows a loader until it is answered. |
| `{ type: "reload_answer", answer: string }` | `{}` | Show this answer: a draft or a past submission. The JSON was produced by `get_answer`, possibly by an older version of the widget. |
| `{ type: "get_answer" }` | `{ answer: string }` | Return the current answer as a JSON string of at most 64 KB. |
| `{ type: "get_height" }` | `{ height }` | Return the desired height in CSS pixels. |

**Widget → host: events**, `{ protocol, event }`, which are not replied to.

| `event` | Meaning |
|---|---|
| `{ type: "answer_changed", answer }` | The participant changed something; the host stores it as a draft. |
| `{ type: "height_changed", height }` | The content height changed. |
| `{ type: "submit" }` | The widget asks the host to submit. Rarely appropriate. |

Order: the frame loads → `load` → (`reload_answer` if a draft or a submission exists) → events and `get_answer` as needed. A request that goes unanswered for 10 seconds fails, and the host shows the widget as broken. Requests can arrive before the widget's script has run, so a client must queue them until the widget is ready, as this SDK does.

## Development

```sh
npm install
npm test                                              # builds, then runs the tests in happy-dom
node cli/index.js dev examples --entry path/index.html
```

Releases are published to npm from a version tag (`v0.1.0`) by GitHub Actions.

## License

MIT
