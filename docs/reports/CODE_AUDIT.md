# Auditoria de código — HTML / CSS / JS (item 3)

Escopo: `index.html`, `business.html`, `contact.html`, `resources.html`,
`resources/post.html`, `privacy-policy.html`, `politica-de-privacidade.html`
e os assets em `assets/css/` e `assets/js/`.

Objetivo: identificar código quebrado, duplicado ou desorganizado por causa
das várias iterações do projeto, **sem alterar nada visualmente**. Todo
achado abaixo foi confirmado com validação técnica (parser HTML/CSS, `node
--check` nos blocos de JS, validação de JSON-LD) e, quando havia dúvida
sobre efeito visual, com screenshots reais via Playwright antes/depois.

## Diagnóstico geral

Estruturalmente o código está são: nenhum JS quebrado, nenhum JSON-LD
inválido, nenhum `id` duplicado, nenhum link interno quebrado, nenhuma tag
malformada. Os avisos que ferramentas como `tidy` acusam (`<svg>`, `<nav>`,
`<header>` "not recognized") são falso-positivo de um parser HTML4 antigo
que não conhece HTML5/SVG inline — não são bugs reais.

O problema real de organização é estrutural: cada uma das 7 páginas carrega
seu próprio bloco `<style>` inline gigante (250 a 1000+ linhas), sem CSS
compartilhado entre elas. Isso é o que causou o "drift" de copy-paste
descrito abaixo — o mesmo componente (nav, footer, botões) foi colado em
cada página e foi divergindo a cada rodada de ajuste.

## Correções aplicadas

**1. `.nav` do menu mobile duplicado dentro do mesmo arquivo —
`index.html` e `business.html`**
O bloco CSS do menu mobile (~59 linhas, com `!important` em cada
propriedade) estava escrito duas vezes, palavra por palavra, uma dentro de
`@media (max-width:900px)` e de novo dentro de `@media (max-width:760px)`.
Como 760px já está contido em 900px, a segunda cópia nunca mudava nada —
puro código morto. Removida a cópia redundante em ambos os arquivos.

**2. Versão obsoleta da nav mobile morta — `resources.html` e
`resources/post.html`**
Essas duas páginas tinham uma versão antiga do menu mobile (altura 60px,
sem cantos arredondados em pílula) declarada num primeiro
`@media (max-width:900px)`, mas uma segunda declaração do mesmo seletor
mais abaixo no arquivo (com `!important`, já no padrão "pill" atual)
sempre a sobrescrevia — a versão antiga nunca chegava a aparecer na tela.
Removida a regra morta; o resultado visual não muda.

**3. Comentário CSS colado sem quebra de linha —
`politica-de-privacidade.html`**
`/* nav (shared with index.html / business.html) */.nav{` — cosmético,
não alterava o comportamento do CSS (comentários terminam em `*/`
independentemente de quebra de linha), mas destoava da formatação das
outras 6 páginas. Corrigido.

**4. Ícones sociais do rodapé mais apagados só em `business.html`**
Bug visual real, confirmado com screenshot: `business.html` tinha uma
regra extra (`opacity:.4` no `<img>` do ícone, subindo para `.7` no hover)
que não existe em nenhuma das outras 6 páginas. Como o link `<a>` ao redor
do ícone já controla a opacidade (1 → .65 no hover), esse `opacity` extra
só deixava os ícones de LinkedIn/YouTube visivelmente apagados sem motivo
— provável resíduo de uma versão anterior do footer (havia até um
comentário no código dizendo "the marks are white artwork, so dim them",
que não reflete o footer atual, onde o fundo é o mesmo `--ink` das outras
páginas). Removida a opacidade extra; os ícones agora aparecem iguais em
todas as páginas.

Todas as 7 páginas foram revalidadas depois das correções: chaves CSS
balanceadas, zero erros de console no carregamento, e screenshots
comparativos confirmando que layout/menu mobile/footer continuam
idênticos ao comportamento anterior (exceto o item 4, que foi a correção
pretendida).

## Achados que ficam como estão (intencionais, confirmados com o cliente)

- **Padding inferior do rodapé** difere entre `index.html`/`business.html`
  (menor) e as outras 5 páginas (maior). Confirmado que é proposital:
  index/business têm uma seção extra de `.disclosures` (avisos legais)
  logo abaixo do footer, então o footer precisa de menos respiro ali; as
  demais páginas terminam no footer, então precisam de mais espaço antes
  do fim da página. Sem ação necessária.
- **Cor do botão principal do menu**: verde em `business.html`, roxo/azul
  nas demais. Confirmado como diferenciação proposital entre a oferta
  "Business" e "Personal" — não é drift, não foi alterado.

## Outros achados registrados, sem ação (baixo risco / fora de escopo)

- `business.css` concentra 330 usos de `!important` (vs. ~44 nas páginas
  mais simples), quase todos dentro do breakpoint `max-width:760px` — é
  sintoma de patches de responsividade acumulados em vez de uma cascata
  CSS revisada. Funciona corretamente hoje; não foi tocado porque uma
  refatoração de especificidade tem risco real de alterar o layout, o que
  contraria a instrução de não mudar nada visualmente. Fica registrado
  como dívida técnica para uma futura revisão dedicada, com testes visuais
  completos.
- Variáveis CSS (`--scrim`, `--accent`) declaradas em todas as páginas mas
  usadas de forma inconsistente (algumas páginas usam a variável, outras
  usam o valor hexadecimal direto). Não afeta o resultado visual; oportunidade
  de limpeza futura, não crítica para o lançamento.
- `privacy-policy.html` (EN) e `politica-de-privacidade.html` (PT) não são
  a mesma página traduzida 1:1 — a versão PT tem 12 seções numeradas
  (LGPD) incluindo uma tabela, a EN tem 10 seções genéricas sem tabela.
  Não é bug de código, é conteúdo — vale confirmar com o time de
  jurídico/conteúdo se isso é intencional antes do go-live.

## Verificação de assets JS/CSS

Todos os arquivos em `assets/js/` (`cookiescript.js`, `analytics.js`,
`gsap.min.js`, `ScrollTrigger.min.js`) e `assets/css/cookiescript-custom.css`
estão referenciados e em uso em pelo menos uma página de produção — nenhum
arquivo órfão nessas duas pastas.

## Metodologia

- Validação HTML com `tidy` (descartando falsos-positivos de parser
  HTML4/SVG).
- Extração e validação de sintaxe de cada bloco `<script>` inline com
  `node --check`.
- Validação de todos os blocos JSON-LD com `json.loads`.
- Checagem programática de `id` duplicado, links internos (`href="#..."`)
  sem âncora correspondente, `src`/`href` apontando para arquivos
  inexistentes, atributos duplicados na mesma tag.
- Diff estruturado do CSS de cada página (seletor a seletor) contra as
  demais, para achar o mesmo componente com valores diferentes.
- Confirmação visual dos achados com screenshots via Playwright, em
  desktop (1440px) e mobile (700–820px), antes e depois de cada correção,
  incluindo checagem de erros de console no carregamento.
