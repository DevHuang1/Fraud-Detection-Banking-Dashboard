import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ALLOWED_WORKSPACE_ROLES, homePathForRole, VALID_ROLES, type Role } from "@/lib/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function resolveRoleFromUser(user: { user_metadata?: unknown; app_metadata?: unknown }): Role | null {
  const meta = (user.user_metadata ?? {}) as { role?: unknown };
  const app = (user.app_metadata ?? {}) as { role?: unknown };
  for (const r of [meta.role, app.role]) {
    if (typeof r === "string" && VALID_ROLES.includes(r as Role)) return r as Role;
  }
  return null;
}

async function resolveRole(supabase: ReturnType<typeof createServerClient>, user: { id: string; user_metadata?: unknown; app_metadata?: unknown }): Promise<Role | null> {
  // Fast path: role is embedded in the JWT metadata, so no extra network call.
  const metaRole = resolveRoleFromUser(user);
  if (metaRole) return metaRole;
  // Fallback: resolve from user_profiles (e.g. role set via Team Management).
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.role && VALID_ROLES.includes(data.role as Role)) return data.role as Role;
  } catch {}
  return null;
}

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { pathname } = req.nextUrl;
  const url = req.nextUrl.clone();

  if (pathname === "/login" || pathname === "/signup") {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const role = await resolveRole(supabase, user);

  const workspaceKey = Object.keys(ALLOWED_WORKSPACE_ROLES).find((key) => pathname === `/${key}` || pathname.startsWith(`/${key}/`));

  if (workspaceKey) {
    const allowed = ALLOWED_WORKSPACE_ROLES[workspaceKey];
    if (!role || !allowed.includes(role)) {
      url.pathname = homePathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname === "/") {
    if (role && role !== "user") {
      url.pathname = homePathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
