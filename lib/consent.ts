import * as CookieConsent from "vanilla-cookieconsent";
import type { CookieConsentConfig } from "vanilla-cookieconsent";

export type OptionalCategory = "performance" | "marketing";

/**
 * Cookie consent configuration. Bump `revision` to invalidate stored consents and reopen the banner.
 * Optional categories stay off until the visitor opts in (LGPD).
 */
export const consentConfig: CookieConsentConfig = {
  revision: 1,
  // The default hides the banner from webdriver/bots, which would make it untestable in Playwright.
  hideFromBots: false,
  cookie: { name: "pp_consent", expiresAfterDays: 180, sameSite: "Lax" },
  categories: {
    necessary: { enabled: true, readOnly: true },
    performance: {},
    marketing: {},
  },
  guiOptions: {
    consentModal: { layout: "bar", position: "bottom", equalWeightButtons: true },
    preferencesModal: { layout: "box", equalWeightButtons: true },
  },
  language: {
    default: "pt-BR",
    translations: {
      "pt-BR": {
        consentModal: {
          title: "SAVE DATA? (COOKIES)",
          description:
            'Usamos cookies necessários para o site funcionar e, só com a sua permissão, cookies de desempenho e marketing. Saiba mais na <a href="/privacidade">Política de Privacidade</a>.',
          acceptAllBtn: "ACEITAR TODOS",
          acceptNecessaryBtn: "REJEITAR OPCIONAIS",
          showPreferencesBtn: "PERSONALIZAR",
        },
        preferencesModal: {
          title: "PREFERÊNCIAS DE COOKIES",
          acceptAllBtn: "ACEITAR TODOS",
          acceptNecessaryBtn: "REJEITAR OPCIONAIS",
          savePreferencesBtn: "SALVAR ESCOLHAS",
          closeIconLabel: "Fechar",
          sections: [
            {
              title: 'Necessários <span class="pm__badge">SEMPRE ATIVOS</span>',
              description: "Login, carrinho e segurança. Não podem ser desligados.",
              linkedCategory: "necessary",
            },
            {
              title: "Desempenho",
              description: "Entender quais páginas são mais visitadas.",
              linkedCategory: "performance",
            },
            {
              title: "Marketing",
              description: "Anúncios relevantes em outras plataformas.",
              linkedCategory: "marketing",
            },
            {
              title: "Mais informações",
              description:
                'Veja os detalhes na <a href="/privacidade">Política de Privacidade</a>.',
            },
          ],
        },
      },
    },
  },
};

export function openCookiePreferences(): void {
  CookieConsent.showPreferences();
}
