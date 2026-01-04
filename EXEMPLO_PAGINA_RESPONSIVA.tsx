/**
 * EXEMPLO: Página Responsiva com Novo Design System
 *
 * Este arquivo demonstra como criar uma página totalmente responsiva
 * usando os novos componentes e design tokens do ZippiCRM.
 *
 * IMPORTANTE: Este é apenas um exemplo educacional.
 * Não precisa ser importado no projeto.
 */

import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Download, Filter, MoreVertical } from "lucide-react";
import { useAIDrawer } from "@/hooks/use-ai-drawer";

/**
 * EXEMPLO 1: Página com Grid de Cards Responsivo
 */
export function ExemploGridCards() {
  return (
    <Layout>
      <PageHeader
        title="Estatísticas da Loja"
        description="Visão geral dos principais indicadores"
      >
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </PageHeader>

      {/* Grid responsivo: 1 coluna em mobile, 2 em tablet, 3 em desktop, 4 em XL */}
      <div className="grid-responsive-cards">
        <Card>
          <CardHeader>
            <CardTitle className="text-responsive-lg">1.234</CardTitle>
            <CardDescription>Total de Clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[hsl(var(--color-success-500))] text-white">
              +12% este mês
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-responsive-lg">R$ 45.678</CardTitle>
            <CardDescription>Vendas Totais</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[hsl(var(--color-success-500))] text-white">
              +8% este mês
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-responsive-lg">89</CardTitle>
            <CardDescription>Pedidos Hoje</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[hsl(var(--color-warning-500))] text-white">
              -3% que ontem
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-responsive-lg">4.8/5</CardTitle>
            <CardDescription>Satisfação</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[hsl(var(--color-success-500))] text-white">
              Excelente
            </Badge>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

/**
 * EXEMPLO 2: Formulário Responsivo
 */
export function ExemploFormulario() {
  return (
    <Layout>
      <PageHeader
        title="Novo Cliente"
        description="Preencha os dados do cliente"
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>
            Dados básicos do cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Grid responsivo: 1 coluna em mobile, 2 em desktop */}
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                placeholder="João da Silva"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="joao@email.com"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                className="w-full"
              />
            </div>

            {/* Endereço ocupa 2 colunas em desktop */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                placeholder="Rua, Número, Bairro"
                className="w-full"
              />
            </div>

            {/* Botões ocupam 2 colunas e ficam à direita */}
            <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" type="button" className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                Salvar Cliente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}

/**
 * EXEMPLO 3: Tabela Responsiva
 */
export function ExemploTabela() {
  const clientes = [
    { id: 1, nome: "João Silva", email: "joao@email.com", telefone: "(11) 99999-9999", status: "Ativo" },
    { id: 2, nome: "Maria Santos", email: "maria@email.com", telefone: "(11) 88888-8888", status: "Ativo" },
    { id: 3, nome: "Pedro Costa", email: "pedro@email.com", telefone: "(11) 77777-7777", status: "Inativo" },
  ];

  return (
    <Layout>
      <PageHeader
        title="Lista de Clientes"
        description="Gerencie seus clientes"
      >
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9 w-full"
            />
          </div>
          <Button variant="outline" size="icon" className="sm:w-auto">
            <Filter className="h-4 w-4" />
          </Button>
          <Button size="sm" className="sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {/* Wrapper para scroll horizontal em mobile */}
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">
                      {cliente.nome}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {cliente.email}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {cliente.telefone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          cliente.status === "Ativo"
                            ? "bg-[hsl(var(--color-success-500))] text-white"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {cliente.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

/**
 * EXEMPLO 4: Integrando com o Chat de IA
 */
export function ExemploComIA() {
  const aiDrawer = useAIDrawer();

  return (
    <Layout>
      <PageHeader
        title="Análise de Dados"
        description="Use a IA para analisar seus dados"
      />

      <div className="grid-responsive-2col">
        <Card>
          <CardHeader>
            <CardTitle>Seus Dados</CardTitle>
            <CardDescription>
              Visualize e analise suas informações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Total de vendas este mês
                </p>
                <p className="text-2xl font-bold">R$ 45.678</p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Novos clientes
                </p>
                <p className="text-2xl font-bold">128</p>
              </div>

              {/* Botão para abrir a IA */}
              <Button
                onClick={aiDrawer.open}
                className="w-full"
                variant="outline"
              >
                <span>Analisar com IA</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights Recentes</CardTitle>
            <CardDescription>
              Recomendações da AITOPIA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Oportunidade de Venda
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    5 clientes não compram há mais de 30 dias
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-[hsl(var(--color-success-50))] dark:bg-[hsl(var(--color-success-900))] rounded-lg border border-[hsl(var(--color-success-200))]">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Meta Alcançada
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você atingiu 120% da meta mensal!
                  </p>
                </div>
              </div>

              <Button
                onClick={aiDrawer.open}
                className="w-full"
              >
                Ver Mais Insights
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

/**
 * EXEMPLO 5: Layout Complexo com Múltiplas Seções
 */
export function ExemploCompleto() {
  return (
    <Layout>
      <PageHeader
        title="Dashboard Completo"
        description="Visão geral de todas as métricas importantes"
      >
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nova Ação</span>
        </Button>
      </PageHeader>

      {/* Seção 1: Cards de métricas */}
      <div className="space-y-6">
        <div>
          <h2 className="text-responsive-lg mb-4">Métricas Principais</h2>
          <div className="grid-responsive-cards">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>1.234</CardTitle>
                <CardDescription>Clientes</CardDescription>
              </CardHeader>
            </Card>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>R$ 45K</CardTitle>
                <CardDescription>Vendas</CardDescription>
              </CardHeader>
            </Card>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>89</CardTitle>
                <CardDescription>Pedidos</CardDescription>
              </CardHeader>
            </Card>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>4.8</CardTitle>
                <CardDescription>Avaliação</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Seção 2: Gráficos lado a lado */}
        <div>
          <h2 className="text-responsive-lg mb-4">Análises</h2>
          <div className="grid-responsive-2col">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted rounded">
                  [Gráfico aqui]
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted rounded">
                  [Gráfico aqui]
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Seção 3: Tabela full width */}
        <div>
          <h2 className="text-responsive-lg mb-4">Atividades Recentes</h2>
          <Card>
            <CardContent className="p-0">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atividade</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Nova venda realizada</TableCell>
                      <TableCell className="hidden md:table-cell">Hoje, 14:30</TableCell>
                      <TableCell>
                        <Badge className="bg-[hsl(var(--color-success-500))] text-white">
                          Concluído
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

/**
 * DICAS DE USO:
 *
 * 1. SEMPRE use Layout como wrapper principal
 * 2. SEMPRE use PageHeader no início da página
 * 3. Use grid-responsive-cards para cards de métricas
 * 4. Use grid-responsive-2col para layouts de 2 colunas
 * 5. Use table-responsive para tabelas
 * 6. Use text-responsive-* para textos
 * 7. Use spacing-* para gaps consistentes
 * 8. Use container-padding para padding lateral
 * 9. Sempre teste em mobile (375px), tablet (768px) e desktop (1280px)
 * 10. Use useAIDrawer() para integrar com o chat de IA
 *
 * CORES:
 * - Primary (roxo): Ações principais, links importantes
 * - Secondary (cinza): Ações secundárias
 * - Success (verde): Status positivos, confirmações
 * - Warning (amarelo): Avisos, atenção
 * - Danger (vermelho): Exclusões, erros, ações destrutivas
 *
 * RESPONSIVIDADE:
 * - Mobile First: Sempre comece com o menor viewport
 * - Use sm: para tablets (640px+)
 * - Use md: para tablets grandes (768px+)
 * - Use lg: para desktops (1024px+)
 * - Use xl: para desktops grandes (1280px+)
 */

export default {
  ExemploGridCards,
  ExemploFormulario,
  ExemploTabela,
  ExemploComIA,
  ExemploCompleto,
};
