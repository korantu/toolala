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

  // Reference content operations (for saving reference versions)
  getRefContent(slug: string): Promise<string | null>;
  setRefContent(slug: string, html: string): Promise<void>;
  deleteRefContent(slug: string): Promise<void>;

  // Meta operations (replaces PAGE_META)
  getMeta(slug: string): Promise<{ description?: string; title?: string } | null>;
  setMeta(slug: string, meta: { description?: string; title?: string }): Promise<void>;
  deleteMeta(slug: string): Promise<void>;

  // State operations (replaces PAGE_STATE)
  getState(slug: string): Promise<any>;
  setState(slug: string, data: any): Promise<void>;
  deleteState(slug: string): Promise<void>;

  // Access tracking operations
  getAccessTimestamp(slug: string): Promise<number | null>;
  setAccessTimestamp(slug: string, timestamp: number): Promise<void>;
  deleteAccessTimestamp(slug: string): Promise<void>;
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

  // Reference content operations with "ref:" prefix
  async getRefContent(slug: string): Promise<string | null> {
    return await this.kv.get(`ref:${slug}`);
  }

  async setRefContent(slug: string, html: string): Promise<void> {
    await this.kv.put(`ref:${slug}`, html);
  }

  async deleteRefContent(slug: string): Promise<void> {
    await this.kv.delete(`ref:${slug}`);
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
    await this.kv.put(`meta:${slug}`, JSON.stringify(meta), {
      metadata: { description: meta.description || "" },
    });
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

  // Access tracking operations with "accessedts:" prefix
  async getAccessTimestamp(slug: string): Promise<number | null> {
    const data = await this.kv.get(`accessedts:${slug}`);
    if (!data) {
      return null;
    }
    const timestamp = Number(data);
    return isNaN(timestamp) ? null : timestamp;
  }

  async setAccessTimestamp(slug: string, timestamp: number): Promise<void> {
    await this.kv.put(`accessedts:${slug}`, timestamp.toString(), {
      metadata: { timestamp },
    });
  }

  async deleteAccessTimestamp(slug: string): Promise<void> {
    await this.kv.delete(`accessedts:${slug}`);
  }

}

export function createStorageManager(env: { SPIKEME: KVNamespace }): StorageManager {
  return new UnifiedStorageManager(env.SPIKEME);
}
