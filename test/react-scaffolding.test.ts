import { describe, expect, it } from "vitest";

import { buildReactDocument, isReactSnippet } from "../app/routes/$slug";

describe("isReactSnippet", () => {
  it("returns true when the first line references React", () => {
    const result = isReactSnippet("React magic\nconst App = () => null;");
    expect(result).toBe(true);
  });

  it("returns false when React is not mentioned on the first line", () => {
    const result = isReactSnippet("<h1>Hello</h1>\nReactDOM.render(null);");
    expect(result).toBe(false);
  });
});

describe("buildReactDocument", () => {
  it("wraps source code with a standalone HTML document and escapes title", () => {
    const source = "const App = () => <div>Hello</div>;";
    const document = buildReactDocument(source, "Sample <Title>");

    expect(document.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(document).toContain(source);
    expect(document).toContain("<title>Sample &lt;Title&gt;</title>");
    expect(document).toContain("<div id=\"root\"></div>");
  });
});
