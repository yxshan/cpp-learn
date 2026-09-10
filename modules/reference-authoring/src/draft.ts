import { authoringInputDigest } from "./digest.ts";
import {
  PROFILE_DEFINITIONS,
  contentTemplate,
  exampleTemplate,
} from "./profiles.ts";

import type {
  AuthoringCatalogContext,
  AuthoringCatalogProposal,
  AuthoringDraftManifest,
  AuthoringFactSheet,
  AuthoringProfile,
  AuthoringReport,
  AuthoringSourceLedger,
  AuthoringTargetPaths,
  DraftWorkspace,
  PrepareDraftTarget,
  ReferenceDraftRepository,
} from "./index.ts";

/**
 * Draft lifecycle.
 *
 * Creating, scaffolding, cloning and reserving a draft is one concern: it owns
 * the target paths, the generated starter files, the catalog proposal, and the
 * in-memory repository used by tests. Nothing here reads the clock or the
 * filesystem, so a draft can be constructed without an authoring instance.
 */

export function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function targetPaths(target: PrepareDraftTarget): AuthoringTargetPaths {
  const root = `entries/${target.entryId}`;
  return {
    entry: `${root}/entry.json`,
    content: `${root}/content.md`,
    examples: `${root}/examples`,
    catalog: "catalog.json",
  };
}

export function createDraftManifest(
  target: PrepareDraftTarget,
  profile: AuthoringProfile,
  now: string,
  affectedEntryIds: readonly string[] = [target.entryId],
): AuthoringDraftManifest {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    revision: 1,
    state: "draft",
    profile,
    target,
    targetPaths: targetPaths(target),
    affectedEntryIds,
    createdAt: now,
    updatedAt: now,
  };
}

export function candidateEntry(
  target: PrepareDraftTarget,
  proposal: AuthoringCatalogProposal,
) {
  return {
    schemaVersion: 2,
    id: target.entryId,
    version: 1,
    slug: target.slug,
    kind: target.kind,
    title: target.title,
    summary: "TODO",
    aliases: [],
    categories: proposal.categories,
    relatedEntryIds: proposal.relatedEntryIds,
    content: { format: "markdown", path: targetPaths(target).content },
    examples: [],
    sources: [],
    verifiedAt: null,
  };
}

export function createDraftWorkspace(
  draft: AuthoringDraftManifest,
  proposal: AuthoringCatalogProposal,
): DraftWorkspace {
  const { profile, target } = draft;
  const facts: AuthoringFactSheet = {
    schemaVersion: 1,
    draftId: target.entryId,
    groups: PROFILE_DEFINITIONS[profile].factKinds.map((kind) => ({
      id: kind.replaceAll("_", "-"),
      kind,
      status: "unverified",
      summary: "",
      sourceIds: [],
    })),
  };
  const sources: AuthoringSourceLedger = {
    schemaVersion: 1,
    draftId: target.entryId,
    sources: [],
  };
  const files: Record<string, string> = {
    "draft.json": jsonFile(draft),
    "facts.json": jsonFile(facts),
    "sources.json": jsonFile(sources),
    "catalog-proposal.json": jsonFile(proposal),
    "entry.json": jsonFile(candidateEntry(target, proposal)),
    "content.md": contentTemplate(target.title, profile),
  };
  for (const label of PROFILE_DEFINITIONS[profile].examples) {
    files[`examples/${label}.cpp`] = exampleTemplate(label);
  }
  const report: AuthoringReport = {
    schemaVersion: 1,
    draftId: target.entryId,
    draftRevision: 1,
    inputDigest: authoringInputDigest(files),
    status: "not_checked",
    affectedEntryIds: draft.affectedEntryIds,
    affectedActivityIds: [],
    findings: [],
    reviewQueue: [],
    cacheEvidence: [],
  };
  files["report.json"] = jsonFile(report);
  return { draft, proposal, facts, sources, report, files };
}

export function emptyCatalogProposal(
  target: PrepareDraftTarget,
): AuthoringCatalogProposal {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [],
    relatedEntryIds: [],
    affectedRedirects: [],
  };
}

export function catalogProposal(
  target: PrepareDraftTarget,
  catalog: AuthoringCatalogContext,
): AuthoringCatalogProposal {
  const ownerSymbol = target.title.includes("::")
    ? target.title.slice(0, target.title.lastIndexOf("::"))
    : undefined;
  const parentSlug = target.slug.includes("/")
    ? target.slug.slice(0, target.slug.lastIndexOf("/"))
    : undefined;
  const directlyRelated = catalog.entries.filter(
    (entry) =>
      entry.slug === parentSlug ||
      entry.symbol === ownerSymbol ||
      entry.title === ownerSymbol,
  );
  const owningHeaders = new Set(
    directlyRelated
      .map(({ header }) => header)
      .filter((header): header is string => header !== undefined),
  );
  const headerEntries = catalog.entries.filter(
    (entry) =>
      entry.kind === "header" &&
      (owningHeaders.has(entry.title) ||
        (entry.symbol !== undefined && owningHeaders.has(entry.symbol))),
  );
  const relatedEntries = [...directlyRelated, ...headerEntries].filter(
    (entry, index, entries) =>
      entry.id !== target.entryId &&
      entries.findIndex(({ id }) => id === entry.id) === index,
  );
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [
      ...new Set(relatedEntries.flatMap(({ categories }) => [...categories])),
    ],
    relatedEntryIds: relatedEntries.map(({ id }) => id),
    affectedRedirects: catalog.redirects.filter(
      ({ toEntryId }) =>
        toEntryId === target.entryId ||
        relatedEntries.some(({ id }) => id === toEntryId),
    ),
  };
}

export function cloneWorkspace(workspace: DraftWorkspace): DraftWorkspace {
  return structuredClone(workspace);
}

export function sameFiles(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftPaths = Object.keys(left);
  const rightPaths = Object.keys(right);
  return (
    leftPaths.length === rightPaths.length &&
    leftPaths.every((path) => left[path] === right[path])
  );
}

export function createInMemoryReferenceDraftRepository(
  initial: readonly DraftWorkspace[] = [],
): ReferenceDraftRepository {
  const drafts = new Map(
    initial.map((workspace) => [
      workspace.draft.draftId,
      cloneWorkspace(workspace),
    ]),
  );
  return {
    async get(draftId) {
      const workspace = drafts.get(draftId);
      return workspace ? cloneWorkspace(workspace) : undefined;
    },
    async reserve(workspace) {
      const draftId = workspace.draft.draftId;
      const existing = drafts.get(draftId);
      if (existing) {
        return { created: false, workspace: cloneWorkspace(existing) };
      }
      const reserved = cloneWorkspace(workspace);
      drafts.set(draftId, reserved);
      return { created: true, workspace: cloneWorkspace(reserved) };
    },
    async commitWorkspace({
      draftId,
      expectedRevision,
      expectedFiles,
      workspace,
    }) {
      const existing = drafts.get(draftId);
      if (
        existing === undefined ||
        existing.draft.revision !== expectedRevision ||
        !sameFiles(existing.files, expectedFiles)
      ) {
        return false;
      }
      drafts.set(draftId, cloneWorkspace(workspace));
      return true;
    },
  };
}
