import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Store,
  Users,
  TrendingUp,
  Zap,
  MessageSquare,
  Gift,
  BarChart3,
  Shield,
  Check,
  ArrowRight,
  Sparkles,
  Building2,
  RefreshCw,
  Database,
  Link2,
  ChevronRight,
  Star,
  Phone,
  Mail,
  Calendar
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const integrations = [
  {
    name: "Microvix",
    logo: "M",
    color: "from-blue-600 to-blue-800",
    description: "Integração completa com ERP Microvix para sincronização de vendas, estoque e clientes em tempo real.",
    features: ["Sincronização de vendas", "Gestão de estoque", "Cadastro de clientes", "Pedidos automáticos"]
  },
  {
    name: "Zippi CRM",
    logo: "Z",
    color: "from-green-600 to-green-800",
    description: "Integração completa com Zippi CRM para gestão de relacionamento e vendas.",
    features: ["Gestão de leads", "Pipeline de vendas", "Automação de marketing", "Relatórios avançados"]
  },
  {
    name: "LinxPOS",
    logo: "L",
    color: "from-orange-600 to-orange-800",
    description: "Integração nativa com LinxPOS para operações de PDV e gestão de loja física.",
    features: ["PDV integrado", "Vendas em tempo real", "Gestão de caixa", "Multi-lojas"]
  }
];

const features = [
  {
    icon: Users,
    title: "Visão 360° do Cliente",
    description: "Histórico completo, preferências, comportamento de compra e segmentação inteligente."
  },
  {
    icon: Gift,
    title: "Cashback & Fidelidade",
    description: "Programa de pontos e cashback configurável para aumentar retenção e ticket médio."
  },
  {
    icon: MessageSquare,
    title: "Campanhas Multicanal",
    description: "WhatsApp, SMS e Email integrados para comunicação personalizada com clientes."
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    description: "Regras automáticas para aniversários, pós-venda, reativação e muito mais."
  },
  {
    icon: Calendar,
    title: "Agenda do Vendedor",
    description: "Tarefas diárias, follow-ups e clienteling para vendedores mais produtivos."
  },
  {
    icon: BarChart3,
    title: "Relatórios Avançados",
    description: "Dashboards em tempo real com métricas de vendas, performance e ROI de campanhas."
  }
];

const plans = [
  {
    name: "Starter",
    price: "297",
    description: "Para lojas iniciando no CRM",
    features: [
      "Até 1.000 clientes",
      "1 usuário",
      "Campanhas por email",
      "Relatórios básicos",
      "Suporte por email"
    ],
    highlighted: false
  },
  {
    name: "Professional",
    price: "597",
    description: "Para lojas em crescimento",
    features: [
      "Até 10.000 clientes",
      "5 usuários",
      "WhatsApp + Email + SMS",
      "Automações ilimitadas",
      "Integrações ERP",
      "Suporte prioritário"
    ],
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "Para redes e franquias",
    features: [
      "Clientes ilimitados",
      "Usuários ilimitados",
      "Multi-lojas",
      "API personalizada",
      "Gerente de sucesso dedicado",
      "SLA garantido"
    ],
    highlighted: false
  }
];

const testimonials = [
  {
    name: "Maria Santos",
    role: "Proprietária",
    company: "Boutique Elegance",
    text: "O Moda CRM transformou nossa loja. Aumentamos o ticket médio em 35% com as campanhas de cashback!",
    rating: 5
  },
  {
    name: "Roberto Lima",
    role: "Gerente",
    company: "Fashion Store",
    text: "A integração com Microvix foi perfeita. Agora temos visão completa do cliente em um só lugar.",
    rating: 5
  },
  {
    name: "Ana Paula",
    role: "Diretora",
    company: "Rede ModaPlus",
    text: "Com a Agenda do Vendedor, nossos consultores ficaram muito mais produtivos e engajados.",
    rating: 5
  }
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">Moda CRM</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
              <a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrações</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Depoimentos</a>
            </nav>
            <div className="flex items-center gap-3">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                data-testid="button-header-contact"
              >
                <Phone className="w-4 h-4 mr-2" />
                Fale Conosco
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-purple-50 via-pink-50 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-100" data-testid="badge-hero">
              <Sparkles className="w-3 h-3 mr-1" />
              O CRM #1 para Lojas de Moda
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Transforme clientes em{" "}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                fãs da sua marca
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              CRM completo para varejo de moda com integração nativa com Microvix, Cigam e LinxPOS. 
              Aumente vendas, fidelize clientes e potencialize sua equipe.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg px-8"
                data-testid="button-hero-demo"
              >
                <Phone className="w-5 h-5 mr-2" />
                Agendar uma Demonstração
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-hero-contact">
                <Mail className="w-5 h-5 mr-2" />
                Falar com Especialista
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              ✓ Demonstração personalizada &nbsp; ✓ Suporte em português &nbsp; ✓ Implantação assistida
            </p>
          </motion.div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div 
            className="mt-16 relative"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-3xl opacity-20 transform scale-105"></div>
              <div className="relative bg-white rounded-2xl shadow-2xl border overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground">app.modacrm.com.br</span>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-gray-50 to-white">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Vendas Hoje", value: "R$ 12.450", trend: "+18%" },
                      { label: "Clientes Ativos", value: "2.847", trend: "+5%" },
                      { label: "Ticket Médio", value: "R$ 389", trend: "+12%" },
                      { label: "Conversão", value: "34%", trend: "+8%" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 shadow-sm border">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-xl font-bold mt-1">{stat.value}</p>
                        <p className="text-xs text-green-600 mt-1">{stat.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border h-48">
                      <p className="text-sm font-medium mb-2">Vendas da Semana</p>
                      <div className="flex items-end justify-between h-32 px-2">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                          <div 
                            key={i} 
                            className="w-8 bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-md"
                            style={{ height: `${h}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm font-medium mb-3">Top Clientes</p>
                      {["Ana M.", "João S.", "Maria L."].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400"></div>
                          <span className="text-xs">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
              <Link2 className="w-3 h-3 mr-1" />
              Integrações Nativas
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Conectado aos principais ERPs do Brasil
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Integração plug-and-play com os sistemas que você já usa. Sem complicação, sem retrabalho.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-2 hover:border-purple-200" data-testid={`card-integration-${integration.name.toLowerCase()}`}>
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-white text-2xl font-bold`}>
                        {integration.logo}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{integration.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">Certificado</Badge>
                      </div>
                    </div>
                    <CardDescription className="text-base">
                      {integration.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {integration.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">E muitas outras integrações disponíveis</p>
            <div className="flex justify-center gap-8 opacity-50">
              <Database className="w-8 h-8" />
              <RefreshCw className="w-8 h-8" />
              <Building2 className="w-8 h-8" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100">
              <Zap className="w-3 h-3 mr-1" />
              Recursos Poderosos
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Tudo que você precisa para crescer
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ferramentas completas para conhecer, engajar e fidelizar seus clientes
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1" data-testid={`card-feature-${index}`}>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-purple-600" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-purple-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">
              <TrendingUp className="w-3 h-3 mr-1" />
              Planos Flexíveis
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Escolha o plano ideal para sua loja
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comece grátis e escale conforme seu negócio cresce
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`h-full relative ${plan.highlighted ? 'border-2 border-purple-500 shadow-xl scale-105' : ''}`}
                  data-testid={`card-plan-${plan.name.toLowerCase()}`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      {plan.price === "Sob consulta" ? (
                        <span className="text-3xl font-bold">{plan.price}</span>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-5xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">/mês</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full ${plan.highlighted ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.price === "Sob consulta" ? "Falar com Vendas" : "Solicitar Proposta"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              <Star className="w-3 h-3 mr-1" />
              Clientes Satisfeitos
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              O que dizem nossos clientes
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full" data-testid={`card-testimonial-${index}`}>
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6 italic">"{testimonial.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400"></div>
                      <div>
                        <p className="font-medium">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto para transformar sua loja?
            </h2>
            <p className="text-xl text-white/80 mb-8">
              Junte-se a mais de 500 lojas que já usam o Moda CRM para crescer
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8"
                data-testid="button-cta-demo"
              >
                <Phone className="w-5 h-5 mr-2" />
                Agendar Demo
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 bg-transparent text-white border-white hover:bg-white/10"
                data-testid="button-cta-contact"
              >
                <Mail className="w-5 h-5 mr-2" />
                Falar com Especialista
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <Store className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg">Moda CRM</span>
              </div>
              <p className="text-gray-400 text-sm">
                O CRM especializado para o varejo de moda brasileiro.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Recursos</a></li>
                <li><a href="#integrations" className="hover:text-white transition-colors">Integrações</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Planos</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreiras</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  contato@modacrm.com.br
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (11) 99999-9999
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <p>© 2024 Moda CRM. Todos os direitos reservados.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
