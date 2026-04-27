import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWallpaper } from "@/hooks/ui/useWallpaper";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

function WallpaperProbe() {
  const { wallpaperId, brightness, blur } = useWallpaper();

  return (
    <div>
      <span data-testid="wallpaper-id">{wallpaperId}</span>
      <span data-testid="wallpaper-brightness">{brightness}</span>
      <span data-testid="wallpaper-blur">{blur}</span>
    </div>
  );
}

describe("useWallpaper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the raw wallpaper settings after hydration instead of applying defaults", async () => {
    localStorage.setItem("dashfy-wallpaper", "beach");
    localStorage.setItem("dashfy-wallpaper-brightness", "72");
    localStorage.setItem("dashfy-wallpaper-blur", "11");

    render(<WallpaperProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("wallpaper-id")).toHaveTextContent("beach");
      expect(screen.getByTestId("wallpaper-brightness")).toHaveTextContent("72");
      expect(screen.getByTestId("wallpaper-blur")).toHaveTextContent("11");
    });
  });
});
