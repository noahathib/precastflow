"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  Layers3,
  LayoutDashboard,
  FolderKanban,
  Columns3,
  QrCode,
  ShieldCheck,
  Truck,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  MapPin,
  CalendarDays,
  ChevronRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Factory,
  Package,
  Download,
  Printer,
  RefreshCw,
  LogOut,
  BookOpen,
  ScanLine,
  Camera,
  Copy,
  Link2,
  Wifi,
  HardDrive,
  Loader2,
  ClipboardCheck,
  Ellipsis,
  X,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import {
  seed,
  applyCommand,
  availableActions,
  allowed,
  uid,
  today,
  STAGES,
  ROLES,
  ACTIONS,
  type State,
  type Element,
  type Actor,
  type Command,
  type Shipment,
  type Role,
} from "@/lib/model";
import {
  csv,
  download,
  reportData,
  printReport,
  printLabels,
  manifest,
  qrUrl,
} from "@/lib/exports";
import { Pick, Field, TextField, Submit, Photo, EventForm } from "./forms";
type Session = { token: string; room: string; actor: Actor };
const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const SHARED_URL =
  "https://precastflow-production.clear-tick-3522.chatgpt.site";
const NAV = [
  ["dashboard", "Plant overview", LayoutDashboard],
  ["projects", "Projects", FolderKanban],
  ["board", "Production board", Columns3],
  ["scan", "Scan QR", QrCode],
  ["qc", "QC & inspections", ShieldCheck],
  ["shipping", "Yard & shipping", Truck],
  ["reports", "Reports", ChartNoAxesCombined],
  ["admin", "Administration", Settings],
] as const;
const STAGE_COLORS = [
  "#9baeba",
  "#669cae",
  "#d0a555",
  "#369ca8",
  "#29a5ae",
  "#65acb2",
  "#7195bc",
  "#288f79",
  "#7183af",
  "#405a76",
  "#7c969d",
];
function Pill({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Status({ e }: { e: Element }) {
  return e.hold ? (
    <Pill tone="red">
      <AlertTriangle size={12} />
      QC hold
    </Pill>
  ) : (
    <Pill
      tone={
        ["Yard", "Received"].includes(e.stage)
          ? "green"
          : e.stage.includes("QC")
            ? "amber"
            : "blue"
      }
    >
      {e.stage === "Yard" ? "Ready to ship" : e.stage}
    </Pill>
  );
}
function niceDate(d: string) {
  return d
    ? new Date(d + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "—";
}
function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <Package size={32} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export default function FlowApp() {
  const [s, setS] = useState<State>(() => seed());
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [actor, setActor] = useState<Actor>({
    name: "Alex Morgan",
    role: "Administrator",
  });
  const [version, setVersion] = useState(0);
  const [route, setRoute] = useState("dashboard");
  const [selected, setSelected] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [qcFilter, setQcFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [authRole, setAuthRole] = useState<Role>("Administrator");
  const [connectionError, setConnectionError] = useState("");
  const [reset, setReset] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [scanError, setScanError] = useState("");
  const [lookupMatches, setLookupMatches] = useState<Element[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [report, setReport] = useState("Project production");
  const [reportElement, setReportElement] = useState("");
  const [members, setMembers] = useState<{ email: string; role: Role }[]>([]);
  const [loadShipment, setLoadShipment] = useState<Shipment | null>(null);
  const [shipmentAction, setShipmentAction] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const localRef = useRef(s);
  const pending = useRef<Command | null>(null);
  const activeSession = useRef<Session | null>(null);
  const versionRef = useRef(0);
  const mode = session
    ? session.room === "production"
      ? "production"
      : "shared"
    : "local";
  const room = session?.room || "local";
  const current = s.elements.find((e) => e.id === selected);
  const currentProject = current
    ? s.projects.find((p) => p.id === current.projectId)
    : undefined;
  const api = useCallback(
    async (body?: unknown, ss?: Session | null) => {
      if (STATIC_DEMO)
        throw Error(
          "This GitHub Pages edition stores records in this browser. Open the shared demonstration for connected records.",
        );
      const sess = ss === undefined ? session : ss;
      const res = await fetch("./api/flow", {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(sess ? { Authorization: `Bearer ${sess.token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await res.json()) as any;
      if (!res.ok)
        throw Object.assign(
          Error(result.error || "Unable to save. Try again."),
          { status: res.status },
        );
      return result;
    },
    [session],
  );
  const refresh = useCallback(
    async (ss?: Session) => {
      const target = ss || activeSession.current;
      if (!target) return;
      const r = await api(undefined, target);
      if (
        activeSession.current?.token !== target.token ||
        r.version < versionRef.current
      )
        return;
      versionRef.current = r.version;
      setS(r.state);
      setVersion(r.version);
      setActor(r.actor);
      setMembers(r.members || []);
      setConnectionError("");
    },
    [api],
  );
  const join = useCallback(
    async (role: Role, joinRoom?: string) => {
      const r = await api({ action: "join", role, room: joinRoom }, null);
      const sess = { token: r.token, room: r.room, actor: r.actor };
      localStorage.setItem("precastflow-session", JSON.stringify(sess));
      activeSession.current = sess;
      versionRef.current = 0;
      setSession(sess);
      setActor(r.actor);
      await refresh(sess);
      return sess;
    },
    [api, refresh],
  );
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.slice(2).split("?")[0] || "dashboard";
      const [r, id] = h.split("/");
      setRoute(r);
      setSelected(id || "");
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem("precastflow-local");
        if (raw) {
          const state = JSON.parse(raw);
          if (state.projects && state.events) setS(state);
        }
        const saved = STATIC_DEMO
          ? null
          : localStorage.getItem("precastflow-session");
        const sess: Session | null = saved ? JSON.parse(saved) : null;
        const targetRoom = new URLSearchParams(
          location.hash.split("?")[1] || "",
        ).get("room");
        if (!STATIC_DEMO && targetRoom && targetRoom !== sess?.room) {
          await join("Production Technician", targetRoom);
        } else if (sess) {
          activeSession.current = sess;
          versionRef.current = 0;
          setSession(sess);
          setActor(sess.actor);
          try {
            await refresh(sess);
          } catch (err) {
            setConnectionError((err as Error).message);
          }
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  useEffect(() => {
    localRef.current = s;
    if (ready && !session) {
      try {
        localStorage.setItem("precastflow-local", JSON.stringify(s));
      } catch {
        setConnectionError(
          "Browser storage is full. Export your data before closing this page.",
        );
      }
    }
  }, [s, ready, session]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(
      () =>
        refresh().catch((e) => {
          if (activeSession.current?.token === session.token)
            setConnectionError(e.message);
        }),
      5000,
    );
    return () => clearInterval(t);
  }, [session, refresh]);
  useEffect(() => {
    if (modal !== "scan") {
      controls.current?.stop();
      controls.current = null;
      setCameraOn(false);
    }
    return () => {
      controls.current?.stop();
    };
  }, [modal]);
  useEffect(() => {
    if (modal === "qr" && current) {
      setQrImage("");
      import("qrcode")
        .then((QR) =>
          QR.toDataURL(qrUrl(current.id, room), {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          }),
        )
        .then(setQrImage)
        .catch(() => toast.error("Could not generate QR code."));
    }
  }, [modal, current?.id, room]);
  function nav(r: string, id = "") {
    if (r === "project") {
      setProjectFilter("all");
      setStageFilter("all");
      setTypeFilter("all");
      setAreaFilter("all");
      setQcFilter("all");
      setDateFrom("");
      setDateTo("");
    }
    location.hash = `#/${r}${id ? "/" + id : ""}`;
    setQuery("");
  }
  async function command(
    type: string,
    data: Record<string, any>,
    elementId?: string,
  ) {
    if (busy) return false;
    setBusy(true);
    const key = JSON.stringify({ type, data, elementId });
    const c =
      pending.current &&
      JSON.stringify({
        type: pending.current.type,
        data: pending.current.data,
        elementId: pending.current.elementId,
      }) === key
        ? pending.current
        : { id: uid(), type, data, elementId };
    pending.current = c;
    try {
      if (session) {
        const token = session.token;
        const r = await api({
          action: "command",
          command: c,
          version: versionRef.current,
        });
        if (activeSession.current?.token !== token) return false;
        if (r.version >= versionRef.current) {
          versionRef.current = r.version;
          setS(r.state);
          setVersion(r.version);
          if (type === "project") nav("project", r.state.projects.at(-1).id);
        }
      } else {
        const next = applyCommand(localRef.current, c, actor);
        localStorage.setItem("precastflow-local", JSON.stringify(next));
        setS(next);
        if (type === "project") nav("project", next.projects.at(-1)!.id);
      }
      pending.current = null;
      toast.success(
        type === "project"
          ? "Project created"
          : type === "elements"
            ? "Serialized elements created"
            : "Record saved to the production history",
      );
      setModal("");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      if ((e as any).status === 409) {
        pending.current = null;
        await refresh().catch(() => {});
      }
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openElement(e: Element) {
    nav("element", e.id);
  }
  function handleLookup(value: string) {
    let id = value.trim();
    try {
      if (id.includes("#/")) {
        const u = new URL(id);
        const hash = u.hash.slice(2).split("?")[0];
        if (hash.startsWith("element/")) {
          const targetRoom = new URLSearchParams(
            u.hash.split("?")[1] || "",
          ).get("room");
          if (targetRoom && targetRoom !== room) {
            location.href = `${location.origin}${location.pathname}${u.hash}`;
            location.reload();
            return;
          }
          id = hash.slice(8);
        }
      }
    } catch {}
    const matches = s.elements.filter(
      (e) => e.id === id || e.serial.toLowerCase() === id.toLowerCase(),
    );
    if (matches.length > 1) {
      setLookupMatches(matches);
      return;
    }
    setLookupMatches([]);
    const e = matches[0];
    if (e) {
      controls.current?.stop();
      setModal("");
      openElement(e);
    } else
      toast.error(
        "No matching element. Enter a complete serial number or scan a PrecastFlow QR.",
      );
  }
  async function startCamera() {
    setScanError("");
    setCameraOn(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      if (!video.current) throw Error("Camera view is unavailable.");
      controls.current = await reader.decodeFromVideoDevice(
        undefined,
        video.current,
        (result) => {
          if (result) {
            controls.current?.stop();
            handleLookup(result.getText());
          }
        },
      );
    } catch {
      setCameraOn(false);
      setScanError(
        "Camera unavailable or permission denied. Use manual lookup below, or allow camera access in browser settings.",
      );
    }
  }
  async function safely(fn: () => unknown) {
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const filtered = s.elements.filter(
    (e) =>
      (projectFilter === "all" || e.projectId === projectFilter) &&
      (stageFilter === "all" ||
        (stageFilter === "hold" ? e.hold : e.stage === stageFilter)) &&
      (typeFilter === "all" || e.type === typeFilter) &&
      (areaFilter === "all" || e.area === areaFilter) &&
      (qcFilter === "all" || (qcFilter === "hold" ? e.hold : !e.hold)) &&
      (!dateFrom || e.scheduled >= dateFrom) &&
      (!dateTo || e.scheduled <= dateTo) &&
      `${e.serial} ${e.mark} ${e.location} ${e.batchId || ""} ${s.projects.find((p) => p.id === e.projectId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const recent = [...s.events]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  const holds = s.elements.filter((e) => e.hold);
  const readyShip = s.elements.filter((e) => e.stage === "Yard" && !e.hold);
  const canManage = allowed(actor.role, [
    "Project Manager",
    "Production Supervisor",
  ]);
  function table(elements: Element[], compact = false) {
    return elements.length ? (
      <div className="table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Element / serial</TableHead>
              {!compact && <TableHead>Project</TableHead>}
              <TableHead>Production status</TableHead>
              <TableHead>Location</TableHead>
              {!compact && <TableHead>Scheduled</TableHead>}
              <TableHead>
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((e) => (
              <TableRow
                key={e.id}
                className="element-row"
                onClick={() => openElement(e)}
              >
                <TableCell>
                  <button
                    className="serial-link"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openElement(e);
                    }}
                  >
                    {e.serial}
                  </button>
                  <div className="muted cell-sub">{e.type}</div>
                </TableCell>
                {!compact && (
                  <TableCell>
                    <span className="project-cell">
                      {s.projects.find((p) => p.id === e.projectId)?.name}
                    </span>
                  </TableCell>
                )}
                <TableCell>
                  <Status e={e} />
                  {e.hold && <div className="cell-sub muted">{e.stage}</div>}
                </TableCell>
                <TableCell>
                  <span className="muted location-cell">
                    <MapPin size={13} />
                    {e.location}
                  </span>
                </TableCell>
                {!compact && <TableCell>{niceDate(e.scheduled)}</TableCell>}
                <TableCell>
                  <ChevronRight size={16} className="muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <Empty
        title="No elements found"
        body="Try another filter or create elements for this project."
      />
    );
  }
  function filters() {
    return (
      <div className="filters">
        <div className="search-box">
          <Search size={16} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search elements, projects, batches…"
            aria-label="Search elements"
          />
        </div>
        <Pick
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            { value: "all", label: "All projects" },
            ...s.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Pick
          value={stageFilter}
          onChange={setStageFilter}
          options={[
            { value: "all", label: "All stages" },
            ...STAGES,
            { value: "hold", label: "QC hold" },
          ]}
        />
        <details className="more-filters">
          <summary>More filters</summary>
          <div className="filter-pop">
            <Field label="Element type">
              <Pick
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "All types" },
                  ...Array.from(new Set(s.elements.map((e) => e.type))),
                ]}
              />
            </Field>
            <Field label="Production area">
              <Pick
                value={areaFilter}
                onChange={setAreaFilter}
                options={[
                  { value: "all", label: "All areas" },
                  ...Array.from(new Set(s.elements.map((e) => e.area))),
                ]}
              />
            </Field>
            <Field label="QC status">
              <Pick
                value={qcFilter}
                onChange={setQcFilter}
                options={[
                  { value: "all", label: "All QC statuses" },
                  { value: "hold", label: "On hold" },
                  { value: "clear", label: "Clear" },
                ]}
              />
            </Field>
            <Field label="Scheduled from">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>
            <Field label="Scheduled through">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              onClick={() => {
                setTypeFilter("all");
                setAreaFilter("all");
                setQcFilter("all");
                setDateFrom("");
                setDateTo("");
                setStageFilter("all");
                setProjectFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </details>
      </div>
    );
  }
  const pageTitle =
    NAV.find((n) => n[0] === route)?.[1] ||
    (route === "element"
      ? "Element passport"
      : route === "project"
        ? "Project overview"
        : "Plant overview");
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "244px" } as React.CSSProperties}
    >
      <Toaster richColors position="top-right" />
      <Sidebar className="plant-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => nav("dashboard")}>
            <Layers3 />
            Precast<span>Flow</span>
          </button>
          <div className="plant-switch">
            <Factory size={18} />
            <div>
              North plant<small>PRECAST OPERATIONS</small>
            </div>
            <ChevronRight size={15} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {NAV.map(([key, label, Icon]) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  isActive={route === key}
                  onClick={() => (key === "scan" ? setModal("scan") : nav(key))}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {key === "qc" && holds.length > 0 && (
                    <b className="nav-count">{holds.length}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-guide">
            <div className="guide-icon">
              <BookOpen size={18} />
            </div>
            <strong>From drawing to jobsite.</strong>
            <p>Follow an element through its complete production journey.</p>
            <button onClick={() => setModal("guide")}>
              Explore the guided demo <ArrowRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="user-button"
            onClick={() => {
              setAuthRole(actor.role);
              setModal("login");
            }}
          >
            <span className="avatar">{initials(actor.name)}</span>
            <div>
              <strong>{actor.name}</strong>
              <small>{actor.role}</small>
            </div>
            <Ellipsis size={18} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span className="plant-name">North plant</span>
            <span className="slash">/</span>
            <span>{pageTitle}</span>
          </div>
          <div className="top-actions">
            <span
              className={`mode-status ${mode === "production" ? "production" : ""}`}
            >
              {mode === "local" ? <HardDrive size={13} /> : <Wifi size={13} />}{" "}
              {mode === "local"
                ? "Local demo"
                : mode === "shared"
                  ? "Shared demo"
                  : "Connected plant"}
            </span>
            <button
              className="avatar small"
              aria-label="Account and role"
              onClick={() => setModal("login")}
            >
              {initials(actor.name)}
            </button>
          </div>
        </header>
        <div className="demo-banner">
          {mode === "production" ? (
            <>
              <ShieldCheck size={15} />
              <span>
                Production workspace · Verified account · Server-enforced
                permissions
              </span>
            </>
          ) : (
            <>
              <span className="demo-tag">DEMO</span>
              <span>
                {mode === "local"
                  ? "Fictional sample data · Saved in this browser only"
                  : "Fictional shared workspace · Roles are simulated"}
              </span>
              <button
                onClick={() =>
                  mode === "local"
                    ? setModal("login")
                    : safely(() => {
                        navigator.clipboard.writeText(
                          `${location.origin}${location.pathname}#/dashboard?room=${room}`,
                        );
                        toast.success("Shared demo link copied");
                      })
                }
              >
                {mode === "local" ? "Start shared demo" : "Copy workspace link"}
                <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
        {connectionError && (
          <div role="alert" className="error-banner">
            {connectionError}{" "}
            <button onClick={() => safely(() => refresh())}>
              Retry connection
            </button>
          </div>
        )}
        <main className="page">
          <div className="heading">
            <div>
              <p className="eyebrow">
                {route === "element"
                  ? "DIGITAL PRODUCTION PASSPORT"
                  : route === "dashboard"
                    ? "YOUR PLANT, CONNECTED"
                    : "NORTH PLANT · OPERATIONS"}
              </p>
              <h1>
                {route === "element"
                  ? current?.serial || "Element not found"
                  : route === "project"
                    ? s.projects.find((p) => p.id === selected)?.name ||
                      "Project"
                    : pageTitle}
              </h1>
              <p className="muted">
                {route === "dashboard"
                  ? "Every element. Every milestone. One clear picture."
                  : route === "element"
                    ? currentProject?.name
                    : route === "board"
                      ? "A live view of work moving through the plant."
                      : route === "qc"
                        ? "Inspect with confidence. Keep every decision traceable."
                        : route === "shipping"
                          ? "From final acceptance to delivery confirmation."
                          : route === "reports"
                            ? "Production records, ready to share."
                            : route === "admin"
                              ? "Workspace access, production workflow, and demonstration tools."
                              : "Plan projects and track every physical piece."}
              </p>
            </div>
            <div className="heading-actions">
              <button className="btn" onClick={() => setModal("scan")}>
                <ScanLine size={18} />
                Scan element
              </button>
              {canManage && ["projects", "dashboard"].includes(route) && (
                <button
                  className="btn primary"
                  onClick={() => setModal("project")}
                >
                  <Plus size={17} />
                  New project
                </button>
              )}
              {route === "project" && canManage && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setProjectFilter(selected);
                    setModal("elements");
                  }}
                >
                  <Plus size={17} />
                  Add elements
                </button>
              )}
            </div>
          </div>
          {!ready ? (
            <div className="metrics">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <>
              {route === "dashboard" && (
                <>
                  <div className="metrics">
                    {[
                      [
                        Factory,
                        s.elements.length,
                        "Tracked elements",
                        "Across " + s.projects.length + " projects",
                        "all",
                      ],
                      [
                        AlertTriangle,
                        holds.length,
                        "QC holds",
                        "Requires your attention",
                        "hold",
                      ],
                      [
                        Package,
                        readyShip.length,
                        "Ready to ship",
                        "QC accepted & released",
                        "Yard",
                      ],
                      [
                        Truck,
                        s.elements.filter((e) => e.stage === "Shipped").length,
                        "In transit",
                        s.elements.filter((e) => e.stage === "Received")
                          .length + " received at jobsite",
                        "Shipped",
                      ],
                    ].map(([Icon, n, label, sub, stage]: any) => (
                      <button
                        className={`metric ${stage === "hold" ? "warning-metric" : ""}`}
                        key={label}
                        onClick={() => {
                          setStageFilter(stage);
                          setProjectFilter("all");
                          nav("projects");
                        }}
                      >
                        <Icon size={20} />
                        <strong>{n}</strong>
                        <span>{label}</span>
                        <small>{sub}</small>
                        <ArrowUpRight className="metric-arrow" size={16} />
                      </button>
                    ))}
                  </div>
                  <section className="panel pipeline-panel">
                    <div className="section-head">
                      <div>
                        <h2>Production pipeline</h2>
                        <p className="muted">
                          {
                            s.elements.filter(
                              (e) =>
                                ![
                                  "Engineering",
                                  "Yard",
                                  "Loaded",
                                  "Shipped",
                                  "Received",
                                ].includes(e.stage),
                            ).length
                          }{" "}
                          elements moving through the plant
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => nav("board")}
                      >
                        View production board <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="pipeline">
                      {STAGES.slice(0, 8).map((stage, i) => {
                        const n = s.elements.filter(
                          (e) => e.stage === stage,
                        ).length;
                        return (
                          <button
                            key={stage}
                            onClick={() => {
                              setStageFilter(stage);
                              nav("projects");
                            }}
                          >
                            <div className="pipeline-label">
                              <span className="stage-index">0{i + 1}</span>
                              <ChevronRight size={14} />
                            </div>
                            <strong>{n.toString().padStart(2, "0")}</strong>
                            <span>{stage}</span>
                            <div className="pipe-track">
                              <div
                                style={{
                                  width: `${Math.max((n / s.elements.length) * 500, 8)}%`,
                                  background: STAGE_COLORS[i],
                                }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="pipeline-summary">
                      <span>
                        <CalendarDays size={14} />
                        {
                          s.elements.filter((e) => e.scheduled === today())
                            .length
                        }{" "}
                        scheduled today
                      </span>
                      <span>
                        <Layers3 size={14} />
                        {
                          s.events.filter(
                            (e) =>
                              e.type === "Record concrete placement" &&
                              e.at.slice(0, 10) === today(),
                          ).length
                        }{" "}
                        poured today
                      </span>
                      <span>
                        <Clock3 size={14} />
                        {
                          s.elements.filter((e) => e.stage === "Ready to strip")
                            .length
                        }{" "}
                        awaiting stripping
                      </span>
                    </div>
                  </section>
                  <div className="section-head">
                    <h2>
                      Active projects{" "}
                      <span className="count">{s.projects.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setStageFilter("all");
                        setProjectFilter("all");
                        nav("projects");
                      }}
                    >
                      All projects <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="project-grid">
                    {s.projects.slice(0, 3).map((p, i) => {
                      const es = s.elements.filter((e) => e.projectId === p.id);
                      const complete = es.filter((e) =>
                        ["Yard", "Loaded", "Shipped", "Received"].includes(
                          e.stage,
                        ),
                      ).length;
                      return (
                        <button
                          className="panel project-card"
                          key={p.id}
                          onClick={() => nav("project", p.id)}
                        >
                          <div className="project-card-top">
                            <span className={`project-icon p${i}`}>
                              <FolderKanban size={20} />
                            </span>
                            <Pill>In progress</Pill>
                          </div>
                          <p className="project-number">{p.number}</p>
                          <h3>{p.name}</h3>
                          <p className="muted">
                            <MapPin size={13} />
                            {p.location}
                          </p>
                          <div className="project-progress-label">
                            <span>
                              {complete} of {es.length} QC accepted
                            </span>
                            <strong>
                              {es.length
                                ? Math.round((complete / es.length) * 100)
                                : 0}
                              %
                            </strong>
                          </div>
                          <Progress
                            value={es.length ? (complete / es.length) * 100 : 0}
                          />
                          <div className="project-footer">
                            <span>{es.length} elements</span>
                            <ArrowUpRight size={18} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="dashboard-bottom">
                    <section className="panel attention">
                      <div className="section-head">
                        <h2>Needs attention</h2>
                        <Pill tone="amber">{holds.length} holds</Pill>
                      </div>
                      {holds.slice(0, 3).map((e) => (
                        <button
                          key={e.id}
                          className="attention-row"
                          onClick={() => openElement(e)}
                        >
                          <span className="alert-icon">
                            <AlertTriangle size={18} />
                          </span>
                          <div>
                            <strong>{e.serial}</strong>
                            <p>
                              {
                                s.defects.find(
                                  (d) =>
                                    d.elementId === e.id &&
                                    d.status !== "Accepted",
                                )?.description
                              }
                            </p>
                          </div>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                      {!holds.length && (
                        <Empty
                          title="All clear"
                          body="No elements are currently on hold."
                        />
                      )}
                    </section>
                    <section className="panel activity">
                      <div className="section-head">
                        <h2>Recent activity</h2>
                        <span className="live-label">Live workspace</span>
                      </div>
                      {recent.map((ev) => {
                        const el = s.elements.find(
                          (e) => e.id === ev.elementId,
                        );
                        return (
                          <button
                            className="activity-row"
                            key={ev.id}
                            onClick={() => el && openElement(el)}
                          >
                            <span
                              className={`activity-dot ${ev.result === "Hold" ? "red" : ""}`}
                            />
                            <div>
                              <strong>{el?.serial}</strong>{" "}
                              {ev.type.toLowerCase()}
                              <p>
                                {ev.user} ·{" "}
                                {new Date(ev.at).toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <ChevronRight size={14} />
                          </button>
                        );
                      })}
                    </section>
                  </div>
                </>
              )}
              {["projects", "project"].includes(route) && (
                <>
                  {route === "projects" && (
                    <div className="project-list">
                      {s.projects.map((p) => (
                        <button
                          className={`project-tab ${projectFilter === p.id ? "active" : ""}`}
                          key={p.id}
                          onClick={() => {
                            setProjectFilter(
                              projectFilter === p.id ? "all" : p.id,
                            );
                          }}
                        >
                          <FolderKanban size={18} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {p.number} ·{" "}
                              {
                                s.elements.filter((e) => e.projectId === p.id)
                                  .length
                              }{" "}
                              elements
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {route === "project" && (
                    <div className="panel project-info">
                      {Object.entries(
                        s.projects.find((p) => p.id === selected) || {},
                      )
                        .filter(([k]) =>
                          [
                            "number",
                            "client",
                            "contractor",
                            "location",
                            "manager",
                            "start",
                            "delivery",
                            "plant",
                            "description",
                          ].includes(k),
                        )
                        .map(([k, v]) => (
                          <div key={k}>
                            <span>{k.replace("number", "Project number")}</span>
                            <strong>{v || "—"}</strong>
                          </div>
                        ))}
                    </div>
                  )}
                  <section className="panel flush">
                    <div className="section-head padded">
                      <h2>
                        Element register{" "}
                        <span className="count">
                          {route === "project"
                            ? s.elements.filter((e) => e.projectId === selected)
                                .length
                            : filtered.length}
                        </span>
                      </h2>
                      <div className="inline-actions">
                        <button
                          className="text-button"
                          onClick={() =>
                            safely(() =>
                              printLabels(
                                s,
                                route === "project"
                                  ? s.elements.filter(
                                      (e) => e.projectId === selected,
                                    )
                                  : filtered,
                                room,
                              ),
                            )
                          }
                        >
                          <Printer size={16} />
                          Batch labels
                        </button>
                        {canManage && (
                          <button
                            className="text-button"
                            onClick={() => setModal("elements")}
                          >
                            <Plus size={16} />
                            Add elements
                          </button>
                        )}
                      </div>
                    </div>
                    {filters()}
                    {table(
                      route === "project"
                        ? filtered.filter((e) => e.projectId === selected)
                        : filtered,
                    )}
                  </section>
                </>
              )}
              {route === "board" && (
                <>
                  {filters()}
                  <div className="board">
                    {[
                      ["Engineering", "Forming", "Pre-pour QC"],
                      ["Ready to pour"],
                      ["Curing", "Ready to strip"],
                      ["Post-pour QC"],
                      ["Yard", "Loaded"],
                      ["Shipped", "Received"],
                    ].map((stages, i) => {
                      const es = filtered.filter((e) =>
                        stages.includes(e.stage),
                      );
                      return (
                        <section className="board-column" key={i}>
                          <h2>
                            <span style={{ background: STAGE_COLORS[i + 1] }} />
                            {
                              [
                                "Forming",
                                "Ready to pour",
                                "Curing & stripping",
                                "Quality control",
                                "Ready to ship",
                                "Delivery",
                              ][i]
                            }
                            <b>{es.length}</b>
                          </h2>
                          {es.map((e) => (
                            <button
                              className={`board-card ${e.hold ? "held" : ""}`}
                              key={e.id}
                              onClick={() => openElement(e)}
                            >
                              <div>
                                <strong>{e.serial}</strong>
                                <QrCode size={15} />
                              </div>
                              <p>
                                {
                                  s.projects.find((p) => p.id === e.projectId)
                                    ?.name
                                }
                              </p>
                              <Status e={e} />
                              <footer>
                                <span>
                                  <MapPin size={12} />
                                  {e.location}
                                </span>
                                <span>
                                  <CalendarDays size={12} />
                                  {niceDate(e.scheduled)}
                                </span>
                              </footer>
                            </button>
                          ))}
                          {!es.length && (
                            <p className="board-empty">
                              No elements at this stage
                            </p>
                          )}
                        </section>
                      );
                    })}
                  </div>
                  <p className="muted board-note">
                    <ShieldCheck size={15} />
                    Open a passport to advance an element. Required inspections
                    and holds are checked for every transition.
                  </p>
                </>
              )}
              {route === "element" && current && (
                <>
                  <div className="passport-layout">
                    <div>
                      <section className="panel passport-summary">
                        <div className="section-head">
                          <div className="inline-actions">
                            <Status e={current} />
                            <Pill>{current.type}</Pill>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => setModal("qr")}
                          >
                            <QrCode size={17} />
                            Production label
                          </button>
                        </div>
                        {current.hold && (
                          <div className="hold-banner">
                            <AlertTriangle size={21} />
                            <div>
                              <strong>QC hold · Progression blocked</strong>
                              <p>
                                Corrective action and QC Manager reinspection
                                are required.
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="spec-grid">
                          {[
                            ["Element mark", current.mark],
                            ["Unique serial", current.serial],
                            ["Dimensions", current.dimensions],
                            [
                              "Shop drawing",
                              `${current.drawing} · Rev ${current.revision}`,
                            ],
                            ["Mix design", current.mix],
                            [
                              "Specified strength",
                              `${current.strength.toLocaleString()} psi`,
                            ],
                            ["Scheduled pour", niceDate(current.scheduled)],
                            ["Required delivery", niceDate(current.delivery)],
                            ["Current location", current.location],
                            ["Production area", current.area],
                            [
                              "Release strength",
                              `${current.releaseStrength} psi`,
                            ],
                            [
                              "Shipping strength",
                              `${current.shippingStrength} psi`,
                            ],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <span>{k}</span>
                              <strong>{v}</strong>
                            </div>
                          ))}
                        </div>
                        {current.batchId && (
                          <div className="batch-link">
                            <Layers3 size={17} />
                            <span>
                              Batch <strong>{current.batchId}</strong> ·{" "}
                              {
                                s.elements.filter(
                                  (e) => e.batchId === current.batchId,
                                ).length
                              }{" "}
                              linked pieces
                            </span>
                            <button
                              className="text-button"
                              onClick={() => {
                                nav("projects");
                                setQuery(current.batchId!);
                                setStageFilter("all");
                                setProjectFilter("all");
                              }}
                            >
                              View batch
                            </button>
                          </div>
                        )}
                      </section>
                      <section className="panel">
                        <div className="section-head">
                          <h2>
                            Production history{" "}
                            <span className="count">
                              {
                                s.events.filter(
                                  (e) => e.elementId === current.id,
                                ).length
                              }
                            </span>
                          </h2>
                          <button
                            className="text-button"
                            onClick={() =>
                              safely(() => {
                                const r = reportData(
                                  s,
                                  "Element traceability",
                                  current.id,
                                );
                                printReport(
                                  current.serial + " · Traceability",
                                  r.headers,
                                  r.rows,
                                );
                              })
                            }
                          >
                            <Printer size={15} />
                            Export
                          </button>
                        </div>
                        <div className="timeline">
                          {s.events
                            .filter((e) => e.elementId === current.id)
                            .sort((a, b) => b.at.localeCompare(a.at))
                            .map((ev) => (
                              <details
                                key={ev.id}
                                className={`timeline-item ${ev.result === "Hold" ? "held" : ""}`}
                              >
                                <summary>
                                  <span className="timeline-icon">
                                    {ev.result === "Hold" ? (
                                      <AlertTriangle size={15} />
                                    ) : (
                                      <Check size={15} />
                                    )}
                                  </span>
                                  <div>
                                    <div className="timeline-title">
                                      <strong>{ev.type}</strong>
                                      <Pill
                                        tone={
                                          ev.result === "Hold"
                                            ? "red"
                                            : ev.result === "Pending QC"
                                              ? "amber"
                                              : "green"
                                        }
                                      >
                                        {ev.result}
                                      </Pill>
                                    </div>
                                    <p>
                                      {new Date(ev.at).toLocaleString()} ·{" "}
                                      {ev.user}
                                    </p>
                                    <span className="timeline-role">
                                      {ev.role} · Drawing rev {ev.revision}
                                    </span>
                                  </div>
                                  <ChevronRight size={15} />
                                </summary>
                                <div className="timeline-details">
                                  {ev.comments && <p>{ev.comments}</p>}
                                  <dl>
                                    {Object.entries(ev.details).map(
                                      ([k, v]) => (
                                        <div key={k}>
                                          <dt>
                                            {k.replace(/([A-Z])/g, " $1")}
                                          </dt>
                                          <dd>{v}</dd>
                                        </div>
                                      ),
                                    )}
                                  </dl>
                                  {ev.photo && (
                                    <img
                                      src={ev.photo}
                                      alt={`Attachment to ${ev.type}`}
                                      className="event-photo"
                                    />
                                  )}
                                  <small>Event {ev.id}</small>
                                </div>
                              </details>
                            ))}
                        </div>
                      </section>
                    </div>
                    <div>
                      <section className="panel action-panel">
                        <p className="eyebrow">NEXT ON THIS ELEMENT</p>
                        <h2>Record an activity</h2>
                        <p className="muted">
                          Available to {actor.role.toLowerCase()}
                        </p>
                        <div className="passport-actions">
                          {availableActions(current, actor.role).map(
                            ([key, a]) => (
                              <button
                                key={key}
                                className={`btn ${["defect", "correction", "curing"].includes(key) ? "" : "primary"}`}
                                onClick={() => {
                                  setAction(key);
                                  setModal("event");
                                }}
                              >
                                {key === "defect" ? (
                                  <AlertTriangle size={17} />
                                ) : (
                                  <ClipboardCheck size={17} />
                                )}
                                <span>{a.label}</span>
                                <ChevronRight size={16} />
                              </button>
                            ),
                          )}
                          {!availableActions(current, actor.role).length && (
                            <p className="muted">
                              No actions for your role at this stage.
                            </p>
                          )}
                        </div>
                        {mode !== "production" && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setAuthRole(actor.role);
                              setModal("login");
                            }}
                          >
                            Switch demonstration role <ArrowRight size={14} />
                          </button>
                        )}
                      </section>
                      <section className="panel">
                        <h2>Quality records</h2>
                        {s.defects
                          .filter((d) => d.elementId === current.id)
                          .map((d) => (
                            <div className="defect-card" key={d.id}>
                              <Pill
                                tone={d.status === "Accepted" ? "green" : "red"}
                              >
                                {d.status}
                              </Pill>
                              <h4>{d.description}</h4>
                              <p>{d.corrective}</p>
                              <small>
                                {d.severity} · {d.inspector}
                                <br />
                                {new Date(d.discovered).toLocaleString()}
                              </small>
                              {d.photo && (
                                <img
                                  src={d.photo}
                                  alt="Defect photograph"
                                  className="event-photo"
                                />
                              )}
                            </div>
                          ))}
                        {!s.defects.some((d) => d.elementId === current.id) && (
                          <div className="clear-record">
                            <ShieldCheck size={26} />
                            <p>No defects recorded</p>
                          </div>
                        )}
                      </section>
                      <div className="passport-id">
                        <QrCode size={17} />
                        <span>
                          Permanent element ID
                          <br />
                          <small>{current.id}</small>
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {route === "element" && !current && (
                <Empty
                  title="Element not found"
                  body="Open the original shared workspace link or look up the element by serial number."
                />
              )}
              {route === "qc" && (
                <>
                  <div className="qc-summary">
                    <div className="notice amber">
                      <AlertTriangle size={20} />
                      <span>
                        <strong>{holds.length} elements on hold</strong> ·{" "}
                        {
                          s.defects.filter((d) => d.status === "Repaired")
                            .length
                        }{" "}
                        awaiting reinspection
                      </span>
                    </div>
                    <button
                      className="btn"
                      onClick={() => {
                        setReport("QC holds");
                        nav("reports");
                      }}
                    >
                      <Download size={16} />
                      QC hold report
                    </button>
                  </div>
                  <Tabs defaultValue="holds">
                    <TabsList>
                      <TabsTrigger value="holds">
                        Active holds ({holds.length})
                      </TabsTrigger>
                      <TabsTrigger value="inspect">
                        Awaiting inspection
                      </TabsTrigger>
                      <TabsTrigger value="repairs">Repair register</TabsTrigger>
                    </TabsList>
                    <TabsContent value="holds">
                      <section className="panel flush">{table(holds)}</section>
                    </TabsContent>
                    <TabsContent value="inspect">
                      <section className="panel flush">
                        {table(
                          s.elements.filter((e) =>
                            ["Pre-pour QC", "Post-pour QC", "Curing"].includes(
                              e.stage,
                            ),
                          ),
                        )}
                      </section>
                    </TabsContent>
                    <TabsContent value="repairs">
                      <section className="panel flush">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {[
                                "Element",
                                "Defect",
                                "Disposition",
                                "Corrective action",
                              ].map((x) => (
                                <TableHead key={x}>{x}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {s.defects.map((d) => (
                              <TableRow key={d.id}>
                                <TableCell>
                                  <button
                                    className="serial-link"
                                    onClick={() => nav("element", d.elementId)}
                                  >
                                    {
                                      s.elements.find(
                                        (e) => e.id === d.elementId,
                                      )?.serial
                                    }
                                  </button>
                                </TableCell>
                                <TableCell>{d.description}</TableCell>
                                <TableCell>
                                  <Pill
                                    tone={
                                      d.status === "Accepted"
                                        ? "green"
                                        : "amber"
                                    }
                                  >
                                    {d.status}
                                  </Pill>
                                </TableCell>
                                <TableCell>{d.corrective}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </section>
                    </TabsContent>
                  </Tabs>
                </>
              )}
              {route === "shipping" && (
                <Tabs defaultValue="yard">
                  <div className="section-head">
                    <TabsList>
                      <TabsTrigger value="yard">
                        Yard inventory ({readyShip.length})
                      </TabsTrigger>
                      <TabsTrigger value="shipments">
                        Shipments ({s.shipments.length})
                      </TabsTrigger>
                    </TabsList>
                    {allowed(actor.role, [
                      "Shipping Coordinator",
                      "Production Supervisor",
                    ]) && (
                      <button
                        className="btn primary"
                        onClick={() => setModal("shipment")}
                      >
                        <Plus size={16} />
                        Create shipment
                      </button>
                    )}
                  </div>
                  <TabsContent value="yard">
                    <section className="panel flush">
                      {table(s.elements.filter((e) => e.stage === "Yard"))}
                    </section>
                  </TabsContent>
                  <TabsContent value="shipments">
                    <div className="shipment-grid">
                      {s.shipments.map((sh) => (
                        <section className="panel shipment-card" key={sh.id}>
                          <div className="section-head">
                            <h2>{sh.number}</h2>
                            <Pill>{sh.status}</Pill>
                          </div>
                          <p>
                            <Truck size={17} />
                            {sh.carrier} · {sh.trailer}
                          </p>
                          <p>
                            <MapPin size={17} />
                            {sh.destination}
                          </p>
                          <div className="shipment-elements">
                            {sh.elements.map((id) => (
                              <button
                                key={id}
                                onClick={() => nav("element", id)}
                              >
                                {s.elements.find((e) => e.id === id)?.serial}
                                <ArrowUpRight size={12} />
                              </button>
                            ))}
                          </div>
                          <div className="inline-actions">
                            <button
                              className="btn"
                              onClick={() => safely(() => manifest(s, sh))}
                            >
                              <Printer size={15} />
                              Manifest / PDF
                            </button>
                            {((["Planned", "Loaded"].includes(sh.status) &&
                              allowed(actor.role, ["Shipping Coordinator"])) ||
                              (sh.status === "Shipped" &&
                                allowed(actor.role, [
                                  "Receiving User",
                                  "Shipping Coordinator",
                                ]))) && (
                              <button
                                className="btn primary"
                                onClick={() => {
                                  setLoadShipment(sh);
                                  setShipmentAction(
                                    sh.status === "Planned"
                                      ? "load"
                                      : sh.status === "Loaded"
                                        ? "depart"
                                        : "receiveShipment",
                                  );
                                  setModal("shipmentAction");
                                }}
                              >
                                {sh.status === "Planned"
                                  ? "Confirm loading"
                                  : sh.status === "Loaded"
                                    ? "Record departure"
                                    : "Confirm receipt"}
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
              {route === "reports" && (
                <>
                  <section className="panel">
                    <div className="report-controls">
                      <Field label="Report">
                        <Pick
                          value={report}
                          onChange={setReport}
                          options={[
                            "Project production",
                            "Daily production",
                            "QC holds",
                            "Element traceability",
                            "Shipping",
                          ]}
                        />
                      </Field>
                      {report === "Element traceability" && (
                        <Field label="Element">
                          <Pick
                            value={reportElement}
                            onChange={setReportElement}
                            options={s.elements.map((e) => ({
                              value: e.id,
                              label: e.serial,
                            }))}
                          />
                        </Field>
                      )}
                      {["Daily production", "Element traceability"].includes(
                        report,
                      ) && (
                        <>
                          <Field label="From">
                            <Input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                            />
                          </Field>
                          <Field label="Through">
                            <Input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                            />
                          </Field>
                        </>
                      )}
                      <div className="inline-actions">
                        <button
                          className="btn"
                          onClick={() => {
                            const r = reportData(
                              s,
                              report,
                              reportElement,
                              dateFrom,
                              dateTo,
                            );
                            csv(
                              `${report.replaceAll(" ", "-")}.csv`,
                              r.headers,
                              r.rows,
                            );
                          }}
                        >
                          <Download size={16} />
                          CSV
                        </button>
                        <button
                          className="btn primary"
                          onClick={() =>
                            safely(() => {
                              const r = reportData(
                                s,
                                report,
                                reportElement,
                                dateFrom,
                                dateTo,
                              );
                              printReport(report, r.headers, r.rows);
                            })
                          }
                        >
                          <Printer size={16} />
                          Print / PDF
                        </button>
                      </div>
                    </div>
                    <p className="muted">
                      Use “Save as PDF” in your browser print dialog. Reports
                      reflect recorded workspace data.
                    </p>
                  </section>
                  <section className="panel flush">
                    <div className="section-head padded">
                      <h2>{report} report</h2>
                      <Pill>
                        {
                          reportData(s, report, reportElement, dateFrom, dateTo)
                            .rows.length
                        }{" "}
                        records
                      </Pill>
                    </div>
                    <div className="table-wrap">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {reportData(
                              s,
                              report,
                              reportElement,
                              dateFrom,
                              dateTo,
                            ).headers.map((h) => (
                              <TableHead key={h}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData(
                            s,
                            report,
                            reportElement,
                            dateFrom,
                            dateTo,
                          ).rows.map((r, i) => (
                            <TableRow key={i}>
                              {r.map((v, j) => (
                                <TableCell key={j}>{String(v ?? "")}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </>
              )}
              {route === "admin" && (
                <div className="admin-grid">
                  <section className="panel">
                    <h2>Workspace & access</h2>
                    <p className="section-copy">
                      {mode === "production"
                        ? "Email and password sign-in is provided by Supabase. Access is checked on the server for each request."
                        : "Demonstration roles use fictional identities. They are separate from verified production accounts."}
                    </p>
                    <div className="settings-row">
                      <span>Current mode</span>
                      <Pill>
                        {mode === "local"
                          ? "Browser-local demo"
                          : mode === "shared"
                            ? "Shared demo"
                            : "Production"}
                      </Pill>
                    </div>
                    <div className="settings-row">
                      <span>Your role</span>
                      <strong>{actor.role}</strong>
                    </div>
                    <button className="btn" onClick={() => setModal("login")}>
                      {mode === "production"
                        ? "Manage session"
                        : "Switch role / sign in"}
                    </button>
                    {mode === "production" &&
                      actor.role === "Administrator" && (
                        <>
                          <h3 className="subheading">Plant members</h3>
                          {members.map((m) => (
                            <div className="settings-row" key={m.email}>
                              <span>{m.email}</span>
                              <small>{m.role}</small>
                            </div>
                          ))}
                          <form
                            onSubmit={async (ev) => {
                              ev.preventDefault();
                              const f = Object.fromEntries(
                                new FormData(ev.currentTarget),
                              );
                              await safely(async () => {
                                await api({ action: "member", ...f });
                                toast.success("Plant access updated");
                                await refresh();
                              });
                            }}
                          >
                            <div className="form-grid">
                              <TextField
                                label="Verified account email"
                                name="email"
                                type="email"
                                required
                              />
                              <Field label="Role">
                                <Pick name="role" options={[...ROLES]} />
                              </Field>
                            </div>
                            <Submit busy={busy} label="Save plant member" />
                          </form>
                        </>
                      )}
                  </section>
                  <section className="panel">
                    <h2>Production workflow</h2>
                    <p className="section-copy">
                      Core QC approvals, strength verification and shipping
                      gates remain required. Configure supporting activities for
                      this plant.
                    </p>
                    <div className="settings-row">
                      <div>
                        <strong>Formwork activity</strong>
                        <p className="muted">
                          Require a separate production readiness record
                        </p>
                      </div>
                      <Checkbox
                        aria-label="Require separate formwork activity"
                        disabled={actor.role !== "Administrator"}
                        checked={
                          !s.settings.optionalStages.includes(
                            "Formwork Prepared",
                          )
                        }
                        onCheckedChange={(checked) =>
                          command("settings", {
                            optionalStages: checked
                              ? []
                              : ["Formwork Prepared"],
                          })
                        }
                      />
                    </div>
                    <div className="notice">
                      <ShieldCheck size={20} />
                      <span>
                        Pre-pour QC, release strength, final acceptance, and
                        hold clearance cannot be bypassed.
                      </span>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Data & demonstration</h2>
                    <p className="section-copy">
                      {mode === "local"
                        ? "Records are saved on this browser. A phone cannot see newly created local records. Start a shared demo for cross-device scanning."
                        : mode === "shared"
                          ? "Share a QR or workspace link to use the same fictional records on another device. Anyone with the link can join simulated roles."
                          : "Records are stored in the connected plant database."}
                    </p>
                    <div className="stack-actions">
                      <button
                        className="btn"
                        onClick={() =>
                          download(
                            "PrecastFlow-records.json",
                            JSON.stringify(s, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} />
                        Export complete workspace
                      </button>
                      {mode !== "production" &&
                        actor.role === "Administrator" && (
                          <button
                            className="btn danger"
                            onClick={() => setReset(true)}
                          >
                            <RefreshCw size={16} />
                            Reset demonstration data
                          </button>
                        )}
                      <button className="btn" onClick={() => setModal("guide")}>
                        <BookOpen size={16} />
                        Open demonstration guide
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Quality workflow references</h2>
                    <p className="section-copy">
                      PrecastFlow supports your documented quality program. It
                      does not certify a plant or establish specification
                      compliance.
                    </p>
                    <div className="source-links">
                      <a
                        href="https://precast.org/wp-content/uploads/020124_QualityControlManual_17th_Edition.pdf"
                        target="_blank"
                        rel="noreferrer"
                      >
                        NPCA Quality Control Manual ↗
                      </a>
                      <a
                        href="https://www.fhwa.dot.gov/pavement/materials/hif13045.pdf"
                        target="_blank"
                        rel="noreferrer"
                      >
                        FHWA precast acceptance guidance ↗
                      </a>
                      <a
                        href="https://www.pci.org/certification"
                        target="_blank"
                        rel="noreferrer"
                      >
                        PCI certification overview ↗
                      </a>
                      <a
                        href="https://www.txdot.gov/manuals/brg/crm/chapter-1--introduction/section-5--repair-procedure-submission-and-approva.html"
                        target="_blank"
                        rel="noreferrer"
                      >
                        TxDOT repair approval guidance ↗
                      </a>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              PrecastFlow <span> / </span> From Shop Drawing to Jobsite.
            </span>
            <span>
              {mode === "production"
                ? "Connected plant workspace"
                : "Fictional demonstration data"}{" "}
              · {new Date().getFullYear()}
            </span>
          </footer>
        </main>
      </SidebarInset>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) setModal("");
        }}
      >
        <DialogContent
          className={`flow-dialog ${["event", "project", "elements", "shipment", "guide"].includes(modal) ? "wide-dialog" : ""}`}
        >
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    login: "Welcome to PrecastFlow",
                    project: "Create a project",
                    elements: "Create serialized elements",
                    event: ACTIONS[action]?.label,
                    qr: "Production label",
                    scan: "Scan an element",
                    shipment: "Create shipment",
                    shipmentAction:
                      shipmentAction === "load"
                        ? "Confirm loading"
                        : shipmentAction === "depart"
                          ? "Record departure"
                          : "Confirm jobsite receipt",
                    guide: "From shop drawing to jobsite",
                  } as Record<string, string>
                )[modal]
              }
            </DialogTitle>
            <DialogDescription>
              {modal === "event"
                ? `${current?.serial} · ${currentProject?.name}`
                : modal === "login"
                  ? "Choose a demonstration role or sign in to your connected plant."
                  : modal === "scan"
                    ? "Point your camera at the production label, or enter a serial number."
                    : modal === "qr"
                      ? `${current?.serial} · ${currentProject?.number}`
                      : modal === "guide"
                        ? "A complete walkthrough using the controls in this workspace."
                        : "Changes are saved to your current workspace."}
            </DialogDescription>
          </DialogHeader>
          {modal === "login" && (
            <Tabs defaultValue="demo">
              <TabsList className="w-full">
                <TabsTrigger value="demo">Demonstration</TabsTrigger>
                <TabsTrigger value="production">Production sign-in</TabsTrigger>
              </TabsList>
              <TabsContent value="demo">
                <div className="login-emblem">
                  <Layers3 size={30} />
                  <div>
                    <strong>Explore your connected plant.</strong>
                    <p>48 fictional elements. A complete production journey.</p>
                  </div>
                </div>
                <Field label="Demonstration role">
                  <Pick
                    value={authRole}
                    onChange={(v) => setAuthRole(v as Role)}
                    options={[...ROLES]}
                  />
                </Field>
                <p className="section-copy">
                  Shared demos persist across devices. Roles are simulated and
                  do not provide access to production data.
                </p>
                {STATIC_DEMO ? (
                  <a className="btn primary w-full" href={SHARED_URL}>
                    Open shared demonstration <ArrowUpRight size={16} />
                  </a>
                ) : (
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await join(
                          authRole,
                          mode === "shared" ? room : undefined,
                        );
                        setModal("");
                        toast.success("Shared demo connected");
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Wifi size={16} />
                    )}{" "}
                    {mode === "shared"
                      ? "Use selected demo role"
                      : "Start shared demonstration"}
                  </Button>
                )}
                <button
                  className="local-option"
                  onClick={() => {
                    localStorage.removeItem("precastflow-session");
                    activeSession.current = null;
                    versionRef.current = 0;
                    pending.current = null;
                    setSession(null);
                    const name =
                      authRole === "QC Manager"
                        ? "Sam Rivera"
                        : authRole === "QC Technician"
                          ? "Jamie Chen"
                          : authRole === "Receiving User"
                            ? "Morgan Davis"
                            : "Alex Morgan";
                    setActor({ name, role: authRole });
                    const saved = localStorage.getItem("precastflow-local");
                    setS(saved ? JSON.parse(saved) : seed());
                    setConnectionError("");
                    setModal("");
                    toast.success("Browser-local demonstration active");
                  }}
                >
                  Continue in this browser only <ArrowRight size={14} />
                </button>
              </TabsContent>
              <TabsContent value="production">
                <form
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    setBusy(true);
                    try {
                      const d = Object.fromEntries(
                        new FormData(ev.currentTarget),
                      );
                      const r = await api({ action: "login", ...d }, null);
                      const sess = {
                        token: r.token,
                        room: r.room,
                        actor: r.actor,
                      };
                      localStorage.setItem(
                        "precastflow-session",
                        JSON.stringify(sess),
                      );
                      activeSession.current = sess;
                      versionRef.current = 0;
                      setSession(sess);
                      await refresh(sess);
                      setModal("");
                      toast.success("Signed in to your plant");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="form-grid single">
                    <TextField
                      label="Work email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                    />
                    <TextField
                      label="Password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Submit busy={busy} label="Sign in to plant" />
                  <p className="section-copy">
                    Your administrator must connect Supabase authentication and
                    add your verified account to the plant. No production
                    credentials are built into this demonstration.
                  </p>
                </form>
              </TabsContent>
              {session && (
                <button
                  className="text-button signout"
                  onClick={() => {
                    localStorage.removeItem("precastflow-session");
                    activeSession.current = null;
                    versionRef.current = 0;
                    pending.current = null;
                    setSession(null);
                    setS(seed());
                    setActor({ name: "Alex Morgan", role: "Administrator" });
                    setConnectionError("");
                    setModal("");
                    nav("dashboard");
                  }}
                >
                  <LogOut size={15} />
                  End connected session
                </button>
              )}
            </Tabs>
          )}
          {modal === "project" && (
            <form
              onSubmit={async (ev) => {
                ev.preventDefault();
                const d = Object.fromEntries(new FormData(ev.currentTarget));
                await command("project", d);
              }}
            >
              <div className="form-grid">
                {[
                  ["Project name", "name"],
                  ["Client", "client"],
                  ["General contractor", "contractor"],
                  ["Project location", "location"],
                  ["Precast plant", "plant"],
                  ["Project manager", "manager"],
                ].map(([label, name]) => (
                  <TextField
                    key={name}
                    label={label}
                    name={name}
                    defaultValue={
                      name === "plant"
                        ? "North plant"
                        : name === "manager"
                          ? actor.name
                          : ""
                    }
                    required={["name", "client", "location"].includes(name)}
                  />
                ))}
                <TextField
                  label="Expected production start"
                  name="start"
                  type="date"
                  defaultValue={today()}
                />
                <TextField
                  label="Anticipated shipment"
                  name="delivery"
                  type="date"
                />
                <Field label="Project description" wide>
                  <Textarea name="description" rows={3} />
                </Field>
              </div>
              <div className="form-footer">
                <span className="muted">
                  A unique project number is assigned automatically.
                </span>
                <Submit busy={busy} label="Create project" />
              </div>
            </form>
          )}
          {modal === "elements" && (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                command(
                  "elements",
                  Object.fromEntries(new FormData(ev.currentTarget)),
                );
              }}
            >
              <div className="form-grid">
                <Field label="Project">
                  <Pick
                    name="projectId"
                    value={projectFilter === "all" ? undefined : projectFilter}
                    onChange={setProjectFilter}
                    options={s.projects.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                </Field>
                <TextField
                  label="Element mark"
                  name="mark"
                  placeholder="P-101"
                  required
                />
                <Field label="Element type">
                  <Pick
                    name="type"
                    options={[
                      "Wall panel",
                      "Bridge beam",
                      "Column",
                      "Double tee",
                      "Box culvert",
                      "Utility vault",
                      "Barrier",
                      "Manhole",
                      "Architectural panel",
                    ]}
                  />
                </Field>
                <TextField
                  label="Quantity of physical pieces"
                  name="quantity"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={3}
                  required
                />
                <TextField
                  label="Dimensions"
                  name="dimensions"
                  placeholder="24′ × 10′ × 8″"
                  required
                />
                <TextField
                  label="Specified compressive strength (psi)"
                  name="strength"
                  type="number"
                  defaultValue={5000}
                  required
                />
                <TextField
                  label="Required release strength (psi)"
                  name="releaseStrength"
                  type="number"
                  defaultValue={3000}
                  required
                />
                <TextField
                  label="Required shipping strength (psi)"
                  name="shippingStrength"
                  type="number"
                  defaultValue={4000}
                  required
                />
                <TextField
                  label="Mix design"
                  name="mix"
                  defaultValue="MX-5000-SCC"
                  required
                />
                <TextField
                  label="Production area"
                  name="area"
                  defaultValue="Bay 1"
                />
                <TextField
                  label="Shop drawing reference"
                  name="drawing"
                  placeholder="S-101"
                  required
                />
                <TextField
                  label="Drawing revision"
                  name="revision"
                  defaultValue="A"
                  required
                />
                <TextField
                  label="Scheduled production"
                  name="scheduled"
                  type="date"
                  defaultValue={today()}
                  required
                />
                <TextField
                  label="Required delivery"
                  name="delivery"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </div>
              <div className="notice">
                Each piece receives its own permanent ID, serial number, QR code
                and independent history.
              </div>
              <Submit busy={busy} label="Create serialized elements" />
            </form>
          )}
          {modal === "event" && current && (
            <EventForm
              key={`${current.id}-${action}`}
              action={action}
              element={current}
              state={s}
              busy={busy}
              onSave={(d) => command(action, d, current.id)}
            />
          )}
          {modal === "qr" && current && (
            <div className="qr-label">
              {qrImage ? (
                <img
                  src={qrImage}
                  alt={`QR for ${current.serial}`}
                  width={260}
                  height={260}
                />
              ) : (
                <Skeleton className="h-64 w-64 mx-auto" />
              )}
              <h2>{current.serial}</h2>
              <p>{currentProject?.name}</p>
              <small>
                {currentProject?.number} · {current.type}
              </small>
              {mode === "local" && (
                <div className="notice amber">
                  This label opens this browser’s local record. Start a shared
                  demo to scan new records on another device.
                </div>
              )}
              <div className="qr-actions">
                <button
                  className="btn primary"
                  onClick={() => safely(() => printLabels(s, [current], room))}
                >
                  <Printer size={16} />
                  Print label
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    safely(async () => {
                      const QR = (await import("qrcode")).default;
                      const data = await QR.toDataURL(qrUrl(current.id, room), {
                        width: 800,
                        margin: 3,
                      });
                      const a = document.createElement("a");
                      a.download = current.serial + ".png";
                      a.href = data;
                      a.click();
                    })
                  }
                >
                  <Download size={16} />
                  PNG
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    safely(async () => {
                      const QR = (await import("qrcode")).default;
                      download(
                        current.serial + ".svg",
                        await QR.toString(qrUrl(current.id, room), {
                          type: "svg",
                        }),
                        "image/svg+xml",
                      );
                    })
                  }
                >
                  SVG
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    safely(() => {
                      navigator.clipboard.writeText(qrUrl(current.id, room));
                      toast.success("Passport link copied");
                    })
                  }
                >
                  <Copy size={15} />
                  Link
                </button>
              </div>
            </div>
          )}
          {modal === "scan" && (
            <>
              <div className={`scanner ${cameraOn ? "active" : ""}`}>
                <video
                  ref={video}
                  muted
                  playsInline
                  autoPlay
                  aria-label="QR camera preview"
                />
                {!cameraOn && (
                  <div>
                    <ScanLine size={58} />
                    <p>Scan a production passport</p>
                    <button className="btn primary" onClick={startCamera}>
                      <Camera size={17} />
                      Enable camera
                    </button>
                  </div>
                )}
                <span className="scan-corner tl" />
                <span className="scan-corner br" />
              </div>
              {scanError && <p className="error-text">{scanError}</p>}
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  handleLookup(
                    String(new FormData(ev.currentTarget).get("lookup")),
                  );
                }}
              >
                <Field label="Or enter an element serial / paste QR link">
                  <div className="lookup">
                    <Input name="lookup" placeholder="B-101-001" required />
                    <Button type="submit">
                      <ArrowRight size={18} />
                      <span className="sr-only">Find element</span>
                    </Button>
                  </div>
                </Field>
              </form>
              {lookupMatches.length > 1 && (
                <div className="lookup-matches">
                  <p className="muted">
                    This serial appears in more than one project. Choose the
                    physical piece:
                  </p>
                  {lookupMatches.map((e) => (
                    <button
                      className="btn"
                      key={e.id}
                      onClick={() => {
                        setModal("");
                        setLookupMatches([]);
                        openElement(e);
                      }}
                    >
                      {e.serial} ·{" "}
                      {s.projects.find((p) => p.id === e.projectId)?.name}
                    </button>
                  ))}
                </div>
              )}
              <p className="muted">
                Camera scanning requires HTTPS or localhost. Your camera stays
                on this device.
              </p>
            </>
          )}
          {modal === "shipment" && (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                const f = new FormData(ev.currentTarget);
                command("shipment", {
                  carrier: f.get("carrier"),
                  trailer: f.get("trailer"),
                  destination: f.get("destination"),
                  elementIds: f.getAll("elementIds"),
                });
              }}
            >
              <div className="form-grid">
                <TextField label="Carrier" name="carrier" required />
                <TextField
                  label="Trailer / load number"
                  name="trailer"
                  required
                />
                <TextField label="Destination" name="destination" required />
              </div>
              <h3 className="subheading">Select accepted yard elements</h3>
              <div className="shipment-picker">
                {readyShip
                  .filter((e) => !e.shipmentId)
                  .map((e) => (
                    <label key={e.id}>
                      <Checkbox name="elementIds" value={e.id} />
                      <strong>{e.serial}</strong>
                      <span>
                        {s.projects.find((p) => p.id === e.projectId)?.name}
                      </span>
                    </label>
                  ))}
                {!readyShip.some((e) => !e.shipmentId) && (
                  <p className="muted">
                    No unassigned accepted elements available.
                  </p>
                )}
              </div>
              <Submit busy={busy} label="Create shipment" />
            </form>
          )}
          {modal === "shipmentAction" && loadShipment && (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                command(shipmentAction, {
                  ...Object.fromEntries(new FormData(ev.currentTarget)),
                  shipmentId: loadShipment.id,
                });
              }}
            >
              <p className="section-copy">
                {loadShipment.number} · {loadShipment.elements.length} assigned
                elements · {loadShipment.trailer}
              </p>
              {shipmentAction === "load" && (
                <Field label="Supports, restraints, piece condition and manifest checked">
                  <Pick
                    name="loadingCheck"
                    options={["Verified", "Not verified"]}
                  />
                </Field>
              )}
              {shipmentAction === "receiveShipment" && (
                <Field label="Receiving condition">
                  <Pick
                    name="condition"
                    options={[
                      "Accepted",
                      "Damage observed",
                      "Delivery exception",
                    ]}
                  />
                </Field>
              )}
              <Field label="Comments / receiving observations">
                <Textarea name="comments" rows={3} />
              </Field>
              <Submit
                busy={busy}
                label={
                  shipmentAction === "load"
                    ? "Confirm loading"
                    : shipmentAction === "depart"
                      ? "Record departure"
                      : "Confirm receipt"
                }
              />
            </form>
          )}
          {modal === "guide" && (
            <>
              <div className="notice">
                <QrCode size={23} />
                <span>
                  For a physical demonstration, start a shared demo, print a
                  label, and open it on a phone. Both screens refresh from the
                  same workspace.
                </span>
              </div>
              <ol className="demo-steps">
                {[
                  [
                    "Office",
                    "Create a project and three serialized elements. Use Administrator or Project Manager.",
                  ],
                  [
                    "Engineering",
                    "Open a passport, release engineering, and record formwork readiness.",
                  ],
                  [
                    "Label & scan",
                    "Open Production label, print it, then scan the QR on a phone.",
                  ],
                  [
                    "Pre-pour QC",
                    "Switch to QC Technician. Complete the checks and approve the inspection.",
                  ],
                  [
                    "Concrete placement",
                    "Switch to Production Technician. Enter batch, mix, times and concrete test data.",
                  ],
                  [
                    "Strength & strip",
                    "QC verifies release strength. Production records stripping after verification.",
                  ],
                  [
                    "Defect & repair",
                    "QC records a defect. Production documents the approved repair. The hold remains.",
                  ],
                  [
                    "Reinspection",
                    "QC Manager accepts the repaired defect. Complete final QC and verify shipping strength.",
                  ],
                  [
                    "Yard & shipping",
                    "Set the yard position, create a shipment, confirm loading, and record departure.",
                  ],
                  [
                    "Receipt & traceability",
                    "Receiving confirms condition. Open the timeline or export the traceability report.",
                  ],
                ].map(([title, body], i) => (
                  <li key={title}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                className="btn primary"
                onClick={() => {
                  setModal("project");
                }}
              >
                Begin with a new project <ArrowRight size={16} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this demonstration?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current demo projects, events, defects and
              shipments with 48 fictional elements. Export any records you want
              to keep first. Other workspaces and production data are
              unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep records</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                safely(async () => {
                  if (session) {
                    await api({ action: "reset" });
                    await refresh();
                  } else setS(seed());
                  nav("dashboard");
                  toast.success("Demonstration reset");
                })
              }
            >
              Reset demo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
