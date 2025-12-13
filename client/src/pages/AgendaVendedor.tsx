import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  MessageCircle, 
  Phone, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  Gift,
  ShoppingCart,
  RefreshCw,
  Crown,
  Calendar
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type MotivoContato = "aniversario" | "carrinho_abandonado" | "recompra" | "vip_sumido";

interface TarefaCliente {
  id: number;
  nome: string;
  telefone: string;
  avatar?: string;
  motivo: MotivoContato;
  ultimaCompra: string;
  diasUltimaCompra: number;
  ltv: string;
  script: string;
}

const tarefasDoDia: TarefaCliente[] = [
  {
    id: 1,
    nome: "Maria Silva",
    telefone: "5511999998888",
    avatar: "",
    motivo: "carrinho_abandonado",
    ultimaCompra: "Vestido Floral Midi",
    diasUltimaCompra: 2,
    ltv: "R$ 2.450,00",
    script: "Oi Maria! Tudo bem? Vi que você deixou aquele Vestido Floral Midi lindo no carrinho! Ele está quase esgotando e não quero que você perca. Posso garantir o seu com 10% de desconto especial? Só hoje!"
  },
  {
    id: 2,
    nome: "Ana Costa",
    telefone: "5511988887777",
    avatar: "",
    motivo: "aniversario",
    ultimaCompra: "Blazer Alfaiataria",
    diasUltimaCompra: 45,
    ltv: "R$ 5.890,00",
    script: "Oi Ana! Feliz aniversário! 🎂 A gente aqui do Moda CRM não poderia deixar essa data passar em branco. Preparamos um presente especial pra você: 20% OFF em toda a loja + frete grátis! Vale por 7 dias. Vem se mimar!"
  },
  {
    id: 3,
    nome: "Juliana Santos",
    telefone: "5511977776666",
    avatar: "",
    motivo: "recompra",
    ultimaCompra: "Calça Skinny Preta",
    diasUltimaCompra: 30,
    ltv: "R$ 1.230,00",
    script: "Oi Juliana! Já faz um mês que você levou aquela Calça Skinny Preta incrível! Está gostando dela? Chegaram peças novas que combinam perfeitamente. Quer dar uma olhadinha? Posso te mandar algumas sugestões!"
  },
  {
    id: 4,
    nome: "Patricia Oliveira",
    telefone: "5511966665555",
    avatar: "",
    motivo: "vip_sumido",
    ultimaCompra: "Vestido de Festa",
    diasUltimaCompra: 90,
    ltv: "R$ 8.750,00",
    script: "Oi Patricia! Sentimos sua falta por aqui! Você é uma das nossas clientes mais especiais e queremos te ver de volta. Preparamos condições exclusivas VIP só pra você. Que tal passar aqui para um café e conhecer a nova coleção?"
  },
  {
    id: 5,
    nome: "Fernanda Lima",
    telefone: "5511955554444",
    avatar: "",
    motivo: "carrinho_abandonado",
    ultimaCompra: "Bolsa Couro Caramelo",
    diasUltimaCompra: 1,
    ltv: "R$ 3.200,00",
    script: "Oi Fernanda! Vi que a Bolsa Couro Caramelo ficou esperando por você no carrinho. Ela é perfeita e super versátil! Posso te ajudar com alguma dúvida sobre o produto? Se fechar agora, consigo um desconto especial!"
  }
];

const motivoConfig: Record<MotivoContato, { label: string; color: string; icon: React.ReactNode }> = {
  aniversario: {
    label: "Aniversariante",
    color: "bg-pink-500 hover:bg-pink-600",
    icon: <Gift className="h-3 w-3" />
  },
  carrinho_abandonado: {
    label: "Carrinho Abandonado",
    color: "bg-orange-500 hover:bg-orange-600",
    icon: <ShoppingCart className="h-3 w-3" />
  },
  recompra: {
    label: "Recompra Sugerida",
    color: "bg-blue-500 hover:bg-blue-600",
    icon: <RefreshCw className="h-3 w-3" />
  },
  vip_sumido: {
    label: "VIP Sumido",
    color: "bg-purple-500 hover:bg-purple-600",
    icon: <Crown className="h-3 w-3" />
  }
};

function ClienteCard({ tarefa, onMarcarFeito }: { tarefa: TarefaCliente; onMarcarFeito: (id: number) => void }) {
  const [scriptExpandido, setScriptExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const config = motivoConfig[tarefa.motivo];

  const handleChamarWhatsApp = () => {
    const texto = encodeURIComponent(tarefa.script);
    window.open(`https://wa.me/${tarefa.telefone}?text=${texto}`, "_blank");
  };

  const handleCopiarScript = async () => {
    await navigator.clipboard.writeText(tarefa.script);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -300, transition: { duration: 0.3 } }}
    >
      <Card className="overflow-hidden" data-testid={`card-tarefa-${tarefa.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={tarefa.avatar} alt={tarefa.nome} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {tarefa.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-base" data-testid={`text-nome-${tarefa.id}`}>{tarefa.nome}</h3>
                <Badge className={`${config.color} text-white gap-1 mt-1`} data-testid={`badge-motivo-${tarefa.id}`}>
                  {config.icon}
                  {config.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Última Compra:</span>
              <p className="font-medium" data-testid={`text-ultima-compra-${tarefa.id}`}>
                {tarefa.ultimaCompra}
                <span className="text-muted-foreground ml-1">
                  (há {tarefa.diasUltimaCompra} dias)
                </span>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">LTV Total:</span>
              <p className="font-medium text-green-600" data-testid={`text-ltv-${tarefa.id}`}>{tarefa.ltv}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScriptExpandido(!scriptExpandido)}
              className="gap-2"
              data-testid={`button-ver-script-${tarefa.id}`}
            >
              <MessageCircle className="h-4 w-4" />
              Ver Script
              {scriptExpandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleChamarWhatsApp}
              className="gap-2 bg-green-600 hover:bg-green-700"
              data-testid={`button-whatsapp-${tarefa.id}`}
            >
              <Phone className="h-4 w-4" />
              Chamar no WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarcarFeito(tarefa.id)}
              className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
              data-testid={`button-marcar-feito-${tarefa.id}`}
            >
              <Check className="h-4 w-4" />
              Marcar como Feito
            </Button>
          </div>

          <AnimatePresence>
            {scriptExpandido && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Sugestão de Mensagem:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopiarScript}
                      className="gap-2 h-8"
                      data-testid={`button-copiar-script-${tarefa.id}`}
                    >
                      <Copy className="h-3 w-3" />
                      {copiado ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed" data-testid={`text-script-${tarefa.id}`}>
                    {tarefa.script}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const META_DIARIA = 10;
const CONTATOS_JA_REALIZADOS = 3;

export default function AgendaVendedor() {
  const [tarefas, setTarefas] = useState(tarefasDoDia);
  const tarefasFeitasHoje = tarefasDoDia.length - tarefas.length;
  const totalContatosRealizados = CONTATOS_JA_REALIZADOS + tarefasFeitasHoje;
  const progresso = (totalContatosRealizados / META_DIARIA) * 100;

  const handleMarcarFeito = (id: number) => {
    setTarefas(prev => prev.filter(t => t.id !== id));
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Agenda do Vendedor
            </h1>
            <p className="text-muted-foreground mt-1">
              Seus contatos prioritários para hoje
            </p>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold" data-testid="text-meta-titulo">Sua Meta Hoje</h2>
                <p className="text-3xl font-bold text-primary" data-testid="text-meta-progresso">
                  {totalContatosRealizados}/{META_DIARIA} contatos realizados
                </p>
              </div>
              <div className="text-right">
                {totalContatosRealizados >= META_DIARIA ? (
                  <Badge className="bg-green-500 text-white text-sm px-3 py-1">
                    <Check className="h-4 w-4 mr-1" />
                    Meta Atingida!
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Faltam {META_DIARIA - totalContatosRealizados} contatos
                  </span>
                )}
              </div>
            </div>
            <Progress value={progresso} className="h-3" data-testid="progress-meta" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {tarefas.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-600">Parabéns!</h3>
                    <p className="text-muted-foreground mt-2">
                      Você completou todas as tarefas do dia. Excelente trabalho!
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              tarefas.map(tarefa => (
                <ClienteCard 
                  key={tarefa.id} 
                  tarefa={tarefa} 
                  onMarcarFeito={handleMarcarFeito} 
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
