# Scrum Kanban — FYNEX

Quadro curto para acompanhar entregas em ciclos pequenos. Cada item só entra em **Concluído** depois de passar por teste local e validação de banco quando aplicável.

## Backlog

- [ ] Biblioteca privada de ícones por comunidade com fallback e versionamento
- [ ] Testes automatizados de permissões de cargos e moderação
- [ ] Cobertura E2E de convite, entrada e saída de comunidade
- [ ] Auditoria de ações administrativas

## Próximo sprint

- [ ] Testar o fluxo completo em mobile e desktop na produção
- [ ] Criar estados vazios e mensagens de erro específicas por ação
- [ ] Adicionar paginação ao histórico de mensagens
- [ ] Medir acessibilidade do teclado e contraste

## Em validação

- [x] Retorno do login ao convite e abertura direta do primeiro canal da comunidade
- [x] URL sincronizada na navegação e congelada enquanto houver chamada ativa
- [x] Ícones de cargo ao lado do nick no chat, membros e perfil
- [x] Tags por comunidade e tag escolhida pelo próprio membro
- [x] Atribuição e remoção de cargos no menu de membro
- [x] Biblioteca compartilhada de emojis no chat e nas reações
- [x] Painel compacto de tags e figurinhas

## Concluído

- [x] Upload de ícones PNG/SVG por comunidade com validação no servidor, RLS, cota de 20 e remoção segura
- [x] Biblioteca inicial controlada com dez ícones seguros para cargos
- [x] Padrão visual neutro unificado em membros, cargos e configurações
- [x] Cor de destaque do perfil aplicada com mais presença no cartão
- [x] Corrigido bloqueio de envio de mensagens pela validação do banco
- [x] Corrigida criação dos canais padrão de novas comunidades
- [x] Corrigida troca de comunidade sem manter membros e mensagens antigas
- [x] Comunidade `FYNEX Testes` criada para validações seguras
- [x] Envio, leitura e reação a mensagem validados no canal de teste
- [x] Indicadores de reconexão do chat e da chamada
- [x] Aviso de entrada na comunidade no canal geral, em tempo real

## Critérios de pronto

1. A interface apresenta o estado correto sem recarregar a página.
2. As permissões são aplicadas no banco, não apenas escondidas na tela.
3. O fluxo principal funciona em uma sessão autenticada real.
4. TypeScript e build de produção terminam sem erros.
5. A versão publicada passa por uma verificação visual básica.
