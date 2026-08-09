/**
 * Coordinates Web Audio activation with singleton engine construction.
 * `resume` is invoked synchronously by `start`, before any promise continuation,
 * so callers can preserve the browser's trusted user activation.
 */
export function createAudioStartup<Engine>(
  resume: () => Promise<void>,
  create: () => Promise<Engine>,
  discard: (engine: Engine) => void = () => undefined
) {
  let engine: Engine | null = null;
  let creating: Promise<Engine> | null = null;
  let generation = 0;

  return {
    start(): Promise<Engine> {
      const resumed = resume();
      if (engine) return resumed.then(() => engine as Engine);
      if (creating) {
        const activeCreation = creating;
        return resumed.then(() => activeCreation);
      }

      const startGeneration = generation;
      const creation = resumed
        .then(create)
        .then((created) => {
          if (generation !== startGeneration) {
            discard(created);
            throw new Error("Audio startup was cancelled");
          }
          engine = created;
          creating = null;
          return created;
        })
        .catch((error: unknown) => {
          if (creating === creation) creating = null;
          throw error;
        });
      creating = creation;
      return creating;
    },

    get(): Engine | null {
      return engine;
    },

    clear(): Engine | null {
      generation += 1;
      const current = engine;
      engine = null;
      creating = null;
      return current;
    }
  };
}
