const TODOIST_API = "https://api.todoist.com/rest/v2";

const PRIORITY_MAP: Record<number, string> = {
  1: "normal",
  2: "normal",
  3: "high",
  4: "urgent",
};

export type FetchedTask = {
  todoistId: string;
  title: string;
  project: string | null;
  priority: string;
  dueDate: Date | null;
  completed: boolean;
};

export async function fetchTodoistTasks(accessToken: string): Promise<FetchedTask[]> {
  const res = await fetch(`${TODOIST_API}/tasks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Todoist API returned ${res.status}`);
  }

  const tasks = (await res.json()) as {
    id: string;
    content: string;
    project_id: string;
    priority: number;
    due?: { date: string };
    is_completed: boolean;
  }[];

  return tasks.map((task) => ({
    todoistId: task.id,
    title: task.content.slice(0, 200),
    project: task.project_id ?? null,
    priority: PRIORITY_MAP[task.priority] ?? "normal",
    dueDate: task.due?.date ? new Date(task.due.date) : null,
    completed: task.is_completed,
  }));
}
