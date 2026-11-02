import { readonly } from "./client";

export type Root = Element | string;

export function resolve(root: Root): HTMLElement {
  const element = typeof root === "string" ? document.querySelector(root) : root;
  if (!element) {
    throw new Error(`[eolymp] element "${root}" not found`);
  }
  return element as HTMLElement;
}

export function makeInteractive(element: Element, kind: string) {
  element.setAttribute("data-ew", kind);
  if (!(element instanceof HTMLButtonElement) && !element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "0");
  }
  if (!(element instanceof HTMLButtonElement) && !element.hasAttribute("role")) {
    element.setAttribute("role", "button");
  }
}

export function onActivate(
  root: HTMLElement,
  selector: string,
  handler: (target: Element, event: MouseEvent | KeyboardEvent) => void,
) {
  const find = (event: Event) => {
    const target = (event.target as Element | null)?.closest?.(selector);
    return target && root.contains(target) ? target : null;
  };

  root.addEventListener("click", (event) => {
    const target = find(event);
    if (target && !readonly()) {
      handler(target, event);
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = find(event);
    if (target && target === event.target && !(target instanceof HTMLButtonElement) && !readonly()) {
      event.preventDefault();
      handler(target, event);
    }
  });
}

export function ids(root: HTMLElement, selector: string, attribute: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) => element.getAttribute(attribute) ?? "");
}

export function attribute(selector: string, fallback: string): string {
  return selector.match(/^\[([\w-]+)\]$/)?.[1] ?? fallback;
}

export interface Drag {
  element: HTMLElement;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function onDrag(
  root: HTMLElement,
  selector: string,
  handlers: {
    start?(drag: Drag): void;
    move(drag: Drag): void;
    end(drag: Drag): void;
  },
) {
  root.addEventListener("dragstart", (event) => event.preventDefault());

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || readonly()) {
      return;
    }

    const element = (event.target as Element).closest?.(selector) as HTMLElement | null;
    if (!element || !root.contains(element)) {
      return;
    }

    const x0 = event.clientX;
    const y0 = event.clientY;
    let started = false;

    const state = (e: PointerEvent): Drag => ({ element, x: e.clientX, y: e.clientY, dx: e.clientX - x0, dy: e.clientY - y0 });

    const move = (e: PointerEvent) => {
      if (!started && Math.hypot(e.clientX - x0, e.clientY - y0) < 5) {
        return;
      }
      if (!started) {
        started = true;
        element.dataset.dragging = "";
        handlers.start?.(state(e));
      }
      e.preventDefault();
      handlers.move(state(e));
    };

    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);

      if (!started) {
        return;
      }

      delete element.dataset.dragging;
      handlers.end(state(e));

      const swallow = (click: Event) => {
        click.stopPropagation();
        click.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}

export function under(x: number, y: number, selector: string, root: HTMLElement): HTMLElement | null {
  for (const element of document.elementsFromPoint(x, y)) {
    if (element.hasAttribute("data-dragging")) {
      continue;
    }
    const match = element.closest(selector) as HTMLElement | null;
    if (match && root.contains(match) && !match.hasAttribute("data-dragging")) {
      return match;
    }
  }
  return null;
}
