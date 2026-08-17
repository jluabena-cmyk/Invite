import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { useEffect, useState } from 'react';

export type LaunchEvent = {
  id: number;
  sessionId: string;
  createdAt: string;
  buildNumber: string | null;
  appVersion: string | null;
  platform: string | null;
  clerkStatus: "loaded" | "timed_out";
  msToClerk: number | null;
  firstScreen: string | null;
  errorCode: string | null;
  apiReachable: boolean | null;
  apiPingMs: number | null;
  bakedDomain: string | null;
  bakedProxyUrl: string | null;
  proxyReachable: boolean | null;
  proxyPingMs: number | null;
};

export type ApiErrorCount = {
  endpoint: string;
  statusCode: number;
  windowStart: string;
  count: number;
};

async function fetchWithAuth(url: string, token: string | null, logout: () => void) {
  if (!token) throw new Error('No token');
  
  const res = await fetch(url, {
    headers: {
      'X-Admin-Token': token,
    },
  });

  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}

export function useTelemetryEvents() {
  const { token, logout } = useAuth();

  return useQuery<{ events: LaunchEvent[], count: number }>({
    queryKey: ['telemetry-events'],
    queryFn: () => fetchWithAuth('/api/admin/telemetry', token, logout),
    enabled: !!token,
    refetchInterval: 10000,
  });
}

export function useApiErrorRates() {
  const { token, logout } = useAuth();

  return useQuery<{ errorRates: ApiErrorCount[], count: number }>({
    queryKey: ['api-error-rates'],
    queryFn: () => fetchWithAuth('/api/admin/error-rates', token, logout),
    enabled: !!token,
    refetchInterval: 30000,
  });
}

export type BuildSummary = {
  buildNumber: string;
  total: number;
  timedOut: number;
  medianMsToClerk: number | null;
  topScreens: { screen: string; count: number }[];
  apiReachablePercent: number | null;
};

/**
 * Opens an SSE connection to /api/admin/telemetry/stream and invalidates
 * the telemetry queries whenever a new launch event arrives. This gives
 * near-real-time updates without waiting for the 10 s poll interval.
 * Returns a `live` boolean that is true while the connection is open.
 */
export function useTelemetryStream(): boolean {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!token) return;

    // EventSource doesn't support custom headers — pass the token as a query
    // param and validate it on the server the same way.
    const url = `/api/admin/telemetry/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);

    es.onmessage = () => {
      // New event arrived — immediately invalidate both queries so the table
      // and charts refresh without waiting for the 10 s poll.
      void queryClient.invalidateQueries({ queryKey: ['telemetry-events'] });
      void queryClient.invalidateQueries({ queryKey: ['telemetry-summary'] });
    };

    return () => {
      es.close();
      setLive(false);
    };
  }, [token, queryClient]);

  return live;
}

export function useTelemetrySummary() {
  const { token, logout } = useAuth();

  return useQuery<{ summary: BuildSummary[] }>({
    queryKey: ['telemetry-summary'],
    queryFn: () => fetchWithAuth('/api/admin/telemetry/summary', token, logout),
    enabled: !!token,
    refetchInterval: 30000,
  });
}

export type UploadStat = {
  /** UTC date string, e.g. "2026-08-07". */
  date: string;
  /** "receipt" or "gallery". */
  type: string;
  /** "success" | "auth_fail" | "rate_limited" | "mime_rejected" | "storage_fail" | "signing_fail". */
  outcome: string;
  /** App build number from the x-app-build header, null for legacy events. */
  buildNumber: string | null;
  count: number;
};

/** Daily failure/success counts per build number (null build rows excluded). */
export type ByBuildDateStat = {
  /** App build number string. Never null — rows with null build_number are excluded at the API layer. */
  buildNumber: string;
  /** UTC date string, e.g. "2026-08-07". */
  date: string;
  successCount: number;
  failureCount: number;
};

export type UploadStatsRange =
  | { kind: 'days'; days: number }
  | { kind: 'custom'; since: string; until: string };

export function useUploadStats(range: UploadStatsRange = { kind: 'days', days: 14 }) {
  const { token, logout } = useAuth();

  const url = (() => {
    const base = '/api/admin/upload-stats';
    if (range.kind === 'custom') {
      return `${base}?since=${encodeURIComponent(range.since)}&until=${encodeURIComponent(range.until)}`;
    }
    return `${base}?days=${range.days}`;
  })();

  const queryKey =
    range.kind === 'custom'
      ? ['upload-stats', 'custom', range.since, range.until]
      : ['upload-stats', 'days', range.days];

  return useQuery<{ stats: UploadStat[]; byBuildDate: ByBuildDateStat[]; since: string; until: string }>({
    queryKey,
    queryFn: () => fetchWithAuth(url, token, logout),
    enabled: !!token,
    refetchInterval: 60_000,
  });
}
