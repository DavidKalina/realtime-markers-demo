"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLlmCosts } from "@/hooks/useLlmCosts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export default function LlmCostsPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useLlmCosts(days);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading ? (
          <LoadingSpinner message="Loading LLM cost data..." />
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                LLM Usage & Costs
              </h2>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {formatCost(data.summary.totalCost)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {data.summary.totalCalls.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {formatTokens(data.summary.totalTokens)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Cost Chart */}
            {data.daily.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Daily Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(d) =>
                          new Date(d).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatCost(value),
                          "Cost",
                        ]}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString()
                        }
                      />
                      <Bar
                        dataKey="cost"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Cost by Model Table */}
            {data.byModel.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost by Model</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Model
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Calls
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Tokens
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byModel.map((row) => (
                          <tr key={row.model} className="border-b last:border-0">
                            <td className="py-3 px-4 font-mono">
                              {row.model}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {row.calls.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {formatTokens(row.tokens)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatCost(row.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
