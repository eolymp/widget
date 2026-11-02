import { attribute, makeInteractive, onActivate, onDrag, resolve, type Root, under } from "./dom";
import { createValue, type Value } from "./value";

export interface SlotsOptions {
  items?: string;
  slots?: string;
  capacity?: number;
  initial?: Record<string, string[]>;
}

export type Placement = Record<string, string[]>;

export function slots(root: Root, options: SlotsOptions = {}): Value<Placement> {
  const element = resolve(root);
  const itemSelector = options.items ?? "[data-item]";
  const slotSelector = options.slots ?? "[data-slot]";
  const itemName = attribute(itemSelector, "data-item");
  const slotName = attribute(slotSelector, "data-slot");
  const capacity = options.capacity ?? 1;

  const items = new Map<string, HTMLElement>();
  const homes = new Map<string, Comment>();
  for (const item of element.querySelectorAll<HTMLElement>(itemSelector)) {
    const id = item.getAttribute(itemName) ?? "";
    const marker = document.createComment(id);
    item.before(marker);
    items.set(id, item);
    homes.set(id, marker);
    makeInteractive(item, "item");
  }

  const slotIds = [...element.querySelectorAll(slotSelector)].map((slot) => {
    makeInteractive(slot, "slot");
    return slot.getAttribute(slotName) ?? "";
  });

  const slotElement = (id: string) =>
    [...element.querySelectorAll(slotSelector)].find((slot) => slot.getAttribute(slotName) === id) as HTMLElement;

  const normalize = (given: unknown): Placement => {
    const source = (given && typeof given === "object" ? given : {}) as Record<string, unknown>;
    const used = new Set<string>();
    const out: Placement = {};
    for (const slot of slotIds) {
      const list = Array.isArray(source[slot]) ? (source[slot] as unknown[]) : [];
      out[slot] = list
        .filter((id): id is string => typeof id === "string" && items.has(id) && !used.has(id))
        .slice(0, capacity);
      out[slot].forEach((id) => used.add(id));
    }
    return out;
  };

  const render = (placement: Placement) => {
    const placed = new Set<string>();
    for (const slot of slotIds) {
      const target = slotElement(slot);
      for (const id of placement[slot]) {
        target.appendChild(items.get(id)!);
        placed.add(id);
      }
      target.toggleAttribute("data-filled", placement[slot].length > 0);
    }
    for (const [id, item] of items) {
      if (!placed.has(id)) {
        homes.get(id)!.after(item);
      }
      item.toggleAttribute("data-placed", placed.has(id));
    }
  };

  const value = createValue<Placement>(options.initial ?? {}, render, normalize);

  const slotOf = (id: string) => slotIds.find((slot) => value.get()[slot].includes(id));

  const place = (id: string, target: string | null) => {
    const from = slotOf(id);
    if (from === target) {
      return;
    }

    const next: Placement = Object.fromEntries(
      Object.entries(value.get()).map(([slot, list]) => [slot, list.filter((other) => other !== id)]),
    );

    if (target !== null) {
      if (next[target].length >= capacity) {
        if (capacity !== 1) {
          return;
        }
        const [occupant] = next[target];
        next[target] = [];
        if (from !== undefined) {
          next[from].push(occupant);
        }
      }
      next[target].push(id);
    }

    value.set(next);
  };

  let selected: HTMLElement | null = null;
  const select = (item: HTMLElement | null) => {
    selected?.removeAttribute("data-selected");
    selected = item;
    selected?.setAttribute("data-selected", "");
  };

  onActivate(element, `${itemSelector}, ${slotSelector}`, (target) => {
    const slot = target.closest(slotSelector);
    const item = target.closest(itemSelector) as HTMLElement | null;

    if (selected && slot && item !== selected) {
      place(selected.getAttribute(itemName) ?? "", slot.getAttribute(slotName));
      select(null);
      return;
    }

    if (item) {
      select(item === selected ? null : item);
    }
  });

  element.addEventListener("click", (event) => {
    if (selected && !(event.target as Element).closest(`${itemSelector}, ${slotSelector}`)) {
      place(selected.getAttribute(itemName) ?? "", null);
      select(null);
    }
  });

  let over: HTMLElement | null = null;
  const hover = (slot: HTMLElement | null) => {
    over?.removeAttribute("data-over");
    over = slot;
    over?.setAttribute("data-over", "");
  };

  onDrag(element, itemSelector, {
    start: () => select(null),
    move: (drag) => {
      drag.element.style.transform = `translate(${drag.dx}px, ${drag.dy}px)`;
      hover(under(drag.x, drag.y, slotSelector, element));
    },
    end: (drag) => {
      drag.element.style.transform = "";
      const slot = under(drag.x, drag.y, slotSelector, element);
      hover(null);
      place(drag.element.getAttribute(itemName) ?? "", slot ? slot.getAttribute(slotName) : null);
    },
  });

  return value;
}
