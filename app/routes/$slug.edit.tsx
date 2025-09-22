import { redirect, type LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug!;

  // Check if the page exists before redirecting to edit
  const html = await context.cloudflare.env.PAGE_CONTENT.get(slug);
  
  if (!html) {
    // If page doesn't exist, redirect to home with the slug to create new page
    return redirect(`/?edit=${slug}`);
  }

  // Page exists, redirect to edit mode
  return redirect(`/?edit=${slug}`);
}