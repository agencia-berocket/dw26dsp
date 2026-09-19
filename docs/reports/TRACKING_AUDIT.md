# Auditoria de Tracking, Analytics e Marketing Tags — drumwave-site-2026

Relatório do item 5 (pente-fino pré-lançamento em drumwave.com). Lista tudo o
que está de fato carregado no site hoje, onde está configurado, e o que foi
encontrado como legado/inconsistente.

## 1. Resumo executivo

| Ferramenta | Status no site atual | Onde configurado | Gated por consentimento? |
|---|---|---|---|
| CookieScript (CMP) | ✅ Ativo | `assets/js/cookiescript.js` (auto-hospedado) + `assets/css/cookiescript-custom.css` | N/A (é o próprio CMP) |
| Google Analytics 4 | ✅ Ativo | `assets/js/analytics.js` — ID `G-7X38HBQD5Y` | Sim, categoria `analytics` |
| Google Ads (conversion tracking) | ✅ Ativo, mas sem eventos de conversão configurados | `assets/js/analytics.js` — ID `AW-476679703` | Sim, categoria `analytics` |
| PostHog | ✅ Ativo | `assets/js/analytics.js` — key `phc_z4E1BxQ6Lzx...`, host próprio `ph.drumwave.com` | Sim, categoria `analytics` |
| Contentsquare | ✅ Ativo | `assets/js/analytics.js` — `https://t.contentsquare.net/uxa/1d698713bff74.js` | Sim, categoria `analytics` |
| HubSpot Tracking Code (analytics/behavioral, distinto do Forms API) | ✅ Ativo (adicionado após aprovação do usuário) | `assets/js/analytics.js` — `https://js.hs-scripts.com/45485180.js`, `id="hs-script-loader"` | Sim, categoria `analytics` |
| Google reCAPTCHA v3 | ✅ Ativo (só em contact.html), com fallback logado | `contact.html` — site key `6LeqGLEt...`, proxy Lambda na AWS | N/A (funcional, não analytics) |
| HubSpot Forms API | ✅ Ativo (só em contact.html) | `contact.html` — portal `45485180`, form `0405692e-4885-4218-b038-731f1ea6fe82` | N/A (funcional) |
| Google Site Verification (Search Console) | ✅ Ativo | meta tag em todas as páginas | N/A |
| JSON-LD (Organization + Breadcrumb) | ✅ Ativo | `index.html` (dados corretos, atualizados) | N/A |
| Hotjar | ❌ Não encontrado em nenhum arquivo | — | — |
| Facebook/Meta Pixel | ❌ Não encontrado | — | — |
| LinkedIn Insight Tag | ❌ Não encontrado (só links `<a>` para o perfil da empresa) | — | — |
| TikTok/Snapchat Pixel | ❌ Não encontrado | — | — |

**Nenhum Hotjar foi encontrado no projeto** — o item 5 do pedido original menciona "HotForm/Hotjar" mas essa ferramenta não está integrada em nenhum lugar do código atual nem do legado.

## 2. Onde cada tag está fisicamente carregada

Todas as páginas de produção (`index.html`, `business.html`, `contact.html`,
`resources.html`, `resources/post.html`, `privacy-policy.html`,
`politica-de-privacidade.html`) carregam o mesmo bloco no `<head>`:

```html
<!-- CookieScript consent banner -->
<script type="text/javascript" src="assets/js/cookiescript.js"></script>
<link rel="stylesheet" href="assets/css/cookiescript-custom.css">
<script type="text/javascript" src="assets/js/analytics.js"></script>
```

Isso é consistente em todas as 7 páginas — bom sinal, não há duplicação nem
divergência de versão entre páginas.

### `assets/js/analytics.js` — carregador central, com consent gating

Este arquivo é o único lugar onde GA4, Google Ads, PostHog, Contentsquare e
(desde a atualização do item 4) o HubSpot Tracking Code são de fato
inicializados. Ele **não dispara nada até o CookieScript reportar
consentimento da categoria `analytics`** — ouve os eventos
`CookieScriptAccept`, `CookieScriptAcceptAll`, `CookieScriptCurrentState` e
`CookieScriptLoaded`, e também checa o estado atual via
`window.CookieScript.instance.currentState()` caso o consentimento já tenha
sido dado antes do script carregar. Isso é a arquitetura correta — os
scripts de terceiros não rodam antes do consentimento.

IDs/keys hardcoded neste arquivo:
- `GA_MEASUREMENT_ID = 'G-7X38HBQD5Y'`
- `GOOGLE_ADS_ID = 'AW-476679703'`
- `POSTHOG_KEY = 'phc_z4E1BxQ6LzxNIQmBdZjzUSLFQXd50prpU2Ln9KJRdy2'`
- `POSTHOG_API_HOST = 'https://ph.drumwave.com'` (proxy/reverse-proxy próprio, não `*.posthog.com` direto)
- `CONTENTSQUARE_SRC = 'https://t.contentsquare.net/uxa/1d698713bff74.js'`
- HubSpot Tracking Code: `https://js.hs-scripts.com/45485180.js` (portal
  `45485180`, mesmo portal já usado no Forms API de `contact.html`),
  carregado com `id="hs-script-loader"` (padrão oficial da HubSpot), dentro
  de uma função `loadHubSpot()` chamada de dentro do mesmo `applyConsent()`
  que já disparava GA/PostHog/Contentsquare. Nenhuma página teve o `<head>`
  alterado — o loader central (`analytics.js`) já é referenciado em todas.
  Como o cookie `hubspotutk` só passa a existir depois desse script rodar
  (ou seja, só após consentimento), e `contact.html` já tratava
  `hutk`/`hubspotutk` ausente com segurança (`getHubspotCookie()` retorna
  `undefined` se o cookie não existir), a submissão do formulário passa a
  enviar esse identificador automaticamente quando presente, sem exigir
  nenhuma mudança em `contact.html`.

Nenhum desses são segredos (todos são identificadores client-side públicos),
então não há risco de segurança em mantê-los no código-fonte.

### `assets/js/cookiescript.js` — CMP auto-hospedado

É o script minificado da CookieScript, baixado localmente em vez de
referenciado via CDN (`<script src="https://cdn.cookie-script.com/s/...">`).
Config interna: `enabledConsentMode: false` — ou seja, **não usa o Google
Consent Mode nativo**; o gating de GA/Ads é feito manualmente pelo
`analytics.js` (abordagem funcional, mas significa que o Google Consent
Mode v2 — que o Google vem exigindo para tráfego de anúncios na UE — não
está implementado). Vale avaliar se isso é necessário dependendo do
público-alvo de Ads.

### `contact.html` — reCAPTCHA v3 + HubSpot

- Carrega `https://www.google.com/recaptcha/api.js?render=<SITE_KEY>` sob
  demanda (só quando `recaptchaEnabled` é true, o que hoje é sempre, pois
  site key e endpoint do proxy já estão preenchidos).
- Site key: `6LeqGLEtAAAAAPwGpgbsue4F0-P5M0SC3DQiTNiQ`
- Proxy AWS (Lambda + API Gateway): `https://dh3981f8v1.execute-api.us-east-1.amazonaws.com/contact-submit`
- Fallback: se o proxy falhar, cai para submissão direta ao HubSpot Forms
  API (`api.hsforms.com`) sem passar pelo reCAPTCHA — mitigação client-side
  (honeypot, time-trap, bloqueio de e-mails descartáveis, rate limit local)
  ainda se aplica nesse caminho. **Atualização:** o item 4 implementou (com
  aprovação do usuário) um evento PostHog `contact_form_recaptcha_fallback`
  disparado sempre que o form cai nesse caminho, dando visibilidade de
  quanto tráfego passa sem a proteção do reCAPTCHA. Consulta documentada em
  `docs/CONTACT_FORM_SECURITY.md` (PostHog → Activity/Events, filtrar pelo
  nome do evento).
- HubSpot Portal ID: `45485180`
- HubSpot Form GUID: `0405692e-4885-4218-b038-731f1ea6fe82`
- Documentação completa e atualizada em `docs/CONTACT_FORM_SECURITY.md`
  (movida da raiz para `docs/` pelo item 2) — inclui status de deploy,
  variáveis de ambiente da Lambda e itens em aberto (throttling do API
  Gateway não confirmado, alarme de erro no CloudWatch não configurado,
  ausência de teste end-to-end real em produção). O código da Lambda em si
  também foi movido, de `lambda/recaptcha-proxy/` para
  `tools/lambda-recaptcha-proxy/` (referências internas já ajustadas pelo
  item 2).

### Meta tags de verificação

`<meta name="google-site-verification" content="Uno11EyNkLUE6XqBr32cJUTJdfERnW0rC3Rj4m_h0rY">`
presente em todas as 7 páginas de produção — consistente.

### JSON-LD

`index.html` tem `Organization` e `BreadcrumbList` schema, com dados
corretos e atualizados (LinkedIn + YouTube reais, sem placeholder). Isso é
mais escopo do item 6 (SEO) do que deste relatório, mas fica registrado
aqui porque também é "o que foi inserido na página".

## 3. Achados de legado / inconsistência (ação recomendada)

### 3.1 `docs/legacy-reference/` (antes `site-antigo/`) — versão antiga (Webflow) com CookieScript ID diferente

Pasta com `head.html` e `footer.html` do site Webflow anterior — movida pelo
item 2 de `site-antigo/` (raiz) para `docs/legacy-reference/`, conteúdo
intacto. Já vem com um `README.md` próprio dizendo que é legado e **não é
referenciado por nenhuma página atual** (confirmado — busquei em todas as
páginas, nenhuma inclui esses arquivos). Contém:

- Um **CookieScript ID diferente** do usado hoje:
  `//cdn.cookie-script.com/s/fd42b4a585c469c84682e35011696833.js` (via CDN
  externo) vs. o script auto-hospedado atual — ou seja, se alguém reativar
  essa pasta por engano, o consentimento seria gerenciado por um projeto
  CookieScript diferente do atual.
- Os mesmos GA4/Ads/PostHog/Contentsquare IDs do site atual (batem com os
  de produção).
- 3 formulários HubSpot antigos ligados a IDs de formulário do Webflow
  (`wf-form-Newsletter-x-Hubspot`, `contact-form-dwave-en`,
  `contact-form-dwave-pt`) com portal ID `45485180` (mesmo portal atual) mas
  form GUIDs diferentes/adicionais (`38d0e83f-4bcb-4608-979a-7ae27868552d`,
  `50316bc9-25b9-468e-ae57-1fd6e3bdcc20`) que não aparecem em nenhuma página
  atual — provavelmente formulários HubSpot que ainda existem no backend do
  HubSpot mas não têm mais um form correspondente no site novo.

**Atualização:** o item 2 optou por manter esta pasta como referência
deliberada (não é lixo acidental) e apenas a moveu para
`docs/legacy-reference/`, deixando mais claro que está fora do build de
produção. Vale notar ali (ou aqui) que o CookieScript ID usado nesse
material antigo (`fd42b4a585c469c84682e35011696833`, via CDN) é diferente
do mecanismo em uso hoje (script auto-hospedado) — não é erro, só não
confundir se algum dia esse conteúdo for reaproveitado.

### 3.2 `business_original.html` — sem nenhum tracking

Arquivo solto na raiz (29.9 KB), claramente um backup pré-refatoração de
`business.html`. Não carrega CookieScript, analytics.js, nem nenhuma tag —
está fora de sincronia com o padrão de todas as páginas de produção.

**Recomendação para o item 1:** não é uma página válida para produção
(sem consent banner, sem analytics, pode estar com HTML/CSS desatualizado).
Mover para fora do diretório publicável ou excluir se não há necessidade de
mantê-lo como referência histórica.

### 3.3 Lacuna na Política de Privacidade (relevante para o item 4)

- **Versão em inglês** (`privacy-policy.html`) menciona apenas "Google
  Analytics" como parceiro de analytics. Não menciona PostHog,
  Contentsquare, Google Ads (conversion tracking) nem Google reCAPTCHA —
  todos ativos no site.
- **Versão em português** (`politica-de-privacidade.html`) **não menciona
  nenhuma ferramenta de analytics**, nem mesmo Google Analytics — a seção
  equivalente à "Analytics Partners" do inglês parece ter sido omitida ou
  traduzida de forma incompleta.

**Atualização:** o item 3 confirmou que as duas versões não são uma
tradução 1:1 — a PT segue estrutura própria de 12 seções (LGPD, com
tabela), a EN tem 10 seções genéricas — então a lacuna não é uma tradução
incompleta, é conteúdo jurídico distinto em cada idioma. O usuário
confirmou ao item 4 que ambos os arquivos (`privacy-policy.html` e
`politica-de-privacidade.html`) foram escritos pelo time Legal e **não
podem ser alterados pela equipe técnica** — nem texto, nem copy. A lacuna
de compliance descrita acima continua real e documentada aqui, mas a
decisão de corrigi-la (adicionar os nomes dos fornecedores) é do Legal, não
do time técnico. Sem ação de código a tomar neste item.

### 3.4 Sem `robots.txt` nem `sitemap.xml`

Não encontrei nenhum dos dois na raiz do projeto. Não é escopo direto do
item 5, mas como impacta rastreamento por crawlers (Google Search Console
já está verificado via meta tag), sinalizando ao item 6 (SEO) para
providenciar antes do go-live.

### 3.5 Google Consent Mode não habilitado

`CookieScriptData.enabledConsentMode` está `false`. O gating atual
(`analytics.js` esperando evento de consentimento) funciona para bloquear
carregamento de scripts, mas não é o mesmo que o Google Consent Mode v2
nativo (que envia sinais de consentimento para o próprio Google mesmo antes
do consentimento, em modo "cookieless ping"). Só é bloqueante se houver
tráfego pago relevante da UE/UK; caso contrário, é uma nota informativa.

## 4. O que NÃO foi encontrado (e não precisa ação)

- Hotjar / HotForm — ausente em todo o projeto.
- Meta/Facebook Pixel — ausente.
- LinkedIn Insight Tag — ausente (só há links `<a>` estáticos para o
  LinkedIn da empresa, isso não é tracking).
- TikTok Pixel, Snapchat Pixel, Matomo, Segment, Mixpanel, Amplitude,
  Microsoft Clarity — ausentes.

## 5. Checklist para o go-live (item 5)

- [ ] Confirmar com o time de growth/marketing se a ausência de Hotjar é
      intencional (o pedido original citava "HotForm" — pode ter sido
      confundido com Hotjar, que não está instalado).
- [x] Decidir sobre a pasta legada do Webflow — mantida como referência,
      movida para `docs/legacy-reference/` pelo item 2 (ver 3.1).
- [ ] Decidir sobre `business_original.html` (excluir ou mover — ver 3.2).
- [x] Atualizar política de privacidade EN + PT-BR — decisão do usuário:
      esses arquivos são de propriedade do time Legal e não serão editados
      pela equipe técnica (ver 3.3). Lacuna fica registrada, correção fica
      a critério do Legal.
- [ ] Adicionar `robots.txt` e `sitemap.xml` (coordenar com item 6).
- [ ] **Aberto — revisão adiada intencionalmente para o momento do go-live**
      (confirmado diretamente pelo usuário ao item 4, não é pendência
      esquecida): os 5 itens do checklist AWS em
      `docs/CONTACT_FORM_SECURITY.md` — throttling do API Gateway, teste
      end-to-end real em produção, domínio cadastrado no console do Google
      reCAPTCHA, alarme de erro no CloudWatch, e guarda do Secret Key/HubSpot
      service key no cofre de segredos da equipe. Nenhum foi validado ainda;
      nenhum destes deve ser tratado como "pronto" antes do go-live.
- [ ] Validar no Google reCAPTCHA admin console que o domínio cadastrado é
      exatamente `drumwave.com` (e `www.drumwave.com` se aplicável).
- [ ] Verificar se os 2 form GUIDs "órfãos" do HubSpot vistos em
      `site-antigo/footer.html` ainda precisam existir no portal do HubSpot,
      ou se podem ser arquivados lá (fora do escopo deste repositório, mas
      vale avisar quem administra o HubSpot).

---
*Relatório gerado como parte da auditoria pré-lançamento de drumwave.com — item 5 (listagem de Analytics/Ads/tracking).*
