import { GoogleAuth } from "google-auth-library";
import { NextRequest } from "next/server";

/**
 * A browser fetch() to apps/api's separate origin would never carry IAP/GCP credentials, no
 * matter what protects api — so every browser -> api call is routed through here instead. This
 * mints a real Cloud Run service-to-service ID token server-side and forwards the request
 * untouched (a dumb byte-for-byte proxy, not a re-parse of JSON/FormData bodies). This is also
 * how the Gmail OAuth callback works without api ever needing to be publicly reachable: Google's
 * redirect is browser-mediated, so pointing GMAIL_OAUTH_REDIRECT_URI here (web's already
 * IAP-authenticated origin) lets it land here and get relayed server-side, redirect and all.
 */
const API_URL = process.env.API_URL ?? "http://localhost:8080";

let auth: GoogleAuth | undefined;

async function getAuthorizationHeader(): Promise<string | undefined> {
  if (!API_URL.startsWith("https://")) {
    return undefined; // local dev: api runs unauthenticated, no token needed
  }
  auth ??= new GoogleAuth();
  const client = await auth.getIdTokenClient(API_URL);
  const headers = await client.getRequestHeaders();
  return headers.Authorization;
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const targetUrl = new URL(`${API_URL}/${path.join("/")}`);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const therapistId = req.headers.get("x-therapist-id");
  if (therapistId) headers.set("x-therapist-id", therapistId);

  const authorization = await getAuthorizationHeader();
  if (authorization) headers.set("authorization", authorization);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual", // relay redirects (e.g. the Gmail callback) to the browser, don't follow them here
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);
  const location = upstream.headers.get("location");
  if (location) responseHeaders.set("location", location);

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
