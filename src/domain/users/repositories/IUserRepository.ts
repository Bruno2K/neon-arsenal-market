// ─── Domain: IUserRepository ─────────────────────────────────────────────────

export interface UpdateMeData {
  name?: string;
  email?: string;
  password?: string;
}

export interface IUserRepository {
  updateMe(data: UpdateMeData): Promise<void>;
}
