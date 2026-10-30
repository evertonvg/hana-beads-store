import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCANNED_DIRS = ["app", "components", "content"];
const ALLOWED_FILE = "lib/contact.ts";
const FORBIDDEN = /Instagram|WhatsApp|\bDIRECT\b|\bDirect\b/;

/** Returns `path:line` for every forbidden channel word under `root/app`, `root/components` and `root/content`. */
export function findHardcodedChannel(root: string): string[] {
  const hits: string[] = [];
  for (const dir of SCANNED_DIRS) {
    walk(join(root, dir), (file) => {
      const rel = relative(root, file).split(sep).join("/");
      if (rel === ALLOWED_FILE || !/\.(tsx?|mdx)$/.test(rel)) return;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (FORBIDDEN.test(line)) hits.push(`${rel}:${i + 1}`);
        });
    });
  }
  return hits;
}

function walk(dir: string, onFile: (file: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // directory does not exist yet
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

describe("hardcoded contact channel", () => {
  it("finds no channel words in app/, components/ or content/ outside lib/contact.ts", () => {
    expect(findHardcodedChannel(REPO_ROOT)).toEqual([]);
  });

  describe("scanner failure mode", () => {
    const temps: string[] = [];

    afterEach(() => {
      for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
    });

    function fixture(files: Record<string, string>): string {
      const root = mkdtempSync(join(tmpdir(), "channel-scan-"));
      temps.push(root);
      for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
      return root;
    }

    it("reports a component that hardcodes Instagram", () => {
      const root = fixture({
        "components/Bad.tsx": "export const B = () => <p>Chame no Instagram</p>;\n",
      });
      expect(findHardcodedChannel(root)).toEqual(["components/Bad.tsx:1"]);
    });

    it("reports DIRECT and WhatsApp in app/ files", () => {
      const root = fixture({
        "app/page.tsx": "const a = 1;\nconst b = 'FALAR NO DIRECT';\n",
        "app/loja/x.ts": "const c = 'WhatsApp';\n",
      });
      expect(findHardcodedChannel(root).sort()).toEqual(["app/loja/x.ts:1", "app/page.tsx:2"]);
    });

    it("reports a legal MDX page that names the channel instead of using <Canal/>", () => {
      const root = fixture({
        "content/legal/x.mdx": "# Termos\n\nFale pelo Direct do Instagram\n",
      });
      expect(findHardcodedChannel(root)).toEqual(["content/legal/x.mdx:3"]);
    });

    it("ignores lib/contact.ts, which is the single allowed place", () => {
      const root = fixture({
        "lib/contact.ts": "export const NAME = 'Instagram';\n",
        "components/Ok.tsx": "export const Ok = () => null;\n",
      });
      expect(findHardcodedChannel(root)).toEqual([]);
    });
  });
});
