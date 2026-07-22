export type Factory<TDeps extends object, K extends keyof TDeps> = (
  container: Container<TDeps>,
) => TDeps[K];

/**
 * Minimal IoC container: register a factory per token, resolve lazily,
 * cache each resolution as a singleton. A factory can resolve other
 * tokens through the container instance it receives.
 */
export class Container<TDeps extends object> {
  private readonly factories = new Map<keyof TDeps, Factory<TDeps, keyof TDeps>>();
  private readonly singletons = new Map<keyof TDeps, TDeps[keyof TDeps]>();

  register<K extends keyof TDeps>(token: K, factory: Factory<TDeps, K>): void {
    this.factories.set(token, factory as Factory<TDeps, keyof TDeps>);
  }

  resolve<K extends keyof TDeps>(token: K): TDeps[K] {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as TDeps[K];
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No registration found for token "${String(token)}"`);
    }

    const instance = factory(this);
    this.singletons.set(token, instance);
    return instance as TDeps[K];
  }
}
