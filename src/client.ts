import {
  isCall,
  PROTOCOL,
  type WidgetCall,
  type WidgetEvent,
  type WidgetMode,
  type WidgetNotification,
  type WidgetReply,
  type WidgetRequest,
} from "./protocol";
import type { Value } from "./value";

export interface WidgetContext {
  mode: WidgetMode;
  locale: string;
  readonly: boolean;
}

export interface WidgetDefinition<T = unknown> {
  answer?: Value<T>;
  load?(context: WidgetContext): void | Promise<void>;
  getAnswer?(): unknown;
  reloadAnswer?(answer: unknown): void;
  getHeight?(): number;
}

export interface WidgetClient {
  widget<T>(definition: WidgetDefinition<T>): void;
  answerChanged(): void;
  submit(): void;
  mode(): WidgetMode;
  locale(): string;
  readonly(): boolean;
}

const MAX_ANSWER = 64 * 1024;

function create(): WidgetClient {
  let definition: WidgetDefinition<any> | undefined;
  let height = 0;
  let current: WidgetMode = "solve";
  let language = document.documentElement.lang || "en";
  let restoring = false;
  let backlog: WidgetCall[] = [];

  const standalone = window.parent === window;

  const post = (message: WidgetNotification | WidgetReply) => {
    if (!standalone) {
      window.parent.postMessage(message, "*");
    }
  };

  const notify = (event: WidgetEvent) => post({ protocol: PROTOCOL, event });

  const serialize = (): string => {
    const value = definition?.getAnswer ? definition.getAnswer() : definition?.answer?.get();
    const text = typeof value === "string" ? value : JSON.stringify(value ?? null);

    if (text.length > MAX_ANSWER) {
      console.warn(`[eolymp] the answer is ${text.length} bytes; the platform accepts at most ${MAX_ANSWER}`);
    }

    return text;
  };

  const restore = (answer: unknown) => {
    if (definition?.reloadAnswer) {
      definition.reloadAnswer(answer);
      return;
    }

    if (definition?.answer && answer !== null && answer !== undefined) {
      restoring = true;
      try {
        definition.answer.set(answer);
      } finally {
        restoring = false;
      }
    }
  };

  const measure = (): number => {
    if (definition?.getHeight) {
      return Math.ceil(definition.getHeight());
    }

    return Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0));
  };

  const load = async (mode: WidgetMode, locale: string) => {
    current = mode === "view" ? "view" : "solve";
    language = locale || language;
    document.documentElement.dataset.mode = current;
    await definition?.load?.({ mode: current, locale: language, readonly: current === "view" });
  };

  const perform = async (request: WidgetRequest): Promise<unknown> => {
    if (!definition) {
      throw new Error("widget is not registered");
    }

    switch (request.type) {
      case "load":
        await load(request.mode, request.locale);
        height = measure();
        return { height };
      case "reload_answer":
        restore(parse(request.answer));
        return {};
      case "get_answer":
        return { answer: serialize() };
      case "get_height":
        height = measure();
        return { height };
      default:
        throw new Error(`unknown request "${(request as { type: string }).type}"`);
    }
  };

  const handle = (call: WidgetCall) => {
    perform(call.request).then(
      (response) => post({ protocol: PROTOCOL, id: call.id, response }),
      (error: unknown) =>
        post({ protocol: PROTOCOL, id: call.id, error: error instanceof Error ? error.message : String(error) }),
    );
  };

  const watch = () => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    new ResizeObserver(() => {
      const next = measure();
      if (next > 0 && next !== height) {
        height = next;
        notify({ type: "height_changed", height: next });
      }
    }).observe(document.documentElement);
  };

  const answerChanged = () => {
    if (!restoring) {
      notify({ type: "answer_changed", answer: serialize() });
    }
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !isCall(event.data)) {
      return;
    }

    if (definition) {
      handle(event.data);
      return;
    }

    backlog.push(event.data);
  });

  return {
    widget(value) {
      if (definition) {
        throw new Error("eolymp.widget() was already called; a page registers one widget");
      }

      if (!value.answer && !value.getAnswer) {
        throw new Error("eolymp.widget() needs either `answer` or `getAnswer`");
      }

      definition = value;
      value.answer?.subscribe(answerChanged);
      watch();

      if (standalone) {
        console.info("[eolymp] not inside a host; loaded in solve mode. Run `npx @eolymp/widget dev` to test it.");
        void load("solve", language);
        return;
      }

      const waiting = backlog;
      backlog = [];
      for (const call of waiting) {
        handle(call);
      }
    },
    answerChanged,
    submit() {
      notify({ type: "submit" });
    },
    mode: () => current,
    locale: () => language,
    readonly: () => current === "view",
  };
}

function parse(answer: string): unknown {
  try {
    return JSON.parse(answer);
  } catch {
    return answer;
  }
}

const fallback: WidgetClient = {
  widget() {},
  answerChanged() {},
  submit() {},
  mode: () => "solve",
  locale: () => "en",
  readonly: () => false,
};

export const client: WidgetClient = typeof window === "undefined" ? fallback : create();

export const widget = client.widget;
export const answerChanged = client.answerChanged;
export const submit = client.submit;
export const mode = client.mode;
export const locale = client.locale;
export const readonly = client.readonly;
