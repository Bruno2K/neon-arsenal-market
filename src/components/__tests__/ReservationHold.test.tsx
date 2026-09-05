import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservationHold } from "../ReservationHold";
import {
  EXPIRED_HOLD_COPY,
  PRE_ORDER_HOLD_COPY,
  VERIFYING_RESERVATION_COPY,
} from "@/lib/orderPaymentView";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");

describe("ReservationHold", () => {
  it("does not claim a hold before the order exists", () => {
    render(<ReservationHold phase="pre-order" now={NOW} />);
    expect(screen.getByText(PRE_ORDER_HOLD_COPY)).toBeTruthy();
    expect(screen.getByText(/não segura o item/i)).toBeTruthy();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it("shows a verifying placeholder while the order loads", () => {
    render(<ReservationHold phase="order" isLoading now={NOW} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(VERIFYING_RESERVATION_COPY)).toBeTruthy();
    expect(screen.queryByText(/15:00/)).toBeNull();
  });

  it("renders no countdown when there is no server expiry", () => {
    const { container } = render(
      <ReservationHold phase="order" expiresAt={null} now={NOW} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
  });

  it("counts down from reservationExpiresAt instead of a local 15-minute timer", () => {
    const expiresAt = Date.parse("2026-09-05T12:01:32.000Z");
    render(<ReservationHold phase="order" expiresAt={expiresAt} now={NOW} />);
    expect(screen.getAllByText(/Reservado para você/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("01:32")).toBeTruthy();
    expect(screen.queryByText("15:00")).toBeNull();
    expect(
      screen.getByText("Reservado para você. 1 minuto restante."),
    ).toBeTruthy();
  });

  it("announces remaining minutes politely, not the ticking seconds", () => {
    const expiresAt = Date.parse("2026-09-05T12:14:32.000Z");
    render(<ReservationHold phase="order" expiresAt={expiresAt} now={NOW} />);
    const live = screen.getByText("Reservado para você. 14 minutos restantes.");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("14:32")).toBeTruthy();
  });

  it("uses expired-hold copy that is not a payment refusal", () => {
    const expiresAt = Date.parse("2026-09-05T11:59:00.000Z");
    render(<ReservationHold phase="order" expiresAt={expiresAt} now={NOW} />);
    expect(screen.getAllByText(EXPIRED_HOLD_COPY).length).toBeGreaterThan(0);
    expect(screen.queryByText(/pagamento recusado/i)).toBeNull();
    expect(screen.queryByText(/PayPal recusou/i)).toBeNull();
    expect(screen.queryByText(/Reservado para você ·/)).toBeNull();
  });
});
