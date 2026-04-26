import { Amplify } from "aws-amplify";

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
// Amplify wants the Cognito domain as a bare hostname; strip any protocol
// prefix or trailing slash so `https://foo.auth…/` and `foo.auth…` both work.
const cognitoDomain = (import.meta.env.VITE_COGNITO_DOMAIN as string | undefined)
  ?.replace(/^https?:\/\//i, "")
  .replace(/\/$/, "");

if (!userPoolId || !userPoolClientId) {
  // eslint-disable-next-line no-console
  console.warn(
    "[amplify] VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID are required for sign-in to work.",
  );
}

const oauthOrigin = window.location.origin;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: userPoolId ?? "us-east-1_placeholder",
      userPoolClientId: userPoolClientId ?? "placeholder",
      ...(cognitoDomain
        ? {
            loginWith: {
              oauth: {
                domain: cognitoDomain,
                scopes: ["openid", "email", "profile"],
                redirectSignIn: [`${oauthOrigin}/`],
                redirectSignOut: [`${oauthOrigin}/auth`],
                responseType: "code",
              },
            },
          }
        : {}),
    },
  },
});
