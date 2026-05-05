import type { ApiLogger } from "../middlewares/request-logger";
import {
  writeOperationLog,
  type WriteOperationLogInput
} from "./write-operation-log";

export async function writeOperationLogSafely(
  input: WriteOperationLogInput,
  logger: Pick<ApiLogger, "error"> = console
) {
  try {
    await writeOperationLog(input);
  } catch (error) {
    logger.error("Failed to write operation log", error);
  }
}
