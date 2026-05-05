import { z } from "zod";
import {
  hasSingleLineForbiddenCharacters,
  normalizeSearchKeyword,
  normalizeSingleLineText
} from "./normalization";

export function normalizeStringInput(
  value: unknown,
  normalizer: (value: string) => string
) {
  if (typeof value !== "string") {
    return value;
  }

  return normalizer(value);
}

export function emptyStringToUndefined(value: unknown) {
  if (value === "") {
    return undefined;
  }

  return value;
}

export function emptyBlankSingleLineStringToUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  if (value.trim() === "" && !hasSingleLineForbiddenCharacters(value)) {
    return undefined;
  }

  return value;
}

export function emptyBlankSingleLineStringToNull(value: unknown) {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  if (value.trim() === "" && !hasSingleLineForbiddenCharacters(value)) {
    return null;
  }

  return value;
}

export function emptyBlankSearchKeywordToUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  if (
    normalizeSearchKeyword(value) === "" &&
    !hasSingleLineForbiddenCharacters(value)
  ) {
    return undefined;
  }

  return value;
}

export const normalizedSingleLineStringSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (hasSingleLineForbiddenCharacters(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Line breaks and tabs are not allowed."
      });
    }
  })
  .transform(normalizeSingleLineText);

export const normalizedSearchKeywordSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (hasSingleLineForbiddenCharacters(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Search keyword must not include line breaks or tabs."
      });
    }
  })
  .transform(normalizeSearchKeyword);
