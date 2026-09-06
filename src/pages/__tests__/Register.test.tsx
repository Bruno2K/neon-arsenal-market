import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Register, {
  REGISTER_RESEND_COOLDOWN_SECONDS,
  REGISTER_RESEND_SUCCESS,
} from "../Register";
import {
  ApiClientError,
  USER_FACING_RATE_LIMIT,
} from "@/lib/userFacingApiError";

const startRegistration = vi.fn();
const confirmRegistration = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    startRegistration,
    confirmRegistration,
    error: null,
    clearError: vi.fn(),
  }),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<div>landed-home</div>} />
        <Route path="/seller" element={<div>landed-seller</div>} />
        <Route path="/admin" element={<div>landed-admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function goToStep2(values?: {
  name?: string;
  email?: string;
  password?: string;
}) {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: values?.name ?? "Ana" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: values?.email ?? "ana@test.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: values?.password ?? "secret1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar código por e-mail" }),
  );
  expect(await screen.findByLabelText("Código")).toBeTruthy();
}

describe("Register", () => {
  beforeEach(() => {
    startRegistration.mockReset();
    confirmRegistration.mockReset();
    startRegistration.mockResolvedValue({ message: "ok", code: "123456" });
    confirmRegistration.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not offer ADMIN as a public registration role", () => {
    renderRegister();
    expect(screen.getByText("Comprador")).toBeTruthy();
    expect(screen.getByText("Vendedor")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("ADMIN")).toBeNull();
  });

  it("sends a customer to home after email verify", async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secret1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código por e-mail" }),
    );

    expect(await screen.findByLabelText("Código")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("landed-home")).toBeTruthy();
    expect(screen.queryByText("landed-seller")).toBeNull();
  });

  it("sends a seller to /seller after email verify", async () => {
    renderRegister();
    fireEvent.click(screen.getByText("Vendedor"));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Loja" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "loja@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Nome da loja"), {
      target: { value: "Neon Trader" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código por e-mail" }),
    );

    expect(await screen.findByLabelText("Código")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("landed-seller")).toBeTruthy();
    expect(screen.queryByText("landed-home")).toBeNull();
    expect(screen.queryByText("landed-admin")).toBeNull();
  });

  it("keeps name and email from step 1 when going back from step 2", async () => {
    renderRegister();
    await goToStep2({ name: "Ana", email: "ana@test.com" });

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByLabelText("Nome")).toHaveValue("Ana");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@test.com");
  });

  it("does not show a verification code when the API omits it", async () => {
    startRegistration.mockResolvedValue({ message: "ok" });
    renderRegister();
    await goToStep2();

    expect(screen.queryByText(/código =/i)).toBeNull();
    expect(screen.queryByText("123456")).toBeNull();
  });

  async function submitStep1AndFlush() {
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secret1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código por e-mail" }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Código")).toBeTruthy();
  }

  it("resends with the same step 1 fields after the cooldown", async () => {
    vi.useFakeTimers();
    renderRegister();
    await submitStep1AndFlush();

    expect(
      screen.getByRole("button", {
        name: `Reenviar em ${REGISTER_RESEND_COOLDOWN_SECONDS}s`,
      }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        REGISTER_RESEND_COOLDOWN_SECONDS * 1000,
      );
    });

    const resend = screen.getByRole("button", { name: "Reenviar código" });
    expect(resend).toBeEnabled();
    fireEvent.click(resend);

    await act(async () => {
      await Promise.resolve();
    });

    expect(startRegistration).toHaveBeenCalledTimes(2);
    expect(startRegistration).toHaveBeenLastCalledWith({
      name: "Ana",
      email: "ana@test.com",
      password: "secret1",
      role: "CUSTOMER",
    });
    expect(screen.getByText(REGISTER_RESEND_SUCCESS)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `Reenviar em ${REGISTER_RESEND_COOLDOWN_SECONDS}s`,
      }),
    ).toBeDisabled();
  });

  it("maps 429 on resend to wait copy without leaving step 2", async () => {
    startRegistration
      .mockResolvedValueOnce({ message: "ok" })
      .mockRejectedValueOnce(
        new ApiClientError("Too many requests", { status: 429 }),
      );

    vi.useFakeTimers();
    renderRegister();
    await submitStep1AndFlush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        REGISTER_RESEND_COOLDOWN_SECONDS * 1000,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Reenviar código" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(USER_FACING_RATE_LIMIT);
    expect(screen.getByLabelText("Código")).toBeTruthy();
    expect(screen.getByText(/ana@test.com/)).toBeTruthy();
    expect(startRegistration).toHaveBeenCalledTimes(2);
  });
});
