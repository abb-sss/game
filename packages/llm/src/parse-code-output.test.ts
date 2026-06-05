import { describe, expect, it } from "vitest";
import { parseCodeOutput } from "./parse-code-output.js";

describe("parseCodeOutput", () => {
  it("parses JSON format", () => {
    const raw = JSON.stringify({
      files: [{ path: "src/a.ts", content: "export const a = 1;" }],
    });
    const files = parseCodeOutput(raw);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/a.ts");
  });

  it("parses markdown code blocks with path", () => {
    const raw = '```typescript:src/skills/ice.ts\nexport class Ice {}\n```';
    const files = parseCodeOutput(raw);
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain("class Ice");
  });
});
