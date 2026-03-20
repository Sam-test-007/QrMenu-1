const apiBaseRaw = import.meta.env.VITE_API_BASE_URL || "";
const apiBase = apiBaseRaw.replace(/\/+$/, "");

export function apiUrl(path: string) {
  if (!path.startsWith("/")) return apiBase ? `${apiBase}/${path}` : path;
  return apiBase ? `${apiBase}${path}` : path;
}
