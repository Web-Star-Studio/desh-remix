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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </Head>
    <Preview>Seu link mágico de acesso ao DESH</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={card}>
          <Section style={headerSection}>
            <Img src="https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo-email.png" alt="DESH" width="120" height="120" style={logoStyle} />
          </Section>

          <Section style={heroSection}>
            <Heading style={h1}>Seu link de acesso</Heading>
            <Text style={subtitle}>Um clique e você está dentro</Text>
          </Section>

          <Hr style={divider} />

          <Section style={contentSection}>
            <Text style={text}>
              Aqui está seu link mágico para entrar no DESH. Sem senha, sem complicação. Apenas clique no botão abaixo.
            </Text>
            <Text style={warningBox}>
              ⏳ Este link é de uso único e expira em breve.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={button} href={confirmationUrl}>
              🚀 Entrar no DESH
            </Button>
          </Section>

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>
              Se você não solicitou este link, pode ignorar este e-mail com segurança.
            </Text>
            <Text style={footerBrand}>
              <Link href={`https://desh.life`} style={footerLink}>DESH</Link> · Seu sistema operacional pessoal
            </Text>
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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

const warningBox = {
  fontSize: '13px',
  color: '#B8860B',
  backgroundColor: '#FFF8E7',
  borderRadius: '10px',
  padding: '10px 14px',
  margin: '0 0 8px',
  border: '1px solid #F5E6C8',
  lineHeight: '1.5',
}

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

const footerSection = { padding: '0 32px 28px' }
const footerText = { fontSize: '12px', color: '#8E8E93', margin: '0 0 8px', lineHeight: '1.5' }
const footerBrand = { fontSize: '12px', color: '#AEAEB2', margin: '0' }
const footerLink = { color: '#C8956C', textDecoration: 'none', fontWeight: '600' as const }
