/**
 * Maps Pluggy transaction categories (English) to Portuguese labels
 * and our internal category system.
 * Based on: https://docs.pluggy.ai/docs/transaction-categories
 */

// Pluggy category → Portuguese display label
const PLUGGY_CATEGORY_PT: Record<string, string> = {
  // Income
  "Income": "Renda",
  "Salary": "Salário",
  "Retirement": "Aposentadoria",
  "Entrepreneurial activities": "Atividade empresarial",
  "Government aid": "Auxílio governamental",
  "Non-recurring income": "Renda não recorrente",

  // Loans
  "Loans and Financing": "Empréstimos e Financiamentos",
  "Late payment and overdraft costs": "Multas e cheque especial",
  "Interests charged": "Juros cobrados",
  "Loans": "Empréstimos",
  "Financing": "Financiamento",
  "Real estate financing": "Financiamento imobiliário",
  "Vehicle Financing": "Financiamento veicular",
  "Student loan": "Financiamento estudantil",

  // Investments
  "Investments": "Investimentos",
  "Automatic investment": "Investimento automático",
  "Fixed income": "Renda fixa",
  "Mutual funds": "Fundos de investimento",
  "Variable income": "Renda variável",
  "Margin": "Margem",
  "Proceeds interests and dividends": "Rendimentos e dividendos",
  "Pension": "Previdência",

  // Transfers
  "Same person transfer": "Transferência mesma pessoa",
  "Same person transfer - Cash": "Transf. mesma pessoa - Dinheiro",
  "Same person transfer - PIX": "Transf. mesma pessoa - PIX",
  "Same person transfer - TED": "Transf. mesma pessoa - TED",
  "Transfers": "Transferências",
  "Transfer - Bank slip (Boleto)": "Transf. - Boleto",
  "Transfer - Cash": "Transf. - Dinheiro",
  "Transfer - Check": "Transf. - Cheque",
  "Transfer - DOC": "Transf. - DOC",
  "Transfer - Foreign exchange": "Transf. - Câmbio",
  "Transfer - Internal": "Transf. Interna",
  "Transfer - PIX": "Transf. - PIX",
  "Transfer - TED": "Transf. - TED",
  "Credit card payment": "Pagamento cartão de crédito",
  "Third-party transfers": "Transf. para terceiros",
  "Bank slip": "Boleto",
  "Debt card": "Cartão de débito",
  "DOC": "DOC",
  "PIX": "PIX",
  "TED": "TED",

  // Legal
  "Legal obligations": "Obrigações legais",
  "Blocked balances": "Saldos bloqueados",
  "Alimony": "Pensão alimentícia",

  // Services
  "Services": "Serviços",
  "Telecommunications": "Telecomunicações",
  "Internet": "Internet",
  "Mobile": "Celular",
  "TV": "TV",
  "Education": "Educação",
  "Online Courses": "Cursos online",
  "University": "Universidade",
  "School": "Escola",
  "Kindergarten": "Creche",
  "Wellness and fitness": "Bem-estar e fitness",
  "Gyms and fitness centers": "Academias",
  "Sports practice": "Prática esportiva",
  "Wellness": "Bem-estar",
  "Tickets": "Ingressos",
  "Stadiums and arenas": "Estádios e arenas",
  "Landmarks and museums": "Pontos turísticos e museus",
  "Cinema, theater and concerts": "Cinema, teatro e shows",

  // Shopping
  "Shopping": "Compras",
  "Online shopping": "Compras online",
  "Electronics": "Eletrônicos",
  "Pet supplies and vet": "Pet e veterinário",
  "Clothing": "Vestuário",
  "Kids and toys": "Crianças e brinquedos",
  "Bookstore": "Livraria",
  "Sports goods": "Artigos esportivos",
  "Office Supplies": "Material de escritório",
  "Cashback": "Cashback",

  // Digital
  "Digital services": "Serviços digitais",
  "Gaming": "Jogos",
  "Video streaming": "Streaming de vídeo",
  "Music streaming": "Streaming de música",

  // Food
  "Groceries": "Supermercado",
  "Food and drinks": "Alimentação",
  "Eating out": "Restaurantes",
  "Food delivery": "Delivery",

  // Travel
  "Travel": "Viagens",
  "Airport and airlines": "Aeroporto e companhias aéreas",
  "Accommodation": "Hospedagem",
  "Mileage programs": "Programas de milhas",
  "Bus tickets": "Passagens de ônibus",

  // Others
  "Donations": "Doações",
  "Gambling": "Apostas",
  "Lottery": "Loteria",
  "Online bet": "Apostas online",

  // Taxes
  "Taxes": "Impostos",
  "Income taxes": "Imposto de renda",
  "Taxes on investments": "Impostos sobre investimentos",
  "Tax on financial operations": "IOF",

  // Bank fees
  "Bank fees": "Taxas bancárias",
  "Account fees": "Taxas de conta",
  "Wire transfer fees and ATM fees": "Taxas de transferência e caixa",
  "Credit card fees": "Taxas de cartão",

  // Housing
  "Housing": "Moradia",
  "Rent": "Aluguel",
  "Houseware": "Utensílios domésticos",
  "Urban land and building tax": "IPTU",
  "Utilities": "Utilidades",
  "Water": "Água",
  "Electricity": "Energia elétrica",
  "Gas": "Gás",

  // Healthcare
  "Healthcare": "Saúde",
  "Dentist": "Dentista",
  "Pharmacy": "Farmácia",
  "Optometry": "Óptica",
  "Hospital clinics and labs": "Hospitais e laboratórios",

  // Transportation
  "Transportation": "Transporte",
  "Taxi and ride-hailing": "Táxi e transporte por app",
  "Public transportation": "Transporte público",
  "Car rental": "Aluguel de carro",
  "Bicycle": "Bicicleta",
  "Automotive": "Automotivo",
  "Gas stations": "Postos de combustível",
  "Parking": "Estacionamento",
  "Tolls and in-vehicle payment": "Pedágios",
  "Vehicle ownership taxes and fees": "IPVA e taxas veiculares",
  "Vehicle maintenance": "Manutenção veicular",
  "Traffic tickets": "Multas de trânsito",

  // Insurance
  "Insurance": "Seguros",
  "Life insurance": "Seguro de vida",
  "Home Insurance": "Seguro residencial",
  "Health insurance": "Plano de saúde",
  "Vehicle insurance": "Seguro veicular",

  // Leisure
  "Leisure": "Lazer",
};

// Map Pluggy categories to our internal categories for budgeting
const PLUGGY_TO_INTERNAL: Record<string, string> = {
  "Income": "Renda", "Salary": "Renda", "Retirement": "Renda",
  "Entrepreneurial activities": "Renda", "Government aid": "Renda",
  "Non-recurring income": "Renda",

  "Housing": "Moradia", "Rent": "Moradia", "Utilities": "Moradia",
  "Water": "Moradia", "Electricity": "Moradia", "Gas": "Moradia",
  "Urban land and building tax": "Moradia", "Houseware": "Moradia",

  "Groceries": "Alimentação", "Food and drinks": "Alimentação",
  "Eating out": "Alimentação", "Food delivery": "Alimentação",

  "Transportation": "Transporte", "Automotive": "Transporte",
  "Gas stations": "Transporte", "Parking": "Transporte",
  "Tolls and in-vehicle payment": "Transporte",
  "Public transportation": "Transporte",
  "Taxi and ride-hailing": "Transporte",
  "Vehicle maintenance": "Transporte", "Car rental": "Transporte",
  "Traffic tickets": "Transporte",

  "Leisure": "Lazer", "Tickets": "Lazer",
  "Cinema, theater and concerts": "Lazer",
  "Stadiums and arenas": "Lazer",

  "Healthcare": "Saúde", "Dentist": "Saúde", "Pharmacy": "Saúde",
  "Hospital clinics and labs": "Saúde", "Optometry": "Saúde",
  "Health insurance": "Saúde",

  "Education": "Educação", "Online Courses": "Educação",
  "University": "Educação", "School": "Educação",
  "Kindergarten": "Educação",
};

/**
 * Translates a Pluggy category to Portuguese display label.
 */
export function translatePluggyCategory(category: string | null): string {
  if (!category) return "Outros";
  return PLUGGY_CATEGORY_PT[category] || category;
}

/**
 * Maps a Pluggy category to our internal budget category system.
 */
export function mapPluggyCategoryToInternal(category: string | null): string {
  if (!category) return "Outros";
  return PLUGGY_TO_INTERNAL[category] || "Outros";
}
