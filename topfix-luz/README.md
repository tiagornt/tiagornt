# Topfix · Estudo de Luz

App web 2D para o arquiteto e a equipe Topfix desenharem a intenção de luz de um ambiente, verem as manchas com sombra e cor, e conferirem uma estimativa de iluminância (método dos lúmens e ponto a ponto), comparada ao alvo de referência da NBR ISO/CIE 8995-1.

Não é laudo e não substitui DIALux. A especificação completa (fonte da verdade) está em [`SPEC.md`](SPEC.md), com o histórico de decisões no fim.

## O que já funciona

- **Projetos:** lista com busca, arquivados, lixeira (30 dias), duplicar, baixar e abrir arquivo do projeto, projeto de exemplo pronto.
- **Ambientes:** vários por projeto, com tipologia NBR, pé-direito, plano de trabalho, FM, cores do ambiente; duplicar e excluir.
- **Base 2D:**
  - retângulo rápido (tecle **R**, digite `4x5`, **Enter**) ou pelos campos do painel;
  - paredes ponto a ponto (tecle **W**, digite a medida e **Enter**; clique no primeiro ponto para fechar), com encaixe em pontas, grade de 5 cm e 45°;
  - portas e janelas sobre a parede, cotas, textos, régua;
  - **DXF** com "Validar escala" (unidade, largura real ou medida de um trecho, dimensões resultantes) e escolha de camadas; **Promover a parede** (Shift + clique pega a polilinha inteira);
  - **PDF ou imagem** como fundo, calibrado por duas pontas + medida real, com opacidade, travar, mover e girar.
  - Cálculo bloqueado enquanto a escala do fundo não for validada.
- **Modo Croqui (planta e corte):** facho, linear direcionado, linha difusa e difusa, com cor contínua pelo CCT, intensidade, altura, abertura, inclinação, comprimento; sombra de paredes e limites; legenda automática arrastável; corte gerado da planta (com os vãos ao fundo) e "trazer fontes da planta".
- **Cálculos:** método dos lúmens (K, FU tabelado com interpolação, FM, E_med, sugerir quantidade), ponto a ponto horizontal (mapa de cores na planta com escala) e vertical (parede), aba NBR com status "abaixo / na faixa / acima do alvo".
- **Exportar:** PNG da planta (2400 px), PNG só das luzes (fundo transparente) e PDF A4 paisagem com marca Topfix, legenda, resumo, memorial e aviso de estimativa em todas as folhas.
- **Desfazer/refazer** (100 passos), salvamento automático com indicador, atalhos de teclado, visualização no celular.

## Ainda não tem (próximas entregas, ver SPEC.md seção 9 e histórico)

- Cadastro aberto de arquiteto/parceiro, login, convites da equipe, papéis, fila de leads e pedido de orçamento (E1, com Supabase). Hoje os projetos ficam salvos no navegador de quem usa.
- Conversão de DWG no servidor (por enquanto: salvar como DXF no AutoCAD).
- Painel do admin (presets, tabela NBR, FU/FM, textos do aviso, logo).

## Como rodar no computador (PowerShell)

Precisa do Node.js 20 ou mais novo e do Git.

```powershell
git clone https://github.com/tiagornt/tiagornt.git
cd tiagornt
git checkout claude/peaceful-mendel-ie4dpo
cd topfix-luz
npm install
npm run dev
```

Abra `http://localhost:3000`.

Testes das fórmulas: `npm test`. Checagem de tipos: `npm run lint`.

## Publicar na Vercel

Na Vercel, importe o repositório `tiagornt/tiagornt` e, em **Root Directory**, escolha `topfix-luz`. O resto é padrão de Next.js (sem variáveis de ambiente por enquanto).

## Organização do código

| Pasta / arquivo | O que tem |
| --- | --- |
| `src/lib/calculo/` | Fórmulas (lúmens, ponto a ponto), tabelas NBR, FU e FM, aviso. Testes em `calculo.test.ts`. |
| `src/lib/geometria.ts` | Contas de geometria: contorno do ambiente a partir das paredes, área, sombra (polígono de visibilidade). |
| `src/lib/render/` | Desenho do quadro (planta/corte), manchas de luz e camada com teto de brilho. Usado na tela e nas exportações. |
| `src/lib/ambiente.ts` | Dados de cada ambiente: área, legenda, cálculos completos e memorial. |
| `src/lib/importacao/` | Leitura de DXF e de PDF/imagem de fundo. |
| `src/lib/exportar.ts` | PNG e PDF com a marca. |
| `src/lib/armazenamento.ts` | Onde os projetos são gravados (hoje no navegador). Quando o Supabase entrar, só este arquivo muda. |
| `src/lib/marca.ts` | Nome, cor e site da Topfix usados nas telas e arquivos. |
| `src/components/editor/` | Telas do editor: quadro, barra de ferramentas, painéis. |
