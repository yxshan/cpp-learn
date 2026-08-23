import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";

import activitySchema from "./activity.schema.json" with { type: "json" };

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateActivitySchema = ajv.compile(activitySchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    const missingProperty = String(error.params["missingProperty"]);
    return `${error.instancePath}/${missingProperty}`;
  }
  return error.instancePath || "/";
}

export function validateActivity(value: unknown): readonly ValidationIssue[] {
  if (validateActivitySchema(value)) {
    return [];
  }

  return (validateActivitySchema.errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword
  }));
}

export { activitySchema };

