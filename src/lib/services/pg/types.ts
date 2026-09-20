/**
 * The data half of `ConsoleService` (see `src/lib/services/types.ts`), backed
 * by the `records` table. `send`, `log` and `clearLog` are session/browser
 * concerns and stay client-side - they aren't part of this interface.
 */
export interface RecordService {
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  /** Replace this model's records; a record with no `id` gets "1", "2" … by position. */
  seedRecords(projectId: string, modelId: string, records: Record<string, unknown>[]): Promise<void>;
  /** Regenerate fresh sample data for every model in the project. */
  reset(projectId: string): Promise<void>;
}
