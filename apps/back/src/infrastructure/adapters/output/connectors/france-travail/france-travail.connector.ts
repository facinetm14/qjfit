import { z } from "zod";
import { inject, injectable } from "inversify";
import type {
  FetchSourcePort,
  FetchSourceResult,
} from "../../../../../application/ports/output/fetch-source.port.js";
import type { RawJob } from "../../../../../domain/sources/raw-job.entity.js";
import { parseDate } from "../../../../../domain/sources/parse-date.js";
import { TYPES } from "../../../../container/types.js";
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

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  async fetch(_runId: string): Promise<FetchSourceResult> {
    const accessToken = await this.authClient.getAccessToken();
    const fetcher = this.options.fetcher ?? fetch;
    const sleep = this.options.sleep ?? defaultSleep;
    const pageSize = Math.min(this.options.pageSize, MAX_PAGE_SPAN);

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
      const url = `${this.options.baseUrl}/offres/search?range=${offset}-${rangeEnd}`;
      const response = await fetcher(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

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
