export const PROTOCOL = "eolymp.widget.v1";

export type WidgetMode = "solve" | "view";

export type WidgetTheme = "light" | "dark";

export type WidgetRequest =
  | { type: "load"; mode: WidgetMode; locale: string; theme?: WidgetTheme }
  | { type: "set_theme"; theme: WidgetTheme }
  | { type: "reload_answer"; answer: string }
  | { type: "get_answer" }
  | { type: "get_height" };

export interface WidgetResponse {
  load: { height?: number };
  set_theme: Record<string, never>;
  reload_answer: Record<string, never>;
  get_answer: { answer: string };
  get_height: { height: number };
}

export type WidgetEvent =
  | { type: "answer_changed"; answer: string }
  | { type: "height_changed"; height: number }
  | { type: "submit" };

export interface WidgetCall {
  protocol: typeof PROTOCOL;
  id: number;
  request: WidgetRequest;
}

export interface WidgetReply {
  protocol: typeof PROTOCOL;
  id: number;
  response?: unknown;
  error?: string;
}

export interface WidgetNotification {
  protocol: typeof PROTOCOL;
  event: WidgetEvent;
}

export function isCall(value: unknown): value is WidgetCall {
  const message = value as WidgetCall;
  return (
    !!message &&
    typeof message === "object" &&
    message.protocol === PROTOCOL &&
    typeof message.id === "number" &&
    !!message.request &&
    typeof message.request.type === "string"
  );
}

export function isReply(value: unknown): value is WidgetReply {
  const message = value as WidgetReply;
  return !!message && typeof message === "object" && message.protocol === PROTOCOL && typeof message.id === "number";
}

export function isNotification(value: unknown): value is WidgetNotification {
  const message = value as WidgetNotification;
  return (
    !!message &&
    typeof message === "object" &&
    message.protocol === PROTOCOL &&
    !!message.event &&
    typeof message.event.type === "string"
  );
}
