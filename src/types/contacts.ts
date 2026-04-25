export interface ContactPhone {
  number: string;
  label: string;
  is_primary?: boolean;
}

export interface ContactEmail {
  email: string;
  label: string;
  is_primary?: boolean;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  label: string;
}

export interface ContactSocialLinks {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  github?: string;
  website?: string;
  [key: string]: string | undefined;
}

export interface DbContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  notes: string;
  tags: string[];
  favorited: boolean;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  google_resource_name?: string | null;
  google_etag?: string | null;
  // Rich fields
  contact_type: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  social_links: ContactSocialLinks;
  website: string;
  birthday?: string | null;
  company_logo_url?: string | null;
  company_description: string;
  company_industry: string;
  company_size: string;
  custom_fields: Record<string, string>;
}

export interface DbInteraction {
  id: string;
  contact_id: string;
  type: string;
  title: string;
  description: string;
  interaction_date: string;
  created_at?: string;
}
