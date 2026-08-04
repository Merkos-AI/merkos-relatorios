// Categorias especiais calculadas por SQL/regra, nao pela IA — validas pra qualquer cliente
export const CONTATO_EQUIPE = 'Contato iniciado pela equipe';
export const SAUDACOES_OUTROS = 'Saudações e outros';
export const NAO_MAPEADO = 'Outros (não mapeados nas categorias fixas)';

export const STARRED = new Set([CONTATO_EQUIPE, SAUDACOES_OUTROS]);

// Categorias genericas usadas quando o cliente ainda nao tem uma lista propria
// definida em org-config.ts. A IA tambem pode retornar NAO_MAPEADO quando nada
// se encaixa — isso fica visivel no relatorio pra revisarmos e criar categoria nova.
export const GENERIC_CATEGORIES = [
  'Agendamento e disponibilidade',
  'Pagamentos, estorno e nota fiscal',
  'Cancelamento e reembolso',
  'Dúvidas sobre local, equipamentos e regras',
  'Pediu atendente diretamente',
  'Plano mensal / assinatura',
  'Problemas com o aplicativo',
  'Parcerias, RH e fornecedores',
];
