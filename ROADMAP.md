# Roadmap do FYNEX

Este quadro orienta o desenvolvimento sem transformar o MVP em um clone completo do Discord.

## Feito

- [x] Identidade visual AMOLED preta + violeta
- [x] Supabase Auth com cadastro, login automático e logout
- [x] Perfil criado automaticamente ao cadastrar
- [x] Perfil amplo com edição em modal e card personalizável
- [x] RLS e privilégios mínimos para perfis, comunidades, canais e mensagens
- [x] Criação e troca de comunidades
- [x] Canais de texto e voz por comunidade
- [x] Chat autenticado em tempo real por canal
- [x] Presença online isolada por comunidade
- [x] Voz WebRTC P2P e seleção de microfone
- [x] Tela 720p/30 fps sob demanda
- [x] Sons distintos de envio e recebimento
- [x] Layout móvel com menu fechável

## Fazendo agora

- [ ] Testes end-to-end de cadastro → perfil → chat em produção
- [ ] Terminar a divisão do orquestrador de voz/tela em hooks menores
- [ ] Telemetria de conexão WebRTC (`getStats`) e indicador de qualidade
- [ ] Tratamento visual de reconexão e sessão expirada

## Próximo

- [ ] Avatar com Supabase Storage e políticas por usuário
- [ ] Recuperação e alteração de senha
- [ ] Exclusão de conta e exportação dos dados
- [ ] Editar/excluir mensagens próprias na interface
- [ ] Convites, grupos privados, funções e permissões avançadas
- [ ] TURN com credenciais temporárias
- [ ] Limites de tamanho de sala P2P
- [ ] Rate limits contra spam e abuso
- [ ] Testes unitários, integração e acessibilidade

## Depois do MVP

- [ ] SFU para salas grandes e transmissão eficiente
- [ ] Bitrate e simulcast adaptativos
- [ ] Aplicativo React Native
- [ ] Moderação, auditoria e denúncias
- [ ] Notificações push

## Critério para SFU

Manter P2P enquanto as salas forem pequenas. Reavaliar ao atingir aproximadamente 4–6 participantes frequentes em voz ou mais de 2–3 espectadores por transmissão. A decisão final deve usar métricas reais de upload, perda de pacotes, RTT e custo de egress, não apenas número de usuários.
