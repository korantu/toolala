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
  it("treats the first non-empty line as canonical", () => {
    const withLeadingWhitespace = "\n\n    import React from 'react';";
    expect(isReactSnippet(withLeadingWhitespace)).toBe(true);
  });
});

describe("buildReactDocument", () => {
  it("wraps source code with a standalone HTML document and escapes title", () => {
    const source = "import React, { useState } from 'react';\nconst App = () => <div>{useState()[0]}</div>;";
    const document = buildReactDocument(source, "Sample <Title>");

    expect(document.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(document).toContain("const useState = React.useState;");
    expect(document).toContain("const App = () => <div>{useState()[0]}</div>;");
    expect(document).toContain("<title>Sample &lt;Title&gt;</title>");
    expect(document).toContain("<div id=\"root\"></div>");
  });

  it("includes mobile-specific meta tags for proper mobile operation", () => {
    const source = "import React from 'react';\nconst App = () => <div>Hello</div>;";
    const document = buildReactDocument(source, "Mobile Test");

    // Check mobile meta tags
    expect(document).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(document).toContain('<meta name="format-detection" content="telephone=no">');
    expect(document).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(document).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(document).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="default">');
    expect(document).toContain('<meta name="theme-color" content="#ffffff">');
  });

  it("removes export scaffolding and appends a ReactDOM.render call", () => {
    const source = `export default function GrammarExercise() {\n  return <div>Hello World</div>;\n}\n\nexport { GrammarExercise };`;
    const document = buildReactDocument(source, "React Page");

    expect(document).not.toContain("export default");
    expect(document).toContain("// Render the component");
    expect(document).toContain(
      "ReactDOM.render(<GrammarExercise />, document.getElementById('root'));",
    );
  });
});
