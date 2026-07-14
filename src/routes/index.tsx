import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { padTicket } from "@/lib/format";
import logo from "@/assets/logo.png";
import truck from "@/assets/truck.jpg";

export const Route = createFileRoute("/")({
  component: RafflePage,
  head: () => ({
    meta: [
      { title: "Rifa Andraca — Chevrolet S10 MAX 2024 Seminueva" },
      { name: "description", content: "Aparta tus boletos para la Rifa Andraca. Sorteo el 25 de agosto de 2026, Lotería Nacional. Compra 1 y llévate 4 oportunidades por $50, o 10 boletos por $500 con 40 oportunidades." },
    ],
  }),
});

const TOTAL = 60000;
const PAGE_SIZE = 500;

function RafflePage() {
  const [takenSet, setTakenSet] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [jump, setJump] = useState("");

  // Initial load: only fetch reserved/confirmed (small set)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tickets_public")
        .select("number,status")
        .neq("status", "available");
      if (cancelled || error) return;
      setTakenSet(new Set((data ?? []).map((t: any) => t.number)));
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("tickets-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          const row: any = payload.new;
          setTakenSet((prev) => {
            const next = new Set(prev);
            if (row.status === "available") next.delete(row.number);
            else next.add(row.number);
            return next;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalPages = Math.ceil(TOTAL / PAGE_SIZE);
  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd = Math.min(TOTAL, pageStart + PAGE_SIZE - 1);

  const cells = useMemo(() => {
    const arr: number[] = [];
    for (let i = pageStart; i <= pageEnd; i++) arr.push(i);
    return arr;
  }, [pageStart, pageEnd]);

  const toggle = (n: number) => {
    if (takenSet.has(n)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jump, 10);
    if (!Number.isFinite(n) || n < 1 || n > TOTAL) return;
    setPage(Math.floor((n - 1) / PAGE_SIZE));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (selected.size === 0) { setMessage({ type: "err", text: "Selecciona al menos un boleto." }); return; }
    if (name.trim().length < 2) { setMessage({ type: "err", text: "Escribe tu nombre completo." }); return; }
    if (phone.trim().length < 8) { setMessage({ type: "err", text: "Escribe un teléfono válido." }); return; }
    setLoading(true);
    const nums = Array.from(selected).sort((a, b) => a - b);
    const { data, error } = await supabase.rpc("reserve_tickets", {
      _name: name.trim(), _phone: phone.trim(), _numbers: nums,
    });
    setLoading(false);
    if (error) { setMessage({ type: "err", text: error.message || "No se pudo apartar." }); return; }
    const result: any = Array.isArray(data) ? data[0] : data;
    const reserved: number[] = result?.reserved ?? [];
    const unavailable: number[] = result?.unavailable ?? [];
    if (reserved.length === 0) {
      setMessage({ type: "err", text: "Los boletos seleccionados ya fueron apartados por alguien más. Elige otros." });
      setSelected(new Set());
      return;
    }
    setSelected(new Set());
    setMessage({
      type: "ok",
      text: unavailable.length
        ? `Apartamos ${reserved.length} boleto(s). No pudimos apartar: ${unavailable.map(padTicket).join(", ")}. Realiza tu transferencia para confirmar.`
        : `¡Listo! Apartamos ${reserved.length} boleto(s). Realiza tu transferencia para confirmar tu participación.`,
    });
  };

  const selectedList = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);
  const takenCount = takenSet.size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Rifa Andraca" width={64} height={64} className="h-16 w-16" />
            <div>
              <h1 className="text-2xl font-display text-primary leading-none">RIFA ANDRACA</h1>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Sorteo 25 · Agosto · 2026</p>
            </div>
          </div>
          <Link to="/auth" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
            Admin
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary-foreground">Chevrolet S10 MAX 2024 · Seminueva · Blanca</p>
            <h2 className="mt-4 text-5xl md:text-6xl font-display leading-[0.95] text-primary">GÁNATE LA TROCA</h2>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Boletos del <span className="font-mono font-semibold text-foreground">00001</span> al <span className="font-mono font-semibold text-foreground">60000</span>. Sorteo con base en la <strong className="text-foreground">Lotería Nacional</strong> el <strong className="text-foreground">25 de agosto de 2026</strong>.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-primary bg-card p-4">
                <p className="text-3xl font-display text-primary">$50</p>
                <p className="text-sm font-semibold">1 boleto = <span className="text-primary">4 oportunidades</span></p>
                <p className="text-xs text-muted-foreground mt-1">Te regalamos 3 números extra</p>
              </div>
              <div className="rounded-xl border-2 border-secondary bg-secondary/20 p-4">
                <p className="text-3xl font-display text-primary">$500</p>
                <p className="text-sm font-semibold">10 boletos = <span className="text-primary">40 oportunidades</span></p>
                <p className="text-xs text-muted-foreground mt-1">La mejor promoción</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <img src={truck} alt="Chevrolet S10 MAX 2024 blanca" width={1600} height={1008} className="rounded-2xl border-4 border-ink shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Payment info */}
      <section className="border-y border-border bg-ink text-cream">
        <div className="mx-auto max-w-6xl px-4 py-6 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-secondary">Transferencia a</p>
            <p className="text-lg font-semibold">Mercado Pago</p>
            <p className="text-sm text-cream/80">A nombre de <strong>Kevin Flores Andraca</strong></p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-secondary">Número de cuenta</p>
            <p className="font-mono text-xl tracking-wider">5428 7808 9628 3157</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-secondary">Pasos</p>
            <ol className="text-sm text-cream/90 list-decimal list-inside space-y-0.5">
              <li>Selecciona tus boletos</li>
              <li>Aparta con tu nombre y teléfono</li>
              <li>Transfiere y envía tu comprobante</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Ticket picker */}
      <section id="boletos" className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h3 className="text-3xl font-display text-primary">Elige tus boletos</h3>
            <p className="text-sm text-muted-foreground">
              Apartados: <strong className="text-foreground">{takenCount.toLocaleString()}</strong> · Disponibles: <strong className="text-foreground">{(TOTAL - takenCount).toLocaleString()}</strong>
            </p>
          </div>
          <form onSubmit={handleJump} className="flex gap-2">
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              placeholder="Ir al boleto #"
              inputMode="numeric"
              className="w-40 rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Ir</button>
          </form>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs mb-4">
          <span className="flex items-center gap-2"><span className="ticket-btn h-5 w-8" /> Disponible</span>
          <span className="flex items-center gap-2"><span className="ticket-btn ticket-selected h-5 w-8" /> Seleccionado</span>
          <span className="flex items-center gap-2"><span className="ticket-btn ticket-taken h-5 w-8" /> Apartado</span>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
          >← Anterior</button>
          <span className="font-mono">
            {padTicket(pageStart)} – {padTicket(pageEnd)} · página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
          >Siguiente →</button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
          {cells.map((n) => {
            const taken = takenSet.has(n);
            const sel = selected.has(n);
            const cls = taken
              ? "ticket-btn ticket-taken"
              : sel
                ? "ticket-btn ticket-selected"
                : "ticket-btn ticket-available";
            return (
              <button
                key={n}
                onClick={() => toggle(n)}
                disabled={taken}
                className={cls}
                aria-label={`Boleto ${padTicket(n)}${taken ? " apartado" : ""}`}
              >
                {padTicket(n)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Reservation form */}
      <section className="border-t border-border bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-3xl font-display text-primary">Mis boletos</h3>
            {selectedList.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aún no has seleccionado boletos. Toca los números arriba.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedList.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggle(n)}
                    className="ticket-btn ticket-selected px-2"
                    title="Quitar"
                  >
                    {padTicket(n)} ×
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm">
              Total: <strong>{selectedList.length}</strong> boleto(s) · <strong>${(selectedList.length * 50).toLocaleString()} MXN</strong>
            </p>
          </div>

          <form onSubmit={submit} className="rounded-2xl border-2 border-primary bg-card p-6 space-y-3">
            <h4 className="font-display text-2xl text-primary">Aparta tus boletos</h4>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Nombre completo</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Teléfono / WhatsApp</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-md bg-primary py-3 font-display text-lg tracking-wider text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Apartando..." : "APARTAR MIS BOLETOS"}
            </button>
            {message && (
              <p className={`text-sm ${message.type === "ok" ? "text-primary" : "text-destructive"}`}>{message.text}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Al apartar, tus boletos quedan bloqueados hasta que el organizador confirme tu pago. Luego transfiere a la cuenta indicada.
            </p>
          </form>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Rifa Andraca · Kevin Flores Andraca
      </footer>
    </div>
  );
}
