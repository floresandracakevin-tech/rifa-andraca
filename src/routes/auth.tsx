import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Admin · Rifa Andraca" }, { name: "robots", content: "noindex" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setError("Cuenta creada. Pídele al desarrollador que te asigne rol de administrador.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex flex-col items-center gap-2 mb-6">
          <img src={logo} alt="" width={64} height={64} className="h-16 w-16" />
          <span className="font-display text-2xl text-primary">RIFA ANDRACA</span>
        </Link>
        <form onSubmit={submit} className="rounded-2xl border-2 border-primary bg-card p-6 space-y-3">
          <h1 className="font-display text-2xl text-primary text-center">Acceso administrador</h1>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Correo</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Contraseña</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button disabled={loading} className="w-full rounded-md bg-primary py-2.5 font-display tracking-wider text-primary-foreground">
            {loading ? "..." : mode === "in" ? "Entrar" : "Crear cuenta"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-xs text-muted-foreground underline">
            {mode === "in" ? "Crear cuenta de administrador" : "Ya tengo cuenta"}
          </button>
        </form>
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground">← Volver al sitio</Link>
      </div>
    </div>
  );
}
