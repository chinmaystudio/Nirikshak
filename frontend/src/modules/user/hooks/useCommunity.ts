import { useAsync } from "./useAsync";
import { getCommunityFeed, getCommunityStats, type CommunityFeed } from "@/services/community/communityService";
import type { CommunityIssue, CommunityStats } from "@/types/community";

export interface CommunityFeedResult {
  issues: CommunityIssue[];
  stats: CommunityStats;
}

export function useCommunityFeed(feed: CommunityFeed): ReturnType<typeof useAsync<CommunityFeedResult>> {
  return useAsync(
    async () => {
      const [issues, stats] = await Promise.all([getCommunityFeed(feed), getCommunityStats()]);
      return { issues, stats };
    },
    [feed]
  );
}
