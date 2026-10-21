# Evidência visual do OCR de Física

As páginas PNG mostram a saída de impressão A4 gerada após importar e corrigir a prova de Física de referência. Demonstram a fórmula renderizada e a hierarquia V–VIII com as respetivas alíneas.

`vector-pair-builder.png`, `vector-pair-print.png` e `vector-pair-print.pdf` são uma regressão visual complementar com resposta OCR sintética. Confirmam que `\\vec{v}` e `\\vec{a}` chegam à folha e à saída de impressão e que a baixa confiança continua marcada para revisão. O PNG de impressão é rasterizado do PDF produzido pelo Chromium; não é uma captura do ecrã do construtor. Estas imagens não provam o reconhecimento da fotografia: esse critério é verificado separadamente pela regressão PaddleOCR local, sem incluir a fotografia no repositório.

O E2E anexa `group-brace-builder.png`, `group-brace-print.png` e `group-brace-print.pdf` ao relatório HTML do Playwright com um evento OCR sintético. O login Playwright disponível no ambiente local não completou, por isso esses anexos ainda dependem de a execução CI concluir o percurso. Mesmo quando gerada, essa captura demonstra a apresentação, não o reconhecimento do OCR.

A fotografia original e o painel do construtor não estão incluídos: a fotografia contém contactos no rodapé. A validação da fotografia foi feita localmente; estes PNGs mostram apenas o resultado impresso, sem essa zona de contactos.

Os ficheiros são evidência visual, não fixtures de teste. A regressão automatizada correspondente usa dados sintéticos e a fixture local opcional.
