import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { supabase, currency } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Minus,
  ShoppingCart,
  Leaf,
  Flame,
  Search,
  Globe,
} from "lucide-react";
import type { Restaurant, MenuItem } from "@shared/schema";

interface MenuItemWithQuantity {
  id: string;
  name: string;
  price: string;
  available: boolean | null;
  description: string | null;
  imageUrl: string | null;
  category?: string | null;
  quantity: number;
}

interface MenuData {
  name: string;
  items: MenuItemWithQuantity[];
}

// Restaurant-level image shown in header
// kept separate from menu items
export default function CustomerMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState<MenuData>({ name: "", items: [] });
  const [loading, setLoading] = useState(true);
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(
    null,
  );
  const [restaurantLinks, setRestaurantLinks] = useState<{
    website?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
  }>({});
  const [suggestion, setSuggestion] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<{
    table_number: number;
    name?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract parameters from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const tableId = urlParams.get("table");

  const readApiError = async (response: Response) => {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data.error || data.message || response.statusText;
    } catch {
      return text || response.statusText;
    }
  };

  const readApiJson = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        "Invalid server response (expected JSON). Check API base URL or server availability.",
      );
    }
  };

  useEffect(() => {
    if (token) {
      // Token provided - validate it
      validateTokenAndLoadMenu();
    } else if (tableId) {
      // No token but table ID provided - generate fresh token (QR scan)
      generateFreshTokenForTable(tableId);
    } else {
      setError("Invalid access. Please scan a valid QR code.");
      setLoading(false);
    }
  }, [token, tableId]);

  // Periodic session refresh to prevent expiration
  useEffect(() => {
    if (!sessionId || !token) return;

    const refreshInterval = setInterval(async () => {
      try {
        // Check if session is still valid
        const response = await fetch(apiUrl("/api/validate-token"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          // Session expired - don't auto-refresh
          // User needs to scan QR code again for new session
          console.log("Session expired - user needs to scan QR again");
        }
      } catch (error) {
        console.error("Session refresh check failed:", error);
      }
    }, 30 * 1000); // Check every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [sessionId, token, slug]);

  const generateFreshTokenForTable = async (tableId: string) => {
    try {
      const response = await fetch(
        apiUrl(`/api/tables/${tableId}/generate-token`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const errorMessage = await readApiError(response);
        throw new Error(errorMessage || "Failed to generate token");
      }

      const data = await readApiJson(response);

      // Update URL with the new token
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("token", data.token);
      newUrl.searchParams.delete("table"); // Remove table param since we now have token
      window.history.replaceState({}, "", newUrl.toString());

      // Now validate the new token
      await validateToken(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateToken = async (tokenToValidate: string) => {
    const response = await fetch(apiUrl("/api/validate-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenToValidate }),
    });

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      throw new Error(errorMessage || "Invalid token");
    }

    const data = await readApiJson(response);
    setSessionId(data.session_id);
    setTableInfo({
      table_number: data.table_number,
      name: data.table_name,
    });

    // Load menu data
    setMenu({
      name: data.restaurant.name,
      items: data.menu.map((item: any) => ({
        ...item,
        imageUrl: item.image_url, // Convert snake_case to camelCase
        quantity: 0,
      })),
    });
    setRestaurantImageUrl(data.restaurant.image_url);
    setRestaurantLinks({
      website: data.restaurant.website_url ?? null,
      instagram: data.restaurant.instagram_url ?? null,
      facebook: data.restaurant.facebook_url ?? null,
      tiktok: data.restaurant.tiktok_url ?? null,
    });
  };

  const validateTokenAndLoadMenu = async () => {
    try {
      await validateToken(token!);
    } catch (err: any) {
      // Don't auto-generate tokens on session expiration
      // Users must scan QR code again to get a fresh session
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    setMenu((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], quantity: Math.max(0, newQuantity) };
      return { ...prev, items };
    });
  };

  const total = useMemo(
    () =>
      menu.items
        .filter((item) => item.quantity > 0)
        .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [menu.items],
  );

  const itemsInOrder = useMemo(
    () => menu.items.filter((item) => item.quantity > 0),
    [menu.items],
  );

  const filteredItems = useMemo(() => {
    const q = (searchQuery ?? "").trim().toLowerCase();
    const bySearch = !q
      ? menu.items
      : menu.items.filter((item) => {
          const name = (item.name || "").toLowerCase();
          const desc = (item.description || "").toLowerCase();
          return name.includes(q) || desc.includes(q);
        });

    if (!selectedCategory) return bySearch;
    return bySearch.filter(
      (item) =>
        (item as any).category === selectedCategory ||
        ((item as any).category == null &&
          selectedCategory === "Uncategorized"),
    );
  }, [menu.items, searchQuery, selectedCategory]);
  // Add this after the existing itemsInOrder useMemo
  const placeOrder = async () => {
    if (!itemsInOrder.length || !sessionId) return;

    try {
      const orderData = {
        session_id: sessionId,
        items: itemsInOrder.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
        })),
        suggestion: suggestion.trim() || null,
      };

      const response = await fetch(apiUrl("/api/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorMessage = await readApiError(response);
        throw new Error(errorMessage || "Failed to place order");
      }

      const result = await readApiJson(response);

      // Reset order after successful submission
      setMenu((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, quantity: 0 })),
      }));
      setSuggestion("");

      alert(`Order placed successfully! Order #${result.order_id}`);
    } catch (error: any) {
      console.error("Error placing order:", error);
      alert(error.message || "Failed to place order. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading menu...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Please scan a valid QR code from your table to access the menu.
          </p>
        </div>
      </div>
    );
  }

  const categories = Array.from(
    new Set(menu.items.map((i) => (i as any).category || "Uncategorized")),
  );

  const toHref = (
    value?: string | null,
    platform?: "website" | "instagram" | "facebook" | "tiktok",
  ) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^instagram\.com/i.test(trimmed)) return `https://${trimmed}`;
    if (/^facebook\.com/i.test(trimmed)) return `https://${trimmed}`;
    if (/^tiktok\.com/i.test(trimmed)) return `https://${trimmed}`;

    const handle = trimmed.replace(/^@/, "");
    if (platform === "instagram") return `https://instagram.com/${handle}`;
    if (platform === "facebook") return `https://facebook.com/${handle}`;
    if (platform === "tiktok") return `https://tiktok.com/@${handle}`;

    return `https://${trimmed}`;
  };

  const InstagramIcon = () => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5zm4.1-3.4a.9.9 0 1 1-.9-.9.9.9 0 0 1 .9.9z" />
    </svg>
  );

  const FacebookIcon = () => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M13 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h2v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1z" />
    </svg>
  );

  const TikTokIcon = () => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M16 3c.2 1.7 1.3 3.2 3 3.6v2.6c-1.6-.1-3-.6-4.2-1.5v6.8a5.5 5.5 0 1 1-5.5-5.5c.4 0 .8 0 1.2.1v2.9a2.7 2.7 0 1 0 2.1 2.6V3h3.4z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Restaurant Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-white shadow-lg">
            {restaurantImageUrl ? (
              <img
                src={restaurantImageUrl}
                alt={menu.name || "Restaurant image"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Leaf className="text-gray-400 h-6 w-6" />
              </div>
            )}
          </div>
          <h1
            className="text-3xl font-bold text-gray-900 mb-2"
            data-testid="text-restaurant-name"
          >
            {menu.name}
          </h1>
          {tableInfo && (
            <div className="mb-2">
              <Badge
                variant="outline"
                className="text-lg px-4 py-1 bg-emerald-50 border-emerald-200 text-emerald-700"
                data-testid="text-table-number"
              >
                🪑 Table {tableInfo.name || tableInfo.table_number}
              </Badge>
            </div>
          )}
          <p className="text-gray-600">
            Place Your Order. Wait for it to be served!
          </p>
          {(restaurantLinks.website ||
            restaurantLinks.instagram ||
            restaurantLinks.facebook ||
            restaurantLinks.tiktok) && (
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
              {restaurantLinks.website && (
                <a
                  href={toHref(restaurantLinks.website, "website")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-primary-200 text-primary-600 hover:text-primary-700 hover:border-primary-300"
                  aria-label="Website"
                >
                  <Globe className="h-4 w-4" />
                  <span className="sr-only">Website</span>
                </a>
              )}
              {restaurantLinks.instagram && (
                <a
                  href={toHref(restaurantLinks.instagram, "instagram")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-primary-200 text-primary-600 hover:text-primary-700 hover:border-primary-300"
                  aria-label="Instagram"
                >
                  <InstagramIcon />
                  <span className="sr-only">Instagram</span>
                </a>
              )}
              {restaurantLinks.facebook && (
                <a
                  href={toHref(restaurantLinks.facebook, "facebook")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-primary-200 text-primary-600 hover:text-primary-700 hover:border-primary-300"
                  aria-label="Facebook"
                >
                  <FacebookIcon />
                  <span className="sr-only">Facebook</span>
                </a>
              )}
              {restaurantLinks.tiktok && (
                <a
                  href={toHref(restaurantLinks.tiktok, "tiktok")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-primary-200 text-primary-600 hover:text-primary-700 hover:border-primary-300"
                  aria-label="TikTok"
                >
                  <TikTokIcon />
                  <span className="sr-only">TikTok</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Menu Categories */}
        <Card className="rounded-2xl shadow-lg mb-8">
          <CardHeader className="bg-primary-50 border-b border-primary-100">
            <div className="w-full">
              <div className="flex items-center justify-between">
                <CardTitle>Our Menu</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Tap items to add to your order
              </p>
              <div className="mt-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <Input
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery((e.target as HTMLInputElement).value)
                    }
                    className="pl-10"
                    data-testid="input-search-menu"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {categories.length > 0 && (
              <div className="px-4 py-3 overflow-x-auto">
                <div className="flex space-x-3">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${
                        selectedCategory === cat
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {menu.items.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Menu is currently empty or restaurant not found.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No results for "{searchQuery}".
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredItems.map((item) => {
                  const originalIndex = menu.items.findIndex(
                    (i) => i.id === item.id,
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-6 hover:bg-gray-50 transition-colors"
                      data-testid={`item-${item.id}`}
                    >
                      <div className="flex items-start space-x-4">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3
                              className="text-lg font-semibold text-gray-900"
                              data-testid={`text-item-name-${item.id}`}
                            >
                              {item.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700"
                            >
                              <Leaf className="inline mr-1 h-3 w-3" />
                              Fresh
                            </Badge>
                          </div>
                          {item.description && (
                            <p
                              className="text-gray-600 text-sm mb-3"
                              data-testid={`text-item-description-${item.id}`}
                            >
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span
                              className="text-xl font-bold text-primary-600"
                              data-testid={`text-item-price-${item.id}`}
                            >
                              Rs{currency(Number(item.price))}
                            </span>
                            <div className="flex items-center space-x-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-8 h-8 p-0 rounded-full"
                                onClick={() =>
                                  updateQuantity(
                                    originalIndex,
                                    item.quantity - 1,
                                  )
                                }
                                data-testid={`button-decrease-${item.id}`}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span
                                className="w-8 text-center font-medium"
                                data-testid={`text-quantity-${item.id}`}
                              >
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-8 h-8 p-0 rounded-full bg-primary-100 hover:bg-primary-200"
                                onClick={() =>
                                  updateQuantity(
                                    originalIndex,
                                    item.quantity + 1,
                                  )
                                }
                                data-testid={`button-increase-${item.id}`}
                              >
                                <Plus className="h-4 w-4 text-primary-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        {itemsInOrder.length > 0 && (
          <Card className="rounded-2xl shadow-lg sticky bottom-4">
            <CardHeader>
              <CardTitle>Your Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {itemsInOrder.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                    data-testid={`order-item-${item.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Badge
                        variant="outline"
                        className="rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        {item.quantity}
                      </Badge>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span
                      className="font-semibold"
                      data-testid={`order-item-total-${item.id}`}
                    >
                      Rs{(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold">Total</span>
                  <span
                    className="text-2xl font-bold text-primary-600"
                    data-testid="text-order-total"
                  >
                    Rs{total.toFixed(2)}
                  </span>
                </div>

                {/* Suggestion textbox (optional) */}
                <div className="mb-4">
                  <Label className="mb-2">Suggestion (optional)</Label>
                  <textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Any suggestions to improve?"
                    className="w-full p-3 rounded-md border border-gray-200 text-sm"
                    rows={1}
                    data-testid="input-suggestion"
                  />
                </div>

                {/* Replace the existing Place Order Button with: */}
                <Button
                  className="w-full py-4 text-lg font-semibold rounded-xl"
                  data-testid="button-place-order"
                  onClick={placeOrder}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Place Order
                </Button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  Show this total to your server to place the order.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
