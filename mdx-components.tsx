import type { MDXComponents } from "mdx/types";
import {
  Canal,
  DataTable,
  Placeholder,
  RightsGrid,
  Section,
  proseComponents,
} from "@/components/legal/mdx";

/** Components every MDX file can use without importing them (required by @next/mdx in the App Router). */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...proseComponents, Canal, DataTable, Placeholder, RightsGrid, Section, ...components };
}
