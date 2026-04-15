import { getEncoding } from "js-tiktoken";

export type DigestContext = {
  date: string;
  github: {
    repo: string;
    events: { type: string; title: string; at: string }[];
  }[];
  calendar: {
    title: string;
    start: string;
    end: string;
    attendees: number;
  }[];
  tasks: {
    title: string;
    project: string;
    priority: string;
    dueDate: string | null;
    overdue: boolean;
  }[];
};

const TOKEN_BUDGETS = {
  github: 1000,
  calendar: 800,
  tasks: 800,
} as const;

// Reuse a single encoder instance — getEncoding has no .free() in js-tiktoken
const _enc = getEncoding("cl100k_base");

function countTokens(text: string): number {
  return _enc.encode(text).length;
}

function truncateToTokenBudget<T>(items: T[], budget: number, serializer: (items: T[]) => string): T[] {
  let result = items;
  while (result.length > 0 && countTokens(serializer(result)) > budget) {
    result = result.slice(0, result.length - 1);
  }
  return result;
}

export function buildDigestContext(
  params: {
    date: Date;
    githubEvents: { repo: string; type: string; title: string; eventAt: Date }[];
    calendarEvents: { googleId: string; title: string; description: string | null; startTime: Date; endTime: Date; attendeeCount: number }[];
    tasks: { todoistId: string; title: string; project: string | null; priority: string; dueDate: Date | null; completed: boolean }[];
    now?: Date;
  }
): DigestContext {
  const now = params.now ?? new Date();

  // Group GitHub events by repo
  const byRepo = new Map<string, { type: string; title: string; at: string }[]>();
  for (const e of params.githubEvents) {
    const existing = byRepo.get(e.repo) ?? [];
    existing.push({ type: e.type, title: e.title, at: e.eventAt.toISOString() });
    byRepo.set(e.repo, existing);
  }

  const githubRaw = Array.from(byRepo.entries()).map(([repo, events]) => ({ repo, events }));

  // Truncate GitHub to budget
  const github = truncateToTokenBudget(
    githubRaw,
    TOKEN_BUDGETS.github,
    (items) => JSON.stringify(items)
  );

  // Map calendar events — truncate description to 200 chars
  const calendarRaw = params.calendarEvents.map((e) => ({
    title: e.title,
    start: e.startTime.toISOString(),
    end: e.endTime.toISOString(),
    attendees: e.attendeeCount,
  }));

  const calendar = truncateToTokenBudget(
    calendarRaw,
    TOKEN_BUDGETS.calendar,
    (items) => JSON.stringify(items)
  );

  // Map tasks — exclude completed
  const tasksRaw = params.tasks
    .filter((t) => !t.completed)
    .map((t) => ({
      title: t.title,
      project: t.project ?? "Inbox",
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
      overdue: t.dueDate ? t.dueDate < now : false,
    }));

  const tasks = truncateToTokenBudget(
    tasksRaw,
    TOKEN_BUDGETS.tasks,
    (items) => JSON.stringify(items)
  );

  return {
    date: params.date.toISOString().split("T")[0],
    github,
    calendar,
    tasks,
  };
}
