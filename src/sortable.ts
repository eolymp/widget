import { attribute, makeInteractive, onDrag, resolve, type Root } from "./dom";
import { readonly } from "./client";
import { createValue, type Value } from "./value";

export interface SortableOptions {
  items?: string;
  initial?: string[];
}

export function sortable(root: Root, options: SortableOptions = {}): Value<string[]> {
  const element = resolve(root);
  const selector = options.items ?? "[data-id]";
  const name = attribute(selector, "data-id");

  const items = new Map<string, HTMLElement>();
  for (const item of element.querySelectorAll<HTMLElement>(selector)) {
    items.set(item.getAttribute(name) ?? "", item);
    makeInteractive(item, "sort");
  }

  const original = [...items.keys()];
  const anchor = document.createComment("sortable");
  items.get(original[0])?.before(anchor);

  const normalize = (given: unknown): string[] => {
    const list = Array.isArray(given) ? given.filter((id): id is string => typeof id === "string" && items.has(id)) : [];
    const unique = [...new Set(list)];
    return [...unique, ...original.filter((id) => !unique.includes(id))];
  };

  const render = (order: string[]) => {
    let previous: Node = anchor;
    for (const id of order) {
      const item = items.get(id)!;
      if (previous.nextSibling !== item) {
        previous.parentNode?.insertBefore(item, previous.nextSibling);
      }
      previous = item;
    }
  };

  const value = createValue<string[]>(options.initial ?? original, render, normalize);

  const read = () =>
    [...element.querySelectorAll(selector)].map((item) => item.getAttribute(name) ?? "").filter((id) => items.has(id));

  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const glide = (element: HTMLElement, dx: number, dy: number) => {
    if (calm || typeof element.animate !== "function" || (!dx && !dy)) {
      return;
    }
    element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
      duration: 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
  };

  const list = () => [...items.values()];
  let dragged: HTMLElement | null = null;
  let offset = { x: 0, y: 0 };
  let grab = { x: 0, y: 0 };
  let layout = new Map<HTMLElement, DOMRect>();

  const measure = () => {
    layout = new Map(
      list().map((item) => {
        const rect = item.getBoundingClientRect();
        return [item, item === dragged ? new DOMRect(rect.x - offset.x, rect.y - offset.y, rect.width, rect.height) : rect];
      }),
    );
  };

  const flip = (change: () => void) => {
    const others = list().filter((item) => item !== dragged);
    const before = new Map(others.map((item) => [item, item.getBoundingClientRect()]));
    for (const item of others) {
      item.getAnimations?.().forEach((animation) => animation.cancel());
    }
    change();
    measure();
    for (const item of others) {
      const from = before.get(item)!;
      const to = layout.get(item)!;
      glide(item, from.left - to.left, from.top - to.top);
    }
  };

  const follow = (x: number, y: number) => {
    const base = layout.get(dragged!)!;
    offset = { x: x - grab.x - base.left, y: y - grab.y - base.top };
    dragged!.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
  };

  const sameRow = (a: DOMRect, b: DOMRect) => Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;

  onDrag(element, selector, {
    start: (drag) => {
      dragged = drag.element;
      const rect = dragged.getBoundingClientRect();
      grab = { x: drag.x - drag.dx - rect.left, y: drag.y - drag.dy - rect.top };
      offset = { x: 0, y: 0 };
      measure();
    },
    move: (drag) => {
      const own = layout.get(drag.element)!;
      for (const [target, rect] of layout) {
        if (target === drag.element || drag.x < rect.left || drag.x > rect.right || drag.y < rect.top || drag.y > rect.bottom) {
          continue;
        }
        const after = sameRow(rect, own) ? drag.x > rect.left + rect.width / 2 : drag.y > rect.top + rect.height / 2;
        const spot = after ? target.nextSibling : target;
        if (spot !== drag.element && spot !== drag.element.nextSibling) {
          flip(() => target.parentNode?.insertBefore(drag.element, spot));
        }
        break;
      }
      follow(drag.x, drag.y);
    },
    end: (drag) => {
      const { x, y } = offset;
      drag.element.style.transform = "";
      dragged = null;
      offset = { x: 0, y: 0 };
      glide(drag.element, x, y);
      value.set(read());
    },
  });

  element.addEventListener("keydown", (event) => {
    const item = (event.target as Element).closest?.(selector) as HTMLElement | null;
    if (!item || readonly()) {
      return;
    }
    const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!delta) {
      return;
    }
    event.preventDefault();
    const order = value.get();
    const at = order.indexOf(item.getAttribute(name) ?? "");
    const to = at + delta;
    if (at < 0 || to < 0 || to >= order.length) {
      return;
    }
    const next = [...order];
    [next[at], next[to]] = [next[to], next[at]];
    flip(() => value.set(next));
    item.focus();
  });

  return value;
}
