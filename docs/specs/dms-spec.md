# Especificação - Document Management System 

## 1. Objetivo

Disponibilizar uma aplicação web para que usuários enviem, consultem e baixem seus documentos, armazenando os arquivos no filesystem local e mantendo os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário identificado na requisição.
- Download de um documento pelo identificador, somente pelo usuário proprietário.
- Exibição de estados de carregamento, sucesso e erro na interface.
- Armazenamento local dos arquivos e armazenamento em memória dos metadados.
- Comunicação do frontend com o backend por meio do prefixo `/api` no ambiente de desenvolvimento.

### Fora do escopo

- Armazenamento externo, em nuvem ou em serviços de terceiros.
- Banco de dados ou persistência de metadados entre reinicializações.
- Versionamento, edição, exclusão, compartilhamento ou busca avançada de documentos.
- Autenticação, autorização baseada em papéis ou gestão de contas.
- Upload de múltiplos arquivos em uma única requisição.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento por `multipart/form-data`, usando o campo `file`. | Uma requisição válida cria um arquivo em armazenamento local e retorna seus metadados com status `201`. |
| RF-02 | O sistema associa cada documento ao usuário informado na requisição. | O identificador do usuário é validado e armazenado como `owner`; não é aceito vazio ou ausente. |
| RF-03 | O usuário pode listar seus documentos. | A resposta contém somente documentos cujo `owner` corresponde ao usuário da requisição; lista vazia é retornada como `[]`. |
| RF-04 | O usuário pode baixar um documento pelo identificador. | Um documento próprio existente é enviado como conteúdo binário para download com o nome original. |
| RF-05 | O sistema rejeita upload sem arquivo, arquivo vazio ou que ultrapasse o limite configurado. | A API responde com erro JSON e status apropriado, sem registrar metadados para o upload rejeitado. |
| RF-06 | O sistema trata identificador inválido, documento inexistente e documento de outro usuário sem expor o arquivo. | A API retorna `404` para documento inexistente ou não pertencente ao usuário. |
| RF-07 | A interface permite selecionar e enviar um documento, visualizar a lista do usuário e iniciar o download de um item. | A interface comunica carregamento e erros sem bloquear permanentemente as demais ações. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local, usando `multer` com `diskStorage`, sob `backend/storage` por padrão. |
| RNF-02 | Os metadados ficam em memória nesta fase; reiniciar o backend limpa os metadados e pode deixar arquivos sem registro no diretório de armazenamento. |
| RNF-03 | Configurações operacionais são obtidas por variáveis de ambiente, com valores padrão documentados. |
| RNF-04 | O nome físico do arquivo é gerado pelo servidor e não deriva diretamente do nome enviado pelo cliente. O nome original é mantido somente como metadado e nome de download. |
| RNF-05 | Nenhum caminho físico interno do servidor é exposto nas respostas da API. |
| RNF-06 | Erros de entrada e falhas esperadas são tratados nos limites HTTP e respondidos em JSON; detalhes internos e caminhos locais não são enviados ao cliente. |
| RNF-07 | As camadas internas do backend não dependem do Express nem conhecem detalhes de transporte HTTP. |
| RNF-08 | O armazenamento é local e adequado ao escopo inicial; não há garantia de durabilidade dos metadados, alta disponibilidade ou isolamento seguro de usuários sem autenticação. |

### Configuração

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local para gravação dos arquivos. Caminhos relativos devem ser resolvidos de forma previsível pelo backend. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo por arquivo, em bytes (10 MiB). |

## 5. Modelo de dados

### Metadados do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string (UUID) | Sim | Identificador público e único do documento. |
| `originalName` | string | Sim | Nome do arquivo informado pelo cliente, preservado para exibição e download. |
| `size` | number (inteiro) | Sim | Tamanho do arquivo em bytes; deve ser maior que zero. |
| `uploadedAt` | string (ISO 8601 UTC) | Sim | Data e hora em que o upload foi concluído e registrado. |
| `owner` | string | Sim | Identificador do usuário associado ao documento. |

O repositório também mantém a localização física do arquivo para uso interno. Esse dado não faz parte do objeto público retornado pela API. O nome físico deve ser gerado pelo servidor, por exemplo a partir do UUID, sem reutilizar diretamente o nome original.

### Identificação do usuário nesta fase

As rotas recebem o cabeçalho `X-User-Id`, cujo valor não pode ser vazio. Esse cabeçalho serve apenas como identidade de demonstração para associar e filtrar documentos; não comprova a identidade do chamador e não substitui autenticação. A aplicação não deve ser considerada segura para usuários não confiáveis enquanto não houver um mecanismo de autenticação.

## 6. Contratos de API

Os caminhos públicos usados pelo frontend incluem `/api`. O proxy do Vite encaminha `/api/*` para o backend local removendo esse prefixo; portanto, as rotas Express correspondem a `/upload`, `/documents` e `/documents/:id/download`.

### Formato de erro

Todas as respostas de erro da API seguem o formato:

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "O arquivo excede o limite permitido."
  }
}
```

`code` é estável para tratamento pelo frontend. `message` é uma descrição segura para exibição. Respostas de erro não incluem stack trace, caminhos locais ou dados de outros usuários.

### `POST /api/upload`

- Backend: `POST /upload`.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
- Requisição: `multipart/form-data`, com exatamente um arquivo no campo `file`.
- Limite: `MAX_FILE_SIZE_BYTES`; arquivos vazios não são aceitos.
- Sucesso: `201 Created`, `Content-Type: application/json`.

```json
{
  "id": "2dd2fc4c-341d-4ead-8b6a-efea562ec756",
  "originalName": "relatorio.pdf",
  "size": 48213,
  "uploadedAt": "2026-10-26T12:00:00.000Z",
  "owner": "usuario-123"
}
```

Erros esperados: `400 BAD_REQUEST` para cabeçalho ou arquivo ausente/inválido; `413 FILE_TOO_LARGE` para arquivo acima do limite; `500 INTERNAL_ERROR` para falha inesperada de gravação. Um upload sem sucesso não deve criar metadados; se a gravação parcial deixar um arquivo, a camada de persistência deve removê-lo quando possível.

### `GET /api/documents`

- Backend: `GET /documents`.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`, `Content-Type: application/json`.
- Retorno: array de metadados pertencentes ao usuário, sem caminho físico.
- Ordenação: mais recentes primeiro; em empate, ordem determinística por identificador.

```json
[
  {
    "id": "2dd2fc4c-341d-4ead-8b6a-efea562ec756",
    "originalName": "relatorio.pdf",
    "size": 48213,
    "uploadedAt": "2026-10-26T12:00:00.000Z",
    "owner": "usuario-123"
  }
]
```

Se não houver documentos, retorna `200 OK` com `[]`. Cabeçalho ausente ou inválido retorna `400 BAD_REQUEST`; falha inesperada retorna `500 INTERNAL_ERROR`.

### `GET /api/documents/:id/download`

- Backend: `GET /documents/:id/download`.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`, com bytes do arquivo, `Content-Type` apropriado ou `application/octet-stream` como fallback, e `Content-Disposition: attachment` com o nome original devidamente codificado.
- A resposta não inclui metadados JSON nem caminho físico.
- ID inexistente, inválido, de outro usuário ou cujo arquivo não esteja disponível retorna `404 NOT_FOUND` sem revelar qual condição ocorreu.
- Cabeçalho ausente ou inválido retorna `400 BAD_REQUEST`; falha inesperada de leitura retorna `500 INTERNAL_ERROR`.

### Códigos de erro

| Status | `code` | Uso |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Cabeçalho de usuário ausente/inválido, arquivo ausente, arquivo vazio ou requisição multipart inválida. |
| `404` | `NOT_FOUND` | Documento não encontrado, não pertencente ao usuário ou arquivo local indisponível. |
| `413` | `FILE_TOO_LARGE` | Upload acima de `MAX_FILE_SIZE_BYTES`. |
| `500` | `INTERNAL_ERROR` | Falha inesperada de armazenamento, leitura ou processamento. |

## 7. Decisões arquiteturais

### Backend

O backend usa Node.js, Express e CommonJS, organizado em quatro camadas com dependências apontando para dentro:

1. `routes/`: registra os caminhos HTTP e conecta middlewares/controllers.
2. `controllers/`: valida dados de transporte, lê cabeçalhos/parâmetros e traduz resultados para respostas HTTP.
3. `services/`: implementa as regras de upload, associação ao usuário, listagem e autorização para download.
4. `repositories/`: mantém metadados em memória e interage com o filesystem local. A configuração do `multer` com `diskStorage` pertence à borda de entrada/infraestrutura e deve gravar no diretório configurado.

Fluxo esperado: `routes -> controllers -> services -> repositories`. Regras de negócio não dependem de Express. Erros do Multer e do filesystem são convertidos para os contratos HTTP nos limites externos.

### Frontend

O frontend usa React com componentes funcionais e Hooks. A estrutura segue `components/`, `pages/` e `services/`; o serviço de API usa `fetch` com o prefixo `/api`. A interface contempla upload, lista e ação de download, apresentando falhas recebidas da API.

### Armazenamento e identidade

- Arquivos são persistidos apenas localmente com `multer` e `diskStorage`; nenhum provedor externo é permitido.
- Metadados ficam em memória nesta fase e são perdidos ao reiniciar o backend.
- O proprietário é derivado de `X-User-Id` em todas as operações. A listagem filtra por proprietário e o download valida propriedade antes de acessar o arquivo.
- Como não há autenticação no escopo, `X-User-Id` é adequado somente a uma demonstração controlada. A implantação para usuários reais depende de autenticação confiável.

## 8. Plano de execução

As etapas abaixo orientam uma implementação futura; esta especificação não implementa nem altera arquivos de backend ou frontend.

1. Definir e validar a configuração do backend, o diretório local, o limite de upload e a estratégia de identidade de demonstração.
2. Implementar o repositório de metadados em memória e o acesso controlado aos arquivos locais.
3. Implementar os serviços de upload, listagem por usuário e obtenção de documento para download.
4. Implementar controllers, rotas Express e tratamento uniforme de erros, incluindo a integração com `multer` `diskStorage`.
5. Criar testes backend para contratos de sucesso e falha, isolamento por usuário, limites de upload, arquivo local e reinicialização dos metadados.
6. Implementar no frontend o serviço `fetch`, o fluxo de upload, a listagem e o download com estados de carregamento e erro.
7. Validar a integração via proxy `/api`, executar testes/build disponíveis e revisar a documentação de configuração e limitações de segurança.

## 9. Premissas e limitações

- O `X-User-Id` é um identificador fornecido pelo cliente e, sem autenticação, pode ser falsificado; isolamento por usuário é uma regra funcional de demonstração, não uma fronteira de segurança de produção.
- O diretório local deve existir ou ser criado pela aplicação com permissões adequadas. A aplicação não deve aceitar do cliente nomes de caminho para determinar onde gravar ou ler arquivos.
- Metadados e arquivos não têm ciclo de limpeza automático. Reinicializações podem deixar arquivos órfãos; essa limitação é aceita na fase inicial.
- Tipos de arquivo não são restringidos nesta especificação; o limite de tamanho é obrigatório e pode ser ajustado por configuração.