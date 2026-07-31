import { NextRequest, NextResponse } from "next/server";

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:5001";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || "";
  const limit = req.nextUrl.searchParams.get("limit") || "100";
  const offset = req.nextUrl.searchParams.get("offset") || "0";

  const url = path === "stats"
    ? `${ML_API}/api/stats`
    : `${ML_API}/api/transactions?limit=${limit}&offset=${offset}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json({ error: "ML service error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "ML service unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || "";

  try {
    const body = await req.json();
    const res = await fetch(`${ML_API}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "ML service error" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "ML service unavailable" }, { status: 503 });
  }
}
