import { Container } from "inversify";
import type { Logger } from "pino";
import type { AppConfig } from "../../config.js";
import { bindCore } from "./bindings/bind-core.js";
import { bindConnectors } from "./bindings/bind-connectors.js";
import { bindRepositories } from "./bindings/bind-repositories.js";
import { bindUsecases } from "./bindings/bind-usecases.js";
import { bindServices } from "./bindings/bind-services.js";
import { bindCvParsing } from "./bindings/bind-cv-parsing.js";
import { bindRateLimiting } from "./bindings/bind-rate-limiting.js";
import { bindMatchTicketStore } from "./bindings/bind-match-ticket-store.js";
import { bindScoring } from "./bindings/bind-scoring.js";

export function buildContainer(config: AppConfig, logger: Logger): Container {
  const container = new Container();

  bindCore(container, config, logger);
  bindConnectors(container, config);
  bindRepositories(container);
  bindCvParsing(container);
  bindRateLimiting(container);
  bindMatchTicketStore(container);
  bindScoring(container, config);
  bindUsecases(container);
  bindServices(container);

  return container;
}
