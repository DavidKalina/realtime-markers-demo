"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardOverview, LlmCostsSummary as LlmCostsData } from "@/lib/dashboard-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  Explorer: "#94a3b8",
  Scout: "#60a5fa",
  Curator: "#a78bfa",
  Ambassador: "#f59e0b",
};

const TIER_ORDER = ["Explorer", "Scout", "Curator", "Ambassador"];

// ── Metric Card ──

function StatCard({
  label,
  value,
  sub,
  emoji,
}: {
  label: string;
  value: string | number;
  sub?: string;
  emoji: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="text-2xl">{emoji}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Sections ──

function AppMetrics({ data }: { data: DashboardOverview }) {
  const { app, itineraries, checkins, streaks } = data;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">App Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Users"
          value={app.totalUsers}
          sub={`+${app.usersThisWeek} this week`}
          emoji="👥"
        />
        <StatCard
          label="Itineraries"
          value={itineraries.total}
          sub={`+${itineraries.thisWeek} this week`}
          emoji="🗺️"
        />
        <StatCard
          label="Completed"
          value={itineraries.completed}
          sub={`${itineraries.completionRate}% completion rate`}
          emoji="✅"
        />
        <StatCard
          label="Check-ins"
          value={checkins.total}
          sub={`+${checkins.thisWeek} this week`}
          emoji="📍"
        />
        <StatCard
          label="Active Quests"
          value={app.activeQuestUsers}
          sub="Users on a quest right now"
          emoji="⚡"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Events"
          value={app.totalEvents}
          emoji="📅"
        />
        <StatCard
          label="Avg Rating"
          value={
            itineraries.avgRating
              ? `${itineraries.avgRating}/5`
              : "N/A"
          }
          sub={`${itineraries.totalRated} rated`}
          emoji="⭐"
        />
        <StatCard
          label="Active Streaks"
          value={streaks.activeStreaks}
          sub={`Longest ever: ${streaks.longestEver} weeks`}
          emoji="🔥"
        />
        <StatCard
          label="Badges Unlocked"
          value={app.totalBadgesUnlocked}
          emoji="🏅"
        />
        <StatCard
          label="Total XP Awarded"
          value={streaks.totalXpAwarded}
          sub={`Avg ${streaks.avgXp} per user`}
          emoji="✨"
        />
      </div>
    </div>
  );
}

function TierDistribution({ tiers }: { tiers: DashboardOverview["tiers"] }) {
  const sorted = [...tiers].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
  const total = sorted.reduce((s, t) => s + t.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tier Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <div className="w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sorted}
                  dataKey="count"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {sorted.map((entry) => (
                    <Cell
                      key={entry.tier}
                      fill={TIER_COLORS[entry.tier] || "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            {sorted.map((t) => {
              const pct = total > 0 ? (t.count / total) * 100 : 0;
              return (
                <div key={t.tier} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t.tier}</span>
                    <span className="text-muted-foreground">
                      {t.count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2"
                    style={
                      {
                        "--progress-color": TIER_COLORS[t.tier],
                      } as React.CSSProperties
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyTrendChart({
  trend,
}: {
  trend: DashboardOverview["weeklyTrend"];
}) {
  const formatted = trend.map((w) => ({
    ...w,
    label: new Date(w.week).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Itinerary Activity (12 Weeks)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="created"
                stroke="#60a5fa"
                name="Created"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#34d399"
                name="Completed"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TopCitiesChart({
  cities,
}: {
  cities: DashboardOverview["topCities"];
}) {
  if (cities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top Cities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cities} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="city"
                type="category"
                tick={{ fontSize: 12 }}
                width={100}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#60a5fa" name="Total" radius={[0, 4, 4, 0]} />
              <Bar
                dataKey="completed"
                fill="#34d399"
                name="Completed"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckinInsights({
  checkins,
}: {
  checkins: DashboardOverview["checkins"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Check-in Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{checkins.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Check-ins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {checkins.avgDistanceMeters != null
                ? `${Math.round(checkins.avgDistanceMeters)}m`
                : "N/A"}
            </div>
            <div className="text-xs text-muted-foreground">Avg Distance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {checkins.avgStopsPerItinerary ?? "N/A"}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg Stops / Itinerary
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">+{checkins.thisWeek}</div>
            <div className="text-xs text-muted-foreground">This Week</div>
          </div>
        </div>
        {checkins.sourceBreakdown.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Source Breakdown</p>
            {checkins.sourceBreakdown.map((s) => {
              const total = checkins.sourceBreakdown.reduce(
                (sum, x) => sum + x.count,
                0,
              );
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return (
                <div key={s.source} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{s.source}</span>
                    <span className="text-muted-foreground">
                      {s.count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BadgeLeaderboard({
  badges,
}: {
  badges: DashboardOverview["badges"];
}) {
  if (badges.topBadges.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Top Badges ({badges.totalUnlocked} unlocked)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {badges.topBadges.map((b, i) => (
            <div
              key={b.badgeId}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-5">
                  #{i + 1}
                </span>
                <span className="text-sm font-medium capitalize">
                  {b.label}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {b.count} users
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DatabaseStats({
  tableCounts,
}: {
  tableCounts: DashboardOverview["app"]["tableCounts"];
}) {
  const sorted = [...tableCounts].sort((a, b) => b.rows - a.rows);
  const totalRows = sorted.reduce((s, t) => s + t.rows, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Database ({totalRows.toLocaleString()} total rows)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {sorted.map((t) => (
            <div
              key={t.table}
              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
            >
              <span className="text-sm font-mono text-muted-foreground">
                {t.table}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {t.rows.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivity({
  activities,
}: {
  activities: DashboardOverview["recentActivity"];
}) {
  if (activities.length === 0) return null;

  const typeIcons: Record<string, string> = {
    itinerary_completed: "✅",
    checkin: "📍",
    badge_unlocked: "🏅",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 py-1">
              <span className="text-lg mt-0.5">
                {typeIcons[a.type] || "📌"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(a.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LlmCostsSummary({ costs }: { costs: LlmCostsData }) {
  const { summary, byModel } = costs;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">LLM Costs (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">
              ${summary.totalCost.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {summary.totalCalls.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">API Calls</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {summary.totalTokens > 1_000_000
                ? `${(summary.totalTokens / 1_000_000).toFixed(1)}M`
                : summary.totalTokens > 1_000
                  ? `${(summary.totalTokens / 1_000).toFixed(1)}K`
                  : summary.totalTokens.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Tokens</div>
          </div>
        </div>
        {byModel.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Model</p>
            {byModel.map((m) => {
              const pct =
                summary.totalCost > 0
                  ? (m.cost / summary.totalCost) * 100
                  : 0;
              return (
                <div key={m.model} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-mono text-xs truncate max-w-[60%]">
                      {m.model}
                    </span>
                    <span className="text-muted-foreground">
                      ${m.cost.toFixed(2)} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Export ──

export function OverviewDashboard({
  data,
  llmCosts,
}: {
  data: DashboardOverview;
  llmCosts?: LlmCostsData | null;
}) {
  return (
    <div className="space-y-8">
      <AppMetrics data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TierDistribution tiers={data.tiers} />
        <CheckinInsights checkins={data.checkins} />
      </div>

      <WeeklyTrendChart trend={data.weeklyTrend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopCitiesChart cities={data.topCities} />
        <BadgeLeaderboard badges={data.badges} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DatabaseStats tableCounts={data.app.tableCounts} />
        {llmCosts && <LlmCostsSummary costs={llmCosts} />}
      </div>

      <RecentActivity activities={data.recentActivity} />
    </div>
  );
}
