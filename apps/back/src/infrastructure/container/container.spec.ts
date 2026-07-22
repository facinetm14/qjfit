import { Container } from "./container.js";

interface TestDependencies {
  readonly greeting: string;
  readonly counter: { value: number };
  readonly shout: string;
}

describe("Container", () => {
  it("resolves a registered value via its factory", () => {
    const container = new Container<TestDependencies>();
    container.register("greeting", () => "hello");

    expect(container.resolve("greeting")).toBe("hello");
  });

  it("passes itself into the factory so dependencies can resolve each other", () => {
    const container = new Container<TestDependencies>();
    container.register("greeting", () => "hello");
    container.register(
      "shout",
      (c) => `${c.resolve("greeting").toUpperCase()}!`,
    );

    expect(container.resolve("shout")).toBe("HELLO!");
  });

  it("caches the resolved instance as a singleton", () => {
    const container = new Container<TestDependencies>();
    let calls = 0;
    container.register("counter", () => {
      calls += 1;
      return { value: calls };
    });

    const first = container.resolve("counter");
    const second = container.resolve("counter");

    expect(first).toBe(second);
    expect(calls).toBe(1);
  });

  it("throws a clear error when resolving an unregistered token", () => {
    const container = new Container<TestDependencies>();

    expect(() => container.resolve("greeting")).toThrow(
      'No registration found for token "greeting"',
    );
  });
});
