import { describe, expect, it, vi } from "vitest";
import { createAudioStartup } from "../audioStartup";

describe("audio startup", () => {
  it("invokes context resume synchronously from start", () => {
    const resume = vi.fn(() => Promise.resolve());
    const startup = createAudioStartup(resume, async () => ({ id: 1 }));

    const pending = startup.start();

    expect(resume).toHaveBeenCalledOnce();
    return pending;
  });

  it("shares engine creation and resumes the same context on later starts", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const create = vi.fn(async () => ({ id: 1 }));
    const startup = createAudioStartup(resume, create);

    const [first, second] = await Promise.all([startup.start(), startup.start()]);
    const third = await startup.start();

    expect(first).toBe(second);
    expect(third).toBe(first);
    expect(create).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledTimes(3);
  });

  it("allows a new user gesture to retry after resume failure", async () => {
    const resume = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce();
    const create = vi.fn(async () => ({ id: 1 }));
    const startup = createAudioStartup(resume, create);

    await expect(startup.start()).rejects.toThrow("blocked");
    await expect(startup.start()).resolves.toEqual({ id: 1 });
    expect(create).toHaveBeenCalledOnce();
  });

  it("discards construction that finishes after cleanup", async () => {
    let finishCreation!: (engine: { id: number }) => void;
    const discard = vi.fn();
    const startup = createAudioStartup(
      () => Promise.resolve(),
      () => new Promise((resolve) => (finishCreation = resolve)),
      discard
    );

    const pending = startup.start();
    await Promise.resolve();
    startup.clear();
    finishCreation({ id: 1 });

    await expect(pending).rejects.toThrow("cancelled");
    expect(startup.get()).toBeNull();
    expect(discard).toHaveBeenCalledWith({ id: 1 });
  });
});
