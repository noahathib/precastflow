import assert from "node:assert/strict";
import {
  seed,
  applyCommand,
  uid,
  type State,
  type Role,
  type Command,
} from "../lib/model.ts";
let s = seed();
let count = 0;
const run = (
  type: string,
  data: Record<string, unknown>,
  id?: string,
  role: Role = "Administrator",
) => {
  s = applyCommand(
    s,
    { id: uid(), type, data, elementId: id },
    { role, name: "Test operator" },
  );
  count++;
};
const deny = (
  type: string,
  data: Record<string, unknown>,
  id?: string,
  role: Role = "Administrator",
) => {
  assert.throws(() =>
    applyCommand(
      s,
      { id: uid(), type, data, elementId: id },
      { role, name: "Test operator" },
    ),
  );
  count++;
};
assert.equal(s.elements.length, 48);
assert.equal(new Set(s.elements.map((e) => e.id)).size, 48);
run("project", {
  name: "Acceptance test",
  client: "Fictional client",
  location: "Test yard",
});
const p = s.projects.at(-1)!;
run("elements", {
  projectId: p.id,
  mark: "P-101",
  type: "Wall panel",
  quantity: 3,
  dimensions: "24 × 10 × 8",
  strength: 5000,
  releaseStrength: 3000,
  shippingStrength: 4000,
  mix: "M-5000",
  drawing: "S-101",
  revision: "C",
  scheduled: "2026-09-26",
  delivery: "2026-09-28",
});
const ids = s.elements.filter((e) => e.projectId === p.id).map((e) => e.id);
assert.equal(ids.length, 3);
assert.deepEqual(
  s.elements.filter((e) => ids.includes(e.id)).map((e) => e.serial),
  ["P-101-001", "P-101-002", "P-101-003"],
);
const id = ids[0];
deny("placement", {}, id);
run("engineering", { approvalReference: "ENG-1" }, id);
deny("form", { formId: "B1", dimensions: "Deficient" }, id);
run("form", { formId: "B1", dimensions: "Verified" }, id);
const checks = {
  drawingRevision: "C",
  formwork: "Acceptable",
  dimensions: "Acceptable",
  reinforcement: "Acceptable",
  embeddedItems: "Not applicable",
  result: "Approved",
};
deny("prepour", checks, id, "Production Technician");
deny("prepour", { ...checks, dimensions: "Not applicable" }, id);
run("prepour", checks, id, "QC Technician");
run(
  "placement",
  {
    mix: "M-5000",
    batchTicket: "BT-TEST",
    truck: "T1",
    placementDate: "2026-09-26",
    startTime: "10:00",
    endTime: "10:20",
    concreteType: "SCC",
    specimen: "CYL-1",
    technician: "Casey",
    concreteTemperature: 72,
    ambientTemperature: 75,
    slump: 24,
    air: 5,
    unitWeight: 148,
  },
  id,
  "Production Technician",
);
deny("strip", { equipment: "Crane 1", comments: "Verified" }, id);
deny(
  "strength",
  { testStrength: 2000, specimen: "CYL-1", testDate: "2026-09-27" },
  id,
);
run(
  "strength",
  { testStrength: 3200, specimen: "CYL-1", testDate: "2026-09-27" },
  id,
  "QC Technician",
);
run(
  "strip",
  { equipment: "Crane 1", comments: "Lifting anchors verified" },
  id,
  "Production Technician",
);
run(
  "defect",
  {
    description: "Chipped edge",
    severity: "Minor",
    corrective: "Approved patch",
  },
  id,
  "QC Technician",
);
const d = s.defects.at(-1)!;
deny(
  "final",
  {
    ...checks,
    finish: "Acceptable",
    shippingTestStrength: 4500,
    specimen: "CYL-1",
  },
  id,
);
run(
  "repair",
  {
    defectId: d.id,
    procedure: "Patch R-1",
    materials: "Mortar",
    approvalReference: "EOR-01",
  },
  id,
  "Production Technician",
);
assert.equal(s.elements.find((e) => e.id === id)!.hold, true);
deny(
  "release",
  { defectId: d.id, result: "Approved", comments: "Repaired" },
  id,
  "QC Technician",
);
run(
  "release",
  { defectId: d.id, result: "Approved", comments: "Repair accepted" },
  id,
  "QC Manager",
);
assert.equal(s.elements.find((e) => e.id === id)!.hold, false);
deny(
  "final",
  {
    ...checks,
    finish: "Acceptable",
    shippingTestStrength: 3500,
    specimen: "CYL-1",
  },
  id,
);
run(
  "final",
  {
    ...checks,
    finish: "Acceptable",
    shippingTestStrength: 4500,
    specimen: "CYL-1",
  },
  id,
  "QC Manager",
);
run("location", { location: "Yard A / Row 3 / Position 12" }, id);
run(
  "shipment",
  {
    carrier: "Test carrier",
    trailer: "T24",
    destination: "Test site",
    elementIds: [id],
  },
  undefined,
  "Shipping Coordinator",
);
const sh = s.shipments.at(-1)!;
deny("depart", { shipmentId: sh.id });
run("load", { shipmentId: sh.id, loadingCheck: "Verified" });
run("depart", { shipmentId: sh.id });
run("receipt", { condition: "Accepted" }, id, "Receiving User");
assert.equal(s.shipments.at(-1)!.status, "Received");
deny("receiveShipment", { shipmentId: sh.id, condition: "Accepted" });
const c: Command = {
  id: uid(),
  type: "correction",
  elementId: id,
  data: {
    eventId: s.events.at(-1)!.id,
    comments: "Clarified receipt reference",
  },
};
s = applyCommand(s, c, { name: "Reviewer", role: "Administrator" });
const n = s.events.length;
s = applyCommand(s, c, { name: "Reviewer", role: "Administrator" });
assert.equal(s.events.length, n);
assert.throws(() =>
  applyCommand(
    s,
    { ...c, data: { ...c.data, comments: "different" } },
    { name: "Reviewer", role: "Administrator" },
  ),
);
deny("project", {
  name: { bad: true },
  client: "Fictional",
  location: "Fictional",
});
assert.equal(s.elements.find((e) => e.id === ids[1])!.stage, "Engineering");
assert.equal(s.defects.find((x) => x.id === d.id)!.status, "Accepted");
console.log(
  `PASS: ${count + 6} workflow, permission, integrity, serialization, and idempotency assertions.`,
);
