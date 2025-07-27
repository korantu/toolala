import { redirect } from "@remix-run/react";
import { nanoid } from "nanoid";

import {
  json,
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

  return json({ success: `Saved. Access it at /${slug}` });
}

export default function Index() {
  const { pages, edit } = useLoaderData<typeof loader>();
  const action = useActionData<typeof action>();

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>SlashEdit Dashboard</h1>

      {!edit.slug ? (
        <>
          <h2>Pages</h2>
          <ul>
            {pages.map((page) => (
              <li key={page.slug}>
                <Link to={`/${page.slug}`}>{page.slug}</Link>{" "}
                <small style={{ color: "#666" }}>{page.description}</small>{" "}
                <Link to={`/?edit=${page.slug}`}>✏️ Edit</Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h2>{edit.slug ? `Edit \"${edit.slug}\"` : "Create New Page"}</h2>
          <Form method="post">
            <label>
              Slug: <input name="slug" defaultValue={edit.slug} readOnly={!!edit.slug} />
            </label>
            <br />
            <label>
              Description: <input name="description" defaultValue={edit.description} />
            </label>
            <br />
            <label>
              HTML:<br />
              <textarea name="html" rows={10} cols={50} defaultValue={edit.html} />
            </label>
            <br />
            <button type="submit">Publish</button>
          </Form>
          {action?.error && <p style={{ color: "red" }}>{action.error}</p>}
          {action?.success && <p style={{ color: "green" }}>{action.success}</p>}
          <p><Link to="/">← Back to list</Link></p>
        </>
      )}
    </div>
  );
}
