import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVideoExternal } from "./video.js";
import type { VideoProviderConfig } from "./video-types.js";

describe("generateVideoExternal", () => {
  let tmpDir: string;
  let imagePath: string;
  let outputPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aigf-video-"));
    imagePath = path.join(tmpDir, "ref.png");
    outputPath = path.join(tmpDir, "out.mp4");
    await fs.writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("routes runway provider and downloads output", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/image_to_video")) {
        return new Response(JSON.stringify({ id: "task_runway_1", status: "PENDING" }), {
          status: 200,
        });
      }
      if (u.endsWith("/tasks/task_runway_1")) {
        return new Response(
          JSON.stringify({
            id: "task_runway_1",
            status: "SUCCEEDED",
            output: ["https://cdn.example.com/anim.mp4"],
          }),
          { status: 200 },
        );
      }
      if (u === "https://cdn.example.com/anim.mp4") {
        return new Response(Buffer.from("fake-mp4"), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: VideoProviderConfig = {
      apiKey: "rw_test",
      provider: "runway",
      model: "gen3a_turbo",
      baseUrl: "https://api.dev.runwayml.com/v1",
    };

    const result = await generateVideoExternal(config, {
      referenceImagePath: imagePath,
      outputPath,
      prompt: "ice spike cast",
      durationSeconds: 2,
    });

    expect(result).toBe(outputPath);
    const written = await fs.readFile(outputPath);
    expect(written.toString()).toBe("fake-mp4");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("routes kling bearer provider and downloads output", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/v1/videos/image2video")) {
        return new Response(JSON.stringify({ task_id: "kling_task_1" }), { status: 200 });
      }
      if (u.endsWith("/v1/videos/kling_task_1")) {
        return new Response(
          JSON.stringify({
            status: "completed",
            output: { video_url: "https://cdn.example.com/kling.mp4" },
          }),
          { status: 200 },
        );
      }
      if (u === "https://cdn.example.com/kling.mp4") {
        return new Response(Buffer.from("kling-mp4"), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: VideoProviderConfig = {
      apiKey: "kling_bearer",
      provider: "kling",
      model: "kling-v2.5-turbo",
      baseUrl: "https://api.klingapi.com",
    };

    await generateVideoExternal(config, {
      referenceImagePath: imagePath,
      outputPath,
      prompt: "cast animation",
    });

    const written = await fs.readFile(outputPath);
    expect(written.toString()).toBe("kling-mp4");
  });
});
