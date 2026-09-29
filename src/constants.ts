import { EventEmitter } from "node:events";

export const init = Symbol("initializers");
export const help = Symbol("help");
export const events = new EventEmitter();

const log = (type: "info" | "error", text) => {
  console.log(text);
  const date = new Date().toISOString();
  const log = String(text)
    .trim()
    .split("\n")
    .map((line) => `[${date}][${type}] ${line}`);

  events.emit("log", log);
};

export const logInfo = (text) => log("info", text);
export const logError = (text) => log("error", text);
