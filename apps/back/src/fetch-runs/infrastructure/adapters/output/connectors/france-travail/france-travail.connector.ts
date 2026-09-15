import { z } from "zod";
import { inject, injectable } from "inversify";
import type {
  FetchSourcePort,
  FetchSourceQuery,
  FetchSourceResult,
} from "../../../../../application/ports/fetch-source.port.js";
import type { RawJob } from "@shared/domain/raw-job.entity.js";
import type { ContractType } from "@shared/domain/contract-type.js";
import { parseDate } from "../shared/parse-date.js";
import { TYPES } from "@composition-root/container/types.js";
import { FranceTravailAuthClient } from "./france-travail-auth.client.js";
import { firstNonBlank } from "../shared/first-non-blank.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

type Fetcher = (
  input: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<FetchResponse>;

// France Travail's per-request `range` window is capped at 150 results —
// verified against real clients (job-search-france-travail-api,
// api-offres-emploi): the API returns a 400 for a wider span.
const MAX_PAGE_SPAN = 150;

// The API only ever exposes the first 1150 matching offers, i.e. `range`
// windows from "0-0" up to "1000-1149" — verified against
// github.com/creach-t/job-search-france-travail-api
// (src/utils/constants.js: `MAX_TOTAL: 1150 // Limite navigable (range max
// 0-1149)`). Paging past this index isn't a "get more" problem, it's a hard
// platform limit.
const MAX_NAVIGABLE_LAST_INDEX = 1149;

// This app's registered France Travail rate limit; page requests are spaced
// out to stay under it instead of relying on 429 retries.
const REQUESTS_PER_SECOND_LIMIT = 10;
const MIN_REQUEST_INTERVAL_MS = 1000 / REQUESTS_PER_SECOND_LIMIT;

// Transient connection failures (e.g. ECONNRESET) surface as a rejected
// fetch rather than a response; a page request is retried a few times
// before giving up on the whole source, matching the same rationale as
// FranceTravailAuthClient's retry.
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// INSEE COG (Code Officiel Géographique) commune codes for the city keywords
// `extract-cv-context.ts`'s LOCATION_KEYWORDS can produce — public INSEE
// reference data, not a France Travail-specific contract. Only "Paris"
// (75056) was independently re-verified live against `/offres/search` in
// ADR 0021's Context section; the rest follow the same INSEE numbering
// scheme and are not yet spot-checked live one-by-one.
const CITY_TO_COMMUNE_CODE: Readonly<Record<string, string>> = {
  Paris: "75056",
  Lyon: "69123",
  Marseille: "13055",
  Toulouse: "31555",
  Bordeaux: "33063",
  Lille: "59350",
  Nantes: "44109",
  Nice: "06088",
  Strasbourg: "67482",
  Rennes: "35238",
  Montpellier: "34172",
};

// INSEE region codes (2016 boundaries — matches @shared/domain/french-region.ts's
// department->region table). Only "Île-de-France" (11) was independently
// re-verified live in ADR 0021's Context section; the rest follow the same
// INSEE numbering scheme.
const REGION_TO_CODE: Readonly<Record<string, string>> = {
  "Île-de-France": "11",
  "Centre-Val de Loire": "24",
  "Bourgogne-Franche-Comté": "27",
  Normandie: "28",
  "Hauts-de-France": "32",
  "Grand Est": "44",
  "Pays de la Loire": "52",
  Bretagne: "53",
  "Nouvelle-Aquitaine": "75",
  Occitanie: "76",
  "Auvergne-Rhône-Alpes": "84",
  "Provence-Alpes-Côte d'Azur": "93",
  Corse: "94",
  Guadeloupe: "01",
  Martinique: "02",
  Guyane: "03",
  "La Réunion": "04",
  Mayotte: "06",
};

// "Remote"/"Télétravail" (also valid CV mobility keywords, see
// LOCATION_KEYWORDS) have no France Travail geo-scope equivalent — they
// resolve to neither table below, so no location param is sent for them.
function resolveLocationParam(
  location: string | null,
): { readonly param: "commune" | "region"; readonly value: string } | null {
  if (!location) {
    return null;
  }

  const communeCode = CITY_TO_COMMUNE_CODE[location];
  if (communeCode) {
    return { param: "commune", value: communeCode };
  }

  const regionCode = REGION_TO_CODE[location];
  if (regionCode) {
    return { param: "region", value: regionCode };
  }

  return null;
}

// ADR 0021 Context: of the confirmed-real `typeContrat` codes (CCE, CDD,
// CDI, DDI, DIN, FRA, LIB, MIS), only CDI/CDD map cleanly onto this
// codebase's ContractType values — Freelance/Internship/Apprenticeship/Other
// are left unmapped rather than guessed, per that ADR's explicit gap.
const CONTRACT_TYPE_TO_CODE: Readonly<Partial<Record<ContractType, string>>> = {
  CDI: "CDI",
  CDD: "CDD",
};

function resolveContractTypeCode(
  contractTypes: readonly ContractType[],
): string | null {
  for (const contractType of contractTypes) {
    const code = CONTRACT_TYPE_TO_CODE[contractType];
    if (code) {
      return code;
    }
  }
  return null;
}

// Built once per fetch() call — independent of the paginated `range` window
// — and appended to every page request.
function buildScopedQueryParams(query: FetchSourceQuery | null): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  params.set("motsCles", query.targetRole);

  const location = resolveLocationParam(query.location);
  if (location) {
    params.set(location.param, location.value);
  }

  const contractTypeCode = resolveContractTypeCode(query.contractTypes);
  if (contractTypeCode) {
    params.set("typeContrat", contractTypeCode);
  }

  return `&${params.toString()}`;
}

function parseContentRangeTotal(response: FetchResponse): number | null {
  const header = response.headers.get("Content-Range");
  if (!header) {
    return null;
  }

  // Documented/observed shape: "offres {first}-{last}/{total}".
  const match = /^offres \d+-\d+\/(\d+)$/.exec(header);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

const franceTravailOfferSchema = z.object({
  id: z.string().optional(),
  intitule: z.string().optional(),
  description: z.string().optional(),
  dateCreation: z.string().optional(),
  lieuTravail: z
    .object({
      libelle: z.string().optional(),
    })
    .optional(),
  entreprise: z
    .object({
      nom: z.string().optional(),
    })
    .optional(),
  origineOffre: z
    .object({
      urlOrigine: z.string().optional(),
    })
    .optional(),
});

const franceTravailResponseSchema = z.object({
  resultats: z.array(franceTravailOfferSchema),
});

export interface FranceTravailConnectorOptions {
  readonly baseUrl: string;
  // Requested `range` window size per page — clamped to MAX_PAGE_SPAN (150).
  readonly pageSize: number;
  readonly fetcher?: Fetcher;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
}

@injectable()
export class FranceTravailConnector implements FetchSourcePort {
  readonly source = "france-travail";

  constructor(
    @inject(TYPES.FranceTravailConnectorOptions)
    private readonly options: FranceTravailConnectorOptions,
    @inject(TYPES.FranceTravailAuthClient)
    private readonly authClient: FranceTravailAuthClient,
  ) {}

  async fetch(
    _runId: string,
    query: FetchSourceQuery | null = null,
  ): Promise<FetchSourceResult> {
    const accessToken = await this.authClient.getAccessToken();
    const fetcher = this.options.fetcher ?? fetch;
    const sleep = this.options.sleep ?? defaultSleep;
    const pageSize = Math.min(this.options.pageSize, MAX_PAGE_SPAN);
    const scopedQueryParams = buildScopedQueryParams(query);

    const jobs: RawJob[] = [];
    let offset = 0;
    let isFirstRequest = true;

    while (offset <= MAX_NAVIGABLE_LAST_INDEX) {
      if (!isFirstRequest) {
        await sleep(MIN_REQUEST_INTERVAL_MS);
      }

      isFirstRequest = false;

      const rangeEnd = Math.min(offset + pageSize - 1, MAX_NAVIGABLE_LAST_INDEX);
      const requestedCount = rangeEnd - offset + 1;
      const url = `${this.options.baseUrl}/offres/search?range=${offset}-${rangeEnd}${scopedQueryParams}`;
      const response = await this.fetchWithRetry(
        fetcher,
        url,
        { Authorization: `Bearer ${accessToken}` },
        sleep,
      );

      if (!response.ok) {
        throw new Error(
          `France Travail request failed with status ${response.status}`,
        );
      }

      const payload = await response.json();
      const parsed = franceTravailResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("France Travail response payload is invalid");
      }

      const pageJobs = parsed.data.resultats
        .map((offer) => this.toRawJob(offer))
        .filter((job): job is RawJob => job !== null);
      jobs.push(...pageJobs);

      const total = parseContentRangeTotal(response);
      offset += pageSize;

      const receivedFullPage = parsed.data.resultats.length >= requestedCount;
      const reachedKnownTotal = total !== null && offset >= total;
      if (!receivedFullPage || reachedKnownTotal) {
        break;
      }
    }

    return { jobs };
  }

  private async fetchWithRetry(
    fetcher: Fetcher,
    url: string,
    headers: Record<string, string>,
    sleep: (ms: number) => Promise<void>,
  ): Promise<FetchResponse> {
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelayMs = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    let attempt = 0;
    for (;;) {
      try {
        return await fetcher(url, { headers });
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) {
          throw error;
        }
        await sleep(retryDelayMs);
      }
    }
  }

  private toRawJob(
    offer: z.infer<typeof franceTravailOfferSchema>,
  ): RawJob | null {
    const title = offer.intitule?.trim() ?? "";
    const url = offer.origineOffre?.urlOrigine?.trim() ?? "";

    if (!title || !url) {
      return null;
    }

    return {
      source: this.source,
      sourceJobId: offer.id ?? null,
      title,
      company: firstNonBlank([offer.entreprise?.nom], "Unknown"),
      location: firstNonBlank([offer.lieuTravail?.libelle], "Unknown"),
      description: firstNonBlank([offer.description], ""),
      url,
      publishedAt: parseDate(offer.dateCreation),
      raw: offer,
    };
  }
}
