// Os textos do viewer do form-js (o formulário do Camunda) vêm em inglês: «Field is required.», «Add new». O viewer deixa
// trocar o serviço `translate`, e este dicionário põe-nos em português do gestor (tratamento por «você»).

const TEXTOS: Record<string, string> = {
  'Add new': 'Adicionar',
  'All values selected': 'Todos os valores selecionados',
  'Click to remove sorting': 'Clique para retirar a ordenação',
  'Click to sort by {value} ascending': 'Clique para ordenar por {value}, de forma crescente',
  'Click to sort by {value} descending': 'Clique para ordenar por {value}, de forma decrescente',
  Collapse: 'Recolher',
  'Date and time must both be entered.': 'Indique a data e a hora.',
  Decrement: 'Diminuir',
  'Document reference is not defined.': 'A referência do documento não está definida.',
  'Download {fileName}': 'Descarregar {fileName}',
  'Expand all ({value})': 'Expandir tudo ({value})',
  'Field is required.': 'Este campo é obrigatório.',
  'Field must be a valid email.': 'Indique um email válido.',
  'Field must be a valid international phone number. (e.g. +4930664040900)': 'Indique um número de telefone internacional válido (por exemplo, +244923000000).',
  'Field must have maximum length of {value}.': 'O máximo é de {value} caracteres.',
  'Field must have maximum value of {value}.': 'O valor máximo é {value}.',
  'Field must have minimum length of {value}.': 'O mínimo é de {value} caracteres.',
  'Field must have minimum value of {value}.': 'O valor mínimo é {value}.',
  'Field must match pattern {value}.': 'O valor não tem o formato esperado ({value}).',
  Increment: 'Aumentar',
  'Max validation value is not a valid number.': 'O valor máximo do campo não é um número válido.',
  'Min validation value is not a valid number.': 'O valor mínimo do campo não é um número válido.',
  'Next page': 'Página seguinte',
  'No content to show.': 'Sem conteúdo para mostrar.',
  'No files selected': 'Nenhum ficheiro selecionado',
  'No results': 'Sem resultados',
  'Nothing to show.': 'Nada para mostrar.',
  'Please select a valid value, the two nearest valid values are {previousValue} and {nextValue}.': 'Escolha um valor válido: os mais próximos são {previousValue} e {nextValue}.',
  'Previous page': 'Página anterior',
  'Remove tag': 'Retirar',
  Search: 'Pesquisar',
  'Skip to search': 'Ir para a pesquisa',
  'Unable to download document': 'Não foi possível descarregar o documento',
  'Value is expected to be an integer.': 'Indique um número inteiro.',
  'Value is expected to have at most 1 decimal digit.': 'Indique no máximo 1 casa decimal.',
  'Value is expected to have at most {value} decimal digits.': 'Indique no máximo {value} casas decimais.',
  'Value is not a number.': 'Indique um número.',
  '{page} of {total}': '{page} de {total}',
  '{value} files selected': '{value} ficheiros selecionados',
};

/** O mesmo contrato do `translate` do form-js: o modelo e os valores a substituir em `{chave}`. Um texto desconhecido fica
 *  como veio (em inglês) em vez de desaparecer. */
export function traduzir(modelo: string, valores: Record<string, unknown> = {}): string {
  const texto = TEXTOS[modelo] ?? modelo;
  return texto.replace(/{([^}]+)}/g, (_, chave: string) => (valores[chave] != null && valores[chave] !== '' ? String(valores[chave]) : `{${chave}}`));
}

/** O módulo que se passa ao `Form` (`additionalModules`) para trocar o serviço de tradução. */
export const moduloDeTraducao = { translate: ['value', traduzir] } as const;
