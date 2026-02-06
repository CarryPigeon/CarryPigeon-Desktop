function isJSDocBlock(comment) {
  return comment && comment.type === "Block" && typeof comment.value === "string" && comment.value.startsWith("*");
}

function extractTagNames(jsdocValue) {
  const tags = new Map();
  const lines = jsdocValue.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*\*\s?/, "").trim();
    if (!line.startsWith("@")) continue;
    const match = /^@(\w+)\b\s*(.*)$/.exec(line);
    if (!match) continue;
    const tag = match[1];
    const rest = match[2] ?? "";
    if (!tags.has(tag)) tags.set(tag, []);
    tags.get(tag).push(rest);
  }
  return tags;
}

function extractParamNamesFromTags(tags) {
  const out = new Set();
  const params = tags.get("param") ?? [];
  for (const rest of params) {
    // @param {Type} name - desc
    const match = /^(?:\{[^}]*\}\s*)?(\[?[\w$]+(?:\.[\w$]+)?\]?)/.exec(rest.trim());
    if (!match) continue;
    const name = match[1].replace(/^\[|\]$/g, "");
    if (name) out.add(name);
  }
  return out;
}

function hasReturnsTag(tags) {
  return tags.has("returns") || tags.has("return");
}

function hasConstantTag(tags) {
  return tags.has("constant") || tags.has("const");
}

function isExported(node) {
  const p = node.parent;
  return p && (p.type === "ExportNamedDeclaration" || p.type === "ExportDefaultDeclaration");
}

function isExportedConstDeclaration(node) {
  return (
    node.type === "VariableDeclaration" &&
    node.kind === "const" &&
    node.parent &&
    node.parent.type === "ExportNamedDeclaration"
  );
}

function hasReturnValue(fnNode) {
  if (!fnNode) return false;
  if (fnNode.type === "ArrowFunctionExpression" && fnNode.expression) return true;
  const body = fnNode.body;
  if (!body || body.type !== "BlockStatement") return false;

  let found = false;
  const visited = new Set();
  const walk = (n) => {
    if (!n || found) return;
    if (visited.has(n)) return;
    visited.add(n);
    // skip nested functions/classes
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression" ||
      n.type === "ClassDeclaration" ||
      n.type === "ClassExpression"
    ) {
      return;
    }
    if (n.type === "ReturnStatement" && n.argument != null) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === "parent") continue;
      const v = n[key];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const child of v) {
          if (child && typeof child.type === "string") walk(child);
          if (found) return;
        }
      } else if (v && typeof v.type === "string") {
        walk(v);
      }
      if (found) return;
    }
  };
  walk(body);
  return found;
}

function isVoidReturnType(fnNode) {
  const rt = fnNode && fnNode.returnType && fnNode.returnType.typeAnnotation;
  if (!rt) return false;
  return rt.type === "TSVoidKeyword";
}

function isAsyncFunction(fnNode) {
  return !!(fnNode && fnNode.async);
}

function getFileOverviewComment(sourceCode, program) {
  const firstToken = sourceCode.getFirstToken(program);
  if (!firstToken) return null;
  const comments = sourceCode.getAllComments().filter((c) => c.range[1] <= firstToken.range[0]);
  if (comments.length === 0) return null;
  return comments[0];
}

function findLeadingJsdoc(sourceCode, node) {
  const comments = sourceCode.getCommentsBefore(node);
  const last = comments.length > 0 ? comments[comments.length - 1] : null;
  if (isJSDocBlock(last)) return last;
  return sourceCode.getJSDocComment(node) ?? null;
}

function normalizePathLike(pathLike) {
  return String(pathLike ?? "").replace(/\\/g, "/");
}

function extractFeatureFromFilename(filename) {
  const normalized = normalizePathLike(filename);
  const match = /\/src\/features\/([^/]+)\//.exec(normalized);
  return match ? match[1] : "";
}

function parseFeatureImportPath(sourceValue) {
  const raw = String(sourceValue ?? "").trim();
  const prefix = "@/features/";
  if (!raw.startsWith(prefix)) return null;
  const rest = raw.slice(prefix.length);
  const match = /^([^/]+)(?:\/([^/]+))?/.exec(rest);
  if (!match) return null;
  return {
    targetFeature: match[1] ?? "",
    firstSegment: match[2] ?? "",
    raw,
  };
}

export default {
  rules: {
    "require-structured-jsdoc": {
      meta: {
        type: "problem",
        docs: {
          description: "Require file/method/const JSDoc with structured tags (@fileoverview/@param/@returns/@constant).",
        },
        schema: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              requireFileOverview: { type: "boolean" },
              requireParamTags: { type: "boolean" },
              requireReturnsTag: { type: "boolean" },
              requireConstTag: { type: "boolean" },
              requireAllFunctions: { type: "boolean" },
            },
          },
        ],
      },
      create(context) {
        const sourceCode = context.getSourceCode();
        const opts = context.options[0] ?? {};
        const requireFileOverview = opts.requireFileOverview !== false;
        const requireParamTags = opts.requireParamTags !== false;
        const requireReturnsTag = opts.requireReturnsTag !== false;
        const requireConstTag = opts.requireConstTag !== false;
        const requireAllFunctions = opts.requireAllFunctions === true;

        function requireFileDoc(program) {
          if (!requireFileOverview) return;
          const c = getFileOverviewComment(sourceCode, program);
          if (!isJSDocBlock(c)) {
            context.report({
              node: program,
              message:
                "Missing file-level JSDoc. Add /** @fileoverview ... */ at the top of the file.",
            });
            return;
          }
          const tags = extractTagNames(c.value);
          if (!tags.has("fileoverview") && !tags.has("file")) {
            context.report({
              node: program,
              message:
                "File-level JSDoc must include @fileoverview (or @file).",
            });
          }
        }

        function requireFnDoc(node) {
          if (!requireAllFunctions && !isExported(node)) return;
          const c = sourceCode.getJSDocComment(node);
          if (!isJSDocBlock(c)) {
            context.report({
              node,
              message:
                "Missing JSDoc for exported function. Add /** ... */ with @param/@returns as needed.",
            });
            return;
          }
          const tags = extractTagNames(c.value);

          if (requireParamTags) {
            const tagParamNames = extractParamNamesFromTags(tags);
            const params = node.params ?? [];
            for (const p of params) {
              if (p.type !== "Identifier") continue;
              if (!tagParamNames.has(p.name)) {
                context.report({
                  node,
                  message: `Missing @param for parameter '${p.name}'.`,
                });
                break;
              }
            }
          }

          const requiresReturns = !isVoidReturnType(node) && (isAsyncFunction(node) || hasReturnValue(node));
          if (requireReturnsTag && requiresReturns && !hasReturnsTag(tags)) {
            context.report({
              node,
              message: "Missing @returns for function that returns a value.",
            });
          }
        }

        function requireMethodDoc(node) {
          // only methods on exported classes
          const cls = node.parent && node.parent.type === "ClassBody" ? node.parent.parent : null;
          if (!cls || cls.type !== "ClassDeclaration") return;
          if (!requireAllFunctions && !isExported(cls)) return;
          if (node.kind === "constructor") return;
          if (node.accessibility === "private" || node.accessibility === "protected") return;

          const c = sourceCode.getJSDocComment(node) ?? sourceCode.getJSDocComment(node.value);
          if (!isJSDocBlock(c)) {
            context.report({
              node,
              message:
                "Missing JSDoc for public class method. Add /** ... */ with @param/@returns as needed.",
            });
            return;
          }

          const tags = extractTagNames(c.value);
          const fn = node.value;
          if (!fn) return;

          if (requireParamTags) {
            const tagParamNames = extractParamNamesFromTags(tags);
            const params = fn.params ?? [];
            for (const p of params) {
              if (p.type !== "Identifier") continue;
              if (!tagParamNames.has(p.name)) {
                context.report({
                  node,
                  message: `Missing @param for parameter '${p.name}'.`,
                });
                break;
              }
            }
          }

          const requiresReturns = !isVoidReturnType(fn) && (isAsyncFunction(fn) || hasReturnValue(fn));
          if (requireReturnsTag && requiresReturns && !hasReturnsTag(tags)) {
            context.report({
              node,
              message: "Missing @returns for method that returns a value.",
            });
          }
        }

        function requireConstDoc(node) {
          if (!requireConstTag) return;
          if (!isExportedConstDeclaration(node)) return;
          const exportNode = node.parent;
          const c =
            (exportNode ? findLeadingJsdoc(sourceCode, exportNode) : null) ??
            findLeadingJsdoc(sourceCode, node) ??
            (node.declarations && node.declarations[0] ? findLeadingJsdoc(sourceCode, node.declarations[0]) : null);
          if (!isJSDocBlock(c)) {
            context.report({
              node,
              message: "Missing JSDoc for exported const. Add /** @constant ... */.",
            });
            return;
          }
          const tags = extractTagNames(c.value);
          if (!hasConstantTag(tags)) {
            context.report({
              node,
              message: "Exported const JSDoc must include @constant (or @const).",
            });
          }
        }

        return {
          Program: requireFileDoc,
          FunctionDeclaration: requireFnDoc,
          VariableDeclaration: requireConstDoc,
          MethodDefinition: requireMethodDoc,
        };
      },
    },
    "require-vue-template-style-docs": {
      meta: {
        type: "problem",
        docs: {
          description: "Require Vue SFC <template> and <style> to start with comments (HTML/CSS as docs).",
        },
        schema: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              requireTemplateLeadingComment: { type: "boolean" },
              requireStyleLeadingComment: { type: "boolean" },
            },
          },
        ],
      },
      create(context) {
        const filename = context.getFilename();
        if (!filename.endsWith(".vue")) return {};

        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText();
        const opts = context.options[0] ?? {};
        const requireTemplateLeadingComment = opts.requireTemplateLeadingComment !== false;
        const requireStyleLeadingComment = opts.requireStyleLeadingComment !== false;

        function extractBlock(tagName) {
          const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
          const m = re.exec(text);
          return m ? m[1] : null;
        }

        function extractStyleBlocks() {
          const re = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
          const blocks = [];
          let m;
          while ((m = re.exec(text))) blocks.push({ attrs: m[1] ?? "", content: m[2] ?? "" });
          return blocks;
        }

        function startsWithHtmlComment(content) {
          const trimmed = content.replace(/^\s+/, "");
          return trimmed.startsWith("<!--");
        }

        function extractLang(attrs) {
          const m = /\blang\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs ?? "");
          const lang = (m && (m[1] || m[2] || m[3]) ? (m[1] || m[2] || m[3]) : "").trim().toLowerCase();
          return lang || null;
        }

        function supportsLineComment(lang) {
          return ["scss", "sass", "less", "styl", "stylus"].includes(lang ?? "");
        }

        function startsWithCssComment(content, { allowLineComment }) {
          const trimmed = content.replace(/^\s+/, "");
          if (trimmed.startsWith("/*")) return true;
          if (allowLineComment && trimmed.startsWith("//")) return true;
          return false;
        }

        return {
          Program(node) {
            const template = extractBlock("template");
            if (requireTemplateLeadingComment && template != null && !startsWithHtmlComment(template)) {
              context.report({
                node,
                message:
                  "Vue <template> must start with an HTML comment (<!-- ... -->) describing the component/page.",
              });
            }

            const styles = extractStyleBlocks();
            if (!requireStyleLeadingComment || styles.length === 0) return;
            for (const style of styles) {
              const lang = extractLang(style.attrs);
              const allowLineComment = supportsLineComment(lang);
              if (!startsWithCssComment(style.content, { allowLineComment })) {
                context.report({
                  node,
                  message:
                    "Vue <style> must start with a comment describing layout/variables (/* ... */; // ... only when lang supports it).",
                });
                break;
              }
            }
          },
        };
      },
    },
    "no-cross-feature-internal-imports": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow cross-feature imports from internal layers; require '@/features/<x>/api'.",
        },
        schema: [],
      },
      create(context) {
        const currentFeature = extractFeatureFromFilename(context.getFilename());
        if (!currentFeature) return {};

        function checkSource(node, sourceLiteral) {
          const parsed = parseFeatureImportPath(sourceLiteral?.value);
          if (!parsed) return;
          if (!parsed.targetFeature || parsed.targetFeature === currentFeature) return;
          if (parsed.firstSegment === "api") return;

          context.report({
            node,
            message:
              `Cross-feature import '${parsed.raw}' is not allowed. ` +
              `Use '@/features/${parsed.targetFeature}/api' as the public boundary.`,
          });
        }

        return {
          ImportDeclaration(node) {
            checkSource(node, node.source);
          },
          ExportNamedDeclaration(node) {
            if (!node.source) return;
            checkSource(node, node.source);
          },
          ExportAllDeclaration(node) {
            if (!node.source) return;
            checkSource(node, node.source);
          },
          ImportExpression(node) {
            if (!node.source || node.source.type !== "Literal") return;
            checkSource(node, node.source);
          },
        };
      },
    },
  },
};
