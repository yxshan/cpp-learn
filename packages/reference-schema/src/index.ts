import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import referenceCatalogSchema from "./reference-catalog.schema.json" with { type: "json" };
import referenceEntrySchema from "./reference-entry.schema.json" with { type: "json" };
import referenceVerificationSchema from "./reference-verification.schema.json" with { type: "json" };

export interface ReferenceValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCatalog = ajv.compile(referenceCatalogSchema);
const validateEntry = ajv.compile(referenceEntrySchema);
const validateVerification = ajv.compile(referenceVerificationSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  return error.instancePath || "/";
}

function issues(errors: readonly ErrorObject[] | null | undefined) {
  return (errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword,
  }));
}

export function validateReferenceCatalogManifest(
  value: unknown,
): readonly ReferenceValidationIssue[] {
  return validateCatalog(value) ? [] : issues(validateCatalog.errors);
}

export function validateReferenceEntryManifest(
  value: unknown,
): readonly ReferenceValidationIssue[] {
  return validateEntry(value) ? [] : issues(validateEntry.errors);
}

export function validateReferenceVerificationManifest(
  value: unknown,
): readonly ReferenceValidationIssue[] {
  return validateVerification(value) ? [] : issues(validateVerification.errors);
}

export {
  referenceCatalogSchema,
  referenceEntrySchema,
  referenceVerificationSchema,
};
