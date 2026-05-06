export * from "./mandate";

export type UserTier = "NEWCOMER" | "MEMBER" | "TRUSTED" | "EXPERT" | "ELITE";

export type Category =
  | "SPORTS"
  | "FINANCE"
  | "TECH"
  | "POLITICS"
  | "SOCIAL"
  | "GENERAL";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface User {
  id: string;
  piUserId: string;
  username: string;
  ppaBalance: number;
  accuracyRate: number;
  reputationScore: number;
  streakDays: number;
  tier: UserTier;
  totalPredictions: number;
  correctPredictions: number;
}

export interface Content {
  id: string;
  title: string;
  category: Category;
  type: string;
  endsAt: string;
  rewardPool: number;
  participantCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  accuracyRate: number;
  reputationScore: number;
  tier: UserTier;
}