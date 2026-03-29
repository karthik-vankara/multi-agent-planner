import Ajv from "ajv";
import { createRequire } from "module";
import { ValidationError } from "./errors.js";

const require = createRequire(import.meta.url);

const planSchema       = require("../schemas/plan.json");
const scheduleSchema   = require("../schemas/schedule.json");
const reviewSchema     = require("../schemas/review.json");
const apiRequestSchema = require("../schemas/api-request.json");

const ajv = new Ajv({ allErrors: true });

const _validatePlan       = ajv.compile(planSchema);
const _validateSchedule   = ajv.compile(scheduleSchema);
const _validateReview     = ajv.compile(reviewSchema);
const _validateApiRequest = ajv.compile(apiRequestSchema);

function check(validator, data, label) {
  if (!validator(data)) {
    const details = (validator.errors ?? []).map(e => ({
      path:    e.instancePath || "(root)",
      message: e.message,
    }));
    throw new ValidationError(`Invalid ${label} structure`, details);
  }
  return data;
}

export const validatePlan       = (d) => check(_validatePlan,       d, "plan");
export const validateSchedule   = (d) => check(_validateSchedule,   d, "schedule");
export const validateReview     = (d) => check(_validateReview,     d, "review");
export const validateApiRequest = (d) => check(_validateApiRequest, d, "request body");
