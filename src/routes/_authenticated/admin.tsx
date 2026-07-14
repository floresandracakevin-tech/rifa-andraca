import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { padTicket } from "@/lib/format";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Panel · Rifa Andraca" }, { name: "robots", content: "noindex" }] }),
});

type Ticket = {
  number: number;
  status: "available" | "reserved" | "confirmed";
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_state: string | null;
  reserved_at: string | null;
  confirmed_at: string | null;
};

function AdminPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "reserved" | "confirmed">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserEmail(u.user?.email ?? "");
      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin");
      const admin = (roleRows ?? []).length > 0;
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .neq("status", "available")
        .order("reserved_at", { ascending: false });
      setTickets((data as Ticket[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
        const row = payload.new as Ticket;
        setTickets((prev) => {
          const next = prev.filter((t) => t.number !== row.number);
          if (row.status !== "available") next.unshift(row);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  // Group by buyer_name + phone with search
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qNum = parseInt(q.replace(/^0+/, ""), 10);
    const filtered = tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      const nameMatch = (t.buyer_name ?? "").toLowerCase().includes(q);
      const phoneMatch = (t.buyer_phone ?? "").toLowerCase().includes(q);
      const stateMatch = (t.buyer_state ?? "").toLowerCase().includes(q);
      const numMatch = Number.isFinite(qNum) && t.number === qNum;
      return nameMatch || phoneMatch || stateMatch || numMatch;
    });
    const map = new Map<string, { name: string; phone: string; state: string; tickets: Ticket[] }>();
    for (const t of filtered) {
      const key = `${t.buyer_name}||${t.buyer_phone}`;
      const entry = map.get(key) ?? { name: t.buyer_name ?? "", phone: t.buyer_phone ?? "", state: t.buyer_state ?? "", tickets: [] };
      entry.tickets.push(t);
      map.set(key, entry);
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      tickets: g.tickets.sort((a, b) => a.number - b.number),
    })).sort((a, b) => b.tickets.length - a.tickets.length);
  }, [tickets, filter, search]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const release = async (nums: number[]) => {
    if (!confirm(`¿Liberar ${nums.length} boleto(s)? Volverán a estar disponibles.`)) return;
    const { error } = await supabase.rpc("release_tickets", { _numbers: nums });
    if (error) alert(error.message);
  };
  const confirm_ = async (nums: number[]) => {
    if (!confirm(`¿Confirmar pago de ${nums.length} boleto(s)?`)) return;
    const { error } = await supabase.rpc("confirm_tickets", { _numbers: nums });
    if (error) alert(error.message);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando...</div>;
  }

  const claimAdmin = async () => {
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error) { alert(error.message); return; }
    if (data === true) window.location.reload();
    else alert("Ya existe un administrador. Contacta al organizador.");
  };

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <img src={logo} alt="" width={80} height={80} className="h-20 w-20 mx-auto" />
          <h1 className="font-display text-3xl text-primary">Acceso restringido</h1>
          <p className="text-sm text-muted-foreground">
            Sesión: <strong>{userEmail}</strong>. Si eres el organizador y aún no hay administrador, reclama el acceso ahora.
          </p>
          <button onClick={claimAdmin} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Reclamar acceso de administrador
          </button>
          <div><button onClick={signOut} className="mt-2 rounded-md border border-border px-4 py-2 text-sm">Cerrar sesión</button></div>
        </div>
      </div>
    );
  }

  const totalReserved = tickets.filter((t) => t.status === "reserved").length;
  const totalConfirmed = tickets.filter((t) => t.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" width={48} height={48} className="h-12 w-12" />
            <div>
              <h1 className="font-display text-xl text-primary">Panel de administración</h1>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <button onClick={signOut} className="rounded-md border border-border px-3 py-1.5 text-sm">Cerrar sesión</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-2 border-primary bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Apartados</p>
            <p className="font-display text-3xl text-primary">{totalReserved}</p>
          </div>
          <div className="rounded-xl border-2 border-secondary bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Pagados</p>
            <p className="font-display text-3xl">{totalConfirmed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ingresos estimados</p>
            <p className="font-display text-3xl">${(totalConfirmed * 50).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm items-center">
          {(["all", "reserved", "confirmed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md border px-3 py-1.5 ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
              {f === "all" ? "Todos" : f === "reserved" ? "Por pagar" : "Pagados"}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, nombre, teléfono o estado…"
            className="flex-1 min-w-[220px] rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="rounded-md border border-border px-3 py-1.5 text-xs">Limpiar</button>
          )}
        </div>

        <div className="space-y-3">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Sin registros todavía.</p>
          )}
          {groups.map((g) => {
            const reservedNums = g.tickets.filter((t) => t.status === "reserved").map((t) => t.number);
            return (
              <div key={g.name + g.phone} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-lg">{g.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <a href={`tel:${g.phone}`} className="underline">{g.phone}</a>
                      {" · "}
                      <a href={`https://wa.me/${g.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>
                    </p>
                    {g.state && <p className="text-xs text-muted-foreground mt-0.5">📍 {g.state}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {g.tickets.length} boleto(s) · ${(g.tickets.length * 50).toLocaleString()} MXN
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {reservedNums.length > 0 && (
                      <button onClick={() => confirm_(reservedNums)}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                        Confirmar pago
                      </button>
                    )}
                    <button onClick={() => release(g.tickets.map((t) => t.number))}
                      className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-xs font-medium">
                      Liberar
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.tickets.map((t) => (
                    <span key={t.number}
                      className={`ticket-btn px-2 ${t.status === "confirmed" ? "bg-secondary text-secondary-foreground border-secondary" : "ticket-taken"}`}>
                      {padTicket(t.number)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
