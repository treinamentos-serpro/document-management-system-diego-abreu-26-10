# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey DiegoMesquitaAbreu!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-diego-abreu-26-10/issues/1)

---

## Backend do DMS

Execute `npm start` em `backend` (porta padrão `3000`) e `npm test` para rodar
os testes com o runner nativo do Node.js.

As camadas em `backend/src` seguem o fluxo
`routes -> controllers -> services -> repositories`. Os arquivos são gravados
localmente com Multer `diskStorage`; os metadados ficam em memória.

| Rota | Entrada | Sucesso |
| --- | --- | --- |
| `POST /upload` | `multipart/form-data`, um arquivo no campo `file` | `201`, metadados do documento |
| `GET /documents` | Cabeçalho de usuário | `200`, documentos do proprietário, mais recentes primeiro |
| `GET /documents/:id/download` | Cabeçalho de usuário e ID do documento | `200`, arquivo com nome original |
| `GET /health` | Sem cabeçalho obrigatório | `200`, `{"status":"ok"}` |

As três rotas de documentos exigem `X-User-Id`. Exemplo:

```sh
curl -H 'X-User-Id: usuario-123' -F 'file=@relatorio.pdf' http://localhost:3000/upload
curl -H 'X-User-Id: usuario-123' http://localhost:3000/documents
curl -H 'X-User-Id: usuario-123' -OJ http://localhost:3000/documents/ID/download
```

Metadados públicos: `id`, `originalName`, `size`, `uploadedAt` e `owner`.
Erros seguem `{"error":{"code":"BAD_REQUEST","message":"..."}}`, com status
`400` (entrada inválida), `404` (documento indisponível ou de outro usuário),
`413` (limite excedido) ou `500` (falha interna).

Configuração por variáveis de ambiente:

- `PORT`: `3000`.
- `STORAGE_DIR`: `storage`, resolvido a partir de `backend` (padrão:
  `backend/storage`); caminhos absolutos locais também são aceitos.
- `MAX_FILE_SIZE_BYTES`: inteiro positivo, padrão `10485760` (10 MiB).
  O limite é inclusivo e arquivos vazios são rejeitados.

O diretório é criado automaticamente no primeiro upload. Reiniciar o backend
perde os metadados, mas não remove arquivos já gravados. `X-User-Id` é somente
uma identidade de demonstração, **não autenticação**.

O frontend usa `/api`, removido pelo proxy do Vite antes de chegar ao backend.
Consulte o contrato completo em [Especificação do DMS](docs/specs/dms-spec.md).

## Frontend do DMS

Com o backend em execução, rode `npm run dev` em `frontend` e abra
`http://localhost:5173`. Se necessário, instale antes as dependências com
`npm install` em cada projeto.

Informe um identificador de usuário e clique em **Carregar documentos**.
Selecione um arquivo e clique em **Enviar**; a lista é atualizada após o upload.
Use **Baixar** para receber um documento com seu nome original ou **Atualizar
lista** para consultar novamente. A interface informa carregamento, sucesso e
erros; o limite de tamanho é validado pelo backend conforme sua configuração.

O cliente em `frontend/src/services/api.js` centraliza as chamadas `fetch` com
prefixo `/api` e o cabeçalho `X-User-Id`, inclusive no download binário.
Trocar o identificador carrega outra lista, sem autenticar o usuário.
O proxy do Vite já encaminha as chamadas para `http://localhost:3000`.
Em produção, configure um proxy equivalente para `/api` no servidor da aplicação.

Valide com `npm test` (cliente de API) e `npm run build` em `frontend`.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
