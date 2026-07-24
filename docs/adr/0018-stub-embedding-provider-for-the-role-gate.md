# ADR 0018: Stub the Role Gate's Embedding Similarity Ahead of a Real Provider

## Status
Accepted

## Date
2026-07-25

## Context

The relevance pre-filter's role gate (`domain/scoring/relevance-filter.ts`,
issue #5) gated a job on a hardcoded `ROLE_FAMILY_TITLE_INDICATORS` list —
English/French title-keyword fragments like "developer"/"développeur"/"full
stack". This required hand-maintaining every synonym: a CV stating
"Full-Stack Developer" wouldn't clear the gate for a job titled "Software
Engineer" or "Ingénieur Logiciel" unless someone had already added that exact
wording to the list (issue #14).

The real fix is semantic similarity between the CV's stated target role and
the job's title, which needs an embedding model. Building that integration
first — provider selection, an API key, latency, cost — would block the rest
of the role-gate rework the same way a real LLM integration would have
blocked issue #6's results UI, which ADR 0017 avoided by stubbing
`ScoringProviderPort`.

## Decision

Introduce `EmbeddingProviderPort` (`application/ports/output/`), mirroring
`ScoringProviderPort`'s shape — a single `embed(text): Promise<readonly
number[]>` method — and bind it to a new `StubEmbeddingProviderAdapter`
(`infrastructure/adapters/output/embedding/`) instead of a real
embedding-model adapter, following ADR 0017's precedent exactly.

The stub is deterministic and makes no external call: it lowercases and
strips diacritics from the input text, extracts character trigrams, hashes
each into a fixed 128-dimension vector (a feature-hashing / "hashing trick"
bag-of-trigrams), and L2-normalizes the result so cosine similarity between
two embeddings reduces to a plain dot product. Character trigrams (rather
than whole-word tokens) are what make this stub usable for the role gate's
actual data: they catch lexical cognates across English/French job-market
wording ("developer" / "développeur", "engineer" / "ingénieur") that a
whole-word hash would score as entirely unrelated, without needing a real
model.

`domain/scoring/relevance-filter.ts` gains a locally-declared
`RoleSimilarityProvider` interface (`{ embed(text): Promise<readonly
number[]> }`) instead of importing `EmbeddingProviderPort` directly — the
domain layer stays free of application-layer imports (AGENTS.md rule 13);
the real port satisfies this shape structurally. `computeRelevanceScore` and
`filterRelevantJobs` are now async, taking the provider and a configurable
`ROLE_SIMILARITY_THRESHOLD` (default `0.25`, chosen empirically: in the
stub's vector space, the existing role-gate test fixtures separate cleanly —
related titles score >= 0.40, unrelated titles score <= 0.16). The strong
exact-substring match (`hasStrongRoleMatch`) stays a synchronous literal
check ahead of the embedding call, so no embedding call happens for the
common case of an exact title match, or when the CV states no target role at
all.

Swapping in a real embedding-model adapter later is a single binding change
in `bind-scoring.ts`, same as ADR 0017's remaining real-`ScoringProviderPort`
swap; no other code (relevance filter, use case, tests) needs to change
beyond re-tuning `ROLE_SIMILARITY_THRESHOLD` for the real model's similarity
distribution.

## Consequences

- The role gate no longer requires hand-maintaining a keyword-synonym list
  for every new title wording; the mechanism generalizes without a code
  change once a real embedding model is wired in.
- The stub's character-trigram similarity is a coarse, deterministic
  approximation, not a genuine semantic embedding — it should not be
  presented as one, and its threshold will need re-tuning once a real
  provider is bound (a real model's cosine-similarity distribution won't
  match the stub's).
- `filterRelevantJobs` now computes an embedding-similarity check per
  candidate job (when the CV states a target role and no exact title match
  exists), same performance profile concern ADR 0017 already accepted for
  the (still-deferred) real LLM scoring call — bounded concurrency for a
  real embedding provider is left to that future integration, not addressed
  here.
