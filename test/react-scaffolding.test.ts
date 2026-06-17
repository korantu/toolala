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

  it("returns true for a Babel script wrapper", () => {
    const result = isReactSnippet(`<script type="text/babel">
const { useState } = React;
function App() {
  return <div>Hello</div>;
}
</script>`);

    expect(result).toBe(true);
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

  it("pins browser CDN dependencies", () => {
    const source = "import React from 'react';\nconst App = () => <div>Hello</div>;";
    const document = buildReactDocument(source, "Pinned Dependencies");

    expect(document).toContain("https://cdn.tailwindcss.com/3.4.17");
    expect(document).toContain("https://unpkg.com/react@18.3.1/umd/react.development.js");
    expect(document).toContain("https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js");
    expect(document).toContain("https://unpkg.com/@babel/standalone@7.29.7/babel.min.js");
  });

  it("unwraps a single Babel script wrapper before embedding source", () => {
    const source = `<script type="text/babel">
const { useState } = React;

function HelloCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

ReactDOM.render(<HelloCounter />, document.getElementById('root'));
</script>`;
    const document = buildReactDocument(source, "Script Wrapped");

    expect(document).toContain("const { useState } = React;");
    expect(document).toContain("ReactDOM.render(<HelloCounter />, document.getElementById('root'));");
    expect(document).not.toContain('<script type="text/babel">\n<script type="text/babel">');
    expect(document).not.toContain("</script>\n  </script>");
  });

  it("normalizes react-dom/client createRoot imports", () => {
    const source = `import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <div>Hello</div>;
}

createRoot(document.getElementById("root")).render(<App />);`;
    const document = buildReactDocument(source, "Create Root");

    expect(document).not.toContain('from "react-dom/client"');
    expect(document).toContain("const createRoot = ReactDOM.createRoot;");
    expect(document).toContain('createRoot(document.getElementById("root")).render(<App />);');
    expect(document).not.toContain("ReactDOM.render(<App />");
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
    expect(document).toContain('<meta name="theme-color" content="#111827">');
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

  it("includes PWA manifest link and service worker registration", () => {
    const source = "import React from 'react';\nconst App = () => <div>PWA Test</div>;";
    const document = buildReactDocument(source, "PWA Test", "test-slug");

    // Check PWA manifest link
    expect(document).toContain('<link rel="manifest" href="/test-slug/manifest.json">');
    
    // Check service worker registration script
    expect(document).toContain("if ('serviceWorker' in navigator)");
    expect(document).toContain("navigator.serviceWorker.register('/test-slug/service-worker.js')");
  });
});
