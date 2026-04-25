import { useNavigate } from "react-router-dom";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { ArrowLeft, FileText } from "lucide-react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import deshLogoHeader from "@/assets/desh-logo-header.png";

const BRAND_LIGHT = "#ae9277";

const sections = [
  { id: "aceitacao", label: "Aceitação dos Termos" },
  { id: "descricao", label: "Descrição do Serviço" },
  { id: "cadastro", label: "Cadastro e Conta" },
  { id: "integracoes", label: "Integrações de Terceiros" },
  { id: "uso-aceitavel", label: "Uso Aceitável" },
  { id: "propriedade", label: "Propriedade Intelectual" },
  { id: "responsabilidade", label: "Limitação de Responsabilidade" },
  { id: "disponibilidade", label: "Disponibilidade e SLA" },
  { id: "pagamento", label: "Pagamento e Planos" },
  { id: "rescisao", label: "Rescisão" },
  { id: "alteracoes", label: "Alterações nos Termos" },
  { id: "lei", label: "Lei Aplicável e Foro" },
  { id: "contato", label: "Contato" },
];

const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-2xl font-bold mb-4 scroll-mt-24" style={{ color: BRAND_LIGHT }}>
    {children}
  </h2>
);

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-semibold text-white/90 mt-4 mb-1">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-gray-400 text-sm leading-relaxed mb-3">{children}</p>
);

const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1">{children}</li>
);

const Divider = () => <hr className="border-white/[0.07] my-10" />;

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0d0d0d]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <img src={deshLogoHeader} alt="DESH" className="h-6" />
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-12 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Seções</span>
            </div>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-xs text-gray-500 hover:text-white py-1 transition-colors border-l-2 border-transparent hover:border-[#ae9277] pl-3"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-[#ae9277]/30 text-[#ae9277] mb-4">
              <FileText className="w-3 h-3" />
              Última atualização: 18 de fevereiro de 2026
            </div>
            <h1 className="text-4xl font-bold mb-3">Termos de Uso</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Estes Termos de Uso ("Termos") regem o acesso e uso da plataforma DESH, incluindo todos os serviços, funcionalidades e integrações disponibilizados pela Web Star Studio. Ao criar uma conta ou usar o DESH, você concorda com estes Termos em sua totalidade.
            </p>
          </div>

          {/* 1. Aceitação */}
          <SectionTitle id="aceitacao">1. Aceitação dos Termos</SectionTitle>
          <P>
            Ao acessar ou usar o DESH, você declara que: (i) tem pelo menos 18 anos de idade ou a maioridade legal em sua jurisdição; (ii) tem autoridade para celebrar este contrato em nome próprio ou da organização que representa; (iii) leu e compreendeu estes Termos e nossa{" "}
            <button onClick={() => window.location.href = "/privacy"} className="text-[#ae9277] underline">Política de Privacidade</button>.
          </P>
          <P>
            Se você discordar de qualquer parte destes Termos, não poderá usar o DESH. O uso continuado após alterações nos Termos constitui aceitação das novas condições.
          </P>

          <Divider />

          {/* 2. Descrição */}
          <SectionTitle id="descricao">2. Descrição do Serviço</SectionTitle>
          <P>
            O <strong className="text-white">DESH</strong> é uma plataforma SaaS de produtividade pessoal e profissional que centraliza, em um único dashboard, dados e funcionalidades provenientes de múltiplas plataformas. Os principais módulos incluem:
          </P>
          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            {[
              ["📧 Email", "Visualização e gerenciamento de e-mails Gmail sincronizados"],
              ["📅 Calendário", "Visualização e criação de eventos do Google Calendar"],
              ["✅ Tarefas", "Gerenciamento de tarefas com sincronização Google Tasks"],
              ["👥 Contatos", "CRM leve com sincronização Google Contacts"],
              ["💰 Finanças", "Controle financeiro pessoal com integração Open Finance (Pluggy)"],
              ["💬 Mensagens", "Gerenciamento de conversas WhatsApp Business"],
              ["🤖 IA Generativa", "Assistentes de IA para produtividade e automações"],
              ["🗂️ Arquivos", "Gerenciamento de arquivos com suporte a Google Drive"],
              
            ].map(([title, desc]) => (
              <div key={title} className="rounded-xl border border-white/[0.07] p-3">
                <p className="text-sm font-medium text-white mb-0.5">{title}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
          <P>
            O DESH atua como uma camada de apresentação e gerenciamento. Os dados originais permanecem nas plataformas de origem (Google, Meta etc.) e são acessados via APIs autorizadas.
          </P>

          <Divider />

          {/* 3. Cadastro */}
          <SectionTitle id="cadastro">3. Cadastro e Conta</SectionTitle>
          <SubTitle>3.1 Criação de Conta</SubTitle>
          <P>
            Para usar o DESH, é necessário criar uma conta fornecendo um endereço de e-mail válido e uma senha segura. Você é responsável por manter a confidencialidade das credenciais de acesso e por todas as atividades realizadas em sua conta.
          </P>
          <SubTitle>3.2 Veracidade das Informações</SubTitle>
          <P>
            Você concorda em fornecer informações verdadeiras, precisas e atualizadas. Contas criadas com informações falsas podem ser suspensas ou excluídas.
          </P>
          <SubTitle>3.3 Segurança da Conta</SubTitle>
          <P>
            Você deve notificar imediatamente a Web Star Studio em caso de uso não autorizado da sua conta ou qualquer outra violação de segurança pelo e-mail <a href="mailto:design@webstar.studio" className="text-[#ae9277] underline">design@webstar.studio</a>.
          </P>
          <SubTitle>3.4 Workspaces</SubTitle>
          <P>
            O DESH suporta múltiplos Workspaces para separação de contextos (pessoal, profissional etc.). Cada Workspace é isolado em termos de dados. O usuário pode convidar colaboradores para Workspaces compartilhados nos planos aplicáveis.
          </P>

          <Divider />

          {/* 4. Integrações */}
          <SectionTitle id="integracoes">4. Integrações de Terceiros</SectionTitle>
          <P>
            O DESH integra serviços de terceiros mediante autorização explícita do usuário. Ao conectar uma integração, você autoriza o DESH a acessar e sincronizar dados dessa plataforma conforme os escopos apresentados durante a autenticação.
          </P>

          <SubTitle>4.1 Google Workspace</SubTitle>
          <P>
            A integração com o Google é realizada via OAuth 2.0. O DESH acessa apenas os escopos autorizados pelo usuário e utiliza os dados exclusivamente para fornecer as funcionalidades da plataforma. O uso dos dados do Google está sujeito à{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">Google API Services User Data Policy</a>. Você pode revogar o acesso a qualquer momento em{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">myaccount.google.com/permissions</a>.
          </P>

          <SubTitle>4.2 Meta / WhatsApp Business</SubTitle>
          <P>
            A integração com WhatsApp é realizada via WhatsApp Business Cloud API da Meta. O usuário deve possuir uma conta WhatsApp Business válida e configurada na Meta Business Platform. O uso do DESH para comunicação via WhatsApp está sujeito às{" "}
            <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">Políticas do WhatsApp Business</a>{" "}
            e aos{" "}
            <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">Meta Platform Terms</a>.
          </P>

          <SubTitle>4.3 Pluggy (Open Finance)</SubTitle>
          <P>
            A integração financeira via Pluggy requer autorização direta do usuário junto à sua instituição financeira. O DESH não armazena credenciais bancárias. O acesso é realizado via link seguro da Pluggy. O uso está sujeito aos{" "}
            <a href="https://pluggy.ai/terms" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">Termos de Serviço da Pluggy</a>.
          </P>

          <SubTitle>4.4 Responsabilidade sobre Integrações</SubTitle>
          <P>
            O DESH atua como intermediário entre o usuário e as plataformas de terceiros. A Web Star Studio não é responsável por interrupções, alterações de API, ou mudanças de política das plataformas integradas que possam afetar a disponibilidade das funcionalidades.
          </P>

          <Divider />

          {/* 5. Uso Aceitável */}
          <SectionTitle id="uso-aceitavel">5. Uso Aceitável e Proibições</SectionTitle>
          <P>Ao usar o DESH, você concorda em NÃO:</P>
          <ul>
            <Li>Usar o DESH para enviar mensagens não solicitadas em massa (spam) via WhatsApp Business, violando as políticas do WhatsApp e legislação anti-spam aplicável</Li>
            <Li>Usar a plataforma para atividades ilegais, fraudulentas ou que violem direitos de terceiros</Li>
            <Li>Tentar acessar dados de outros usuários, explorar vulnerabilidades ou realizar engenharia reversa da plataforma</Li>
            <Li>Usar o DESH para armazenar ou transmitir conteúdo ilegal, ofensivo, difamatório ou que viole direitos de propriedade intelectual</Li>
            <Li>Sobrecarregar propositalmente a infraestrutura da plataforma (ataques DDoS, scraping excessivo etc.)</Li>
            <Li>Compartilhar credenciais de acesso com terceiros não autorizados</Li>
            <Li>Usar APIs, scripts ou bots para acessar o DESH de forma não autorizada, exceto mediante acordo prévio por escrito</Li>
            <Li>Violar as políticas de uso das plataformas integradas (Google, Meta, Pluggy)</Li>
          </ul>
          <P>
            O descumprimento das regras de uso aceitável pode resultar na suspensão ou exclusão imediata da conta, sem direito a reembolso.
          </P>

          <Divider />

          {/* 6. Propriedade Intelectual */}
          <SectionTitle id="propriedade">6. Propriedade Intelectual</SectionTitle>
          <SubTitle>6.1 Propriedade da Web Star Studio</SubTitle>
          <P>
            O DESH, incluindo seu código-fonte, design, interface, marca, logotipo, documentação e todos os conteúdos produzidos pela Web Star Studio, são propriedade exclusiva da Web Star Studio e estão protegidos por leis de propriedade intelectual brasileiras e internacionais.
          </P>
          <SubTitle>6.2 Dados do Usuário</SubTitle>
          <P>
            Você retém todos os direitos sobre os dados que inserir ou sincronizar no DESH. Ao usar a plataforma, você concede à Web Star Studio uma licença limitada, não exclusiva e não transferível para processar seus dados exclusivamente para fins de prestação do serviço.
          </P>
          <SubTitle>6.3 Feedback</SubTitle>
          <P>
            Sugestões, feedbacks ou ideias enviados voluntariamente ao DESH podem ser utilizados pela Web Star Studio sem obrigação de compensação ou atribuição.
          </P>

          <Divider />

          {/* 7. Responsabilidade */}
          <SectionTitle id="responsabilidade">7. Limitação de Responsabilidade</SectionTitle>
          <P>
            <strong className="text-white">NA MÁXIMA EXTENSÃO PERMITIDA PELA LEI APLICÁVEL</strong>, a Web Star Studio não será responsável por:
          </P>
          <ul>
            <Li>Perda de dados devido a falhas de sincronização com plataformas de terceiros (Google, Meta etc.)</Li>
            <Li>Interrupções no serviço causadas por falhas de infraestrutura de terceiros</Li>
            <Li>Danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou impossibilidade de uso do DESH</Li>
            <Li>Decisões financeiras, de negócios ou pessoais tomadas com base em dados exibidos na plataforma</Li>
            <Li>Ações ou omissões de plataformas integradas (Google, Meta, Pluggy)</Li>
          </ul>
          <P>
            A responsabilidade total da Web Star Studio perante você, por qualquer causa, está limitada ao valor pago pelo usuário à Web Star Studio nos 12 meses anteriores ao evento que gerou a responsabilidade, ou R$ 500,00 (quinhentos reais), o que for maior.
          </P>

          <Divider />

          {/* 8. Disponibilidade */}
          <SectionTitle id="disponibilidade">8. Disponibilidade e SLA</SectionTitle>
          <P>
            A Web Star Studio envidaráesforços comercialmente razoáveis para manter o DESH disponível. Contudo, não garantimos disponibilidade ininterrupta do serviço.
          </P>
          <div className="overflow-x-auto rounded-xl border border-white/[0.07] mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Plano</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">SLA (Uptime)</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Suporte</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gratuito", "Sem SLA garantido", "Comunidade"],
                  ["Créditos", "99% mensal", "E-mail (5 dias úteis)"],
                  ["Empresarial", "99,5% mensal", "E-mail prioritário (2 dias úteis)"],
                ].map(([plan, sla, support]) => (
                  <tr key={plan} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3 font-semibold text-white">{plan}</td>
                    <td className="px-4 py-3 text-gray-400">{sla}</td>
                    <td className="px-4 py-3 text-gray-400">{support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Manutenções programadas serão comunicadas com pelo menos 24 horas de antecedência. Manutenções emergenciais podem ocorrer sem aviso prévio.
          </P>

          <Divider />

          {/* 9. Pagamento */}
          <SectionTitle id="pagamento">9. Pagamento e Planos</SectionTitle>
          <SubTitle>9.1 Planos Disponíveis</SubTitle>
          <div className="space-y-3 mb-4">
            {[
              ["Gratuito", "Acesso gratuito com funcionalidades essenciais e limites de uso. Sem comprometimento financeiro."],
              ["Créditos", "Compra de pacotes de créditos com acesso completo a todas as funcionalidades. Pacote de 500 créditos com 15 dias de teste grátis."],
              ["Empresarial", "Plano para equipes com workspaces colaborativos, membros adicionais e SLA elevado."],
            ].map(([plan, desc]) => (
              <div key={plan} className="flex gap-3 rounded-xl border border-white/[0.07] p-4">
                <div className="w-1 rounded-full shrink-0" style={{ background: BRAND_LIGHT }} />
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{plan}</p>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <SubTitle>9.2 Cobrança e Renovação</SubTitle>
          <P>
            As assinaturas pagas são cobradas antecipadamente e renovadas automaticamente ao final de cada período (mensal ou anual), a menos que canceladas antes da data de renovação.
          </P>
          <SubTitle>9.3 Política de Reembolso</SubTitle>
          <P>
            Assinaturas mensais não são reembolsáveis após o início do período. Assinaturas anuais têm direito a reembolso proporcional nos primeiros 14 dias. Após esse prazo, não são reembolsáveis.
          </P>
          <SubTitle>9.4 Alterações de Preço</SubTitle>
          <P>
            A Web Star Studio pode alterar os preços com aviso prévio de 30 dias por e-mail. Alterações não se aplicam a assinaturas em vigor até o próximo período de renovação.
          </P>

          <Divider />

          {/* 10. Rescisão */}
          <SectionTitle id="rescisao">10. Rescisão e Exclusão de Dados</SectionTitle>
          <SubTitle>10.1 Rescisão pelo Usuário</SubTitle>
          <P>
            Você pode encerrar sua conta a qualquer momento pelas configurações do DESH. O cancelamento de assinaturas pagas deve ser realizado antes da data de renovação para evitar cobranças futuras.
          </P>
          <SubTitle>10.2 Rescisão pela Web Star Studio</SubTitle>
          <P>
            A Web Star Studio pode suspender ou encerrar sua conta, com ou sem aviso, em caso de: violação destes Termos; atividade fraudulenta ou ilegal; não pagamento de valores devidos; inatividade prolongada (planos Free, após 12 meses sem acesso).
          </P>
          <SubTitle>10.3 Efeitos da Rescisão</SubTitle>
          <P>
            Após o encerramento da conta: o acesso à plataforma é imediatamente revogado; dados pessoais são excluídos ou anonimizados em até 30 dias, conforme nossa Política de Privacidade; dados em plataformas de terceiros (Google, Meta) permanecem intactos nessas plataformas.
          </P>
          <SubTitle>10.4 Exportação de Dados</SubTitle>
          <P>
            Antes de encerrar sua conta, recomendamos exportar seus dados usando a função de exportação disponível nas configurações do DESH. Após a exclusão da conta, não é possível recuperar dados.
          </P>

          <Divider />

          {/* 11. Alterações */}
          <SectionTitle id="alteracoes">11. Alterações nos Termos</SectionTitle>
          <P>
            A Web Star Studio pode modificar estes Termos a qualquer momento. Alterações materiais serão comunicadas por e-mail e/ou notificação na plataforma com pelo menos 15 dias de antecedência.
          </P>
          <P>
            O uso continuado do DESH após a data de vigência das alterações constitui aceitação dos novos Termos. Caso não concorde com as alterações, você deve encerrar sua conta antes da data de vigência.
          </P>

          <Divider />

          {/* 12. Lei Aplicável */}
          <SectionTitle id="lei">12. Lei Aplicável e Foro</SectionTitle>
          <P>
            Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial pelo Código Civil Brasileiro (Lei nº 10.406/2002), pelo Marco Civil da Internet (Lei nº 12.965/2014), pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e pelo Código de Defesa do Consumidor (Lei nº 8.078/1990), onde aplicável.
          </P>
          <P>
            Fica eleito o foro da Comarca da Capital do Estado de São Paulo, Brasil, para dirimir quaisquer controvérsias decorrentes destes Termos, com exclusão de qualquer outro, por mais privilegiado que seja.
          </P>
          <P>
            As partes concordam em tentar resolver quaisquer disputas de forma amigável antes de recorrer ao judiciário, por meio de mediação ou negociação direta por um período mínimo de 30 dias.
          </P>

          <Divider />

          {/* 13. Contato */}
          <SectionTitle id="contato">13. Contato</SectionTitle>
          <P>
            Para dúvidas, sugestões ou questões relacionadas a estes Termos de Uso, entre em contato:
          </P>
          <div className="rounded-xl border border-[#ae9277]/30 bg-[#ae9277]/5 p-5 space-y-2">
            <p className="text-sm"><span className="text-gray-400">Razão Social:</span> <span className="text-white font-medium">WEB STAR STUDIO DESENVOLVIMENTO DE SOFTWARE LTDA</span></p>
            <p className="text-sm"><span className="text-gray-400">CNPJ:</span> <span className="text-white font-medium">57.717.768/0001-06</span></p>
            <p className="text-sm"><span className="text-gray-400">E-mail:</span> <a href="mailto:design@webstar.studio" className="text-[#ae9277] underline">design@webstar.studio</a> | <a href="mailto:dev@webstar.studio" className="text-[#ae9277] underline">dev@webstar.studio</a></p>
            <p className="text-sm"><span className="text-gray-400">Assunto recomendado:</span> <span className="text-white">"DESH – Termos de Uso"</span></p>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} DESH · por Web Star Studio</span>
          <div className="flex gap-4">
            <button onClick={() => window.location.href = "/privacy"} className="hover:text-[#ae9277] transition-colors text-gray-500">Política de Privacidade</button>
            <button onClick={() => window.location.href = "/terms"} className="hover:text-[#ae9277] transition-colors font-medium text-gray-500">Termos de Uso</button>
            <button onClick={() => window.location.href = "/"} className="hover:text-[#ae9277] transition-colors text-gray-500">Início</button>
          </div>
        </div>
      </footer>
      <CookieConsentBanner />
      <WelcomeChatBubble />
    </div>
  );
}
