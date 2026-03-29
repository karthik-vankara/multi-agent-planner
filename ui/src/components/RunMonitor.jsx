function formatTimestamp(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function ProgressBar({ iteration = 0, maxIterations = 0 }) {
  const percent = maxIterations > 0 ? Math.min(100, Math.round((iteration / maxIterations) * 100)) : 0;

  return (
    <div className="progress-shell" aria-label="Run progress">
      <div className="progress-bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function RunMonitor({ runState, onCancel, cancelling, lastRateLimit }) {
  const tone =
    runState?.status === "completed"
      ? "success"
      : runState?.status === "failed"
        ? "danger"
        : runState?.status === "cancelled"
          ? "warning"
          : "neutral";

  const canCancel = runState && ["queued", "running"].includes(runState.status);
  const progress = runState?.progress || { iteration: 0, maxIterations: 0 };

  return (
    <section className="panel panel-monitor">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Run Lifecycle</p>
          <h2>Run Monitor</h2>
        </div>
        <span className={`status-pill ${tone}`}>{runState?.status ?? "Idle"}</span>
      </div>

      {runState ? (
        <>
          <div className="meta-grid">
            <div className="meta-card">
              <span className="meta-label">Run ID</span>
              <strong className="mono-text">{runState.run_id}</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Iteration</span>
              <strong>{progress.iteration} / {progress.maxIterations}</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Created</span>
              <strong>{formatTimestamp(runState.created_at)}</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Started</span>
              <strong>{formatTimestamp(runState.started_at)}</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Completed</span>
              <strong>{formatTimestamp(runState.completed_at)}</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Rate Limit</span>
              <strong>
                {lastRateLimit?.remaining ?? "-"} / {lastRateLimit?.limit ?? "-"} remaining
              </strong>
            </div>
          </div>

          <ProgressBar iteration={progress.iteration} maxIterations={progress.maxIterations} />

          {runState.error ? <p className="error-text">{runState.error}</p> : null}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={!canCancel || cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Run"}
            </button>
          </div>
        </>
      ) : (
        <p className="muted-text">No run started yet. Submit the form to create one.</p>
      )}
    </section>
  );
}
