import { type Profile, type InsertProfile, type Restaurant, type InsertRestaurant, type MenuItem, type InsertMenuItem } from "@shared/schema";
import { randomUUID } from "crypto";

// This storage is kept minimal since we're using Supabase for most operations
// These interfaces can be used if we need any server-side data operations in the future

export interface IStorage {
  // Profile operations
  getProfile(id: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  
  // Restaurant operations  
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  
  // Menu item operations
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
}

export class MemStorage implements IStorage {
  private profiles: Map<string, Profile>;
  private restaurants: Map<string, Restaurant>;
  private menuItems: Map<string, MenuItem>;

  constructor() {
    this.profiles = new Map();
    this.restaurants = new Map();
    this.menuItems = new Map();
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = randomUUID();
    const profile: Profile = { 
      ...insertProfile, 
      id,
      createdAt: new Date().toISOString()
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    return this.restaurants.get(id);
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    return Array.from(this.restaurants.values()).find(
      (restaurant) => restaurant.slug === slug
    );
  }

  async createRestaurant(insertRestaurant: InsertRestaurant): Promise<Restaurant> {
    const id = randomUUID();
    const restaurant: Restaurant = { 
      ...insertRestaurant, 
      id,
      createdAt: new Date().toISOString()
    };
    this.restaurants.set(id, restaurant);
    return restaurant;
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    return this.menuItems.get(id);
  }

  async createMenuItem(insertMenuItem: InsertMenuItem): Promise<MenuItem> {
    const id = randomUUID();
    const menuItem: MenuItem = { 
      ...insertMenuItem, 
      id,
      createdAt: new Date().toISOString()
    };
    this.menuItems.set(id, menuItem);
    return menuItem;
  }
}

export const storage = new MemStorage();
