import type { CartData } from "@/lib/cart/types";
import type { Connection } from "@/lib/data/ports";
import type {
  Address,
  BeadArtSpec,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  Product,
} from "@/lib/data/types";

/** Mock accounts. Plain-text passwords exist only because this is an in-memory mock. */
export type MockUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  cpf?: string;
};

export const userFixtures: readonly MockUser[] = [
  {
    id: "ana",
    name: "Ana Souza",
    email: "ana@teste.dev",
    phone: "(11) 91234-5678",
    password: "Senha@123",
    // Obvious test data: a well-known generator CPF (not a real person) and the Praça da Sé.
    cpf: "529.982.247-25",
  },
  {
    id: "bruno",
    name: "Bruno Lima",
    email: "bruno@teste.dev",
    phone: "(21) 98765-4321",
    password: "Senha@123",
  },
];

/** Saved addresses per user. Obvious test data: the Praça da Sé. */
export const addressFixtures: Record<string, Address[]> = {
  ana: [
    {
      id: "ana-casa",
      label: "Casa",
      cep: "01001-000",
      street: "Praça da Sé",
      number: "100",
      complement: "",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
      isDefault: true,
    },
  ],
};

/** Social accounts already linked (ana signs in with Google, and also has a password). */
export const connectionFixtures: Record<string, Connection[]> = {
  ana: [{ provider: "google", email: "ana@teste.dev" }],
};

/** Ana already has one item saved on the server (merge-at-login scenario). */
export const savedCartFixtures: Record<string, CartData> = {
  ana: { lines: [{ productId: "e13", ring: "mosquetao", qty: 1 }] },
};

// Masks and palettes copied from docs/design/desktop/Loja.dc.html.
const MASKS = {
  coracao: [
    ".##...##.",
    "####.####",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    ".........",
  ],
  gato: [
    "#.......#",
    "##.....##",
    "#########",
    "##k###k##",
    "#########",
    "####k####",
    "#########",
    ".#######.",
    "..#...#..",
  ],
  sorvete: [
    "...###...",
    "..#####..",
    ".#######.",
    ".#######.",
    ".yyyyyyy.",
    "..yyyyy..",
    "..yyyyy..",
    "...yyy...",
    "....y....",
  ],
  planeta: [
    ".........",
    "...###...",
    "..#####..",
    ".#######.",
    "yyyyyyyyy",
    ".#######.",
    "..#####..",
    "...###...",
    ".........",
  ],
  cacto: [
    "....#....",
    "....#....",
    "#...#....",
    "#...#..#.",
    "#####..#.",
    "....#####",
    "....#....",
    "...yyy...",
    "...yyy...",
  ],
} as const;

// The design has no real prices or dimensions: never invent them.
const base = (): Pick<Product, "priceCents" | "sizeCm" | "beadCount" | "cuteness" | "options"> => ({
  priceCents: null,
  sizeCm: null,
  beadCount: null,
  cuteness: "MAX",
  options: [],
});

function art(
  mask: keyof typeof MASKS,
  palette: Record<string, string>,
  alt: string,
  letter?: string,
): BeadArtSpec {
  return { rows: [...MASKS[mask]], palette, alt, ...(letter ? { letter } : {}) };
}

/** Pristine catalog; the mock store deep-copies this on every reset. */
export const productFixtures: readonly Product[] = [
  {
    ...base(),
    id: "garota",
    slug: "garota-pixel",
    name: "GAROTA PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Chaveiro de personagem em pixel art com cabelo rosa.",
    rarity: "epico",
    isNew: false,
    stock: 5,
    categories: ["personagens"],
    categoryLabel: "Personagens",
    colors: ["rosa", "preto"],
    images: [
      {
        url: "/img/produtos/garota-pixel.webp",
        alt: "Chaveiro de personagem em pixel art com cabelo rosa",
      },
    ],
    art: null,
    illustrative: false,
    featuredRank: 1,
  },
  {
    ...base(),
    id: "e13",
    slug: "estrela-numero",
    name: "ESTRELA Nº",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Chaveiro de estrela vermelha com o número 13.",
    rarity: "raro",
    isNew: false,
    stock: 5,
    categories: ["estrelas", "iniciais"],
    categoryLabel: "Estrelas · Números",
    colors: ["vermelho"],
    images: [
      {
        url: "/img/produtos/estrela-numero-13.webp",
        alt: "Chaveiro de estrela vermelha com o número 13",
      },
    ],
    art: null,
    illustrative: false,
    featuredRank: 2,
  },
  {
    ...base(),
    id: "er",
    slug: "estrela-inicial",
    name: "ESTRELA INICIAL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Chaveiro de estrela vermelha e rosa com a letra R.",
    rarity: "raro",
    isNew: false,
    stock: 5,
    categories: ["estrelas", "iniciais"],
    categoryLabel: "Estrelas · Iniciais",
    colors: ["vermelho", "rosa"],
    images: [
      {
        url: "/img/produtos/estrela-inicial-r.webp",
        alt: "Chaveiro de estrela vermelha e rosa com a letra R",
      },
    ],
    art: null,
    illustrative: false,
    featuredRank: 3,
  },
  {
    ...base(),
    id: "sorvete",
    slug: "sorvete-pixel",
    name: "SORVETE PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de sorvete em pixel.",
    rarity: null,
    isNew: true,
    stock: 5,
    categories: ["icones"],
    categoryLabel: "Mini ícones",
    colors: ["rosa"],
    images: [],
    art: art(
      "sorvete",
      { "#": "#FF8CC4", y: "#F2B661" },
      "Ilustração de chaveiro de sorvete em pixel",
    ),
    illustrative: true,
    featuredRank: 4,
  },
  {
    ...base(),
    id: "gato",
    slug: "gatinho-pixel",
    name: "GATINHO PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de gatinho em pixel.",
    rarity: null,
    isNew: true,
    stock: 5,
    categories: ["bichinhos"],
    categoryLabel: "Bichinhos",
    colors: ["laranja"],
    images: [],
    art: art(
      "gato",
      { "#": "#FF9A3D", k: "#14121F" },
      "Ilustração de chaveiro de gatinho em pixel",
    ),
    illustrative: true,
    featuredRank: 5,
  },
  {
    ...base(),
    id: "coracao",
    slug: "coracao-pixel",
    name: "CORAÇÃO PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de coração em pixel.",
    rarity: null,
    isNew: false,
    stock: 5,
    categories: ["icones"],
    categoryLabel: "Mini ícones",
    colors: ["rosa"],
    images: [],
    art: art("coracao", { "#": "#FF5FAE" }, "Ilustração de chaveiro de coração em pixel"),
    illustrative: true,
    featuredRank: 6,
  },
  {
    ...base(),
    id: "planeta",
    slug: "planeta-pixel",
    name: "PLANETA PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de planeta em pixel.",
    rarity: null,
    isNew: false,
    stock: 0,
    categories: ["icones"],
    categoryLabel: "Mini ícones",
    colors: ["roxo"],
    images: [],
    art: art(
      "planeta",
      { "#": "#9B5CFF", y: "#FFD23F" },
      "Ilustração de chaveiro de planeta em pixel",
    ),
    illustrative: true,
    featuredRank: 7,
  },
  {
    ...base(),
    id: "cacto",
    slug: "cacto-pixel",
    name: "CACTO PIXEL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de cacto em pixel.",
    rarity: null,
    isNew: false,
    stock: 5,
    categories: ["icones"],
    categoryLabel: "Mini ícones",
    colors: ["verde"],
    images: [],
    art: art("cacto", { "#": "#2FBF71", y: "#C8693C" }, "Ilustração de chaveiro de cacto em pixel"),
    illustrative: true,
    featuredRank: 8,
  },
  {
    ...base(),
    id: "coracaoA",
    slug: "coracao-inicial",
    name: "CORAÇÃO INICIAL",
    // placeholder: derived from design alt text (no product copy in the design)
    description: "Ilustração de chaveiro de coração vermelho com a letra A.",
    rarity: null,
    isNew: false,
    stock: 5,
    categories: ["iniciais", "icones"],
    categoryLabel: "Iniciais · Mini ícones",
    colors: ["vermelho"],
    images: [],
    art: art(
      "coracao",
      { "#": "#E8302A" },
      "Ilustração de chaveiro de coração vermelho com a letra A",
      "A",
    ),
    illustrative: true,
    featuredRank: 9,
  },
];

const anaCustomer: Customer = {
  name: "Ana Souza",
  email: "ana@teste.dev",
  phone: "(11) 91234-5678",
  cpf: "529.982.247-25",
};

const anaAddress: Address = {
  cep: "01001-000",
  street: "Praça da Sé",
  number: "100",
  complement: "",
  district: "Sé",
  city: "São Paulo",
  state: "SP",
};

// Item names are the snapshot kept in the order, so they do not follow the catalog names.
const garotaItem: OrderItem = {
  productId: "garota",
  name: "Garota Pixel",
  ring: "mosquetao",
  unitPriceCents: null,
  qty: 1,
  image: {
    url: "/img/produtos/garota-pixel.webp",
    alt: "Chaveiro de personagem em pixel art com cabelo rosa",
  },
};
const e13Item: OrderItem = {
  productId: "e13",
  name: "Estrela nº 13",
  ring: "mosquetao",
  unitPriceCents: null,
  qty: 1,
  image: {
    url: "/img/produtos/estrela-numero-13.webp",
    alt: "Chaveiro de estrela vermelha com o número 13",
  },
};
const erItem: OrderItem = {
  productId: "er",
  name: "Estrela inicial R",
  ring: "mosquetao",
  unitPriceCents: null,
  qty: 1,
  image: {
    url: "/img/produtos/estrela-inicial-r.webp",
    alt: "Chaveiro de estrela vermelha e rosa com a letra R",
  },
};
const customItem: OrderItem = {
  productId: null,
  name: "Chaveiro personalizado",
  ring: "mosquetao",
  unitPriceCents: null,
  qty: 1,
  image: null,
};

function anaOrder(
  n: number,
  status: OrderStatus,
  over: Partial<Order> & Pick<Order, "items" | "paymentMethod" | "createdAt">,
): Order {
  const number = String(n).padStart(4, "0");
  return {
    id: `ord_${number}`,
    number,
    userId: "ana",
    guestToken: null,
    status,
    subtotalCents: null,
    shippingCents: null,
    discountCents: 0,
    totalCents: null,
    shippingAddress: anaAddress,
    customer: anaCustomer,
    shippingService: "PAC",
    trackingCode: null,
    isCustom: false,
    events: [{ status, at: over.createdAt }],
    payment: null,
    ...over,
  };
}

const pixApproved = {
  kind: "pix",
  copyPaste: "[pix copia e cola]",
  expiresAt: "2026-08-01T12:30:00.000Z",
} as const;

/**
 * Ana's order history, the five orders of docs/design/desktop/Pedidos.dc.html. Dates are obvious
 * test data (the design shows `[00/00/0000]`); prices stay null like the whole catalog.
 */
export const orderFixtures: readonly Order[] = [
  anaOrder(1, "cancelado", {
    items: [erItem],
    paymentMethod: "boleto",
    createdAt: "2026-06-02T15:00:00.000Z",
    payment: { kind: "boleto", line: "[linha digitável]", pdfUrl: null, dueDate: null },
  }),
  anaOrder(2, "entregue", {
    items: [garotaItem],
    paymentMethod: "pix",
    createdAt: "2026-06-20T15:00:00.000Z",
    trackingCode: "[AA000000000BR]",
    payment: pixApproved,
  }),
  anaOrder(3, "enviado", {
    items: [e13Item],
    paymentMethod: "cartao",
    createdAt: "2026-07-10T15:00:00.000Z",
    trackingCode: "[AA000000000BR]",
    payment: { kind: "cartao", result: "aprovado", last4: "0000" },
  }),
  anaOrder(4, "aguardando_aprovacao", {
    items: [customItem],
    paymentMethod: "pix",
    createdAt: "2026-07-25T15:00:00.000Z",
    isCustom: true,
  }),
  anaOrder(5, "em_producao", {
    items: [garotaItem, erItem],
    paymentMethod: "pix",
    createdAt: "2026-08-01T12:00:00.000Z",
    payment: pixApproved,
  }),
];
