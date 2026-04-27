import { describe, expect, it } from "vitest";
import { parseZernioWhatsAppCallback } from "./zernio-whatsapp-callback";

describe("parseZernioWhatsAppCallback", () => {
  it("detects successful WhatsApp redirect callbacks and removes provider params", () => {
    const result = parseZernioWhatsAppCallback(
      "?connected=whatsapp&profileId=prof_1&accountId=acc_1&username=%2B5511999887766&tab=overview",
    );

    expect(result).toEqual({
      isCallback: true,
      accountId: "acc_1",
      profileId: "prof_1",
      username: "+5511999887766",
      cleanSearch: "?tab=overview",
    });
  });

  it("ignores non-WhatsApp query strings without changing them", () => {
    const result = parseZernioWhatsAppCallback("?connected=instagram&accountId=acc_1");

    expect(result).toEqual({
      isCallback: false,
      accountId: null,
      profileId: null,
      username: null,
      cleanSearch: "?connected=instagram&accountId=acc_1",
    });
  });
});
