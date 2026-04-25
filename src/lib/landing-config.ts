
export const FAQ_DATA = [
  { q: "O DESH é gratuito para testar?", a: "Sim! Crie sua conta gratuitamente, sem precisar de cartão de crédito. Você terá acesso a todos os módulos." },
  { q: "O que são créditos?", a: "Créditos são usados para funcionalidades de IA, buscas web e sincronizações. O preço base é R$ 0,30 por crédito. Chat IA consome ~0.7 créditos e busca web ~1.5 créditos." },
  { q: "Meus dados bancários estão seguros?", a: "Sim. Usamos Open Banking regulado pelo Banco Central via Pluggy. Nunca temos acesso às suas credenciais bancárias. Tudo é criptografado." },
  { q: "Posso usar no celular?", a: "Sim! O DESH é totalmente responsivo e funciona como um app no navegador do celular. Uma versão PWA está disponível para instalação." },
  { q: "Como funciona a integração com Open Banking?", a: "Conectamos com seu banco via APIs reguladas (Pluggy). Você autoriza o acesso de leitura e importamos transações, saldos e investimentos automaticamente." },
  { q: "A Pandora tem acesso aos meus dados?", a: "A Pandora acessa seus dados apenas quando você pede. Ela pode ler emails, tarefas, finanças e contatos para te dar respostas contextuais. Seus dados nunca são compartilhados." },
  { q: "Como funciona o pagamento?", a: "O DESH é pré-pago por créditos. Você compra pacotes sob demanda (a partir de R$ 150) sem assinatura mensal. Pode configurar recarga automática quando o saldo ficar baixo." },
  { q: "Quais bancos são suportados?", a: "Via Pluggy suportamos os principais bancos brasileiros: Nubank, C6 Bank, Itaú, Bradesco, Santander, Inter, BTG e mais de 100 outros." },
  { q: "O DESH funciona offline?", a: "Funcionalidades básicas como notas, tarefas e visualização de dados em cache funcionam offline. Sincronizações e IA precisam de conexão." },
  { q: "Como exportar meus dados?", a: "Nas configurações você pode exportar todos os seus dados em formato JSON ou CSV a qualquer momento, conforme garantido pela LGPD." },
] as const;

export const NAV_LINKS = [
  { label: "Recursos", href: "#modules" },
  { label: "Pandora IA", href: "#pandora" },
  { label: "Preços", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const STATS = [
  { value: 20, suffix: "+", label: "Widgets disponíveis" },
  { value: 6, suffix: "", label: "Módulos integrados" },
  { value: 100, suffix: "+", label: "Bancos suportados" },
  { value: 21, suffix: "", label: "Ações com IA" },
] as const;
