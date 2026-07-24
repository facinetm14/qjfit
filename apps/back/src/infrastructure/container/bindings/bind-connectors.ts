import type { Container } from "inversify";
import type { AppConfig } from "../../../config.js";
import {
  FranceTravailConnector,
  type FranceTravailConnectorOptions,
} from "../../adapters/output/connectors/france-travail/france-travail.connector.js";
import {
  FranceTravailAuthClient,
  type FranceTravailAuthClientOptions,
} from "../../adapters/output/connectors/france-travail/france-travail-auth.client.js";
import {
  WttjRssConnector,
  type WttjRssConnectorOptions,
} from "../../adapters/output/connectors/wttj-rss/wttj-rss.connector.js";
import { TYPES } from "../types.js";

export function bindConnectors(container: Container, config: AppConfig): void {
  container
    .bind<FranceTravailConnectorOptions>(TYPES.FranceTravailConnectorOptions)
    .toConstantValue({
      baseUrl: config.FRANCE_TRAVAIL_BASE_URL,
      pageSize: config.FRANCE_TRAVAIL_PAGE_SIZE,
    });
  container
    .bind<FranceTravailAuthClientOptions>(TYPES.FranceTravailAuthClientOptions)
    .toConstantValue({
      authUrl: config.FRANCE_TRAVAIL_AUTH_URL,
      clientId: config.FRANCE_TRAVAIL_CLIENT_ID,
      clientSecret: config.FRANCE_TRAVAIL_CLIENT_SECRET,
      scope: config.FRANCE_TRAVAIL_SCOPE,
    });
  container
    .bind(TYPES.FranceTravailAuthClient)
    .to(FranceTravailAuthClient)
    .inSingletonScope();

  container
    .bind(TYPES.FetchSource)
    .to(FranceTravailConnector)
    .inSingletonScope();

  //TODO: I'll unccomment this when I have a WTTJ RSS feed to test with.  

  // container
  //   .bind<WttjRssConnectorOptions>(TYPES.WttjRssConnectorOptions)
  //   .toConstantValue({ feedUrl: config.WTTJ_RSS_FEED_URL });
  // container.bind(TYPES.FetchSource).to(WttjRssConnector).inSingletonScope();
}
