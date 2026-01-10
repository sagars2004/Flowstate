export interface Insight {
  id: number;
  sessionId: string;
  generatedAt: Date;
  insightsJson: string; // JSON string of SessionInsights
  recommendationsJson: string; // JSON string of recommendations array
  createdAt: Date;
}

export interface CreateInsightData {
  sessionId: string;
  insightsJson: string;
  recommendationsJson: string;
}

export interface SessionInsightsData {
  summary: string;
  whatWentWell: string;
  areasForImprovement: string;
  recommendations: string;
  focusFingerprint: string;
  generatedAt: string;
}
