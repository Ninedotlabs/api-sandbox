import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db/client";
import { friendlyDbError } from "@/lib/db/errors";
import { seedDataset } from "@/lib/mock-engine";
import { pgProjectService } from "./project-service";
import type { RecordService } from "./types";

interface RecordRow {
  id: string;
  data: Record<string, unknown>;
}

function recordFromRow(row: RecordRow): Record<string, unknown> {
  return { ...row.data, id: row.id };
}

export const pgRecordService: RecordService = {
  async sampleData(projectId, modelId) {
    try {
      const { rows } = await query<RecordRow>(
        "select id, data from records where model_id = $1 order by created_at, id",
        [modelId],
      );
      return rows.map(recordFromRow);
    } catch (error) {
      throw friendlyDbError(error, "Could not load records.");
    }
  },

  async insertRecord(projectId, modelId, record) {
    try {
      const { id, ...rest } = record;
      await query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
        modelId,
        String(id),
        JSON.stringify(rest),
      ]);
    } catch (error) {
      throw friendlyDbError(error, "Could not save this record.");
    }
  },

  async seedRecords(projectId, modelId, records) {
    try {
      await withTransaction(async (client: PoolClient) => {
        await client.query("delete from records where model_id = $1", [modelId]);
        for (let i = 0; i < records.length; i++) {
          const { id, ...rest } = records[i];
          const recordId = id === undefined || id === null ? String(i + 1) : String(id);
          await client.query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
            modelId,
            recordId,
            JSON.stringify(rest),
          ]);
        }
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not save these records.");
    }
  },

  async reset(projectId) {
    try {
      const project = await pgProjectService.get(projectId);
      if (!project) throw new Error("This API no longer exists.");
      const dataset = seedDataset(project);
      await withTransaction(async (client) => {
        for (const model of project.models) {
          await client.query("delete from records where model_id = $1", [model.id]);
          const records = dataset[model.id] ?? [];
          for (const record of records) {
            const { id, ...rest } = record;
            await client.query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
              model.id,
              id,
              JSON.stringify(rest),
            ]);
          }
        }
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not reset the sample data.");
    }
  },
};
