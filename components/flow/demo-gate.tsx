import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Layers3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./demo-gate.css";

// A convenience gate for the public demo, not server-enforced access control.
const PASSWORD_DIGEST =
  "9d833556afe7555a812aca1640259a30852376a9f20b4075659d89e96a836032";
const SESSION_KEY = "precastflow-pages-demo-access-v1";

function isUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === PASSWORD_DIGEST;
  } catch {
    return false;
  }
}

export default function DemoGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    setError("");

    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(password),
      );
      const value = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");

      if (value !== PASSWORD_DIGEST) {
        setError("That password isn’t correct. Please try again.");
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      try {
        sessionStorage.setItem(SESSION_KEY, PASSWORD_DIGEST);
      } catch {
        // Storage can be unavailable; still allow access until the page reloads.
      }
      setPassword("");
      setUnlocked(true);
    } catch {
      setError("Unable to check the password. Please refresh and try again.");
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return children;

  return (
    <main className="demo-gate">
      <section className="demo-gate-card" aria-labelledby="demo-gate-title">
        <header className="demo-gate-header">
          <div className="demo-gate-brand">
            <Layers3 aria-hidden="true" />
            <span>Precast<span className="demo-gate-brand-accent">Flow</span></span>
          </div>
          <p>From Shop Drawing to Jobsite.</p>
        </header>
        <div className="demo-gate-body">
          <div className="demo-gate-icon"><LockKeyhole aria-hidden="true" /></div>
          <p className="eyebrow">WELCOME TO PRECASTFLOW</p>
          <h1 id="demo-gate-title">Enter the demo</h1>
          <p className="demo-gate-description">Use your access password to continue.</p>
          <form onSubmit={enter}>
            <label htmlFor="demo-password">Password</label>
            <Input
              ref={inputRef}
              id="demo-password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "demo-gate-error" : undefined}
              placeholder="Enter password"
            />
            {error && <p id="demo-gate-error" role="alert">{error}</p>}
            <Button type="submit" disabled={checking}>
              {checking ? "Checking…" : "Enter site"}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
