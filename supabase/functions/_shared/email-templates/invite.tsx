/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </Head>
    <Preview>Você foi convidado para o DESH!</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={card}>
          <Section style={headerSection}>
            <Img src="https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo-email.png" alt="DESH" width="120" height="120" style={logoStyle} />
          </Section>

          <Section style={heroSection}>
            <Heading style={h1}>Você foi convidado!</Heading>
            <Text style={subtitle}>Alguém especial quer que você faça parte do DESH</Text>
          </Section>

          <Hr style={divider} />

          <Section style={contentSection}>
            <Text style={text}>
              Você recebeu um convite exclusivo para usar o{' '}
              <Link href={siteUrl} style={brandLink}><strong>DESH</strong></Link>, 
              um sistema operacional pessoal que reúne tarefas, finanças, e-mail, 
              WhatsApp, calendário e IA em um só lugar.
            </Text>
            <Text style={text}>
              Aceite o convite e comece a organizar sua vida de um jeito que você nunca imaginou.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={button} href={confirmationUrl}>
              🎉 Aceitar convite e criar conta
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Features */}
          <Section style={featuresSection}>
            <Text style={featuresTitle}>Por que as pessoas amam o DESH:</Text>
            <Text style={featureItem}>🤖 Pandora IA, sua assistente pessoal inteligente</Text>
            <Text style={featureItem}>📊 Dashboard unificado de toda sua vida</Text>
            <Text style={featureItem}>🔒 Seus dados seguros e privados</Text>
          </Section>

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>
              Se você não esperava este convite, pode ignorar este e-mail com segurança.
            </Text>
            <Text style={footerBrand}>
              <Link href={siteUrl} style={footerLink}>DESH</Link> · Seu sistema operacional pessoal
            </Text>
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const wrapper = { maxWidth: '520px', margin: '0 auto', padding: '40px 16px' }

const card = {
  backgroundColor: '#FAFAFA',
  borderRadius: '20px',
  border: '1px solid #EBEBEB',
  overflow: 'hidden' as const,
}

const headerSection = { padding: '28px 32px 0', textAlign: 'center' as const }
const logoStyle = { margin: '0 auto' }
const heroSection = { padding: '20px 32px 4px', textAlign: 'center' as const }
const emojiHero = { fontSize: '40px', margin: '0 0 8px', lineHeight: '1' }

const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#1A1A28',
  margin: '0 0 6px',
  lineHeight: '1.3',
}

const subtitle = { fontSize: '14px', color: '#8E8E93', margin: '0', lineHeight: '1.5' }
const divider = { borderColor: '#EBEBEB', margin: '24px 32px' }
const contentSection = { padding: '0 32px' }

const text = {
  fontSize: '14px',
  color: '#4A4A52',
  lineHeight: '1.7',
  margin: '0 0 14px',
}

const brandLink = { color: '#C8956C', textDecoration: 'none' }
const ctaSection = { padding: '8px 32px 4px', textAlign: 'center' as const }

const button = {
  backgroundColor: '#C8956C',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '14px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  boxShadow: '0 2px 8px rgba(200, 149, 108, 0.3)',
}

const featuresSection = { padding: '0 32px' }

const featuresTitle = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#1A1A28',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const featureItem = {
  fontSize: '13px',
  color: '#636366',
  margin: '0 0 8px',
  lineHeight: '1.5',
}

const footerSection = { padding: '0 32px 28px' }
const footerText = { fontSize: '12px', color: '#8E8E93', margin: '0 0 8px', lineHeight: '1.5' }
const footerBrand = { fontSize: '12px', color: '#AEAEB2', margin: '0' }
const footerLink = { color: '#C8956C', textDecoration: 'none', fontWeight: '600' as const }
