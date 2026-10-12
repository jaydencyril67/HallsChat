export type BackgroundTask = { id: string; label: string; status: string; startedAt: number };
type BackgroundTaskState = { tasks: BackgroundTask[]; lastResult: { id: string; label: string; status: string; error: boolean } | null; revision: number };
let state: BackgroundTaskState = { tasks: [], lastResult: null, revision: 0 };
const listeners = new Set<(next: BackgroundTaskState) => void>();
let nextId = 0;

function publish(patch: Partial<BackgroundTaskState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener(state));
}
export function getBackgroundTaskState() { return state; }
export function subscribeBackgroundTasks(listener: (next: BackgroundTaskState) => void) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
export function startBackgroundTask(label: string, status = "Working…") {
  const id = `background-task-${Date.now()}-${++nextId}`;
  publish({ tasks: [...state.tasks, { id, label, status, startedAt: Date.now() }] });
  return id;
}
export function updateBackgroundTask(id: string, status: string) {
  publish({ tasks: state.tasks.map(task => task.id === id ? { ...task, status } : task) });
}
export function finishBackgroundTask(id: string, error?: string) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const tasks = state.tasks.filter(item => item.id !== id);
  publish({
    tasks,
    lastResult: { id, label: task.label, status: error || (task.label.endsWith("…") ? "Completed." : `${task.label} completed.`), error: Boolean(error) },
    revision: state.revision + 1
  });
}
export type BackgroundTaskSnapshot = BackgroundTaskState;

export function dismissBackgroundTaskResult() {
  if (!state.lastResult) return;
  publish({ lastResult: null });
}
