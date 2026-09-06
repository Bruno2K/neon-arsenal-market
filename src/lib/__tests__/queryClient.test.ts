import { describe, expect, it } from "vitest";
import {
  QUERY_GET_RETRY,
  QUERY_MUTATION_RETRY,
  createAppQueryClient,
} from "../queryClient";

describe("createAppQueryClient", () => {
  it("retries GET once and mutations never", () => {
    const client = createAppQueryClient();
    expect(QUERY_GET_RETRY).toBe(1);
    expect(QUERY_MUTATION_RETRY).toBe(0);
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });
});
