import { describe, expect, it } from "vitest";
import { planInsert } from "./positions";

describe("planInsert", () => {
  it("appends at the end when beforeId is null", () => {
    const existing = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ];
    expect(planInsert(existing, null)).toEqual({ position: 2, shifts: [] });
  });

  it("appends at position 0 when the list is empty", () => {
    expect(planInsert([], null)).toEqual({ position: 0, shifts: [] });
  });

  it("inserts before a given id, shifting it and everything after it", () => {
    const existing = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ];
    expect(planInsert(existing, "b")).toEqual({
      position: 1,
      shifts: [
        { id: "b", position: 2 },
        { id: "c", position: 3 },
      ],
    });
  });

  it("falls back to appending when beforeId no longer exists", () => {
    const existing = [{ id: "a", position: 5 }];
    expect(planInsert(existing, "missing")).toEqual({ position: 6, shifts: [] });
  });

  it("works with gapped, non-contiguous positions", () => {
    const existing = [
      { id: "a", position: 0 },
      { id: "c", position: 7 },
    ];
    expect(planInsert(existing, "c")).toEqual({ position: 7, shifts: [{ id: "c", position: 8 }] });
  });
});
