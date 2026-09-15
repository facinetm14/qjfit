// PRD §4: the match-ticket cache must use a short TTL (minutes, not hours) —
// there's no account for a visitor to come back to later.
export const MATCH_TICKET_TTL_MS = 10 * 60 * 1000;
