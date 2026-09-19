# Relatório — Item 1: Limpeza de arquivos obsoletos

Auditoria completa de `assets/img/` e da raiz do repositório, cruzando cada
arquivo contra todo o código de produção (`index.html`, `business.html`,
`contact.html`, `resources.html`, `resources/post.html`, `privacy-policy.html`,
`politica-de-privacidade.html`, `assets/css/`, `assets/js/`,
`assets/data/resources.json`, `site.webmanifest`) para separar "usado" de
"órfão". Trabalho coordenado com o item 2 (organização de pastas), que
executou parte desta mesma lista em paralelo com aprovação direta do
usuário — os resultados abaixo refletem o estado final combinado.

## Resultado

**Zero imagens órfãs restantes.** Todas as 78 imagens em `assets/img/` estão
hoje referenciadas em pelo menos um arquivo de produção.

## O que foi removido

**~65 MB de imagens não utilizadas**, em três grupos:

1. **Legado do `manifest.json`/`download-images.sh`** (removido por mim) —
   18 imagens (`01-run.png`…`12-ferry-couple.png`,
   `age-18-graduating.png`, `age-25-first-apartment.png`,
   `age-32-travel.png`, `age-40-family.png`, `age-55-college.png`,
   `age-70-retirement.png`) mais o próprio `assets/img/manifest.json`.
   Eram a versão anterior da timeline de idades da home, já substituída
   pelos arquivos `age-XX-*.jpg` atuais. Note: `age-70-retirement` existia
   em duas extensões (`.png` órfão + `.jpg` em uso) — confirmado com o
   item 3 antes de apagar, para não remover o arquivo errado.

2. **`assets/img/business/`** (removido pelo item 2) — pasta inteira (15
   arquivos, incl. `hero-particles/`), assets de uma versão do design da
   página Business que nunca chegou a ser referenciada no HTML atual.

3. **`assets/img/personal/`** (removido pelo item 2, parcial) — 8 de 9
   arquivos; mantido apenas `dsp-glow-orb.png`, que é usado em
   `contact.html`, `resources.html` e `resources/post.html`.

4. **Soltos na raiz de `assets/img/`** (removido pelo item 2) —
   `mobile-ben-card-1/2/3.png`, `mobile-biz-graphic.png`,
   `sept8-ben-1(-sharp)/2/3.jpg`, `sept8-ben-chart.svg`,
   `sept8-drumwave-wordmark.svg`, `sept8-ent-dsp.png` (o `.png`; o
   `.jpg` correspondente está em uso em `business.html`).

**Outros arquivos removidos** (pelo item 2, dentro do mesmo esforço de
limpeza):
- `business_original.html` — backup de uma versão anterior de
  `business.html`, não referenciado em lugar nenhum, sem histórico git
  (nunca chegou a ser commitado).
- `.DS_Store` físicos (já cobertos pelo `.gitignore`, não afetavam o git,
  mas foram removidos do disco por higiene).

## Verificação cruzada

A lista foi validada de forma independente por três agentes antes da
execução:
- **Item 3** (auditoria de código) confirmou, buscando também dentro de
  `<style>` inline e comentários, que não havia uso oculto além do que o
  grep textual já havia encontrado — e identificou os dois casos de
  colisão de nome com extensão diferente (`age-70-retirement` e
  `sept8-ent-dsp`), que foram tratados corretamente (só o arquivo sem uso
  foi removido).
- **Item 6** (SEO) confirmou que nenhuma imagem removida estava referenciada
  em `og:image`/`twitter:image`/JSON-LD (essas tags ainda não existiam em
  nenhuma página no momento da limpeza — são criadas do zero pelo item 6).
- **Item 5** (auditoria de tracking) chegou à mesma conclusão de forma
  independente sobre `business_original.html` a partir do seu próprio
  levantamento.

## O que foi mantido e por quê

- **`privacy-policy.html` e `politica-de-privacidade.html`** — não são
  duplicatas. São as versões EN e PT-BR (LGPD) da política de privacidade,
  ambas linkadas ativamente no footer de todas as páginas.
- **`Figma/`** — já corretamente listado no `.gitignore`; existe apenas
  localmente, nunca vai para produção. Nenhuma ação necessária.
- **`docs/legacy-reference/`** (antes `site-antigo/`) — mantido por decisão
  do item 2 como referência histórica (snippets de analytics/HubSpot do
  site Webflow anterior); documentado como não carregado pelas páginas
  atuais.

## Nota final

`tools/download-images.sh` (movido de `download-images.sh` durante a
reorganização de pastas do item 2) dependia do `assets/img/manifest.json`
removido nesta limpeza — ficou órfão, sem utilidade real, já que baixava
exatamente as imagens legadas descartadas acima. Sinalizado ao item 2, que
confirmou e removeu o script, documentando no README que o fluxo de
download de imagens não existe mais (as imagens de produção já estão
commitadas diretamente em `assets/img/`).
