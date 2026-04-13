import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const EGG_SIZES = ["pewee", "pullets", "small", "medium", "large", "extra_large", "jumbo"] as const;
const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "Extra Large", jumbo: "Jumbo",
};

interface ProductionLogItem {
  id?: string;
  egg_size: string;
  trays_collected: number;
}

interface ProductionLog {
  id: string;
  log_date: string;
  eggs_collected: number;
  damaged_eggs: number;
  mortality: number;
  feed_consumed_kg: number;
  notes: string;
  created_at: string;
  items?: ProductionLogItem[];
}

const emptyForm = {
  log_date: new Date().toISOString().split("T")[0],
  damaged_eggs: "0",
  mortality: "0",
  feed_consumed_kg: "",
  notes: "",
};

const Production = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sizeItems, setSizeItems] = useState<{ egg_size: string; trays: string }[]>([
    { egg_size: "medium", trays: "0" },
  ]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("production_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(50);
    if (!data) return;

    // Fetch items for all logs
    const logIds = data.map((l: any) => l.id);
    const { data: items } = await supabase
      .from("production_log_items")
      .select("*")
      .in("production_log_id", logIds);

    const logsWithItems = data.map((log: any) => ({
      ...log,
      items: items?.filter((i: any) => i.production_log_id === log.id) || [],
    }));

    setLogs(logsWithItems as ProductionLog[]);
  };

  useEffect(() => { fetchLogs(); }, []);

  const resetForm = () => {
    setForm({ ...emptyForm, log_date: new Date().toISOString().split("T")[0] });
    setSizeItems([{ egg_size: "medium", trays: "0" }]);
    setEditingId(null);
  };

  const openEdit = (log: ProductionLog) => {
    setEditingId(log.id);
    setForm({
      log_date: log.log_date,
      damaged_eggs: String(log.damaged_eggs),
      mortality: String(log.mortality),
      feed_consumed_kg: String(log.feed_consumed_kg),
      notes: log.notes || "",
    });
    setSizeItems(
      log.items && log.items.length > 0
        ? log.items.map((i) => ({ egg_size: i.egg_size, trays: String(i.trays_collected) }))
        : [{ egg_size: "medium", trays: "0" }]
    );
    setOpen(true);
  };

  const totalTrays = sizeItems.reduce((s, i) => s + (parseInt(i.trays) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      log_date: form.log_date,
      eggs_collected: totalTrays, // total trays as summary
      damaged_eggs: parseInt(form.damaged_eggs) || 0,
      mortality: parseInt(form.mortality) || 0,
      feed_consumed_kg: parseFloat(form.feed_consumed_kg) || 0,
      notes: form.notes,
    };

    let logId = editingId;

    if (editingId) {
      const { error } = await supabase.from("production_logs").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      // Delete old items, re-insert
      await supabase.from("production_log_items").delete().eq("production_log_id", editingId);
    } else {
      const { data, error } = await supabase.from("production_logs").insert({ ...payload, user_id: user.id }).select().single();
      if (error || !data) {
        toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
        return;
      }
      logId = data.id;
    }

    // Insert size items
    const itemsToInsert = sizeItems
      .filter((i) => (parseInt(i.trays) || 0) > 0)
      .map((i) => ({
        production_log_id: logId!,
        egg_size: i.egg_size,
        trays_collected: parseInt(i.trays) || 0,
      }));

    if (itemsToInsert.length > 0) {
      await supabase.from("production_log_items").insert(itemsToInsert);
    }

    toast({ title: editingId ? "Updated" : "Logged", description: editingId ? "Production log updated." : "Production record saved." });
    setOpen(false);
    resetForm();
    fetchLogs();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("production_logs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Production log removed." });
      fetchLogs();
    }
  };

  const addSizeItem = () => setSizeItems([...sizeItems, { egg_size: "medium", trays: "0" }]);
  const removeSizeItem = (i: number) => setSizeItems(sizeItems.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Logs</h1>
          <p className="text-muted-foreground text-sm">Record daily egg production by size (per tray)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Log</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Production Log" : "New Production Log"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} required />
              </div>

              {/* Egg sizes per tray */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Trays Collected by Size</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSizeItem}>
                    <Plus className="w-3 h-3 mr-1" /> Add Size
                  </Button>
                </div>
                <div className="space-y-2">
                  {sizeItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={item.egg_size} onValueChange={(v) => {
                        const n = [...sizeItems]; n[idx].egg_size = v; setSizeItems(n);
                      }}>
                        <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EGG_SIZES.map((s) => (
                            <SelectItem key={s} value={s}>{SIZE_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number" min="0" className="w-20 h-9" placeholder="0"
                        value={item.trays}
                        onChange={(e) => { const n = [...sizeItems]; n[idx].trays = e.target.value; setSizeItems(n); }}
                      />
                      <span className="text-xs text-muted-foreground">trays</span>
                      {sizeItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSizeItem(idx)} className="h-9 w-9 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-right">Total: {totalTrays} trays</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Damaged Eggs</Label>
                  <Input type="number" value={form.damaged_eggs} onChange={(e) => setForm({ ...form, damaged_eggs: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Mortality</Label>
                  <Input type="number" value={form.mortality} onChange={(e) => setForm({ ...form, mortality: e.target.value })} placeholder="0" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Feed Consumed (kg)</Label>
                  <Input type="number" step="0.01" value={form.feed_consumed_kg} onChange={(e) => setForm({ ...form, feed_consumed_kg: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any observations..." />
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Save"} Log</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Trays by Size</TableHead>
                <TableHead className="text-right">Total Trays</TableHead>
                <TableHead className="text-right">Damaged</TableHead>
                <TableHead className="text-right">Mortality</TableHead>
                <TableHead className="text-right">Feed (kg)</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No production logs yet</TableCell></TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{new Date(log.log_date).toLocaleDateString("en-PH")}</TableCell>
                    <TableCell className="text-sm">
                      {log.items && log.items.length > 0
                        ? log.items.map((i) => `${SIZE_LABELS[i.egg_size] || i.egg_size}: ${i.trays_collected}`).join(", ")
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">{log.eggs_collected}</TableCell>
                    <TableCell className="text-right">{log.damaged_eggs}</TableCell>
                    <TableCell className="text-right">{log.mortality}</TableCell>
                    <TableCell className="text-right">{Number(log.feed_consumed_kg).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(log)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove the production log for {new Date(log.log_date).toLocaleDateString("en-PH")}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(log.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Production;
