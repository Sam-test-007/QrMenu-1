import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, User, LogOut, Plus, Utensils, Calendar, ExternalLink, Trash2 } from "lucide-react";
import QRCodeGenerator from "./qr-code-generator";
import type { Restaurant, MenuItem } from "@shared/schema";
import { currency } from "@/lib/supabase";

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRestaurant, setNewRestaurant] = useState({ name: "", slug: "" });
  const [newItem, setNewItem] = useState({ name: "", price: "", description: "", imageUrl: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadRestaurants();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadMenuItems();
    } else {
      setMenuItems([]);
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
      setRestaurants(data || []);
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
        .insert([{
          owner_id: user?.id,
          name: newRestaurant.name,
          slug: newRestaurant.slug
        }])
        .select()
        .single();

      if (error) throw error;
      setRestaurants(prev => [data, ...prev]);
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
        description: `Image must be smaller than 200KB. Your file is ${Math.round(file.size / 1024)}KB.`,
        variant: "destructive",
      });
      return null;
    }

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, JPEG, WebP, etc.)",
        variant: "destructive",
      });
      return null;
    }

    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedRestaurant.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

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
        .insert([{
          restaurant_id: selectedRestaurant.id,
          name: newItem.name,
          price: newItem.price,
          description: newItem.description || null,
          image_url: newItem.imageUrl || null
        }])
        .select()
        .single();

      if (error) throw error;
      setMenuItems(prev => [...prev, data]);
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
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setMenuItems(prev => prev.filter(item => item.id !== id));
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
                <h1 className="text-xl font-bold text-gray-900">QR Menu SaaS</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="text-gray-600 h-4 w-4" />
                </div>
                <span className="text-sm text-gray-700" data-testid="text-user-email">
                  {user?.email}
                </span>
              </div>
              <Button variant="ghost" onClick={signOut} data-testid="button-signout">
                <LogOut className="mr-1 h-4 w-4" />
                Sign Out
              </Button>
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
                        selectedRestaurant?.id === restaurant.id ? "border-primary-300 bg-primary-50" : "border-gray-200"
                      }`}
                      onClick={() => setSelectedRestaurant(restaurant)}
                      data-testid={`card-restaurant-${restaurant.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900" data-testid={`text-restaurant-name-${restaurant.id}`}>
                            {restaurant.name}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">/{restaurant.slug}</p>
                          <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                            <span><Utensils className="inline mr-1 h-3 w-3" />{menuItems.length} items</span>
                            <span><Calendar className="inline mr-1 h-3 w-3" />Created {new Date(restaurant.createdAt || "").toLocaleDateString()}</span>
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
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Create Your Restaurant</h4>
                    <div className="space-y-3">
                      <Input
                        placeholder="Restaurant name"
                        value={newRestaurant.name}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-restaurant-name"
                      />
                      <Input
                        placeholder="URL slug (e.g., my-restaurant)"
                        value={newRestaurant.slug}
                        onChange={(e) => setNewRestaurant(prev => ({ 
                          ...prev, 
                          slug: e.target.value.replace(/\s+/g, "-").toLowerCase()
                        }))}
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
                      <p className="text-sm text-blue-700 font-medium">Restaurant Created</p>
                      <p className="text-xs text-blue-600 mt-1">You can manage one restaurant per account</p>
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
                        <h2 className="text-2xl font-bold text-gray-900" data-testid="text-selected-restaurant-name">
                          {selectedRestaurant.name}
                        </h2>
                        <p className="text-gray-600 mt-1">
                          <span>/{selectedRestaurant.slug}</span>
                        </p>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span><Utensils className="inline mr-1 h-4 w-4" />{menuItems.length} menu items</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" asChild data-testid="link-view-public">
                          <Link to={`/menu/${selectedRestaurant.slug}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Public Menu
                          </Link>
                        </Button>
                        <QRCodeGenerator restaurant={selectedRestaurant} menuItems={menuItems} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Menu Management */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                      <h3 className="text-lg font-semibold">Menu Items</h3>
                      <Button 
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        data-testid="button-toggle-add-form"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item
                      </Button>
                    </div>

                    {/* Add Item Form */}
                    {showAddForm && (
                      <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Item Name</Label>
                            <Input
                              placeholder="e.g., Margherita Pizza"
                              value={newItem.name}
                              onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                              data-testid="input-item-name"
                            />
                          </div>
                          <div>
                            <Label>Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newItem.price}
                              onChange={(e) => setNewItem(prev => ({ ...prev, price: e.target.value }))}
                              data-testid="input-item-price"
                            />
                          </div>
                        </div>
                        <div className="mt-4">
                          <Label>Description (Optional)</Label>
                          <Input
                            placeholder="Brief description of the item..."
                            value={newItem.description}
                            onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                            data-testid="input-item-description"
                          />
                        </div>
                        <div className="mt-4">
                          <Label>Image (Optional)</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const imageUrl = await uploadImage(file);
                                if (imageUrl) {
                                  setNewItem(prev => ({ ...prev, imageUrl }));
                                }
                              }
                            }}
                            data-testid="input-item-image"
                            disabled={uploadingImage}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Accepted formats: JPG, PNG, WebP, GIF. Max size: 200KB
                          </p>
                          {uploadingImage && (
                            <p className="text-sm text-gray-500 mt-1">Uploading image...</p>
                          )}
                          {newItem.imageUrl && (
                            <div className="mt-2">
                              <img 
                                src={newItem.imageUrl} 
                                alt="Preview"
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end space-x-3 mt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowAddForm(false)}
                            data-testid="button-cancel-add"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={addMenuItem}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            data-testid="button-save-item"
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? "Uploading..." : "Add Item"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Menu Items List */}
                    <div className="space-y-4">
                      {menuItems.map((item) => (
                        <div key={item.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-testid={`row-menu-item-${item.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                {item.imageUrl && (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                )}
                                <div>
                                  <h4 className="text-base font-medium text-gray-900" data-testid={`text-item-name-${item.id}`}>
                                    {item.name}
                                  </h4>
                                  <Badge variant={item.available ? "default" : "secondary"}>
                                    {item.available ? "Available" : "Unavailable"}
                                  </Badge>
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-1" data-testid={`text-item-description-${item.id}`}>
                                  {item.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-4 mt-2">
                                <span className="text-lg font-semibold text-gray-900" data-testid={`text-item-price-${item.id}`}>
                                  ${currency(Number(item.price))}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Added {new Date(item.createdAt || "").toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteMenuItem(item.id)}
                                data-testid={`button-delete-item-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Empty state when no items */}
                      {menuItems.length === 0 && (
                        <div className="text-center py-12">
                          <Utensils className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items yet</h3>
                          <p className="text-gray-500 mb-6">Get started by adding your first menu item</p>
                          <Button 
                            onClick={() => setShowAddForm(true)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            data-testid="button-add-first-item"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Item
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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