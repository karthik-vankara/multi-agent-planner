import { useState } from "react";

const DEFAULT_FORM = {
  goal: "Prepare for a coding interview",
  days: 14,
  hours: 3,
};

function validate(form) {
  const errors = {};

  if (!form.goal || form.goal.trim().length < 5) {
    errors.goal = "Goal must be at least 5 characters.";
  } else if (form.goal.trim().length > 500) {
    errors.goal = "Goal must be at most 500 characters.";
  }

  if (form.days !== "" && (Number.isNaN(Number(form.days)) || Number(form.days) < 1 || Number(form.days) > 365)) {
    errors.days = "Days must be between 1 and 365.";
  }

  if (form.hours !== "" && (Number.isNaN(Number(form.hours)) || Number(form.hours) < 0.5 || Number(form.hours) > 24)) {
    errors.hours = "Hours must be between 0.5 and 24.";
  }

  return errors;
}

export default function RunForm({ initialValue, onSubmit, submitting }) {
  const [form, setForm] = useState(initialValue ?? DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === "goal" ? value : value === "" ? "" : Number(value) }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit({
      goal: form.goal.trim(),
      days: form.days === "" ? undefined : Number(form.days),
      hours: form.hours === "" ? undefined : Number(form.hours),
    });
  }

  return (
    <section className="panel panel-form">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Start Async Run</p>
          <h2>Create Planner Run</h2>
        </div>
        <span className="status-pill neutral">POST /runs</span>
      </div>

      <form className="planner-form" onSubmit={handleSubmit}>
        <label>
          <span>Goal</span>
          <textarea
            name="goal"
            rows="4"
            value={form.goal}
            onChange={updateField}
            placeholder="Describe the outcome you want the planner to schedule"
          />
          {errors.goal ? <small className="field-error">{errors.goal}</small> : null}
        </label>

        <div className="inline-fields">
          <label>
            <span>Days</span>
            <input type="number" name="days" min="1" max="365" step="1" value={form.days} onChange={updateField} />
            {errors.days ? <small className="field-error">{errors.days}</small> : null}
          </label>

          <label>
            <span>Hours / Day</span>
            <input type="number" name="hours" min="0.5" max="24" step="0.5" value={form.hours} onChange={updateField} />
            {errors.hours ? <small className="field-error">{errors.hours}</small> : null}
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Starting..." : "Start Run"}
          </button>
        </div>
      </form>
    </section>
  );
}
