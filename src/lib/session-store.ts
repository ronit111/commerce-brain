import { newSession, type Session } from "@/src/agents/orchestrator";

// In-memory session store. Fine for a single-instance demo; a production deploy
// would back this with Redis (documented in the README's real-vs-mocked matrix).
const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = newSession(id);
    sessions.set(id, s);
  }
  return s;
}

export function resetSession(id: string): void {
  sessions.set(id, newSession(id));
}
