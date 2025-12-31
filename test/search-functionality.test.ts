import { describe, expect, it } from "vitest";

// Test the search logic that filters pages
// This replicates the logic from app/routes/_index.tsx PagesList component

type Page = {
  slug: string;
  description: string;
  accessTimestamp: number | null;
};

function filterPages(pages: Page[], searchTerm: string): Page[] {
  return pages.filter((page) => {
    if (!searchTerm) return true;
    
    // Split search term by spaces and apply AND logic
    const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    const slugLower = page.slug.toLowerCase();
    const descLower = page.description.toLowerCase();
    
    // All terms must match in either slug or description
    return terms.every(term => 
      slugLower.includes(term) || descLower.includes(term)
    );
  });
}

describe("Search Functionality", () => {
  const samplePages: Page[] = [
    { slug: "welcome-page", description: "Welcome to our site", accessTimestamp: null },
    { slug: "about-us", description: "Learn about our company", accessTimestamp: null },
    { slug: "contact", description: "Get in touch with us", accessTimestamp: null },
    { slug: "blog-post-1", description: "First blog post about technology", accessTimestamp: null },
    { slug: "blog-post-2", description: "Second blog post about design", accessTimestamp: null },
    { slug: "products", description: "Our amazing products catalog", accessTimestamp: null },
  ];

  it("should return all pages when search term is empty", () => {
    const result = filterPages(samplePages, "");
    expect(result).toHaveLength(6);
  });

  it("should filter pages by slug (case insensitive)", () => {
    const result = filterPages(samplePages, "blog");
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("blog-post-1");
    expect(result[1].slug).toBe("blog-post-2");
  });

  it("should filter pages by slug with different case", () => {
    const result = filterPages(samplePages, "BLOG");
    expect(result).toHaveLength(2);
  });

  it("should filter pages by description (case insensitive)", () => {
    const result = filterPages(samplePages, "company");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("about-us");
  });

  it("should filter pages by description with different case", () => {
    const result = filterPages(samplePages, "COMPANY");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("about-us");
  });

  it("should match pages where term appears in either slug or description", () => {
    const result = filterPages(samplePages, "post");
    expect(result).toHaveLength(2); // blog-post-1 and blog-post-2
  });

  it("should apply AND logic for multiple space-separated terms", () => {
    // "blog post" should match pages that have both "blog" AND "post"
    const result = filterPages(samplePages, "blog post");
    expect(result).toHaveLength(2);
    expect(result.every(p => p.slug.includes("blog-post"))).toBe(true);
  });

  it("should apply AND logic across slug and description", () => {
    // "blog technology" should match blog-post-1 (has "blog" in slug and "technology" in description)
    const result = filterPages(samplePages, "blog technology");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("blog-post-1");
  });

  it("should return empty array when no pages match all terms", () => {
    const result = filterPages(samplePages, "blog company");
    expect(result).toHaveLength(0);
  });

  it("should handle multiple spaces between terms", () => {
    const result = filterPages(samplePages, "blog   post");
    expect(result).toHaveLength(2);
  });

  it("should handle leading and trailing spaces", () => {
    const result = filterPages(samplePages, "  blog post  ");
    expect(result).toHaveLength(2);
  });

  it("should handle single character searches", () => {
    const result = filterPages(samplePages, "u");
    // Should match: about-us (slug), contact (touch), products
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return empty array for terms that don't match anything", () => {
    const result = filterPages(samplePages, "xyz123");
    expect(result).toHaveLength(0);
  });

  it("should match partial words in slug", () => {
    const result = filterPages(samplePages, "welco");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("welcome-page");
  });

  it("should match partial words in description", () => {
    const result = filterPages(samplePages, "amaz");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("products");
  });

  it("should handle three or more search terms with AND logic", () => {
    const result = filterPages(samplePages, "blog post technology");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("blog-post-1");
  });

  it("should be case insensitive for all terms in multi-term search", () => {
    const result = filterPages(samplePages, "BLOG TECHNOLOGY");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("blog-post-1");
  });
});
