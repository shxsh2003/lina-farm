import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, Link2Off, RefreshCcw } from "lucide-react";

type FacebookConnection = {
  id: string;
  page_id: string;
  page_name: string;
  connected_at: string;
  updated_at: string;
};

type FacebookMessage = {
  id: string;
  sender_psid: string;
  message_text: string | null;
  direction: "inbound" | "outbound";
  message_ts: string;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const Facebook = () => {
  const { toast } = useToast();
  const [connection, setConnection] = useState<FacebookConnection | null>(null);
  const [messages, setMessages] = useState<FacebookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadConnection = async () => {
    const { data, error } = await supabase
      .from("facebook_page_connections")
      .select("id,page_id,page_name,connected_at,updated_at")
      .maybeSingle();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }
    setConnection(data ?? null);
    return data ?? null;
  };

  const loadMessages = async (pageId?: string) => {
    if (!pageId) {
      setMessages([]);
      return;
    }
    const { data, error } = await supabase
      .from("facebook_messages")
      .select("id,sender_psid,message_text,direction,message_ts")
      .eq("page_id", pageId)
      .order("message_ts", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setMessages((data ?? []) as FacebookMessage[]);
  };

  const refreshAll = async () => {
    setRefreshing(true);
    const conn = await loadConnection();
    await loadMessages(conn?.page_id);
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const conn = await loadConnection();
      await loadMessages(conn?.page_id);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!connection?.page_id) return;
    const channel = supabase
      .channel(`facebook_messages:${connection.page_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "facebook_messages", filter: `page_id=eq.${connection.page_id}` },
        (payload) => {
          const incoming = payload.new as FacebookMessage;
          setMessages((prev) => [incoming, ...prev].slice(0, 50));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connection?.page_id]);

  useEffect(() => {
    if (!connection?.page_id) return;
    const interval = setInterval(() => {
      loadMessages(connection.page_id);
    }, 15000);
    return () => clearInterval(interval);
  }, [connection?.page_id]);

  const handleConnect = async () => {
    setConnecting(true);
    const redirectTo = `${window.location.origin}/facebook`;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = refreshed?.session?.access_token || sessionData.session?.access_token;
    if (!accessToken) {
      setConnecting(false);
      toast({
        title: "Not signed in",
        description: "Please sign in again before connecting Facebook.",
        variant: "destructive",
      });
      return;
    }
    if (refreshError) {
      toast({
        title: "Session refresh failed",
        description: refreshError.message,
        variant: "destructive",
      });
    }

    const { data, error } = await supabase.functions.invoke("facebook-oauth-start", {
      body: { redirect_to: redirectTo },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setConnecting(false);

    if (error || !data?.url) {
      toast({ title: "Connect failed", description: error?.message || "Unable to start Facebook OAuth.", variant: "destructive" });
      return;
    }
    window.location.href = data.url;
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    const { error } = await supabase
      .from("facebook_page_connections")
      .delete()
      .eq("page_id", connection.page_id);
    if (error) {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Disconnected", description: "Facebook Page connection removed." });
    setConnection(null);
    setMessages([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facebook Messages</h1>
          <p className="text-muted-foreground text-sm">Connect your Page and view recent conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loading || refreshing}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {connection ? (
            <Button variant="destructive" onClick={handleDisconnect}>
              <Link2Off className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              <Link2 className="w-4 h-4 mr-2" />
              {connecting ? "Connecting..." : "Connect Facebook"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading connection...</p>
          ) : connection ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">Connected</Badge>
                <span className="font-medium">{connection.page_name || "Facebook Page"}</span>
                <span className="text-xs text-muted-foreground">Page ID: {connection.page_id}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Connected at {formatDate(connection.connected_at)} · Updated {formatDate(connection.updated_at)}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No Facebook Page connected yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Messages</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Loading messages...
                  </TableCell>
                </TableRow>
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {connection ? "No messages yet. Send a test message to your Page." : "Connect a Page to view messages."}
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <Badge variant={msg.direction === "inbound" ? "secondary" : "default"}>
                        {msg.direction === "inbound" ? "Inbound" : "Outbound"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      {msg.message_text || <span className="text-muted-foreground text-xs">No text</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{msg.sender_psid}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatDate(msg.message_ts)}</TableCell>
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

export default Facebook;
