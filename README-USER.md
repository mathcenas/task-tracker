# TaskTracker Pro — Guia do Utilizador

> **by Cenas-Support** — Gestao de tarefas e relatorios para servicos de IT

---

## O que e o TaskTracker Pro?

E uma aplicacao web para gerir o trabalho diario com clientes de IT. Permite registar incidentes, pedidos e compras, acompanhar o tempo gasto, gerar relatorios em PDF e partilhar uma pagina de estado publica com cada cliente.

Tudo fica guardado num servidor proprio — nao ha dependencia de servicos externos.

---

## Acesso

Abrir no browser: `http://localhost:3000`

**Credenciais padrao:**

| Utilizador | Password | Nivel |
|-----------|----------|-------|
| `admin` | `TaskTracker2025!` | Administrador |
| `user` | `User2025!` | Utilizador |

> Recomenda-se mudar as passwords apos o primeiro acesso (icone de utilizador no canto superior direito).

---

## Primeiros Passos

### 1. Configurar a Empresa

Ir a **Definicoes → Configuracoes da Empresa** e preencher:
- Nome da empresa
- Logo (carrega uma imagem — fica guardada no sistema)
- Morada, telefone, email, website

Esta informacao aparece no cabecalho de todos os PDFs e relatorios.

---

### 2. Adicionar Clientes

Ir a **Clientes → Add New Client** e preencher:
- Nome do cliente
- Email
- **Taxa horaria** (usada nos calculos de faturacao)

Cada cliente recebe automaticamente um URL unico para ver os seus relatorios mensais sem login:
```
http://localhost:3000/report/nome-do-cliente/2025/7
```

**Tarifas anuais:** E possivel definir taxas horarias diferentes por ano. Assim, relatorios de anos anteriores usam o valor correto da epoca.

---

### 3. Criar Projetos

Dentro de cada cliente, os projetos organizam o trabalho. Um cliente pode ter varios projetos ativos em simultaneo (ex: "Suporte Geral", "Migração Cloud", "Website").

---

### 4. Registar Tarefas

Clicar em **New Task** (barra lateral) ou no botao flutuante `+` (canto inferior direito).

**Tipos de tarefa:**

| Tipo | Para que serve |
|------|---------------|
| **Incidente** | Problemas urgentes — servidor em baixo, falha critica |
| **Pedido** | Trabalho planeado — atualizacoes, configuracoes, consultorias |
| **Insumos** | Compras e materiais — hardware, licencas, subscricoes |

**Estado de uma tarefa:**
- `Nao Iniciado` → `Em Progresso` → `Revisao` → `Concluido`

**Prioridade:** Alta / Media / Baixa

**Horas:** Podem ser preenchidas ao criar a tarefa, ou depois quando for concluida.

---

## Vistas Principais

### Work Queue (Pagina Inicial)
Lista de todas as tarefas por fazer, ordenada por prioridade e data. Mostra tarefas em atraso a vermelho.

Funcionalidades:
- **Temporizador** — iniciar cronometro numa tarefa e parar quando terminar
- **Marcar como concluida** — abre janela para registar as horas
- **Ciclar estado** — botao `···` para mudar rapidamente entre estados

---

### Weekly / 15 Dias / Monthly
Vistas por periodo temporal. Mostram tarefas concluidas, horas totais e receita do periodo.

---

### Overview (Visao Geral)
Painel executivo com:
- Receita liquida dos ultimos 3 ou 6 meses
- Grafico de barras mensal (servicos vs. insumos)
- Breakdown por cliente
- Alertas de trabalho nao faturado

---

### Kanban
Quadro visual com colunas: Nao Iniciado / Em Progresso / Revisao / Concluido.
Arrastar tarefas entre colunas para mudar o estado.

---

### Ideas Board
Mostra todas as tarefas em atraso ou em progresso num formato de cartoes. Util para brainstorming e planear o proximo trabalho. Permite adicionar notas a cada tarefa.

---

### All Tasks (Todas as Tarefas)
Lista completa com filtros avancados:
- Por cliente, projeto, tipo, prioridade, estado
- Vista de **duplicados** — agrupa tarefas com descricoes identicas para detetar erros de faturacao
- **Operacoes em massa** — selecionar multiplas tarefas para editar, completar, reagendar ou eliminar

---

## Insumos e Pagamentos

### Pagina de Insumos
Registo de todas as compras com:
- Vendedor, referencia de fatura/recibo
- Aprovador (quem autorizou a compra)
- Estado de aprovacao: Pendente / Aprovado / Rejeitado
- Custo fixo mensal (subscricoes recorrentes)

Painel analitico mostra custo do mes atual vs. mes anterior, breakdown por cliente e grafico dos ultimos 6 meses.

### Payment Tracker
Acompanha o ciclo de faturacao de cada insumo:
```
Nao Faturado → Faturado (+ n.º fatura) → Pago
```

---

## Tarefas Recorrentes

Ir a **Recurring Tasks** para configurar tarefas que se repetem todos os meses automaticamente.

Opcoes de agendamento:
- **Dia do mes** — ex: dia 1, dia 15, dia 28
- **Weekend do mes** — ex: primeiro sabado, ultimo domingo

Cada definicao tem:
- Data de inicio (opcional) — backfill automatico dos meses em falta
- Data de fim (opcional) — para quando a tarefa expira

Quando abrir o gestor de tarefas recorrentes, as que estiverem em atraso sao geradas automaticamente e aparecem nas dashboards.

---

## Relatorios

Ir a **Reports** para gerar relatorios em multiplos formatos.

### Como gerar um relatorio
1. Selecionar o cliente
2. Escolher o tipo: **Mensal**, **Multi-mes** ou **Por Projeto**
3. Configurar o periodo
4. Clicar em **Download PDF** ou **Download Markdown**

O preview mostra em tempo real: numero de tarefas, horas, receita de servicos e custo de insumos.

### PDF
Inclui:
- Cabecalho com logo e dados da empresa
- Tabela de servicos (com horas e valor)
- Tabela de insumos
- Breakdown por tipo (incidentes vs. pedidos)
- Totais finais

### Markdown (para analise por IA)
O formato Markdown inclui uma secao de **detetor de duplicados** que agrupa tarefas com a mesma descricao. Util para:
- Pedir a uma IA que reveja e limpe o relatorio
- Depois reimportar o relatorio editado com o botao **Import Edited Markdown**

### Relatorio Publico do Cliente
Cada cliente pode ver o seu relatorio mensal sem login, atraves de um URL unico:
```
http://seudominio.com/report/nome-cliente/2025/7
```
O cliente ve as tarefas concluidas, horas, custos e o historico dos ultimos 6 meses com grafico interativo.

---

## Orcamentos

Ir a **Quotes** para criar orcamentos profissionais.

**Tipos:**
- **Standard** — com precos, quantidades e totais
- **BOM (Bill of Materials)** — lista de materiais sem precos (para aprovar antes de comprar)

Cada orcamento tem estados: Rascunho / Enviado / Aceite / Rejeitado / Expirado

Exportavel para PDF com logo e dados da empresa.

---

## Integrações

### Uptime Kuma
Liga o TaskTracker ao Uptime Kuma (ferramenta de monitorização de servidores). Quando um monitor vai a baixo, cria automaticamente um incidente de alta prioridade.

Configurar em: **Integracoes → Monitors** e **Integracoes → Status Pages**

### Paginas de Estado Publicas
Criar paginas de estado publicas para partilhar com clientes:
```
http://seudominio.com/status/nome-empresa
```
Mostra estado em tempo real dos servicos monitorizados pelo Uptime Kuma.

---

## Importar Dados

### Importar CSV (formato Kimai)
**Ferramentas → Import CSV**

Suporta o formato de exportacao do Kimai (software de time tracking). Mapa de tipos:
- `Incidentes IT` → Incidente
- `Solicitudes IT` / `Gestión de Servicios IT` → Pedido
- `Adquisiciones` → Insumos

Antes de importar, e possivel editar cada linha (tipo, horas, custo, descricao).

### Importar Backup JSON
**Ferramentas → Import JSON**

Restaura um backup completo (clientes, projetos, tarefas, recorrentes, templates).

---

## Backup e Restauro

### Automatico
O sistema cria um backup diario automaticamente as 2h00 da manha (em Docker). Guarda os ultimos 7 backups em `/app/data/backups/`.

### Manual
Na barra lateral (parte inferior):
- **Download Backup** — exporta tudo para um ficheiro `.json`
- **Import Backup** — restaura a partir de um ficheiro `.json`

---

## Definicoes de Conta

Clicar no avatar no canto superior direito para:
- Ver informacao do utilizador
- Mudar a password
- Terminar sessao

---

## Atalhos de Teclado

| Atalho | Acao |
|--------|------|
| `Ctrl + K` (ou `Cmd + K`) | Abrir janela de criacao rapida de tarefa |
| `Esc` | Fechar janela aberta |

---

## Log de Atividade

Em **Activity Log** e possivel ver um historico de todas as acoes realizadas: tarefas criadas, atualizadas, eliminadas, clientes adicionados, etc.

Clicar numa entrada para navegar diretamente para o registo em questao.

---

## Perguntas Frequentes

**A tarefa esta marcada como concluida mas nao aparece no relatorio mensal.**
Verificar se a data da tarefa esta dentro do mes correto. O relatorio filtra por data da tarefa, nao por data de conclusao.

**Como partilhar o relatorio com o cliente sem dar acesso ao sistema?**
Usar o URL publico: `http://localhost:3000/report/slug-do-cliente/ano/mes`. O cliente ve apenas os dados dele, sem login.

**As tarefas recorrentes nao aparecem.**
Abrir **Recurring Tasks** — a abertura da pagina/modal desencadeia a geracao automatica das tarefas em atraso.

**Como saber se ha trabalho por faturar?**
Ir a **Overview** — a secao "Unbilled Work" mostra tarefas concluidas que ainda nao foram marcadas como faturadas, agrupadas por cliente.

**O PDF nao tem logo da empresa.**
Ir a **Definicoes → Configuracoes da Empresa** e carregar a imagem. Usar PNG ou JPG. Depois de guardar, o logo aparece em todos os PDFs novos.

---

*TaskTracker Pro by Cenas-Support — 2025/2026*
