const CALLBACK_KEYS = ["connected", "profileId", "accountId", "username", "state"];

export interface ZernioWhatsAppCallback {
  isCallback: boolean;
  accountId: string | null;
  profileId: string | null;
  username: string | null;
  cleanSearch: string;
}

export function parseZernioWhatsAppCallback(search: string): ZernioWhatsAppCallback {
  const params = new URLSearchParams(search);
  const isCallback = params.get("connected") === "whatsapp";

  if (!isCallback) {
    return {
      isCallback: false,
      accountId: null,
      profileId: null,
      username: null,
      cleanSearch: search,
    };
  }

  const accountId = params.get("accountId");
  const profileId = params.get("profileId");
  const username = params.get("username");

  for (const key of CALLBACK_KEYS) params.delete(key);
  const cleaned = params.toString();

  return {
    isCallback: true,
    accountId,
    profileId,
    username,
    cleanSearch: cleaned ? `?${cleaned}` : "",
  };
}
