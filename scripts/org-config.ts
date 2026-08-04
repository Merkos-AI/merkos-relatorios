import { GENERIC_CATEGORIES } from './categories.js';

export interface OrgConfig {
  categories: string[];
  // Texto de "oportunidade" mostrado na secao final do relatorio, por categoria.
  // Categorias sem entrada aqui usam um texto generico automatico.
  insights?: Record<string, { title: string; body: string }>;
}

// Lista validada contra o relatorio de referencia de julho/2026.
const TOP_SPORTS_CATEGORIES = [
  'Churrasqueira, salão e eventos',
  'Disponibilidade e reservas de quadra',
  'Lanchonete e reserva de mesa',
  'Aulas e escolinhas',
  'Pagamentos, estorno e nota fiscal',
  'Pediu atendente diretamente',
  'Plano mensal / mensalista',
  'Materiais, loja e achados & perdidos',
  'Parcerias, RH e fornecedores',
  'Adversários e grupos de jogo',
  'Problemas com o aplicativo',
  'Convênio Neodent',
];

// Chave = organization_id no banco. Clientes sem entrada aqui usam
// GENERIC_CATEGORIES automaticamente (ver categories.ts).
export const ORG_CONFIG: Record<string, OrgConfig> = {
  '6': {
    // Top Sports
    categories: TOP_SPORTS_CATEGORIES,
    insights: {
      'Churrasqueira, salão e eventos': {
        title: 'Churrasqueira, salão e eventos',
        body: 'Preços, regras e pacotes já são respondidos pela equipe com textos padrão. Cadastrando essas informações, a IA responde na hora — inclusive fora do horário comercial.',
      },
      'Disponibilidade e reservas de quadra': {
        title: 'Consulta de horários livres',
        body: '"Tem horário sábado às 16h?" é a pergunta mais comum. Com acesso de leitura à agenda, a IA informa a disponibilidade em segundos e direciona a reserva para o app.',
      },
      'Plano mensal / mensalista': {
        title: 'Respostas diretas',
        body: 'Plano mensal, chave Pix e nota fiscal, cardápio da lanchonete, convênio Neodent e contatos de RH e parcerias: respostas fixas que hoje sempre esperam um atendente.',
      },
    },
  },
  // '2': Talula Cablepark — ainda sem categorias proprias definidas, usa GENERIC_CATEGORIES
  // '7': CBS - Curitiba Beach Sports — ainda sem categorias proprias definidas, usa GENERIC_CATEGORIES
};

export function getCategoriesForOrg(orgId: string): string[] {
  return ORG_CONFIG[orgId]?.categories ?? GENERIC_CATEGORIES;
}

export function getInsightsForOrg(orgId: string): Record<string, { title: string; body: string }> {
  return ORG_CONFIG[orgId]?.insights ?? {};
}
