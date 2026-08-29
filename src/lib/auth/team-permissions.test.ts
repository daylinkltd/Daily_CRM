import { describe, expect, it } from "vitest";

import {
  checkTeamPermission,
  teamPermissionError,
  teamPermissionKey,
} from "./team-permissions";

/**
 * Minimal stand-in for the Supabase query builder: enough of the chain
 * that `checkTeamPermission` can run against fixed rows.
 */
function fakeClient(opts: {
  member: { role: string; role_id: string | null } | null;
  rolePermissions?: Record<string, unknown> | null;
}) {
  return {
    from(table: string) {
      const row =
        table === "workspace_members"
          ? opts.member
          : { permissions: opts.rolePermissions ?? null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const WS = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

describe("teamPermissionKey", () => {
  it("namespaces under the resource", () => {
    expect(teamPermissionKey("create")).toBe("team_members:create");
    expect(teamPermissionKey("delete")).toBe("team_members:delete");
  });
});

describe("checkTeamPermission", () => {
  it("always allows the owner, whatever the matrix says", async () => {
    const client = fakeClient({
      member: { role: "owner", role_id: "r1" },
      rolePermissions: { "team_members:create": false },
    });
    const v = await checkTeamPermission(client, WS, USER, "create");
    expect(v).toEqual({ allowed: true, reason: "owner", role: "owner" });
  });

  it("refuses someone who is not a member at all", async () => {
    const v = await checkTeamPermission(fakeClient({ member: null }), WS, USER, "create");
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("not-a-member");
  });

  it("honours an explicit grant on a non-admin role", async () => {
    const client = fakeClient({
      member: { role: "member", role_id: "r1" },
      rolePermissions: { "team_members:create": true },
    });
    const v = await checkTeamPermission(client, WS, USER, "create");
    expect(v).toEqual({ allowed: true, reason: "role", role: "member" });
  });

  it("honours an explicit denial on an admin — the point of the setting", async () => {
    const client = fakeClient({
      member: { role: "admin", role_id: "r1" },
      rolePermissions: { "team_members:create": false },
    });
    const v = await checkTeamPermission(client, WS, USER, "create");
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("denied");
  });

  it("falls back to the historical admin grant when the key is absent", async () => {
    const admin = await checkTeamPermission(
      fakeClient({ member: { role: "admin", role_id: "r1" }, rolePermissions: { other: true } }),
      WS,
      USER,
      "create",
    );
    expect(admin).toEqual({ allowed: true, reason: "admin-default", role: "admin" });

    const member = await checkTeamPermission(
      fakeClient({ member: { role: "member", role_id: "r1" }, rolePermissions: { other: true } }),
      WS,
      USER,
      "create",
    );
    expect(member.allowed).toBe(false);
  });

  it("treats a role-less member as denied, not as allowed", async () => {
    const v = await checkTeamPermission(
      fakeClient({ member: { role: "member", role_id: null } }),
      WS,
      USER,
      "delete",
    );
    expect(v.allowed).toBe(false);
  });

  it("checks each action independently", async () => {
    const client = fakeClient({
      member: { role: "member", role_id: "r1" },
      rolePermissions: {
        "team_members:create": true,
        "team_members:delete": false,
      },
    });
    expect((await checkTeamPermission(client, WS, USER, "create")).allowed).toBe(true);
    expect((await checkTeamPermission(client, WS, USER, "delete")).allowed).toBe(false);
  });
});

describe("teamPermissionError", () => {
  it("names the action and points at where to change it", () => {
    const msg = teamPermissionError("create");
    expect(msg).toContain("add people");
    expect(msg).toContain("Team & Access");
  });
});
