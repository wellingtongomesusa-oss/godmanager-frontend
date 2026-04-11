export type TeamCategory = 'urgent' | 'general';

export type TeamMessage = {
  id: string;
  author: string;
  category: TeamCategory;
  text: string;
  createdAt: string;
  reads: number;
  reactions: {
    thumbsUp: number;
    heart: number;
    wow: number;
  };
};

const STORAGE_KEY = 'master-one-team-updates-v1';

function seedMessages(): TeamMessage[] {
  const now = Date.now();
  return [
    {
      id: 'seed-1',
      author: 'Ops',
      category: 'urgent',
      text: 'Fechamento mensal até 18h — conferir payouts.',
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      reads: 12,
      reactions: { thumbsUp: 3, heart: 1, wow: 0 },
    },
    {
      id: 'seed-2',
      author: 'Finance',
      category: 'general',
      text: 'Novo template 1099 disponível no drive compartilhado.',
      createdAt: new Date(now - 45 * 60_000).toISOString(),
      reads: 7,
      reactions: { thumbsUp: 5, heart: 2, wow: 1 },
    },
    {
      id: 'seed-3',
      author: 'AP',
      category: 'general',
      text: 'Reunião sync às 10 ET — link no calendário.',
      createdAt: new Date(now - 120 * 60_000).toISOString(),
      reads: 24,
      reactions: { thumbsUp: 2, heart: 0, wow: 0 },
    },
  ];
}

export function loadTeamMessages(): TeamMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seed = seedMessages();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as TeamMessage[];
    if (!Array.isArray(parsed)) return seedMessages();
    if (parsed.length === 0) return [];
    return parsed.map(normalizeMessage);
  } catch {
    return seedMessages();
  }
}

function normalizeMessage(m: TeamMessage): TeamMessage {
  return {
    ...m,
    reactions: m.reactions ?? { thumbsUp: 0, heart: 0, wow: 0 },
    reads: typeof m.reads === 'number' ? m.reads : 0,
  };
}

export function saveTeamMessages(messages: TeamMessage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export function createMessage(
  author: string,
  category: TeamCategory,
  text: string
): TeamMessage {
  const trimmed = text.slice(0, 60);
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    author: author.trim() || 'Anon',
    category,
    text: trimmed,
    createdAt: new Date().toISOString(),
    reads: 0,
    reactions: { thumbsUp: 0, heart: 0, wow: 0 },
  };
}
