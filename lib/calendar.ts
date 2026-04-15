const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type FetchedCalendarEvent = {
  googleId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  attendeeCount: number;
};

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<FetchedCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API returned ${res.status}`);
  }

  const data = (await res.json()) as {
    items: {
      id: string;
      summary?: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: { email: string }[];
    }[];
  };

  return (data.items ?? []).map((item) => ({
    googleId: item.id,
    title: item.summary ?? "(No title)",
    description: item.description ? item.description.slice(0, 200) : null,
    startTime: new Date(item.start.dateTime ?? item.start.date ?? ""),
    endTime: new Date(item.end.dateTime ?? item.end.date ?? ""),
    attendeeCount: item.attendees?.length ?? 0,
  }));
}

export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
