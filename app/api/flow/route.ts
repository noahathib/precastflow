import { env } from "cloudflare:workers";
import { applyCommand, seed, ROLES, type Role, type State } from "@/lib/model";
export const dynamic = "force-dynamic";
const json = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { "Cache-Control": "no-store" } });
function bindings() {
  return env as unknown as {
    DB: D1Database;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    PRODUCTION_ADMIN_EMAIL?: string;
  };
}
async function context(req: Request) {
  const e = bindings();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw Error("Sign in to continue.");
  if (token.startsWith("demo_")) {
    const session = await e.DB.prepare(
      "SELECT * FROM sessions WHERE id=? AND expires>?",
    )
      .bind(token, Date.now())
      .first<{ room: string; role: Role; name: string }>();
    if (!session) throw Error("Demo session expired. Rejoin your workspace.");
    return {
      room: session.room,
      actor: { role: session.role, name: session.name },
      demo: true,
    };
  }
  if (!e.SUPABASE_URL || !e.SUPABASE_ANON_KEY)
    throw Error("Production authentication is not configured.");
  const res = await fetch(`${e.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: e.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw Error("Your session expired. Sign in again.");
  const user = (await res.json()) as {
    email?: string;
    email_confirmed_at?: string;
    id: string;
  };
  if (!user.email || !user.email_confirmed_at)
    throw Error("A verified email is required.");
  const email = user.email.toLowerCase();
  let member = await e.DB.prepare("SELECT role FROM members WHERE email=?")
    .bind(email)
    .first<{ role: Role }>();
  if (!member && e.PRODUCTION_ADMIN_EMAIL?.toLowerCase() === email) {
    await e.DB.prepare("INSERT OR IGNORE INTO members(email,role) VALUES (?,?)")
      .bind(email, "Administrator")
      .run();
    member = { role: "Administrator" };
  }
  if (!member) throw Error("Your account has not been added to this plant.");
  return {
    room: "production",
    actor: { role: member.role, name: email },
    demo: false,
  };
}
export async function GET(req: Request) {
  try {
    const e = bindings();
    const c = await context(req);
    const row = await e.DB.prepare("SELECT data,version FROM rooms WHERE id=?")
      .bind(c.room)
      .first<{ data: string; version: number }>();
    if (!row) return json({ error: "Workspace not found." }, 404);
    const members =
      c.actor.role === "Administrator" && !c.demo
        ? (await e.DB.prepare("SELECT email,role FROM members").all()).results
        : [];
    return json({
      state: JSON.parse(row.data),
      version: row.version,
      actor: c.actor,
      room: c.room,
      mode: c.demo ? "shared" : "production",
      members,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }
}
export async function POST(req: Request) {
  try {
    const e = bindings();
    if (!e.DB)
      return json(
        { error: "Shared storage is unavailable. Choose local demo mode." },
        503,
      );
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > 6_000_000)
      return json({ error: "Request is too large." }, 413);
    const raw = await req.text();
    if (raw.length > 6_000_000)
      return json({ error: "Request is too large." }, 413);
    const b = JSON.parse(raw);
    if (b.action === "join") {
      if (b.room && !/^demo-[a-f0-9-]{36}$/.test(b.room))
        throw Error("Invalid demo workspace link.");
      const room = b.room || `demo-${crypto.randomUUID()}`;
      const role = ROLES.includes(b.role) ? b.role : "Administrator";
      const existing = await e.DB.prepare("SELECT id FROM rooms WHERE id=?")
        .bind(room)
        .first();
      if (b.room && !existing)
        throw Error("This demo workspace no longer exists.");
      if (!existing)
        await e.DB.prepare(
          "INSERT INTO rooms(id,data,version,updated) VALUES (?,?,0,?)",
        )
          .bind(room, JSON.stringify(seed()), new Date().toISOString())
          .run();
      const token = `demo_${crypto.randomUUID()}`;
      const name = b.name
        ? String(b.name).slice(0, 80)
        : (
            {
              Administrator: "Alex Morgan",
              "QC Manager": "Sam Rivera",
              "QC Technician": "Jamie Chen",
              "Production Technician": "Casey Miller",
              "Production Supervisor": "Alex Morgan",
              "Project Manager": "Jordan Lee",
              "Shipping Coordinator": "Taylor Brooks",
              "Receiving User": "Morgan Davis",
            } as Record<string, string>
          )[role];
      await e.DB.prepare(
        "INSERT INTO sessions(id,room,role,name,expires) VALUES (?,?,?,?,?)",
      )
        .bind(token, room, role, name, Date.now() + 7 * 86400_000)
        .run();
      return json({ token, room, actor: { name, role } });
    }
    if (b.action === "login") {
      if (!e.SUPABASE_URL || !e.SUPABASE_ANON_KEY)
        return json(
          {
            error:
              "Production sign-in requires a configured Supabase project. The shared demonstration is available now.",
          },
          503,
        );
      const res = await fetch(
        `${e.SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: e.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: b.email, password: b.password }),
        },
      );
      const data = (await res.json()) as any;
      if (!res.ok)
        return json(
          { error: "Sign-in failed. Check your email and password." },
          401,
        );
      const c = await context(
        new Request(req.url, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        }),
      );
      await e.DB.prepare(
        "INSERT OR IGNORE INTO rooms(id,data,version,updated) VALUES (?,?,0,?)",
      )
        .bind(
          "production",
          JSON.stringify({
            projects: [],
            elements: [],
            events: [],
            defects: [],
            shipments: [],
            settings: { optionalStages: [] },
            commands: [],
          }),
          new Date().toISOString(),
        )
        .run();
      return json({ token: data.access_token, room: c.room, actor: c.actor });
    }
    const c = await context(req);
    if (b.action === "member") {
      if (c.demo || c.actor.role !== "Administrator")
        throw Error("Only a production administrator can manage access.");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
        !ROLES.includes(b.role)
      )
        throw Error("Valid email and role required.");
      if (b.email.toLowerCase() === c.actor.name && b.role !== "Administrator")
        throw Error("You cannot remove your own administrator role.");
      await e.DB.prepare(
        "INSERT INTO members(email,role) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role",
      )
        .bind(b.email.toLowerCase(), b.role)
        .run();
      return json({ ok: true });
    }
    const row = await e.DB.prepare("SELECT data,version FROM rooms WHERE id=?")
      .bind(c.room)
      .first<{ data: string; version: number }>();
    if (!row) throw Error("Workspace not found.");
    if (b.action === "reset") {
      if (!c.demo || c.actor.role !== "Administrator")
        throw Error("Only a demo administrator can reset fictional data.");
      const r = await e.DB.prepare(
        "UPDATE rooms SET data=?,version=version+1,updated=? WHERE id=? AND version=?",
      )
        .bind(
          JSON.stringify(seed()),
          new Date().toISOString(),
          c.room,
          row.version,
        )
        .run();
      if (!r.meta.changes)
        return json({ error: "Workspace changed. Try again." }, 409);
      return json({ ok: true });
    }
    if (b.action !== "command") throw Error("Unknown request.");
    const state = JSON.parse(row.data) as State;
    if (
      !b.command?.id ||
      typeof b.command.id !== "string" ||
      b.command.id.length > 100
    )
      throw Error("An idempotency key is required.");
    if (state.commands.includes(b.command.id)) {
      applyCommand(state, b.command, c.actor);
      return json({ state, version: row.version });
    }
    if (b.version !== row.version)
      return json(
        {
          error:
            "Another user updated the workspace. Your view has refreshed; review and submit again.",
        },
        409,
      );
    if (state.events.length > 15000 || state.elements.length > 3000)
      throw Error(
        "This demonstration workspace has reached its capacity. Export records and start a new demo.",
      );
    const next = applyCommand(state, b.command, c.actor);
    const encoded = JSON.stringify(next);
    if (new TextEncoder().encode(encoded).byteLength > 1_800_000)
      throw Error(
        "This workspace has reached its demonstration storage limit. Export records and start a new demo room.",
      );
    const result = await e.DB.prepare(
      "UPDATE rooms SET data=?,version=version+1,updated=? WHERE id=? AND version=?",
    )
      .bind(encoded, new Date().toISOString(), c.room, row.version)
      .run();
    if (!result.meta.changes)
      return json(
        {
          error:
            "Another user updated the workspace. Review the latest record and retry.",
        },
        409,
      );
    return json({ state: next, version: row.version + 1 });
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
}
