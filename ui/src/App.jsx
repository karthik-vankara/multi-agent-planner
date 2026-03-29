import { useEffect, useRef, useState } from "react";
import { cancelRun, clientConfig, createRun, getHealth, getRun } from "./api/client.js";
import HealthPanel from "./components/HealthPanel.jsx";
import RunForm from "./components/RunForm.jsx";
import RunMonitor from "./components/RunMonitor.jsx";
import ResultView from "./components/ResultView.jsx";

const STORAGE_KEY = "multi-agent-planner-ui:last-session";
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function normaliseError(error) {
  return {
    status: error?.status ?? null,
    code: error?.code ?? "NETWORK_ERROR",
    message: error?.message ?? "Request failed.",
    details: error?.details ?? null,
    retryAfter: error?.retryAfter ?? null,
    rateLimit: error?.rateLimit ?? null,
  };
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function mapValidationDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.map((detail) => `${detail.path}: ${detail.message}`).filter(Boolean);
}

export default function App() {
  const initialSession = loadSession();

  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  const [formSeed, setFormSeed] = useState(initialSession?.lastInput ?? undefined);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [runState, setRunState] = useState(initialSession?.runState ?? null);
  const [rawPayload, setRawPayload] = useState(initialSession?.rawPayload ?? null);
  const [uiError, setUiError] = useState(null);
  const [rateLimitInfo, setRateLimitInfo] = useState(initialSession?.rateLimitInfo ?? null);

  const pollTimer = useRef(null);

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      setHealthLoading(true);
      try {
        const response = await getHealth();
        if (!active) return;
        setHealth(response);
        setHealthError(null);
      } catch (error) {
        if (!active) return;
        setHealthError(normaliseError(error));
      } finally {
        if (active) setHealthLoading(false);
      }
    }

    checkHealth();
    const timer = window.setInterval(checkHealth, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    saveSession({
      lastInput: formSeed,
      runState,
      rawPayload,
      rateLimitInfo,
    });
  }, [formSeed, runState, rawPayload, rateLimitInfo]);

  useEffect(() => {
    if (!runState?.run_id || TERMINAL_STATUSES.has(runState.status)) {
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    async function poll() {
      try {
        const next = await getRun(runState.run_id);
        if (cancelled) return;
        setRunState(next);
        setRawPayload(next);
        setRateLimitInfo(next._rateLimit ?? null);
        setUiError(null);

        if (!TERMINAL_STATUSES.has(next.status)) {
          pollTimer.current = window.setTimeout(poll, clientConfig.pollIntervalMs);
        }
      } catch (error) {
        if (cancelled) return;
        const parsed = normaliseError(error);
        setUiError(parsed);

        const backoff = parsed.retryAfter ? parsed.retryAfter * 1000 : Math.max(clientConfig.pollIntervalMs * 2, 4000);
        pollTimer.current = window.setTimeout(poll, backoff);
      }
    }

    pollTimer.current = window.setTimeout(poll, clientConfig.pollIntervalMs);

    return () => {
      cancelled = true;
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [runState?.run_id, runState?.status]);

  async function handleCreateRun(input) {
    setSubmitting(true);
    setUiError(null);
    setFormSeed(input);

    try {
      const response = await createRun(input);
      const nextState = {
        ...response,
        progress: { iteration: 0, maxIterations: 7 },
        result: null,
        error: null,
        started_at: null,
        completed_at: null,
      };
      setRunState(nextState);
      setRawPayload(response);
    } catch (error) {
      setUiError(normaliseError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRun() {
    if (!runState?.run_id) return;
    setCancelling(true);
    setUiError(null);

    try {
      const response = await cancelRun(runState.run_id);
      setRunState((current) => (current ? { ...current, status: response.status } : current));
      setRawPayload(response);
    } catch (error) {
      setUiError(normaliseError(error));
    } finally {
      setCancelling(false);
    }
  }

  function handleReset() {
    setRunState(null);
    setRawPayload(null);
    setUiError(null);
    setRateLimitInfo(null);
    clearSession();
  }

  const validationMessages = mapValidationDetails(uiError?.details);

  return (
    <div className="app-shell">
      <div className="background-orb orb-a" />
      <div className="background-orb orb-b" />
      <header className="hero">
        <p className="hero-kicker">Async Backend Test Harness</p>
        <h1>Multi-Agent Planner UI</h1>
        <p className="hero-copy">
          Drive the full planner flow from goal input to async run polling, cancellation, and final schedule inspection.
        </p>
        <div className="hero-meta">
          <span>Backend: {clientConfig.apiBaseUrl}</span>
          <span>Polling: {clientConfig.pollIntervalMs} ms</span>
          <span>{clientConfig.hasApiKey ? "Bearer auth enabled" : "No frontend auth configured"}</span>
        </div>
      </header>

      {uiError ? (
        <section className="panel global-alert">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Latest Error</p>
              <h2>{uiError.code}</h2>
            </div>
            <span className="status-pill danger">{uiError.status ?? "Network"}</span>
          </div>
          <p className="error-text">{uiError.message}</p>
          {validationMessages.length ? (
            <ul className="suggestion-list compact-list">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {uiError.retryAfter ? <p className="muted-text">Retry after: {uiError.retryAfter}s</p> : null}
        </section>
      ) : null}

      <main className="dashboard-grid">
        <div className="left-column">
          <HealthPanel health={health} loading={healthLoading} error={healthError} config={clientConfig} />
          <RunForm initialValue={formSeed} onSubmit={handleCreateRun} submitting={submitting} />
        </div>

        <div className="right-column">
          <RunMonitor
            runState={runState}
            onCancel={handleCancelRun}
            cancelling={cancelling}
            lastRateLimit={rateLimitInfo}
          />
          <ResultView runState={runState} rawPayload={rawPayload} />
        </div>
      </main>

      <footer className="footer-bar">
        <button type="button" className="ghost-button" onClick={handleReset}>
          Reset Local Session
        </button>
        <span>Run state is resumed from localStorage until the backend run expires or the server restarts.</span>
      </footer>
    </div>
  );
}
