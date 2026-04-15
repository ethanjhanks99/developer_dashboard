const GITHUB_API = "https://api.github.com";

type GitHubCommit = {
  sha: string;
  commit: { message: string; author: { date: string } };
  repository?: { full_name: string };
};

type GitHubPR = {
  id: number;
  title: string;
  updated_at: string;
  base: { repo: { full_name: string } };
};

export type FetchedGitHubEvent = {
  type: "commit" | "pull_request";
  repo: string;
  title: string;
  sha?: string;
  eventAt: Date;
};

export async function fetchGitHubEvents(
  accessToken: string,
  githubLogin: string,
  since: Date
): Promise<FetchedGitHubEvent[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const sinceIso = since.toISOString();

  // Fetch recent push events to get commits
  const eventsRes = await fetch(
    `${GITHUB_API}/users/${githubLogin}/events?per_page=100`,
    { headers }
  );

  if (!eventsRes.ok) {
    throw new Error(`GitHub events API returned ${eventsRes.status}`);
  }

  const events = (await eventsRes.json()) as {
    type: string;
    created_at: string;
    repo: { name: string };
    payload: {
      commits?: { sha: string; message: string }[];
      head?: string;
      ref?: string;
      pull_request?: { title: string; updated_at: string };
      action?: string;
    };
  }[];

  const results: FetchedGitHubEvent[] = [];

  for (const event of events) {
    if (new Date(event.created_at) < since) continue;

    if (event.type === "PushEvent") {
      if (event.payload.commits && event.payload.commits.length > 0) {
        for (const commit of event.payload.commits) {
          results.push({
            type: "commit",
            repo: event.repo.name,
            title: commit.message.split("\n")[0].slice(0, 200),
            sha: commit.sha,
            eventAt: new Date(event.created_at),
          });
        }
      } else if (event.payload.head) {
        // Private repo push: commits array is stripped, use head SHA + branch
        const branch = event.payload.ref?.replace("refs/heads/", "") ?? "unknown";
        results.push({
          type: "commit",
          repo: event.repo.name,
          title: `Pushed to ${branch} (${event.payload.head.slice(0, 7)})`,
          sha: event.payload.head,
          eventAt: new Date(event.created_at),
        });
      }
    }

    if (
      event.type === "PullRequestEvent" &&
      event.payload.pull_request &&
      (event.payload.action === "opened" || event.payload.action === "closed")
    ) {
      results.push({
        type: "pull_request",
        repo: event.repo.name,
        title: event.payload.pull_request.title.slice(0, 200),
        eventAt: new Date(event.created_at),
      });
    }
  }

  return results;
}
