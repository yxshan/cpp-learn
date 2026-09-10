/**
 * Framework-free Reference article model.
 *
 * The Web Adapter renders these blocks to React and the CLI Adapter renders
 * them to HTML. Both consumers therefore share one semantic source for heading
 * identity, block taxonomy, and link resolution; only leaf serialization
 * differs.
 */

export type ArticleInline =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly ArticleInline[] }
  | { readonly kind: "emphasis"; readonly children: readonly ArticleInline[] }
  | {
      readonly kind: "link";
      readonly href: string;
      readonly children: readonly ArticleInline[];
    };

export interface ArticleTable {
  readonly header: readonly (readonly ArticleInline[])[];
  readonly rows: readonly (readonly (readonly ArticleInline[])[])[];
  readonly align: readonly (TableAlignment | undefined)[];
}

export type TableAlignment = "left" | "center" | "right";

export type ArticleBlock =
  | {
      readonly kind: "heading";
      readonly depth: 2 | 3;
      readonly id: string;
      readonly title: string;
      readonly jsComparison: boolean;
      readonly children: readonly ArticleInline[];
    }
  | { readonly kind: "paragraph"; readonly children: readonly ArticleInline[] }
  | {
      readonly kind: "code";
      readonly language?: string;
      readonly value: string;
    }
  | { readonly kind: "blockquote"; readonly children: readonly ArticleBlock[] }
  | {
      readonly kind: "list";
      readonly ordered: boolean;
      readonly start?: number;
      readonly items: readonly (readonly ArticleBlock[])[];
    }
  | ({ readonly kind: "table" } & ArticleTable)
  /**
   * A node the shared model does not know how to render. It is carried
   * explicitly so that neither consumer can silently drop content.
   */
  | { readonly kind: "unsupported"; readonly nodeType: string };

export interface ArticleHeading {
  readonly level: 2 | 3;
  readonly title: string;
  readonly id: string;
}
