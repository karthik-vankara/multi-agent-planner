export default function HealthPanel({ health, loading, error, config }) {
  const statusTone = error ? "danger" : health?.status === "ok" ? "success" : "neutral";

  return (
    <section className="panel panel-health">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Backend Reachability</p>
          <h2>Server Status</h2>
        </div>
        <span className={`status-pill ${statusTone}`}>
          {loading ? "Checking" : error ? "Offline" : "Healthy"}
        </span>
      </div>

      <div className="meta-grid">
        <div className="meta-card">
          <span className="meta-label">Backend URL</span>
          <strong>{config.apiBaseUrl}</strong>
        </div>
        <div className="meta-card">
          <span className="meta-label">Auth Mode</span>
          <strong>{config.hasApiKey ? "Bearer token from env" : "Auth disabled"}</strong>
        </div>
        <div className="meta-card">
          <span className="meta-label">Poll Interval</span>
          <strong>{config.pollIntervalMs} ms</strong>
        </div>
      </div>

      <div className="note-row">
        {error ? (
          <p className="error-text">Unable to reach the backend: {error.message}</p>
        ) : (
          <p className="muted-text">`GET /health` returned {health?.status ?? "unknown"}.</p>
        )}
      </div>
    </section>
  );
}
