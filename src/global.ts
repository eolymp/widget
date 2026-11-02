import * as sdk from "./index";

declare global {
  interface Window {
    eolymp: typeof sdk;
  }
}

window.eolymp = sdk;
