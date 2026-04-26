import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const { getCurrentUserMock, fetchAuthSessionMock, fetchUserAttributesMock, hubListenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  fetchAuthSessionMock: vi.fn(),
  fetchUserAttributesMock: vi.fn(),
  hubListenMock: vi.fn(() => () => {}),
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  fetchAuthSession: fetchAuthSessionMock,
  fetchUserAttributes: fetchUserAttributesMock,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("aws-amplify/utils", () => ({
  Hub: { listen: hubListenMock },
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
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
  });

  it("settles loading to false and exposes anonymous user when no Cognito session exists", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("not signed in"));
    fetchAuthSessionMock.mockResolvedValue({ tokens: undefined });
    fetchUserAttributesMock.mockResolvedValue({});

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("user")).toHaveTextContent("anonymous");
    });
  });

  it("registers a Hub listener so auth events trigger rehydration", () => {
    getCurrentUserMock.mockRejectedValue(new Error("not signed in"));
    fetchAuthSessionMock.mockResolvedValue({ tokens: undefined });
    fetchUserAttributesMock.mockResolvedValue({});

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(hubListenMock).toHaveBeenCalledWith("auth", expect.any(Function));
  });
});
