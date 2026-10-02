import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const rawApiUrl = process.env.API_URL || "http://backend:8000/api";
  const backendBase = rawApiUrl.replace(/\/api\/?$/, "");
  const url = new URL(request.url);
  const targetUrl = `${backendBase}${url.pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== "host" &&
      lowerKey !== "connection" &&
      lowerKey !== "content-length" &&
      lowerKey !== "keep-alive"
    ) {
      headers.set(key, value);
    }
  });

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== "content-encoding" &&
        lowerKey !== "content-length" &&
        lowerKey !== "transfer-encoding"
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error to", targetUrl, error);
    return new NextResponse(
      JSON.stringify({ error: "Backend proxy error", details: String(error) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
