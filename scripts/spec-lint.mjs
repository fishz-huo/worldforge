/**
 * 表描述 ↔ 领域类型 一致性检查器
 * ------------------------------------------------------------------
 * 通用仓储（lib/db/table.ts）有一个隐含契约：
 * **`TableSpec.columns` 里的列名，同时就是领域对象上的属性名。**
 * decodeRow 用 `out[col] = ...` 写回，saveRow 用 `obj[col]` 取值。
 *
 * 一旦某个类型把这个约定写错（比如 plugins 表用了驼峰 settingsSchema，
 * 而列名是 settings_schema），后果是**彻底静默**的：
 *   - 读：对象上根本没有这个属性 → 拿到 undefined；
 *   - 写：obj['settings_schema'] 是 undefined → 被当成空值写回，字段永远存不进去。
 * typecheck 照样通过（类型声明是对的），直到某处 `Object.keys(undefined)`
 * 才在离现场很远的地方崩掉 —— 这正是「插件」模块白屏的成因。
 *
 * 因此这里用 TypeScript 编译器把两边的名字集合取出来强制比对：
 *   createRepo<PluginRecord>(PLUGIN_SPEC)  ← 建立「表描述 → 领域类型」的对应
 *   然后要求 { 'id', ...columns } 与 PluginRecord 的属性名**完全相等**。
 */
import ts from 'typescript';

/** 解析源码为 AST */
function parse(fileName, text) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** 去掉字面量两端的引号 */
function unquote(text) {
  return text.replace(/^['"`]|['"`]$/g, '');
}

/**
 * 从 tables.ts 里提取表描述与仓储声明。
 * @returns {{ specs: Map<string, {table: string, columns: string[]}>, repos: {varName: string, typeName: string, specVar: string}[] }}
 */
export function extractSpecs(source) {
  const specs = new Map();
  const repos = [];

  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (!init || !ts.isCallExpression(init)) continue;
        const callee = init.expression.getText();
        const name = decl.name.getText();

        if (callee === 'defineTable') {
          const columns = ts.isArrayLiteralExpression(init.arguments[1])
            ? init.arguments[1].elements.map((e) => unquote(e.getText()))
            : [];
          specs.set(name, { table: unquote(init.arguments[0]?.getText() ?? ''), columns });
        } else if (callee === 'createRepo') {
          const typeName = init.typeArguments?.[0]?.getText();
          const specVar = init.arguments[0]?.getText();
          if (typeName && specVar) repos.push({ varName: name, typeName, specVar });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(parse('tables.ts', source));
  return { specs, repos };
}

/**
 * 收集所有 interface 的属性名与父接口名。
 * @returns {Map<string, {members: Set<string>, bases: string[]}>}
 */
export function extractInterfaces(files) {
  const found = new Map();

  for (const { fileName, text } of files) {
    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node)) {
        const members = new Set();
        for (const m of node.members) {
          // 索引签名没有名字，跳过（例如 [k: string]: unknown）
          if (m.name && (ts.isPropertySignature(m) || ts.isMethodSignature(m))) {
            members.add(m.name.getText());
          }
        }
        const bases = (node.heritageClauses ?? [])
          .filter((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
          .flatMap((h) => h.types.map((t) => t.expression.getText()));
        // 同名接口以先出现的为准（类型目录里不应有重名）
        if (!found.has(node.name.getText())) found.set(node.name.getText(), { members, bases });
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(fileName, text));
  }

  return found;
}

/** 递归展开接口（含 extends 继承）的全部属性名 */
function resolveMembers(name, interfaces, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const def = interfaces.get(name);
  if (!def) return null;
  const all = new Set(def.members);
  for (const base of def.bases) {
    const parent = resolveMembers(base, interfaces, seen);
    if (parent) parent.forEach((m) => all.add(m));
  }
  return all;
}

/**
 * 检查所有仓储的类型与列名是否一一对应。
 * @returns {{ varName: string, typeName: string, table: string, missing: string[], extra: string[] }[]}
 */
export function checkSpecs(tablesSource, typeFiles) {
  const { specs, repos } = extractSpecs(tablesSource);
  const interfaces = extractInterfaces(typeFiles);
  const problems = [];

  for (const repo of repos) {
    const spec = specs.get(repo.specVar);
    if (!spec) {
      problems.push({ varName: repo.varName, typeName: repo.typeName, table: '?', missing: [], extra: [`找不到表描述 ${repo.specVar}`] });
      continue;
    }
    const members = resolveMembers(repo.typeName, interfaces);
    if (!members) {
      problems.push({ varName: repo.varName, typeName: repo.typeName, table: spec.table, missing: [], extra: [`找不到类型 ${repo.typeName}`] });
      continue;
    }
    const expected = new Set(['id', ...spec.columns]);
    // missing：列存在但类型里没有 → 对象上会出现未声明的属性
    const missing = [...expected].filter((k) => !members.has(k));
    // extra：类型里有但列不存在 → 读不到也存不进，最危险的一种
    const extra = [...members].filter((k) => !expected.has(k));
    if (missing.length > 0 || extra.length > 0) {
      problems.push({ varName: repo.varName, typeName: repo.typeName, table: spec.table, missing, extra });
    }
  }

  return problems;
}
