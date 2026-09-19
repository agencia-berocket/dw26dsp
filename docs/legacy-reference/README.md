# site-antigo — legado (não usado)

Este diretório guarda trechos de `<head>`/`<footer>` extraídos do site anterior
(Webflow), mantidos apenas como referência histórica.

**Nenhum arquivo destas páginas atuais (`index.html`, `business.html`,
`contact.html`, `resources.html`, `privacy-policy.html`,
`resources/post.html`) referencia ou carrega estes arquivos.** Eles não fazem
parte do build nem são servidos em produção.

## O que tem aqui

- `head.html` — tags de analytics/tracking do site antigo (Google Analytics 4,
  Google Ads, PostHog, Cookie Script, verificação do Google Search Console) e
  JSON-LD de Organization.
- `footer.html` — formulário de newsletter integrado ao HubSpot (portal ID e
  form ID) com lógica de proteção anti-spam no cliente (honeypot, fingerprint
  leve, limite de envios).

Os IDs presentes (GA4, Google Ads, PostHog, HubSpot, Cookie Script) são
identificadores públicos usados no lado do cliente — não são segredos — mas o
código em si está obsoleto e não deve ser copiado para as páginas novas sem
revisão: reavalie se essas integrações ainda são necessárias e, se forem,
reimplemente-as deliberadamente no site atual em vez de colar este trecho.

Se decidirem que isso não é mais útil como referência, é seguro apagar esta
pasta inteira.
