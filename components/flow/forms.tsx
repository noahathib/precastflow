"use client";
import { useState, type ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { ACTIONS, today, type Element, type State } from "@/lib/model";
export function Pick({
  value,
  onChange,
  options,
  placeholder = "Select",
  name,
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  name?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      name={name}
      defaultValue={value ? undefined : undefined}
    >
      <SelectTrigger className="w-full min-h-10 bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"field" + (wide ? " wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function TextField({
  label,
  name,
  defaultValue = "",
  type = "text",
  required = false,
  ...props
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  [k: string]: any;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        {...props}
      />
    </Field>
  );
}
export function Submit({
  busy,
  label = "Save record",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" disabled={busy} className="save-button">
      {busy && <Loader2 className="animate-spin" size={16} />}{" "}
      {busy ? "Saving…" : label}
    </Button>
  );
}
export function Photo({ onChange }: { onChange: (v: string) => void }) {
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  return (
    <Field label="Photo (optional)" wide>
      <div className="photo-input">
        <Camera size={19} />
        <input
          aria-label="Attach photograph"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            setError("");
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 3_000_000) {
              setError("Choose an image smaller than 3 MB.");
              return;
            }
            if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
              setError("Use JPG, PNG or WebP.");
              return;
            }
            const r = new FileReader();
            r.onload = () => {
              const img = new Image();
              img.onload = () => {
                const scale = Math.min(
                  1,
                  1200 / Math.max(img.width, img.height),
                );
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  setError("Unable to process this image.");
                  return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let data = canvas.toDataURL("image/jpeg", 0.7);
                if (data.length > 350000)
                  data = canvas.toDataURL("image/jpeg", 0.4);
                if (data.length > 350000) {
                  setError(
                    "This photograph is too detailed for demo storage. Choose a smaller image.",
                  );
                  return;
                }
                onChange(data);
                setName(f.name);
              };
              img.onerror = () => setError("Unable to read this image.");
              img.src = String(r.result);
            };
            r.readAsDataURL(f);
          }}
        />
        {name && <small>{name}</small>}
      </div>
      {error && <span className="error-text">{error}</span>}
    </Field>
  );
}
export function EventForm({
  action,
  element: e,
  state: s,
  onSave,
  busy,
}: {
  action: string;
  element: Element;
  state: State;
  onSave: (d: Record<string, any>) => Promise<boolean>;
  busy: boolean;
}) {
  const [photo, setPhoto] = useState("");
  const [concreteType, setConcreteType] = useState("Conventional");
  const [result, setResult] = useState("Approved");
  const inspection = action === "prepour" || action === "final";
  const defects = s.defects.filter(
    (d) =>
      d.elementId === e.id &&
      d.status === (action === "release" ? "Repaired" : "Open"),
  );
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault();
        const d = Object.fromEntries(new FormData(ev.currentTarget));
        if (await onSave({ ...d, photo, concreteType })) setPhoto("");
      }}
    >
      <div className="form-grid">
        {action === "engineering" && (
          <TextField
            label="Drawing approval reference"
            name="approvalReference"
            required
          />
        )}
        {action === "form" && (
          <>
            <TextField
              label="Form / bed ID"
              name="formId"
              defaultValue={e.location}
              required
            />
            <Field label="Dimensions checked">
              <Pick name="dimensions" options={["Verified", "Deficient"]} />
            </Field>
          </>
        )}
        {inspection && (
          <>
            <TextField
              label="Drawing revision"
              name="drawingRevision"
              defaultValue={e.revision}
              required
            />
            {(action === "prepour"
              ? [
                  ["Formwork condition", "formwork"],
                  ["Dimensions / cover", "dimensions"],
                  ["Reinforcement placement", "reinforcement"],
                  ["Embedded items", "embeddedItems"],
                ]
              : [
                  ["Dimensions", "dimensions"],
                  ["Finish & appearance", "finish"],
                ]
            ).map(([label, name]) => (
              <Field key={name} label={label}>
                <Pick
                  name={name}
                  options={
                    ["reinforcement", "embeddedItems"].includes(name)
                      ? ["Acceptable", "Deficient", "Not applicable"]
                      : ["Acceptable", "Deficient"]
                  }
                />
              </Field>
            ))}
            <Field label="Inspection result">
              <Pick
                name="result"
                value={result}
                onChange={setResult}
                options={["Approved", "Hold"]}
              />
            </Field>
            {action === "final" && (
              <>
                <TextField
                  label={`Shipping test strength (minimum ${e.shippingStrength} psi)`}
                  name="shippingTestStrength"
                  type="number"
                  required={result === "Approved"}
                />
                <TextField
                  label="Test specimen / report reference"
                  name="specimen"
                  required={result === "Approved"}
                />
              </>
            )}
          </>
        )}
        {action === "placement" && (
          <>
            <TextField
              label="Mix design"
              name="mix"
              defaultValue={e.mix}
              required
            />
            <TextField
              label="Batch ticket (shared across pieces)"
              name="batchTicket"
              required
            />
            <TextField label="Truck / batch number" name="truck" required />
            <TextField
              label="Placement date"
              name="placementDate"
              type="date"
              defaultValue={today()}
              required
            />
            <TextField
              label="Start time"
              name="startTime"
              type="time"
              required
            />
            <TextField
              label="Completion time"
              name="endTime"
              type="time"
              required
            />
            <Field label="Concrete type">
              <Pick
                value={concreteType}
                onChange={setConcreteType}
                options={["Conventional", "SCC"]}
              />
            </Field>
            <TextField
              label="Concrete temperature (°F)"
              name="concreteTemperature"
              type="number"
              required
            />
            <TextField
              label="Ambient temperature (°F)"
              name="ambientTemperature"
              type="number"
              required
            />
            <TextField
              label={concreteType === "SCC" ? "Slump flow (in)" : "Slump (in)"}
              name="slump"
              type="number"
              step="0.1"
              required
            />
            <TextField
              label="Air content (%)"
              name="air"
              type="number"
              step="0.1"
              required
            />
            <TextField
              label="Unit weight (lb/ft³)"
              name="unitWeight"
              type="number"
              step="0.1"
              required
            />
            <TextField
              label="Specimen identification"
              name="specimen"
              required
            />
            <TextField
              label="Placement technician"
              name="technician"
              required
            />
          </>
        )}
        {action === "curing" && (
          <>
            <Field label="Curing method">
              <Pick
                name="method"
                options={[
                  "Moist cure",
                  "Steam cure",
                  "Membrane compound",
                  "Insulated enclosure",
                ]}
              />
            </Field>
            <TextField
              label="Temperature (°F)"
              name="temperature"
              type="number"
              required
            />
            <TextField
              label="Duration (hours)"
              name="duration"
              type="number"
              min="0"
              required
            />
          </>
        )}
        {action === "strength" && (
          <>
            <div className="notice wide">
              Release requires {e.releaseStrength.toLocaleString()} psi. Time in
              curing alone does not authorize stripping.
            </div>
            <TextField
              label="Measured compressive strength (psi)"
              name="testStrength"
              type="number"
              min={e.releaseStrength}
              required
            />
            <TextField
              label="Specimen / test report"
              name="specimen"
              required
            />
            <TextField
              label="Test date"
              name="testDate"
              type="date"
              defaultValue={today()}
              required
            />
          </>
        )}
        {action === "strip" && (
          <TextField
            label="Lifting equipment / inspection reference"
            name="equipment"
            required
          />
        )}
        {action === "location" && (
          <TextField
            label="Yard / row / position"
            name="location"
            defaultValue={e.location}
            required
          />
        )}
        {action === "defect" && (
          <>
            <TextField label="Defect description" name="description" required />
            <Field label="Severity / disposition">
              <Pick
                name="severity"
                options={["Minor", "Major", "Reject pending review"]}
              />
            </Field>
            <TextField
              label="Required corrective action"
              name="corrective"
              required
            />
          </>
        )}
        {["repair", "release"].includes(action) && (
          <Field label="Defect">
            <Pick
              name="defectId"
              options={defects.map((d) => ({
                value: d.id,
                label: d.description,
              }))}
              placeholder={
                defects.length ? "Select defect" : "No eligible defects"
              }
            />
          </Field>
        )}
        {action === "repair" && (
          <>
            <TextField label="Repair procedure" name="procedure" required />
            <TextField label="Materials used" name="materials" required />
            <TextField
              label="Approved repair procedure / engineer reference"
              name="approvalReference"
              required
            />
            <div className="notice amber wide">
              Repair completion retains the hold until a QC Manager accepts the
              reinspection.
            </div>
          </>
        )}
        {action === "release" && (
          <Field label="Reinspection result">
            <Pick name="result" options={["Approved", "Hold"]} />
          </Field>
        )}
        {action === "receipt" && (
          <Field label="Receiving condition">
            <Pick
              name="condition"
              options={["Accepted", "Damage observed", "Delivery exception"]}
            />
          </Field>
        )}
        {action === "correction" && (
          <Field label="Event to correct">
            <Pick
              name="eventId"
              options={s.events
                .filter((x) => x.elementId === e.id)
                .map((x) => ({
                  value: x.id,
                  label: `${x.type} · ${new Date(x.at).toLocaleDateString()}`,
                }))}
            />
          </Field>
        )}
        <Field
          label={
            action === "receipt"
              ? "Damage observations / notes"
              : "Comments / observations"
          }
          wide
        >
          <Textarea
            name="comments"
            rows={3}
            required={
              ["release", "strip", "correction"].includes(action) ||
              result === "Hold"
            }
            placeholder="Record observations and supporting references…"
          />
        </Field>
        <Photo onChange={setPhoto} />
      </div>
      <div className="form-footer">
        <span className="muted">
          User, timestamp and drawing revision recorded automatically.
        </span>
        <Submit busy={busy} label={ACTIONS[action]?.label} />
      </div>
    </form>
  );
}
