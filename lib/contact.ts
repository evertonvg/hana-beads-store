import { onlyDigits } from "@/lib/format";
import { publicEnv, type PublicEnv } from "@/lib/env";

export type ContactChannel = {
  id: "instagram" | "whatsapp";
  name: string;
  short: string;
  /** How the channel is named when talking about sending messages ("Direct", "WhatsApp"). */
  direct: string;
  /** The channel with its inbox, for running text ("Direct do Instagram", "WhatsApp"). */
  via: string;
  color: "contact" | "whatsapp";
  icon: "send" | "chat";
  href(msg?: string): string;
  acceptsPrefill: boolean;
};

const CHANNELS: Record<PublicEnv["contactChannel"], (env: PublicEnv) => ContactChannel> = {
  instagram: (env) => ({
    id: "instagram",
    name: "Instagram",
    short: "DIRECT",
    direct: "Direct",
    via: "Direct do Instagram",
    color: "contact",
    icon: "send",
    href: () => `https://ig.me/m/${env.instagramUser ?? "[usuario]"}`,
    acceptsPrefill: false,
  }),
  whatsapp: (env) => ({
    id: "whatsapp",
    name: "WhatsApp",
    short: "WHATSAPP",
    direct: "WhatsApp",
    via: "WhatsApp",
    color: "whatsapp",
    icon: "chat",
    href: (msg = "") =>
      `https://wa.me/${env.whatsappNumber === null ? "[numero]" : onlyDigits(env.whatsappNumber)}?text=${encodeURIComponent(msg)}`,
    acceptsPrefill: true,
  }),
};

/** The configured contact channel (`NEXT_PUBLIC_CONTACT_CHANNEL`). */
export function getContact(env: PublicEnv = publicEnv): ContactChannel {
  return CHANNELS[env.contactChannel](env);
}

const VERBS = {
  chamar: "CHAMAR NO",
  encomendar: "ENCOMENDAR PELO",
  falar: "FALAR NO",
  ver: "VER NO",
} as const;

/** Button or link label for an action, naming the configured channel. */
export function contactLabel(kind: keyof typeof VERBS, c: ContactChannel = getContact()): string {
  return `${VERBS[kind]} ${c.short}`;
}
