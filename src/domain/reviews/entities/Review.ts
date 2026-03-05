// ─── Domain Entity: Review ───────────────────────────────────────────────────

export interface ReviewUser {
  id: string;
  name: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user?: ReviewUser;
}

export interface CreateReviewData {
  productId: string;
  rating: number;
  comment?: string;
}
