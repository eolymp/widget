# @eolymp/widget

The official toolkit for building **widget problems** on [Eolymp](https://eolymp.com): Bebras-style tasks where the participant answers by interacting with a picture rather than by writing code.

- **Protocol client.** Speaks Eolymp's widget protocol for you: answers, drafts, view mode, height.
- **Input helpers.** Grid, pick (single, multiple, path; works on SVG), drag-into-slots, sortable. Each handles mouse, touch and keyboard and locks itself in view mode.
- **Base CSS.** A clean default look you theme with CSS variables.
- **CLI.** `init` a starter, `dev` it in a local host that behaves like Eolymp, `pack` it into an upload-ready zip after checking the platform's rules.
- **[AGENTS.md](./AGENTS.md).** The complete guide: sandbox rules, every helper's answer shape, the checker, and a checklist before upload. `init` copies it into every new widget, so a coding assistant working there finds it.

## Quick start

```sh
npx @eolymp/widget init my-widget
npx @eolymp/widget dev my-widget      # open http://localhost:4300
npx @eolymp/widget pack my-widget     # → my-widget.zip
```

Upload the zip in the console under **Problems → your problem → Widget**.

New to widgets? The tutorial builds a complete problem step by step: the widget, the checker, and the upload. It is available in [English](./docs/tutorial.md) and [Ukrainian](./docs/tutorial.uk.md).

## API

| Export | Returns | Answer shape |
|---|---|---|
| `widget({ answer, load?, getHeight? })` | — | registers the widget (call once) |
| `widget({ getAnswer, reloadAnswer?, load? })` | — | low-level form; call `answerChanged()` on change |
| `state(initial, normalize?)` | `Value<T>` | whatever you put in |
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

For hosts, tests, and anyone writing a widget without this SDK. The types are exported from `@eolymp/widget/protocol`.

The widget runs in `<iframe sandbox="allow-scripts allow-forms">`, so it has an opaque origin. Messages go through `postMessage` with target `"*"`, and each side accepts only messages whose `event.source` is the other side's window: the host accepts its own frame, and the widget accepts `window.parent`. Every message carries `protocol: "eolymp.widget.v1"`, and anything without it is ignored.

**Host → widget: requests**, `{ protocol, id, request }`. The widget must reply to each one with `{ protocol, id, response }` or `{ protocol, id, error }`.

| `request` | `response` | Meaning |
|---|---|---|
| `{ type: "load", mode: "solve" \| "view", locale, theme? }` | `{ height?, version? }` | Start. Sent once per page load. The host shows a loader until it is answered. `theme` is `"light"` or `"dark"`, and a widget treats a missing one as light. `version` is the protocol revision the widget speaks (below), 1 when missing. |
| `{ type: "set_theme", theme: "light" \| "dark" }` | `{}` | The page switched theme. Sent only to a widget of version 3 or later. |
| `{ type: "reload_answer", answer: string }` | `{}` | Show this answer: a draft or a past submission. The JSON was produced by `get_answer`, possibly by an older version of the widget. From version 2, an empty string means the participant starts over: put the widget back the way it opened. |
| `{ type: "get_answer" }` | `{ answer: string }` | Return the current answer as a JSON string of at most 64 KB. |
| `{ type: "get_height" }` | `{ height }` | Return the desired height in CSS pixels. |

**Widget → host: events**, `{ protocol, event }`, which are not replied to.

| `event` | Meaning |
|---|---|
| `{ type: "answer_changed", answer }` | The participant changed something; the host stores it as a draft. |
| `{ type: "height_changed", height }` | The content height changed. |
| `{ type: "submit" }` | The widget asks the host to submit. Rarely appropriate. |

Versions: 1 is the base set above; 2 adds the empty `reload_answer` reset, which a host otherwise does by loading the frame again; 3 adds `set_theme`. This SDK speaks 3. The `protocol` marker stays `eolymp.widget.v1` across versions.

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
