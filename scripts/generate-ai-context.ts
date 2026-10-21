import fs from "fs";
import path from "path";

/**
 * AI Context Generator for Vibe Coders
 * Scans /src to extract exports, types, and route definitions into a compact,
 * high-signal summary (~5-8% of original code token size).
 */

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const OUTPUT_FILE = path.join(ROOT_DIR, "AI_CONTEXT.md");

function extractSignatures(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const signatures: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Exported interfaces / types
    if (line.startsWith("export interface ") || line.startsWith("export type ")) {
      signatures.push(line.replace(/\{?$/, "").trim());
    }
    // Exported functions
    else if (
      line.startsWith("export function ") ||
      line.startsWith("export const ") ||
      line.startsWith("export async function ")
    ) {
      if (line.includes("=>") || line.includes("(") || line.includes(":")) {
        const clean = line.replace(/\{.*$/, "").replace(/=>.*$/, "").trim();
        if (clean.length < 120) {
          signatures.push(clean);
        }
      }
    }
    // Express router definitions
    else if (
      line.startsWith("router.get(") ||
      line.startsWith("router.post(") ||
      line.startsWith("router.put(") ||
      line.startsWith("router.delete(") ||
      line.startsWith("router.patch(")
    ) {
      const match = line.match(/router\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/);
      if (match) {
        signatures.push(`Route: ${match[1].toUpperCase()} ${match[2]}`);
      }
    }
  }

  return signatures;
}

function scanDir(dir: string, baseDir: string = ""): { file: string; relPath: string; lines: number; sigs: string[] }[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: { file: string; relPath: string; lines: number; sigs: string[] }[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, rel));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lineCount = content.split("\n").length;
      const sigs = extractSignatures(fullPath);
      results.push({ file: entry.name, relPath: rel, lines: lineCount, sigs });
    }
  }

  return results;
}

function run() {
  console.log("Scanning /src for signatures and exports...");
  const scanned = scanDir(SRC_DIR);

  let output = `# AI Codebase Signature & Route Index (Generated)\n\n`;
  output += `> This auto-generated index contains the signatures, types, and routes of the application without full function bodies. Feed this to AI assistants along with ARCHITECTURE.md.\n\n`;
  output += `**Total Files Scanned:** ${scanned.length}\n\n`;

  // Group by category
  const categories: Record<string, typeof scanned> = {
    "Components (UI)": scanned.filter((s) => s.relPath.startsWith("components/")),
    "Server Routes (API)": scanned.filter((s) => s.relPath.startsWith("server/")),
    "Services & Business Logic": scanned.filter((s) => s.relPath.startsWith("services/")),
    "Utilities & Lib": scanned.filter((s) => s.relPath.startsWith("lib/")),
    "Database & Schema": scanned.filter((s) => s.relPath.startsWith("db/")),
    "Contexts & Core": scanned.filter((s) => s.relPath.startsWith("contexts/") || s.file === "App.tsx"),
  };

  for (const [catName, files] of Object.entries(categories)) {
    if (files.length === 0) continue;
    output += `## ${catName}\n\n`;
    for (const f of files) {
      output += `### \`src/${f.relPath}\` (${f.lines} lines)\n`;
      if (f.sigs.length > 0) {
        output += "```typescript\n";
        output += f.sigs.slice(0, 15).join("\n");
        if (f.sigs.length > 15) {
          output += `\n// ... +${f.sigs.length - 15} more signatures`;
        }
        output += "\n```\n\n";
      } else {
        output += `*No top-level exports or routes detected*\n\n`;
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`Context successfully written to ${OUTPUT_FILE}`);
}

run();
