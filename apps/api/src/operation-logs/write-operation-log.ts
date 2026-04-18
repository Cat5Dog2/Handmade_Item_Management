import { randomUUID } from "node:crypto";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { Timestamp as FirestoreTimestamp } from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firebase-admin";

export const OPERATION_LOG_EVENT_TYPES = [
  "LOGIN",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
  "QR_SOLD",
  "ERROR"
] as const;

export type OperationLogEventType = (typeof OPERATION_LOG_EVENT_TYPES)[number];

export interface OperationLogDetail {
  [key: string]: unknown;
}

export interface OperationLogDocument {
  logId: string;
  eventType: OperationLogEventType;
  targetId: string | null;
  summary: string;
  actorUid: string | null;
  createdAt: Timestamp;
  detail: OperationLogDetail | null;
}

export interface WriteOperationLogInput {
  eventType: OperationLogEventType;
  targetId?: string | null;
  summary: string;
  actorUid?: string | null;
  detail?: OperationLogDetail | null;
}

interface WriteOperationLogOptions {
  db?: Firestore;
  now?: () => Timestamp;
  logIdFactory?: () => string;
}

const OPERATION_LOGS_COLLECTION = "operationLogs";

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeSummary(summary: string) {
  const normalized = summary.trim();

  if (!normalized) {
    throw new Error("Operation log summary is required.");
  }

  return normalized;
}

export async function writeOperationLog(
  input: WriteOperationLogInput,
  options: WriteOperationLogOptions = {}
): Promise<OperationLogDocument> {
  const summary = normalizeSummary(input.summary);
  const db = options.db ?? getFirestoreDb();
  const now = options.now ?? FirestoreTimestamp.now;
  const logId = options.logIdFactory?.() ?? randomUUID();
  const operationLog: OperationLogDocument = {
    logId,
    eventType: input.eventType,
    targetId: normalizeOptionalString(input.targetId),
    summary,
    actorUid: normalizeOptionalString(input.actorUid),
    createdAt: now(),
    detail: input.detail ?? null
  };

  await db
    .collection(OPERATION_LOGS_COLLECTION)
    .doc(logId)
    .set(operationLog);

  return operationLog;
}
