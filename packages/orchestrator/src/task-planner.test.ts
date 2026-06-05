import { describe, expect, it } from "vitest";
import { planTasksFromIntent } from "./task-planner.js";

describe("planTasksFromIntent", () => {
  it("plans skill tasks for 冰锥术", () => {
    const plan = planTasksFromIntent({
      userIntent: "添加冰锥术技能",
      projectRoot: ".",
    });

    expect(plan.tasks.length).toBe(4);
    expect(plan.tasks.some((t) => t.agent === "code")).toBe(true);
    expect(plan.tasks.some((t) => t.agent === "image")).toBe(true);
    expect(plan.tasks.find((t) => t.agent === "code")?.dependsOn.length).toBe(3);
    expect(plan.tasks.some((t) => t.agent === "video")).toBe(true);
  });
});
