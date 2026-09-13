/**
 * 文档导出自测的共用夹具
 * ------------------------------------------------------------------
 * 两个自测脚本（export-selftest / export-html-test）都要用同一份数据：
 *   - 合成的可控数据：字段、分支、大纲节点都由我们说了算，才能精确断言；
 *   - 真实的示例世界观：防止采集器只对合成数据有效、遇到真数据就漏条目。
 * 顺便在这里统一注册别名钩子并导出被测模块，两个脚本各 import 一次即可。
 */
import { register } from 'node:module';

register('./alias-hook.mjs', import.meta.url);

/** 固定导出时间：文件名与页眉里的时间戳才能断言 */
export const FIXED_AT = new Date('2025-03-04T10:09:00').getTime();

export const { buildSeed } = await import('@/lib/seed/index.ts');
export const { collectAreas, summarizeAreas } = await import('@/lib/export/collect.ts');
export const { areaToMarkdown } = await import('@/lib/export/render-md.ts');
export const { areaToPlainText, markdownToPlainText } = await import('@/lib/export/render-txt.ts');
export const { areaToPrintHtml, shiftHeadings } = await import('@/lib/export/render-html.ts');
export const { buildExportFiles } = await import('@/lib/export/build.ts');
export const { replaceImages, safeSegment, splitFileName } = await import('@/lib/export/format.ts');
export const { getFieldsFor } = await import('@/lib/plugin/registry.ts');

/** 取某个区域（不存在时返回 undefined，让断言自己报错） */
export const areaById = (areas, id) => areas.find((a) => a.id === id);

/** 造一张卡片（默认角色类型，可覆盖任意字段） */
export const makeCard = (id, title, extra = {}) => ({
  id, world_id: 'w1', branch_id: null, type: 'character', title, subtitle: '', summary: '',
  body: '', fields: {}, cover_asset: null, pinned: 0, created_at: 1, updated_at: 1, ...extra,
});

/**
 * 合成数据：4 张卡片（含两个分支的）、3 篇文稿（正文 / 大纲 / 笔记）、1 个大纲节点、
 * 1 个标签、1 条关联。字段值用**真实的角色字段定义**生成，避免改字段后断言失效。
 */
export function makeSource(over = {}) {
  const def = getFieldsFor('character')[0];
  return {
    worldName: '测试世界',
    branchName: 'if 线',
    branchId: 'b1',
    exportedAt: FIXED_AT,
    cards: [
      makeCard('c1', '云中君', {
        subtitle: '天穹守夜人',
        summary: '守夜人的头儿',
        fields: { [def.key]: def.kind === 'select' ? def.options[0].value : '测试值' },
        body: '# 生平\n\n他是**守夜人**，住在[[灰港]]。\n\n- 出生在灰港\n\n![肖像](asset:a1)',
      }),
      makeCard('c2', '灰港', { type: 'location', body: '一座港口。' }),
      makeCard('c3', '分支人物', { branch_id: 'b1', body: '只存在于分支里。' }),
      makeCard('c4', '另一个分支人物', { branch_id: 'b2', body: '别的分支的人。' }),
    ],
    docs: [
      { id: 'd1', world_id: 'w1', branch_id: null, kind: 'manuscript', title: '第一章', content: '# 第一章\n\n正文开始了。', summary: '', order_index: 0, card_id: null, created_at: 1, updated_at: 1 },
      { id: 'd2', world_id: 'w1', branch_id: null, kind: 'outline', title: '主线大纲', content: '# 大纲\n\n## 旧的文本\n', summary: '', order_index: 1, card_id: null, created_at: 1, updated_at: 1 },
      { id: 'd3', world_id: 'w1', branch_id: null, kind: 'note', title: '设定笔记', content: '随手记一句。', summary: '备忘', order_index: 2, card_id: null, created_at: 1, updated_at: 1 },
    ],
    outlineNodes: [
      { id: 'n1', doc_id: 'd2', parent_id: null, order_index: 0, title: '第一幕', summary: '开场', status: 'done', card_id: 'c1', link_doc_id: null, meta: {} },
    ],
    tags: [{ id: 't1', world_id: 'w1', name: '守夜人', color: '#fff', created_at: 1 }],
    cardTags: [{ card_id: 'c1', tag_id: 't1' }],
    relations: [{ id: 'r1', world_id: 'w1', branch_id: null, from_id: 'c1', to_id: 'c2', label: '驻守', note: '', directed: 1, start_t: null, end_t: null, created_at: 1 }],
    ...over,
  };
}

/** 把真实示例世界观转成导出源 */
export function seedSource() {
  const seed = buildSeed();
  return {
    worldName: seed.world.name,
    branchName: seed.branch.name,
    branchId: seed.branch.id,
    exportedAt: FIXED_AT,
    cards: seed.cards,
    docs: seed.docs,
    outlineNodes: seed.outlineNodes,
    tags: seed.tags,
    cardTags: seed.cardTags,
    relations: seed.relations,
  };
}
