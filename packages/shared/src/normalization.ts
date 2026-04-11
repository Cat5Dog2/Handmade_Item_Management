const CONTROL_CHARACTER_RANGES = [
  "\\u0000-\\u0008",
  "\\u000B",
  "\\u000C",
  "\\u000E-\\u001F",
  "\\u007F"
].join("");

const CONTROL_CHARACTERS = new RegExp(`[${CONTROL_CHARACTER_RANGES}]`, "g");
const LINE_ENDINGS = /\r\n?/g;
const MULTIPLE_SPACES = /\s+/g;

function toSafeText(value: string) {
  return value.replace(CONTROL_CHARACTERS, "");
}

export function normalizeLineEndings(value: string) {
  return value.replace(LINE_ENDINGS, "\n");
}

export function normalizeSingleLineText(value: string) {
  return toSafeText(normalizeLineEndings(value))
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

export const normalizeName = normalizeSingleLineText;

export function normalizeOptionalSingleLineText(value?: string | null) {
  if (value == null) {
    return value;
  }

  return normalizeSingleLineText(value);
}

export function normalizeMultilineText(value: string) {
  return toSafeText(normalizeLineEndings(value));
}

export function normalizeOptionalMultilineText(value?: string | null) {
  if (value == null) {
    return value;
  }

  return normalizeMultilineText(value);
}

export function normalizeSearchKeyword(value: string) {
  return normalizeLineEndings(value)
    .normalize("NFKC")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(CONTROL_CHARACTERS, "")
    .trim()
    .replace(MULTIPLE_SPACES, " ")
    .toLowerCase();
}

export function normalizeOptionalSearchKeyword(value?: string | null) {
  if (value == null) {
    return undefined;
  }

  const normalized = normalizeSearchKeyword(value);

  return normalized === "" ? undefined : normalized;
}
