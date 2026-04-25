// Credit packages are now fetched dynamically from the database (credit_packages table)
// System is pay-per-use with credit packages, NOT monthly subscriptions
// New accounts receive 100 free trial credits that expire in 30 days

export const WELCOME_CREDITS = 100;

/** Trial credits expire after this many days */
export const TRIAL_EXPIRY_DAYS = 30;

export const FREE_TIER_FEATURES = [
  "100 créditos de teste",
  "Válidos por 30 dias",
  "Acesso a todos os módulos",
  "Sem cartão de crédito",
  "Compre créditos quando quiser",
] as const;

export const PACKAGE_FEATURES = [
  "Acesso completo à plataforma",
  "Créditos avulsos sob demanda",
  "Compra automática disponível",
  "Assistente IA Pandora",
  "Open Finance",
  "Suporte prioritário",
] as const;
