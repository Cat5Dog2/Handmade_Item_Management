import { expect, vi } from "vitest";

export interface TimestampLike {
  toDate: () => Date;
}

export interface DocumentSnapshotLike<T = unknown> {
  data: () => T;
  exists: boolean;
}

export function createTimestamp(isoString: string): TimestampLike {
  return {
    toDate: () => new Date(isoString)
  };
}

export function expectTimestampLike(
  actual: TimestampLike | null | undefined,
  isoString: string
) {
  expect(actual).not.toBeNull();
  expect(actual?.toDate().toISOString()).toBe(isoString);
}

export function createDocumentSnapshot<T>(
  data: T,
  exists = true
): DocumentSnapshotLike<T> {
  return {
    data: () => data,
    exists
  };
}

export function createRunTransactionMock(transaction: unknown) {
  return vi.fn(async (callback: (transaction: unknown) => unknown) =>
    callback(transaction)
  );
}
