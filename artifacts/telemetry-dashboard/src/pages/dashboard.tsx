import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  useTelemetryEvents,
  useTelemetrySummary,
  useApiErrorRates,
  useTelemetryStream,
  useUploadStats,
  LaunchEvent,
  ApiErrorCount,
  BuildSummary,
  UploadStat,
  ByBuildDateStat,
  UploadStatsRange,
} from '@/hooks/use-telemetry';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMode } from '@/lib/utils';
import { format, isAfter, subHours } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

// ─── Histogram helpers ────────────────────────────────────────────────────────

function buildHistogramBuckets(values: number[], bucketCount = 10) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: `${min}ms`, count: values.length, rangeStart: min, rangeEnd: max }];
  }
  const step = Math.ceil((max - min) / bucketCount);
  const buckets: { label: string; count: number; rangeStart: number; rangeEnd: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const rangeStart = min + i * step;
    const rangeEnd = rangeStart + step;
    buckets.push({ label: `${rangeStart}`, count: 0, rangeStart, rangeEnd });
  }
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bucketCount - 1);
    buckets[idx].count++;
  }
  // Drop trailing empty buckets
  while (buckets.length > 1 && buckets[buckets.length - 1].count === 0) buckets.pop();
  return buckets;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClerkStatusChart({ summary }: { summary: BuildSummary[] }) {
  const chartData = useMemo(
    () =>
      summary.map((s) => ({
        build: s.buildNumber,
        Loaded: s.total - s.timedOut,
        'Timed Out': s.timedOut,
      })),
    [summary],
  );

  if (chartData.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO BUILD DATA YET
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="build"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'Build', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }} />
        <Bar dataKey="Loaded" stackId="clerk" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Timed Out" stackId="clerk" fill="#ef4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MsToClerkHistogram({ events, selectedBuild }: { events: LaunchEvent[]; selectedBuild: string }) {
  const values = useMemo(() => {
    const filtered = selectedBuild === 'all' ? events : events.filter((e) => (e.buildNumber ?? '(unknown)') === selectedBuild);
    return filtered
      .filter((e) => e.clerkStatus === 'loaded' && e.msToClerk !== null)
      .map((e) => e.msToClerk as number);
  }, [events, selectedBuild]);

  const buckets = useMemo(() => buildHistogramBuckets(values), [values]);

  if (values.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO MS_TO_CLERK DATA FOR SELECTED BUILD
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'ms to Clerk (bucket start)', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'sessions', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          formatter={(v: number, _name: string, props: { payload?: { rangeStart?: number; rangeEnd?: number } }) => [
            `${v} sessions`,
            `${props.payload?.rangeStart ?? ''}–${props.payload?.rangeEnd ?? ''}ms`,
          ]}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} name="sessions" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ApiReachabilityChart({ summary }: { summary: BuildSummary[] }) {
  const chartData = useMemo(
    () =>
      summary
        .filter((s) => s.apiReachablePercent !== null)
        .map((s) => ({
          build: s.buildNumber,
          reachablePct: s.apiReachablePercent as number,
        })),
    [summary],
  );

  if (chartData.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO API REACHABILITY DATA YET
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="build"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'Build', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, 'API Reachable']}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <ReferenceLine
          y={95}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{ value: '95% threshold', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b', fontFamily: 'monospace' }}
        />
        <Bar dataKey="reachablePct" name="API Reachable %" radius={[2, 2, 0, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.build}
              fill={entry.reachablePct < 95 ? '#ef4444' : '#10b981'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ApiPingHistogram({ events, selectedBuild }: { events: LaunchEvent[]; selectedBuild: string }) {
  const values = useMemo(() => {
    const filtered = selectedBuild === 'all' ? events : events.filter((e) => (e.buildNumber ?? '(unknown)') === selectedBuild);
    return filtered
      .filter((e) => e.apiReachable === true && e.apiPingMs !== null)
      .map((e) => e.apiPingMs as number);
  }, [events, selectedBuild]);

  const buckets = useMemo(() => buildHistogramBuckets(values), [values]);

  if (values.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO API_PING_MS DATA FOR SELECTED BUILD
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'api_ping_ms (bucket start)', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={{ value: 'sessions', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          formatter={(v: number, _name: string, props: { payload?: { rangeStart?: number; rangeEnd?: number } }) => [
            `${v} sessions`,
            `${props.payload?.rangeStart ?? ''}–${props.payload?.rangeEnd ?? ''}ms`,
          ]}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill="#0ea5e9" radius={[2, 2, 0, 0]} name="sessions" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Error trend charts ───────────────────────────────────────────────────────

type ErrorTrendPoint = { time: string; '4xx': number; '5xx': number };

function ApiErrorTrendChart({
  data,
  title,
}: {
  data: ErrorTrendPoint[];
  title?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        NO DATA FOR THIS PERIOD
      </div>
    );
  }

  const hasAny5xx = data.some((d) => d['5xx'] > 0);
  const hasAny4xx = data.some((d) => d['4xx'] > 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          label={
            title
              ? undefined
              : { value: 'hour (UTC)', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
          }
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 11, paddingTop: 8 }} />
        {hasAny4xx && (
          <Bar dataKey="4xx" stackId="errs" fill="#f59e0b" name="4xx" radius={[0, 0, 0, 0]} />
        )}
        {hasAny5xx && (
          <Bar dataKey="5xx" stackId="errs" fill="#ef4444" name="5xx" radius={[2, 2, 0, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Upload Health chart ──────────────────────────────────────────────────────

type UploadDayPoint = { date: string; 'Receipt ✓': number; 'Receipt ✗': number; 'Gallery ✓': number; 'Gallery ✗': number };

function UploadHealthChart({ data }: { data: UploadDayPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO UPLOAD DATA YET
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }} />
        <Bar dataKey="Receipt ✓" stackId="r" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Receipt ✗" stackId="r" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Gallery ✓" stackId="g" fill="#6366f1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Gallery ✗" stackId="g" fill="#f59e0b" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Upload failure rate trend by build ──────────────────────────────────────

const BUILD_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#0ea5e9', // sky
  '#ec4899', // pink
  '#a78bfa', // violet
  '#34d399', // green
  '#fb923c', // orange
  '#38bdf8', // light-blue
  '#f472b6', // rose
];

const MAX_DEFAULT_BUILDS = 6;

type FailureRateTrendPoint = { date: string; [build: string]: number | string };

function UploadFailureTrendChart({
  data,
  builds,
}: {
  data: FailureRateTrendPoint[];
  builds: string[];
}) {
  // `builds` is sorted ascending; the most-recent are at the end.
  const [showAll, setShowAll] = useState(false);

  if (data.length === 0 || builds.length === 0) {
    return (
      <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
        NO PER-BUILD DATE DATA YET — REQUIRES APP BUILDS SENDING x-app-build HEADER
      </div>
    );
  }

  const hasExtra = builds.length > MAX_DEFAULT_BUILDS;
  // Always show the most-recent N builds (tail of ascending-sorted array).
  const visibleBuilds = showAll || !hasExtra
    ? builds
    : builds.slice(-MAX_DEFAULT_BUILDS);

  return (
    <div className="space-y-2">
      {hasExtra && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-mono"
          >
            {showAll
              ? `Show ${MAX_DEFAULT_BUILDS} most-recent builds`
              : `Show all ${builds.length} builds`}
          </button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
          />
          <Tooltip
            formatter={(v: number, name: string) => [`${(v as number).toFixed(1)}%`, `Build ${name}`]}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) => `Build ${value}`}
            wrapperStyle={{
              fontFamily: 'monospace',
              fontSize: 11,
              maxHeight: 72,
              overflowY: 'auto',
              paddingTop: 4,
            }}
          />
          <ReferenceLine
            y={10}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: '10% threshold', position: 'insideTopRight', fontSize: 10, fill: '#ef4444', fontFamily: 'monospace' }}
          />
          {visibleBuilds.map((build) => {
            // Color index is based on position in the full builds array so colors
            // stay stable when toggling between default and "show all" views.
            const colorIdx = builds.indexOf(build);
            return (
              <Line
                key={build}
                type="monotone"
                dataKey={build}
                stroke={BUILD_COLORS[colorIdx % BUILD_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { logout } = useAuth();
  const { data: telemetryData, isFetching: isFetchingTelemetry } = useTelemetryEvents();
  const { data: summaryData, isFetching: isFetchingSummary } = useTelemetrySummary();
  const { data: errorData, isFetching: isFetchingErrors } = useApiErrorRates();
  // ── Upload date-range state ────────────────────────────────────────────────
  // Max preset is 30 days — matches the upload_events retention window.
  const PRESET_DAYS = [7, 14, 30] as const;
  const [uploadPresetDays, setUploadPresetDays] = useState<number>(14);
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);

  const uploadRange: UploadStatsRange = useCustomRange && customSince && customUntil
    ? { kind: 'custom', since: customSince, until: customUntil }
    : { kind: 'days', days: uploadPresetDays };

  const { data: uploadData, isFetching: isFetchingUploads } = useUploadStats(uploadRange);

  const isLive = useTelemetryStream();
  const isFetching = isFetchingTelemetry || isFetchingSummary || isFetchingErrors || isFetchingUploads;

  // Build filter state (used by table + histogram)
  const [selectedBuild, setSelectedBuild] = useState<string>('all');

  // Available build numbers derived from events
  const buildOptions = useMemo(() => {
    const builds = new Set<string>();
    for (const e of telemetryData?.events ?? []) {
      builds.add(e.buildNumber ?? '(unknown)');
    }
    return Array.from(builds).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.localeCompare(a);
    });
  }, [telemetryData]);

  // Filtered events for the raw table
  const filteredEvents = useMemo(() => {
    const events = telemetryData?.events ?? [];
    if (selectedBuild === 'all') return events;
    return events.filter((e) => (e.buildNumber ?? '(unknown)') === selectedBuild);
  }, [telemetryData, selectedBuild]);

  // Legacy build summaries computed client-side for the summary table
  const buildSummaries = useMemo(() => {
    if (!telemetryData?.events) return [];
    const grouped = new Map<string, LaunchEvent[]>();
    for (const event of telemetryData.events) {
      const build = event.buildNumber || 'Unknown';
      if (!grouped.has(build)) grouped.set(build, []);
      grouped.get(build)!.push(event);
    }
    return Array.from(grouped.entries()).map(([buildNumber, events]) => {
      const uniqueSessions = new Set(events.map((e) => e.sessionId));
      const totalSessions = uniqueSessions.size;
      const clerkLoadedEvents = events.filter((e) => e.clerkStatus === 'loaded');
      const clerkLoadedPercent = events.length ? (clerkLoadedEvents.length / events.length) * 100 : 0;
      const clerkTimedOutCount = events.filter((e) => e.clerkStatus === 'timed_out').length;
      const msToClerkValues = clerkLoadedEvents.map((e) => e.msToClerk).filter((v): v is number => v !== null);
      const sorted = [...msToClerkValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianMsToClerk =
        sorted.length === 0 ? null : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      const eventsWithApi = events.filter((e) => e.apiReachable !== null);
      const apiReachablePercent =
        eventsWithApi.length ? (eventsWithApi.filter((e) => e.apiReachable === true).length / eventsWithApi.length) * 100 : null;
      const firstScreens = events.map((e) => e.firstScreen).filter((v): v is string => v !== null);
      const mostCommonScreen = getMode(firstScreens);
      return {
        buildNumber,
        totalSessions,
        clerkLoadedPercent,
        clerkTimedOutCount,
        medianMsToClerk,
        apiReachablePercent,
        mostCommonScreen: mostCommonScreen || 'N/A',
      };
    }).sort((a, b) => {
      const na = Number(a.buildNumber), nb = Number(b.buildNumber);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.buildNumber.localeCompare(a.buildNumber);
    });
  }, [telemetryData]);

  // API error summaries
  const errorSummaries = useMemo(() => {
    if (!errorData?.errorRates) return [];
    const now = new Date();
    const oneDayAgo = subHours(now, 24);
    const recentErrors = errorData.errorRates.filter((e) => isAfter(new Date(e.windowStart), oneDayAgo));
    const grouped = new Map<string, { total: number; rows: ApiErrorCount[] }>();
    for (const err of recentErrors) {
      if (!grouped.has(err.endpoint)) grouped.set(err.endpoint, { total: 0, rows: [] });
      const g = grouped.get(err.endpoint)!;
      g.total += err.count;
      g.rows.push(err);
    }
    const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].total - a[1].total);
    for (const [, g] of sorted) g.rows.sort((a, b) => new Date(b.windowStart).getTime() - new Date(a.windowStart).getTime());
    return sorted;
  }, [errorData]);

  // Overall error trend (all endpoints combined), bucketed by hour
  const overallErrorTrend = useMemo((): ErrorTrendPoint[] => {
    if (!errorData?.errorRates) return [];
    const byWindow = new Map<string, { fourxx: number; fivexx: number }>();
    for (const err of errorData.errorRates) {
      const key = err.windowStart;
      if (!byWindow.has(key)) byWindow.set(key, { fourxx: 0, fivexx: 0 });
      const g = byWindow.get(key)!;
      if (err.statusCode >= 500) g.fivexx += err.count;
      else g.fourxx += err.count;
    }
    return Array.from(byWindow.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([window, counts]) => ({
        time: format(new Date(window), 'HH:mm'),
        '4xx': counts.fourxx,
        '5xx': counts.fivexx,
      }));
  }, [errorData]);

  // Per-endpoint error trends
  const perEndpointTrends = useMemo((): Map<string, ErrorTrendPoint[]> => {
    if (!errorData?.errorRates) return new Map();
    const byEndpointWindow = new Map<string, Map<string, { fourxx: number; fivexx: number }>>();
    for (const err of errorData.errorRates) {
      if (!byEndpointWindow.has(err.endpoint)) byEndpointWindow.set(err.endpoint, new Map());
      const wMap = byEndpointWindow.get(err.endpoint)!;
      if (!wMap.has(err.windowStart)) wMap.set(err.windowStart, { fourxx: 0, fivexx: 0 });
      const g = wMap.get(err.windowStart)!;
      if (err.statusCode >= 500) g.fivexx += err.count;
      else g.fourxx += err.count;
    }
    const result = new Map<string, ErrorTrendPoint[]>();
    for (const [endpoint, wMap] of byEndpointWindow.entries()) {
      result.set(
        endpoint,
        Array.from(wMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([window, counts]) => ({
            time: format(new Date(window), 'HH:mm'),
            '4xx': counts.fourxx,
            '5xx': counts.fivexx,
          })),
      );
    }
    return result;
  }, [errorData]);

  // ── Upload health ──────────────────────────────────────────────────────────
  const uploadChartData = useMemo((): UploadDayPoint[] => {
    const stats: UploadStat[] = uploadData?.stats ?? [];
    const byDate = new Map<string, { rSuccess: number; rFail: number; gSuccess: number; gFail: number }>();
    for (const s of stats) {
      if (!byDate.has(s.date)) byDate.set(s.date, { rSuccess: 0, rFail: 0, gSuccess: 0, gFail: 0 });
      const d = byDate.get(s.date)!;
      if (s.type === 'receipt') {
        if (s.outcome === 'success') d.rSuccess += s.count;
        else d.rFail += s.count;
      } else {
        if (s.outcome === 'success') d.gSuccess += s.count;
        else d.gFail += s.count;
      }
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date: date.slice(5), // "08-07" from "2026-08-07"
        'Receipt ✓': counts.rSuccess,
        'Receipt ✗': counts.rFail,
        'Gallery ✓': counts.gSuccess,
        'Gallery ✗': counts.gFail,
      }));
  }, [uploadData]);

  // Alert: failure rate > 10% across the two most-recent calendar days with data.
  const uploadAlertActive = useMemo(() => {
    const stats: UploadStat[] = uploadData?.stats ?? [];
    if (stats.length === 0) return false;
    const allDates = [...new Set(stats.map((s) => s.date))].sort().slice(-2);
    const recent = stats.filter((s) => allDates.includes(s.date));
    const total = recent.reduce((sum, s) => sum + s.count, 0);
    const failures = recent.filter((s) => s.outcome !== 'success').reduce((sum, s) => sum + s.count, 0);
    return total >= 5 && failures / total > 0.10;
  }, [uploadData]);

  // Breakdown table: aggregate by outcome across the full 14-day window.
  const uploadBreakdown = useMemo(() => {
    const stats: UploadStat[] = uploadData?.stats ?? [];
    const byOutcome = new Map<string, { receipt: number; gallery: number }>();
    for (const s of stats) {
      if (!byOutcome.has(s.outcome)) byOutcome.set(s.outcome, { receipt: 0, gallery: 0 });
      const d = byOutcome.get(s.outcome)!;
      if (s.type === 'receipt') d.receipt += s.count;
      else d.gallery += s.count;
    }
    return Array.from(byOutcome.entries())
      .map(([outcome, counts]) => ({ outcome, ...counts, total: counts.receipt + counts.gallery }))
      .sort((a, b) => b.total - a.total);
  }, [uploadData]);

  // Per-build, per-day failure rate trend data for the line chart.
  const { uploadFailureTrendData, uploadFailureTrendBuilds } = useMemo(() => {
    const rows: ByBuildDateStat[] = uploadData?.byBuildDate ?? [];
    if (rows.length === 0) return { uploadFailureTrendData: [], uploadFailureTrendBuilds: [] };

    // Collect all unique dates (sorted ascending) and build numbers.
    const dateSet = new Set<string>();
    const buildSet = new Set<string>();
    for (const r of rows) {
      dateSet.add(r.date);
      buildSet.add(r.buildNumber);
    }
    const dates = Array.from(dateSet).sort();
    // Sort builds numerically where possible, ascending so the legend order is stable.
    const builds = Array.from(buildSet).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // Build a lookup: buildNumber → date → { successCount, failureCount }
    const lookup = new Map<string, Map<string, { s: number; f: number }>>();
    for (const r of rows) {
      if (!lookup.has(r.buildNumber)) lookup.set(r.buildNumber, new Map());
      lookup.get(r.buildNumber)!.set(r.date, { s: r.successCount, f: r.failureCount });
    }

    // Pivot into chart rows: { date, "25": 5.3, "26": 0, ... }
    // Only include a build's value for dates where that build has data.
    const data: FailureRateTrendPoint[] = dates.map((date) => {
      const point: FailureRateTrendPoint = { date: date.slice(5) }; // "08-01"
      for (const build of builds) {
        const entry = lookup.get(build)?.get(date);
        if (entry !== undefined) {
          const total = entry.s + entry.f;
          point[build] = total > 0 ? (entry.f / total) * 100 : 0;
        }
        // If no entry for this build+date, leave it undefined so connectNulls=false creates a gap.
      }
      return point;
    });

    return { uploadFailureTrendData: data, uploadFailureTrendBuilds: builds };
  }, [uploadData]);

  // Per-build breakdown: failure rate per build number.
  const uploadBuildBreakdown = useMemo(() => {
    const stats: UploadStat[] = uploadData?.stats ?? [];
    // Only include rows that have a build number
    const withBuild = stats.filter((s) => s.buildNumber !== null);
    const byBuild = new Map<string, { success: number; failure: number }>();
    for (const s of withBuild) {
      const build = s.buildNumber!;
      if (!byBuild.has(build)) byBuild.set(build, { success: 0, failure: 0 });
      const d = byBuild.get(build)!;
      if (s.outcome === 'success') d.success += s.count;
      else d.failure += s.count;
    }
    return Array.from(byBuild.entries())
      .map(([build, counts]) => {
        const total = counts.success + counts.failure;
        const failureRate = total > 0 ? (counts.failure / total) * 100 : 0;
        return { build, ...counts, total, failureRate };
      })
      .sort((a, b) => {
        const na = Number(a.build), nb = Number(b.build);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return b.build.localeCompare(a.build);
      });
  }, [uploadData]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono">
      {/* ── Header ── */}
      <header className="border-b border-border bg-black/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-primary tracking-tight">OWMO_DIAGNOSTICS</h1>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              LIVE
            </span>
          )}
          {isFetching && <Badge variant="secondary" className="animate-pulse">SYNCING...</Badge>}
          {!isFetching && (
            <span className="text-xs text-muted-foreground">
              LAST UPDATED: {format(new Date(), 'HH:mm:ss')}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
        >
          TERMINATE SESSION
        </Button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Tabs defaultValue="launch" className="w-full">
          <TabsList className="mb-6 bg-transparent border-b border-border rounded-none p-0 w-full justify-start h-auto">
            <TabsTrigger
              value="launch"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-6 py-3"
            >
              LAUNCH TELEMETRY
            </TabsTrigger>
            <TabsTrigger
              value="errors"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-6 py-3"
            >
              API ERROR RATES
            </TabsTrigger>
            <TabsTrigger
              value="uploads"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-6 py-3"
            >
              UPLOAD HEALTH
              {uploadAlertActive && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Launch Telemetry Tab ── */}
          <TabsContent value="launch" className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* 1. Clerk status bar chart */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                CLERK STATUS PER BUILD
              </h2>
              <div className="border border-border bg-card p-4">
                <ClerkStatusChart summary={summaryData?.summary ?? []} />
              </div>
            </section>

            {/* 2. ms_to_clerk histogram */}
            <section className="space-y-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                  MS_TO_CLERK DISTRIBUTION
                </h2>
                {/* Build selector */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">BUILD:</span>
                  <select
                    value={selectedBuild}
                    onChange={(e) => setSelectedBuild(e.target.value)}
                    className="bg-card border border-border text-foreground text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="all">ALL</option>
                    {buildOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border border-border bg-card p-4">
                <MsToClerkHistogram
                  events={telemetryData?.events ?? []}
                  selectedBuild={selectedBuild}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only sessions where Clerk loaded successfully ({`clerkStatus = "loaded"`}). Timed-out sessions excluded.
              </p>
            </section>

            {/* 3. API reachability chart */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                API REACHABILITY % PER BUILD
              </h2>
              <div className="border border-border bg-card p-4">
                <ApiReachabilityChart summary={summaryData?.summary ?? []} />
              </div>
              <p className="text-xs text-muted-foreground">
                Amber dashed line marks the 95% threshold. Red bars indicate builds with degraded API connectivity.
              </p>
            </section>

            {/* 4. API ping latency histogram */}
            <section className="space-y-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                  API PING LATENCY DISTRIBUTION
                </h2>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">BUILD:</span>
                  <select
                    value={selectedBuild}
                    onChange={(e) => setSelectedBuild(e.target.value)}
                    className="bg-card border border-border text-foreground text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="all">ALL</option>
                    {buildOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border border-border bg-card p-4">
                <ApiPingHistogram
                  events={telemetryData?.events ?? []}
                  selectedBuild={selectedBuild}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only sessions where API was reachable ({`apiReachable = true`}). Unreachable sessions excluded.
              </p>
            </section>

            {/* 5. Build performance summary table */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                BUILD PERFORMANCE SUMMARY
              </h2>
              <div className="border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>BUILD</TableHead>
                      <TableHead className="text-right">SESSIONS</TableHead>
                      <TableHead className="text-right">CLERK LOADED</TableHead>
                      <TableHead className="text-right">TIMEOUTS</TableHead>
                      <TableHead className="text-right">MEDIAN MS</TableHead>
                      <TableHead className="text-right">API REACHABLE</TableHead>
                      <TableHead>COMMON SCREEN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          NO DATA AVAILABLE
                        </TableCell>
                      </TableRow>
                    ) : (
                      buildSummaries.map((s) => (
                        <TableRow
                          key={s.buildNumber}
                          className="cursor-pointer hover:bg-muted/20"
                          onClick={() => setSelectedBuild(s.buildNumber === selectedBuild ? 'all' : s.buildNumber)}
                        >
                          <TableCell className="font-bold">
                            {s.buildNumber}
                            {s.buildNumber === selectedBuild && (
                              <Badge variant="outline" className="ml-2 text-xs">SELECTED</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{s.totalSessions}</TableCell>
                          <TableCell className="text-right">
                            <span className={s.clerkLoadedPercent < 90 ? 'text-destructive' : 'text-emerald-500'}>
                              {s.clerkLoadedPercent.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {s.clerkTimedOutCount > 0 ? (
                              <Badge variant="destructive">{s.clerkTimedOutCount}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.medianMsToClerk !== null ? `${s.medianMsToClerk}ms` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.apiReachablePercent !== null ? (
                              <span className={s.apiReachablePercent < 95 ? 'text-destructive' : 'text-emerald-500'}>
                                {s.apiReachablePercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="truncate max-w-[150px] text-muted-foreground">
                            {s.mostCommonScreen}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Click a row to filter events and histogram to that build.</p>
            </section>

            {/* 4. Raw events feed — filterable by build */}
            <section className="space-y-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                  RAW EVENTS FEED
                </h2>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">FILTER BUILD:</span>
                  <select
                    value={selectedBuild}
                    onChange={(e) => setSelectedBuild(e.target.value)}
                    className="bg-card border border-border text-foreground text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="all">ALL</option>
                    {buildOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {selectedBuild !== 'all' && (
                    <button
                      onClick={() => setSelectedBuild('all')}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      CLEAR
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    ({filteredEvents.length} rows)
                  </span>
                </div>
              </div>
              <div className="border border-border bg-card max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md z-10">
                    <TableRow>
                      <TableHead>TIME</TableHead>
                      <TableHead>BUILD</TableHead>
                      <TableHead>PLATFORM</TableHead>
                      <TableHead>CLERK</TableHead>
                      <TableHead className="text-right">MS</TableHead>
                      <TableHead>SCREEN</TableHead>
                      <TableHead>API</TableHead>
                      <TableHead className="text-right">PING</TableHead>
                      <TableHead>PROXY</TableHead>
                      <TableHead className="max-w-[140px]">BAKED DOMAIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          NO EVENTS FOUND
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...filteredEvents]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(e.createdAt), 'MM-dd HH:mm:ss')}
                            </TableCell>
                            <TableCell>{e.buildNumber || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{e.platform || '-'}</TableCell>
                            <TableCell>
                              {e.clerkStatus === 'loaded' ? (
                                <span className="text-emerald-500">LOADED</span>
                              ) : (
                                <span className="text-destructive">TIMEOUT</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{e.msToClerk ?? '-'}</TableCell>
                            <TableCell className="truncate max-w-[120px]">{e.firstScreen || '-'}</TableCell>
                            <TableCell>
                              {e.apiReachable === true && <span className="text-emerald-500">OK</span>}
                              {e.apiReachable === false && <span className="text-destructive">FAIL</span>}
                              {e.apiReachable === null && '-'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {e.apiPingMs ?? '-'}
                            </TableCell>
                            <TableCell>
                              {e.proxyReachable === true && <span className="text-emerald-500">OK</span>}
                              {e.proxyReachable === false && <span className="text-destructive">FAIL</span>}
                              {e.proxyReachable === null && <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[140px]">
                              {e.bakedDomain ? (
                                <span className={
                                  e.bakedDomain === 'invite-9bwgw.replit.app'
                                    ? 'text-emerald-500 font-mono text-xs'
                                    : 'text-destructive font-mono text-xs'
                                }>
                                  {e.bakedDomain}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </TabsContent>

          {/* ── API Error Rates Tab ── */}
          <TabsContent value="errors" className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* 1. Overview trend chart */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                TOTAL ERRORS OVER TIME (LAST 24H)
              </h2>
              <div className="border border-border bg-card p-4">
                <ApiErrorTrendChart data={overallErrorTrend} />
              </div>
              <p className="text-xs text-muted-foreground">
                Hourly error counts across all endpoints.{' '}
                <span className="text-amber-500 font-semibold">Amber = 4xx</span> ·{' '}
                <span className="text-destructive font-semibold">Red = 5xx</span>
              </p>
            </section>

            {/* 2. Per-endpoint breakdown */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                PER-ENDPOINT BREAKDOWN
              </h2>
              {errorSummaries.length === 0 ? (
                <div className="border border-border bg-card p-12 text-center text-muted-foreground">
                  NO ERRORS RECORDED IN THE LAST 24 HOURS
                </div>
              ) : (
                <div className="grid gap-6">
                  {errorSummaries.map(([endpoint, group]) => (
                    <div key={endpoint} className="border border-border bg-card overflow-hidden">
                      <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center gap-3">
                        <span className="font-bold text-sm text-primary font-mono">{endpoint}</span>
                        <Badge variant="destructive" className="text-xs px-2">{group.total} ERRORS</Badge>
                      </div>

                      {/* Trend chart for this endpoint */}
                      <div className="p-4 border-b border-border">
                        <ApiErrorTrendChart data={perEndpointTrends.get(endpoint) ?? []} />
                      </div>

                      {/* Hourly detail table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">STATUS CODE</TableHead>
                            <TableHead>TIME WINDOW</TableHead>
                            <TableHead className="text-right">COUNT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row, idx) => (
                            <TableRow key={`${row.endpoint}-${row.windowStart}-${idx}`}>
                              <TableCell>
                                <Badge variant={row.statusCode >= 500 ? 'destructive' : 'secondary'}>
                                  {row.statusCode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(row.windowStart), 'MMM dd, HH:mm')}
                              </TableCell>
                              <TableCell className="text-right font-bold">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ── Upload Health Tab ── */}
          <TabsContent value="uploads" className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* ── Date-range controls ── */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">DATE RANGE</h2>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setUploadPresetDays(d); setUseCustomRange(false); }}
                    className={[
                      'px-3 py-1.5 text-xs font-mono border transition-colors',
                      !useCustomRange && uploadPresetDays === d
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    ].join(' ')}
                  >
                    {d}D
                  </button>
                ))}
                <span className="text-xs text-muted-foreground px-1">|</span>
                <button
                  onClick={() => setUseCustomRange((v) => !v)}
                  className={[
                    'px-3 py-1.5 text-xs font-mono border transition-colors',
                    useCustomRange
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  ].join(' ')}
                >
                  CUSTOM
                </button>
                {useCustomRange && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={customSince}
                      onChange={(e) => setCustomSince(e.target.value)}
                      className="bg-card border border-border text-foreground text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input
                      type="date"
                      value={customUntil}
                      onChange={(e) => setCustomUntil(e.target.value)}
                      className="bg-card border border-border text-foreground text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                )}
                {isFetchingUploads && (
                  <Badge variant="secondary" className="animate-pulse text-xs">LOADING…</Badge>
                )}
              </div>
            </section>

            {/* Alert banner */}
            {uploadAlertActive && (
              <div className="flex items-center gap-3 border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
                <span className="font-bold">⚠ UPLOAD FAILURE RATE ELEVATED</span>
                <span className="text-destructive/80">
                  More than 10 % of recent upload attempts failed. Check the breakdown below.
                </span>
              </div>
            )}

            {/* Stacked bar chart: success vs failure per day, receipt vs gallery */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                {useCustomRange && customSince && customUntil
                  ? `DAILY UPLOAD OUTCOMES (${customSince} → ${customUntil})`
                  : `DAILY UPLOAD OUTCOMES (LAST ${uploadPresetDays} DAYS)`}
              </h2>
              <div className="border border-border bg-card p-4">
                <UploadHealthChart data={uploadChartData} />
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-500 font-semibold">Green = Receipt success</span> ·{' '}
                <span className="text-destructive font-semibold">Red = Receipt failure</span> ·{' '}
                <span className="text-indigo-400 font-semibold">Indigo = Gallery success</span> ·{' '}
                <span className="text-amber-500 font-semibold">Amber = Gallery failure</span>
              </p>
            </section>

            {/* Breakdown table by outcome */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                {useCustomRange && customSince && customUntil
                  ? `FAILURE PHASE BREAKDOWN (${customSince} → ${customUntil})`
                  : `FAILURE PHASE BREAKDOWN (${uploadPresetDays}-DAY TOTAL)`}
              </h2>
              {uploadBreakdown.length === 0 ? (
                <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
                  NO UPLOAD EVENTS RECORDED YET
                </div>
              ) : (
                <div className="border border-border bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>OUTCOME / PHASE</TableHead>
                        <TableHead className="text-right">RECEIPT</TableHead>
                        <TableHead className="text-right">GALLERY</TableHead>
                        <TableHead className="text-right">TOTAL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadBreakdown.map((row) => (
                        <TableRow key={row.outcome}>
                          <TableCell>
                            {row.outcome === 'success' ? (
                              <span className="text-emerald-500 font-bold">success</span>
                            ) : (
                              <Badge variant="destructive" className="font-mono text-xs">
                                {row.outcome}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.receipt > 0 ? row.receipt : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.gallery > 0 ? row.gallery : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">{row.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Phases: <span className="font-semibold">auth_fail</span> = bad/cross-event token ·{' '}
                <span className="font-semibold">rate_limited</span> = per-user or per-event cap reached ·{' '}
                <span className="font-semibold">mime_rejected</span> = non-image MIME type ·{' '}
                <span className="font-semibold">storage_fail</span> = GCS PUT not completed before confirm ·{' '}
                <span className="font-semibold">signing_fail</span> = SESSION_SECRET misconfiguration
              </p>
            </section>

            {/* Per-build failure rate trend line chart */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                {useCustomRange && customSince && customUntil
                  ? `FAILURE RATE TREND BY BUILD (${customSince} → ${customUntil})`
                  : `FAILURE RATE TREND BY BUILD (LAST ${uploadPresetDays} DAYS)`}
              </h2>
              <div className="border border-border bg-card p-4">
                <UploadFailureTrendChart
                  data={uploadFailureTrendData}
                  builds={uploadFailureTrendBuilds}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                One line per build. X = calendar date, Y = failure % that day.
                Gaps mean no uploads recorded for that build on that date.
                <span className="text-destructive font-semibold"> Red dashed line</span> = 10% threshold.
                Legacy events without a build number are excluded.
              </p>
            </section>

            {/* Per-build failure rate table */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">
                FAILURE RATE BY BUILD
              </h2>
              {uploadBuildBreakdown.length === 0 ? (
                <div className="border border-border bg-card p-12 text-center text-muted-foreground text-sm">
                  NO PER-BUILD DATA YET — REQUIRES APP BUILD ≥ SENDING x-app-build HEADER
                </div>
              ) : (
                <div className="border border-border bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>BUILD</TableHead>
                        <TableHead className="text-right">SUCCESS</TableHead>
                        <TableHead className="text-right">FAILURES</TableHead>
                        <TableHead className="text-right">TOTAL</TableHead>
                        <TableHead className="text-right">FAILURE RATE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadBuildBreakdown.map((row) => (
                        <TableRow key={row.build}>
                          <TableCell className="font-bold font-mono">{row.build}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">
                            {row.success}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.failure > 0 ? (
                              <Badge variant="destructive" className="font-mono text-xs">{row.failure}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {row.total}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={row.failureRate > 10 ? 'text-destructive font-bold' : row.failureRate > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                              {row.failureRate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Sorted newest build first. <span className="text-destructive font-semibold">Red</span> = failure rate above 10% ·{' '}
                <span className="text-amber-500 font-semibold">Amber</span> = some failures ·{' '}
                <span className="text-emerald-500 font-semibold">Green</span> = all uploads succeeded.
                Only includes events from app versions that send the <span className="font-semibold">x-app-build</span> header.
              </p>
            </section>

          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
