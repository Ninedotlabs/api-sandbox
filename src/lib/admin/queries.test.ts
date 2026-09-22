// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { recordActivity } from "@/lib/activity/record";
import { getPool, query } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { pgModelService } from "@/lib/services/pg/model-service";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { pgRouteService } from "@/lib/services/pg/route-service";
import { getUserDetail, listActivity, listAllProjects, listUsers } from "./queries";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("admin queries (Postgres)", () => {
  const userIds: string[] = [];
  const projectIds: string[] = [];

  afterEach(async () => {
    if (userIds.length) await query("delete from activity_events where actor_user_id = any($1::text[])", [userIds]);
    if (projectIds.length) await query("delete from projects where id = any($1::text[])", [projectIds.splice(0)]);
    if (userIds.length) await query("delete from users where id = any($1::text[])", [userIds.splice(0)]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function user(): Promise<{ id: string; email: string }> {
    const id = createId("usr");
    const email = `${id}@example.com`;
    userIds.push(id);
    await query("insert into users (id, name, email) values ($1, $2, $3)", [id, id, email]);
    return { id, email };
  }

  it("lists every account's projects with their owner and counts", async () => {
    const alice = await user();
    const bob = await user();
    const a = await pgProjectService.create({ name: `A ${createId("api")}`, description: "", templateId: null }, alice.id);
    const b = await pgProjectService.create({ name: `B ${createId("api")}`, description: "", templateId: null }, bob.id);
    projectIds.push(a.id, b.id);
    const model = await pgModelService.create(a.id, "Item");
    await pgRouteService.createMany(a.id, [
      { id: createId("rte"), method: "GET", path: "/items", modelId: model.id, action: "list", description: "", filters: [] },
    ]);
    await pgRecordService.insertRecord(a.id, model.id, { id: "1", name: "one" });

    const all = await listAllProjects();
    const rowA = all.find((p) => p.id === a.id);
    const rowB = all.find((p) => p.id === b.id);
    expect(rowA).toMatchObject({ ownerId: alice.id, ownerEmail: alice.email });
    expect(rowA).toMatchObject({ routeCount: 1, recordCount: 1 });
    expect(rowB).toMatchObject({ ownerId: bob.id, routeCount: 0, recordCount: 0 });
  });

  it("records activity with an email snapshot and filters the log", async () => {
    const alice = await user();
    const bob = await user();
    await recordActivity({ actorUserId: alice.id, action: "project.create", channel: "ui", metadata: { name: "X" } });
    await recordActivity({ actorUserId: alice.id, action: "route.delete", channel: "mcp" });
    await recordActivity({ actorUserId: bob.id, action: "project.create", channel: "api" });

    const aliceLog = await listActivity({ userId: alice.id });
    expect(aliceLog.total).toBe(2);
    expect(aliceLog.events[0]).toMatchObject({ action: "route.delete", channel: "mcp", actorEmail: alice.email });

    const mcpOnly = await listActivity({ userId: alice.id, channel: "mcp" });
    expect(mcpOnly.events.map((e) => e.action)).toEqual(["route.delete"]);

    const creates = await listActivity({ action: "project.create" });
    expect(creates.events.map((e) => e.actorUserId)).toEqual(expect.arrayContaining([alice.id, bob.id]));
  });

  it("keeps an event readable after its author's account is deleted", async () => {
    const gone = await user();
    await recordActivity({ actorUserId: gone.id, action: "auth.sign_in", channel: "auth" });
    const [event] = (await listActivity({ userId: gone.id })).events;
    await query("delete from users where id = $1", [gone.id]);

    const { rows } = await query<{ actor_user_id: string | null; actor_email: string }>(
      "select actor_user_id, actor_email from activity_events where id = $1",
      [event.id],
    );
    expect(rows[0]).toEqual({ actor_user_id: null, actor_email: gone.email });
    await query("delete from activity_events where id = $1", [event.id]);
  });

  it("summarises a user with projects, tokens, live sessions and last activity", async () => {
    const alice = await user();
    const project = await pgProjectService.create({ name: `Mine ${createId("api")}`, description: "", templateId: null }, alice.id);
    projectIds.push(project.id);
    await query("insert into api_tokens (id, user_id, name, token_hash) values ($1, $2, 'laptop', $3)", [
      createId("tok"),
      alice.id,
      createId("hash"),
    ]);
    await query("insert into sessions (session_token, user_id, expires) values ($1, $2, now() + interval '1 day'), ($3, $2, now() - interval '1 day')", [
      createId("ses"),
      alice.id,
      createId("ses"),
    ]);
    await recordActivity({ actorUserId: alice.id, action: "project.create", channel: "ui", projectId: project.id });

    const detail = await getUserDetail(alice.id);
    expect(detail?.projects.map((p) => p.id)).toEqual([project.id]);
    expect(detail?.tokens.map((t) => t.name)).toEqual(["laptop"]);
    expect(detail?.sessions).toHaveLength(1);
    expect(detail?.activity[0]).toMatchObject({ action: "project.create", projectName: project.name });
    expect(detail?.user).toMatchObject({ projectCount: 1, tokenCount: 1, role: "user" });
    expect(detail?.user.lastActiveAt).not.toBeNull();

    const listed = (await listUsers()).find((u) => u.id === alice.id);
    expect(listed).toMatchObject({ projectCount: 1, tokenCount: 1 });
  });

  it("returns null for an account that doesn't exist", async () => {
    expect(await getUserDetail("usr_missing")).toBeNull();
  });
});
