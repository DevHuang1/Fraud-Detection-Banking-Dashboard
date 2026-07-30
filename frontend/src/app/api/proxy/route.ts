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
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "ML service error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "ML service unavailable" }, { status: 503 });
  }
}
