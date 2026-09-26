import assert from "node:assert/strict";
const base = process.env.FLOW_TEST_URL || "http://localhost:5173/api/flow";
async function req(body, token) {
  const r = await fetch(base, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ...(await r.json()) };
}
const admin = await req({ action: "join", role: "Administrator" });
assert.equal(admin.status, 200);
const technician = await req({
  action: "join",
  room: admin.room,
  role: "Production Technician",
});
const qc = await req({
  action: "join",
  room: admin.room,
  role: "QC Technician",
});
let snap = await req(undefined, admin.token);
assert.equal(snap.state.elements.length, 48);
const e = snap.state.elements.find((e) => e.stage === "Pre-pour QC");
const cmd = {
  id: crypto.randomUUID(),
  type: "prepour",
  elementId: e.id,
  data: {
    drawingRevision: e.revision,
    result: "Approved",
    formwork: "Acceptable",
    dimensions: "Acceptable",
    reinforcement: "Acceptable",
    embeddedItems: "Acceptable",
  },
};
const denied = await req(
  { action: "command", command: cmd, version: snap.version },
  technician.token,
);
assert.equal(denied.status, 400);
assert.match(denied.error, /role/);
const approved = await req(
  { action: "command", command: cmd, version: snap.version },
  qc.token,
);
assert.equal(approved.status, 200);
assert.equal(
  approved.state.elements.find((x) => x.id === e.id).stage,
  "Ready to pour",
);
const duplicate = await req(
  { action: "command", command: cmd, version: snap.version },
  qc.token,
);
assert.equal(duplicate.state.events.length, approved.state.events.length);
const badReplay = await req(
  {
    action: "command",
    command: { ...cmd, data: { ...cmd.data, result: "Hold" } },
    version: snap.version,
  },
  qc.token,
);
assert.equal(badReplay.status, 400);
const remote = await req(undefined, technician.token);
assert.equal(
  remote.state.elements.find((x) => x.id === e.id).stage,
  "Ready to pour",
);
const candidate = {
  type: "project",
  data: {
    name: "Concurrency test",
    client: "Fictional client",
    location: "Test location",
  },
};
const race = await Promise.all(
  [1, 2].map(() =>
    req(
      {
        action: "command",
        version: remote.version,
        command: { id: crypto.randomUUID(), ...candidate },
      },
      admin.token,
    ),
  ),
);
assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
const other = await req({ action: "join", role: "Administrator" });
const unrelated = await req(undefined, other.token);
assert.equal(unrelated.state.projects.length, 3);
assert.equal(
  (await req({ action: "join", room: "production", role: "Administrator" }))
    .status,
  400,
);
assert.equal((await req(undefined, "demo_forged")).status, 401);
const after = await req(undefined, admin.token);
assert.equal(after.state.projects.length, 4);
const injection = await req(
  {
    action: "command",
    version: after.version,
    command: {
      id: crypto.randomUUID(),
      type: "project",
      data: { name: { x: "bad" }, client: "x", location: "x" },
    },
  },
  admin.token,
);
assert.equal(injection.status, 400);
console.log(
  "PASS: shared sessions, cross-user visibility, backend RBAC, atomic concurrency, idempotent replay, malformed payloads and room isolation.",
);
