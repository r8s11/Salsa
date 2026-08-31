import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("sql/host-phase-2/001_create_organizer_event.sql", "utf8");
const functionStart = sql.indexOf("create or replace function public.organizer_create_event");
const functionEnd = sql.indexOf("$$;", functionStart);
const functionBody = sql.slice(functionStart, functionEnd);

describe("organizer_create_event SQL contract", () => {
  it("requires an authenticated active account before organizer checks", () => {
    const authGuard = functionBody.indexOf("if auth.uid() is null then");
    const activeAccountGuard = functionBody.indexOf("if not public.account_is_active(auth.uid()) then");
    const organizerRequiredCheck = functionBody.indexOf("if p_organizer_id is null then");
    const activeOrganizerCheck = functionBody.indexOf("where id = p_organizer_id");

    expect(authGuard).toBeGreaterThan(-1);
    expect(activeAccountGuard).toBeGreaterThan(authGuard);
    expect(organizerRequiredCheck).toBeGreaterThan(activeAccountGuard);
    expect(activeOrganizerCheck).toBeGreaterThan(organizerRequiredCheck);
  });

  it("keeps the admin override while requiring an active organizer", () => {
    expect(functionBody).toMatch(/where id = p_organizer_id[\s\S]*and status = 'active'/);
    expect(functionBody).toMatch(/if not public\.is_admin\(\) and coalesce\(public\.organizer_member_role\(p_organizer_id\), ''\) not in \('owner', 'manager'\)/);
  });
});
