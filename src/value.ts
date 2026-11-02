export interface Value<T> {
  get(): T;
  set(value: T): void;
  update(change: (value: T) => T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function createValue<T>(initial: T, render?: (value: T) => void, normalize?: (value: unknown) => T): Value<T> {
  let current = normalize ? normalize(initial) : initial;
  const listeners = new Set<(value: T) => void>();

  const set = (next: T) => {
    current = normalize ? normalize(next) : next;
    render?.(current);
    for (const listener of [...listeners]) {
      listener(current);
    }
  };

  render?.(current);

  return {
    get: () => current,
    set,
    update: (change) => set(change(current)),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function state<T>(initial: T): Value<T> {
  return createValue(initial);
}

type Values<T> = { [K in keyof T]: Value<T[K]> };

export function combine<T extends Record<string, unknown>>(parts: Values<T>): Value<T> {
  const keys = Object.keys(parts) as (keyof T)[];

  const get = () => {
    const out = {} as T;
    for (const key of keys) {
      out[key] = parts[key].get();
    }
    return out;
  };

  const set = (value: T) => {
    if (!value || typeof value !== "object") {
      return;
    }
    for (const key of keys) {
      if (key in value) {
        parts[key].set(value[key]);
      }
    }
  };

  return {
    get,
    set,
    update: (change) => set(change(get())),
    subscribe(listener) {
      const stops = keys.map((key) => parts[key].subscribe(() => listener(get())));
      return () => stops.forEach((stop) => stop());
    },
  };
}
