import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const {
  getSessionMock,
  onAuthStateChangeMock,
  selectMock,
  eqMock,
  singleMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
    from: vi.fn(() => ({
      select: selectMock,
    })),
  },
}));

function Consumer() {
  const { loading, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id ?? "anonymous"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    singleMock.mockResolvedValue({
      data: { display_name: "Teste", avatar_url: null, onboarding_completed: true },
    });
    eqMock.mockReturnValue({ single: singleMock });
    selectMock.mockReturnValue({ eq: eqMock });

    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("desbloqueia o loading quando onAuthStateChange chega antes do getSession", async () => {
    let authListener: ((event: string, session: any) => void) | undefined;

    onAuthStateChangeMock.mockImplementation((listener: typeof authListener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    getSessionMock.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      authListener?.("SIGNED_IN", {
        user: { id: "user_123" },
      });
      await vi.runOnlyPendingTimersAsync();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("user_123");
    });
  });

  it("usa fallback de boot para não travar indefinidamente quando getSession pendura", async () => {
    getSessionMock.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await vi.runOnlyPendingTimersAsync();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("anonymous");
    });
  });
});
