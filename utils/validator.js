/**
 * Programmatic schedule validator.
 * Checks hard constraints with 100% accuracy — no LLM involved.
 */
export function validateSchedule(plan, schedule) {
  const errors = [];
  const { duration_days, daily_hours, tasks } = plan;
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const taskIds = new Set(tasks.map((t) => t.id));
  const scheduleData = schedule.schedule || {};

  // 1. Check all days present (day_1 .. day_N)
  for (let d = 1; d <= duration_days; d++) {
    const key = `day_${d}`;
    if (!scheduleData[key]) {
      errors.push({ type: "missing_day", message: `${key} is missing from the schedule` });
    }
  }

  // 2. Check for extra days beyond duration
  for (const key of Object.keys(scheduleData)) {
    const match = key.match(/^day_(\d+)$/);
    if (match && parseInt(match[1]) > duration_days) {
      errors.push({ type: "extra_day", message: `${key} exceeds duration of ${duration_days} days` });
    }
  }

  const scheduledTaskHours = new Map();
  const taskFirstDay = new Map();
  const taskLastDay = new Map();

  for (const [dayKey, slots] of Object.entries(scheduleData)) {
    const dayNum = parseInt(dayKey.replace("day_", ""));
    if (!Array.isArray(slots)) {
      errors.push({ type: "invalid_format", message: `${dayKey} is not an array` });
      continue;
    }

    // 3. Check daily hour limit
    const dayTotal = slots.reduce((sum, s) => sum + (s.hours || 0), 0);
    if (dayTotal > daily_hours) {
      errors.push({ type: "hour_limit_exceeded", message: `${dayKey} has ${dayTotal}h, limit is ${daily_hours}h` });
    }

    // 4. Check for empty days
    if (slots.length === 0) {
      errors.push({ type: "empty_day", message: `${dayKey} has no tasks scheduled` });
    }

    for (const slot of slots) {
      // 5. Check for zero-hour slots
      if (!slot.hours || slot.hours <= 0) {
        errors.push({ type: "zero_hours", message: `${slot.task_id} on ${dayKey} has ${slot.hours || 0} hours` });
      }

      // 6. Check for unknown task IDs
      if (!taskIds.has(slot.task_id)) {
        errors.push({ type: "unknown_task", message: `${slot.task_id} on ${dayKey} is not in the plan` });
      }

      scheduledTaskHours.set(slot.task_id, (scheduledTaskHours.get(slot.task_id) || 0) + (slot.hours || 0));

      if (!taskFirstDay.has(slot.task_id) || dayNum < taskFirstDay.get(slot.task_id)) {
        taskFirstDay.set(slot.task_id, dayNum);
      }
      if (!taskLastDay.has(slot.task_id) || dayNum > taskLastDay.get(slot.task_id)) {
        taskLastDay.set(slot.task_id, dayNum);
      }
    }
  }

  // 7. Check all tasks are scheduled
  for (const task of tasks) {
    if (!scheduledTaskHours.has(task.id)) {
      errors.push({ type: "missing_task", message: `${task.id} ("${task.title}") is not scheduled` });
    }
  }

  // 8. Check dependencies are respected
  for (const task of tasks) {
    if (!task.dependencies || task.dependencies.length === 0) continue;
    const taskStart = taskFirstDay.get(task.id);
    if (taskStart === undefined) continue;

    for (const depId of task.dependencies) {
      const depEnd = taskLastDay.get(depId);
      if (depEnd === undefined) continue;
      if (taskStart < depEnd) {
        errors.push({
          type: "dependency_violation",
          message: `${task.id} starts on day_${taskStart} but depends on ${depId} which runs until day_${depEnd}`,
        });
      }
    }
  }

  // 9. Check total hours per task roughly match estimated
  for (const task of tasks) {
    const scheduled = scheduledTaskHours.get(task.id) || 0;
    const estimated = task.estimated_hours || 0;
    if (estimated > 0 && scheduled < estimated * 0.5) {
      errors.push({
        type: "underallocated_task",
        message: `${task.id} has ${scheduled}h scheduled but needs ~${estimated}h`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    errors,
  };
}