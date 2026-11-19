# Ferramenta visual de projeto Topfix

Especificação da **Fase 1** (somente 2D).

O escopo da Fase 1 está **fechado para início** (18/11/2026, 20:39, America/Sao_Paulo). Não restam perguntas de produto que travem o começo da implementação. O 3D fica de fora desta fase e entra na Fase 2 (extrusão de paredes, fachos, three.js). Ideias fora deste recorte estão na seção 13.

Idioma do produto e deste arquivo: pt-BR. O documento continua vivo: qualquer decisão posterior entra no histórico, com data.

---

## 1. Visão e objetivos

### Posicionamento

- Dono da ideia: Tiago R., Brusque/SC.
- Empresas do grupo: **Topfix** (cortinas, persianas e papel de parede, com instalação) e **Bart** (projeto luminotécnico profissional e luminárias).
- Este app é da **Topfix**, não da Bart.
- Nunca será um produto para vender.
- Uso interno da equipe Topfix, com liberação para arquitetos e parceiros.
- Na Bart, o projeto luminotécnico profissional continua no DIALux (e equivalentes). Este app **não substitui** esse trabalho.
- Função principal: ferramenta fácil, dinâmica e visual, que gera credibilidade, fica na memória do arquiteto e fomenta vendas, principalmente da Topfix.
- Precisão: **"boa o suficiente"**. Nunca 100% como o DIALux. Também não pode ser genérico e ruim. Tem que ser funcional e funcionar.

### Objetivo da Fase 1

Entregar um app web 2D em que a equipe Topfix e o arquiteto/parceiro consigam, sozinhos:

- criar um projeto e um ambiente (desenho manual, importação DXF/DWG ou PDF/imagem como fundo);
- desenhar a intenção de luz em planta e em corte (Modo Croqui);
- estimar iluminância pelo método dos lúmens e por um ponto a ponto simplificado;
- checar o alvo da NBR ISO/CIE 8995-1 para o tipo de ambiente;
- exportar PNG e PDF A4 com a marca Topfix;
- cadastrar-se (o cadastro já vira lead) e, se quiser, pedir orçamento.

A Fase 1 deve **empatar e, em 2D, melhorar** o que o LuxSintax mostra no Modo Croqui e nas abas de cálculo (M. Lúmens, P2P horiz./vert., NBR), com três ganhos nossos: honestidade da estimativa, fluxo para arquiteto/parceiro, e marca + contato Topfix.

### O que a Fase 1 é

- Editor 2D de ambiente e de composição luminosa
- Calculadora de estimativa, com aviso permanente de que não é laudo
- Ferramenta de relacionamento e apoio à venda da Topfix

### O que a Fase 1 não é

- Produto comercializado (SaaS à venda)
- Substituto do DIALux, Relux ou AGi32
- CAD completo (tipo Rayon ou AutoCAD)
- Visualizador 3D (isso é Fase 2)
- Leitor automático de PDF/imagem de planta, nem fotometria IES/LDT real (isso é Fase 3)

### Tensão comercial

É uma ferramenta de luz a serviço de uma empresa de cortinas, persianas e papel de parede. Sem uma ponte clara com o que a Topfix vende, o arquiteto pode usar e não lembrar da marca.

Na Fase 1, essa ponte é a marca no PDF, o fluxo do arquiteto e o botão de orçamento / captura de lead. A ideia de simular luz natural com cortinas e persianas Topfix **não entra** na Fase 1 nem na Fase 2. Ficou registrada na seção "Para decidir depois", para revisitar quando o produto já estiver claro na prática.

---

## 2. Perfis de usuário e permissões

| Perfil | Quem é | Acesso padrão |
| --- | --- | --- |
| Admin Topfix | Tiago ou quem ele indicar | Tudo: usuários, marca, biblioteca, todos os projetos, leads |
| Equipe Topfix | Vendas, projeto e atendimento da Topfix | Cria e edita projetos internos, vê leads, compartilha com arquiteto, exporta |
| Arquiteto | Profissional que cria a própria conta (cadastro aberto) | Só os próprios projetos e os que a Topfix compartilhou com ele |
| Parceiro | Loja, escritório ou instalador parceiro | Igual ao arquiteto (mesmo papel técnico, outro rótulo no cadastro) |

Decisão de 18/11/2026, 20:33: o arquiteto (e o parceiro) **cria o próprio login**. O cadastro é aberto. Admin e equipe Topfix **não** se auto-cadastram: entram por convite interno do admin.

Cada cadastro de arquiteto ou parceiro vira automaticamente um lead para a Topfix.

| Ação | Admin | Equipe Topfix | Arquiteto / parceiro |
| --- | --- | --- | --- |
| Criar projeto | Sim | Sim | Sim |
| Ver todos os projetos da empresa | Sim | Sim | Não |
| Ver e editar projeto próprio | Sim | Sim | Sim |
| Abrir projeto compartilhado | Sim | Sim | Sim (se for destinatário) |
| Compartilhar projeto com arquiteto | Sim | Sim | Não |
| Excluir projeto próprio | Sim | Sim | Sim |
| Excluir projeto de terceiro | Sim | Não | Não |
| Gerenciar usuários e convites internos da equipe | Sim | Convites da equipe, sem remover admin | Não |
| Editar biblioteca de fontes e a marca | Sim | Não | Não |
| Ver fila de leads e pedidos de orçamento | Sim | Sim | Não (só os próprios pedidos) |
| Pedir orçamento / falar com a Topfix | Sim | Não precisa | Sim |
| Exportar PNG/PDF (sempre com marca Topfix) | Sim | Sim | Sim |
| Alterar textos de aviso de estimativa | Sim | Não | Não |
| Ver ou editar projetos da Bart / fluxo DIALux | Não se aplica | Não se aplica | Não se aplica |

Regras extras:

- A marca Topfix não pode ser removida do PDF/PNG por nenhum perfil.
- Arquiteto não vê dados de outros escritórios.
- Projeto interno da equipe pode ficar "privado Topfix" (não aparece para o arquiteto) até ser compartilhado.
- Soft delete, com restauração pelo admin por 30 dias.
- O cadastro aberto só oferece os papéis `arquiteto` e `parceiro`. Não há caminho público para criar admin ou equipe.
- Compartilhar um projeto com um arquiteto pressupõe que ele já tenha conta (ou o convida a se cadastrar e, depois do login, abre o projeto).

---

## 3. Jornadas principais

### 3.1 Arquiteto: do zero ao PDF com marca Topfix

1. Entra na página de cadastro (aberta, sem convite). Informa nome, e-mail, telefone/WhatsApp, escritório, cidade e CAU (opcional), cria uma senha e aceita termos e política de privacidade (LGPD). O cadastro já vira lead para a Topfix.
2. Entra no app (web). Vê a lista dos seus projetos e um botão claro: "Novo projeto".
3. Informa nome do projeto, cliente (opcional), cidade e observações.
4. Cria um ambiente (ex.: "Sala estar"). Escolhe tipologia NBR (ex.: área de estar) e informa pé-direito.
5. Monta a base 2D de um de três jeitos (os três são frequentes no dia a dia do arquiteto):
   - desenha paredes e vãos na mão, digitando medidas;
   - importa um DXF ou DWG e valida a escala (unidade + uma medida real conhecida);
   - coloca um PDF ou imagem como fundo, calibra a escala marcando duas pontas e informando a medida, e decalca as paredes por cima (sem o app detectar parede sozinho).
6. Entra no **Modo Croqui**, em planta ou em corte. Posiciona fontes (Facho, Linear direcionado, Linha difusa, Difusa). Ajusta código, CCT, intensidade e altura. Desenha limites que geram sombra. A legenda se monta sozinha.
7. Roda o **método dos lúmens** e, se quiser, o **ponto a ponto** simplificado. Lê o resultado com o aviso de estimativa e a comparação com o alvo NBR.
8. Exporta PNG (planta completa e/ou só as manchas com fundo transparente) e PDF A4 paisagem, com legenda, marca Topfix e o aviso de que não é laudo.
9. Se quiser, clica em "Pedir orçamento" ou "Falar com a Topfix". Isso abre um lead para a equipe.

Critério de sucesso desta jornada: um arquiteto consegue cumprir os passos 1 a 8 sozinho, em um ambiente residencial simples, na primeira sessão, sem treino formal.

### 3.2 Equipe Topfix: montar e compartilhar

1. Cria o projeto internamente, já com a marca e o padrão da casa.
2. Prepara o croqui e as estimativas para uma reunião.
3. Compartilha o projeto com um arquiteto que já tem conta (permissão de ver ou editar). Se ele ainda não tiver conta, envia o link do cadastro e, depois, compartilha o projeto.
4. Acompanha a fila de leads (novos cadastros e pedidos de orçamento).

### 3.3 Admin: deixar o app pronto para uso

1. Convida a equipe internamente, configura o logo, as cores e o texto jurídico dos avisos.
2. Mantém a biblioteca genérica de fontes e a tabela NBR.
3. Vê usuários (incluindo cadastros abertos), leads e exclusões.

---

## 4. Módulos da Fase 1

Cada módulo abaixo descreve o que construir, as regras e o que fica de fora.

### 4.1 Projetos

- Lista com busca, filtro (meus / compartilhados / arquivados) e data de atualização.
- Um projeto contém um ou mais ambientes (cômodos ou áreas).
- Campos do projeto: nome, cliente (opcional), cidade, responsável, status (rascunho, em andamento, compartilhado, arquivado), observações, datas de criação e atualização.
- Campos do ambiente: nome, tipologia NBR, pé-direito, altura do plano de trabalho (padrão 0,75 m), fator de manutenção, grupo de cores do ambiente (claras, médias, escuras ou personalizado), notas.
- Ações: duplicar ambiente, duplicar projeto, arquivar, compartilhar (e-mail do arquiteto + permissão ver ou editar), excluir.
- Todo projeto nasce com um ambiente em branco e atalhos para "desenhar", "importar DXF/DWG" ou "colocar PDF/imagem".

### 4.2 Editor 2D de ambiente

Canvas 2D (planta, e um modo corte por ambiente). Unidade de trabalho: metro. Grid e snap configuráveis (padrão: snap 0,05 m). Zoom, pan, desfazer/refazer (pelo menos 50 passos).

**Desenho manual**

- Parede: polilinha com espessura (padrão 0,15 m) e comprimento editável (digitado ou arrastado).
- Ambiente fechado: o sistema detecta o polígono quando as paredes se fecham e calcula a área automaticamente.
- Também vale um retângulo rápido (largura × comprimento), para o caso mais simples.
- Vãos: porta e janela, com largura e peitoril (janela). No corte, a altura do vão aparece. Janela é só geometria: sem tecido, sem luz natural (ver seção "Para decidir depois").
- Texto, cota linear e um recinto (zona) opcional dentro do ambiente.
- Camadas simples: base (paredes), vãos, cotas, croqui, cálculos. Ligar/desligar visibilidade.

**Importação DXF**

- Aceitar DXF (ASCII e, se viável, binário). Limite inicial: 15 MB e 50 mil entidades. Acima disso, recusar com mensagem clara.
- Ao importar, abrir o fluxo **Validar escala**, no espírito do LuxSintax:
  1. mostrar um preview das entidades;
  2. escolher a unidade do arquivo (mm, cm, m, polegadas, pés, ou personalizada);
  3. informar uma largura ou medida real conhecida, ou medir um trecho no preview (duas pontas + valor);
  4. exibir o resultado em metros (ex.: 11,95 no arquivo vira 7,30 m) e pedir confirmação em "Aplicar escala".
- Depois da escala, o usuário escolhe quais camadas entram na base. Por padrão, ignorar textos de carimbo, hatches densos e entidades fora de uma margem razoável.
- O DXF entra como geometria de referência (linhas/polilinhas). Não tentar adivinhar sozinho o que é parede estrutural. O usuário "promove" trechos a parede ou desenha por cima.
- Se a unidade ou a escala não estiver validada, bloquear o cálculo até a confirmação.

**Importação DWG (conversão no servidor)**

O DWG é formato proprietário da Autodesk. Não dá para lê-lo com qualidade no navegador, e não devemos escrever um parser próprio. Na Fase 1 o DWG entra **convertido para DXF** e depois segue o mesmo fluxo de escala e camadas.

Abordagem proposta (complexidade **média**, não alta):

1. O mesmo botão "Importar planta CAD" aceita DXF e DWG. Se for DXF, vai direto à validação de escala. Se for DWG, um job no servidor converte para DXF e só então abre o preview.
2. A UI mostra "Convertendo DWG…". Se a conversão falhar, a mensagem explica isso e sugere salvar como DXF no AutoCAD (caminho de reserva, sempre disponível).
3. Conversor preferido: **ODA File Converter**, em um worker isolado (não no browser). É o caminho de melhor fidelidade com arquivos reais de AutoCAD. Antes de ir a produção, **confirmar a licença da ODA para uso desassistido em servidor**. Se a licença não cobrir ou não valer a pena no momento, usar **LibreDWG** (`dwg2dxf`) no mesmo worker, aceitando compatibilidade menor com versões novas ou arquivos muito complexos, e mantendo o fallback para DXF.
4. Não expor o DWG bruto no canvas. Guardar o arquivo original e o DXF convertido. Limite: 15 MB na origem; depois da conversão, o mesmo teto de 50 mil entidades.
5. Fora de escopo: editar ou reexportar DWG nativo.

**PDF ou imagem como fundo (para decalcar)**

Decisão de 18/11/2026, 20:38: PDF e imagem também são frequentes. Na Fase 1 entram como **fundo calibrado**, não como planta reconhecida automaticamente (isso continua na Fase 3).

- Aceitar PDF (o usuário escolhe a página; padrão: a primeira) e imagens (PNG, JPG, WEBP). Limite: 15 MB.
- O PDF é rasterizado para o canvas (ex.: pdf.js). Não tentar extrair vetores de parede.
- Calibração de escala, obrigatória: o usuário marca **duas pontas** de uma medida conhecida (ex.: a face de uma parede) e informa o valor real (em m ou cm). O sistema aplica a escala. Dá para girar, posicionar e repetir a calibração. Se já houver paredes desenhadas e a escala mudar, perguntar se elas devem ser redimensionadas.
- Com a escala aplicada, o usuário **decalca** as paredes e os vãos por cima, no desenho manual. O fundo fica numa camada própria, com opacidade ajustável e opção de travar para não sair do lugar enquanto se desenha.
- Recusar o cálculo enquanto a escala do fundo não estiver validada (se aquele ambiente usa o fundo como base).
- Não há detecção automática de paredes nesta fase.

**Modo corte**

- Um corte por ambiente, no começo (um plano).
- O usuário desenha o perfil (piso, teto, paredes, vãos) ou gera um corte esquemático a partir da planta (retângulo de pé-direito + vãos da parede cortada). A geração automática pode ser simples; o usuário corrige na mão.
- O croqui de luz no corte usa as mesmas quatro naturezas de fonte.

Fora desta fase: modelagem BIM, edição ou exportação nativa de DWG, reconhecimento automático de parede em PDF/imagem (Fase 3), simbologia elétrica completa, folhas de prancha tipo CAD.

### 4.3 Biblioteca de fontes e luminárias genéricas

Na Fase 1 a biblioteca é **genérica**, com parâmetros. Não depende de IES/LDT (Fase 3). Luminárias da Bart não entram nesta fase; a pergunta ficou na seção "Para decidir depois".

Quatro naturezas, iguais às do vídeo do LuxSintax:

| Código interno | Nome na UI | Comportamento visual no croqui | Parâmetros principais |
| --- | --- | --- | --- |
| facho | Facho | Cone / mancha dirigida, borda mais nítida | Intensidade, ângulo de abertura, orientação, inclinação |
| linear_dirigido | Linear direcionado | Faixa contínua com direção (ex.: rasante, arandela em ritmo) | Fluxo ou intensidade por metro, comprimento, direção |
| linha_difusa | Linha difusa | Faixa suave, pouco direcional | Fluxo por metro, comprimento |
| difusa | Difusa | Mancha circular suave, omnidirecional no plano | Fluxo ou intensidade, raio visual |

Campos comuns de cada instância no desenho:

- código automático (L01, L02, …), editável, único no ambiente;
- natureza;
- posição (x, y) na planta; no corte, também z;
- rotação no plano e, se couber, inclinação (tilt);
- CCT (K), de 1800 a 6500, com presets 2700, 3000, 4000, 5000, 6500;
- intensidade relativa (0 a 100%), usada no croqui;
- altura de montagem (m);
- fluxo luminoso Φ (lm) e/ou intensidade I (cd), para o cálculo;
- potência (W), opcional, só informativa;
- ângulo de abertura do facho (graus), quando a natureza for facho;
- comprimento (m), quando for linear;
- visível no croqui, sim/não.

A biblioteca traz 8 a 12 presets de partida (ex.: "Spot 3000 K 24°", "Linear 4000 K 1,2 m", "Plafon difuso 3000 K") para o arquiteto não começar do zero. Admin pode criar, editar e desativar presets. Instâncias já colocadas no projeto não mudam se o preset mudar depois (copiam os valores no momento da inserção).

Nenhum logo, nome comercial ou SKU da Bart aparece na UI da Fase 1. Se a ideia de catálogo for retomada, ver a seção "Para decidir depois".

### 4.4 Modo Croqui

É o módulo mais visível e o que deve empatar com o vídeo de referência. Objetivo: o cliente (e o arquiteto) enxergarem a intenção de luz **antes** do número.

**Entrada e layout**

- Atalho fixo no menu do ambiente: Croqui, M. Lúmens, P2P horiz., P2P vert., NBR (as mesmas abas de referência, em português claro).
- Painel esquerdo: Planta / Corte, base (importar DXF/DWG, fundo PDF/imagem, desenhar), lista de fontes, exportar, salvar.
- A área de desenho mostra a planta (ou o corte) e as manchas de luz em tempo real.

**Regras de renderização das manchas (2D)**

Estas regras são o contrato visual da Fase 1. Podem ser ajustadas no polimento, mas a implementação deve segui-las de partida.

- Cor da mancha vem do CCT, de forma contínua: 2700 K puxa para âmbar quente, 3000 K branco quente, 4000 K neutro, 6500 K branco frio. Não usar uma cor só para todas as fontes.
- A opacidade e o "brilho" da mancha acompanham a intensidade relativa (0 a 100%). 0% = invisível; 100% = mancha cheia, sem estourar o fundo a ponto de apagar a planta.
- A **altura de montagem** altera o tamanho aparente da mancha na planta: fonte mais alta = mancha mais larga e um pouco mais suave; fonte mais baixa = mancha mais concentrada. É um efeito visual de intenção, não o cálculo do P2P (este usa a fórmula da seção 4.6).
- **Facho:** mancha em setor/elipse na direção do eixo. Dentro do ângulo de abertura, a intensidade visual cai do centro para a borda (queda suave, tipo gaussiana ou cosseno). Fora do ângulo, a mancha some (com uma pequena faixa de transição para não serrilhar).
- **Linear direcionado:** faixa ao longo do comprimento, com lóbulo para um lado (direção). Serve para rasante, arandela e linear de destaque.
- **Linha difusa:** faixa simétrica e suave ao longo do comprimento, sem lado dominante.
- **Difusa:** mancha circular (ou quase) em torno do ponto, queda suave até desaparecer.
- **Limites e sombra:** paredes e linhas marcadas como "limite de croqui" bloqueiam o alcance da luz no plano. Um raio que parte da fonte e cruza um limite não ilumina o que está atrás (sombra dura, com uma penumbra curta só para não serrilhar). Vãos de porta, por padrão, **não** bloqueiam. Janelas, no croqui artificial, também não bloqueiam (são buracos na parede).
- Várias fontes se somam visualmente (adição das manchas, com teto de brilho para o fundo da planta continuar legível).
- A planta (linhas, cotas, móveis de referência) permanece visível acima ou misturada, nunca apagada pela mancha.
- Desempenho alvo: edição fluida com até 80 fontes e 400 segmentos de parede em um ambiente (ver requisitos não funcionais).

**Ajuste por fonte**

- Ao selecionar uma fonte, o painel mostra: código, CCT (slider + valor), intensidade (%), altura (m), e os parâmetros da natureza (abertura, comprimento, rotação).
- Mudanças se refletem na mancha imediatamente.
- Duplicar, alinhar, distribuir e copiar propriedades (CCT/intensidade) entre fontes selecionadas.

**Legenda automática**

- Monta sozinha enquanto o usuário desenha.
- Agrupa por código + natureza + CCT, e mostra a quantidade.
- Exemplo de linha: `L01 · Difusa · 3000 K · 7`.
- A legenda entra no PNG/PDF e pode ser arrastada no quadro, sem soltar as margens de impressão.

**Salvar**

- "Salvar" grava o croqui no projeto, em "Croqui conceitual" do ambiente (pode haver um croqui de planta e um de corte).
- Auto-save a cada 30 s de ociosidade após alteração, e ao trocar de aba, com indicador de "salvo / salvando / erro".

### 4.5 Cálculo: método dos lúmens

Estimativa da iluminância média mantida no plano de trabalho, ou do número de fontes necessário para um alvo. Sem inter-reflexão detalhada além do fator de utilização (FU) tabelado.

**Fórmulas** (usar exatamente estas, e exibi-las no memorial do PDF)

Iluminância média estimada:

`E_med = (N × Φ × FU × FM) / A`

Número de fontes para um alvo:

`N = (E_alvo × A) / (Φ × FU × FM)`

(arredondar N para cima, e recalcular E_med com o N inteiro.)

Índice do local (ambiente retangular):

`K = (C × L) / (h_m × (C + L))`

Para polígono irregular, usar `C` e `L` do retângulo de área equivalente (menor retângulo alinhado, ou `C = A / L_max` e `L = L_max`). Deixar essa escolha explícita na UI e no memorial.

Onde:

- `E_med` e `E_alvo` em lux (lx)
- `N` = quantidade de fontes do mesmo tipo no cálculo (ou o equivalente, se houver mais de um tipo: somar `N_i × Φ_i` no numerador)
- `Φ` = fluxo luminoso de cada fonte (lm), informado na biblioteca
- `FU` = fator de utilização (adimensional)
- `FM` = fator de manutenção (adimensional)
- `A` = área do ambiente (m²)
- `C`, `L` = largura e comprimento (m)
- `h_m` = altura de montagem acima do plano de trabalho (m) = altura da fonte − altura do plano (padrão do plano: 0,75 m)

Vários tipos no mesmo ambiente: `E_med = (Σ (N_i × Φ_i) × FU × FM) / A`. O FU, nesta fase, é único por ambiente (simplificação declarada no aviso). Não calcular um FU por tipo.

**Fator de manutenção (FM)**

Presets iguais aos da referência, editáveis pelo admin:

| Condição | FM inicial |
| --- | --- |
| Limpo | 0,80 |
| Normal | 0,70 |
| Sujo | 0,60 |

**Fator de utilização (FU)**

Tabela simplificada, em função do índice K e do grupo de refletâncias. Valores de partida (validar em bancada antes do lançamento; o admin pode editar a tabela):

Refletâncias de partida:

| Grupo | ρ teto | ρ paredes | ρ piso |
| --- | --- | --- | --- |
| Claras | 0,70 | 0,50 | 0,30 |
| Médias | 0,70 | 0,50 | 0,20 |
| Escuras | 0,50 | 0,30 | 0,10 |
| Personalizado | informado pelo usuário | informado pelo usuário | informado pelo usuário |

No personalizado, usar a linha da tabela cujo trio (teto/paredes/piso) for o mais próximo; se nenhum estiver perto, interpolar entre as duas linhas mais próximas e declarar a interpolação no memorial.

| K | FU claras | FU médias | FU escuras |
| --- | --- | --- | --- |
| 0,6 | 0,40 | 0,34 | 0,26 |
| 0,8 | 0,45 | 0,39 | 0,30 |
| 1,0 | 0,50 | 0,44 | 0,34 |
| 1,25 | 0,55 | 0,49 | 0,38 |
| 1,5 | 0,60 | 0,53 | 0,42 |
| 2,0 | 0,66 | 0,59 | 0,47 |
| 2,5 | 0,70 | 0,63 | 0,51 |
| 3,0 | 0,73 | 0,66 | 0,54 |
| 4,0 | 0,77 | 0,70 | 0,57 |
| 5,0 | 0,80 | 0,73 | 0,60 |

Para K intermediário, interpolar linearmente. Para K < 0,6, usar a linha 0,6 e avisar que o ambiente é muito alto/estreito para a tabela. Para K > 5, usar a linha 5,0 e avisar do mesmo modo.

**UI do módulo**

- Mostra A, K, h_m, FM, grupo de cores, Φ e N por tipo, E_alvo (vindo da NBR ou informado), E_med, e a diferença percentual para o alvo.
- Se E_med estiver 10% ou mais abaixo do alvo, status "abaixo do alvo". Entre −10% e +20%, "na faixa". Acima de +20%, "acima do alvo" (não é erro, só um alerta de possível excesso).
- Botão "sugerir quantidade": calcula N e oferece aplicar (cria ou ajusta a quantidade de fontes do tipo selecionado; o usuário confirma, não aplica no escuro).
- Memorial em texto, incluído no PDF: fórmulas, valores e o aviso de estimativa.

Fora desta fase: curva fotométrica real, FU por fabricante, inter-reflexão calculada, luz natural neste método.

### 4.6 Cálculo: ponto a ponto simplificado

Estimativa da iluminância em uma grade no plano (horizontal ou vertical), **somente componente direta**. Sem inter-reflexão, sem obstrução 3D complexa, sem IES/LDT. É o mesmo recorte teórico que o LuxSintax declara no site (lei do inverso do quadrado e lei do cosseno cúbico).

**Grade**

- Plano horizontal: z = altura do plano de trabalho (padrão 0,75 m), recobrindo o polígono do ambiente.
- Plano vertical: o usuário escolhe uma parede ou desenha um segmento; a grade fica sobre esse plano (útil para rasante e destaque).
- Espaçamento padrão: 0,50 m (editável entre 0,25 e 1,00 m).
- Pontos caem no interior do polígono. Uma margem de 0,20 m das paredes pode ser ligada (padrão: ligada), no espírito de não medir encostado na parede.

**Fórmulas** (exibir no memorial)

Para cada ponto P e cada fonte S, a distância 3D é:

`d = sqrt((x_P − x_S)² + (y_P − y_S)² + (z_P − z_S)²)`

Ângulo de incidência no plano de cálculo (horizontal):

`cos θ = h / d`, com `h = |z_S − z_P|`

Se `d = 0` ou `cos θ ≤ 0`, aquela fonte não contribui naquele ponto.

Intensidade na direção do ponto, modelo simplificado da Fase 1:

- Seja `α` o ângulo entre o eixo da fonte (nadir, ou o eixo do facho) e o raio S→P.
- `α_abe` = meia abertura do facho (para difusa, tratar como 180°; para lineares, ver nota abaixo).
- `I(α) = I_0 × cos α`, se `α ≤ α_abe`; senão `I(α) = 0`. (Queda tipo cosseno dentro do facho; corte fora dele.)
- `I_0` vem do campo de intensidade (cd). Se o usuário informou só o fluxo Φ (lm) e a abertura, estimar `I_0 = Φ / Ω`, com `Ω = 2π (1 − cos α_abe)` para um facho de revolução. Se a natureza for difusa, `I_0 = Φ / π` (hipótese lambertiana simples, declarada no aviso). Essas conversões são aproximações e devem aparecer no memorial.

Iluminância parcial (lei do inverso do quadrado e do cosseno):

`E_{S→P} = I(α) × cos θ / d²`

Forma equivalente do **cosseno cúbico**, quando o plano é horizontal e `h` é a altura da fonte sobre o plano:

`E_{S→P} = I(α) × cos³ θ / h²`

(As duas formas são iguais, porque `d = h / cos θ`. Usar uma delas na implementação, e citar as duas no memorial.)

Iluminância total no ponto (só componente direta):

`E_P = Σ_S E_{S→P}`

Resumo do ambiente:

- `E_med` = média dos `E_P`
- `E_min` = mínimo dos `E_P`
- `E_máx` = máximo dos `E_P`
- Uniformidade `U0 = E_min / E_med` (se `E_med > 0`)

**Limites e paredes no P2P**

- Na Fase 1, um segmento marcado como parede ou limite **bloqueia** a contribuição de S em P se o segmento cruzar a projeção horizontal do raio S→P (teste 2D). É uma sombra geométrica simplificada, não uma simulação de oclusão 3D.
- Essa simplificação entra no aviso de precisão.

**Fontes lineares**

- Tratar a linha como uma série de pontos virtuais igualmente espaçados (passo padrão 0,20 m), cada um com `I_0` (ou Φ) dividido pelo número de pontos. Somar as contribuições. Declaração no memorial: "linear discretizada de 0,20 m".

**UI**

- Mapa em cores falsas (escala visível, ex.: 0 / 50 / 100 / 200 / 300 / 500 / 750 / 1000 lx), ligável e desligável.
- Tabela resumo: E_med, E_min, E_máx, U0, comparação com o alvo NBR.
- Alternância P2P horizontal / P2P vertical, como nas abas de referência.
- O mapa não pode aparecer sem a escala e sem o aviso de estimativa.

Fora desta fase: IES/LDT real, radiosidade, UGR calculado, ofuscamento, luz natural climática.

### 4.7 Verificação NBR ISO/CIE 8995-1

A norma é, em origem, para **locais de trabalho internos**. Valores residenciais entram nesta tabela como prática usual de mercado, claramente rotulados, para o arquiteto da Topfix ter um alvo no dia a dia. **Toda a tabela precisa ser conferida com o texto oficial da norma (e com a prática residencial usual) antes do lançamento.** O admin pode editar os valores.

Colunas: tipologia, uso (residencial / comercial / ambos), E_alvo (lx) no plano de tarefa, UGRL máximo de referência, R_a mínimo de referência. Na Fase 1, UGRL e R_a são só informativos (não calculamos UGR nem IRC).

| Tipologia | Uso | E_alvo (lx) | UGRL máx. (ref.) | R_a mín. (ref.) |
| --- | --- | --- | --- | --- |
| Circulação, corredor, hall | Ambos | 100 | 28 | 40 |
| Escadas | Ambos | 150 | 25 | 40 |
| Área de estar / sala | Residencial | 150 | n/a | 80 |
| Quarto | Residencial | 100 | n/a | 80 |
| Cozinha, geral | Residencial | 200 | n/a | 80 |
| Cozinha, bancada / pia | Residencial | 500 | n/a | 80 |
| Banheiro, geral | Residencial | 200 | n/a | 80 |
| Banheiro, espelho | Residencial | 500 | n/a | 80 |
| Área de serviço / lavanderia | Residencial | 200 | n/a | 80 |
| Home office / leitura e escrita | Residencial | 500 | 19 | 80 |
| Escritório: escrever, teclar, ler | Comercial | 500 | 19 | 80 |
| Sala de reunião / conferência | Comercial | 500 | 19 | 80 |
| Recepção (balcão) | Comercial | 300 | 22 | 80 |
| Arquivo / estoque | Comercial | 200 | 25 | 60 |
| Sala de aula | Comercial | 300 | 19 | 80 |
| Loja / área de vendas | Comercial | 300 | 22 | 80 |
| Checkout / caixa | Comercial | 500 | 19 | 80 |
| Restaurante / refeitório | Comercial | 200 | 22 | 80 |
| Cozinha profissional | Comercial | 500 | 22 | 80 |
| Consultório / exame geral | Comercial | 500 | 19 | 90 |

(Na tabela, "n/a" no UGRL residencial significa que a norma de locais de trabalho não fixa UGR típico para esse uso. Na UI, mostrar "não aplicável".)

**UI**

- O ambiente escolhe uma tipologia. O E_alvo preenche o método dos lúmens e o P2P.
- A aba NBR mostra: tipologia, E_alvo, E_med (lúmens e/ou P2P, rotulados à parte), status na faixa, e um texto curto: "Referência: NBR ISO/CIE 8995-1 (locais de trabalho). Valores residenciais são prática usual, não um laudo."
- O usuário pode sobrescrever o alvo (campo "alvo do projeto"), e o PDF registra se o alvo é o da tabela ou um valor próprio.

### 4.8 Exportações com a marca Topfix

Sempre com logo, nome Topfix, data, nome do projeto e do ambiente, e o aviso de estimativa (ver seção 6). Nenhum perfil remove a marca.

| Formato | Conteúdo |
| --- | --- |
| PNG planta | Imagem completa do croqui (planta ou corte), com legenda |
| PNG luzes | Só as manchas, fundo transparente, para o arquiteto sobrepor num render |
| PDF A4 paisagem | Capa ou cabeçalho com marca, planta e/ou corte, legenda, resumo de cálculo (lúmens e P2P se existirem), tipologia NBR, aviso de estimativa, rodapé com contato Topfix |

Regras:

- Resolução do PNG da planta: no mínimo 1920 px no lado maior, fundo da cor do app (escuro ou claro, conforme o tema do quadro).
- PNG de luzes: o mesmo enquadramento e escala da planta, sem paredes, só manchas e, opcionalmente, a legenda desligável.
- PDF: uma folha por ambiente no começo; se couber, planta + resumo na mesma folha. Qualidade suficiente para imprimir em A4 (300 dpi nas imagens).
- Nome do arquivo: `Topfix_Croqui_<projeto>_<ambiente>_AAAA-MM-DD`.
- O botão "Pedir orçamento" pode aparecer no rodapé do PDF como texto + URL curta (e também na UI).

### 4.9 Autenticação, cadastro, lead e orçamento Topfix

Objetivo: o arquiteto entra sozinho, a Topfix fica sabendo de cada conta nova, e o uso da ferramenta pode virar conversa de venda.

**Cadastro aberto (decisão fechada)**

- Arquiteto e parceiro criam o próprio login, sem convite, numa página pública de cadastro.
- Campos obrigatórios: nome, e-mail, telefone/WhatsApp, escritório, cidade, senha, aceite dos termos e da política de privacidade (LGPD), com os links visíveis.
- Campo opcional: número do CAU.
- Papel no cadastro: `arquiteto` ou `parceiro` (escolha do usuário). Não existe opção de se cadastrar como admin ou equipe.
- Ao concluir o cadastro, o sistema cria o usuário e **abre automaticamente um lead** para a Topfix, origem `cadastro`, com os mesmos dados. Não depende de um pedido de orçamento.
- Depois do cadastro, o usuário entra com e-mail e senha. Há recuperação de senha.
- Admin e equipe Topfix entram só por **convite interno** do admin (e-mail com prazo, ex.: 7 dias). Esse convite não é o caminho do arquiteto.

**Proteções sugeridas** (não são decisão fechada; recomenda-se incluir já na Fase 1, por ser cadastro aberto):

- Confirmação de e-mail antes de liberar o uso pleno da conta (o lead de cadastro pode nascer já na inscrição, mesmo antes da confirmação, com status "e-mail pendente").
- Anti-spam: limite de tentativas de cadastro por IP e por e-mail, e um CAPTCHA (ou equivalente) no formulário público.
- Recusar e-mails claramente temporários ou inválidos, se for barato de fazer.
- Logar tentativas suspeitas para o admin.

**Pedido de orçamento**

- Botão persistente na UI do projeto, visível para arquiteto e parceiro: "Pedir orçamento" / "Falar com a Topfix".
- Formulário curto: mensagem e ambiente de interesse; nome, escritório, e-mail, telefone e cidade já vêm da conta e podem ser conferidos. O projeto (e prints recentes, ou um link interno) vai anexado para a equipe abrir o mesmo trabalho.
- Novo aceite LGPD só se a política tiver mudado; no pedido, um lembrete do uso dos dados basta se o cadastro já teve o aceite.
- A equipe Topfix vê uma fila única: data, origem (`cadastro` ou `orcamento`), status (novo, e-mail pendente, em atendimento, fechado), responsável.
- E-mail de aviso para a equipe (endereço configurável pelo admin) a cada lead novo, de cadastro ou de orçamento.
- O arquiteto vê só a confirmação de envio do orçamento, não a fila interna.

---

## 5. Modelo de dados

Entidades e campos principais. Nomes em inglês no banco, rótulos em português na UI. Campos `id`, `created_at` e `updated_at` em todas as tabelas. Exclusão lógica: `deleted_at`.

| Entidade | Campos principais | Relações |
| --- | --- | --- |
| users | nome, e-mail, telefone_whatsapp, cau (opcional), papel (`admin`, `equipe`, `arquiteto`, `parceiro`), escritório, cidade, status, origem_conta (`self_signup`, `convite_interno`), email_confirmado_em, aceite_termos_em, aceite_privacidade_em | muitos projetos; muitos leads |
| invites | e-mail, papel (`admin` ou `equipe` somente), token, expiração, status, convidado_por | convite interno da equipe; não é o cadastro do arquiteto |
| projects | nome, cliente, cidade, status, notas, criado_por, organizacao (`topfix`) | ambientes; compartilhamentos; exportações |
| project_shares | projeto_id, user_id, permissão (`ver`, `editar`) | projeto, usuário |
| rooms | projeto_id, nome, tipologia_id, pe_direito_m, altura_plano_m, fm, grupo_cores, rho_teto, rho_paredes, rho_piso, alvo_lx (override opcional), notas | paredes, vãos, fontes, croquis, cálculos |
| walls | room_id, polilinha (lista de pontos x,y em metros), espessura_m, é_limite_de_croqui (bool) | vãos |
| openings | wall_id, tipo (`porta`, `janela`), posição no segmento, largura_m, peitoril_m, altura_m | parede |
| sources | room_id, codigo, natureza, preset_id (opcional), x, y, z, rotacao_deg, tilt_deg, cct_k, intensidade_pct, altura_m, fluxo_lm, intensidade_cd, potencia_w, abertura_deg, comprimento_m, visivel | ambiente; preset |
| library_presets | nome, natureza, parâmetros padrão (json), ativo, criado_por_admin | fontes |
| sketches | room_id, vista (`planta`, `corte`), estado do quadro (json: câmera, legenda, camadas), versão | ambiente |
| underlays | room_id, tipo (`dxf`, `dwg`, `pdf`, `imagem`), arquivo_origem, arquivo_dxf (se veio de DWG), unidade_origem, pagina_pdf, p1, p2, medida_informada_m, escala, rotação, opacidade, validado_em | ambiente, arquivo |
| calculations | room_id, tipo (`lumen`, `p2p_h`, `p2p_v`), entradas (json), resultados (json: E_med, E_min, E_max, U0, K, FU, grade opcional), aviso_versão | ambiente |
| nbr_types | nome, uso, e_alvo_lx, ugrl_max, ra_min, fonte_nota, ativo | ambientes |
| exports | projeto_id, room_id, tipo (`png_planta`, `png_luzes`, `pdf`), arquivo, gerado_por | projeto, usuário |
| leads | user_id, projeto_id (opcional; vazio no cadastro), origem (`cadastro`, `orcamento`), nome, escritório, e-mail, telefone_whatsapp, cidade, cau, mensagem, status, responsável_id, consentimento_em | usuário, projeto |
| files | bucket, caminho, mime, tamanho, uploaded_by | underlays, exports |
| audit_logs | ator, ação, entidade, entidade_id, metadados | conformidade e suporte |

Regras de integridade:

- `codigo` da fonte é único por ambiente.
- Não calcular (ou marcar o cálculo como "escala pendente") se o ambiente tiver underlay (DXF, DWG, PDF ou imagem) sem `validado_em`.
- Compartilhamento não atravessa o isolamento por usuário: um arquiteto só entra via `project_shares` ou como `criado_por`.
- Resultados de cálculo são gravados (snapshot), para o PDF não mudar se a fórmula for ajustada depois. A versão da fórmula fica em `aviso_versão`.
- Cadastro público só pode gravar papel `arquiteto` ou `parceiro`. Convite interno só pode gravar `admin` ou `equipe`.
- Todo `users` com origem_conta `self_signup` gera um `leads` de origem `cadastro` no mesmo momento.
- E-mail de usuário é único.

---

## 6. Regras e limites de precisão

Texto de aviso padrão (obrigatório na UI das abas de cálculo, no PNG se houver mapa de cores, e em toda página do PDF). O admin pode editar o texto, mas não desligar o aviso.

> Os números deste app são **estimativas** para estudo de intenção e pré-dimensionamento. Usam o método dos lúmens e, quando indicado, um ponto a ponto da componente direta (lei do inverso do quadrado e lei do cosseno). Não consideram inter-reflexão completa, curvas fotométricas reais (IES/LDT), obstruções detalhadas nem luz natural de precisão. **Não são laudo** e **não substituem** um projeto luminotécnico profissional (DIALux ou equivalente).

Regras de produto:

- Qualquer E_med, E_min, E_máx, U0 ou N sugerido aparece com o aviso visível (não só num rodapé distante).
- Mapas de cores falsas sempre saem com escala numérica e com o aviso. É proibido um mapa "bonito" sem escala (o problema apontado na resenha do Rayon).
- Não usar a palavra "exato", "laudo", "certificado" ou "conforme a norma" como selo automático. A checagem NBR é "comparado ao alvo de referência", nunca "aprovado pela NBR".
- Fórmulas e hipóteses (FU tabelado, FM, discretização de lineares, conversão Φ → I) entram no memorial.
- Se faltar Φ ou I na fonte, o cálculo pede o dado e não inventa um número escondido. Pode oferecer um valor típico do preset, desde que rotulado como "valor típico, confirme".
- Versão das fórmulas e da tabela NBR é registrada no cálculo e no PDF.

---

## 7. Requisitos não funcionais

| Tema | Requisito |
| --- | --- |
| Plataforma | App web, responsivo. Edição completa no computador (desktop/laptop). No celular e no tablet: visualizar projeto, croqui, resultados e PDF, pedir orçamento. Edição pesada no telefone não é meta da Fase 1. |
| Navegadores | Últimas duas versões de Chrome, Edge, Firefox e Safari. |
| Desempenho | Abrir um ambiente típico (até 80 fontes e 400 segmentos) em menos de 3 s após o download dos dados. Pan/zoom e arrasto de fonte a 30 fps ou mais no desktop médio. Gerar PDF em menos de 10 s para um ambiente. |
| Disponibilidade | Hospedagem web padrão, HTTPS obrigatório. Meta inicial: 99% no horário comercial (sem SLA vendido, o app não é produto comercial). |
| Auth | Cadastro aberto para arquiteto e parceiro (e-mail e senha). Convite interno, com prazo (ex.: 7 dias), só para admin e equipe. Recuperação de senha. Sessão com expiração. Papéis no servidor, não só na UI. Confirmação de e-mail e anti-spam: ver sugestões do módulo 4.9. |
| LGPD | Base legal e consentimento no cadastro e no lead. Política de privacidade e termos acessíveis. Mínimo de dados. Direito de acesso e exclusão (admin executa, prazo definido, ex.: 15 dias). Leads são dados pessoais. Sem vender dados. Sem cookie de marketing desnecessário na Fase 1. Logs de acesso a leads e a projetos de terceiros. Hospedar dados preferencialmente com provedor que permita região adequada (ex.: banco no Brasil ou, se não der, informar na política). |
| Arquivos | DXF, DWG, PDF e imagens de fundo até 15 MB cada; antivírus ou validação de tipo real (não só a extensão). Conversão de DWG no servidor, com tempo e fila limitados. |
| Auditoria | Registrar cadastro, login, convite interno, compartilhamento, exclusão, exportação e troca de papel. |
| Acessibilidade | Contraste legível, controles com texto, teclado no essencial da lista de projetos e formulários. O canvas 2D pode ser exceção parcial, mas o painel de propriedades precisa ser usável por teclado. |
| Idioma | pt-BR em toda a UI, avisos e PDF. |
| Backup | Backup diário do banco e dos arquivos, retenção mínima de 14 dias na Fase 1. |

---

## 8. Stack sugerida

Sugestão, não é decisão fechada de arquitetura. Pode ser trocada se o time justificar.

| Camada | Sugestão | Por quê |
| --- | --- | --- |
| App | Next.js (TypeScript) | App web único, telas, auth e geração de arquivos no mesmo repositório |
| Canvas 2D | Konva + react-konva (ou equivalente maduro) | Zoom, pan, camadas, hit-test e export para imagem com menos atrito que canvas cru |
| Auth, banco e arquivos | Supabase (Postgres, Auth, Storage) | Cadastro aberto, papéis, convites internos da equipe, arquivos DXF/DWG/PDF/PNG e leads num só lugar, alinhado ao que o time já tem à mão |
| Parser DXF | Biblioteca JS tipo `dxf-parser` (servidor ou cliente), com a validação de escala nossa | Evita reinventar o leitor; a regra de negócio é a escala e a promoção a parede |
| Conversão DWG | Worker no servidor: ODA File Converter (preferido, sujeito à licença) ou LibreDWG (`dwg2dxf`) como alternativa | O canvas só enxerga DXF. Ver abordagem no módulo 4.2 |
| Fundo PDF | pdf.js (ou equivalente) para rasterizar a página no canvas | Calibração pelas duas pontas é regra nossa, não do leitor de PDF |
| PDF | pdf-lib ou @react-pdf/renderer | Cabeçalho com marca, imagens do canvas, memorial e aviso |
| Hospedagem | Vercel (front) + Supabase (dados), ou um único provedor se for mais simples | HTTPS e preview de branches |
| Testes | Testes de fórmulas (lúmens, P2P, sombra 2D) em unidade; um fluxo e2e da jornada 3.1 | As fórmulas não podem "quase acertar" |

O 3D (three.js) **não** entra nesta stack agora. Deixar o modelo de dados (paredes, vãos, fontes com x,y,z) pronto para a Fase 2, sem construir o visualizador.

---

## 9. Roadmap

### Fase 1 (atual): app 2D completo o suficiente para uso real

Entregas sugeridas, nesta ordem. Cada entrega deve poder ser demonstrada ao Tiago.

| Entrega | Conteúdo | Saída visível |
| --- | --- | --- |
| E1. Base e acesso | Projeto Next.js, Supabase, cadastro aberto do arquiteto/parceiro (campos do módulo 4.9, aceite LGPD, lead automático), convite interno só para a equipe, login, papéis, casca da UI (menu, marca, avisos). Incluir, se possível já aqui, as proteções sugeridas (confirmação de e-mail e anti-spam). | Um arquiteto se cadastra sozinho e aparece na fila de leads; o admin convida um usuário da equipe; ambos entram com papéis certos |
| E2. Projetos e editor manual | CRUD de projetos e ambientes, canvas, retângulo/paredes, portas e janelas (só geometria), cotas, área, desfazer, auto-save | Ambiente residencial desenhado na mão, com área certa |
| E3. Importação | DXF com validação de escala e camadas; DWG via conversão no servidor (mesmo fluxo depois do DXF); PDF/imagem como fundo, calibração por duas pontas + medida, para decalcar paredes | Um DXF, um DWG e um PDF/imagem de arquiteto entram no quadro, em metros, sem reconhecimento automático |
| E4. Modo Croqui | Quatro naturezas, ajuste por fonte, limites/sombra, legenda automática, planta e corte, presets da biblioteca | Um croqui no nível do vídeo de referência, em 2D |
| E5. Cálculos e NBR | Método dos lúmens (fórmulas e tabela FU/FM), P2P horiz./vert. com cores falsas, aba NBR, memorial, avisos | Números reproduzíveis, com aviso de estimativa |
| E6. Exportar, lead e polimento | PNG planta, PNG luzes, PDF A4 com marca Topfix, fila de leads, botão de orçamento, visualização no celular, testes das fórmulas | Jornada 3.1 completa, ponta a ponta |


Critério para fechar a Fase 1: os critérios de aceite da seção 11, todos atendidos, num ambiente de homologação usado pela equipe Topfix e por pelo menos um arquiteto de teste.

### Fase 2: 3D (fora desta especificação de implementação, só o recorte)

- Extrusão das paredes e vãos já desenhados na Fase 1 (o modelo de dados já tem pé-direito e z das fontes).
- Vista 3D orbitável do ambiente, ligada à planta.
- Visualização dos fachos e manchas no volume (não um CAD).
- Stack prevista: three.js (ou react-three-fiber), reaproveitando o mesmo backend.
- Sem virar um Rayon. Sem atrasar a Fase 1.

### Fase 3: inteligência e fotometria real

- IA ou modelo para ler PDF/imagem de planta e sugerir paredes (com correção obrigatória do usuário).
- Leitura real de arquivos IES/LDT no ponto a ponto.

---

## 10. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| DXF/DWG de arquiteto chega sujo (unidade errada, milhares de camadas, blocos) ou o DWG falha na conversão | Alto: o usuário desiste na importação | Fluxo obrigatório de escala, escolha de camadas, limite de entidades, testes com arquivos reais da casa, mensagem clara se a conversão DWG falhar, e caminho manual ou "salve como DXF" sempre disponíveis |
| Usuário trata a estimativa como laudo | Alto: risco de credibilidade (e, no limite, de responsabilidade) | Aviso permanente, texto do PDF, proibição de selo "conforme a norma" |
| Ferramenta de luz não puxa venda da Topfix | Alto: o app cumpre o 2D e falha no objetivo de negócio | Na Fase 1, apoiar-se na marca, no lead e no botão de orçamento. Outras pontes (luz natural, cortinas) só no backlog, seção "Para decidir depois" |
| Escopo inchado (3D, IES, IA) invade a Fase 1 | Alto: não entrega | 3D e IES estão explícitos nas Fases 2 e 3. Qualquer pedido novo passa pelo histórico deste MD |
| Tabela NBR / FU publicada com valor errado | Médio: perda de confiança | Conferência com o texto oficial antes do lançamento; tabela editável pelo admin; versão no memorial |
| Desempenho do canvas com planta pesada | Médio | Limite de importação, layers, testes com DXF/DWG/PDF reais da casa |
| Escala errada em PDF/imagem (duas pontas mal marcadas) | Médio: área e lux saem errados | Calibração obrigatória, possibilidade de refazer, travar o fundo ao decalcar, e cálculo bloqueado até validar a escala |
| LGPD em leads de arquiteto | Médio | Consentimento, política, exclusão, acesso restrito à equipe |
| Cadastro aberto atrair spam ou contas falsas | Médio | Adotar as proteções sugeridas do módulo 4.9 (confirmação de e-mail, limite de tentativas, CAPTCHA) |

---

## 11. Critérios de aceite do MVP (Fase 1)

O MVP é aceito quando todos os itens abaixo forem verdadeiros, demonstráveis ao Tiago, com um projeto de teste realista (ex.: sala + cozinha de uma planta residencial):

1. Um arquiteto cria a própria conta na página pública (nome, e-mail, telefone/WhatsApp, escritório, cidade, CAU opcional, senha, aceite LGPD) e entra no app. Esse cadastro aparece na fila de leads da Topfix, origem `cadastro`. Um usuário da equipe entra só por convite interno. Os papéis veem apenas o que a permissão permite. Não há cadastro público para admin ou equipe.
2. É possível desenhar um ambiente na mão, com medidas, área automática, porta e janela.
3. É possível: (a) importar um DXF e validar a escala em metros; (b) importar um DWG, vê-lo convertido e validar a escala no mesmo fluxo; (c) colocar um PDF ou imagem como fundo, calibrar marcando duas pontas e informando a medida, e decalcar as paredes por cima. Em todos os casos, se a escala não for validada, o cálculo não roda. Reconhecimento automático de parede em PDF/imagem não é critério desta fase.
4. O Modo Croqui tem as quatro naturezas de fonte, ajuste de código/CCT/intensidade/altura, limites que geram sombra, legenda automática e vistas de planta e corte.
5. O método dos lúmens aplica as fórmulas da seção 4.5, mostra K, FU, FM, E_med e N, e um teste unitário cobre pelo menos três casos conhecidos (valores fixos de entrada e saída).
6. O P2P horizontal e o vertical aplicam as fórmulas da seção 4.6, geram resumo (E_med, E_min, E_máx, U0) e um mapa com escala. Um teste unitário cobre um caso de uma fonte pontual sobre um ponto no eixo (cosseno cúbico).
7. A tipologia NBR preenche o alvo, a comparação aparece na UI e no PDF, e o texto deixa claro que é referência, não laudo.
8. PNG da planta, PNG só das manchas (fundo transparente) e PDF A4 paisagem saem com marca Topfix, legenda e aviso de estimativa. A marca não é removível.
9. O arquiteto consegue enviar um pedido de orçamento; a equipe vê na mesma fila tanto o lead do cadastro quanto o do orçamento.
10. No celular, o arquiteto abre o projeto, vê o croqui e o PDF e consegue pedir orçamento (mesmo que não edite o canvas com conforto).
11. O aviso de estimativa está visível nas abas de cálculo e no PDF. Nenhum resultado é apresentado como exato ou como laudo.
12. A jornada 3.1 é concluída por uma pessoa de fora do time de desenvolvimento, com pouco ou nenhum suporte, num teste assistido.

Não são critérios da Fase 1: vista 3D, IES/LDT, reconhecimento automático de parede em PDF/imagem (Fase 3), UGR calculado, luminárias da Bart, papel de parede, nem simulação de luz natural com cortinas/persianas (os três últimos estão na seção "Para decidir depois"; luz natural também fica fora da Fase 2).

---

## 12. Escopo da Fase 1: fechado para início

Em 18/11/2026, 20:39 (America/Sao_Paulo), não restam perguntas de produto em aberto que travem o início da implementação. O recorte desta fase está **fechado para começar a construir**.

Decisões que fecharam o recorte:

- Não é um produto para vender. Uso interno da Topfix, com liberação para arquitetos e parceiros (cadastro aberto). O cadastro já vira lead.
- Não substitui o projeto profissional da Bart (DIALux etc.). Uso principal: Topfix.
- Precisão "boa o suficiente": estimativa com aviso, não laudo e não DIALux. Tem que ser funcional, não genérico e ruim.
- O 3D fica para a Fase 2. Reconhecimento automático de planta e IES/LDT real ficam para a Fase 3.
- Luz natural com cortinas/persianas Topfix **não entra** na Fase 1 nem na Fase 2 (seção 13).
- Luminárias da Bart e papel de parede ficam para decidir depois (seção 13). A biblioteca da Fase 1 é genérica.
- A planta chega mais em DXF/DWG e também, com frequência, em PDF ou imagem. Os três caminhos (mais o desenho manual) entram na Fase 1.

Pontos de implementação que não travam o início (não são dúvidas de produto):

- Conferir a tabela NBR e a tabela FU com o texto oficial e com uma bancada, antes do lançamento.
- Confirmar a licença da ODA para conversão de DWG em servidor (a alternativa LibreDWG já está prevista).
- Incluir ou não, já no E1, as proteções sugeridas de cadastro (confirmação de e-mail e anti-spam).

Qualquer ideia nova ou mudança de recorte entra no histórico e, se não for desta fase, na seção 13.

---

## 13. Para decidir depois

Backlog de ideias. Não é escopo de implementação agora, não tem entrega e não trava o desenvolvimento. Cada item registra o que já foi decidido e a pergunta a revisitar quando o Tiago já tiver visto o produto em uso.

### Devemos fazer simulação de luz natural com cortinas/persianas Topfix?

Decisão de 18/11/2026, 20:18 (America/Sao_Paulo): **não** implementar isso agora, nem no 2D da Fase 1, nem no 3D da Fase 2. Voltar a esta pergunta mais adiante.

Recorte da ideia, se um dia for retomada:

- O vão "janela" no editor já existe como geometria (porta e janela). Isso permanece. O que ficou de fora é o tratamento de tecido e a luz natural.
- Associar à janela um tratamento: sem tratamento, tela solar, blackout (e, se fizer sentido, cortina decorativa só como desenho).
- Biblioteca curta Topfix: nome comercial, tipo (tela solar / blackout / outro), fator simples de transmissão de luz visível (0 a 1), cor de preview, foto ou ícone.
- No croqui, uma mancha de luz natural entra pela janela (direção fixa ou um ângulo simples, sem modelo climático). O tratamento reduz a opacidade e o alcance dessa mancha: tela solar atenua; blackout zera ou quase zera.
- Comparação lado a lado (sem tratamento / tela solar / blackout), exportável no PDF.
- A mancha de luz natural levaria o aviso: "ilustração, não é estudo de insolação".

### Luminárias da Bart devem aparecer no app, como catálogo?

Decisão de 18/11/2026, 20:37 (America/Sao_Paulo): **não decidir agora.** Na Fase 1 a biblioteca permanece genérica (presets como "Spot 3000 K 24°"), sem logo, nome comercial ou SKU da Bart.

Pergunta a revisitar mais adiante, quando o produto já estiver claro:

- As luminárias da Bart devem aparecer no app como catálogo (presets nomeados, com produto e dados típicos)?
- Se sim, em que profundidade: só nome e foto, parâmetros genéricos pré-preenchidos, ou ficha mais completa (ainda sem IES/LDT real, que é Fase 3)?
- Isso seria um catálogo à parte, visível só para a equipe, ou também para o arquiteto?

Até essa decisão, o app não mistura a marca Bart na UI da ferramenta Topfix.

### O app deve permitir aplicar papel de parede Topfix nas paredes?

Decisão de 18/11/2026, 20:39 (America/Sao_Paulo): **não decidir agora.** Não entra na Fase 1.

Pergunta a revisitar mais adiante, quando o produto já estiver claro:

- O arquiteto (ou a equipe) deve poder aplicar papel de parede Topfix nas paredes, ao menos como hachura ou cor no 2D?
- Se sim, isso seria só um acabamento visual, ou um catálogo de padrões/produtos, com a marca no PDF?
- Ficaria só no 2D, ou também no 3D da Fase 2?

Até essa decisão, as paredes da Fase 1 não recebem padrão, hachura ou catálogo de papel de parede.

## 14. Referências de produto (resumo)

Estudo original em 18/11/2026. O que a Fase 1 aproveita:

- **LuxSintax, Modo Croqui** ([instagram.com/p/DfzsL-psRXD](https://www.instagram.com/p/DfzsL-psRXD/), 16/11/2026; site [luxsintax.com.br](https://www.luxsintax.com.br)): abas Croqui, M. Lúmens, P2P horiz./vert., NBR; planta e corte; DXF com validação de escala ou desenho manual; quatro naturezas de fonte; limites e sombra; ajuste por fonte; legenda automática; export PNG, PDF A4 e manchas transparentes; salvar no projeto. O próprio site admite que não faz radiosidade nem IES de simulação completa. Material local do estudo: `/workspace/instagram/`.
- **Rayon V4**: referência de 2D para 3D e de CAD no navegador. Não tem fotometria real (AEC Magazine, 18/11/2026). Não tem API pública para embutir. O 3D inspirado nessa referência fica na **Fase 2**, de propósito, e mesmo lá não é um CAD completo.
- Norma de referência de alvos: NBR ISO/CIE 8995-1. Tabela da seção 4.7 ainda precisa de conferência com o texto oficial.

---

## 15. Histórico de atualizações

### 19/11/2026 (America/Sao_Paulo): começo da implementação

- O app começou a ser construído na pasta `topfix-luz/` do repositório `tiagornt/tiagornt`, separado do portal financeiro (o cadastro aberto de arquitetos não deve morar junto com dados financeiros).
- Antes de codar, o vídeo do LuxSintax (68 s) foi baixado e analisado quadro a quadro, e o site foi lido. Do vídeo vieram: abas Croqui, M. Lúmens, P2P horiz., P2P vert., NBR; Planta/Corte com nome do croqui; "Validar escala do DXF" com unidade, largura real e dimensões resultantes; retângulo rápido por teclado ("R", "6x3", "Enter"); quatro naturezas com ícones; limites que geram sombra; ajuste por fonte com pílulas (código, K, %, altura) e controles deslizantes; legenda automática; exportar PNG, LUZES (manchas com fundo transparente) e PDF A4; salvar no projeto.
- Primeira entrega cobre E2 a E5 e boa parte de E6, rodando inteira no navegador. Os projetos ficam gravados no próprio navegador (IndexedDB) até o E1 (Supabase: cadastro aberto, login, papéis, leads, pedido de orçamento) entrar. Há "Baixar arquivo" e "Abrir arquivo" do projeto para guardar cópia ou enviar.
- Decisões de implementação (ajustáveis):
  - **Código da fonte = tipo de luminária.** Várias peças iguais dividem o código (L01 com 7 peças), como no exemplo da legenda "L01 · Difusa · 3000 K · 7". O "único no ambiente" passa a valer por tipo. Ao editar uma peça, dá para editar todas do mesmo código juntas (padrão) ou só ela.
  - **Rotação** é a direção para onde a luz vai. Nas lineares, a peça corre perpendicular a essa direção.
  - **Inclinação (tilt)** na planta: 0° = facho para baixo (mancha redonda, ou elíptica se inclinada pouco); inclinação maior vira cone dirigido (destaque de quadro, parede). No corte, o facho é desenhado como cone a partir da fonte.
  - **Intensidade (%)** é só visual, como pede a seção 4.4. O cálculo usa fluxo (lm) ou intensidade (cd). O memorial diz isso.
  - **Teto de brilho:** as manchas se somam com uma curva suave (uma fonte sozinha chega a ~66% de brilho; várias somadas chegam perto de 92%), sem estourar em branco e sem apagar a planta.
  - **A luz fica dentro do contorno externo das paredes:** porta e janela continuam sem bloquear entre ambientes, mas a luz não "vaza" para fora da planta pela janela.
  - **P2P:** difusa e linha difusa como lambertiana (meia abertura 90°, I0 = Φ/π); linear direcionado como facho (abertura e tilt), discretizado a cada 0,20 m.
  - **Sugerir quantidade** (M. Lúmens): mostra N, pede confirmação e redistribui as peças daquele tipo numa grade regular dentro do ambiente.
  - **Polígono irregular no índice K:** padrão L = maior lado e C = A / L; opção de usar o menor retângulo alinhado.
  - **Altura de montagem do método dos lúmens:** média das fontes ponderada pelo fluxo, com campo para sobrescrever.
  - **DWG:** ainda não é convertido. O app recusa com a mensagem "salve como DXF". A conversão no servidor (ODA ou LibreDWG) entra com o backend.
  - **PDF:** por ambiente, uma folha de croqui (planta, corte, legenda, resumo, alvo) e uma folha de memorial (fórmulas, valores, conversões Φ → I, mapas de cores com escala). Aviso em todas as folhas. Fonte embutida para os símbolos (Φ, θ, Σ).
  - **Contato:** "Falar com a Topfix" mostra o site. O pedido de orçamento com fila da equipe entra junto com o E1.
- Pendente para as próximas entregas: E1 inteiro (Supabase, cadastro, convites, papéis, leads, pedido de orçamento, compartilhamento), conversão DWG no servidor, painel do admin (presets, tabela NBR, FU/FM, textos do aviso, logo), teste e2e da jornada 3.1 e conferência das tabelas NBR e FU com o texto oficial.


### 18/11/2026, 20:39 (America/Sao_Paulo)

- O Tiago decidiu que **papel de parede fica para decidir depois**.
- A pergunta "O app deve permitir aplicar papel de parede Topfix nas paredes?" foi para a seção 13. Saiu das perguntas em aberto.
- Não restam perguntas de produto que travem a Fase 1. O escopo desta fase foi marcado como **fechado para início**.
- Passagem final de consistência no documento: typo "prática residual" corrigido; "self sign-up" retirado do texto vivo; critérios e introdução alinhados ao recorte fechado.

### 18/11/2026, 20:38 (America/Sao_Paulo)

- O Tiago informou que a planta do arquiteto chega **mais em DXF/DWG** e também, com frequência, em **PDF ou imagem**.
- A Fase 1 passa a exigir os três caminhos: DXF com validação de escala; DWG por conversão no servidor (ODA File Converter, com LibreDWG como alternativa, sujeita a licença e fidelidade); PDF/imagem como fundo calibrado (duas pontas + medida) para decalcar paredes.
- Reconhecimento automático de PDF/imagem permanece na Fase 3.
- Atualizados objetivo, jornada, editor (módulo 4.2), modelo de dados, stack, E3, riscos, critérios de aceite e perguntas em aberto.

### 18/11/2026, 20:37 (America/Sao_Paulo)

- O Tiago decidiu que **luminárias da Bart ficam para decidir depois**.
- A pergunta "Luminárias da Bart devem aparecer no app, como catálogo?" foi para a seção "Para decidir depois".
- A biblioteca da Fase 1 permanece genérica, sem logo, nome comercial ou SKU da Bart. A pergunta saiu das questões em aberto (resta só o apontador).

### 18/11/2026, 20:33 (America/Sao_Paulo)

- O Tiago decidiu que **o arquiteto cria o próprio login** (cadastro aberto, self sign-up).
- Atualizados perfis e permissões, jornadas, módulo 4.9 (agora autenticação, cadastro, lead e orçamento), modelo de dados, requisitos de auth, roadmap (E1), riscos, critérios de aceite e perguntas em aberto.
- Campos do cadastro: nome, e-mail, telefone/WhatsApp, escritório, cidade, CAU (opcional), senha e aceite LGPD. O cadastro vira lead da Topfix automaticamente.
- Admin e equipe continuam entrando só por convite interno.
- Registradas sugestões de proteção (confirmação de e-mail e anti-spam), recomendadas já na Fase 1, sem serem decisão fechada de implementação.

### 18/11/2026, 20:18 (America/Sao_Paulo)

- O Tiago decidiu que **luz natural e cortinas/persianas Topfix não entram na Fase 1 nem na Fase 2**.
- O antigo módulo 4.9 saiu da lista de módulos, do modelo de dados, do roadmap, dos critérios de aceite e das perguntas em aberto (resta só um apontador).
- A ideia foi para a seção "Para decidir depois", formulada como pergunta a revisitar quando o produto já estiver claro: "Devemos fazer simulação de luz natural com cortinas/persianas Topfix?"
- A captação de lead e o botão de orçamento passaram a ser o módulo 4.9. Janela continua no editor só como geometria de vão.

### 18/11/2026, 20:12 (America/Sao_Paulo)

- O Tiago pediu um MD detalhado da ideia, por enquanto **sem o 3D**, para implementar o 3D numa segunda fase.
- Este arquivo foi reescrito como especificação da Fase 1 (2D), pronta para implementação: visão, perfis e permissões, jornadas, módulos (projetos, editor, biblioteca, croqui, lúmens, P2P, NBR, exportações, leads), modelo de dados, regras de precisão, requisitos não funcionais, stack, roadmap em entregas, riscos, critérios de aceite e perguntas em aberto.
- O 3D (extrusão, fachos, three.js) foi para a Fase 2. IA de planta e IES/LDT real, para a Fase 3.
- O módulo de janelas/cortinas/persianas Topfix permanece opcional, a validar com o Tiago, e não trava a Fase 1.

### 18/11/2026, 19:54 (America/Sao_Paulo)

- Resposta do Tiago: o app nunca será um produto para vender; uso interno + arquitetos/parceiros; não é um app da Bart (lá o projeto continua no DIALux); uso principal na Topfix; objetivo de credibilidade, lembrança e vendas; precisão "boa o suficiente", fácil e visual, funcional, não genérica.

### 18/11/2026

- Criação do documento vivo, estudo do vídeo do LuxSintax (download, frames, transcrição) e do Rayon V4 (preços, import/export, MCP, resenha da AEC Magazine). Primeiro recorte de ideia, depois revisto pelas entradas acima.
