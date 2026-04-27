import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

const {
  whatsappBroadcasts,
  whatsappContacts,
} = await import("../src/services/zernio.js");

describe("Zernio service endpoint mapping", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, broadcast: { id: "bc_1" }, contact: { id: "ct_1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("creates WhatsApp broadcasts through the documented /broadcasts endpoint", async () => {
    await whatsappBroadcasts.create({
      profileId: "prof_1",
      accountId: "acc_1",
      name: "Campaign",
      template: { name: "hello_world", language: "en" },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://zernio.com/api/v1/broadcasts");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      profileId: "prof_1",
      accountId: "acc_1",
      platform: "whatsapp",
      name: "Campaign",
      template: { name: "hello_world", language: "en" },
    });
  });

  it("adds broadcast recipients with documented POST body shapes", async () => {
    await whatsappBroadcasts.addRecipients("bc_1", { phones: ["+5511999887766"] } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://zernio.com/api/v1/broadcasts/bc_1/recipients");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ phones: ["+5511999887766"] });
  });

  it("creates WhatsApp contacts through the generic contacts endpoint", async () => {
    await whatsappContacts.create({
      profileId: "prof_1",
      accountId: "acc_1",
      phone: "+5511999887766",
      name: "Maria",
      tags: ["vip"],
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://zernio.com/api/v1/contacts");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      profileId: "prof_1",
      accountId: "acc_1",
      platform: "whatsapp",
      platformIdentifier: "+5511999887766",
      name: "Maria",
      tags: ["vip"],
    });
  });
});
