import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Egg, ShoppingCart, TrendingUp, DollarSign, Truck, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "XL", jumbo: "Jumbo",
};

const SIZE_COLORS: Record<string, string> = {
  pewee: "hsl(200, 60%, 50%)", pullets: "hsl(170, 50%, 45%)", small: "hsl(140, 45%, 40%)",
  medium: "hsl(32, 80%, 50%)", large: "hsl(20, 70%, 50%)", extra_large: "hsl(350, 60%, 50%)", jumbo: "hsl(280, 50%, 50%)",
};

interface PricingHistoryPoint {
  name: string;
  [key: string]: string | number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayProduction: 0, pendingOrders: 0, todayRevenue: 0, totalOrders: 0,
    deliveryCount: 0, pickupCount: 0, unpaidCount: 0,
  });
  const [prodChart, setProdChart] = useState<{ date: string; eggs: number }[]>([]);
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number }[]>([]);
  const [activePrices, setActivePrices] = useState<{ size: string; price: number }[]>([]);
  const [pricingHistory, setPricingHistory] = useState<PricingHistoryPoint[]>([]);
  const [pricingSizes, setPricingSizes] = useState<string[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const [prodRes, ordersRes, recentProd, recentOrders, pricingRes] = await Promise.all([
        supabase.from("production_logs").select("eggs_collected").eq("log_date", today),
        supabase.from("orders").select("status, total_amount, delivery_method, payment_status, order_date"),
        supabase.from("production_logs").select("log_date, eggs_collected").gte("log_date", sevenDaysAgo).order("log_date"),
        supabase.from("orders").select("order_date, total_amount").gte("order_date", sevenDaysAgo).order("order_date"),
        supabase.from("pricing_sets").select("id").eq("is_active", true).limit(1),
      ]);

      const todayEggs = prodRes.data?.reduce((s, r) => s + (r.eggs_collected || 0), 0) ?? 0;
      const allOrders = ordersRes.data || [];
      const todayOrders = allOrders.filter((o: any) => o.order_date === today);
      const todayRev = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

      setStats({
        todayProduction: todayEggs,
        pendingOrders: allOrders.filter((o: any) => o.status === "pending").length,
        todayRevenue: todayRev,
        totalOrders: allOrders.length,
        deliveryCount: allOrders.filter((o: any) => o.delivery_method === "delivery").length,
        pickupCount: allOrders.filter((o: any) => o.delivery_method === "pickup").length,
        unpaidCount: allOrders.filter((o: any) => o.payment_status === "unpaid").length,
      });

      // Production chart
      if (recentProd.data) {
        const grouped: Record<string, number> = {};
        recentProd.data.forEach((r: any) => {
          grouped[r.log_date] = (grouped[r.log_date] || 0) + (r.eggs_collected || 0);
        });
        setProdChart(
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
            .map(([date, eggs]) => ({ date: new Date(date).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), eggs }))
        );
      }

      // Revenue chart
      if (recentOrders.data) {
        const grouped: Record<string, number> = {};
        recentOrders.data.forEach((r: any) => {
          grouped[r.order_date] = (grouped[r.order_date] || 0) + Number(r.total_amount || 0);
        });
        setRevenueChart(
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
            .map(([date, revenue]) => ({ date: new Date(date).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), revenue }))
        );
      }

      // Active prices
      if (pricingRes.data && pricingRes.data.length > 0) {
        const { data: pItems } = await supabase.from("pricing_set_items").select("egg_size, price_per_tray").eq("pricing_set_id", pricingRes.data[0].id);
        if (pItems) {
          setActivePrices(pItems.map((i: any) => ({ size: SIZE_LABELS[i.egg_size] || i.egg_size, price: Number(i.price_per_tray) })));
        }
      }

      // Pricing history - fetch all pricing sets with their items
      const { data: allSets } = await supabase.from("pricing_sets").select("id, name, created_at").order("created_at", { ascending: true });
      if (allSets && allSets.length > 0) {
        const { data: allItems } = await supabase.from("pricing_set_items").select("pricing_set_id, egg_size, price_per_tray");
        if (allItems) {
          const sizesUsed = new Set<string>();
          const history: PricingHistoryPoint[] = allSets.map((s: any) => {
            const point: PricingHistoryPoint = { name: s.name || new Date(s.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) };
            allItems.filter((i: any) => i.pricing_set_id === s.id).forEach((i: any) => {
              point[i.egg_size] = Number(i.price_per_tray);
              sizesUsed.add(i.egg_size);
            });
            return point;
          });
          setPricingHistory(history);
          setPricingSizes(Array.from(sizesUsed));
        }
      }
    };

    fetchAll();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your farm operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Eggs" value={stats.todayProduction} icon={<Egg className="w-5 h-5" />} subtitle="Collected today" />
        <StatCard title="Pending Orders" value={stats.pendingOrders} icon={<ShoppingCart className="w-5 h-5" />} subtitle="Awaiting confirmation" />
        <StatCard title="Today's Revenue" value={`₱${stats.todayRevenue.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} subtitle="From orders today" />
        <StatCard title="Unpaid Orders" value={stats.unpaidCount} icon={<CreditCard className="w-5 h-5" />} subtitle="Needs collection" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Egg Production (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {prodChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={prodChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="eggs" fill="hsl(152, 45%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">No production data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => [`₱${v.toFixed(2)}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(32, 80%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing Fluctuation Chart */}
      {pricingHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pricing Fluctuation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pricingHistory}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={11} tickFormatter={(v) => `₱${v}`} />
                <Tooltip formatter={(v: number, name: string) => [`₱${v.toFixed(0)}`, SIZE_LABELS[name] || name]} />
                <Legend formatter={(value) => SIZE_LABELS[value] || value} />
                {pricingSizes.map((size) => (
                  <Line key={size} type="monotone" dataKey={size} stroke={SIZE_COLORS[size] || "hsl(0,0%,50%)"} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Active pricing overview */}
      {activePrices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Active Prices (per tray)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {activePrices.map((p) => (
                <div key={p.size} className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">{p.size}</p>
                  <p className="text-xl font-bold">₱{p.price.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={stats.totalOrders} icon={<ShoppingCart className="w-5 h-5" />} subtitle="All time" />
        <StatCard title="Deliveries" value={stats.deliveryCount} icon={<Truck className="w-5 h-5" />} subtitle="Orders for delivery" />
        <StatCard title="Pick Ups" value={stats.pickupCount} icon={<TrendingUp className="w-5 h-5" />} subtitle="Customer pick up" />
      </div>
    </div>
  );
};

export default Dashboard;
