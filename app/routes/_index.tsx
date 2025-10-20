import { nanoid } from "nanoid";
import { useState, useEffect, useRef } from "react";

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/cloudflare";
import { Form, Link, useLoaderData, useActionData } from "@remix-run/react";
import { createStorageManager } from "../lib/storage";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const editSlug = url.searchParams.get("edit") || "";

  const storage = createStorageManager(context.cloudflare.env);
  const slugs = await storage.listMetaSlugs(100);
  const pages = slugs.map((slug) => ({
    slug,
    description: "", // default
  }));

  // Load descriptions in parallel
  await Promise.all(
    pages.map(async (page) => {
      try {
        const meta = await storage.getMeta(page.slug);
        if (meta) page.description = meta.description || "";
      } catch {}
    })
  );

  let editData = { slug: "", html: "", description: "" };
  if (editSlug) {
    const [html, meta] = await Promise.all([
      storage.getContent(editSlug),
      storage.getMeta(editSlug),
    ]);
    editData.slug = editSlug;
    editData.html = html || "";
    editData.description = meta?.description || "";
  }

  return json({ pages, edit: editData });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const slug = (formData.get("slug") as string || "").trim().replace(/[^a-z0-9\-_]/gi, "");
  const html = formData.get("html") as string;
  const description = (formData.get("description") as string || "").trim();

  if (!slug || !html) {
    return json({ error: "Missing slug or html" }, { status: 400 });
  }

  const storage = createStorageManager(context.cloudflare.env);
  await Promise.all([
    storage.setMeta(slug, { description }),
    storage.setContent(slug, html),
  ]);

  return json({ success: true, slug, timestamp: Date.now() });
}

export default function Index() {
  const { pages, edit } = useLoaderData<typeof loader>();
  const action = useActionData<{ error?: string; success?: boolean; slug?: string; timestamp?: number }>();

  // Auto-redirect to the saved page after successful save
  useEffect(() => {
    if (action?.success && action?.slug) {
      // Use window.location.href for full page navigation to handle raw HTML responses
      window.location.href = `/${action.slug}`;
    }
  }, [action?.success, action?.slug, action?.timestamp]);

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-8 text-center">
          Dashboard
        </h1>

        {action?.error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
            <p className="font-bold">Error</p>
            <p>{action.error}</p>
          </div>
        )}
        {action?.success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md">
            <p className="font-bold">Success!</p>
            <p>Page saved successfully. Redirecting...</p>
          </div>
        )}


        {edit.slug ? (
          <EditForm edit={edit} />
        ) : (
          <PagesList pages={pages} />
        )}
      </main>
    </div>
  );
}

function PagesList({ pages }: { pages: { slug: string; description: string }[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copyStatus, setCopyStatus] = useState<{ [slug: string]: 'copying' | 'success' | 'error' | undefined }>({});

  // Filter pages based on search term
  const filteredPages = pages.filter((page) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return page.slug.toLowerCase().includes(term) || 
           page.description.toLowerCase().includes(term);
  });

  // Copy page source code to clipboard
  const copyPageSource = async (slug: string) => {
    setCopyStatus(prev => ({ ...prev, [slug]: 'copying' }));
    
    try {
      // Fetch the page content via a simple API call
      const response = await fetch(`/${slug}/edit`);
      if (!response.ok) {
        throw new Error('Failed to fetch page content');
      }
      
      // The edit route redirects, but we can use the loader directly
      // Let's make a simpler approach - we'll use the existing loader with a special parameter
      const apiResponse = await fetch(`/api/content/${slug}`);
      if (!apiResponse.ok) {
        throw new Error('Failed to fetch page content');
      }
      
      const data = await apiResponse.json() as { content?: string };
      const content = data.content || '';
      
      // Copy to clipboard
      await navigator.clipboard.writeText(content);
      
      setCopyStatus(prev => ({ ...prev, [slug]: 'success' }));
      
      // Clear success status after 2 seconds
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [slug]: undefined }));
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy page source:', error);
      setCopyStatus(prev => ({ ...prev, [slug]: 'error' }));
      
      // Clear error status after 3 seconds
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [slug]: undefined }));
      }, 3000);
    }
  };

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Pages</h2>
        <Link 
          to="/?edit=new"
          className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create New Page
        </Link>
      </div>
      
      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search pages by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <ul className="divide-y divide-gray-100">
          {filteredPages.length > 0 ? (
            filteredPages.map((page) => (
              <li key={page.slug} className="px-4 py-2 hover:bg-gray-50 transition-colors flex items-center">
                <a 
                  href={`/${page.slug}`} 
                  className="text-blue-600 hover:underline font-medium truncate"
                  title={page.slug}
                >
                  /{page.slug}
                </a>
                {page.description && (
                  <span className="text-gray-500 ml-2 truncate">
                    {page.description}
                  </span>
                )}
                <div className="ml-auto flex-shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => copyPageSource(page.slug)}
                    disabled={copyStatus[page.slug] === 'copying'}
                    className={`p-1 rounded transition-colors ${
                      copyStatus[page.slug] === 'success' 
                        ? 'text-green-600' 
                        : copyStatus[page.slug] === 'error'
                        ? 'text-red-600'
                        : copyStatus[page.slug] === 'copying'
                        ? 'text-gray-300'
                        : 'text-gray-400 hover:text-green-600'
                    }`}
                    title={
                      copyStatus[page.slug] === 'success' 
                        ? 'Copied to clipboard!' 
                        : copyStatus[page.slug] === 'error'
                        ? 'Failed to copy'
                        : copyStatus[page.slug] === 'copying'
                        ? 'Copying...'
                        : 'Copy source code'
                    }
                  >
                    {copyStatus[page.slug] === 'copying' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                      </svg>
                    ) : copyStatus[page.slug] === 'success' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    )}
                  </button>
                  <a 
                    href={`/?edit=${page.slug}`}
                    className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-gray-500">
              No pages found matching "{searchTerm}"
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

function EditForm({ edit }: { edit: { slug: string; html: string; description: string } }) {
  const isNew = edit.slug === 'new';
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'pasting' | 'success' | 'error'>('idle');
  const [copyInstructionsStatus, setCopyInstructionsStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const instructionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const instructions = `You are generating a single-file React JSX component in plain JavaScript (no TypeScript). Output only one fenced code block labeled \`jsx\`. Do not include explanations or text outside the code block.

## Output Contract
- The very first line must be:
  import React, { useState, useEffect } from "react";
- The very last line must be:
  export default {{ComponentName}};
- Use Tailwind CSS classes for styling.
- Use JavaScript only: no \`type\`, \`interface\`, \`enum\`, generics, or \`.tsx\`.
- All logic must be self-contained in one file. No external state, CSS, or libraries.
- Must export a default component named \`{{ComponentName}}\`.

## Functional Requirements
- Fetch JSON from \`/api/json{{OptionalSubpath}}\` using GET on mount.
- Handle loading, error, and empty states gracefully.
- Support POST to \`/api/json{{OptionalSubpath}}\` to create or update data.
- Refresh data after successful POST.
- Show errors from the server if present.
- Keep UX minimal, accessible, and responsive.

## UI/UX
- Use Tailwind only for styling.
- Provide basic UI: loading spinner or text, error message, empty placeholder.
- Add interactive controls necessary for {{Goal}}.
- Use semantic HTML and accessible labels.

## Performance & Behavior
- Use \`fetch\` (no Axios) and async/await.
- Debounce user input where relevant (~300ms).
- Avoid unnecessary re-renders.

## Hard Constraints
- One fenced \`jsx\` block only — no extra text.
- No TypeScript syntax of any kind.
- No external dependencies beyond React.
- No separate files or assets.
- Do not include \`"use client"\` or framework-specific directives.

## Self-check before output
- [ ] First line is import React…
- [ ] Last line is \`export default {{ComponentName}};\`
- [ ] Single fenced \`jsx\` block.
- [ ] No TypeScript anywhere.
- [ ] Uses Tailwind.
- [ ] JSON GET/POST logic included.`;
      
      await navigator.clipboard.writeText(instructions);
      
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
      <h2 className="text-2xl font-semibold mb-6">
        {isNew ? "Create New Page" : `Edit "${edit.slug}"`}
      </h2>
      <Form method="post" className="space-y-6 bg-white p-6 md:p-8 rounded-lg shadow-md">
        <div>
          <label htmlFor="slug" className="block text-sm font-bold text-gray-700 mb-1">Slug</label>
          <input 
            type="text" 
            name="slug" 
            id="slug"
            defaultValue={isNew ? '' : edit.slug} 
            placeholder="my-awesome-page"
            required 
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <p className="mt-2 text-xs text-gray-500">URL-friendly identifier (a-z, 0-9, -, _).</p>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-bold text-gray-700 mb-1">Description</label>
          <input 
            type="text" 
            name="description" 
            id="description"
            defaultValue={edit.description} 
            placeholder="A short summary of the page content."
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
        </div>
        <div>
          <label htmlFor="html" className="block text-sm font-bold text-gray-700 mb-1">HTML or React Content</label>
          <textarea 
            ref={textareaRef}
            name="html" 
            id="html"
            defaultValue={edit.html} 
            placeholder={"<h1>Hello World</h1>\n// or start with a React snippet"}
            rows={15} 
            required 
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono text-sm"
          />
          <p className="mt-2 text-xs text-gray-500">
            Paste raw HTML or kick off with a React component (first line referencing React) and we&apos;ll scaffold the render call automatically.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            type="submit" 
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save & Run ▶
          </button>
          <button 
            type="button"
            onClick={handlePaste}
            disabled={pasteStatus === 'pasting'}
            className={`flex items-center gap-2 font-bold py-3 px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              pasteStatus === 'success' 
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' 
                : pasteStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : pasteStatus === 'pasting'
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
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
                Pasting...
              </>
            ) : pasteStatus === 'success' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Pasted!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
                Paste
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={handleCopyInstructions}
            disabled={copyInstructionsStatus === 'copying'}
            className={`flex items-center gap-2 font-bold py-3 px-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              copyInstructionsStatus === 'success' 
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' 
                : copyInstructionsStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : copyInstructionsStatus === 'copying'
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
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
                Copying...
              </>
            ) : copyInstructionsStatus === 'success' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Copy LLM Instructions
              </>
            )}
          </button>
          <Link to="/" className="text-gray-600 hover:text-black font-medium">Cancel</Link>
        </div>
      </Form>
    </section>
  );
}
