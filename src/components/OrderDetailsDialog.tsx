import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Trash2, Plus } from "lucide-react";

const EGG_SIZES = ["pewee", "pullets", "small", "medium", "large", "extra_large", "jumbo"] as const;
const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "Extra Large", jumbo: "Jumbo",
};

interface OrderItem {
  id: string;
  egg_size: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_contact: string;
  order_date: string;
  total_amount: number;
  status: string;
  delivery_method: string;
  payment_status: string;
  notes: string;
}

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const OrderDetailsDialog = ({ order, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ customer_name: "", customer_contact: "", delivery_method: "", notes: "" });
  const [editItems, setEditItems] = useState<{ id?: string; egg_size: string; quantity: string; unit_price: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order && open) {
      fetchItems();
      setEditing(false);
    }
  }, [order, open]);

  const fetchItems = async () => {
    if (!order) return;
    const { data } = await supabase.from("order_items").select("*").eq("order_id", order.id);
    if (data) setItems(data as OrderItem[]);
  };

  const startEditing = () => {
    if (!order) return;
    setEditForm({
      customer_name: order.customer_name,
      customer_contact: order.customer_contact || "",
      delivery_method: order.delivery_method,
      notes: order.notes || "",
    });
    setEditItems(items.map(i => ({
      id: i.id,
      egg_size: i.egg_size,
      quantity: String(i.quantity),
      unit_price: String(i.unit_price),
    })));
    setEditing(true);
  };

  const addEditItem = () => {
    setEditItems([...editItems, { egg_size: "medium", quantity: "1", unit_price: "0" }]);
  };

  const removeEditItem = (idx: number) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!order) return;
    setLoading(true);

    const newTotal = editItems.reduce((sum, i) => {
      const qty = parseInt(i.quantity) || 0;
      const price = parseFloat(i.unit_price) || 0;
      return sum + qty * price;
    }, 0);

    const { error: orderErr } = await supabase.from("orders").update({
      customer_name: editForm.customer_name,
      customer_contact: editForm.customer_contact,
      delivery_method: editForm.delivery_method,
      notes: editForm.notes,
      total_amount: newTotal,
    }).eq("id", order.id);

    if (orderErr) {
      toast({ title: "Error", description: orderErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    await supabase.from("order_items").delete().eq("order_id", order.id);

    const newItems = editItems.map(i => ({
      order_id: order.id,
      egg_size: i.egg_size,
      product_name: SIZE_LABELS[i.egg_size] || i.egg_size,
      quantity: parseInt(i.quantity) || 0,
      unit_price: parseFloat(i.unit_price) || 0,
      subtotal: (parseInt(i.quantity) || 0) * (parseFloat(i.unit_price) || 0),
    }));

    await supabase.from("order_items").insert(newItems);

    toast({ title: "Updated", description: "Order updated successfully." });
    setEditing(false);
    setLoading(false);
    fetchItems();
    onUpdated();
  };

  const handleDelete = async () => {
    if (!order) return;
    setLoading(true);
    await supabase.from("order_items").delete().eq("order_id", order.id);
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Order deleted." });
      onOpenChange(false);
      onUpdated();
    }
    setLoading(false);
  };

  if (!order) return null;

  const editTotal = editItems.reduce((sum, i) => {
    const qty = parseInt(i.quantity) || 0;
    const price = parseFloat(i.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Order Details</span>
            {!editing && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this order?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove the order for {order.customer_name} and all its items. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input value={editForm.customer_name} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact</Label>
                <Input value={editForm.customer_contact} onChange={e => setEditForm({ ...editForm, customer_contact: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Method</Label>
              <Select value={editForm.delivery_method} onValueChange={v => setEditForm({ ...editForm, delivery_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pick Up</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEditItem}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              {editItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={item.egg_size} onValueChange={v => {
                    const n = [...editItems]; n[idx] = { ...n[idx], egg_size: v }; setEditItems(n);
                  }}>
                    <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EGG_SIZES.map(s => <SelectItem key={s} value={s}>{SIZE_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min="1" className="w-16 h-9" placeholder="Qty" value={item.quantity}
                    onChange={e => { const n = [...editItems]; n[idx] = { ...n[idx], quantity: e.target.value }; setEditItems(n); }} />
                  <Input type="number" className="w-20 h-9" placeholder="Price" value={item.unit_price}
                    onChange={e => { const n = [...editItems]; n[idx] = { ...n[idx], unit_price: e.target.value }; setEditItems(n); }} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    = ₱{((parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(0)}
                  </span>
                  {editItems.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEditItem(idx)} className="h-9 w-9 p-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="text-right font-bold text-sm">Total: ₱{editTotal.toFixed(2)}</div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={loading}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                <Save className="w-3 h-3 mr-1" /> Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Customer</span>
                <p className="font-medium">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Contact</span>
                <p className="font-medium">{order.customer_contact || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Date</span>
                <p>{new Date(order.order_date).toLocaleDateString("en-PH")}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Delivery</span>
                <Badge variant="secondary" className="capitalize">{order.delivery_method}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <p className="capitalize">{order.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Payment</span>
                <p className="capitalize">{order.payment_status}</p>
              </div>
            </div>

            {order.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">Notes</span>
                <p>{order.notes}</p>
              </div>
            )}

            <div>
              <span className="text-muted-foreground text-xs">Order Items</span>
              <div className="mt-1 border rounded-md divide-y">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No items recorded</p>
                ) : items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <span className="font-medium">{SIZE_LABELS[item.egg_size] || item.egg_size}</span>
                      <span className="text-muted-foreground ml-2">× {item.quantity} trays</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-xs">₱{Number(item.unit_price).toFixed(0)}/tray → </span>
                      <span className="font-medium">₱{Number(item.subtotal).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right font-bold text-sm mt-2">
                Total: ₱{Number(order.total_amount).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
