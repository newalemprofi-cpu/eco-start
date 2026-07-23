import { setRequestLocale } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getProviderConfigStatus } from "@/lib/ai/gateway";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AiConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SUPER_ADMIN");
  const providers = getProviderConfigStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">AI провайдер күйі</h1>
        <p className="mt-1 text-muted-foreground">
          Басымдық реті: Gemini → Cloudflare Workers AI → OpenRouter → демо жауап. Кілт мәндері
          мұнда ешқашан көрсетілмейді — тек әр провайдердің дайын тұрғаны ғана көрсетіледі.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {providers.map((p) => (
          <Card key={p.id} className="border-border/60 shadow-sm">
            <CardContent className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline">#{p.priority}</Badge>
                <span className="font-heading font-bold uppercase">{p.id}</span>
              </div>
              {p.configured ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <CheckCircle2 className="size-4" />
                  Бапталған
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <XCircle className="size-4" />
                  Бапталмаған
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
