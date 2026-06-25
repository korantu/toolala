import { useState, useEffect, useRef } from "react";

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/cloudflare";
import { Form, Link, useLoaderData, useActionData, useNavigate } from "@remix-run/react";
import { createStorageManager } from "../lib/storage";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const editSlug = url.searchParams.get("edit") || "";

  const storage = createStorageManager(context.cloudflare.env);

  let editData = { slug: "", html: "", description: "", hasReference: false };
  if (editSlug) {
    const [html, meta, refHtml] = await Promise.all([
      storage.getContent(editSlug),
      storage.getMeta(editSlug),
      storage.getRefContent(editSlug),
    ]);
    editData.slug = editSlug;
    editData.html = html || "";
    editData.description = meta?.description || "";
    editData.hasReference = !!refHtml;
  }

  return json({ edit: editData });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string || "save";
  const slug = (formData.get("slug") as string || "").trim().replace(/[^a-z0-9\-_]/gi, "");
  const html = formData.get("html") as string;
  const description = (formData.get("description") as string || "").trim();

  if (!slug || !html) {
    return json({ error: "Missing slug or html" }, { status: 400 });
  }

  const storage = createStorageManager(context.cloudflare.env);

  if (actionType === "saveReference") {
    // Save current content as reference
    await storage.setRefContent(slug, html);
    return json({ success: true, slug, message: "Reference version saved!", timestamp: Date.now() });
  } else if (actionType === "restoreReference") {
    // Restore content from reference
    const refHtml = await storage.getRefContent(slug);
    if (!refHtml) {
      return json({ error: "No reference version found" }, { status: 404 });
    }
    return json({ 
      success: true, 
      slug, 
      message: "Restored from reference!", 
      restoredContent: refHtml,
      timestamp: Date.now() 
    });
  } else {
    // Default save action
    await Promise.all([
      storage.setMeta(slug, { description }),
      storage.setContent(slug, html),
    ]);
    return json({ success: true, slug, timestamp: Date.now() });
  }
}

export default function Index() {
  const { edit } = useLoaderData<typeof loader>();
  const action = useActionData<{ 
    error?: string; 
    success?: boolean; 
    slug?: string; 
    message?: string;
    restoredContent?: string;
    timestamp?: number;
  }>();

  // Auto-redirect to the saved page after successful save (but not for reference operations)
  useEffect(() => {
    if (action?.success && action?.slug && !action?.message) {
      // Use window.location.href for full page navigation to handle raw HTML responses
      window.open(`/${action.slug}`, '_blank');
    }
  }, [action?.success, action?.slug, action?.timestamp, action?.message]);

  return (
    <div className="bg-gray-900 min-h-screen font-sans text-gray-100">
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-8 text-center">
          Dashboard
        </h1>

        {action?.error && (
          <div className="bg-red-900 border-l-4 border-red-500 text-red-200 p-4 mb-6 rounded-md">
            <p className="font-bold">Error</p>
            <p>{action.error}</p>
          </div>
        )}
        {action?.success && (
          <div className="bg-green-900 border-l-4 border-green-500 text-green-200 p-4 mb-6 rounded-md">
            <p className="font-bold">Success!</p>
            <p>{action.message || "Page saved successfully. Redirecting..."}</p>
          </div>
        )}


        {edit.slug ? (
          <EditForm edit={edit} action={action} />
        ) : (
          <DirectSlugForm />
        )}
      </main>
    </div>
  );
}

function DirectSlugForm() {
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const slug = name.replace(/[^a-z0-9\-_]/gi, "").toLowerCase();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (slug) {
      navigate(`/dash?edit=${slug}`);
    }
  };

  return (
    <section className="max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold text-white mb-6">Open a Page</h2>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-800 p-6 md:p-8 rounded-lg shadow-md border border-gray-700">
        <div>
          <label htmlFor="slug-entry" className="block text-sm font-bold text-gray-200 mb-1">Slug</label>
          <input
            id="slug-entry"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="my-page"
            autoFocus
            className="w-full p-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
          />
          {name && slug !== name && (
            <p className="mt-2 text-xs text-gray-400">
              Will be opened as: <span className="text-gray-200 font-mono">{slug}</span>
            </p>
          )}
          {name && !slug && (
            <p className="mt-2 text-xs text-red-400">Use at least one letter, number, dash, or underscore.</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Enter a known slug to create or edit that page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!slug}
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Open Editor
          </button>
          <Link to="/new" className="text-gray-300 hover:text-white font-medium">
            Create by name
          </Link>
        </div>
      </form>
    </section>
  );
}

// LLM instructions template for generating React JSX components
const LLM_INSTRUCTIONS_TEMPLATE = `Single-file React JSX component, plain JavaScript (no TypeScript). Output one fenced \`jsx\` block only — no text outside it.

## Rules
- First line: \`import React, { useState, useEffect } from "react";\`
- Last line: \`export default {{ComponentName}};\`
- Tailwind for styling. No TypeScript. No external packages. No separate files.
- No bundler: only React + Tailwind (CDN). Use inline SVG for icons, never lucide-react or similar.

## Data API
- GET/POST \`/api/json{{OptionalSubpath}}\` — JSON storage (no auth required).
- On mount: fetch GET, show loading/error/empty states. After POST: refresh.

## State
- localStorage = source of truth (load on mount, sync silently on change, no UI feedback).
- Explicit **Save** / **Load** buttons for API. Show "Saving…" / "Saved ✓" / "Loading…" / error for API ops only.
- Stateful apps (checklists, todos): also auto-save to API on each meaningful change so other users see it via Load.

## Self-check
- [ ] One \`jsx\` block, correct first/last lines, no TypeScript.
- [ ] GET/POST /api/json wired, loading/error/empty handled.
- [ ] localStorage sync silent; API ops show status indicators.
- [ ] No external npm packages; inline SVG for icons.`;

function EditForm({ 
  edit, 
  action 
}: { 
  edit: { slug: string; html: string; description: string; hasReference: boolean };
  action?: { 
    error?: string; 
    success?: boolean; 
    slug?: string; 
    message?: string;
    restoredContent?: string;
    timestamp?: number;
  };
}) {
  const isNew = edit.slug === 'new';
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'pasting' | 'success' | 'error'>('idle');
  const [copyInstructionsStatus, setCopyInstructionsStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const instructionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore content when restored from reference
  useEffect(() => {
    if (action?.restoredContent && textareaRef.current) {
      textareaRef.current.value = action.restoredContent;
      // Trigger input event so the form data updates
      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [action?.restoredContent, action?.timestamp]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (instructionsTimeoutRef.current) {
        clearTimeout(instructionsTimeoutRef.current);
      }
    };
  }, []);

  const handlePaste = async () => {
    setPasteStatus('pasting');
    
    try {
      const text = await navigator.clipboard.readText();
      if (textareaRef.current) {
        textareaRef.current.value = text;
        // Trigger input event so the form data updates
        textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      setPasteStatus('success');
      
      // Clear success status after 2 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setPasteStatus('idle');
      }, 2000);
      
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      setPasteStatus('error');
      
      // Clear error status after 3 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setPasteStatus('idle');
      }, 3000);
    }
  };

  const handleCopyInstructions = async () => {
    setCopyInstructionsStatus('copying');

    try {
      let existing = '';
      try {
        existing = await navigator.clipboard.readText();
      } catch {
        // Ignore read errors — proceed with empty prefix
      }

      const combined = existing
        ? `${existing}\n----\n${LLM_INSTRUCTIONS_TEMPLATE}`
        : LLM_INSTRUCTIONS_TEMPLATE;

      await navigator.clipboard.writeText(combined);

      setCopyInstructionsStatus('success');

      // Clear success status after 2 seconds
      if (instructionsTimeoutRef.current) {
        clearTimeout(instructionsTimeoutRef.current);
      }
      instructionsTimeoutRef.current = setTimeout(() => {
        setCopyInstructionsStatus('idle');
      }, 2000);

    } catch (error) {
      console.error('Failed to copy instructions:', error);
      setCopyInstructionsStatus('error');

      // Clear error status after 3 seconds
      if (instructionsTimeoutRef.current) {
        clearTimeout(instructionsTimeoutRef.current);
      }
      instructionsTimeoutRef.current = setTimeout(() => {
        setCopyInstructionsStatus('idle');
      }, 3000);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-6 text-white">
        {isNew ? "Create New Page" : `Edit "${edit.slug}"`}
      </h2>
      <Form method="post" className="space-y-6 bg-gray-800 p-6 md:p-8 rounded-lg shadow-md border border-gray-700">
        <div>
          <label htmlFor="slug" className="block text-sm font-bold text-gray-200 mb-1">Slug</label>
          <input 
            type="text" 
            name="slug" 
            id="slug"
            defaultValue={isNew ? '' : edit.slug} 
            placeholder="my-awesome-page"
            required 
            className="w-full p-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
          />
          <p className="mt-2 text-xs text-gray-400">URL-friendly identifier (a-z, 0-9, -, _).</p>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-bold text-gray-200 mb-1">Description</label>
          <input 
            type="text" 
            name="description" 
            id="description"
            defaultValue={edit.description} 
            placeholder="A short summary of the page content."
            className="w-full p-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="html" className="block text-sm font-bold text-gray-200">HTML or React Content</label>
            {edit.hasReference && !isNew && (
              <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-md border border-green-700">
                ✓ Reference version saved
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            name="html" 
            id="html"
            defaultValue={edit.html} 
            placeholder={"<h1>Hello World</h1>\n// or start with a React snippet"}
            rows={15} 
            required 
            className="w-full p-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono text-sm placeholder-gray-400"
          />
          <p className="mt-2 text-xs text-gray-400">
            Paste raw HTML, raw React JSX, or one text/babel script wrapper and we&apos;ll scaffold the page automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            type="submit" 
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800"
          >
            Save & Run ▶
          </button>
          {!isNew && (
            <>
              <button 
                type="submit"
                name="actionType"
                value="saveReference"
                className="bg-green-600 text-white font-bold py-3 px-6 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-800"
                title="Save the current version as a reference point"
              >
                💾 Save as Reference
              </button>
              {edit.hasReference && (
                <button 
                  type="submit"
                  name="actionType"
                  value="restoreReference"
                  className="bg-yellow-600 text-white font-bold py-3 px-6 rounded-md hover:bg-yellow-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-gray-800"
                  title="Restore content from the saved reference version"
                >
                  ⏮ Restore from Reference
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handlePaste}
            disabled={pasteStatus === 'pasting'}
            className={`flex items-center gap-2 font-bold py-3 px-4 sm:px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              pasteStatus === 'success' 
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 focus:ring-offset-gray-800' 
                : pasteStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus:ring-offset-gray-800'
                : pasteStatus === 'pasting'
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500 focus:ring-offset-gray-800'
            }`}
            title={
              pasteStatus === 'success' 
                ? 'Pasted from clipboard!' 
                : pasteStatus === 'error'
                ? 'Failed to paste - check clipboard permissions'
                : pasteStatus === 'pasting'
                ? 'Pasting...'
                : 'Replace content with clipboard'
            }
          >
            {pasteStatus === 'pasting' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                <span className="hidden sm:inline">Pasting...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : pasteStatus === 'success' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Pasted!</span>
                <span className="sm:hidden">✓</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
                <span className="hidden sm:inline">Paste</span>
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={handleCopyInstructions}
            disabled={copyInstructionsStatus === 'copying'}
            className={`flex items-center gap-2 font-bold py-3 px-4 sm:px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              copyInstructionsStatus === 'success' 
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 focus:ring-offset-gray-800' 
                : copyInstructionsStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus:ring-offset-gray-800'
                : copyInstructionsStatus === 'copying'
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 focus:ring-offset-gray-800'
            }`}
            title={
              copyInstructionsStatus === 'success' 
                ? 'Instructions copied to clipboard!' 
                : copyInstructionsStatus === 'error'
                ? 'Failed to copy - check clipboard permissions'
                : copyInstructionsStatus === 'copying'
                ? 'Copying...'
                : 'Copy LLM instructions for generating React components'
            }
          >
            {copyInstructionsStatus === 'copying' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                <span className="hidden sm:inline">Copying...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : copyInstructionsStatus === 'success' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Copied!</span>
                <span className="sm:hidden">✓</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <span className="hidden sm:inline">Copy LLM Instructions</span>
                <span className="sm:hidden">LLM</span>
              </>
            )}
          </button>
          <Link to="/dash" className="text-gray-300 hover:text-white font-medium">Cancel</Link>
        </div>
      </Form>
    </section>
  );
}
