export function getCredentialedCorsHeaders(request: Request, methods: string[] = ["GET", "POST", "DELETE", "OPTIONS"]) {
  const headers = new Headers();
  const origin = request.headers.get("origin");

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", methods.join(", "));
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return headers;
}
