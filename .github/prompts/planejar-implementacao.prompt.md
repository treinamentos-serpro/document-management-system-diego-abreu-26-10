---
description: Cria um plano de implementação baseado na demanda, nas especificações e no codebase atual.
name: planejar-implementacao
argument-hint: descreva a demanda e, se houver, informe o caminho da especificação
agent: plan
---

# Planejar implementação

Crie um plano de implementação para a demanda abaixo:

`${input:demanda:descreva a funcionalidade ou correção}`

Especificação relacionada (opcional):

`${input:especificacao:caminho da especificação, se houver}`

## Preparação

1. Leia `.github/copilot-instructions.md` e a especificação informada, se existir.
2. Consulte especificações e documentação relacionadas em `docs/`.
3. Inspecione os arquivos de código e testes relevantes para entender o comportamento atual e seguir os padrões existentes.
4. Verifique scripts e comandos de validação nos `package.json` envolvidos, quando aplicável.

## Diretrizes

- Planeje mudanças compatíveis com a arquitetura e as convenções já adotadas no projeto.
- Separe fatos observados, decisões propostas, premissas e dúvidas; não invente requisitos nem apresente o comportamento desejado como já implementado.
- Inclua somente as áreas afetadas pela demanda. Considere backend, frontend, API, persistência, configuração, documentação e testes quando forem pertinentes.
- Ordene as etapas pelas dependências reais entre elas e indique os arquivos ou componentes que provavelmente precisarão ser alterados, com base no codebase.
- Inclua testes e comandos de validação que verifiquem os critérios de aceite, priorizando os comandos já existentes no projeto.
- Aponte riscos, compatibilidade e casos de erro relevantes. Não proponha serviços externos ou novas dependências sem necessidade justificada.
- Não edite arquivos, não implemente mudanças e não execute comandos que alterem o projeto. Entregue o plano nesta conversa.

## Formato da resposta

### Objetivo
Resuma o resultado esperado.

### Contexto atual
Registre os fatos relevantes encontrados no codebase e nas especificações, com referências aos arquivos.

### Escopo
Liste o que será alterado e o que ficará explicitamente fora do plano, quando isso ajudar a evitar ambiguidades.

### Etapas de implementação
Apresente uma lista numerada e ordenada. Para cada etapa, informe:

- resultado esperado;
- arquivos ou componentes envolvidos;
- dependências de etapas anteriores, se houver.

### Testes e validação
Associe os testes e comandos existentes aos requisitos ou critérios que verificam. Indique lacunas de cobertura relevantes.

### Riscos, premissas e dúvidas
Separe riscos técnicos, premissas adotadas e perguntas que precisam de resposta. Não transforme dúvidas bloqueadoras em decisões implícitas.

### Critérios de conclusão
Liste resultados observáveis e verificáveis para considerar a implementação concluída.
