import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Trash2, User, Building2, Globe, Cake, Linkedin, Instagram, Github, Facebook, Twitter } from "lucide-react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { ContactPhone, ContactEmail, ContactAddress, ContactSocialLinks } from "@/hooks/contacts/useDbContacts";

const inputCls = "bg-foreground/5 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors w-full";
const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1";
const addBtnCls = "flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1";

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  contact_type: string;
  avatar_url: string;
  website: string;
  birthday: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  social_links: ContactSocialLinks;
  company_logo_url: string;
  company_industry: string;
  company_size: string;
  company_description: string;
}

const emptyForm: ContactFormData = {
  name: "", email: "", phone: "", company: "", role: "",
  contact_type: "person", avatar_url: "", website: "", birthday: "",
  phones: [], emails: [], addresses: [],
  social_links: {},
  company_logo_url: "", company_industry: "", company_size: "", company_description: "",
};

interface Props {
  onSubmit: (data: ContactFormData) => void;
  onCancel: () => void;
}

export default function ContactAddForm({ onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<ContactFormData>({ ...emptyForm });
  const [open, setOpen] = useState(false);

  const set = (field: keyof ContactFormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  // Array helpers
  const addPhone = () => set("phones", [...form.phones, { number: "", label: "Celular" }]);
  const removePhone = (i: number) => set("phones", form.phones.filter((_, idx) => idx !== i));
  const updatePhone = (i: number, field: string, val: string) =>
    set("phones", form.phones.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  const addEmail = () => set("emails", [...form.emails, { email: "", label: "Pessoal" }]);
  const removeEmail = (i: number) => set("emails", form.emails.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, field: string, val: string) =>
    set("emails", form.emails.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addAddress = () => set("addresses", [...form.addresses, { street: "", city: "", state: "", zip: "", country: "", label: "Casa" }]);
  const removeAddress = (i: number) => set("addresses", form.addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i: number, field: string, val: string) =>
    set("addresses", form.addresses.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  const setSocial = (key: string, val: string) =>
    set("social_links", { ...form.social_links, [key]: val });

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">Novo Contato</p>

      {/* Basic fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome *" autoFocus className={inputCls} />
        <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="E-mail" className={inputCls} />
        <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Telefone" className={inputCls} />
        <input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Empresa" className={inputCls} />
        <input value={form.role} onChange={e => set("role", e.target.value)} placeholder="Cargo" className={inputCls} />
      </div>

      {/* Expandable rich fields */}
      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            {open ? "Ver menos" : "Ver mais..."}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 pt-3 border-t border-border/30 space-y-4"
          >
            {/* Contact type + Avatar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className={labelCls}>Tipo de contato</p>
                <div className="flex gap-1">
                  {[{ v: "person", l: "Pessoa", icon: User }, { v: "company", l: "Empresa", icon: Building2 }].map(t => (
                    <button key={t.v} onClick={() => set("contact_type", t.v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${form.contact_type === t.v ? "bg-primary/20 text-primary font-medium" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                      <t.icon className="w-3.5 h-3.5" /> {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={labelCls}>Foto de perfil (URL)</p>
                <input value={form.avatar_url} onChange={e => set("avatar_url", e.target.value)} placeholder="https://..." className={inputCls} />
              </div>
            </div>

            {/* Extra phones */}
            <div>
              <p className={labelCls}>Telefones adicionais</p>
              {form.phones.map((p, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input value={p.number} onChange={e => updatePhone(i, "number", e.target.value)} placeholder="Número" className={`${inputCls} flex-1`} />
                  <select value={p.label} onChange={e => updatePhone(i, "label", e.target.value)}
                    className={`${inputCls} w-28`}>
                    <option>Celular</option><option>Trabalho</option><option>Casa</option><option>Outro</option>
                  </select>
                  <button onClick={() => removePhone(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={addPhone} className={addBtnCls}><Plus className="w-3 h-3" /> Adicionar telefone</button>
            </div>

            {/* Extra emails */}
            <div>
              <p className={labelCls}>E-mails adicionais</p>
              {form.emails.map((e, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input value={e.email} onChange={ev => updateEmail(i, "email", ev.target.value)} placeholder="email@..." className={`${inputCls} flex-1`} />
                  <select value={e.label} onChange={ev => updateEmail(i, "label", ev.target.value)}
                    className={`${inputCls} w-28`}>
                    <option>Pessoal</option><option>Trabalho</option><option>Outro</option>
                  </select>
                  <button onClick={() => removeEmail(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={addEmail} className={addBtnCls}><Plus className="w-3 h-3" /> Adicionar e-mail</button>
            </div>

            {/* Addresses */}
            <div>
              <p className={labelCls}>Endereços</p>
              {form.addresses.map((a, i) => (
                <div key={i} className="mb-2 p-2 rounded-xl border border-border/20 bg-foreground/[0.02] space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <select value={a.label} onChange={e => updateAddress(i, "label", e.target.value)}
                      className={`${inputCls} w-28`}>
                      <option>Casa</option><option>Trabalho</option><option>Outro</option>
                    </select>
                    <button onClick={() => removeAddress(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <AddressAutocomplete
                    value={a.street || ""}
                    onChange={val => updateAddress(i, "street", val)}
                    onSelect={result => {
                      updateAddress(i, "street", result.address);
                    }}
                    placeholder="Buscar endereço..."
                    className={inputCls + " pl-8"}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input value={a.city || ""} onChange={e => updateAddress(i, "city", e.target.value)} placeholder="Cidade" className={inputCls} />
                    <input value={a.state || ""} onChange={e => updateAddress(i, "state", e.target.value)} placeholder="Estado" className={inputCls} />
                    <input value={a.zip || ""} onChange={e => updateAddress(i, "zip", e.target.value)} placeholder="CEP" className={inputCls} />
                    <input value={a.country || ""} onChange={e => updateAddress(i, "country", e.target.value)} placeholder="País" className={inputCls} />
                  </div>
                </div>
              ))}
              <button onClick={addAddress} className={addBtnCls}><Plus className="w-3 h-3" /> Adicionar endereço</button>
            </div>

            {/* Social links */}
            <div>
              <p className={labelCls}>Redes sociais</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: "linkedin", icon: Linkedin, placeholder: "linkedin.com/in/..." },
                  { key: "instagram", icon: Instagram, placeholder: "@usuario" },
                  { key: "twitter", icon: Twitter, placeholder: "@usuario" },
                  { key: "github", icon: Github, placeholder: "github.com/..." },
                  { key: "facebook", icon: Facebook, placeholder: "facebook.com/..." },
                ].map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input value={form.social_links[s.key] || ""} onChange={e => setSocial(s.key, e.target.value)} placeholder={s.placeholder} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>

            {/* Website + Birthday */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className={labelCls}>Website</p>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." className={inputCls} />
                </div>
              </div>
              <div>
                <p className={labelCls}>Aniversário</p>
                <div className="flex items-center gap-2">
                  <Cake className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Company details */}
            <div>
              <p className={labelCls}>Dados da empresa</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={form.company_logo_url} onChange={e => set("company_logo_url", e.target.value)} placeholder="Logo URL" className={inputCls} />
                <input value={form.company_industry} onChange={e => set("company_industry", e.target.value)} placeholder="Setor / Indústria" className={inputCls} />
                <select value={form.company_size} onChange={e => set("company_size", e.target.value)} className={inputCls}>
                  <option value="">Porte</option>
                  <option>1-10</option><option>11-50</option><option>51-200</option><option>201-500</option><option>500+</option>
                </select>
                <input value={form.company_description} onChange={e => set("company_description", e.target.value)} placeholder="Descrição da empresa" className={inputCls} />
              </div>
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel}
          className="px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={!form.name.trim()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          Adicionar
        </button>
      </div>
    </div>
  );
}
