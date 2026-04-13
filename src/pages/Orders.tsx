import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import OrderDetailsDialog from "@/components/OrderDetailsDialog";

const EGG_SIZES = ["pewee", "pullets", "small", "medium", "large", "extra_large", "jumbo"] as const;
const SIZE_LABELS: Record<string, string> = {
  pewee: "Pewee", pullets: "Pullets", small: "Small", medium: "Medium",
  large: "Large", extra_large: "Extra Large", jumbo: "Jumbo",
};

interface OrderItem { egg_size: string; quantity: number; unit_price: number; subtotal: number; }
interface ActivePricing { prices: Record<string, number>; wholesale_discount: number; wholesale_min_trays: number; }

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
  created_at: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", confirmed: "default", delivered: "secondary", cancelled: "destructive",
};

const paymentColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  unpaid: "destructive", partial: "outline", paid: "default",
};

const Orders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState(false);
  const [activePricing, setActivePricing] = useState<ActivePricing | null>(null);
  const [form, setForm] = useState({
    customer_name: "", customer_contact: "", delivery_method: "pickup", notes: "",
  });
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [items, setItems] = useState<{ egg_size: string; quantity: string }[]>([
    { egg_size: "medium", quantity: "1" },
  ]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("order_date", { ascending: true }).order("created_at", { ascending: true }).limit(50);
    if (data) setOrders(data as Order[]);
  };

  const fetchActivePricing = async () => {
    const { data: sets } = await supabase.from("pricing_sets").select("*").eq("is_active", true).limit(1);
    if (!sets || sets.length === 0) return;
    const set = sets[0];
    const { data: pItems } = await supabase.from("pricing_set_items").select("*").eq("pricing_set_id", set.id);
    const prices: Record<string, number> = {};
    pItems?.forEach((i: any) => { prices[i.egg_size] = Number(i.price_per_tray); });
    setActivePricing({ prices, wholesale_discount: Number(set.wholesale_discount), wholesale_min_trays: Number(set.wholesale_min_trays) });
  };

  useEffect(() => { fetchOrders(); fetchActivePricing(); }, []);

  const calculateTotal = () => {
    if (!activePricing) return 0;
    const totalTrays = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
    const isWholesale = totalTrays >= activePricing.wholesale_min_trays;
    return items.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0;
      const retail = activePricing.prices[item.egg_size] || 0;
      const price = isWholesale ? retail - activePricing.wholesale_discount : retail;
      return sum + price * qty;
    }, 0);
  };

  const addItem = () => setItems([...items, { egg_size: "medium", quantity: "1" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activePricing) {
      toast({ title: "Error", description: "No active pricing set. Please set one first.", variant: "destructive" });
      return;
    }

    const totalTrays = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
    const isWholesale = totalTrays >= activePricing.wholesale_min_trays;
    const totalAmount = calculateTotal();

    const { data: order, error } = await supabase.from("orders").insert({
      user_id: user.id,
      customer_name: form.customer_name,
      customer_contact: form.customer_contact,
      delivery_method: form.delivery_method,
      total_amount: totalAmount,
      notes: form.notes,
      order_date: format(orderDate, "yyyy-MM-dd"),
    }).select().single();

    if (error || !order) {
      toast({ title: "Error", description: error?.message || "Failed", variant: "destructive" });
      return;
    }

    const orderItems = items.map((item) => {
      const qty = parseInt(item.quantity) || 0;
      const retail = activePricing.prices[item.egg_size] || 0;
      const price = isWholesale ? retail - activePricing.wholesale_discount : retail;
      return {
        order_id: order.id,
        egg_size: item.egg_size,
        product_name: SIZE_LABELS[item.egg_size] || item.egg_size,
        quantity: qty,
        unit_price: price,
        subtotal: price * qty,
      };
    });

    await supabase.from("order_items").insert(orderItems);

    toast({ title: "Created", description: "Order recorded." });
    setOpen(false);
    setForm({ customer_name: "", customer_contact: "", delivery_method: "pickup", notes: "" });
    setOrderDate(new Date());
    setItems([{ egg_size: "medium", quantity: "1" }]);
    fetchOrders();
  };

  const updateField = async (orderId: string, field: string, value: string) => {
    const { error } = await supabase.from("orders").update({ [field]: value }).eq("id", orderId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchOrders();
  };

  const totalTrays = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
  const isWholesale = activePricing ? totalTrays >= activePricing.wholesale_min_trays : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground text-sm">Manage customer orders</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Order</DialogTitle>
            </DialogHeader>
            {!activePricing ? (
              <p className="text-sm text-destructive py-4">No active pricing set. Please activate one in Pricing first.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input value={form.customer_contact} onChange={(e) => setForm({ ...form, customer_contact: e.target.value })} placeholder="Phone / FB name" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !orderDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {orderDate ? format(orderDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={orderDate} onSelect={(d) => d && setOrderDate(d)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Delivery Method</Label>
                  <Select value={form.delivery_method} onValueChange={(v) => setForm({ ...form, delivery_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pick Up</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Order Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="w-3 h-3 mr-1" /> Add Size
                    </Button>
                  </div>
                  {isWholesale && (
                    <p className="text-xs text-primary font-medium">✓ Wholesale pricing applied (₱{activePricing.wholesale_discount} off/tray)</p>
                  )}
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const retail = activePricing.prices[item.egg_size] || 0;
                      const price = isWholesale ? retail - activePricing.wholesale_discount : retail;
                      const qty = parseInt(item.quantity) || 0;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <Select value={item.egg_size} onValueChange={(v) => {
                            const n = [...items]; n[idx].egg_size = v; setItems(n);
                          }}>
                            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EGG_SIZES.map((s) => (
                                <SelectItem key={s} value={s}>{SIZE_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number" min="1" className="w-20 h-9"
                            value={item.quantity}
                            onChange={(e) => { const n = [...items]; n[idx].quantity = e.target.value; setItems(n); }}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            × ₱{price.toFixed(0)} = ₱{(price * qty).toFixed(0)}
                          </span>
                          {items.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-9 w-9 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-right font-bold text-sm">
                    Total: ₱{calculateTotal().toFixed(2)} ({totalTrays} trays)
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
                </div>

                <Button type="submit" className="w-full">Save Order</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount (₱)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders yet</TableCell></TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => { setSelectedOrder(order); setDetailsOpen(true); }}>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{order.customer_contact}</TableCell>
                    <TableCell className="text-sm">{new Date(order.order_date).toLocaleDateString("en-PH")}</TableCell>
                    <TableCell className="text-right font-medium">₱{Number(order.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">{order.delivery_method}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={order.status} onValueChange={(v) => updateField(order.id, "status", v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={order.payment_status} onValueChange={(v) => updateField(order.id, "payment_status", v)}>
                        <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <OrderDetailsDialog
        order={selectedOrder}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdated={() => fetchOrders()}
      />
    </div>
  );
};

export default Orders;
