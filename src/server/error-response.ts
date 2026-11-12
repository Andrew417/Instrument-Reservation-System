import { Response } from "express";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export interface ClassifiedError {
  status: number;
  message: string;
  isBusinessError: boolean;
}

const PG_OR_NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ENOENT",
  "EAI_AGAIN",
  "EPIPE",
  "ERR_INVALID_URL",
]);

function isDatabaseOrSystemError(error: unknown, rawMessage: string): boolean {
  const errObj = error as any;

  if (errObj?.code === "SUBMISSION_BLOCKED") {
    return false;
  }

  if (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError
  ) {
    return true;
  }

  if (error instanceof Error && error.cause !== undefined) {
    return true;
  }

  if (
    errObj?.name === "DrizzleQueryError" ||
    errObj?.name === "DrizzleError" ||
    errObj?.name === "DatabaseError"
  ) {
    return true;
  }

  const code = typeof errObj?.code === "string" ? errObj.code : "";
  if (code && (/^[0-9A-Z]{5}$/.test(code) || PG_OR_NETWORK_CODES.has(code))) {
    return true;
  }

  if (
    rawMessage.startsWith("Failed query:") ||
    /timeout exceeded when trying to connect|Connection terminated|invalid input syntax for type|relation ".*" does not exist|column ".*" does not exist|syntax error at or near|violates .* constraint|duplicate key value violates/i.test(
      rawMessage,
    )
  ) {
    return true;
  }

  return false;
}

export function classifyError(error: unknown): ClassifiedError {
  const errObj = error as any;
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  // Handle Express JSON body-parser syntax errors cleanly
  if (
    errObj?.type === "entity.parse.failed" ||
    (error instanceof SyntaxError && errObj?.status === 400)
  ) {
    return {
      status: 400,
      message: "Invalid request payload.",
      isBusinessError: true,
    };
  }

  // Handle Postgres exclusion constraint (slot conflict) without leaking DB details
  if (
    errObj?.code === "23P01" ||
    errObj?.cause?.code === "23P01"
  ) {
    return {
      status: 409,
      message:
        "This time slot is already reserved by an approved booking. Please choose a different time or instrument.",
      isBusinessError: true,
    };
  }

  if (isDatabaseOrSystemError(error, rawMessage)) {
    return {
      status: 500,
      message: GENERIC_ERROR_MESSAGE,
      isBusinessError: false,
    };
  }

  if (!rawMessage) {
    return {
      status: 500,
      message: GENERIC_ERROR_MESSAGE,
      isBusinessError: false,
    };
  }

  if (errObj?.code === "SUBMISSION_BLOCKED") {
    return {
      status: 400,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  if (Array.isArray(errObj?.conflicts) && errObj.conflicts.length > 0) {
    return {
      status: 409,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  if (
    /not authorized|not allowed|forbidden|administrators must use|only the owner|super admin/i.test(
      rawMessage,
    )
  ) {
    return {
      status: 403,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  if (/not found/i.test(rawMessage)) {
    return {
      status: 404,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  if (
    /conflicts?|already reserved|already booked|self-overlap|overlap/i.test(
      rawMessage,
    )
  ) {
    return {
      status: 409,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  if (
    /required|must be|must have|expected yyyy-mm-dd|invalid|cannot|can have at most|not currently enabled|outside working hours|multiple calendar days|in the future|limit|exceeds|exceeded|fee acknowledgment|out of service|archived service|restricted to|linked to an active service|grace window|window|no-show|only completed|not a type request|time boundaries|already marked|past|too many|already exists|does not match|not pending|not specified|unable to determine|could not determine|no reservation ids|occurrence|already assigned|must provide/i.test(
      rawMessage,
    )
  ) {
    return {
      status: 400,
      message: rawMessage,
      isBusinessError: true,
    };
  }

  return {
    status: 500,
    message: GENERIC_ERROR_MESSAGE,
    isBusinessError: false,
  };
}

export function sendSafeErrorResponse(
  res: Response,
  context: string,
  error: unknown,
  options?: { includeConflicts?: boolean; fallbackMessage?: string },
): void {
  console.error(
    context,
    error,
    "\nCause:",
    error instanceof Error ? error.cause : undefined,
  );

  const classified = classifyError(error);
  const message =
    classified.isBusinessError || !options?.fallbackMessage
      ? classified.message
      : options.fallbackMessage;

  res.status(classified.status).json({
    success: false,
    error: message,
    ...(options?.includeConflicts &&
    classified.isBusinessError &&
    Array.isArray((error as any)?.conflicts)
      ? { conflicts: (error as any).conflicts }
      : {}),
  });
}
