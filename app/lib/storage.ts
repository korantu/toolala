/**
 * Storage utilities for the unified SPIKEME KV namespace.
 * This module provides a clean interface for storing different types of data
 * using key prefixes to replace the separate PAGE_CONTENT, PAGE_META, and PAGE_STATE namespaces.
 */

export interface StorageManager {
  // Content operations (replaces PAGE_CONTENT)
  getContent(slug: string): Promise<string | null>;
  setContent(slug: string, html: string): Promise<void>;
  deleteContent(slug: string): Promise<void>;

  // Meta operations (replaces PAGE_META)
  getMeta(slug: string): Promise<{ description?: string; title?: string } | null>;
  setMeta(slug: string, meta: { description?: string; title?: string }): Promise<void>;
  deleteMeta(slug: string): Promise<void>;

  // State operations (replaces PAGE_STATE)
  getState(slug: string): Promise<any>;
  setState(slug: string, data: any): Promise<void>;
  deleteState(slug: string): Promise<void>;

  // List operations
  listContentSlugs(limit?: number): Promise<string[]>;
  listMetaSlugs(limit?: number): Promise<string[]>;
  listStateSlugs(limit?: number): Promise<string[]>;
}

export class UnifiedStorageManager implements StorageManager {
  constructor(private kv: KVNamespace) {}

  // Content operations with "content:" prefix
  async getContent(slug: string): Promise<string | null> {
    return await this.kv.get(`content:${slug}`);
  }

  async setContent(slug: string, html: string): Promise<void> {
    await this.kv.put(`content:${slug}`, html);
  }

  async deleteContent(slug: string): Promise<void> {
    await this.kv.delete(`content:${slug}`);
  }

  // Meta operations with "meta:" prefix
  async getMeta(slug: string): Promise<{ description?: string; title?: string } | null> {
    const data = await this.kv.get(`meta:${slug}`);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async setMeta(slug: string, meta: { description?: string; title?: string }): Promise<void> {
    await this.kv.put(`meta:${slug}`, JSON.stringify(meta));
  }

  async deleteMeta(slug: string): Promise<void> {
    await this.kv.delete(`meta:${slug}`);
  }

  // State operations with "state:" prefix
  async getState(slug: string): Promise<any> {
    const data = await this.kv.get(`state:${slug}`);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async setState(slug: string, data: any): Promise<void> {
    await this.kv.put(`state:${slug}`, JSON.stringify(data));
  }

  async deleteState(slug: string): Promise<void> {
    await this.kv.delete(`state:${slug}`);
  }

  // List operations
  async listContentSlugs(limit = 100): Promise<string[]> {
    const list = await this.kv.list({ prefix: "content:", limit });
    return list.keys.map(k => k.name.replace(/^content:/, ""));
  }

  async listMetaSlugs(limit = 100): Promise<string[]> {
    const list = await this.kv.list({ prefix: "meta:", limit });
    return list.keys.map(k => k.name.replace(/^meta:/, ""));
  }

  async listStateSlugs(limit = 100): Promise<string[]> {
    const list = await this.kv.list({ prefix: "state:", limit });
    return list.keys.map(k => k.name.replace(/^state:/, ""));
  }
}

export function createStorageManager(env: { SPIKEME: KVNamespace }): StorageManager {
  return new UnifiedStorageManager(env.SPIKEME);
}