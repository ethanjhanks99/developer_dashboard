import { describe, it, expect } from "vitest";
import { buildDigestContext } from "./context";

const NOW = new Date("2024-01-15T09:00:00Z");
const TODAY = "2024-01-15";

const baseParams = {
  date: NOW,
  githubEvents: [],
  calendarEvents: [],
  tasks: [],
  now: NOW,
};

describe("buildDigestContext", () => {
  it("returns the correct ISO date string for the given date", () => {
    const ctx = buildDigestContext(baseParams);
    expect(ctx.date).toBe(TODAY);
  });

  it("returns an empty github array when no events are provided", () => {
    const ctx = buildDigestContext(baseParams);
    expect(ctx.github).toEqual([]);
  });

  it("groups github events by repository", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      githubEvents: [
        { repo: "owner/repo-a", type: "commit", title: "Fix bug", eventAt: NOW },
        { repo: "owner/repo-a", type: "commit", title: "Add feature", eventAt: NOW },
        { repo: "owner/repo-b", type: "pull_request", title: "PR title", eventAt: NOW },
      ],
    });

    const repoA = ctx.github.find((g) => g.repo === "owner/repo-a");
    const repoB = ctx.github.find((g) => g.repo === "owner/repo-b");

    expect(repoA?.events).toHaveLength(2);
    expect(repoB?.events).toHaveLength(1);
  });

  it("maps github event fields correctly", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      githubEvents: [{ repo: "owner/repo", type: "commit", title: "My commit", eventAt: NOW }],
    });

    expect(ctx.github[0].events[0]).toEqual({
      type: "commit",
      title: "My commit",
      at: NOW.toISOString(),
    });
  });

  it("excludes completed tasks from the context", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "Done task",
          project: "Work",
          priority: "normal",
          dueDate: null,
          completed: true,
        },
        {
          todoistId: "2",
          title: "Open task",
          project: "Work",
          priority: "normal",
          dueDate: null,
          completed: false,
        },
      ],
    });

    expect(ctx.tasks).toHaveLength(1);
    expect(ctx.tasks[0].title).toBe("Open task");
  });

  it("marks a task as overdue when its dueDate is before now", () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "Overdue task",
          project: "Work",
          priority: "high",
          dueDate: yesterday,
          completed: false,
        },
      ],
    });

    expect(ctx.tasks[0].overdue).toBe(true);
  });

  it("does not mark a task as overdue when its dueDate is in the future", () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "Future task",
          project: "Work",
          priority: "normal",
          dueDate: tomorrow,
          completed: false,
        },
      ],
    });

    expect(ctx.tasks[0].overdue).toBe(false);
  });

  it("does not mark a task as overdue when it has no dueDate", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "No due date task",
          project: null,
          priority: "normal",
          dueDate: null,
          completed: false,
        },
      ],
    });

    expect(ctx.tasks[0].overdue).toBe(false);
  });

  it("uses 'Inbox' as the project name when project is null", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "Task without project",
          project: null,
          priority: "normal",
          dueDate: null,
          completed: false,
        },
      ],
    });

    expect(ctx.tasks[0].project).toBe("Inbox");
  });

  it("formats task dueDate as a date-only string", () => {
    const ctx = buildDigestContext({
      ...baseParams,
      tasks: [
        {
          todoistId: "1",
          title: "Task",
          project: "Work",
          priority: "normal",
          dueDate: new Date("2024-01-20T14:00:00Z"),
          completed: false,
        },
      ],
    });

    expect(ctx.tasks[0].dueDate).toBe("2024-01-20");
  });

  it("maps calendar event fields correctly", () => {
    const start = new Date("2024-01-15T10:00:00Z");
    const end = new Date("2024-01-15T11:00:00Z");

    const ctx = buildDigestContext({
      ...baseParams,
      calendarEvents: [
        {
          googleId: "evt-1",
          title: "Team standup",
          description: null,
          startTime: start,
          endTime: end,
          attendeeCount: 5,
        },
      ],
    });

    expect(ctx.calendar[0]).toEqual({
      title: "Team standup",
      start: start.toISOString(),
      end: end.toISOString(),
      attendees: 5,
    });
  });
});
