const apiBaseRaw = import.meta.env.VITE_API_BASE_URL || "";
const apiBase = apiBaseRaw.replace(/\/+$/, "");
const isSupabaseFunctionBase = /\/functions\/v1\/[^/]+$/.test(apiBase);

export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    return apiBase ? `${apiBase}/${path}` : path;
  }

  // When VITE_API_BASE_URL points directly at the Supabase edge function
  // (e.g. https://<project>.supabase.co/functions/v1/api),
  // strip the "/api" prefix from the path to avoid "/api/api/...".
  const normalizedPath =
    isSupabaseFunctionBase && path.startsWith("/api/")
      ? path.replace(/^\/api/, "")
      : path;

  return apiBase ? `${apiBase}${normalizedPath}` : normalizedPath;
}
