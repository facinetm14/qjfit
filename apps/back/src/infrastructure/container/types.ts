import { PORT_TYPES } from "../../application/tokens.js";

/**
 * Every DI token this app can bind/inject: application-layer port/use-case
 * tokens (re-exported from application/tokens.ts) plus infrastructure-only
 * tokens (raw config values, the Prisma client, the scheduler adapter).
 */
export const TYPES = {
  ...PORT_TYPES,
  Config: Symbol.for("Config"),
  PrismaClient: Symbol.for("PrismaClient"),
  RedisClient: Symbol.for("RedisClient"),
  FranceTravailConnectorOptions: Symbol.for("FranceTravailConnectorOptions"),
  FranceTravailAuthClientOptions: Symbol.for(
    "FranceTravailAuthClientOptions",
  ),
  FranceTravailAuthClient: Symbol.for("FranceTravailAuthClient"),
  WttjRssConnectorOptions: Symbol.for("WttjRssConnectorOptions"),
  FetchRunScheduler: Symbol.for("FetchRunScheduler"),
  PdfCvTextExtractor: Symbol.for("PdfCvTextExtractor"),
  PdfCvTextExtractorOptions: Symbol.for("PdfCvTextExtractorOptions"),
  DocxCvTextExtractor: Symbol.for("DocxCvTextExtractor"),
  OpenRouterScoringProviderAdapterOptions: Symbol.for(
    "OpenRouterScoringProviderAdapterOptions",
  ),
} as const;
