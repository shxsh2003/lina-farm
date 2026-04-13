import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Check, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EGG_SIZES = ["pewee", "pullets", "small", "medium", "large", "extra_large", "jumbo"] as const;
const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "Extra Large", jumbo: "Jumbo",
};

interface PricingSet {
  id: string;
  name: string;
  is_active: boolean;
  wholesale_discount: number;
  wholesale_min_trays: number;
  created_at: string;
  updated_at: string;
  items: Record<string, number>;
}

const Pricing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sets, setSets] = useState<PricingSet[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    wholesale_discount: "20",
    wholesale_min_trays: "10",
    prices: Object.fromEntries(EGG_SIZES.map((s) => [s, ""])) as Record<string, string>,
  });

  const fetchSets = async () => {
    const { data: setsData } = await supabase
      .from("pricing_sets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!setsData) return;

    const { data: itemsData } = await supabase
      .from("pricing_set_items")
      .select("*");

    const mapped: PricingSet[] = setsData.map((s: any) => {
      const items: Record<string, number> = {};
      itemsData?.filter((i: any) => i.pricing_set_id === s.id).forEach((i: any) => {
        items[i.egg_size] = Number(i.price_per_tray);
      });
      return { ...s, items };
    });

    setSets(mapped);
  };

  useEffect(() => { fetchSets(); }, []);

  const resetForm = () => {
    setForm({
      name: "",
      wholesale_discount: "20",
      wholesale_min_trays: "10",
      prices: Object.fromEntries(EGG_SIZES.map((s) => [s, ""])),
    });
    setEditingId(null);
  };

  const openEdit = (set: PricingSet) => {
    setEditingId(set.id);
    setForm({
      name: set.name,
      wholesale_discount: String(set.wholesale_discount),
      wholesale_min_trays: String(set.wholesale_min_trays),
      prices: Object.fromEntries(EGG_SIZES.map((s) => [s, set.items[s]?.toString() || ""])),
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Update existing
      const { error } = await supabase.from("pricing_sets").update({
        name: form.name,
        wholesale_discount: parseFloat(form.wholesale_discount) || 20,
        wholesale_min_trays: parseInt(form.wholesale_min_trays) || 10,
      }).eq("id", editingId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Delete old items then re-insert
      await supabase.from("pricing_set_items").delete().eq("pricing_set_id", editingId);

      const items = EGG_SIZES.filter((s) => form.prices[s]).map((s) => ({
        pricing_set_id: editingId,
        egg_size: s,
        price_per_tray: parseFloat(form.prices[s]) || 0,
      }));

      if (items.length > 0) {
        await supabase.from("pricing_set_items").insert(items);
      }

      toast({ title: "Updated", description: "Pricing set updated." });
    } else {
      // Create new
      const { data: newSet, error } = await supabase.from("pricing_sets").insert({
        name: form.name,
        wholesale_discount: parseFloat(form.wholesale_discount) || 20,
        wholesale_min_trays: parseInt(form.wholesale_min_trays) || 10,
        created_by: user?.id,
      }).select().single();

      if (error || !newSet) {
        toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
        return;
      }

      const items = EGG_SIZES.filter((s) => form.prices[s]).map((s) => ({
        pricing_set_id: newSet.id,
        egg_size: s,
        price_per_tray: parseFloat(form.prices[s]) || 0,
      }));

      if (items.length > 0) {
        await supabase.from("pricing_set_items").insert(items);
      }

      toast({ title: "Created", description: "Pricing set created." });
    }

    setOpen(false);
    resetForm();
    fetchSets();
  };

  const toggleActive = async (setId: string, active: boolean) => {
    const { error } = await supabase.from("pricing_sets").update({ is_active: active }).eq("id", setId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchSets();
    }
  };

  const deleteSet = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error } = await supabase.from("pricing_sets").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setDeleting(false);
    } else {
      toast({ title: "Deleted", description: "Pricing set removed." });
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleting(false);
      fetchSets();
    }
  };

  const activeSet = sets.find((s) => s.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricing</h1>
          <p className="text-muted-foreground text-sm">Set tray prices per egg size. Only one pricing set can be active.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Pricing Set</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Pricing Set" : "New Pricing Set"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Pricing Set Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. February 2026 Prices" required />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Price per Tray (₱) — Retail</Label>
                <div className="grid grid-cols-2 gap-3">
                  {EGG_SIZES.map((size) => (
                    <div key={size} className="flex items-center gap-2">
                      <Label className="text-xs w-24 text-muted-foreground">{SIZE_LABELS[size]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.prices[size]}
                        onChange={(e) => setForm({ ...form, prices: { ...form.prices, [size]: e.target.value } })}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Wholesale Discount (₱/tray)</Label>
                  <Input type="number" step="1" value={form.wholesale_discount} onChange={(e) => setForm({ ...form, wholesale_discount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Min Trays for Wholesale</Label>
                  <Input type="number" step="1" value={form.wholesale_min_trays} onChange={(e) => setForm({ ...form, wholesale_min_trays: e.target.value })} />
                </div>
              </div>

              <Button type="submit" className="w-full">{editingId ? "Update" : "Save"} Pricing Set</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pricing set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.name || "Untitled"}" and its prices. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSet} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active pricing highlight */}
      {activeSet && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Active: {activeSet.name}</CardTitle>
            </div>
            <CardDescription>
              Wholesale: ₱{Number(activeSet.wholesale_discount).toFixed(0)} off per tray for {activeSet.wholesale_min_trays}+ trays
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {EGG_SIZES.map((size) => (
                <div key={size} className="text-center p-2 rounded-lg bg-background border">
                  <p className="text-xs text-muted-foreground">{SIZE_LABELS[size]}</p>
                  <p className="text-lg font-bold">₱{(activeSet.items[size] || 0).toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    WS: ₱{((activeSet.items[size] || 0) - activeSet.wholesale_discount).toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All pricing sets */}
      <div className="space-y-4">
        {sets.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No pricing sets yet. Create one above.</CardContent></Card>
        ) : (
          sets.map((set) => (
            <Card key={set.id} className={set.is_active ? "ring-1 ring-primary/30" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{set.name || "Untitled"}</CardTitle>
                    <Badge variant={set.is_active ? "default" : "secondary"} className="text-xs">
                      {set.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(set)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeleteTarget({ id: set.id, name: set.name }); setDeleteOpen(true); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{set.is_active ? "On" : "Off"}</span>
                      <Switch
                        checked={set.is_active}
                        onCheckedChange={(v) => toggleActive(set.id, v)}
                      />
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Wholesale: ₱{Number(set.wholesale_discount).toFixed(0)} off — Min {set.wholesale_min_trays} trays • Updated {new Date(set.updated_at).toLocaleDateString("en-PH")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {EGG_SIZES.map((size) => (
                    <div key={size} className="text-center p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">{SIZE_LABELS[size]}</p>
                      <p className="font-semibold">₱{(set.items[size] || 0).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Pricing;
