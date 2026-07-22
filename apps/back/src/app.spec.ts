import request from "supertest";
import pino from "pino";
import { createApp } from "./app";

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === "1";
const maybeIt = canBindLocalPort ? it : it.skip;

describe("createApp", () => {
  maybeIt("returns 200 for health endpoint", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  maybeIt("returns 404 for the retired profile routes", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger);

    const getResponse = await request(app).get("/api/profile");
    const putResponse = await request(app).put("/api/profile").send({});

    expect(getResponse.status).toBe(404);
    expect(putResponse.status).toBe(404);
  });

  maybeIt("returns 404 for the retired fetch-trigger route", async () => {
    const logger = pino({ enabled: false });
    const app = createApp(logger);

    const response = await request(app).post("/api/fetch").send({});

    expect(response.status).toBe(404);
  });
});
