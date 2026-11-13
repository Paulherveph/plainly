/**
 * A one-producer, one-consumer channel that only keeps the latest value.
 * The producer never waits for the consumer, so work continues if the reader goes away.
 */
export function latestChannel<T>() {
  let latest: { value: T } | null = null;
  let closed = false;
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };
  return {
    push(value: T) {
      latest = { value };
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
      while (true) {
        if (latest) {
          const { value } = latest;
          latest = null;
          yield value;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}
