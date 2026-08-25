import type { NodeRepository } from "./node-repository.js";
import { NotImplementedError } from "../../core/errors.js";

/**
 * Postgres JSONB repository — interface reserved; implement after Phase 1.
 * SQL skeleton lives in v42-runtime/sql/001_nodes_edges.sql
 */
export class PostgresNodeRepository implements NodeRepository {
  async get(): Promise<null> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async listByProject(): Promise<never> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async create(): Promise<never> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async update(): Promise<never> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async delete(): Promise<void> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async setLock(): Promise<void> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async getLock(): Promise<null> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async addEdge(): Promise<void> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async listEdges(): Promise<never> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
  async getDescendants(): Promise<never> {
    throw new NotImplementedError("PostgresNodeRepository");
  }
}
