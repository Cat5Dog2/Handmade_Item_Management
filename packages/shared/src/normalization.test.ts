import {
  hasSingleLineForbiddenCharacters,
  normalizeName,
  normalizeMultilineText,
  normalizeOptionalSearchKeyword,
  normalizeSearchKeyword
} from "./normalization";

describe("normalization helpers", () => {
  it("trims name fields without lowercasing them", () => {
    expect(normalizeName("  Handmade Bag  ")).toBe("Handmade Bag");
  });

  it("removes control characters from normalized text", () => {
    expect(normalizeName("Hand\u0000made\u0007 Bag")).toBe("Handmade Bag");
    expect(normalizeSearchKeyword("One\u0000\t Two\u0007")).toBe("one two");
  });

  it("keeps interior tabs and line breaks for schema-level rejection", () => {
    expect(normalizeName("\tHandmade\r\nBag\t")).toBe("Handmade\nBag");
    expect(hasSingleLineForbiddenCharacters("Handmade\nBag")).toBe(true);
    expect(hasSingleLineForbiddenCharacters("Handmade\tBag")).toBe(true);
  });

  it("normalizes multiline text line endings to LF", () => {
    expect(normalizeMultilineText("line1\r\nline2\rline3")).toBe(
      "line1\nline2\nline3"
    );
  });

  it("normalizes search keywords for partial matching", () => {
    expect(normalizeSearchKeyword("  ＡＢＣ\t  Def \r\n")).toBe("abc def");
  });

  it("keeps empty search keywords empty after normalization", () => {
    expect(normalizeSearchKeyword(" \t \r\n ")).toBe("");
  });

  it("converts blank optional search keywords to undefined", () => {
    expect(normalizeOptionalSearchKeyword(" \t \r\n ")).toBeUndefined();
  });
});
