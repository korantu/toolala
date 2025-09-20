import { nanoid } from "nanoid";
import { useState } from "react";

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/cloudflare";
import { Form, Link, useLoaderData, useActionData } from "@remix-run/react";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const editSlug = url.searchParams.get("edit") || "";

  const list = await context.cloudflare.env.PAGE_META.list({ limit: 100 });
  const pages = list.keys.map((k) => ({
    slug: k.name,
    description: "", // default
  }));

  // load descriptions in parallel
  await Promise.all(
    pages.map(async (page) => {
      try {
        const meta = await context.cloudflare.env.PAGE_META.get(page.slug);
        if (meta) page.description = JSON.parse(meta).description || "";
      } catch {}
    })
  );

  let editData = { slug: "", html: "", description: "" };
  if (editSlug) {
    const [html, metaRaw] = await Promise.all([
      context.cloudflare.env.PAGE_CONTENT.get(editSlug),
      context.cloudflare.env.PAGE_META.get(editSlug),
    ]);
    editData.slug = editSlug;
    editData.html = html || "";
    try {
      if (metaRaw) editData.description = JSON.parse(metaRaw).description || "";
    } catch {}
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

  await Promise.all([
    context.cloudflare.env.PAGE_META.put(slug, JSON.stringify({ description })),
    context.cloudflare.env.PAGE_CONTENT.put(slug, html),
  ]);

  return json({ success: true, slug });
}

export default function Index() {
  const { pages, edit } = useLoaderData<typeof loader>();
  const action = useActionData<{ error?: string; success?: boolean; slug?: string }>();

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
            <p>Page saved successfully. <a href={`/${action.slug}`} className="font-medium underline hover:text-green-800">View page →</a></p>
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

  // Filter pages based on search term
  const filteredPages = pages.filter((page) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return page.slug.toLowerCase().includes(term) || 
           page.description.toLowerCase().includes(term);
  });

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
                <a 
                  href={`/?edit=${page.slug}`}
                  className="ml-auto flex-shrink-0 text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                </a>
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
            Save Page
          </button>
          <Link to="/" className="text-gray-600 hover:text-black font-medium">Cancel</Link>
        </div>
      </Form>
    </section>
  );
}
