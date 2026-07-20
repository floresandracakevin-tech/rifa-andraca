import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { padTicket } from "@/lib/format";
import logo from "@/assets/logo.png";
import truck from "@/assets/truck.jpg";
import truck2 from "@/assets/rifa_s10_2.png.asset.json";
import truck3 from "@/assets/s10_mas_rifa_4.png.asset.json";
import truck4 from "@/assets/s10_max_rifa_6.jpeg.asset.json";
import truck5 from "@/assets/rifa_s10_max_rifa_7.jpeg.asset.json";

export const Route = createFileRoute("/")({
  component: RafflePage,
  head: () => ({
    meta: [
      { title: "Rifa Andraca — Chevrolet S10 MAX 2024 Seminueva" },
      { name: "description", content: "Aparta tus boletos para la Rifa Andraca. Sorteo el 25 de agosto de 2026, Lotería Nacional. $50 el boleto con 4 oportunidades o 10 boletos por $500 con 40 oportunidades." },
    ],
  }),
});

const TOTAL = 60000;
const PAGE_SIZE = 500;

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

function RafflePage() {
  const [takenSet, setTakenSet] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [jump, setJump] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Trigger cleanup of expired reservations
      await supabase.rpc("expire_reservations");
      const { data, error } = await supabase
        .from("tickets_status")
        .select("number,status")
        .neq("status", "available");
      if (cancelled || error) return;
      setTakenSet(new Set((data ?? []).map((t: any) => t.number)));
    })();
    // Periodic cleanup while page is open
    const iv = setInterval(() => { supabase.rpc("expire_reservations"); }, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

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
    if (!estado) { setMessage({ type: "err", text: "Selecciona tu estado." }); return; }
    setLoading(true);
    const nums = Array.from(selected).sort((a, b) => a - b);
    const { data, error } = await supabase.rpc("reserve_tickets", {
      _name: name.trim(), _phone: phone.trim(), _state: estado, _numbers: nums,
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
      text: `¡Listo! Apartamos ${reserved.length} boleto(s). Te redirigimos a WhatsApp con las instrucciones de pago. Tienes 30 minutos para enviar tu comprobante o los boletos se liberarán automáticamente.${unavailable.length ? ` No pudimos apartar: ${unavailable.map(padTicket).join(", ")}.` : ""}`,
    });

    // Redirigir a WhatsApp de Rifa Andraca con el mensaje de pago
    const waNumber = "527441632840";
    const msg = `💳 *Forma de pago — Rifa Andraca*\n\nTransferencia Mercado Pago\n\nCuenta: 5428 7808 9628 3157\n\nA nombre de: *Kevin Flores Andraca*\n\nBoletos apartados: ${reserved.map(padTicket).join(", ")}\nTotal a pagar: $${(Math.ceil(reserved.length / 4) * 50).toLocaleString()} MXN\n\nPor favor transfiere el monto exacto de tu pedido y mándame tu comprobante para confirmar tu apartado, tienes 30min. para confirmar tu compra mandandome tu comprobante, de lo contrario no se tomaran en cuenta tus boletos. ¡Gracias! 🙌`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const selectedList = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);
  const takenCount = takenSet.size;

  const gallery = [truck, truck2.url, truck4.url, truck5.url];

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary-foreground">Chevrolet S10 MAX 2024 · Seminueva · Blanca</p>
            <h2 className="mt-4 text-5xl md:text-6xl font-display leading-[0.95] text-primary">GÁNATE LA TROCA</h2>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Sorteo con base en la <strong className="text-foreground">Lotería Nacional</strong> el <strong className="text-foreground">25 de agosto de 2026</strong>.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-primary bg-card p-4">
                <p className="text-3xl font-display text-primary">$50</p>
                <p className="text-sm font-semibold">1 boleto + <span className="text-primary">3 de regalo</span></p>
                <p className="text-xs text-muted-foreground mt-1">4 oportunidades para ganar</p>
              </div>
              <div className="rounded-xl border-2 border-secondary bg-secondary/20 p-4">
                <p className="text-3xl font-display text-primary">$500</p>
                <p className="text-sm font-semibold">10 boletos = <span className="text-primary">40 oportunidades</span></p>
                <p className="text-xs text-muted-foreground mt-1">La mejor promoción</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <img src={truck3.url} alt="Chevrolet S10 MAX 2024 blanca en perspectiva" width={1600} height={1008} className="rounded-2xl border-4 border-ink shadow-2xl w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gallery.map((src, i) => (
            <img key={i} src={src} alt={`Chevrolet S10 MAX foto ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover rounded-xl border-2 border-ink" />
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-ink text-cream">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-widest text-secondary">Opciones de pago</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-cream/20 bg-cream/5 p-3">
                  <p className="text-sm font-semibold text-secondary">Mercado Pago</p>
                  <p className="font-mono text-base tracking-wider">5428 7808 9628 3157</p>
                  <p className="text-xs text-cream/80 mt-1">CLABE: 722 969 010 472 785 485</p>
                  <p className="text-xs text-cream/80">A nombre de Kevin Flores Andraca</p>
                </div>
                <div className="rounded-lg border border-cream/20 bg-cream/5 p-3">
                  <p className="text-sm font-semibold text-secondary">Banco Azteca</p>
                  <p className="font-mono text-base tracking-wider">4027 6658 8076 1433</p>
                  <p className="text-xs text-cream/80 mt-1">Transferencia y depósitos en cualquier banco y Oxxo</p>
                  <p className="text-xs text-cream/80">A nombre de Kevin Flores Andraca</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-secondary">WhatsApp para comprobantes</p>
              <a href="https://wa.me/527441632840" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-lg font-semibold hover:text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.883-9.885 9.883m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                744 163 2840
              </a>
              <p className="text-xs text-cream/80 mt-1">Envía tu comprobante en 30 min</p>
            </div>
          </div>
        </div>
      </section>

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

        <div className="flex flex-wrap gap-4 text-xs mb-4">
          <span className="flex items-center gap-2"><span className="ticket-btn h-5 w-8" /> Disponible</span>
          <span className="flex items-center gap-2"><span className="ticket-btn ticket-selected h-5 w-8" /> Seleccionado</span>
          <span className="flex items-center gap-2"><span className="ticket-btn ticket-taken h-5 w-8" /> Apartado</span>
        </div>

        <div className="flex items-center justify-between mb-3 text-sm">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">← Anterior</button>
          <span className="font-mono">{padTicket(pageStart)} – {padTicket(pageEnd)} · página {page + 1} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40">Siguiente →</button>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
          {cells.map((n) => {
            const taken = takenSet.has(n);
            const sel = selected.has(n);
            const cls = taken ? "ticket-btn ticket-taken" : sel ? "ticket-btn ticket-selected" : "ticket-btn ticket-available";
            return (
              <button key={n} onClick={() => toggle(n)} disabled={taken} className={cls} aria-label={`Boleto ${padTicket(n)}${taken ? " apartado" : ""}`}>
                {padTicket(n)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-3xl font-display text-primary">Mis boletos</h3>
            {selectedList.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aún no has seleccionado boletos. Toca los números arriba.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedList.map((n) => (
                  <button key={n} onClick={() => toggle(n)} className="ticket-btn ticket-selected px-2" title="Quitar">
                    {padTicket(n)} ×
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-1 text-sm">
              <p>Boletos seleccionados: <strong>{selectedList.length}</strong></p>
              <p className="text-lg pt-1 border-t border-primary/20 mt-2">A pagar: <strong className="text-primary text-2xl font-display">${(Math.ceil(selectedList.length / 4) * 50).toLocaleString()} MXN</strong></p>
            </div>
            <div className="mt-4 rounded-lg border-2 border-destructive bg-destructive/10 p-3 text-sm">
              <strong className="text-destructive">⏱ Importante:</strong> Después de apartar tienes <strong>30 minutos</strong> para enviar tu comprobante de pago por WhatsApp al <strong>7441632840</strong>. Si no lo envías, tus boletos se liberan automáticamente y no se tomará en cuenta la compra.
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border-2 border-primary bg-card p-6 space-y-3">
            <h4 className="font-display text-2xl text-primary">Aparta tus boletos</h4>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Teléfono / WhatsApp</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Estado de la República</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecciona tu estado…</option>
                {ESTADOS_MX.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button disabled={loading} className="w-full rounded-md bg-primary py-3 font-display text-lg tracking-wider text-primary-foreground disabled:opacity-60">
              {loading ? "Apartando..." : "APARTAR MIS BOLETOS"}
            </button>
            {message && (
              <p className={`text-sm ${message.type === "ok" ? "text-primary" : "text-destructive"}`}>{message.text}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Al apartar, tus boletos quedan bloqueados por 30 minutos. Envía tu comprobante por WhatsApp al 7441632840 para confirmar tu participación.
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
