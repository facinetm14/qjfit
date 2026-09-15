import { XMLParser, XMLValidator } from "fast-xml-parser";
import { inject, injectable } from "inversify";
import type {
  FetchSourcePort,
  FetchSourceQuery,
  FetchSourceResult,
} from "../../../../../application/ports/fetch-source.port.js";
import type { RawJob } from "@shared/domain/raw-job.entity.js";
import { parseDate } from "../shared/parse-date.js";
import { TYPES } from "@composition-root/container/types.js";
import { firstNonBlank } from "../shared/first-non-blank.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type Fetcher = (
  input: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<FetchResponse>;

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true,
});

export interface WttjRssConnectorOptions {
  readonly feedUrl: string;
  readonly fetcher?: Fetcher;
}

@injectable()
export class WttjRssConnector implements FetchSourcePort {
  readonly source = "wttj-rss";

  constructor(
    @inject(TYPES.WttjRssConnectorOptions)
    private readonly options: WttjRssConnectorOptions,
  ) {}

  // A fixed feed URL per deployment can't be scoped by query (ADR 0021 §8) —
  // the query param is accepted only to satisfy FetchSourcePort; the local
  // relevance pre-filter stays this source's safety net once wired in.
  async fetch(
    _runId: string,
    _query: FetchSourceQuery | null = null,
  ): Promise<FetchSourceResult> {
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(this.options.feedUrl);

    if (!response.ok) {
      throw new Error(`WTTJ RSS request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      throw new Error("WTTJ RSS payload is invalid XML");
    }

    const parsed = parser.parse(xml) as {
      rss?: {
        channel?: {
          item?: unknown;
        };
      };
    };

    const items = this.normalizeItems(parsed.rss?.channel?.item);
    const jobs = items
      .map((item) => this.toRawJob(item))
      .filter((job): job is RawJob => job !== null);

    return { jobs };
  }

  private normalizeItems(input: unknown): readonly Record<string, unknown>[] {
    if (!input) {
      return [];
    }

    return Array.isArray(input)
      ? input.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
      : typeof input === "object"
        ? [input as Record<string, unknown>]
        : [];
  }

  private toRawJob(item: Record<string, unknown>): RawJob | null {
    const title = this.readString(item.title);
    const url = this.readString(item.link);

    if (!title || !url) {
      return null;
    }

    return {
      source: this.source,
      sourceJobId: this.readString(item.guid),
      title,
      company: firstNonBlank(
        [this.readString(item.company), this.readString(item.author)],
        "Unknown",
      ),
      location: firstNonBlank([this.readString(item.location)], "Unknown"),
      description: firstNonBlank([this.readString(item.description)], ""),
      url,
      publishedAt: parseDate(this.readString(item.pubDate)),
      raw: item,
    };
  }

  private readString(value: unknown): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    return null;
  }
}
