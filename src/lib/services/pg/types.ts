/**
 * The data half of `ConsoleService` (see `src/lib/services/types.ts`), backed
 * by the `records` table. `send`, `log` and `clearLog` are session/browser
 * concerns and stay client-side - they aren't part of this interface.
 */
export interface RecordService {
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  /** Replace this model's records; a record with no `id` gets "1", "2" … by position. */
  seedRecords(projectId: string, modelId: string, records: Record<string, unknown>[]): Promise<void>;
  /**
   * Insert a single record that must carry an `id` (as newly-created records from the mock
   * engine do). Used instead of `seedRecords` for a single create, so that write doesn't
   * replace the whole set and risk clobbering a record a concurrent request just added.
   */
  insertRecord(projectId: string, modelId: string, record: Record<string, unknown> & { id: string }): Promise<void>;
  /** Regenerate fresh sample data for every model in the project. */
  reset(projectId: string): Promise<void>;
}
