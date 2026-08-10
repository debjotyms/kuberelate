import type {
  AnalysisDiagnostic,
  ResourceId,
  SafeEvidenceItem,
  SourceRange,
  StaticCertainty,
} from '@/domain/model/analysis'

export type AnalysisDiagnosticInput = Omit<
  AnalysisDiagnostic,
  | 'id'
  | 'certainty'
  | 'evidence'
  | 'verificationCommands'
  | 'sourceRanges'
  | 'resourceIds'
  | 'relationshipIds'
> & {
  readonly certainty?: StaticCertainty
  readonly evidence?: readonly SafeEvidenceItem[]
  readonly verificationCommands?: readonly string[]
  readonly sourceRanges?: readonly SourceRange[]
  readonly resourceIds?: readonly ResourceId[]
  readonly relationshipIds?: readonly string[]
}

export function createDiagnostic(input: AnalysisDiagnosticInput): AnalysisDiagnostic {
  const offset = input.range?.start.offset ?? 0
  const documentPart = input.documentIndex === undefined ? 'global' : String(input.documentIndex)

  return {
    ...input,
    id: `${input.code}:${documentPart}:${offset}`,
    certainty: input.certainty ?? 'definite',
    evidence: input.evidence ?? [],
    verificationCommands: input.verificationCommands ?? [],
    sourceRanges: input.sourceRanges ?? (input.range ? [input.range] : []),
    resourceIds: input.resourceIds ?? [],
    relationshipIds: input.relationshipIds ?? [],
  }
}
