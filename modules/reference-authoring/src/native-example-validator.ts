import type { CppStandard } from "@cpp-learn/contracts";
import type { BoundedProcessRunner } from "@cpp-learn/judge";
import {
  createReferenceExampleVerifier,
  ReferenceExampleVerificationError,
  resolveReferenceCppCompiler,
} from "@cpp-learn/reference";

import type {
  AuthoringExampleValidator,
  AuthoringValidationIssue,
} from "./index.js";

export interface NativeAuthoringExampleValidatorOptions {
  readonly compiler?: string;
  readonly run?: BoundedProcessRunner;
  readonly standardFlag?: (standard: CppStandard) => Promise<string>;
}

function issue(
  keyword: "compiler" | "runtime",
  message: string,
): AuthoringValidationIssue {
  return { path: "/", message, keyword };
}

export function createNativeAuthoringExampleValidator(
  options: NativeAuthoringExampleValidatorOptions = {},
): AuthoringExampleValidator {
  const compiler = options.compiler ?? resolveReferenceCppCompiler();
  const verify = createReferenceExampleVerifier({
    compiler,
    ...(options.run === undefined ? {} : { run: options.run }),
    ...(options.standardFlag === undefined
      ? {}
      : { standardFlag: options.standardFlag }),
  });

  return {
    async validate(request) {
      try {
        await verify({
          identity: `${request.entryId}/${request.example.id}`,
          example: request.example,
          source: request.source,
        });
        return [];
      } catch (error) {
        return [
          issue(
            error instanceof ReferenceExampleVerificationError
              ? error.phase
              : "compiler",
            error instanceof Error
              ? error.message
              : "Example validation failed",
          ),
        ];
      }
    },
  };
}
