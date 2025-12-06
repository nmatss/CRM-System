import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Zap, Clock, UserCheck, ShoppingCart, ArrowRight } from "lucide-react";

const automations = [
  {
    id: 1,
    title: "Recuperação de Carrinho Abandonado",
    description: "Enviar mensagem no WhatsApp 1 hora após abandono do carrinho",
    icon: ShoppingCart,
    active: true,
    stats: "Recuperou R$ 12.500 esta semana"
  },
  {
    id: 2,
    title: "Avaliação Pós-Compra",
    description: "Solicitar avaliação via SMS 7 dias após a entrega",
    icon: UserCheck,
    active: true,
    stats: "4.8/5 nota média"
  },
  {
    id: 3,
    title: "Parabéns Aniversário",
    description: "Enviar cartão personalizado + 15% cupom na manhã do aniversário",
    icon: GiftIcon,
    active: false,
    stats: "Configuração necessária"
  },
  {
    id: 4,
    title: "Resgate de Inativos (Winback)",
    description: "Disparar sequência quando cliente não compra há 90 dias",
    icon: Clock,
    active: true,
    stats: "8% taxa de reativação"
  }
];

function GiftIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  )
}

export default function Automations() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Automações (Estilo Otto)</h1>
            <p className="text-muted-foreground">Configure regras de "Se Isso, Então Aquilo" para sua loja.</p>
          </div>
          <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
            <Zap className="h-4 w-4" />
            Nova Automação
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {automations.map((automation) => (
            <Card key={automation.id} className="relative overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-all">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md">
                    <automation.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-base font-semibold">{automation.title}</CardTitle>
                </div>
                <Switch checked={automation.active} />
              </CardHeader>
              <CardContent>
                <CardDescription className="mt-2 mb-4">
                  {automation.description}
                </CardDescription>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {automation.stats}
                  </span>
                  <Button variant="ghost" size="sm" className="gap-1 h-8">
                    Editar <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
