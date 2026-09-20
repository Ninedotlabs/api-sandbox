// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { pgProjectService } from "./project-service";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("project ownership", () => {
  const userIds: string[] = [];
  const projectIds: string[] = [];

  afterEach(async () => {
    if (projectIds.length) await query("delete from projects where id = any($1::text[])", [projectIds.splice(0)]);
    if (userIds.length) await query("delete from users where id = any($1::text[])", [userIds.splice(0)]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function user(label: string): Promise<string> {
    const id = createId("usr");
    userIds.push(id);
    await query("insert into users (id, name, email) values ($1, $2, $3)", [id, label, `${id}@example.com`]);
    return id;
  }

  it("lists and loads only projects belonging to the requested account", async () => {
    const alice = await user("Alice");
    const bob = await user("Bob");
    const aliceProject = await pgProjectService.create({ name: `Alice ${createId("api")}`, description: "", templateId: null }, alice);
    const bobProject = await pgProjectService.create({ name: `Bob ${createId("api")}`, description: "", templateId: null }, bob);
    projectIds.push(aliceProject.id, bobProject.id);

    expect((await pgProjectService.list(alice)).map((project) => project.id)).toContain(aliceProject.id);
    expect((await pgProjectService.list(alice)).map((project) => project.id)).not.toContain(bobProject.id);
    expect(await pgProjectService.get(bobProject.id, alice)).toBeNull();
    expect(await pgProjectService.get(bobProject.id, bob)).toEqual(bobProject);
  });
});
