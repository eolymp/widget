import { makeInteractive, onActivate, resolve, type Root } from "./dom";
import { createValue, type Value } from "./value";

export interface GridOptions<V> {
  rows: number;
  cols: number;
  values?: readonly V[];
  initial?: V[][];
  label?(row: number, col: number): string;
  locked?(row: number, col: number): boolean;
}

export function grid(root: Root, options: Omit<GridOptions<number>, "values">): Value<number[][]>;
export function grid<V>(root: Root, options: GridOptions<V> & { values: readonly V[] }): Value<V[][]>;
export function grid<V>(root: Root, options: GridOptions<V>): Value<V[][]> {
  const element = resolve(root);
  const { rows, cols } = options;
  const values = (options.values ?? [0, 1]) as readonly V[];

  element.classList.add("ew-grid");
  element.style.setProperty("--ew-cols", String(cols));
  element.replaceChildren();

  const cells: HTMLButtonElement[][] = [];
  for (let r = 0; r < rows; r++) {
    cells.push([]);
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ew-cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.textContent = options.label?.(r, c) ?? "";
      cell.setAttribute("aria-label", `${r + 1}, ${c + 1}`);
      if (options.locked?.(r, c)) {
        cell.dataset.locked = "";
        cell.disabled = true;
      }
      makeInteractive(cell, "cell");
      element.appendChild(cell);
      cells[r].push(cell);
    }
  }

  const index = (v: V) => {
    const at = values.findIndex((candidate) => Object.is(candidate, v) || JSON.stringify(candidate) === JSON.stringify(v));
    return at < 0 ? 0 : at;
  };

  const normalize = (given: unknown): V[][] => {
    const source = Array.isArray(given) ? given : [];
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => values[index((source[r] as V[] | undefined)?.[c] as V)]),
    );
  };

  const value = createValue<V[][]>(
    options.initial ?? [],
    (matrix) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const at = index(matrix[r][c]);
          cells[r][c].dataset.state = String(at);
          cells[r][c].dataset.value = String(matrix[r][c]);
          cells[r][c].setAttribute("aria-pressed", at > 0 ? "true" : "false");
        }
      }
    },
    normalize,
  );

  onActivate(element, ".ew-cell", (target, event) => {
    if (target.hasAttribute("data-locked")) {
      return;
    }
    const r = Number((target as HTMLElement).dataset.row);
    const c = Number((target as HTMLElement).dataset.col);
    const step = event.shiftKey ? values.length - 1 : 1;

    value.update((matrix) =>
      matrix.map((row, y) => row.map((v, x) => (y === r && x === c ? values[(index(v) + step) % values.length] : v))),
    );
  });

  return value;
}
