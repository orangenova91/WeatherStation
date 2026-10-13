import { EventEmitter } from "events";
import type { ReadingView } from "@/lib/types";

type ReadingListener = (reading: ReadingView) => void;

const globalForRealtime = globalThis as typeof globalThis & {
  readingBus?: EventEmitter;
};

function bus() {
  if (!globalForRealtime.readingBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForRealtime.readingBus = emitter;
  }
  return globalForRealtime.readingBus;
}

export function publishReading(sheetId: string, reading: ReadingView) {
  bus().emit(sheetId, reading);
}

export function subscribeReadings(sheetId: string, listener: ReadingListener) {
  const emitter = bus();
  emitter.on(sheetId, listener);
  return () => {
    emitter.off(sheetId, listener);
  };
}
