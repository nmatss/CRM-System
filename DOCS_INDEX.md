# ZippiCRM - Índice de Documentação

Este documento lista toda a documentação disponível no projeto, organizada por categoria.

---

## Fonte oficial de planejamento e retomada

📋 **[Plano mestre e checkpoint atual](./docs/PROJECT_COMPLETION_PLAN.md)** ⭐ **COMECE AQUI PARA RETOMAR O PROJETO**

- Estado auditado do produto e da arquitetura
- Backlog priorizado por fases, dependências e riscos
- Gates e critérios de aceite
- Evidências do checkpoint atual e próximo passo seguro

Documentos operacionais relacionados:

- [Deploy](./DEPLOY.md)
- [Backup e restore](./BACKUP_RESTORE.md)
- [Runbook de produção](./RUNBOOK_PRODUCAO.md)
- [Checklist de go-live](./GO_LIVE_CHECKLIST.md)
- [ADR 0001 — Outbox durável e worker embutido](./docs/adr/0001-durable-outbox-and-embedded-worker.md)
- [ADR 0002 — Dinheiro inteiro e métricas derivadas](./docs/adr/0002-integer-money-and-derived-metrics.md)

---

## 📚 Documentação histórica de UI/Layout (2025-12-17)

Os documentos abaixo preservam decisões antigas de layout. Eles contêm seções obsoletas explicitamente sinalizadas, inclusive sobre AITOPIA, removida por não possuir integração real.

### Para Começar Rapidamente

📖 **[UI_LAYOUT_README.md](./UI_LAYOUT_README.md)** ⭐ **COMECE AQUI**

- Resumo executivo das implementações
- Quick start e exemplos rápidos
- Checklist de verificação
- FAQ e suporte

### Design System Completo

📖 **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)**

- Sistema completo de cores (Purple primary #7c3aed)
- Espaçamento padronizado (7 níveis)
- Tipografia (8 tamanhos)
- Componentes e variantes
- Breakpoints e responsividade
- Classes utilitárias
- Exemplos práticos

### Detalhamento Técnico

📋 **[IMPLEMENTACAO_UI_LAYOUT.md](./IMPLEMENTACAO_UI_LAYOUT.md)**

- Detalhes técnicos de cada implementação
- Lista completa de arquivos modificados/criados
- Histórico da implementação original, com avisos sobre recursos removidos
- Tokens CSS implementados
- Melhorias de responsividade
- Resultados dos testes

---

## 🔒 Documentação de Segurança

### Segurança CSRF

📖 **[CSRF_SECURITY.md](./CSRF_SECURITY.md)** (7.2 KB)

- Proteção contra ataques CSRF
- Implementação de tokens
- Configurações de segurança

### Segurança Geral

📖 **[SECURITY.md](./SECURITY.md)** (4.3 KB)

- Boas práticas de segurança
- Proteções implementadas
- Políticas de segurança

---

## 🔧 Documentação de API (Novo)

### API Quick Reference

📖 **[docs/API_QUICK_REFERENCE.md](./docs/API_QUICK_REFERENCE.md)**

- Referência rápida dos endpoints
- Exemplos de uso
- Respostas comuns

### API README

📖 **[docs/API_README.md](./docs/API_README.md)**

- Documentação completa da API
- Autenticação
- Endpoints detalhados

### OpenAPI Specification

📖 **[docs/openapi.yaml](./docs/openapi.yaml)**

- Especificação OpenAPI 3.0
- Schemas completos
- Endpoints documentados

---

## 📱 Componentes Principais

### Layout Core

```
client/src/components/layout/
├── Layout.tsx              # Wrapper principal autenticado
├── Header.tsx              # Header responsivo
├── Sidebar.tsx             # Sidebar colapsável
├── PageHeader.tsx          # Header de páginas
└── AdminLayout.tsx         # Layout admin
```

### UI Components

```
client/src/components/ui/
├── button.tsx              # Botões (cores atualizadas)
├── card.tsx                # Cards
├── table.tsx               # Tabelas
├── input.tsx               # Inputs
├── dialog.tsx              # Modais
├── dropdown-menu.tsx       # Menus dropdown
├── sheet.tsx               # Side sheets
└── [40+ componentes]       # Biblioteca completa
```

---

## 🎨 Sistema de Estilos

### Arquivo Principal

📖 **[client/src/index.css](./client/src/index.css)**

- Design tokens completos
- Cores do sistema
- Espaçamento padronizado
- Tipografia
- Classes utilitárias
- Tema claro/escuro

---

## 📦 Como Navegar na Documentação

### Se você é Desenvolvedor Frontend

1. ⭐ Comece com [UI_LAYOUT_README.md](./UI_LAYOUT_README.md)
2. 📖 Leia [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) para entender o sistema
3. 📋 Consulte [IMPLEMENTACAO_UI_LAYOUT.md](./IMPLEMENTACAO_UI_LAYOUT.md) para detalhes técnicos

### Se você é Desenvolvedor Backend

1. 📖 Comece com [docs/API_README.md](./docs/API_README.md)
2. 📖 Use [docs/API_QUICK_REFERENCE.md](./docs/API_QUICK_REFERENCE.md) como referência
3. 📖 Veja [docs/openapi.yaml](./docs/openapi.yaml) para a spec completa

### Se você é Gerente de Projeto

1. ⭐ Leia [UI_LAYOUT_README.md](./UI_LAYOUT_README.md) para entender o que foi feito
2. 📋 Consulte [IMPLEMENTACAO_UI_LAYOUT.md](./IMPLEMENTACAO_UI_LAYOUT.md) para detalhes
3. 📖 Revise [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) para padrões visuais

### Se você é Designer

1. 🎨 Estude [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) completamente
2. 💻 Veja [EXEMPLO_PAGINA_RESPONSIVA.tsx](./EXEMPLO_PAGINA_RESPONSIVA.tsx) apenas como exemplo educacional
3. 📖 Consulte [client/src/index.css](./client/src/index.css) para tokens CSS

---

## 🔄 Atualizações Recentes

### 2025-12-17 - Implementação UI/Layout Core

- ⚠️ Protótipo AITOPIA criado nessa data e removido em 2026-08-29 por não possuir integração real
- ✅ Design system padronizado
- ✅ Cor primária alterada para roxo (#7c3aed)
- ✅ Sistema de espaçamento completo
- ✅ Responsividade mobile-first
- ✅ 15+ classes utilitárias criadas
- ✅ Documentação completa criada

---

## 📊 Estatísticas da Documentação

| Tipo                     | Quantidade | Tamanho Total |
| ------------------------ | ---------- | ------------- |
| Documentos Markdown      | 8          | ~40 KB        |
| Exemplos de Código       | 1          | ~15 KB        |
| Specs OpenAPI            | 1          | -             |
| Componentes Documentados | 50+        | -             |
| Classes Utilitárias      | 15+        | -             |

---

## 🆘 Precisa de Ajuda?

### Dúvidas sobre UI/Layout?

- 📖 Consulte [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- 💻 Veja o exemplo educacional em [EXEMPLO_PAGINA_RESPONSIVA.tsx](./EXEMPLO_PAGINA_RESPONSIVA.tsx)
- ⭐ FAQ em [UI_LAYOUT_README.md](./UI_LAYOUT_README.md)

### Dúvidas sobre API?

- 📖 Consulte [docs/API_README.md](./docs/API_README.md)
- 📖 Referência rápida em [docs/API_QUICK_REFERENCE.md](./docs/API_QUICK_REFERENCE.md)

### Dúvidas sobre Segurança?

- 📖 Consulte [SECURITY.md](./SECURITY.md)
- 📖 CSRF em [CSRF_SECURITY.md](./CSRF_SECURITY.md)

---

## 📝 Convenções de Nomenclatura

### Documentos

- `README.md` - Documentação principal de entrada
- `*_README.md` - Documentação específica de módulo
- `DESIGN_SYSTEM.md` - Sistema de design
- `IMPLEMENTACAO_*.md` - Detalhes de implementação
- `EXEMPLO_*.tsx` - Exemplos de código
- `docs/*.md` - Documentação técnica detalhada

### Emojis Usados

- ⭐ Importante/Recomendado
- ✅ Concluído/Disponível
- 📖 Documentação
- 💻 Código/Exemplo
- 📋 Lista/Detalhamento
- 🎨 Design/Estilo
- 📱 Mobile/Responsivo
- 🔒 Segurança
- 🔧 API/Backend
- 🆘 Ajuda/Suporte

---

## 🎯 Próximos Passos

1. Manter documentação atualizada
2. Adicionar exemplos conforme novos componentes
3. Expandir FAQ com dúvidas comuns
4. Criar tutoriais em vídeo (futuro)
5. Traduzir documentação (futuro)

---

**Última atualização**: 2025-12-17
**Versão**: 1.0.0
**Mantido por**: Time de Desenvolvimento ZippiCRM
