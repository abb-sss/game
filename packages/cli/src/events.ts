import fsp from "node:fs/promises";
import path from "node:path";

export interface AigfEvent {
  timestamp: string;
  type: string;
  taskId?: string;
  agent?: string;
  status?: string;
  message?: string;
}

export async function appendEvent(
  projectRoot: string,
  event: Omit<AigfEvent, "timestamp">,
): Promise<void> {
  const dir = path.join(projectRoot, ".aigf");
  await fsp.mkdir(dir, { recursive: true });

  const entry: AigfEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  await fsp.appendFile(
    path.join(dir, "events.jsonl"),
    JSON.stringify(entry) + "\n",
    "utf-8",
  );

  await fsp.writeFile(
    path.join(dir, "last-event.json"),
    JSON.stringify(entry, null, 2),
    "utf-8",
  );
}

export async function readRecentEvents(
  projectRoot: string,
  limit = 50,
): Promise<AigfEvent[]> {
  try {
    const raw = await fsp.readFile(
      path.join(path.resolve(projectRoot), ".aigf", "events.jsonl"),
      "utf-8",
    );
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as AigfEvent);
  } catch {
    return [];
  }
}
