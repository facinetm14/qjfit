import { z } from "zod";
import { inject, injectable } from "inversify";
import type {
  FetchSourcePort,
  FetchSourceResult,
} from "../../../../../application/ports/output/fetch-source.port.js";
import type { RawJob } from "../../../../../domain/sources/raw-job.entity.js";
import { TYPES } from "../../../../container/types.js";
import { FranceTravailAuthClient } from "./france-travail-auth.client.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type Fetcher = (
  input: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<FetchResponse>;

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
  // "start-end" (e.g. "0-149"), max span 150 — sent as-is as the `range`
  // query param. Verified against real clients (job-search-france-travail-api,
  // api-offres-emploi), not assumed: France Travail paginates via a `range`
  // query param, not an HTTP Range header, and echoes a Content-Range
  // response header ("offres {first}-{last}/{total}").
  readonly range: string;
  readonly fetcher?: Fetcher;
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
    const url = `${this.options.baseUrl}/offres/search?range=${this.options.range}`;
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

    const jobs = parsed.data.resultats
      .map((offer) => this.toRawJob(offer))
      .filter((job): job is RawJob => job !== null);

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
      company: offer.entreprise?.nom?.trim() || "Unknown",
      location: offer.lieuTravail?.libelle?.trim() || "Unknown",
      description: offer.description?.trim() || "",
      url,
      publishedAt: this.toDateOrNull(offer.dateCreation),
      raw: offer,
    };
  }

  private toDateOrNull(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
