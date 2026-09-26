export const ROLES = [
  "Administrator",
  "Project Manager",
  "Production Supervisor",
  "Production Technician",
  "QC Technician",
  "QC Manager",
  "Shipping Coordinator",
  "Receiving User",
] as const;
export type Role = (typeof ROLES)[number];
export const STAGES = [
  "Engineering",
  "Forming",
  "Pre-pour QC",
  "Ready to pour",
  "Curing",
  "Ready to strip",
  "Post-pour QC",
  "Yard",
  "Loaded",
  "Shipped",
  "Received",
];
export type Project = {
  id: string;
  name: string;
  number: string;
  client: string;
  contractor: string;
  location: string;
  plant: string;
  manager: string;
  start: string;
  delivery: string;
  description: string;
};
export type Element = {
  id: string;
  projectId: string;
  mark: string;
  serial: string;
  type: string;
  dimensions: string;
  strength: number;
  releaseStrength: number;
  shippingStrength: number;
  mix: string;
  drawing: string;
  revision: string;
  scheduled: string;
  delivery: string;
  stage: string;
  location: string;
  area: string;
  hold: boolean;
  batchId?: string;
  shipmentId?: string;
};
export type Event = {
  id: string;
  elementId: string;
  type: string;
  result: string;
  user: string;
  role: Role;
  at: string;
  revision: string;
  comments: string;
  details: Record<string, string>;
  photo?: string;
};
export type Defect = {
  id: string;
  elementId: string;
  description: string;
  severity: string;
  corrective: string;
  status: "Open" | "Repaired" | "Accepted";
  discovered: string;
  inspector: string;
  repaired?: string;
  accepted?: string;
  photo?: string;
};
export type Shipment = {
  id: string;
  number: string;
  carrier: string;
  trailer: string;
  destination: string;
  elements: string[];
  status: "Planned" | "Loaded" | "Shipped" | "Received";
  departure?: string;
  receipt?: string;
};
export type State = {
  projects: Project[];
  elements: Element[];
  events: Event[];
  defects: Defect[];
  shipments: Shipment[];
  settings: { optionalStages: string[] };
  commands: string[];
  commandPayloads?: Record<string, string>;
};
export type Actor = { name: string; role: Role };
export type Command = {
  id: string;
  type: string;
  elementId?: string;
  data: Record<string, any>;
};
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
const prod: Role[] = ["Production Supervisor", "Production Technician"];
const qc: Role[] = ["QC Technician", "QC Manager"];
export const ACTIONS: Record<
  string,
  { label: string; roles: Role[]; from?: string[]; to?: string }
> = {
  engineering: {
    label: "Release engineering",
    roles: ["Project Manager", "Production Supervisor"],
    from: ["Engineering"],
    to: "Forming",
  },
  form: {
    label: "Record formwork ready",
    roles: prod,
    from: ["Forming"],
    to: "Pre-pour QC",
  },
  prepour: {
    label: "Pre-pour inspection",
    roles: qc,
    from: ["Pre-pour QC"],
    to: "Ready to pour",
  },
  placement: {
    label: "Record concrete placement",
    roles: prod,
    from: ["Ready to pour"],
    to: "Curing",
  },
  curing: { label: "Record curing conditions", roles: prod, from: ["Curing"] },
  strength: {
    label: "Verify release strength",
    roles: qc,
    from: ["Curing"],
    to: "Ready to strip",
  },
  strip: {
    label: "Record stripping",
    roles: prod,
    from: ["Ready to strip"],
    to: "Post-pour QC",
  },
  final: {
    label: "Final QC acceptance",
    roles: qc,
    from: ["Post-pour QC"],
    to: "Yard",
  },
  location: {
    label: "Update yard location",
    roles: [...prod, "Shipping Coordinator"],
    from: ["Yard"],
  },
  defect: { label: "Record defect / QC hold", roles: qc },
  repair: { label: "Document repair", roles: [...prod, ...qc] },
  release: { label: "Reinspect & release hold", roles: ["QC Manager"] },
  receipt: {
    label: "Confirm jobsite receipt",
    roles: ["Receiving User", "Shipping Coordinator"],
    from: ["Shipped"],
    to: "Received",
  },
  correction: {
    label: "Append correction",
    roles: [
      "Project Manager",
      ...qc,
      ...prod,
      "Shipping Coordinator",
      "Receiving User",
    ],
  },
};
export function allowed(role: Role, roles: Role[]) {
  return role === "Administrator" || roles.includes(role);
}
export function availableActions(e: Element, role: Role) {
  return Object.entries(ACTIONS).filter(
    ([k, a]) =>
      allowed(role, a.roles) &&
      (!a.from || a.from.includes(e.stage)) &&
      (!e.hold || ["defect", "repair", "release", "correction"].includes(k)) &&
      (e.hold || !["repair", "release"].includes(k)),
  );
}
function requireText(d: Record<string, any>, fields: string[]) {
  for (const f of fields)
    if (!String(d[f] ?? "").trim())
      throw Error(`${f.replace(/([A-Z])/g, " $1")} is required.`);
}
function requireNumber(
  d: Record<string, any>,
  field: string,
  min: number,
  max = 1e9,
) {
  const n = Number(d[field]);
  if (d[field] === "" || !Number.isFinite(n) || n < min || n > max)
    throw Error(`${field} must be between ${min} and ${max}.`);
  return n;
}
export function applyCommand(
  input: State,
  command: Command,
  actor: Actor,
  now = new Date().toISOString(),
): State {
  if (input.commands.includes(command.id)) {
    if (
      input.commandPayloads?.[command.id] &&
      input.commandPayloads[command.id] !== JSON.stringify(command)
    )
      throw Error("Idempotency key was already used for a different request.");
    return input;
  }
  if (!ROLES.includes(actor.role) || !actor.name)
    throw Error("A valid user is required.");
  if (
    !command ||
    typeof command.type !== "string" ||
    typeof command.id !== "string" ||
    !command.data ||
    typeof command.data !== "object" ||
    Array.isArray(command.data)
  )
    throw Error("Invalid command payload.");
  const s = structuredClone(input);
  const d = command.data;
  for (const [key, value] of Object.entries(d)) {
    if (["elementIds", "optionalStages"].includes(key)) {
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some((x) => typeof x !== "string" || x.length > 200)
      )
        throw Error("Invalid selection.");
    } else if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    )
      throw Error(`Invalid ${key} value.`);
    else if (
      typeof value === "string" &&
      value.length > (key === "photo" ? 350_000 : 5000)
    )
      throw Error(`${key} is too long.`);
  }
  if (
    d.photo &&
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo)
  )
    throw Error("Invalid photograph.");
  const check = (r: Role[]) => {
    if (!allowed(actor.role, r))
      throw Error("Your role cannot perform this action.");
  };
  const event = (
    e: Element,
    type: string,
    result = "Complete",
    details: Record<string, string> = d,
  ) => {
    s.events.push({
      id: uid(),
      elementId: e.id,
      type,
      result,
      user: actor.name,
      role: actor.role,
      at: now,
      revision: e.revision,
      comments: String(d.comments || ""),
      details: Object.fromEntries(
        Object.entries(details)
          .filter(
            ([k, v]) =>
              !["photo", "comments", "elementIds"].includes(k) &&
              typeof v !== "object",
          )
          .map(([k, v]) => [k, String(v)]),
      ),
      photo: d.photo || undefined,
    });
  };
  if (command.type === "project") {
    check(["Project Manager"]);
    requireText(d, ["name", "client", "location"]);
    const id = uid();
    s.projects.push({
      id,
      number: `PRJ-${now.slice(0, 4)}-${String(s.projects.length + 42).padStart(4, "0")}`,
      name: d.name,
      client: d.client,
      contractor: d.contractor || "",
      location: d.location,
      plant: d.plant || "Main plant",
      manager: d.manager || actor.name,
      start: d.start || today(),
      delivery: d.delivery || "",
      description: d.description || "",
    });
  } else if (command.type === "elements") {
    check(["Project Manager", "Production Supervisor"]);
    requireText(d, [
      "projectId",
      "mark",
      "type",
      "dimensions",
      "mix",
      "drawing",
      "revision",
      "scheduled",
      "delivery",
    ]);
    if (!s.projects.some((p) => p.id === d.projectId))
      throw Error("Project does not exist.");
    const qty = requireNumber(d, "quantity", 1, 100);
    if (!Number.isInteger(qty)) throw Error("Quantity must be a whole number.");
    const strength = requireNumber(d, "strength", 1);
    const releaseStrength = requireNumber(d, "releaseStrength", 1);
    const shippingStrength = requireNumber(d, "shippingStrength", 1);
    if (releaseStrength > strength || shippingStrength > strength)
      throw Error(
        "Release and shipping requirements cannot exceed specified strength.",
      );
    const previous = s.elements.filter(
      (e) => e.projectId === d.projectId && e.mark === d.mark,
    ).length;
    for (let i = 1; i <= qty; i++) {
      const e: Element = {
        id: uid(),
        projectId: d.projectId,
        mark: d.mark,
        serial: `${d.mark}-${String(previous + i).padStart(3, "0")}`,
        type: d.type,
        dimensions: d.dimensions,
        strength,
        releaseStrength,
        shippingStrength,
        mix: d.mix,
        drawing: d.drawing,
        revision: d.revision,
        scheduled: d.scheduled,
        delivery: d.delivery,
        stage: "Engineering",
        location: "Engineering office",
        area: d.area || "Bay 1",
        hold: false,
      };
      s.elements.push(e);
      event(e, "Shop ticket created", "Complete");
    }
  } else if (command.type === "settings") {
    check([]);
    s.settings.optionalStages = Array.isArray(d.optionalStages)
      ? d.optionalStages.filter((x: string) =>
          ["Formwork Prepared", "Curing Log"].includes(x),
        )
      : [];
  } else if (command.type === "shipment") {
    check(["Shipping Coordinator", "Production Supervisor"]);
    requireText(d, ["carrier", "trailer", "destination"]);
    const ids = [...new Set(d.elementIds as string[])];
    if (!ids.length) throw Error("Select at least one element.");
    for (const id of ids) {
      const e = s.elements.find((e) => e.id === id);
      if (!e || e.stage !== "Yard" || e.hold || e.shipmentId)
        throw Error(
          "Only accepted, unassigned yard elements can join a shipment.",
        );
    }
    const shipment: Shipment = {
      id: uid(),
      number: `SHP-${now.slice(0, 4)}-${String(s.shipments.length + 1).padStart(3, "0")}`,
      carrier: d.carrier,
      trailer: d.trailer,
      destination: d.destination,
      elements: ids,
      status: "Planned",
    };
    s.shipments.push(shipment);
    for (const e of s.elements.filter((e) => ids.includes(e.id))) {
      e.shipmentId = shipment.id;
      event(e, "Shipment assigned", "Complete", {
        shipment: shipment.number,
        carrier: d.carrier,
        trailer: d.trailer,
      });
    }
  } else if (["load", "depart", "receiveShipment"].includes(command.type)) {
    check(
      command.type === "receiveShipment"
        ? ["Receiving User", "Shipping Coordinator"]
        : ["Shipping Coordinator"],
    );
    const sh = s.shipments.find((x) => x.id === d.shipmentId);
    if (!sh) throw Error("Shipment not found.");
    const expected =
      command.type === "load"
        ? "Planned"
        : command.type === "depart"
          ? "Loaded"
          : "Shipped";
    if (sh.status !== expected)
      throw Error(`Shipment must be ${expected.toLowerCase()}.`);
    if (command.type === "load" && d.loadingCheck !== "Verified")
      throw Error("Verify load restraints, supports and condition.");
    if (command.type === "receiveShipment") requireText(d, ["condition"]);
    for (const e of s.elements.filter((e) => sh.elements.includes(e.id))) {
      if (command.type === "receiveShipment" && e.stage === "Received")
        continue;
      if (
        command.type !== "receiveShipment" &&
        (e.hold || !["Yard", "Loaded"].includes(e.stage))
      )
        throw Error("Shipment contains a held or unavailable element.");
      e.stage =
        command.type === "load"
          ? "Loaded"
          : command.type === "depart"
            ? "Shipped"
            : "Received";
      e.location =
        command.type === "load"
          ? sh.trailer
          : command.type === "depart"
            ? "In transit"
            : sh.destination;
      if (command.type === "receiveShipment" && d.condition !== "Accepted") {
        e.hold = true;
        s.defects.push({
          id: uid(),
          elementId: e.id,
          description: d.comments || d.condition,
          severity: "Receiving exception",
          corrective: "QC review required",
          status: "Open",
          discovered: now,
          inspector: actor.name,
          photo: d.photo,
        });
      }
      event(
        e,
        command.type === "load"
          ? "Loading verified"
          : command.type === "depart"
            ? "Shipment departed"
            : "Jobsite receipt",
        command.type === "receiveShipment" ? d.condition : "Complete",
        { shipment: sh.number, ...d },
      );
    }
    sh.status =
      command.type === "load"
        ? "Loaded"
        : command.type === "depart"
          ? "Shipped"
          : "Received";
    if (command.type === "depart") sh.departure = now;
    if (command.type === "receiveShipment") sh.receipt = now;
  } else {
    const e = s.elements.find((e) => e.id === command.elementId);
    if (!e) throw Error("Element not found.");
    const a = ACTIONS[command.type];
    if (!a) throw Error("Unknown action.");
    check(a.roles);
    if (a.from && !a.from.includes(e.stage))
      throw Error(
        `This action is unavailable in ${e.stage}. Refresh the record.`,
      );
    if (
      e.hold &&
      !["repair", "release", "defect", "correction"].includes(command.type)
    )
      throw Error("Resolve the QC hold before advancing this element.");
    if (["prepour", "final"].includes(command.type)) {
      requireText(d, ["result", "drawingRevision"]);
      if (d.drawingRevision !== e.revision)
        throw Error("Inspection revision must match the current shop drawing.");
      if (!["Approved", "Hold"].includes(d.result))
        throw Error("Choose an inspection result.");
      const fields =
        command.type === "prepour"
          ? ["formwork", "dimensions", "reinforcement", "embeddedItems"]
          : ["dimensions", "finish"];
      requireText(d, fields);
      if (
        d.result === "Approved" &&
        fields.some(
          (f) =>
            !(
              f === "reinforcement" || f === "embeddedItems"
                ? ["Acceptable", "Verified", "Not applicable"]
                : ["Acceptable", "Verified"]
            ).includes(d[f]),
        )
      )
        throw Error("Deficient checks require a hold.");
      if (d.result === "Hold") {
        requireText(d, ["comments"]);
        e.hold = true;
        s.defects.push({
          id: uid(),
          elementId: e.id,
          description: d.comments,
          severity: "Inspection hold",
          corrective: d.corrective || "Correct and reinspect",
          status: "Open",
          discovered: now,
          inspector: actor.name,
          photo: d.photo,
        });
        event(e, a.label, "Hold");
      } else {
        if (command.type === "final") {
          const n = requireNumber(d, "shippingTestStrength", 1);
          if (n < e.shippingStrength)
            throw Error(
              `Shipping strength must reach ${e.shippingStrength} psi.`,
            );
          requireText(d, ["specimen"]);
        }
        e.stage = a.to!;
        if (command.type === "final") e.location = "Yard · Unassigned";
        event(e, a.label, "Approved");
      }
    } else if (command.type === "defect") {
      requireText(d, ["description", "severity", "corrective"]);
      e.hold = true;
      s.defects.push({
        id: uid(),
        elementId: e.id,
        description: d.description,
        severity: d.severity,
        corrective: d.corrective,
        status: "Open",
        discovered: now,
        inspector: actor.name,
        photo: d.photo,
      });
      event(e, "Defect recorded", "Hold");
    } else if (command.type === "repair") {
      const defect = s.defects.find(
        (x) => x.id === d.defectId && x.elementId === e.id,
      );
      if (!defect || defect.status !== "Open")
        throw Error("Select an open defect.");
      requireText(d, ["procedure", "materials", "approvalReference"]);
      defect.status = "Repaired";
      defect.repaired = now;
      event(e, "Repair documented", "Pending QC");
    } else if (command.type === "release") {
      const defect = s.defects.find(
        (x) => x.id === d.defectId && x.elementId === e.id,
      );
      if (!defect || defect.status !== "Repaired")
        throw Error("A documented repair is required before reinspection.");
      requireText(d, ["result", "comments"]);
      if (d.result === "Approved") {
        defect.status = "Accepted";
        defect.accepted = now;
      } else if (d.result === "Hold") {
        defect.status = "Open";
      } else throw Error("Choose Approved or Hold.");
      e.hold = s.defects.some(
        (x) => x.elementId === e.id && x.status !== "Accepted",
      );
      event(e, "QC reinspection", d.result);
    } else {
      if (command.type === "placement") {
        requireText(d, [
          "mix",
          "batchTicket",
          "truck",
          "placementDate",
          "startTime",
          "endTime",
          "concreteType",
          "specimen",
          "technician",
        ]);
        if (d.mix !== e.mix) throw Error(`This ticket requires mix ${e.mix}.`);
        if (d.endTime < d.startTime)
          throw Error(
            "Completion time must follow start time (same-day placement).",
          );
        for (const f of [
          "concreteTemperature",
          "ambientTemperature",
          "slump",
          "air",
          "unitWeight",
        ])
          requireNumber(
            d,
            f,
            f.includes("Temperature") ? -50 : 0,
            f === "air" ? 100 : 1000,
          );
        const linked = s.elements.find((x) => x.batchId === d.batchTicket);
        if (linked && linked.mix !== d.mix)
          throw Error(
            "This batch ticket is already associated with a different mix.",
          );
        e.batchId = d.batchTicket;
      }
      if (command.type === "curing")
        requireText(d, ["method", "temperature", "duration"]);
      if (command.type === "strength") {
        requireText(d, ["specimen", "testDate"]);
        const n = requireNumber(d, "testStrength", 1);
        if (n < e.releaseStrength)
          throw Error(`Release requires at least ${e.releaseStrength} psi.`);
      }
      if (command.type === "form") {
        requireText(d, ["formId", "dimensions"]);
        if (d.dimensions !== "Verified")
          throw Error(
            "Form dimensions must be verified before readiness is recorded.",
          );
      }
      if (command.type === "engineering") requireText(d, ["approvalReference"]);
      if (command.type === "strip") requireText(d, ["equipment", "comments"]);
      if (command.type === "location") {
        requireText(d, ["location"]);
        e.location = d.location;
      }
      if (command.type === "correction")
        requireText(d, ["eventId", "comments"]);
      if (
        command.type === "correction" &&
        !s.events.some((x) => x.id === d.eventId && x.elementId === e.id)
      )
        throw Error("Select an existing event to correct.");
      if (command.type === "receipt") {
        requireText(d, ["condition"]);
        e.location =
          s.projects.find((p) => p.id === e.projectId)?.location || "Jobsite";
        if (d.condition !== "Accepted") {
          e.hold = true;
          s.defects.push({
            id: uid(),
            elementId: e.id,
            description: d.comments || d.condition,
            severity: "Receiving exception",
            corrective: "QC review required",
            status: "Open",
            discovered: now,
            inspector: actor.name,
            photo: d.photo,
          });
        }
      }
      if (command.type === "engineering") e.location = e.area;
      if (command.type === "form") e.location = d.formId;
      if (a.to) e.stage = a.to;
      if (command.type === "receipt" && e.shipmentId) {
        const sh = s.shipments.find((x) => x.id === e.shipmentId);
        if (
          sh &&
          s.elements
            .filter((x) => sh.elements.includes(x.id))
            .every((x) => x.stage === "Received")
        ) {
          sh.status = "Received";
          sh.receipt = now;
        }
      }
      if (
        command.type === "engineering" &&
        s.settings.optionalStages.includes("Formwork Prepared")
      )
        e.stage = "Pre-pour QC";
      event(
        e,
        a.label,
        command.type === "strength"
          ? "Approved"
          : command.type === "receipt"
            ? d.condition
            : "Complete",
      );
    }
  }
  s.commands.push(command.id);
  s.commandPayloads = {
    ...s.commandPayloads,
    [command.id]: JSON.stringify(command),
  };
  return s;
}
export function seed(): State {
  const date = today();
  const s: State = {
    projects: [],
    elements: [],
    events: [],
    defects: [],
    shipments: [],
    settings: { optionalStages: [] },
    commands: [],
  };
  const projectNames = [
    "River Crossing Bridge",
    "Northeast Distribution Center",
    "Municipal Utility Expansion",
  ];
  projectNames.forEach((name, p) =>
    s.projects.push({
      id: `demo-project-${p + 1}`,
      name,
      number: `PRJ-2026-00${42 + p}`,
      client: ["Hawthorne County", "Meridian Logistics", "City of Brookfield"][
        p
      ],
      contractor: ["Summit Civil", "Atlas Construction", "Northline Utilities"][
        p
      ],
      location: ["Hawthorne, PA", "Allentown, PA", "Brookfield, NJ"][p],
      plant: "North plant",
      manager: ["Alex Morgan", "Jordan Lee", "Taylor Brooks"][p],
      start: date,
      delivery: date,
      description: "Fictional demonstration project.",
    }),
  );
  const counts = [5, 6, 6, 4, 7, 4, 6, 6, 0, 2, 2];
  let n = 0;
  counts.forEach((count, stageIndex) => {
    for (let j = 0; j < count; j++) {
      const i = n++;
      const p = i % 3;
      const mark = [
        `B-${101 + (i % 5)}`,
        `WP-${201 + (i % 7)}`,
        `UV-${301 + (i % 4)}`,
      ][p];
      const e: Element = {
        id: `demo-element-${String(i + 1).padStart(3, "0")}`,
        projectId: s.projects[p].id,
        mark,
        serial: `${mark}-${String(1 + s.elements.filter((x) => x.mark === mark).length).padStart(3, "0")}`,
        type: ["Bridge beam", "Wall panel", "Utility vault"][p],
        dimensions: ["48′ × 3′ × 4′", "24′ × 10′ × 8″", "8′ × 6′ × 6′"][p],
        strength: [6000, 5000, 4500][p],
        releaseStrength: 3000,
        shippingStrength: 4000,
        mix: ["MX-6000-S", "MX-5000-SCC", "MX-4500"][p],
        drawing: `S-${101 + p}`,
        revision: "C",
        scheduled: date,
        delivery: date,
        stage: STAGES[stageIndex],
        location:
          stageIndex < 7
            ? `Bay ${p + 1} · Bed ${j + 1}`
            : stageIndex === 7
              ? `Yard A · Row ${p + 1} · Position ${j + 1}`
              : stageIndex === 9
                ? "In transit"
                : s.projects[p].location,
        area: `Bay ${p + 1}`,
        hold: false,
        batchId: stageIndex >= 4 ? `BATCH-0926-${p + 1}` : undefined,
      };
      s.elements.push(e);
      const steps = [
        ["Shop ticket created", "Complete"],
        ["Release engineering", "Complete"],
        ["Record formwork ready", "Complete"],
        ["Pre-pour inspection", "Approved"],
        ["Record concrete placement", "Complete"],
        ["Verify release strength", "Approved"],
        ["Record stripping", "Complete"],
        ["Final QC acceptance", "Approved"],
        ["Loading verified", "Complete"],
        ["Shipment departed", "Complete"],
        ["Jobsite receipt", "Accepted"],
      ];
      for (let k = 0; k <= stageIndex; k++) {
        const at = new Date();
        at.setTime(
          at.getTime() - ((stageIndex - k) * 24 * 60 + 15 + j * 7) * 60_000,
        );
        s.events.push({
          id: `seed-event-${i}-${k}`,
          elementId: e.id,
          type: steps[k][0],
          result: steps[k][1],
          user: k === 3 || k === 5 || k === 7 ? "Sam Rivera" : "Alex Morgan",
          role:
            k === 3 || k === 5 || k === 7
              ? "QC Manager"
              : "Production Supervisor",
          at: at.toISOString(),
          revision: "C",
          comments: "Fictional demonstration record.",
          details:
            k === 4
              ? {
                  mix: e.mix,
                  batchTicket: e.batchId!,
                  concreteType: p === 1 ? "SCC" : "Conventional",
                  specimen: `CYL-${i + 1}`,
                  concreteTemperature: "72 °F",
                  air: "5.2%",
                  slump: p === 1 ? "24 in flow" : "4 in",
                }
              : k === 5
                ? { testStrength: "3650 psi", specimen: `CYL-${i + 1}` }
                : k === 7
                  ? {
                      shippingTestStrength: "4350 psi",
                      specimen: `CYL-${i + 1}`,
                    }
                  : { drawingRevision: "C" },
        });
      }
      if (stageIndex === 6 && j < 3) {
        e.hold = true;
        const repaired = j === 1;
        const at = new Date().toISOString();
        s.defects.push({
          id: `defect-${i}`,
          elementId: e.id,
          description: [
            "Chipped edge at lifting recess",
            "Surface voids on exposed face",
            "Embedded plate outside tolerance",
          ][j],
          severity: j === 2 ? "Major" : "Minor",
          corrective: "Approved repair procedure and QC reinspection",
          status: repaired ? "Repaired" : "Open",
          discovered: at,
          inspector: "Sam Rivera",
          repaired: repaired ? at : undefined,
        });
        s.events.push({
          id: `hold-${i}`,
          elementId: e.id,
          type: "Defect recorded",
          result: "Hold",
          user: "Sam Rivera",
          role: "QC Manager",
          at,
          revision: "C",
          comments: s.defects.at(-1)!.description,
          details: {},
        });
        if (repaired)
          s.events.push({
            id: `repair-${i}`,
            elementId: e.id,
            type: "Repair documented",
            result: "Pending QC",
            user: "Alex Morgan",
            role: "Production Supervisor",
            at,
            revision: "C",
            comments: "Patch placed per approved procedure R-04.",
            details: {
              materials: "Non-shrink repair mortar",
              approvalReference: "R-04",
            },
          });
      }
    }
  });
  for (const status of ["Shipped", "Received"] as const) {
    const elements = s.elements.filter((e) => e.stage === status);
    const id = `shipment-${status.toLowerCase()}`;
    s.shipments.push({
      id,
      number: `SHP-2026-00${s.shipments.length + 1}`,
      carrier: "Keystone Heavy Haul",
      trailer: `TRL-${s.shipments.length + 24}`,
      destination: "Project jobsites",
      elements: elements.map((e) => e.id),
      status,
      departure: new Date().toISOString(),
      receipt: status === "Received" ? new Date().toISOString() : undefined,
    });
    elements.forEach((e) => (e.shipmentId = id));
  }
  return s;
}
