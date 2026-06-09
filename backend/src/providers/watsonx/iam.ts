import { config } from "../../config.js";

// watsonx.ai authenticates with a short-lived IBM Cloud IAM bearer token obtained
// by exchanging the API key. We cache the token and refresh ~1 min before expiry
// so back-to-back embed/generate calls don't re-auth on every request.
let cached: { token: string; expiresAt: number } | null = null;

export async function getIamToken(): Promise<string> {
  if (!config.watsonx.apiKey) {
    throw new Error("WATSONX_API_KEY is required for the watsonx provider");
  }
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.token;

  const res = await fetch(`${config.watsonx.iamUrl}/identity/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: config.watsonx.apiKey,
    }),
  });
  if (!res.ok) {
    throw new Error(`IBM IAM token exchange failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json: any = await res.json();
  cached = {
    token: json.access_token,
    expiresAt: now + (Number(json.expires_in ?? 3600) - 60) * 1000,
  };
  return cached.token;
}
