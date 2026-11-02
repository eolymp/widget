import { attribute, makeInteractive, onDrag, resolve, type Root, under } from "./dom";
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
      previous.parentNode?.insertBefore(item, previous.nextSibling);
      previous = item;
    }
  };

  const value = createValue<string[]>(options.initial ?? original, render, normalize);

  const read = () =>
    [...element.querySelectorAll(selector)].map((item) => item.getAttribute(name) ?? "").filter((id) => items.has(id));

  const horizontal = (a: HTMLElement, b: HTMLElement) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return Math.abs(ra.top - rb.top) < Math.min(ra.height, rb.height) / 2;
  };

  onDrag(element, selector, {
    move: (drag) => {
      const target = under(drag.x, drag.y, selector, element);
      if (!target || target === drag.element) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const after = horizontal(target, drag.element)
        ? drag.x > rect.left + rect.width / 2
        : drag.y > rect.top + rect.height / 2;
      target.parentNode?.insertBefore(drag.element, after ? target.nextSibling : target);
    },
    end: () => value.set(read()),
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
    value.set(next);
    item.focus();
  });

  return value;
}
