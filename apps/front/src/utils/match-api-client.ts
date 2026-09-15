import type { ApiCreateMatchResponse, ApiMatchTicket, ApiRateLimitExceededResponse } from '../types/match-api.js';

export type SubmitCvMatchResult =
  | { readonly kind: 'accepted'; readonly response: ApiCreateMatchResponse }
  | { readonly kind: 'rate-limited'; readonly response: ApiRateLimitExceededResponse }
  | { readonly kind: 'error'; readonly message: string };

export async function submitCvMatch(file: File): Promise<SubmitCvMatchResult> {
  const formData = new FormData();
  formData.append('cv', file);
  const response = await fetch('/api/match', { method: 'POST', body: formData });

  if (response.status === 429) {
    return { kind: 'rate-limited', response: (await response.json()) as ApiRateLimitExceededResponse };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return { kind: 'error', message: body.error ?? 'Unable to submit your CV. Please try again.' };
  }
  return { kind: 'accepted', response: (await response.json()) as ApiCreateMatchResponse };
}

export type FetchMatchTicketResult =
  | { readonly kind: 'ok'; readonly ticket: ApiMatchTicket }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' };

export async function fetchMatchTicket(ticketId: string): Promise<FetchMatchTicketResult> {
  const response = await fetch(`/api/match/${ticketId}`);
  if (response.status === 404) {
    return { kind: 'not-found' };
  }
  if (!response.ok) {
    return { kind: 'error' };
  }
  return { kind: 'ok', ticket: (await response.json()) as ApiMatchTicket };
}
