import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "Extra Large", jumbo: "Jumbo",
};

const SIZE_ORDER = ["pewee", "pullets", "small", "medium", "large", "extra_large", "jumbo"];

interface InventoryRow {
  egg_size: string;
  total_produced: number;
  total_sold: number;
  available_stock: number;
  last_updated: string;
}

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    setLoading(true);
    const { data } = await supabase.from("inventory").select("*");
    if (data) {
      const sorted = data.sort(
        (a: any, b: any) => SIZE_ORDER.indexOf(a.egg_size) - SIZE_ORDER.indexOf(b.egg_size)
      );
      setInventory(sorted as InventoryRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchInventory(); }, []);

  const totalProduced = inventory.reduce((s, i) => s + i.total_produced, 0);
  const totalSold = inventory.reduce((s, i) => s + i.total_sold, 0);
  const totalAvailable = inventory.reduce((s, i) => s + i.available_stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            Auto-updated from production logs and orders
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInventory} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Produced</p>
                <p className="text-2xl font-bold">{totalProduced} trays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sold</p>
                <p className="text-2xl font-bold">{totalSold} trays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Package className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Stock</p>
                <p className="text-2xl font-bold">{totalAvailable} trays</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-size breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock by Egg Size</CardTitle>
          <CardDescription>Automatically calculated from production and order records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {inventory.map((item) => (
              <div
                key={item.egg_size}
                className="p-4 rounded-lg border bg-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{SIZE_LABELS[item.egg_size] || item.egg_size}</h3>
                  <Badge
                    variant={item.available_stock > 0 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {item.available_stock > 0 ? "In Stock" : "Out"}
                  </Badge>
                </div>
                <div className="text-3xl font-bold">{item.available_stock}</div>
                <p className="text-xs text-muted-foreground">trays available</p>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>Produced: {item.total_produced}</span>
                  <span>Sold: {item.total_sold}</span>
                </div>
              </div>
            ))}
          </div>
          {inventory.length === 0 && !loading && (
            <p className="text-center text-muted-foreground text-sm py-8">
              No inventory data. Add production logs to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
