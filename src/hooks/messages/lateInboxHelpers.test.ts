import { describe, it, expect } from "vitest";
import {
  buildLateInboxCall,
  buildLateInboxRequest,
  lateInboxRoutes,
  stripLatePrefix,
  withAccountIdBody,
  withAccountIdQuery,
  isMissingLateAccountId,
  assertAccountId,
  validateSendMessagePayload,
  validateUpdateConversationPayload,
  assertSendMessagePayload,
  assertUpdateConversationPayload,
  LatePayloadValidationError,
  LATE_CONVERSATION_STATUSES,
} from "./lateInboxHelpers";

const ACCOUNT_ID = "acc_123";
const CONVO_ID = "late_conv_abc";

describe("lateInboxHelpers", () => {
  describe("stripLatePrefix", () => {
    it("removes the late_ prefix", () => {
      expect(stripLatePrefix("late_conv_abc")).toBe("conv_abc");
    });

    it("leaves non-prefixed ids untouched", () => {
      expect(stripLatePrefix("conv_abc")).toBe("conv_abc");
    });
  });

  describe("withAccountIdQuery", () => {
    it("appends accountId with ? when route has no query", () => {
      expect(withAccountIdQuery("/inbox/x", ACCOUNT_ID)).toBe(
        `/inbox/x?accountId=${ACCOUNT_ID}`,
      );
    });

    it("appends accountId with & when route already has query params", () => {
      expect(withAccountIdQuery("/inbox/x?foo=1", ACCOUNT_ID)).toBe(
        `/inbox/x?foo=1&accountId=${ACCOUNT_ID}`,
      );
    });

    it("url-encodes the accountId", () => {
      expect(withAccountIdQuery("/inbox/x", "acc/with space")).toContain(
        "accountId=acc%2Fwith%20space",
      );
    });
  });

  describe("withAccountIdBody", () => {
    it("merges accountId into the body without mutating the original", () => {
      const original = { foo: "bar" };
      const merged = withAccountIdBody(original, ACCOUNT_ID);
      expect(merged).toEqual({ foo: "bar", accountId: ACCOUNT_ID });
      expect(original).toEqual({ foo: "bar" });
    });
  });

  describe("buildLateInboxCall", () => {
    it("includes accountId in BOTH query string and body for sendMessage (POST)", () => {
      const route = lateInboxRoutes.sendMessage(CONVO_ID);
      const { route: finalRoute, body } = buildLateInboxCall(
        route,
        ACCOUNT_ID,
        { message: "olá" },
      );

      // Query string
      expect(finalRoute).toContain(`accountId=${ACCOUNT_ID}`);
      expect(finalRoute).toBe(
        `/inbox/conversations/conv_abc/messages?accountId=${ACCOUNT_ID}`,
      );

      // Body
      expect(body).toEqual({ message: "olá", accountId: ACCOUNT_ID });
      expect(body.accountId).toBe(ACCOUNT_ID);
    });

    it("includes accountId in BOTH query string and body for updateConversation (PUT)", () => {
      const route = lateInboxRoutes.updateConversation(CONVO_ID);
      const { route: finalRoute, body } = buildLateInboxCall(
        route,
        ACCOUNT_ID,
        { status: "read" },
      );

      expect(finalRoute).toBe(
        `/inbox/conversations/conv_abc?accountId=${ACCOUNT_ID}`,
      );
      expect(body).toEqual({ status: "read", accountId: ACCOUNT_ID });
    });

    it("does not duplicate accountId when the route already has query params", () => {
      const { route } = buildLateInboxCall(
        "/inbox/conversations/conv_abc?foo=1",
        ACCOUNT_ID,
        { message: "x" },
      );
      const matches = route.match(/accountId=/g) ?? [];
      expect(matches.length).toBe(1);
      expect(route).toContain("foo=1&accountId=");
    });

    it("strips the late_ prefix on every prebuilt route", () => {
      expect(lateInboxRoutes.sendMessage(CONVO_ID)).not.toContain("late_");
      expect(lateInboxRoutes.updateConversation(CONVO_ID)).not.toContain("late_");
      expect(lateInboxRoutes.deleteConversation(CONVO_ID)).not.toContain("late_");
    });
  });

  describe("buildLateInboxRequest", () => {
    it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
      "attaches accountId to query AND body for %s",
      (method) => {
        const { route, body } = buildLateInboxRequest(
          "/inbox/conversations/conv_abc",
          ACCOUNT_ID,
          method,
          { foo: "bar" },
        );
        expect(route).toContain(`accountId=${ACCOUNT_ID}`);
        expect(body).toEqual({ foo: "bar", accountId: ACCOUNT_ID });
      },
    );

    it("attaches accountId only to query for GET", () => {
      const { route, body } = buildLateInboxRequest(
        "/inbox/conversations/conv_abc",
        ACCOUNT_ID,
        "GET",
      );
      expect(route).toContain(`accountId=${ACCOUNT_ID}`);
      expect(body).toBeUndefined();
    });

    it("uses an empty body when none is provided for mutative methods", () => {
      const { body } = buildLateInboxRequest(
        "/inbox/conversations/conv_abc",
        ACCOUNT_ID,
        "DELETE",
      );
      expect(body).toEqual({ accountId: ACCOUNT_ID });
    });
  });

  describe("isMissingLateAccountId", () => {
    it("returns true when conversation is Late and accountId is missing", () => {
      expect(isMissingLateAccountId({ isLateInbox: true, accountId: null })).toBe(true);
      expect(isMissingLateAccountId({ isLateInbox: true })).toBe(true);
      expect(isMissingLateAccountId({ isLateInbox: true, accountId: "" })).toBe(true);
    });

    it("returns false when accountId is present", () => {
      expect(isMissingLateAccountId({ isLateInbox: true, accountId: ACCOUNT_ID })).toBe(false);
    });

    it("returns false for non-Late conversations", () => {
      expect(isMissingLateAccountId({ isLateInbox: false })).toBe(false);
      expect(isMissingLateAccountId({})).toBe(false);
      expect(isMissingLateAccountId(null)).toBe(false);
      expect(isMissingLateAccountId(undefined)).toBe(false);
    });
  });

  describe("assertAccountId", () => {
    it("throws when accountId is missing", () => {
      expect(() => assertAccountId(undefined)).toThrow(/accountId ausente/);
      expect(() => assertAccountId(null)).toThrow(/accountId ausente/);
      expect(() => assertAccountId("")).toThrow(/accountId ausente/);
    });

    it("does not throw when accountId is present", () => {
      expect(() => assertAccountId(ACCOUNT_ID)).not.toThrow();
    });
  });

  describe("validateSendMessagePayload", () => {
    it("accepts a valid message", () => {
      const r = validateSendMessagePayload({ message: "hello" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ message: "hello" });
    });

    it("rejects empty/whitespace messages", () => {
      expect(validateSendMessagePayload({ message: "" }).ok).toBe(false);
      expect(validateSendMessagePayload({ message: "   " }).ok).toBe(false);
    });

    it("rejects missing or non-string message", () => {
      expect(validateSendMessagePayload({}).ok).toBe(false);
      expect(validateSendMessagePayload({ message: 42 }).ok).toBe(false);
      expect(validateSendMessagePayload(null).ok).toBe(false);
    });

    it("rejects messages over 4096 chars", () => {
      const long = "a".repeat(4097);
      expect(validateSendMessagePayload({ message: long }).ok).toBe(false);
    });
  });

  describe("validateUpdateConversationPayload", () => {
    it.each(LATE_CONVERSATION_STATUSES)("accepts valid status %s", (status) => {
      const r = validateUpdateConversationPayload({ status });
      expect(r.ok).toBe(true);
    });

    it("rejects unknown status values", () => {
      expect(validateUpdateConversationPayload({ status: "deleted" }).ok).toBe(false);
      expect(validateUpdateConversationPayload({ status: 1 }).ok).toBe(false);
      expect(validateUpdateConversationPayload({}).ok).toBe(false);
    });
  });

  describe("assert variants", () => {
    it("throw LatePayloadValidationError for invalid send payload", () => {
      expect(() => assertSendMessagePayload({ message: "" })).toThrow(LatePayloadValidationError);
    });

    it("throw LatePayloadValidationError for invalid update payload", () => {
      expect(() => assertUpdateConversationPayload({ status: "nope" })).toThrow(
        LatePayloadValidationError,
      );
    });

    it("return validated value for valid payloads", () => {
      expect(assertSendMessagePayload({ message: "ok" })).toEqual({ message: "ok" });
      expect(assertUpdateConversationPayload({ status: "read" })).toEqual({ status: "read" });
    });
  });
});
