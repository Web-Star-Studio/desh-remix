import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";

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

function AvatarUpdater() {
  const { loading, updateProfile } = useAuth();
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => updateProfile({ avatar_url: "data:image/webp;base64,abc" })}
    >
      update avatar
    </button>
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

  it("registers a Hub listener so auth events trigger rehydration", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("not signed in"));
    fetchAuthSessionMock.mockResolvedValue({ tokens: undefined });
    fetchUserAttributesMock.mockResolvedValue({});

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(hubListenMock).toHaveBeenCalledWith("auth", expect.any(Function));
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  });

  it("persists avatar_url changes through the /me patch payload", async () => {
    getCurrentUserMock.mockResolvedValue({ userId: "sub-1" });
    fetchAuthSessionMock.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "access-token" },
        idToken: { payload: { sub: "sub-1", email: "user@desh.test", name: "User" } },
      },
    });
    fetchUserAttributesMock.mockResolvedValue({ email: "user@desh.test", name: "User" });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        displayName: "User",
        avatarUrl: null,
        onboardingCompleted: false,
      })
      .mockResolvedValueOnce({
        displayName: "User",
        avatarUrl: "data:image/webp;base64,abc",
        onboardingCompleted: false,
      });

    render(
      <AuthProvider>
        <AvatarUpdater />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    screen.getByRole("button").click();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith("/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: "data:image/webp;base64,abc" }),
      });
    });
  });
});
