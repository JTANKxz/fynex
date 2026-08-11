# FYNEX

FYNEX é uma plataforma web de comunidades com chat, voz P2P e transmissão de tela. O projeto está saindo da fase de protótipo e agora usa contas reais, perfis persistentes e políticas de acesso no banco.

## O que já funciona

- cadastro com nome, usuário, e-mail e senha;
- login automático logo após o cadastro;
- confirmação de e-mail temporariamente desativada durante o MVP;
- login, logout, renovação de sessão e rotas protegidas;
- perfil em tela ampla com nome público, `@username`, biografia e card personalizável;
- edição de perfil em modal separado da visualização;
- comunidades persistentes com isolamento por membros;
- canais de texto e voz criados por comunidade;
- chat persistente e em tempo real por canal;
- envio de uma imagem ou vídeo por mensagem, com prévia e progresso de upload;
- presença online separada por comunidade;
- sala de voz WebRTC P2P, seleção de microfone, mute e deafen;
- supressão de ruído, cancelamento de eco e ganho automático do navegador;
- transmissão de tela 720p/30 fps sob demanda, também P2P;
- interface responsiva AMOLED preta com violeta.

## Arquitetura

```text
Navegador (Next.js)
├── Interface: app/, components/, features/
├── Sessão segura: cookies SSR do Supabase
├── Chat/presença/sinalização: Supabase Realtime
├── Fotos e vídeos do chat: upload direto ao ImageKit
└── Áudio/tela: WebRTC P2P (a mídia não passa pela Vercel)
          │
          ├── Supabase Auth
          └── PostgreSQL + RLS
```

Separação principal:

- `app/`: páginas, rotas e Server Actions;
- `components/`: componentes reutilizáveis de autenticação, perfil e comunidades;
- `features/community/`: modelo e componentes próprios do chat/voz;
- `lib/auth/`: validação de dados com Zod;
- `lib/supabase/`: clientes browser/servidor, tipos e renovação de sessão;
- `supabase/migrations/`: esquema versionado, índices, gatilhos e RLS;
- `public/`: recursos estáticos e sons.

## Segurança

- a senha nunca é armazenada no código ou no PostgreSQL público;
- o Supabase Auth faz hash e gerenciamento de credenciais;
- o servidor valida a identidade com `getClaims()`, sem confiar em estado do navegador;
- cookies de sessão são renovados no `proxy.ts`;
- tabelas públicas usam Row Level Security;
- `anon` não pode ler nem escrever perfis, comunidades, canais ou mensagens;
- membros só podem consultar comunidades, canais e mensagens dos espaços aos quais pertencem;
- apenas o dono pode alterar ou excluir a comunidade e administrar seus canais;
- mensagens só podem ser criadas, alteradas ou excluídas pelo próprio autor;
- anexos usam token curto, pasta vinculada ao usuário e verificação posterior pela API do ImageKit;
- imagens aceitas: JPG, PNG, WebP e GIF até 8 MB; vídeos: MP4, WebM e MOV até 20 MB;
- perfis só podem ser alterados pelo dono;
- entradas são validadas no servidor e novamente por constraints no banco;
- `.env.local` é ignorado pelo Git. Nunca publique chaves privadas ou a senha do banco.

A publishable key do Supabase pode existir no frontend; a proteção real é feita por autenticação, RLS e privilégios. Uma `service_role` jamais deve ser exposta ao navegador.

## Sessão

O access token padrão dura cerca de uma hora e é renovado por um refresh token rotativo. O objetivo de produto é manter a sessão por até **30 dias**. A limitação máxima precisa ser habilitada no painel do Supabase em **Authentication → Sessions → Time-box user sessions** (recurso dependente do plano). Sem essa opção, a sessão permanece renovável até logout, revogação ou expiração por inatividade configurada no projeto.

## Configuração local

Requisitos: Node.js 22.13+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local
npm run dev
```

No Windows, copie `.env.example` manualmente. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/seu_id
IMAGEKIT_PUBLIC_KEY=public_sua_chave
IMAGEKIT_PRIVATE_KEY=private_sua_chave
```

No Supabase, adicione as URLs local e de produção em **Authentication → URL Configuration**. Para produção, configure `NEXT_PUBLIC_SITE_URL` com o domínio HTTPS real.

As três variáveis do ImageKit habilitam avatar, banner e anexos do chat. `IMAGEKIT_PRIVATE_KEY` é exclusiva do servidor e nunca deve receber o prefixo `NEXT_PUBLIC_`. O navegador envia o arquivo diretamente ao ImageKit usando um token curto e assinado; o conteúdo do arquivo não atravessa a Vercel. A Server Action confere o arquivo no ImageKit antes de salvar seus metadados no Supabase.

## Banco de dados

A migração atual cria `profiles`, `communities`, `community_members`, `channels` e `messages`, além dos índices, gatilhos e políticas RLS. Cada conta recebe uma comunidade inicial com um canal de texto e outro de voz. Para um projeto novo, aplique os arquivos de `supabase/migrations` em ordem usando a CLI do Supabase.

O esquema do protótipo anônimo foi substituído intencionalmente. Dados de teste antigos não são compatíveis com a versão autenticada.

## Comandos

```bash
npm run dev       # desenvolvimento
npm run lint      # análise estática
npm run build     # build de produção
npm test          # lint + build
```

## Deploy na Vercel

O framework deve permanecer como Next.js e o diretório de saída deve ficar vazio/automático. Cadastre as variáveis do Supabase, do site e do ImageKit. A Vercel entrega a aplicação, a assinatura temporária do upload e as Server Actions; imagens e vídeos seguem diretamente do navegador ao ImageKit. Áudio e tela continuam no WebRTC entre navegadores. Supabase transporta autenticação, dados, metadados dos anexos, presença e sinalização.

## Limites atuais

O P2P é econômico para o servidor, mas cada participante envia uma cópia da mídia para cada pessoa conectada. É adequado para salas pequenas. Antes de abrir salas grandes, será necessário adicionar TURN para redes restritivas e migrar mídia para uma SFU com bitrate adaptativo. Consulte [ROADMAP.md](./ROADMAP.md).

A direção da mistura entre comunidades, grupos e mensagens está documentada em [PRODUCT-DIRECTION.md](./PRODUCT-DIRECTION.md).

## Licença

Projeto privado em desenvolvimento. Nenhuma licença de redistribuição foi definida.
