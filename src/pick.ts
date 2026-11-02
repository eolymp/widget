import { attribute, ids, makeInteractive, onActivate, resolve, type Root } from "./dom";
import { createValue, type Value } from "./value";

export interface PickOptions {
  items?: string;
}

export interface PickOneOptions extends PickOptions {
  initial?: string | null;
}

export interface PickManyOptions extends PickOptions {
  initial?: string[];
  max?: number;
}

export interface PickPathOptions extends PickOptions {
  initial?: string[];
  start?: string;
  repeat?: boolean;
  max?: number;
  canFollow?(from: string | undefined, to: string, path: string[]): boolean;
}

function setup(root: Root, items = "[data-id]") {
  const element = resolve(root);
  const name = attribute(items, "data-id");

  for (const item of element.querySelectorAll(items)) {
    makeInteractive(item, "pick");
  }

  const known = () => new Set(ids(element, items, name));

  const paint = (order: string[]) => {
    for (const item of element.querySelectorAll(items)) {
      const id = item.getAttribute(name) ?? "";
      const at = order.lastIndexOf(id);
      item.toggleAttribute("data-picked", at >= 0);
      item.setAttribute("aria-pressed", at >= 0 ? "true" : "false");
      if (at >= 0 && order.length > 1) {
        item.setAttribute("data-order", String(at + 1));
      } else {
        item.removeAttribute("data-order");
      }
    }
  };

  return { element, name, known, paint, items };
}

export function pickOne(root: Root, options: PickOneOptions = {}): Value<string | null> {
  const { element, name, known, paint, items } = setup(root, options.items);

  const value = createValue<string | null>(
    options.initial ?? null,
    (id) => paint(id === null ? [] : [id]),
    (id) => (typeof id === "string" && known().has(id) ? id : null),
  );

  onActivate(element, items, (target) => value.set(target.getAttribute(name)));

  return value;
}

export function pickMany(root: Root, options: PickManyOptions = {}): Value<string[]> {
  const { element, name, known, paint, items } = setup(root, options.items);
  const max = options.max ?? Infinity;

  const value = createValue<string[]>(options.initial ?? [], paint, (given) => {
    const valid = known();
    const list = Array.isArray(given) ? given.filter((id): id is string => typeof id === "string" && valid.has(id)) : [];
    return [...new Set(list)].slice(0, max);
  });

  onActivate(element, items, (target) => {
    const id = target.getAttribute(name) ?? "";
    const current = value.get();

    if (current.includes(id)) {
      value.set(current.filter((other) => other !== id));
    } else if (current.length < max) {
      value.set([...current, id]);
    }
  });

  return value;
}

export function pickPath(root: Root, options: PickPathOptions = {}): Value<string[]> {
  const { element, name, known, paint, items } = setup(root, options.items);
  const max = options.max ?? Infinity;
  const start = options.start;

  const value = createValue<string[]>(options.initial ?? (start ? [start] : []), paint, (given) => {
    const valid = known();
    const list = Array.isArray(given) ? given.filter((id): id is string => typeof id === "string" && valid.has(id)) : [];
    if (start && list[0] !== start) {
      list.unshift(start);
    }
    return list.slice(0, max);
  });

  onActivate(element, items, (target) => {
    const id = target.getAttribute(name) ?? "";
    const path = value.get();
    const last = path[path.length - 1];
    const floor = start ? 1 : 0;

    if (id === last && path.length > floor) {
      value.set(path.slice(0, -1));
      return;
    }

    if (path.includes(id) && !options.repeat) {
      value.set(path.slice(0, Math.max(floor, path.indexOf(id) + 1)));
      return;
    }

    if (path.length < max && (options.canFollow?.(last, id, path) ?? true)) {
      value.set([...path, id]);
    }
  });

  return value;
}
