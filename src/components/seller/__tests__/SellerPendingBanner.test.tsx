import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SELLER_PENDING_BANNER_BODY,
  SELLER_PENDING_BANNER_TITLE,
  SellerPendingBanner,
} from "../SellerPendingBanner";

describe("SellerPendingBanner", () => {
  it("explains admin approval without inventing an email", () => {
    render(<SellerPendingBanner />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(SELLER_PENDING_BANNER_TITLE)).toBeTruthy();
    expect(screen.getByText(SELLER_PENDING_BANNER_BODY)).toBeTruthy();
    expect(screen.queryByText(/e-?mail/i)).toBeNull();
    expect(screen.queryByText(/aprovad[oa] por e-mail/i)).toBeNull();
  });
});
