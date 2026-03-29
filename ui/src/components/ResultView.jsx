function DayBlock({ dayKey, slots }) {
  return (
    <article className="day-block">
      <header>
        <h4>{dayKey.replace("_", " ")}</h4>
        <span>{slots.reduce((sum, slot) => sum + slot.hours, 0)}h</span>
      </header>
      <ul>
        {slots.map((slot, index) => (
          <li key={`${dayKey}-${slot.task_id}-${index}`}>
            <strong>{slot.task_id}</strong>
            <span>{slot.hours}h</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function ResultView({ runState, rawPayload }) {
  const result = runState?.result;
  const schedule = result?.schedule?.schedule ?? null;
  const terminalStatus = runState?.status;

  return (
    <section className="panel panel-result">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Terminal Output</p>
          <h2>Result Inspector</h2>
        </div>
        <span className="status-pill neutral">GET /runs/:id</span>
      </div>

      {terminalStatus === "completed" && result ? (
        <>
          <div className="score-grid">
            <div className="score-card">
              <span className="meta-label">Best Score</span>
              <strong>{result.bestScore ?? "N/A"}</strong>
            </div>
            <div className="score-card">
              <span className="meta-label">Validator Errors</span>
              <strong>{result.validatorErrors ?? "N/A"}</strong>
            </div>
            <div className="score-card">
              <span className="meta-label">Quality Issues</span>
              <strong>{result.qualityIssues ?? "N/A"}</strong>
            </div>
          </div>

          <div className="result-columns">
            <div className="result-section">
              <h3>Suggestions</h3>
              {result.suggestions?.length ? (
                <ul className="suggestion-list">
                  {result.suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}
                </ul>
              ) : (
                <p className="muted-text">No suggestions returned.</p>
              )}
            </div>

            <div className="result-section">
              <h3>Schedule</h3>
              {schedule ? (
                <div className="day-grid">
                  {Object.entries(schedule).map(([dayKey, slots]) => (
                    <DayBlock key={dayKey} dayKey={dayKey} slots={slots} />
                  ))}
                </div>
              ) : (
                <p className="muted-text">No schedule payload returned.</p>
              )}
            </div>
          </div>
        </>
      ) : terminalStatus === "failed" ? (
        <p className="error-text">Run failed. Check the run error and raw payload below.</p>
      ) : terminalStatus === "cancelled" ? (
        <p className="muted-text">Run was cancelled before completion.</p>
      ) : (
        <p className="muted-text">Results appear here once a run reaches a terminal state.</p>
      )}

      <div className="result-section raw-output">
        <h3>Raw Payload</h3>
        <pre>{JSON.stringify(rawPayload, null, 2)}</pre>
      </div>
    </section>
  );
}
