import type { AgentType, TaskSpec } from "@aigf/core";

/** Agent 执行结果 */
export interface AgentResult {
  taskId: string;
  success: boolean;
  outputs: string[];
  error?: string;
}

/**
 * 专家 Agent 适配器接口。
 * 各模态 Agent（code/image/video/audio）实现此接口，供编排层调度。
 */
export interface AgentAdapter {
  readonly type: AgentType;
  dispatch(task: TaskSpec): Promise<AgentResult>;
}

/** 内置 Agent 注册表 */
export class AgentRegistry {
  private adapters = new Map<AgentType, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  get(type: AgentType): AgentAdapter | undefined {
    return this.adapters.get(type);
  }

  async dispatch(task: TaskSpec): Promise<AgentResult> {
    const adapter = this.adapters.get(task.agent);
    if (!adapter) {
      return {
        taskId: task.taskId,
        success: false,
        outputs: [],
        error: `未注册 Agent: ${task.agent}`,
      };
    }
    return adapter.dispatch(task);
  }
}
