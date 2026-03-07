export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  const [scheme, value] = header.split(/\s+/, 2);
  if (!scheme || !value || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return value.trim() || null;
}

export function isValidSyncToken(request: Request, expectedToken?: string): boolean {
  if (!expectedToken) {
    return false;
  }

  const token = readBearerToken(request);
  return token === expectedToken;
}
