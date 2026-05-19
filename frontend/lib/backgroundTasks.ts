export type BackgroundTask = {
  id: string;
  kind: string;
  createdAtMs: number;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
};

const queue: BackgroundTask[] = [];

export function enqueueBackgroundTask(task: Omit<BackgroundTask, 'createdAtMs' | 'attempt'>) {
  queue.push({ ...task, createdAtMs: Date.now(), attempt: 0 });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
}

export function nextDueTask(): BackgroundTask | null {
  return queue[0] ?? null;
}

export function completeTask(id: string) {
  const idx = queue.findIndex((t) => t.id === id);
  if (idx >= 0) queue.splice(idx, 1);
}
