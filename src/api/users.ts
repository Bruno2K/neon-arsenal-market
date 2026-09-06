import { api } from "./client";
import type { User } from "@/types/api";

/** Matches `server/src/modules/users/users.dto.ts` — no current-password field. */
export interface UpdateMeInput {
  name?: string;
  email?: string;
  password?: string;
}

export async function getMe(): Promise<User> {
  return api.get<User>("/users/me");
}

export async function updateMe(body: UpdateMeInput): Promise<User> {
  return api.patch<User>("/users/me", body);
}
