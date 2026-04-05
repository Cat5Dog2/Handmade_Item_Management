import request from "supertest";
import { createApp } from "./app";

describe("createApp", () => {
  it("returns the health payload", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: "ok",
        service: "handmade-sales-api"
      }
    });
  });
});
