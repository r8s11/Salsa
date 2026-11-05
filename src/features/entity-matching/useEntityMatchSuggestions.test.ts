import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityKind, EntityMatch } from "./entityReview";
import { SUGGESTION_DELAY_MS, useEntityMatchSuggestions } from "./useEntityMatchSuggestions";

const client = vi.hoisted(() => ({ searchEntityMatches: vi.fn() }));
vi.mock("./entityReviewClient", () => client);

const HALL: EntityMatch = { id: "22222222-2222-4222-8222-222222222222", name: "Rhythm Hall" };

const render = (text: string, enabled = true) =>
  renderHook(
    ({ value, on }: { value: string; on: boolean }) =>
      useEntityMatchSuggestions("venue" as EntityKind, value, { enabled: on }),
    { initialProps: { value: text, on: enabled } }
  );

const settle = () => act(async () => vi.advanceTimersByTimeAsync(SUGGESTION_DELAY_MS));

describe("useEntityMatchSuggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    client.searchEntityMatches.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("asks once per pause in typing, not once per keystroke", async () => {
    client.searchEntityMatches.mockResolvedValue([HALL]);
    const hook = render("Rh");
    hook.rerender({ value: "Rhy", on: true });
    hook.rerender({ value: "Rhyth", on: true });
    expect(hook.result.current.status).toBe("loading");
    await settle();

    expect(client.searchEntityMatches).toHaveBeenCalledTimes(1);
    expect(client.searchEntityMatches).toHaveBeenCalledWith("venue", "Rhyth");
    expect(hook.result.current).toMatchObject({ status: "done", matches: [HALL] });
  });

  it("never shows an older query's answer against newer text", async () => {
    const slow = Promise.withResolvers<EntityMatch[]>();
    client.searchEntityMatches.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([]);
    const hook = render("Rhythm");
    await settle();
    hook.rerender({ value: "Salsa", on: true });
    await act(async () => slow.resolve([HALL]));

    expect(hook.result.current.matches).toEqual([]);
    await settle();
    expect(hook.result.current).toMatchObject({ status: "done", matches: [], query: "Salsa" });
  });

  it("reuses an earlier answer when the same text comes back", async () => {
    client.searchEntityMatches.mockResolvedValue([HALL]);
    const hook = render("Rhythm");
    await settle();
    hook.rerender({ value: "Rhythm H", on: true });
    await settle();
    hook.rerender({ value: "Rhythm", on: true });
    await settle();

    expect(client.searchEntityMatches).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toMatchObject({ status: "done", matches: [HALL] });
  });

  it("stays idle when disabled or the text is too short", async () => {
    const hook = render("R");
    await settle();
    expect(hook.result.current.status).toBe("idle");
    hook.rerender({ value: "Rhythm", on: false });
    await settle();
    expect(hook.result.current.status).toBe("idle");
    expect(client.searchEntityMatches).not.toHaveBeenCalled();
  });

  it("reports a failed lookup and can try again", async () => {
    client.searchEntityMatches.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([HALL]);
    const hook = render("Rhythm");
    await settle();
    expect(hook.result.current.status).toBe("error");

    act(() => hook.result.current.retry());
    expect(hook.result.current.status).toBe("loading");
    await settle();
    expect(hook.result.current).toMatchObject({ status: "done", matches: [HALL] });
  });
});
