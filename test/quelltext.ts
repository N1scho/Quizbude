import * as ts from 'typescript';

/**
 * Quelltext lesen statt Quelltext raten.
 *
 * Zwei Waechter dieses Projekts haben am Lexer versagt: einer kannte nur
 * eine Anfuehrungsart, der naechste frass bei einem `/*` in einem String
 * alles bis zum naechsten Kommentarende und uebersah dahinter einen echten
 * Import. Beide Male war die Ursache dieselbe - ein regulaerer Ausdruck, der
 * so tut, als koenne er JavaScript zerlegen.
 *
 * TypeScript liegt als Entwicklungsabhaengigkeit ohnehin im Projekt. Sein
 * Parser kennt Strings, Templates, Kommentare und Zeilenumbrueche von Haus
 * aus. Er laeuft ausschliesslich im Testlauf; in `packages/core` oder
 * `packages/server` kommt davon nichts an.
 */

function parse(source: string, dateiname = 'probe.ts'): ts.SourceFile {
  const kind = dateiname.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(dateiname, source, ts.ScriptTarget.ESNext, true, kind);
}

function textOf(node: ts.Node | undefined): string | null {
  if (node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/**
 * Jeder Modulspezifizierer: statischer Import, Seiteneffekt-Import,
 * `export … from`, `import x = require(…)`, dynamisches `import(…)` und
 * `require(…)`. Ein Spezifizierer, der erst zur Laufzeit entsteht
 * (`import(variable)`), ist hier nicht sichtbar - er ist in `core` aber auch
 * keine Schreibweise, die jemand versehentlich waehlt.
 */
export function importSpezifizierer(source: string, dateiname?: string): string[] {
  const out: string[] = [];
  const nimm = (node: ts.Node | undefined): void => {
    const text = textOf(node);
    if (text !== null) out.push(text);
  };
  const besuche = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      nimm(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      nimm(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const dynamisch = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const verlangt = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (dynamisch || verlangt) nimm(node.arguments[0]);
    }
    ts.forEachChild(node, besuche);
  };
  besuche(parse(source, dateiname));
  return out;
}

/**
 * Alle Textliterale im Code - Kommentare sind keine. Damit laesst sich ein
 * Befehlsname im Quelltext zaehlen, ohne dass eine Erklaerung darueber
 * mitgezaehlt wird.
 */
export function textliterale(source: string, dateiname?: string): string[] {
  const out: string[] = [];
  const besuche = (node: ts.Node): void => {
    const text = textOf(node);
    if (text !== null) out.push(text);
    if (ts.isTemplateExpression(node)) {
      out.push(node.head.text, ...node.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(node, besuche);
  };
  besuche(parse(source, dateiname));
  return out;
}
