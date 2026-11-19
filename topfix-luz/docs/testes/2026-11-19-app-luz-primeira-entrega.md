# App de luz Topfix: primeira entrega (croqui, cálculos, importação, exportação)

- Branch: `claude/peaceful-mendel-ie4dpo` (repositório `tiagornt/tiagornt`, pasta `topfix-luz`)
- Prévia: rodar no computador (`npm run dev`, ver README) ou na Vercel com Root Directory `topfix-luz`
- Migration nova: não (ainda não há banco; os projetos ficam no navegador)
- Login: não tem (o cadastro entra no E1)
- Preparar: um DXF de planta qualquer (em mm) e um PDF ou imagem de planta com uma medida conhecida
- O que mexe em dado real: nada. Tudo fica no navegador de quem testa. No fim, mandar os projetos "TESTE ..." para a lixeira.

## Passos

1. Abrir a página inicial e clicar em **Abrir um exemplo pronto**.
2. No exemplo, olhar o quadro na aba **Croqui** (planta).
3. Clicar na aba **M. Lúmens**, depois **P2P horiz.**, **P2P vert.** e **NBR**.
4. Voltar à página inicial (seta no canto superior esquerdo). Clicar em **Novo projeto**, nome `TESTE Sala`, **Criar e abrir**.
5. Com o mouse sobre o quadro, teclar **R**, digitar `4x5` e **Enter**.
6. No painel esquerdo, **Fontes de luz** → **Difusa**, escolher o preset **Plafon difuso 3000 K**. Clicar duas vezes dentro da sala, em lugares diferentes. Teclar **V**.
7. Clicar na aba **M. Lúmens**.
8. Na linha **L01**, clicar em **Sugerir N** e depois em **Aplicar 4 peças**.
9. Voltar à aba **Croqui**. Clicar numa das difusas e arrastar o controle **Temperatura de cor** até 2700 K.
10. Teclar **L** e desenhar um limite cortando a sala ao meio (clique numa ponta, clique na outra). Teclar **V**.
11. Teclar **Ctrl+Z** e depois **Ctrl+Y**.
12. Clicar em **CORTE** (painel esquerdo) → **Corte automático pelo meio** → **Trazer fontes da planta**.
13. Voltar à **PLANTA**. No painel esquerdo, **Exportar** → **PNG**, depois **LUZES**, depois **PDF**.
14. Clicar no **+** ao lado de **AMBIENTES**, nome `TESTE DXF`, **Criar**. Em **Base**, **Importar planta CAD (DXF)** e escolher o DXF.
15. Na janela **Validar escala do DXF**, conferir a unidade, informar a largura real e clicar em **Aplicar escala**. Clicar em **Promover a parede** e, segurando Shift, clicar numa parede do DXF.
16. Criar outro ambiente `TESTE Imagem`. Em **Base**, **PDF ou imagem como fundo**, escolher a planta. Clicar nas duas pontas de uma medida conhecida e digitar o valor real em **Calibrar escala**.
17. Na aba **M. Lúmens** do `TESTE Imagem`, antes de desenhar paredes.
18. Abrir o app no celular e abrir o projeto de exemplo.

## Esperado

- [ ] 2: aparecem manchas de luz com cores diferentes (quente na mesa, neutra no estar), um cone de destaque sobre o sofá e a sombra do limite separando mesa e estar. A legenda mostra 5 linhas, a primeira `L01 · Facho · 4000 K · 4`.
- [ ] 3: M. Lúmens mostra área 27,00 m², C × L 6,00 × 4,50 m e E_med com status. P2P horiz. mostra o mapa de cores com escala (0 a 1000 lx) e o aviso "Estimativa... Não é laudo". P2P vert. mostra a parede em cores. NBR mostra "Área de estar / sala", alvo 150 lx e "UGRL máx.: não aplicável".
- [ ] 5: aparece a sala 4 × 5 m; o painel mostra **Área: 20,00 m²**.
- [ ] 6: a legenda mostra `L01 · Difusa · 3000 K · 2`.
- [ ] 7: E_med = **84 lx**, K = **1,14**, FU = **0,53**, FM = **0,80**, Σ N × Φ = **4.000 lm**, status **Abaixo do alvo (-44%)**, alvo 150 lx.
- [ ] 8: a janela diz que a estimativa pede **4** peças; ao aplicar, ficam 4 difusas em grade e E_med vira **169 lx**, **Na faixa (+13%)**.
- [ ] 9: a mancha das 4 peças L01 muda de cor junto (a opção "Editar as 4 peças L01 juntas" vem marcada).
- [ ] 10: a luz não atravessa o limite (sombra do outro lado).
- [ ] 11: o limite some com Ctrl+Z e volta com Ctrl+Y.
- [ ] 12: o corte mostra piso, teto, paredes, a linha do plano de trabalho (0,75 m) e as manchas das difusas.
- [ ] 13: baixam 3 arquivos com nome `Topfix_Croqui_TESTE_Sala_Sala_de_estar_AAAA-MM-DD` (.png, `_luzes.png`, .pdf). O PNG tem a marca TOPFIX e a legenda. O de luzes tem fundo transparente. O PDF tem 2 folhas: croqui (planta, corte, legenda, resumo) e memorial (fórmulas e mapa), com o aviso de estimativa no rodapé de cada folha.
- [ ] 15: a janela mostra "DIMENSÕES RESULTANTES" em metros e a frase "X no arquivo vira Y m"; as camadas com nome de cota/texto vêm desmarcadas. Depois de aplicar, o painel diz "Escala validada". A polilinha clicada vira parede.
- [ ] 16: depois de aplicar, o painel diz "Escala validada" e a régua (**M**) mede o mesmo trecho com o valor digitado.
- [ ] 17: aparece "O ambiente ainda não tem paredes fechadas" (sem número inventado).
- [ ] 18: no celular dá para ver o croqui, trocar de aba e abrir os cálculos; a barra mostra só mover e zoom.
- [ ] Não pode: aparecer as palavras "exato", "laudo aprovado", "certificado" ou "conforme a norma" como selo; qualquer mapa de cores sem a escala; a marca Topfix faltar em PNG ou PDF; a luz atravessar uma parede fechada.
