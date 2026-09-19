# Auditoria de segurança — site + Lambda de contato

Escopo: todo o repositório — páginas estáticas (`index.html`, `business.html`,
`contact.html`, `resources.html`, `resources/post.html`, `privacy-policy.html`,
`politica-de-privacidade.html`), assets (`assets/css/`, `assets/js/`), o
backend `tools/lambda-recaptcha-proxy/index.mjs`, os scripts em `tools/cms/`,
e arquivos de configuração/deploy (`robots.txt`, `sitemap.xml`,
`site.webmanifest`, `.gitignore`).

Objetivo: pente fino de segurança — segredos expostos, o fluxo do formulário
de contato (reCAPTCHA + HubSpot), XSS/injeção no front-end, headers HTTP de
segurança, dependências, arquivos versionados sensíveis, e consistência
técnica do consentimento de cookies (LGPD/GDPR). Não inclui teste de invasão
ativo contra a infraestrutura AWS/Hostinger em produção — apenas análise de
código.

## Diagnóstico geral

O projeto está em um estado bem acima da média para um site de marketing:
não há nenhum segredo real (chave privada, credencial AWS, senha) versionado
no repositório nem no histórico do git; a validação do reCAPTCHA é feita de
verdade no servidor (Lambda), não só no navegador; o Lambda não tem nenhuma
dependência de terceiros (zero superfície de supply-chain); e o carregamento
de analytics respeita corretamente o consentimento de cookies em todas as
páginas. Já existia um documento prévio, `docs/CONTACT_FORM_SECURITY.md`,
descrevendo o desenho do proxy de reCAPTCHA — todas as alegações desse
documento foram conferidas linha a linha contra o código atual e **estão
corretas** (tabela de confirmação na seção final).

O risco real que restou está concentrado em: o *fallback* do formulário de
contato, que desliga toda a proteção anti-bot quando o script do Google
falha; e a ausência de headers de segurança HTTP (CSP, HSTS,
X-Frame-Options), que hoje não existem em nenhuma camada porque dependem da
configuração do host de produção, fora do código-fonte.

## Código vs. estrutura — quem resolve o quê

Divisão dos achados entre o que se corrige editando arquivos deste
repositório (responsabilidade do dev/Guilherme) e o que depende de
configuração de infraestrutura fora do código (AWS/API Gateway/CloudWatch,
host Hostinger — responsabilidade da equipe de TI).

### Código (neste repositório)

| Achado | Severidade | Arquivo | Status |
|---|---|---|---|
| Fallback do formulário sem proteção anti-bot | Alto | `contact.html` | Em aberto |
| Validação de e-mail/tamanho no Lambda | Médio | `tools/lambda-recaptcha-proxy/index.mjs` | **Corrigido** |
| Filtro de HTML/link só no client | Baixo | `tools/lambda-recaptcha-proxy/index.mjs` | **Corrigido** |
| Sanitizer próprio em vez de lib madura | Baixo | `resources/post.html`, `assets/js/purify.min.js` | **Corrigido** |
| CSV redundante do CMS legado | Informativo | `tools/cms/*.csv` | Mantido de propósito (ver nota abaixo) |

### Estrutura/infra (equipe de TI, fora deste repositório)

| Achado | Severidade | Onde se resolve |
|---|---|---|
| Headers de segurança HTTP (CSP, HSTS, X-Frame-Options, etc.) | Médio | Configuração do host Hostinger/CDN |
| Rate limiting (throttling) do formulário | Médio | Console AWS — API Gateway |
| Alarme de erro do Lambda | Baixo | Console AWS — CloudWatch |
| Confirmar Secret Key/chave HubSpot no cofre da equipe | Informativo | 1Password |
| Confirmar HTTPS forçado no host | Informativo | Configuração do host Hostinger |

> Nota sobre o CSV: `tools/cms/*.csv` é a fonte usada por
> `tools/cms/build_resources_json.py` para gerar `assets/data/resources.json`.
> Removê-lo do repositório impediria regenerar o JSON do zero caso o CMS
> precise ser reprocessado — decisão consciente de mantê-lo, já que o
> conteúdo é só editorial público, sem risco de exposição real.

## Corrigido nesta rodada

Os itens abaixo foram corrigidos e verificados após a auditoria inicial.

**Validação de e-mail e limite de tamanho no Lambda (Médio) —
`tools/lambda-recaptcha-proxy/index.mjs:17-26,87-100`**
Adicionado `EMAIL_PATTERN` (regex simples de formato) e `FIELD_MAX_LENGTHS`
(100-5000 caracteres por campo, conforme o campo). O Lambda agora rejeita
com `400` antes de chamar o reCAPTCHA/HubSpot quando: um campo excede o
limite (`field_too_long`) ou o e-mail não bate o formato básico
(`invalid_email`). Testado isoladamente com casos de e-mail válido/inválido
e strings longas — comportamento confirmado.

**Filtro de HTML/link replicado no Lambda (Baixo) —
`tools/lambda-recaptcha-proxy/index.mjs:18,98-100`**
O mesmo `HTML_OR_LINK_PATTERN` que já existia só em `contact.html:576` agora
também roda no Lambda contra `contact.message`, retornando `400
message_contains_html_or_link` se houver tag HTML ou URL. Antes, só o
client bloqueava isso; quem submetesse direto ao endpoint do Lambda
contornava o filtro. Agora o Lambda — o único ponto realmente confiável —
aplica a mesma regra.

**Sanitizer de `resources/post.html` trocado para DOMPurify (Baixo) —
`resources/post.html:433,443-461`, novo `assets/js/purify.min.js`**
A implementação própria de allowlist (DOMParser manual) foi substituída pelo
DOMPurify 3.1.6, vendorizado localmente em `assets/js/purify.min.js` (mesmo
padrão do GSAP — sem CDN externo, funciona offline). Mesma allowlist de
tags/atributos preservada, com `ALLOWED_URI_REGEXP` bloqueando URLs
`javascript:`/`data:` e um hook `afterSanitizeAttributes` que continua
forçando `rel="noopener noreferrer"` e `target="_blank"` em todo `<a>`.
Testado via Playwright headless contra um post real e contra payloads de
ataque (`<script>`, `onerror=`, `href="javascript:..."`, `<iframe>`,
`data:text/html,<script>`) — todos neutralizados; formatação legítima
(`<strong>`, `<em>`, links normais) preservada.

## Achados por severidade

> Os três achados de código já corrigidos (validação de e-mail/tamanho,
> filtro de HTML/link no Lambda, sanitizer DOMPurify) já foram removidos das
> listas abaixo — ver "Corrigido nesta rodada" acima para o detalhe do que
> foi encontrado e como foi resolvido.

### Crítico
Nenhum encontrado.

### Alto

**O fallback do formulário de contato desativa toda a proteção anti-bot —
`contact.html:660-682` e `712-716`**
Se o script do reCAPTCHA falhar ao carregar ou responder (ad-blocker,
timeout, erro de rede) — ou se `recaptchaEnabled` estiver `false` — o
formulário envia os dados **direto para a API pública do HubSpot**, sem
passar pelo Lambda e sem nenhuma verificação server-side. Um bot só precisa
bloquear a requisição a `google.com/recaptcha` (trivial) para cair
automaticamente nesse caminho. Depois disso, as únicas barreiras que restam
são client-side — honeypot (`contact.html:613-618`), tempo mínimo de
preenchimento (`621-623`) e um rate limit via `localStorage`
(`588-595`) — todas contornáveis por um script que não executa o JS da
página e chama a API do HubSpot diretamente com payload arbitrário. Já existe
telemetria via PostHog para detectar o uso do fallback
(`contact.html:676-681`), mas isso é *detecção*, não *prevenção*.
- **Correção:** na ausência de token do reCAPTCHA, recusar o envio (pedir
  para desativar o bloqueador) em vez de enviar sem proteção; ou, melhor
  ainda, remover do client o `HUBSPOT_ENDPOINT`/`HUBSPOT_PORTAL_ID`/
  `HUBSPOT_FORM_GUID` hardcoded e tornar o Lambda o único caminho possível de
  envio.

### Médio

**Rate limiting no API Gateway não confirmado — item já em aberto em
`docs/CONTACT_FORM_SECURITY.md:43`**
Não há nenhum código de rate limiting no próprio Lambda; sem throttling
configurado no API Gateway, o único freio contra flood é o score do
reCAPTCHA — insuficiente sozinho, como mostra o achado do fallback acima.
- **Correção:** confirmar/configurar throttling na rota do API Gateway (ex.:
  5 req/s, burst 10) e considerar rate limit por IP no próprio Lambda.

**Ausência de headers de segurança HTTP em qualquer camada do repositório**
Não existe meta tag de CSP em nenhum HTML, nem `.htaccess`/`_headers`/
`netlify.toml`/`vercel.json` configurando `Strict-Transport-Security`,
`X-Frame-Options`, `X-Content-Type-Options` ou `Referrer-Policy`. Como o site
é 100% estático (`README.md:14-16`), esses headers só podem ser aplicados no
servidor/CDN de hospedagem (Hostinger) — hoje não estão em lugar nenhum.
- **Risco concreto:** sem `X-Frame-Options`/`frame-ancestors`, o site
  (inclusive a página de contato) pode ser embutido em um iframe malicioso
  para clickjacking/UI redress.
- **Correção:** ao configurar o deploy, adicionar
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (ou CSP
  `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`,
  e uma CSP permitindo os domínios já usados (`fonts.googleapis.com`,
  `fonts.gstatic.com`, `www.google.com` (recaptcha), `js.hs-scripts.com`,
  `googletagmanager.com`, `t.contentsquare.net`, PostHog,
  `execute-api.us-east-1.amazonaws.com`). Vale adicionar isso à checklist de
  go-live já existente em `docs/CONTACT_FORM_SECURITY.md`.

### Baixo

**Sem alarme de CloudWatch configurado — item já em aberto em
`docs/CONTACT_FORM_SECURITY.md:46-47`**
Sem alarme de taxa de erro, uma falha silenciosa (chave expirada, score mal
calibrado) pode passar despercebida por um bom tempo.

**CSV bruto do CMS legado versionado redundantemente —
`tools/cms/Drumwave_Update_2025 - Resources - ....csv`**
Contém apenas conteúdo editorial já público (posts de imprensa), sem PII nem
dados internos sensíveis. Não é exposição de dado sensível, só redundância
(o conteúdo já foi convertido para `assets/data/resources.json`) — questão de
higiene de repositório, não de segurança. **Decisão:** mantido de propósito
— é a fonte de `tools/cms/build_resources_json.py`, necessário para
regenerar `resources.json` caso o CMS precise ser reprocessado.

### Informativo (nada a corrigir, ou pendência puramente operacional)

- **Nenhum segredo real versionado.** Grep exaustivo por `AKIA`, `sk-`,
  `api_key`, `secret`, `password`, `token=`, `Bearer`, `private_key`, `BEGIN
  (RSA|PRIVATE|OPENSSH)` em todo o repositório e no histórico completo do
  git não encontrou nenhuma credencial real. A Secret Key do reCAPTCHA vem
  de `process.env.RECAPTCHA_SECRET_KEY` (`index.mjs:10`); a Site Key pública
  em `contact.html:539` e os IDs do HubSpot são identificadores públicos por
  design, não segredos. `.gitignore:16-19` já cobre `.env`, `.env.*`,
  `*.pem`, `*.key`.
- **Confirmar em 1Password** que a Secret Key do reCAPTCHA e a chave de
  serviço do HubSpot estão no cofre de segredos da equipe — pendência
  organizacional já listada em `docs/CONTACT_FORM_SECURITY.md:48-50`, não um
  problema de código.
- **Endpoints e IDs de analytics hardcoded no client** (`contact.html:531-540`,
  `assets/js/analytics.js:8-15`) são esperados e inevitáveis para um site
  estático sem backend próprio — todos são identificadores públicos de
  client-side tracking.
- **Sem gerenciador de dependências.** Não há `package.json`/
  `requirements.txt`. O Lambda usa só `fetch` nativo do Node 20.x (zero
  dependências de terceiros — ótimo para supply-chain); o script
  `tools/cms/build_resources_json.py` usa só biblioteca padrão do Python.
  `assets/js/gsap.min.js`/`ScrollTrigger.min.js` estão vendorizados
  localmente sem versão declarada em manifest — risco baixo (GSAP não tem
  histórico relevante de CVEs e não acessa rede/DOM sensível), mas vale
  checar a versão manualmente se quiser ficar 100% seguro.
- **`robots.txt`, `sitemap.xml`, `site.webmanifest` e `.gitignore` estão
  corretos.** Nenhum caminho interno exposto; `.gitignore` cobre segredos e
  artefatos adequadamente.
- **`docs/legacy-reference/`** já documenta corretamente que os IDs de
  HubSpot legados ali presentes são públicos e o código está obsoleto/não
  carregado — análise própria do time já estava certa.
- **Consentimento de cookies está tecnicamente correto em todas as
  páginas.** Em `index.html`, `business.html`, `contact.html`,
  `resources.html` e `resources/post.html`, `assets/js/cookiescript.js`
  sempre carrega antes de `assets/js/analytics.js`, e
  `analytics.js:62-96` só dispara GA4/Ads/PostHog/Contentsquare/HubSpot
  depois que a categoria `analytics` é aceita no CookieScript — não há
  tracking disparando antes do consentimento em nenhuma página. O
  formulário de contato também separa corretamente consentimento de
  tratamento (obrigatório) de consentimento de marketing (opcional,
  `contact.html:477-478`, replicado em `index.mjs:106-118`).

## O que já está bem mitigado (não mexer)

- Validação real do reCAPTCHA no servidor, com secret key nunca exposta no
  frontend, checagem de `score >= 0.5` e da `action` (`index.mjs:33-46,86-89`).
- CORS restrito à origem de produção, sem wildcard (`index.mjs:11,19`).
- Zero dependências de terceiros no Lambda.
- Nenhum `eval`/`new Function`, nenhum mixed content (`http://`), nenhum
  `target="_blank"` sem `rel="noopener"` em nenhuma página.
- `innerHTML` usado em `resources.html` sempre passa por escaping
  (`esc()`, linhas 454-456) antes de ir para o DOM.
- Sanitização de HTML de terceiros em `resources/post.html` agora via
  DOMPurify (lib madura, vendorizada localmente), com validação de e-mail,
  limite de tamanho e filtro de HTML/link também aplicados no Lambda.

## Tabela de confirmação — `docs/CONTACT_FORM_SECURITY.md`

| Alegação do documento | Status no código |
|---|---|
| Secret Key nunca exposta no frontend | Confirmado — só existe em `process.env` no Lambda |
| Validação real contra `siteverify` do Google | Confirmado — `index.mjs:33-46` |
| Só encaminha ao HubSpot se `score >= 0.5` e `action` correto | Confirmado — `index.mjs:86-89` |
| CORS restrito à origem de produção | Confirmado — `index.mjs:11,19` |
| Zero dependências externas no Lambda | Confirmado — só `fetch` nativo |
| Fallback existe e contorna a proteção quando o reCAPTCHA falha | Confirmado — e é risco real (ver Alto acima) |
| Rate limiting no API Gateway | Não confirmado no repositório (correto — está fora do código, doc já marca como pendente) |

O documento é preciso: nada do que ele alega como mitigado está, na
prática, quebrado; os itens que ele já marcava como "em aberto" continuam
em aberto hoje.

## Prioridade sugerida de correção (restante)

1. Fallback do formulário sem proteção anti-bot — código, `contact.html`
   (Alto).
2. Configurar headers de segurança no host de produção + confirmar
   throttling no API Gateway — infra/TI (Médio).
3. Alarme de CloudWatch para erro do Lambda — infra/TI (Baixo).

~~Validação de tamanho/formato de campos no Lambda~~,
~~replicar filtro de HTML/link no Lambda~~ e
~~trocar sanitizer próprio por DOMPurify~~ — **corrigidos**, ver seção
"Corrigido nesta rodada" acima.
