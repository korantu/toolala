/**
 * State management utilities for page data.
 * This module handles storing and retrieving JSON data for pages using the unified TOOLALA namespace.
 */

export interface StateManager {
  get(slug: string): Promise<any>;
  set(slug: string, data: any): Promise<void>;
  delete(slug: string): Promise<void>;
}

export class UnifiedStateManager implements StateManager {
  constructor(private kv: KVNamespace) {}

  async get(slug: string): Promise<any> {
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

  async set(slug: string, data: any): Promise<void> {
    await this.kv.put(`state:${slug}`, JSON.stringify(data));
  }

  async delete(slug: string): Promise<void> {
    await this.kv.delete(`state:${slug}`);
  }
}

export function createStateManager(env: { TOOLALA: KVNamespace }): StateManager {
  return new UnifiedStateManager(env.TOOLALA);
}