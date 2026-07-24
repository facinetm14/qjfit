import { Container } from "inversify";
import type { Logger } from "pino";
import type { AppConfig } from "../../config.js";
import { bindCore } from "./bindings/bind-core.js";
import { bindConnectors } from "./bindings/bind-connectors.js";
import { bindRepositories } from "./bindings/bind-repositories.js";
import { bindUsecases } from "./bindings/bind-usecases.js";
import { bindServices } from "./bindings/bind-services.js";

export function buildContainer(config: AppConfig, logger: Logger): Container {
  const container = new Container();

  bindCore(container, config, logger);
  bindConnectors(container, config);
  bindRepositories(container);
  bindUsecases(container);
  bindServices(container);

  return container;
}
