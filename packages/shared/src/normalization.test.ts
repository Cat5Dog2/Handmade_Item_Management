import {
  normalizeName,
  normalizeMultilineText,
  normalizeSearchKeyword
} from "./normalization";

describe("normalization helpers", () => {
  it("trims name fields without lowercasing them", () => {
    expect(normalizeName("  Handmade Bag  ")).toBe("Handmade Bag");
  });

  it("removes tabs and line breaks from single-line names", () => {
    expect(normalizeName("\tHandmade\r\nBag\t")).toBe("Handmade Bag");
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
});
