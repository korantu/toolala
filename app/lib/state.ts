/**
 * State management utilities for page data.
 * This module handles storing and retrieving JSON data for pages.
 */

export interface StateManager {
  get(slug: string): Promise<any>;
  set(slug: string, data: any): Promise<void>;
  delete(slug: string): Promise<void>;
}

export class KVStateManager implements StateManager {
  constructor(private kv: KVNamespace) {}

  async get(slug: string): Promise<any> {
    const data = await this.kv.get(slug);
    if (!data) {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(slug: string, data: any): Promise<void> {
    await this.kv.put(slug, JSON.stringify(data));
  }

  async delete(slug: string): Promise<void> {
    await this.kv.delete(slug);
  }
}

export function createStateManager(env: { PAGE_STATE: KVNamespace }): StateManager {
  return new KVStateManager(env.PAGE_STATE);
}