import type { State, Element, Shipment } from "./model";
export function download(
  name: string,
  body: Blob | string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(
    typeof body === "string" ? new Blob([body], { type }) : body,
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function csv(name: string, headers: string[], rows: unknown[][]) {
  download(
    name,
    [headers, ...rows]
      .map((r) =>
        r
          .map((c) => {
            const v = String(c ?? "");
            return (
              '"' +
              (/^[=+@\-\t\r]/.test(v) ? "'" : "") +
              v.replaceAll('"', '""') +
              '"'
            );
          })
          .join(","),
      )
      .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export function printReport(
  title: string,
  headers: string[],
  rows: unknown[][],
  subtitle = "PrecastFlow • From Shop Drawing to Jobsite",
) {
  const w = window.open("", "_blank");
  if (!w) throw Error("Allow pop-ups to open the printable report.");
  w.document.write(
    `<!doctype html><html><head><title>${escape(title)}</title><style>body{font:12px Arial;color:#172b39;padding:32px}h1{font-size:25px}p{color:#5b707e}table{width:100%;border-collapse:collapse;margin-top:25px}th,td{border-bottom:1px solid #ddd;text-align:left;padding:10px;vertical-align:top;word-break:break-word}th{background:#edf4f5}footer{margin-top:30px;font-size:10px}@media print{body{padding:0}thead{display:table-header-group}tr{break-inside:avoid}}@page{size:landscape;margin:14mm}</style></head><body><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><p>Generated ${escape(new Date().toLocaleString())}</p><table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</tbody></table><footer>Supports documented quality workflows. Receipt does not indicate installation.</footer></body></html>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 250);
}
export function reportData(
  s: State,
  kind: string,
  elementId?: string,
  from = "",
  to = "",
): { headers: string[]; rows: unknown[][] } {
  const project = (e: Element) =>
    s.projects.find((p) => p.id === e.projectId)?.name || "";
  if (kind === "Daily production" || kind === "Element traceability")
    return {
      headers: [
        "Time",
        "Element",
        "Activity",
        "Result",
        "User / role",
        "Drawing revision",
        "Comments",
        "Details",
      ],
      rows: s.events
        .filter(
          (e) =>
            (kind !== "Element traceability" || e.elementId === elementId) &&
            (!from || e.at.slice(0, 10) >= from) &&
            (!to || e.at.slice(0, 10) <= to),
        )
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((e) => [
          new Date(e.at).toLocaleString(),
          s.elements.find((x) => x.id === e.elementId)?.serial,
          e.type,
          e.result,
          `${e.user} / ${e.role}`,
          e.revision,
          e.comments,
          Object.entries(e.details)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; "),
        ]),
    };
  if (kind === "QC holds")
    return {
      headers: [
        "Element",
        "Project",
        "Stage",
        "Defect",
        "Disposition",
        "Corrective action",
        "Discovered",
        "Repair completed",
        "Accepted",
      ],
      rows: s.defects
        .filter((d) => d.status !== "Accepted")
        .map((d) => {
          const e = s.elements.find((e) => e.id === d.elementId)!;
          return [
            e.serial,
            project(e),
            e.stage,
            d.description,
            d.status,
            d.corrective,
            d.discovered,
            d.repaired || "",
            d.accepted || "",
          ];
        }),
    };
  return {
    headers: [
      "Element",
      "Project",
      "Type",
      "Stage",
      "QC status",
      "Location",
      "Drawing",
      "Batch",
      "Shipment",
    ],
    rows: s.elements
      .filter(
        (e) =>
          kind !== "Shipping" ||
          ["Yard", "Loaded", "Shipped", "Received"].includes(e.stage),
      )
      .map((e) => [
        e.serial,
        project(e),
        e.type,
        e.stage,
        e.hold ? "QC hold" : "Clear",
        e.location,
        `${e.drawing} Rev ${e.revision}`,
        e.batchId || "",
        s.shipments.find((sh) => sh.id === e.shipmentId)?.number || "",
      ]),
  };
}
export function manifest(s: State, sh: Shipment) {
  const es = s.elements.filter((e) => sh.elements.includes(e.id));
  printReport(
    `Shipment manifest · ${sh.number}`,
    ["Serial", "Project", "Type", "Dimensions", "Drawing", "Status"],
    es.map((e) => [
      e.serial,
      s.projects.find((p) => p.id === e.projectId)?.name,
      e.type,
      e.dimensions,
      `${e.drawing} / ${e.revision}`,
      e.stage,
    ]),
    `${sh.carrier} · Trailer ${sh.trailer} · ${sh.destination} · ${sh.status}`,
  );
}
export function qrUrl(id: string, room: string) {
  return `${location.origin}${location.pathname}#/element/${id}${room.startsWith("demo-") ? "?room=" + encodeURIComponent(room) : ""}`;
}
export async function printLabels(s: State, elements: Element[], room: string) {
  const w = window.open("", "_blank");
  if (!w) throw Error("Allow pop-ups to print labels.");
  const QRCode = (await import("qrcode")).default;
  const labels = await Promise.all(
    elements.map(async (e) => {
      const p = s.projects.find((p) => p.id === e.projectId)!;
      return `<article><img src="${await QRCode.toDataURL(qrUrl(e.id, room), { width: 250, margin: 2 })}"/><div><small>PRECASTFLOW · PRODUCTION PASSPORT</small><h1>${escape(e.serial)}</h1><p>${escape(p.name)}<br>${escape(p.number)}</p><p>Mark ${escape(e.mark)} · ${escape(e.type)}<br>${escape(e.dimensions)}</p><small>${escape(e.id)}</small></div></article>`;
    }),
  );
  w.document.write(
    `<!doctype html><html><head><title>PrecastFlow labels</title><style>body{font:14px Arial;color:#112c3b}article{display:flex;gap:24px;align-items:center;border:2px solid #112c3b;padding:24px;margin-bottom:25px;break-inside:avoid}img{width:190px;height:190px}h1{font-size:30px}small{font-size:10px}@page{margin:12mm}</style></head><body>${labels.join("")}</body></html>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 350);
}
