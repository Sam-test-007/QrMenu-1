// App (qr-menu-supabase-app.jsx)
// Supabase-backed QR Menu SaaS: admin portal (signup/signin), menu CRUD, QR generation, and public customer menu view.
// Dependencies: react, react-dom, react-router-dom, @supabase/supabase-js, qrcode.react, tailwindcss (optional)

/*
Run this SQL in Supabase SQL editor to create tables:

create table profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  created_at timestamptz default now()
);

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null,
  available boolean default true,
  created_at timestamptz default now()
);
*/

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function currency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return { user };
}

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || !password) return alert("Email and password required");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for confirmation (if enabled). Then sign in.");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const userId = data.user.id;
        await supabase.from("profiles").upsert({ id: userId }).select();
        navigate("/admin/dashboard");
      }
    } catch (err) {
      alert(err.message || JSON.stringify(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-xl font-bold mb-4">{mode === "signup" ? "Create account" : "Sign in"}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded p-2" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded p-2" />
          <div className="flex items-center justify-between">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>{mode === "signup" ? "Sign up" : "Sign in"}</button>
            <button type="button" className="text-sm text-blue-600" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Have an account? Sign in" : "Don’t have an account? Sign up"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddItemForm({ onAdd }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  return (
    <div className="mt-2 flex gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Item name" className="flex-1 border rounded p-2" />
      <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" type="number" className="w-28 border rounded p-2" />
      <button onClick={() => { onAdd(name, parseFloat(price)); setName(""); setPrice(""); }} className="bg-indigo-600 text-white px-3 rounded">Add</button>
    </div>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      setRestaurants(data || []);
    })();
  }, [user]);

  useEffect(() => {
    if (!selected) return setItems([]);
    (async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", selected.id).order("created_at", { ascending: true });
      setItems(data || []);
    })();
  }, [selected]);

  async function createRestaurant() {
    if (!name || !slug) return alert("Name and slug required");
    const { data, error } = await supabase.from("restaurants").insert([{ owner_id: user.id, name, slug }]).select().single();
    if (error) return alert(error.message);
    setRestaurants(prev => [data, ...prev]);
    setName(""); setSlug("");
  }

  async function addItem(itemName, price) {
    if (!itemName || !price) return;
    const { data, error } = await supabase.from("menu_items").insert([{ restaurant_id: selected.id, name: itemName, price }]).select().single();
    if (error) return alert(error.message);
    setItems(prev => [...prev, data]);
  }

  async function deleteItem(id) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return alert(error.message);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function generateQRCodeLink() {
    if (!selected) return alert("Select a restaurant first");
    const payload = { name: selected.name, items: items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), quantity: 1 })) };
    const encoded = btoa(JSON.stringify(payload));
    const link = `${window.location.origin}/menu/${encodeURIComponent(selected.slug)}?menu=${encodeURIComponent(encoded)}`;
    return link;
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-4 rounded shadow">
          <h3 className="font-bold mb-2">Your Restaurants</h3>
          <div className="space-y-2">
            {restaurants.map(r => (
              <div key={r.id} className={`p-2 rounded border ${selected?.id === r.id ? "bg-gray-100" : ""}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-gray-500">/{r.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelected(r)} className="text-sm text-blue-600">Open</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-semibold">Create new</h4>
            <input className="w-full border rounded p-2 mt-2" placeholder="Restaurant name" value={name} onChange={e => setName(e.target.value)} />
            <input className="w-full border rounded p-2 mt-2" placeholder="slug (unique, e.g. my-cafe)" value={slug} onChange={e => setSlug(e.target.value.replace(/\s+/g, "-"))} />
            <button onClick={createRestaurant} className="w-full bg-green-600 text-white p-2 rounded mt-2">Create</button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {selected ? (
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  <div className="text-sm text-gray-500">/{selected.slug}</div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/menu/${selected.slug}`} className="text-sm underline">View public page</Link>
                  <button onClick={async () => { const l = await generateQRCodeLink(); navigator.clipboard.writeText(l); alert("Copied QR link to clipboard:\n" + l); }} className="bg-blue-600 text-white px-3 py-1 rounded">Generate QR</button>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold">Items</h3>
                <AddItemForm onAdd={addItem} />
                <ul className="mt-4 space-y-2">
                  {items.map(it => (
                    <li key={it.id} className="flex justify-between items-center border-b py-2">
                      <div>
                        <div className="font-medium">{it.name}</div>
                        <div className="text-sm text-gray-500">${currency(it.price)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => deleteItem(it.id)} className="text-red-600 text-sm">Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded shadow text-center">Select a restaurant to manage its menu.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState({ name: "", items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("slug", slug).limit(1).single();
      if (!mounted) return;
      if (rest) {
        const { data: items } = await supabase.from("menu_items").select("id,name,price,available").eq("restaurant_id", rest.id).order("created_at", { ascending: true });
        if (!mounted) return;
        setMenu({ name: rest.name, items: (items || []).map(i => ({ ...i, quantity: 1 })) });
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [slug]);

  const updateQuantity = (idx, q) => {
    setMenu(prev => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], quantity: Math.max(1, q) };
      return { ...prev, items };
    });
  };

  const total = useMemo(() => menu.items.reduce((a, b) => a + (b.price || 0) * (b.quantity || 1), 0), [menu]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="w-full max-w-xl bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-4">{menu.name || "Menu"}</h1>
        {menu.items.length === 0 ? (
          <p className="text-center text-gray-500">Menu is currently empty.</p>
        ) : (
          <ul className="space-y-3">
            {menu.items.map((it, idx) => (
              <li key={it.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-gray-500">${currency(it.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" className="w-20 border rounded p-1 text-center" min="1" value={it.quantity} onChange={e => updateQuantity(idx, parseInt(e.target.value || "1"))} />
                  <div className="font-semibold">${(it.price * (it.quantity || 1)).toFixed(2)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-between items-center">
          <div className="text-lg font-bold">Total</div>
          <div className="text-2xl font-extrabold">${total.toFixed(2)}</div>
        </div>

        <div className="mt-4 text-sm text-gray-600">Show this total to your server to place the order, or integrate a checkout to accept payments.</div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 p-6">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h1 className="text-2xl font-bold mb-2">QR Menu SaaS</h1>
          <p className="text-gray-600">Create contactless, editable menus for your restaurant. Sign in to manage your menu and generate QR links.</p>
          <div className="mt-4">
            <Link to="/auth" className="bg-blue-600 text-white px-4 py-2 rounded">Get started (owner)</Link>
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h3 className="font-semibold">How it works</h3>
          <ol className="mt-2 list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>Sign up / sign in as owner</li>
            <li>Create a restaurant (slug)</li>
            <li>Add items and generate QR link</li>
            <li>Guests scan the QR and place quantities — they see the total bill</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthForm />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/menu/:slug" element={<CustomerMenu />} />
      </Routes>
    </Router>
  );
}
