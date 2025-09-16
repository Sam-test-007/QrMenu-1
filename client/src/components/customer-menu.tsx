import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { supabase, currency } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, ShoppingCart, Leaf, Flame } from "lucide-react";
import type { Restaurant, MenuItem } from "@shared/schema";

interface MenuItemWithQuantity {
  id: string;
  name: string;
  price: string;
  available: boolean | null;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
}

interface MenuData {
  name: string;
  items: MenuItemWithQuantity[];
}

export default function CustomerMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState<MenuData>({ name: "", items: [] });
  const [loading, setLoading] = useState(true);
  
  // Extract table number from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tableNumber = urlParams.get('table');

  useEffect(() => {
    if (slug) {
      loadMenu();
    }
  }, [slug]);

  const loadMenu = async () => {
    try {
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", slug)
        .single();

      if (restaurantError) throw restaurantError;

      if (restaurant) {
        const { data: items, error: itemsError } = await supabase
          .from("menu_items")
          .select("id,name,price,available,description,image_url")
          .eq("restaurant_id", restaurant.id)
          .eq("available", true)
          .order("created_at", { ascending: true });

        if (itemsError) throw itemsError;

        setMenu({
          name: restaurant.name,
          items: (items || []).map(item => ({ ...item, imageUrl: item.image_url, quantity: 0 }))
        });
      }
    } catch (error) {
      console.error("Error loading menu:", error);
      setMenu({ name: "Menu not found", items: [] });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    setMenu(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], quantity: Math.max(0, newQuantity) };
      return { ...prev, items };
    });
  };

  const total = useMemo(() => 
    menu.items.filter(item => item.quantity > 0).reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0),
    [menu.items]
  );

  const itemsInOrder = useMemo(() => 
    menu.items.filter(item => item.quantity > 0),
    [menu.items]
  );
    // Add this after the existing itemsInOrder useMemo
  const placeOrder = async () => {
    if (!itemsInOrder.length || !slug) return;
    
    try {
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", slug)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error("Restaurant not found");
      }

      const orderData = {
        restaurant_id: restaurant.id,
        table_number: tableNumber,
        status: 'pending',
        total: total,
        items: itemsInOrder.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))
      };

      const { error: orderError } = await supabase
        .from("orders")
        .insert([orderData]);

      if (orderError) {
          console.error("Order error:",orderError);
          throw new Error("Failed to create order.")
      }

      // Reset order after successful submission
      setMenu(prev => ({
        ...prev,
        items: prev.items.map(item => ({ ...item, quantity: 0 }))
      }));

      alert("Order placed successfully! Please wait for your server.");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        
        {/* Restaurant Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-white shadow-lg">
            <img 
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
              alt="Restaurant interior" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-restaurant-name">
            {menu.name}
          </h1>
          {tableNumber && (
            <div className="mb-2">
              <Badge variant="outline" className="text-lg px-4 py-1 bg-emerald-50 border-emerald-200 text-emerald-700" data-testid="text-table-number">
                🪑 Table {tableNumber}
              </Badge>
            </div>
          )}
          <p className="text-gray-600">Authentic cuisine made with love</p>
        </div>

        {/* Menu Categories */}
        <Card className="rounded-2xl shadow-lg mb-8">
          <CardHeader className="bg-primary-50 border-b border-primary-100">
            <CardTitle>Our Menu</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Tap items to add to your order</p>
          </CardHeader>
          <CardContent className="p-0">
            {menu.items.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Menu is currently empty or restaurant not found.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {menu.items.map((item, index) => (
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
                          <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-item-name-${item.id}`}>
                            {item.name}
                          </h3>
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <Leaf className="inline mr-1 h-3 w-3" />
                            Fresh
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-gray-600 text-sm mb-3" data-testid={`text-item-description-${item.id}`}>
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-primary-600" data-testid={`text-item-price-${item.id}`}>
                            Rs{currency(Number(item.price))}
                          </span>
                          <div className="flex items-center space-x-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-8 h-8 p-0 rounded-full"
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              data-testid={`button-decrease-${item.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.id}`}>
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-8 h-8 p-0 rounded-full bg-primary-100 hover:bg-primary-200"
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              data-testid={`button-increase-${item.id}`}
                            >
                              <Plus className="h-4 w-4 text-primary-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                  <div key={item.id} className="flex items-center justify-between" data-testid={`order-item-${item.id}`}>
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="rounded-full w-6 h-6 flex items-center justify-center text-xs">
                        {item.quantity}
                      </Badge>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-semibold" data-testid={`order-item-total-${item.id}`}>
                      Rs{(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary-600" data-testid="text-order-total">
                    Rs{total.toFixed(2)}
                  </span>
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
