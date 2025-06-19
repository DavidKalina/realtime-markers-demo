import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Users, Target, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface QueryCluster {
  representativeQuery: string;
  similarQueries: Array<{
    query: string;
    similarity: number;
    totalSearches: number;
    hitRate: number;
  }>;
  totalSearches: number;
  averageHitRate: number;
  totalHits: number;
  needsAttention: boolean;
}

interface QueryClustersSectionProps {
  clusters: QueryCluster[];
}

export function QueryClustersSection({ clusters }: QueryClustersSectionProps) {
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (query: string) => {
    const newOpen = new Set(openClusters);
    if (newOpen.has(query)) {
      newOpen.delete(query);
    } else {
      newOpen.add(query);
    }
    setOpenClusters(newOpen);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Query Clusters
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Groups of similar queries that may need content optimization
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {clusters.map((cluster) => (
            <div key={cluster.representativeQuery}>
              <div
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleCluster(cluster.representativeQuery)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      cluster.needsAttention ? "bg-red-100" : "bg-blue-100"
                    }`}
                  >
                    {cluster.needsAttention ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Target className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {cluster.representativeQuery}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {cluster.similarQueries.length} similar queries
                      </span>
                      <span>{cluster.totalSearches} total searches</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      cluster.averageHitRate >= 80
                        ? "default"
                        : cluster.averageHitRate >= 50
                          ? "secondary"
                          : "destructive"
                    }
                    className="text-xs"
                  >
                    {cluster.averageHitRate.toFixed(1)}% avg hit rate
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      openClusters.has(cluster.representativeQuery)
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </div>
              </div>
              {openClusters.has(cluster.representativeQuery) && (
                <div className="ml-12 mt-2 space-y-2">
                  {cluster.similarQueries.map((similarQuery) => (
                    <div
                      key={similarQuery.query}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {similarQuery.query}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {similarQuery.totalSearches} searches •{" "}
                          {similarQuery.similarity.toFixed(2)} similarity
                        </p>
                      </div>
                      <Badge
                        variant={
                          similarQuery.hitRate >= 80
                            ? "default"
                            : similarQuery.hitRate >= 50
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs"
                      >
                        {similarQuery.hitRate.toFixed(1)}% hit rate
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
