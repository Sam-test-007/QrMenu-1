import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QrCode,
  User,
  LogOut,
  Plus,
  Utensils,
  Calendar,
  ExternalLink,
  Trash2,
  X,
  HelpCircle,
} from "lucide-react";
import QRCodeGenerator from "./qr-code-generator";
import type { Restaurant, MenuItem } from "@shared/schema";
import { currency } from "@/lib/supabase";

interface Order {
  id: string;
  table_number: string | null;
  status: "pending" | "preparing" | "completed" | "cancelled";
  total: number;
  items: Array<{
    id: string;
    name: string;
    price: string;
    quantity: number;
  }>;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newRestaurant, setNewRestaurant] = useState({ name: "", slug: "" });
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    description: "",
    imageUrl: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingRestImage, setUploadingRestImage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showMenuPanel, setShowMenuPanel] = useState<boolean>(() => {
    try {
      return localStorage.getItem("menuPanelOpen") === "true";
    } catch (e) {
      return false;
    }
  });

  // Onboarding tour state
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // accessibility refs for menu panel focus management
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("qrmenu_seen_tour");
      if (!seen) {
        setShowTour(true);
      }
    } catch (e) {}
  }, []);

  const finishTour = () => {
    try {
      localStorage.setItem("qrmenu_seen_tour", "1");
    } catch (e) {}
    setShowTour(false);
    setTourStep(0);
  };
  const [tick, setTick] = useState(Date.now());
  const [todayCompletedCount, setTodayCompletedCount] = useState(0);
  const [reportDate, setReportDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const { toast } = useToast();
  const restImageInputRef = useRef<HTMLInputElement | null>(null);

  // keep a small timer so the "today" count resets soon after midnight
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000); // update every minute
    return () => clearInterval(id);
  }, []);

  // persist panel open state
  useEffect(() => {
    try {
      localStorage.setItem("menuPanelOpen", showMenuPanel ? "true" : "false");
    } catch (e) {}
  }, [showMenuPanel]);

  // close on Escape and trap basic focus behavior
  useEffect(() => {
    if (!showMenuPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenuPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMenuPanel]);

  // Focus trap and return-focus for the menu panel
  useEffect(() => {
    if (!showMenuPanel) return;
    const el = panelRef.current;
    prevFocusedRef.current = document.activeElement as HTMLElement | null;

    // find focusable elements inside panel
    const focusableSelector =
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusable = el
      ? Array.from(el.querySelectorAll<HTMLElement>(focusableSelector)).filter(
          (f) => !f.hasAttribute("disabled")
        )
      : [];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" && focusable.length) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el?.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("keydown", onKey);
      try {
        prevFocusedRef.current?.focus();
      } catch (e) {}
    };
  }, [showMenuPanel]);

  // recalc today's completed orders whenever orders or time tick updates
  useEffect(() => {
    const now = new Date();
    const count = orders.filter((o) => {
      try {
        const d = new Date(o.created_at);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate() &&
          o.status === "completed"
        );
      } catch (e) {
        return false;
      }
    }).length;
    setTodayCompletedCount(count);
  }, [orders, tick]);

  // total sales sum across fetched orders
  // helper to check if an order is from today
  const isToday = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    } catch (e) {
      return false;
    }
  };

  const todaysOrders = useMemo(
    () => orders.filter((o) => isToday(o.created_at)),
    [orders, tick]
  );

  // total sales for today (sum of completed orders only)
  const totalSales = useMemo(() => {
    return todaysOrders
      .filter((o) => o.status === "completed")
      .reduce((s, o) => s + Number(o.total || 0), 0);
  }, [todaysOrders]);

  useEffect(() => {
    if (user) {
      loadRestaurants();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadMenuItems();
      loadOrders();

      // Set up real-time subscription
      const ordersSubscription = supabase
        .channel("orders")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${selectedRestaurant.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .subscribe();

      return () => {
        ordersSubscription.unsubscribe();
      };
    } else {
      setMenuItems([]);
      setOrders([]);
    }
  }, [selectedRestaurant]);

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const normalized = (data || []).map((r: any) => ({
        ...r,
        imageUrl: r.image_url ?? r.imageUrl ?? null,
      }));
      setRestaurants(normalized);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    if (!selectedRestaurant) return;

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", selectedRestaurant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadOrdersForDate = (dateStr: string) => {
    try {
      if (!selectedRestaurant) {
        toast({
          title: "No restaurant selected",
          description: "Select a restaurant first",
          variant: "destructive",
        });
        return;
      }

      const filtered = orders.filter((o) => {
        try {
          return new Date(o.created_at).toISOString().slice(0, 10) === dateStr;
        } catch (e) {
          return false;
        }
      });

      if (!filtered.length) {
        toast({
          title: "No orders",
          description: `No orders found for ${dateStr}`,
          variant: "default",
        });
      }

      const header = [
        "order_id",
        "table_number",
        "status",
        "total",
        "created_at",
        "items",
      ];
      const rows = filtered.map((o) => {
        const itemsStr = o.items
          .map(
            (i) => `${i.quantity}x ${i.name} (Rs${Number(i.price).toFixed(2)})`
          )
          .join(" | ");
        return [
          o.id,
          o.table_number ?? "",
          o.status,
          Number(o.total).toFixed(2),
          o.created_at,
          itemsStr,
        ];
      });

      const csv = [header, ...rows]
        .map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${selectedRestaurant.slug}-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Orders for ${dateStr} are downloading.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to generate file",
        variant: "destructive",
      });
    }
  };

  const loadOrders = async () => {
    if (!selectedRestaurant) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", selectedRestaurant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    }
  };

  const createRestaurant = async () => {
    if (!newRestaurant.name || !newRestaurant.slug) {
      toast({
        title: "Error",
        description: "Name and slug are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("restaurants")
        .insert([
          {
            owner_id: user?.id,
            name: newRestaurant.name,
            slug: newRestaurant.slug,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setRestaurants((prev) => [data, ...prev]);
      setNewRestaurant({ name: "", slug: "" });
      toast({
        title: "Success",
        description: "Restaurant created successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!selectedRestaurant) return null;

    // Check file size limit (200KB = 204,800 bytes)
    const maxSize = 200 * 1024; // 200KB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Image must be smaller than 200KB. Your file is ${Math.round(
          file.size / 1024
        )}KB.`,
        variant: "destructive",
      });
      return null;
    }

    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, JPEG, WebP, etc.)",
        variant: "destructive",
      });
      return null;
    }

    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedRestaurant.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("menu-images")
        .upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("menu-images").getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to upload image: ${error.message}`,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadRestaurantImage = async (file: File): Promise<string | null> => {
    if (!selectedRestaurant) return null;

    const maxSize = 500 * 1024; // 500KB limit for restaurant image
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Image must be smaller than ${Math.round(
          maxSize / 1024
        )}KB.`,
        variant: "destructive",
      });
      return null;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return null;
    }

    try {
      setUploadingRestImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedRestaurant.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("restaurant-images")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("restaurant-images").getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to upload image: ${error.message}`,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingRestImage(false);
    }
  };

  const addMenuItem = async () => {
    if (!selectedRestaurant || !newItem.name || !newItem.price) {
      toast({
        title: "Error",
        description: "Item name and price are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .insert([
          {
            restaurant_id: selectedRestaurant.id,
            name: newItem.name,
            price: newItem.price,
            description: newItem.description || null,
            image_url: newItem.imageUrl || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setMenuItems((prev) => [...prev, data]);
      setNewItem({ name: "", price: "", description: "", imageUrl: "" });
      setShowAddForm(false);
      toast({
        title: "Success",
        description: "Menu item added successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);

      if (error) throw error;
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Success",
        description: "Menu item deleted successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: Order["status"]
  ) => {
    try {
      const existingOrder = orders.find((o) => o.id === orderId);
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
      // optimistic local increment for today's completed counter
      if (status === "completed" && existingOrder) {
        try {
          const d = new Date(existingOrder.created_at);
          const now = new Date();
          if (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          ) {
            setTodayCompletedCount((prev) => prev + 1);
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      loadOrders(); // Reload orders after update

      toast({
        title: "Success",
        description: "Order status updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const updateMenuItem = async (
    itemId: string,
    updatedData: Partial<MenuItem>
  ) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update(updatedData)
        .eq("id", itemId);

      if (error) throw error;

      // Update local state
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, ...updatedData } : item
        )
      );
      setEditingItem(null);

      toast({
        title: "Success",
        description: "Menu item updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                  <QrCode className="text-white h-4 w-4" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                  QR Menu SaaS
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="text-gray-600 h-4 w-4" />
                </div>
                <span
                  className="text-sm text-gray-700"
                  data-testid="text-user-email"
                >
                  {user?.email}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowTour(true)}
                  title="Help / Tour"
                >
                  <HelpCircle className="mr-1 h-4 w-4" />
                  Help
                </Button>
                <Button
                  variant="ghost"
                  onClick={signOut}
                  data-testid="button-signout"
                >
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Restaurant Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Restaurants</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {restaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      className={`p-4 border rounded-lg hover:border-primary-300 transition-colors cursor-pointer ${
                        selectedRestaurant?.id === restaurant.id
                          ? "border-primary-300 bg-primary-50"
                          : "border-gray-200"
                      }`}
                      onClick={() => setSelectedRestaurant(restaurant)}
                      data-testid={`card-restaurant-${restaurant.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4
                            className="font-medium text-gray-900"
                            data-testid={`text-restaurant-name-${restaurant.id}`}
                          >
                            {restaurant.name}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            /{restaurant.slug}
                          </p>
                          <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                            <span>
                              <Utensils className="inline mr-1 h-3 w-3" />
                              {menuItems.length} items
                            </span>
                            <span>
                              <Calendar className="inline mr-1 h-3 w-3" />
                              Created{" "}
                              {new Date(
                                restaurant.createdAt || ""
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRestaurant(restaurant);
                          }}
                          data-testid={`button-manage-${restaurant.id}`}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}

                  {restaurants.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No restaurants yet. Create your first one below!
                    </div>
                  )}
                </div>

                {/* Create New Restaurant Form - Only show if user has no restaurant */}
                {restaurants.length === 0 && (
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Create Your Restaurant
                    </h4>
                    <div className="space-y-3">
                      <Input
                        placeholder="Restaurant name"
                        value={newRestaurant.name}
                        onChange={(e) =>
                          setNewRestaurant((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        data-testid="input-restaurant-name"
                      />
                      <Input
                        placeholder="URL slug (e.g., my-restaurant)"
                        value={newRestaurant.slug}
                        onChange={(e) =>
                          setNewRestaurant((prev) => ({
                            ...prev,
                            slug: e.target.value
                              .replace(/\s+/g, "-")
                              .toLowerCase(),
                          }))
                        }
                        data-testid="input-restaurant-slug"
                      />
                      <Button
                        onClick={createRestaurant}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        data-testid="button-create-restaurant"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Restaurant
                      </Button>
                    </div>
                  </div>
                )}

                {/* Limit message when user already has a restaurant */}
                {restaurants.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-200 bg-blue-50">
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">
                        Restaurant Created
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        You can manage one restaurant per account
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {selectedRestaurant ? (
              <>
                {/* Restaurant Header */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="mb-4 sm:mb-0">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            {selectedRestaurant.imageUrl ? (
                              <img
                                src={selectedRestaurant.imageUrl}
                                alt={selectedRestaurant.name}
                                className="w-20 h-20 rounded-lg object-cover border"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border">
                                <Utensils className="h-6 w-6 text-gray-500" />
                              </div>
                            )}

                            <div className="absolute right-0 bottom-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  restImageInputRef.current?.click()
                                }
                                disabled={uploadingRestImage}
                                title="Upload restaurant image"
                              >
                                {uploadingRestImage ? "Uploading..." : "Upload"}
                              </Button>
                            </div>
                            <input
                              ref={restImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !selectedRestaurant) return;
                                const url = await uploadRestaurantImage(file);
                                if (url) {
                                  try {
                                    const { error } = await supabase
                                      .from("restaurants")
                                      .update({ image_url: url })
                                      .eq("id", selectedRestaurant.id);
                                    if (error) throw error;

                                    setSelectedRestaurant((prev) =>
                                      prev ? { ...prev, imageUrl: url } : prev
                                    );
                                    setRestaurants((prev) =>
                                      prev.map((r) =>
                                        r.id === selectedRestaurant.id
                                          ? { ...r, imageUrl: url }
                                          : r
                                      )
                                    );
                                    toast({
                                      title: "Success",
                                      description: "Restaurant image updated",
                                    });
                                  } catch (err: any) {
                                    toast({
                                      title: "Error",
                                      description:
                                        err.message || "Failed to save image",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            />
                          </div>

                          <div>
                            <h2
                              className="text-2xl font-bold text-gray-900"
                              data-testid="text-selected-restaurant-name"
                            >
                              {selectedRestaurant.name}
                            </h2>
                            <p className="text-gray-600 mt-1">
                              <span>/{selectedRestaurant.slug}</span>
                            </p>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-1">
                          <span>/{selectedRestaurant.slug}</span>
                        </p>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span>
                            <Utensils className="inline mr-1 h-4 w-4" />
                            {menuItems.length} menu items
                          </span>
                          <span className="ml-3">
                            <Calendar className="inline mr-1 h-4 w-4" />
                            Today's completed:{" "}
                            <strong className="text-gray-900">
                              {todayCompletedCount}
                            </strong>
                          </span>
                        </div>
                        {/* Compact stats row */}
                        <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Utensils className="h-4 w-4 text-gray-500" />
                            <span>
                              Total orders:{" "}
                              <strong className="text-gray-900">
                                {todaysOrders.length}
                              </strong>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>
                              Total sales:{" "}
                              <strong className="text-gray-900">
                                Rs{totalSales.toFixed(2)}
                              </strong>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">Active</Badge>
                            <span>
                              <strong className="text-gray-900">
                                {
                                  todaysOrders.filter(
                                    (o) =>
                                      o.status !== "completed" &&
                                      o.status !== "cancelled"
                                  ).length
                                }
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Help / Onboarding dialog */}
                      <Dialog
                        open={showTour}
                        onOpenChange={(open) => {
                          setShowTour(open);
                          if (!open) finishTour();
                        }}
                      >
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Quick Tour</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {tourStep === 0 && (
                              <div>
                                <h4 className="font-semibold">Restaurants</h4>
                                <p className="text-sm text-gray-600">
                                  Select a restaurant from the left to manage
                                  its menu and orders.
                                </p>
                              </div>
                            )}
                            {tourStep === 1 && (
                              <div>
                                <h4 className="font-semibold">Menu Panel</h4>
                                <p className="text-sm text-gray-600">
                                  Open the Menu panel to add, edit, and delete
                                  menu items. On mobile it appears as a bottom
                                  sheet.
                                </p>
                              </div>
                            )}
                            {tourStep === 2 && (
                              <div>
                                <h4 className="font-semibold">Orders</h4>
                                <p className="text-sm text-gray-600">
                                  View active and recent orders. Use the action
                                  buttons to update status.
                                </p>
                              </div>
                            )}
                            {tourStep === 3 && (
                              <div>
                                <h4 className="font-semibold">Upload Images</h4>
                                <p className="text-sm text-gray-600">
                                  Upload restaurant and menu images using the
                                  Upload buttons. Restaurant images appear in
                                  the dashboard header and on the public menu.
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Tip: keep images under 200KB for best
                                  performance.
                                </p>
                              </div>
                            )}
                            {tourStep === 4 && (
                              <div>
                                <h4 className="font-semibold">
                                  QR Code & Public Menu
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Use the QR code generator to create a QR for
                                  this restaurant. The "View Public Menu" link
                                  opens the customer-facing menu (the same page
                                  scanned from the QR).
                                </p>
                              </div>
                            )}
                            {tourStep === 5 && (
                              <div>
                                <h4 className="font-semibold">
                                  Reports & Exports
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Use the date picker to download orders for a
                                  specific day as CSV. The compact stats show
                                  today's orders and sales by default.
                                </p>
                              </div>
                            )}

                            <div className="flex justify-between">
                              <div>
                                {tourStep > 0 && (
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      setTourStep((s) => Math.max(0, s - 1))
                                    }
                                  >
                                    Back
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    finishTour();
                                  }}
                                >
                                  Skip
                                </Button>
                                {tourStep < 5 ? (
                                  <Button
                                    onClick={() => setTourStep((s) => s + 1)}
                                  >
                                    Next
                                  </Button>
                                ) : (
                                  <Button onClick={() => finishTour()}>
                                    Finish
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <Button
                          variant="outline"
                          asChild
                          data-testid="link-view-public"
                        >
                          <Link to={`/menu/${selectedRestaurant.slug}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Public Menu
                          </Link>
                        </Button>

                        <div className="flex flex-col">
                          <QRCodeGenerator
                            restaurant={selectedRestaurant}
                            menuItems={menuItems}
                          />

                          <div className="mt-2 flex items-center space-x-2">
                            <input
                              type="date"
                              value={reportDate}
                              onChange={(e) => setReportDate(e.target.value)}
                              className="border rounded-md p-2 text-sm"
                              aria-label="Select report date"
                              data-testid="input-report-date"
                            />
                            <Button
                              size="sm"
                              onClick={() => downloadOrdersForDate(reportDate)}
                              title="Download orders for date"
                              data-testid="button-download-orders"
                            >
                              Download Orders
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders Section - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Active Orders */}
                  <section role="region" aria-labelledby="active-orders-title">
                    <Card>
                      <CardHeader>
                        <CardTitle id="active-orders-title">
                          Active Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {todaysOrders
                            .filter(
                              (order) =>
                                order.status !== "completed" &&
                                order.status !== "cancelled"
                            )
                            .map((order) => (
                              <div
                                key={order.id}
                                className="p-4 border rounded-lg"
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <div className="flex items-center space-x-3">
                                      <h4 className="font-medium">
                                        {order.table_number
                                          ? `Table ${order.table_number}`
                                          : "No table"}
                                      </h4>
                                      <Badge
                                        variant={
                                          order.status === "pending"
                                            ? "secondary"
                                            : order.status === "preparing"
                                            ? "default"
                                            : "default"
                                        }
                                      >
                                        {order.status}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                      Ordered at{" "}
                                      {new Date(
                                        order.created_at
                                      ).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <span className="font-bold text-lg">
                                    Rs{order.total.toFixed(2)}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex justify-between text-sm"
                                    >
                                      <span>
                                        {item.quantity}x {item.name}
                                      </span>
                                      <span>
                                        Rs
                                        {(
                                          Number(item.price) * item.quantity
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {order.status === "pending" && (
                                  <div className="mt-4 flex space-x-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        updateOrderStatus(order.id, "preparing")
                                      }
                                      title="Start preparing this order"
                                    >
                                      Start Preparing
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        updateOrderStatus(order.id, "cancelled")
                                      }
                                      title="Cancel this order"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}

                                {order.status === "preparing" && (
                                  <Button
                                    size="sm"
                                    className="mt-4"
                                    onClick={() =>
                                      updateOrderStatus(order.id, "completed")
                                    }
                                    title="Mark order as completed"
                                  >
                                    Mark as Completed
                                  </Button>
                                )}
                              </div>
                            ))}

                          {orders.filter(
                            (order) =>
                              order.status !== "completed" &&
                              order.status !== "cancelled"
                          ).length === 0 && (
                            <div className="text-center py-6 text-gray-500">
                              No active orders
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Recent Orders */}
                  <section role="region" aria-labelledby="recent-orders-title">
                    <Card>
                      <CardHeader>
                        <CardTitle id="recent-orders-title">
                          Recent Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {todaysOrders
                            .filter(
                              (order) =>
                                order.status === "completed" ||
                                order.status === "cancelled"
                            )
                            .slice(0, showAllRecent ? undefined : 4)
                            .map((order) => (
                              <div
                                key={order.id}
                                className="p-4 border rounded-lg"
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <div className="flex items-center space-x-3">
                                      <h4 className="font-medium">
                                        {order.table_number
                                          ? `Table ${order.table_number}`
                                          : "No table"}
                                      </h4>
                                      <Badge
                                        variant={
                                          order.status === "completed"
                                            ? "default"
                                            : "destructive"
                                        }
                                      >
                                        {order.status}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {new Date(
                                        order.created_at
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                  <span className="font-bold text-lg">
                                    Rs{order.total.toFixed(2)}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex justify-between text-sm"
                                    >
                                      <span>
                                        {item.quantity}x {item.name}
                                      </span>
                                      <span>
                                        Rs
                                        {(
                                          Number(item.price) * item.quantity
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}

                                  {/* end order items */}
                                </div>
                              </div>
                            ))}

                          {/* Single Show more / less toggle below the recent orders list */}
                          {todaysOrders.filter(
                            (order) =>
                              order.status === "completed" ||
                              order.status === "cancelled"
                          ).length > 4 && (
                            <div className="text-center mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllRecent((s) => !s)}
                              >
                                {showAllRecent ? "Show less" : "Show more"}
                              </Button>
                            </div>
                          )}

                          {orders.filter(
                            (order) =>
                              order.status === "completed" ||
                              order.status === "cancelled"
                          ).length === 0 && (
                            <div className="text-center py-6 text-gray-500">
                              No completed orders
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                </div>

                {/* Menu Panel Toggle + Panel (moved to left side) */}
                {/* Toggle button */}
                <div>
                  {!showMenuPanel && (
                    <button
                      onClick={() => setShowMenuPanel(true)}
                      aria-label="Open menu panel"
                      title="Open Menu"
                      className="fixed left-4 top-1/3 z-50 bg-white shadow-lg rounded-md p-3 flex items-center space-x-2 hover:shadow-xl"
                    >
                      <Utensils className="h-5 w-5 text-gray-700" />
                      <span className="hidden md:inline text-sm font-medium text-gray-700">
                        Menu
                      </span>
                    </button>
                  )}

                  {/* overlay */}
                  {showMenuPanel && (
                    <div
                      className="fixed inset-0 z-30 bg-black bg-opacity-30"
                      aria-hidden
                      onClick={() => setShowMenuPanel(false)}
                    />
                  )}

                  {/* Panel */}
                  <div
                    className={`fixed z-40 transition-transform duration-300 ${
                      showMenuPanel
                        ? "translate-x-0 translate-y-0"
                        : "-translate-x-full translate-y-full"
                    } lg:inset-y-0 lg:left-0 lg:w-80 lg:h-full sm:inset-x-0 sm:bottom-0 sm:h-1/2`}
                  >
                    <div className="w-full lg:w-80 h-full bg-white shadow-xl overflow-auto rounded-t-lg lg:rounded-none">
                      <div className="p-4 border-b flex items-center justify-between">
                        <h3
                          id="menu-panel-title"
                          className="text-lg font-semibold"
                        >
                          Menu Items
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddForm(!showAddForm)}
                            title="Add new menu item"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMenuPanel(false)}
                            title="Close menu panel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div
                        className="p-4"
                        id="menu-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="menu-panel-title"
                        ref={panelRef}
                        tabIndex={-1}
                      >
                        <p className="text-xs text-gray-500 mb-3">
                          Tip: tap the <strong>Menu</strong> button to open this
                          panel. On phones this opens as a bottom sheet.
                        </p>
                        {/* Add Item Form */}
                        {showAddForm && (
                          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="grid grid-cols-1 gap-3">
                              <div>
                                <Label>Item Name</Label>
                                <Input
                                  placeholder="e.g., Margherita Pizza"
                                  value={newItem.name}
                                  onChange={(e) =>
                                    setNewItem((prev) => ({
                                      ...prev,
                                      name: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Price (Rs)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newItem.price}
                                  onChange={(e) =>
                                    setNewItem((prev) => ({
                                      ...prev,
                                      price: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Description (Optional)</Label>
                                <Input
                                  placeholder="Brief description of the item..."
                                  value={newItem.description}
                                  onChange={(e) =>
                                    setNewItem((prev) => ({
                                      ...prev,
                                      description: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Image (Optional)</Label>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const imageUrl = await uploadImage(file);
                                      if (imageUrl) {
                                        setNewItem((prev) => ({
                                          ...prev,
                                          imageUrl,
                                        }));
                                      }
                                    }
                                  }}
                                  disabled={uploadingImage}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Accepted formats: JPG, PNG, WebP, GIF. Max
                                  size: 200KB
                                </p>
                                {uploadingImage && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    Uploading image...
                                  </p>
                                )}
                                {newItem.imageUrl && (
                                  <div className="mt-2">
                                    <img
                                      src={newItem.imageUrl}
                                      alt="Preview"
                                      className="w-16 h-16 rounded-lg object-cover"
                                      loading="lazy"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end space-x-2 mt-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setShowAddForm(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={addMenuItem}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  disabled={uploadingImage}
                                >
                                  {uploadingImage ? "Uploading..." : "Add Item"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Menu Items List */}
                        <div className="space-y-3">
                          {menuItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => setEditingItem(item)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    {item.imageUrl && (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-10 h-10 rounded-lg object-cover"
                                        loading="lazy"
                                      />
                                    )}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900">
                                        {item.name}
                                      </h4>
                                      <Badge
                                        variant={
                                          item.available
                                            ? "default"
                                            : "secondary"
                                        }
                                      >
                                        {item.available
                                          ? "Available"
                                          : "Unavailable"}
                                      </Badge>
                                    </div>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex items-center space-x-2 mt-2">
                                    <span className="text-sm font-semibold">
                                      Rs{currency(Number(item.price))}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Added{" "}
                                      {new Date(
                                        item.createdAt || ""
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteMenuItem(item.id);
                                    }}
                                    title="Delete item"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Edit Item Modal (reused) */}
                          {editingItem && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                                <h3 className="text-lg font-semibold mb-4">
                                  Edit Menu Item
                                </h3>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Item Name</Label>
                                    <Input
                                      value={editingItem.name}
                                      onChange={(e) =>
                                        setEditingItem((prev) =>
                                          prev
                                            ? { ...prev, name: e.target.value }
                                            : null
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Price (Rs)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editingItem.price}
                                      onChange={(e) =>
                                        setEditingItem((prev) =>
                                          prev
                                            ? { ...prev, price: e.target.value }
                                            : null
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Description</Label>
                                    <Input
                                      value={editingItem.description || ""}
                                      onChange={(e) =>
                                        setEditingItem((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                description: e.target.value,
                                              }
                                            : null
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={editingItem.available ?? false}
                                        onChange={(e) =>
                                          setEditingItem((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  available: e.target.checked,
                                                }
                                              : null
                                          )
                                        }
                                      />
                                      <span>Available</span>
                                    </Label>
                                  </div>
                                  <div className="flex justify-end space-x-3 mt-6">
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingItem(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        if (editingItem) {
                                          updateMenuItem(editingItem.id, {
                                            name: editingItem.name,
                                            price: editingItem.price,
                                            description:
                                              editingItem.description,
                                            available: editingItem.available,
                                          });
                                        }
                                      }}
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p>Select a restaurant to manage its menu.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
