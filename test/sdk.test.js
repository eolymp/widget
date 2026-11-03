import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://eolympusercontent.com/bundles/x/index.html" });

const sent = [];
const host = { postMessage: (message) => sent.push(message) };
Object.defineProperty(window, "parent", { value: host, configurable: true });

const sdk = await import("../dist/index.js");
const { PROTOCOL } = sdk;

let id = 0;
const call = async (request) => {
  const message = { protocol: PROTOCOL, id: ++id, request };
  window.dispatchEvent(new MessageEvent("message", { data: message, source: host }));
  for (let i = 0; i < 20; i++) {
    const reply = sent.find((m) => m.id === message.id);
    if (reply) return reply;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`no reply to ${request.type}`);
};

const events = (type) => sent.filter((m) => m.event?.type === type);

const mount = (html) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};

const click = (element, init = {}) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));

after(() => GlobalRegistrator.unregister());

test("guards accept only protocol messages", () => {
  assert.ok(sdk.isCall({ protocol: PROTOCOL, id: 1, request: { type: "get_answer" } }));
  assert.ok(!sdk.isCall({ protocol: "other", id: 1, request: { type: "get_answer" } }));
  assert.ok(!sdk.isCall({ protocol: PROTOCOL, id: "1", request: { type: "get_answer" } }));
  assert.ok(sdk.isReply({ protocol: PROTOCOL, id: 2, error: "boom" }));
  assert.ok(sdk.isNotification({ protocol: PROTOCOL, event: { type: "submit" } }));
  assert.ok(!sdk.isNotification({ protocol: PROTOCOL, id: 3, response: {} }));
});

test("grid normalises a foreign answer and cycles values on click", () => {
  const root = mount(`<div id="g"></div>`);
  const board = sdk.grid(root.querySelector("#g"), { rows: 2, cols: 2, values: ["", "R", "G"] });

  board.set([["G", "x"], null]);
  assert.deepEqual(board.get(), [["G", ""], ["", ""]]);

  const cells = root.querySelectorAll(".ew-cell");
  click(cells[0]);
  assert.deepEqual(board.get()[0][0], "");
  click(cells[1]);
  click(cells[1]);
  assert.deepEqual(board.get()[0][1], "G");
  click(cells[3], { shiftKey: true });
  assert.deepEqual(board.get()[1][1], "G");
  assert.equal(cells[1].dataset.state, "2");
});

test("pickPath follows the adjacency rule, pops the tail and truncates", () => {
  const root = mount(["A", "B", "C", "D"].map((id) => `<span data-id="${id}"></span>`).join(""));
  const edges = new Set(["A-B", "B-C", "C-D", "B-D"]);
  const path = sdk.pickPath(root, { start: "A", canFollow: (a, b) => edges.has(`${a}-${b}`) || edges.has(`${b}-${a}`) });
  const node = (id) => root.querySelector(`[data-id="${id}"]`);

  click(node("C"));
  assert.deepEqual(path.get(), ["A"]);
  click(node("B"));
  click(node("C"));
  click(node("D"));
  assert.deepEqual(path.get(), ["A", "B", "C", "D"]);
  assert.equal(node("C").getAttribute("data-order"), "3");

  click(node("D"));
  assert.deepEqual(path.get(), ["A", "B", "C"]);
  click(node("B"));
  assert.deepEqual(path.get(), ["A", "B"]);
  click(node("A"));
  assert.deepEqual(path.get(), ["A"]);

  path.set(["X", "B"]);
  assert.deepEqual(path.get(), ["A", "B"]);
});

test("pickMany respects max, pickOne keeps one", () => {
  const root = mount(`<i data-id="a"></i><i data-id="b"></i><i data-id="c"></i>`);
  const many = sdk.pickMany(root, { max: 2 });
  for (const item of root.querySelectorAll("i")) click(item);
  assert.deepEqual(many.get(), ["a", "b"]);

  const other = mount(`<i data-id="a"></i><i data-id="b"></i>`);
  const one = sdk.pickOne(other);
  click(other.querySelector('[data-id="b"]'));
  assert.equal(one.get(), "b");
  one.set("zzz");
  assert.equal(one.get(), null);
});

test("slots place by tap, swap when full, and send home", () => {
  const root = mount(`
    <div id="tray"><b data-item="x">x</b><b data-item="y">y</b></div>
    <div data-slot="s1"></div><div data-slot="s2"></div>`);
  const placement = sdk.slots(root);
  const item = (id) => root.querySelector(`[data-item="${id}"]`);
  const slot = (id) => root.querySelector(`[data-slot="${id}"]`);

  assert.deepEqual(placement.get(), { s1: [], s2: [] });

  click(item("x"));
  click(slot("s1"));
  assert.deepEqual(placement.get(), { s1: ["x"], s2: [] });
  assert.equal(item("x").parentElement, slot("s1"));

  click(item("y"));
  click(slot("s2"));
  click(item("y"));
  click(slot("s1"));
  assert.deepEqual(placement.get(), { s1: ["y"], s2: ["x"] });

  click(item("y"));
  click(root.querySelector("#tray"));
  assert.deepEqual(placement.get(), { s1: [], s2: ["x"] });
  assert.equal(item("y").parentElement, root.querySelector("#tray"));

  placement.set({ s1: ["x", "x"], s2: ["x", "nope"] });
  assert.deepEqual(placement.get(), { s1: ["x"], s2: [] });
});

test("sortable keeps every item when restoring a partial order", () => {
  const root = mount(`<div id="l"><i data-id="a"></i><i data-id="b"></i><i data-id="c"></i></div>`);
  const order = sdk.sortable(root.querySelector("#l"));
  order.set(["c", "zzz", "c"]);
  assert.deepEqual(order.get(), ["c", "a", "b"]);
  assert.deepEqual([...root.querySelectorAll("i")].map((i) => i.dataset.id), ["c", "a", "b"]);
});

test("client answers the host through a value", async () => {
  const root = mount(`<div id="board"></div>`);
  const pending = call({ type: "load", mode: "solve", locale: "uk" });

  const board = sdk.grid(root.querySelector("#board"), { rows: 1, cols: 2 });
  let loaded;
  sdk.widget({ answer: board, load: (context) => (loaded = context) });

  const reply = await pending;
  assert.deepEqual(loaded, { mode: "solve", locale: "uk", theme: "light", readonly: false });
  assert.equal(typeof reply.response.height, "number");

  click(root.querySelectorAll(".ew-cell")[1]);
  assert.equal(events("answer_changed").at(-1).event.answer, "[[0,1]]");

  const before = events("answer_changed").length;
  await call({ type: "reload_answer", answer: "[[1,1]]" });
  assert.deepEqual(board.get(), [[1, 1]]);
  assert.equal(events("answer_changed").length, before);

  assert.equal((await call({ type: "get_answer" })).response.answer, "[[1,1]]");

  assert.equal(document.documentElement.dataset.theme, "light");
  await call({ type: "set_theme", theme: "dark" });
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(sdk.theme(), "dark");

  await call({ type: "load", mode: "view", locale: "uk", theme: "dark" });
  assert.equal(document.documentElement.dataset.mode, "view");
  assert.equal(document.documentElement.dataset.theme, "dark");
  click(root.querySelectorAll(".ew-cell")[0]);
  assert.deepEqual(board.get(), [[1, 1]]);

  assert.throws(() => sdk.widget({ answer: board }));
});
