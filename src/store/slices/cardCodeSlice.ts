/**
 * Card Code Slice —— 卡片永久编号
 * ------------------------------------------------------------------
 * 需求：每张卡片一个永久编号（CHR-001），标题改动不影响 [[编号]] 引用。
 *
 * 为什么单独一个 slice 而不是塞进 cardSlice.ts：
 *   1. cardSlice.ts 已经接近单文件 200 行上限；
 *   2. 这里的动作有自己的副作用（推进发号记录、问用户要不要替换引用），
 *      与「增删改卡片」不是同一件事。
 *
 * 三条数据安全约定：
 *   - 改编号**先落库再问**：无论用户选「替换」还是「保留别名」，
 *     编号本身都已经保存，不会出现"问了半天结果编号没改"。
 *   - 发号记录只增不减（world.meta.codeSeq）：删掉的编号不复用，
 *     否则旧文稿里的 [[CHR-007]] 会指到后来新建的那张卡片上。
 *   - 替换只动 `[[编号]]` / `[[编号|显示名]]` 这两种双链写法，正文里裸写的
 *     编号不动（那可能只是普通文字，自动改写风险大于收益）。
 */
import type { Card, World } from '@/types';
import { askConfirm } from '@/lib/confirm';
import {
  aliasesOf, codeNumber, codeOf, codePrefix, codePrefixOf, findCodeConflict, nextCode,
  normalizeCode, replaceCodeRefs, validateCode,
} from '@/lib/card-code';
import { worldsRepo } from '@/lib/db';
import { upsert } from '../helpers';
import type { Slice } from '../types';

/** 改编号的结果：失败带错误文案（界面直接显示在输入框下面） */
export interface CodeChangeResult {
  ok: boolean;
  error?: string;
  /** 实际替换掉的引用处数 */
  replaced?: number;
}

export interface CardCodeSlice {
  /** 给某个类型发一个新编号并记账（新建卡片时用；编号一经发出不再复用） */
  takeNextCode: (type: string) => string;
  /** 记下某个编号用过了（删卡时调用，避免最大号退回后被复用） */
  rememberCode: (code: string) => void;
  /** 改编号：校验 → 落库 → 按偏好询问是否替换全库引用 */
  changeCardCode: (cardId: string, raw: string) => Promise<CodeChangeResult>;
  /** 给当前世界观里所有未编号的卡片补号（按创建时间先后） */
  fillMissingCodes: () => number;
}

export const createCardCodeSlice: Slice<CardCodeSlice> = (set, get) => {
  /** 当前世界观的发号记录 */
  const seqOf = (): Record<string, number> => {
    const world = get().worlds.find((w) => w.id === get().currentWorldId);
    const seq = world?.meta?.codeSeq;
    return seq && typeof seq === 'object' ? { ...seq } : {};
  };

  /** 把发号记录推进到 n（只增不减）；这是「编号不复用」的唯一依据 */
  const bumpSeq = (prefix: string, n: number) => {
    if (!prefix || !Number.isFinite(n) || n <= 0) return;
    const world = get().worlds.find((w) => w.id === get().currentWorldId);
    if (!world) return;
    const seq = seqOf();
    if ((seq[prefix] ?? 0) >= n) return;
    seq[prefix] = n;
    const next: World = { ...world, meta: { ...world.meta, codeSeq: seq }, updated_at: Date.now() };
    worldsRepo.save(next);
    set({ worlds: upsert(get().worlds, next) });
  };

  /** 发号 = 算出下一个可用编号 + 立刻记账 */
  const issue = (type: string): string => {
    const code = nextCode(get().cards, type, seqOf());
    bumpSeq(codePrefixOf(type), codeNumber(code) ?? 0);
    return code;
  };

  /** 把旧编号追加到别名里（旧引用仍然跳得到） */
  const addAlias = (cardId: string, code: string) => {
    const card = get().cards.find((c) => c.id === cardId);
    if (!card || !code) return;
    const list = aliasesOf(card);
    if (list.some((item) => item.toLowerCase() === code.toLowerCase())) return;
    get().updateCard(cardId, { code_aliases: [...list, code] });
  };

  /** 扫描文稿与卡片正文，替换 [[旧编号]]；返回替换处数 */
  const replaceEverywhere = (from: string, to: string): number => {
    let count = 0;
    [...get().cards].forEach((card: Card) => {
      const hit = replaceCodeRefs(card.body ?? '', from, to);
      if (hit.count > 0) {
        get().updateCard(card.id, { body: hit.text });
        count += hit.count;
      }
    });
    [...get().docs].forEach((doc) => {
      const hit = replaceCodeRefs(doc.content ?? '', from, to);
      if (hit.count > 0) {
        get().updateDoc(doc.id, { content: hit.text });
        count += hit.count;
      }
    });
    return count;
  };

  return {
    takeNextCode: (type) => issue(type),

    rememberCode: (code) => bumpSeq(codePrefix(code), codeNumber(code) ?? 0),

    changeCardCode: async (cardId, raw) => {
      const card = get().cards.find((c) => c.id === cardId);
      if (!card) return { ok: false, error: '卡片不存在（可能已被删除）' };
      const code = normalizeCode(raw);
      const invalid = validateCode(code);
      if (invalid) return { ok: false, error: invalid };
      const previous = codeOf(card);
      if (code.toLowerCase() === previous.toLowerCase()) {
        // 只有大小写之类的写法差异：直接采纳用户写的形态，不涉及引用替换
        if (code !== previous) get().updateCard(cardId, { code });
        return { ok: true, replaced: 0 };
      }
      const conflict = findCodeConflict(get().cards, code, cardId);
      if (conflict) return { ok: false, error: `该编号已被【${conflict.title}】使用，请更换` };

      // 先落库：无论下面用户怎么选，编号改动都已经保存
      get().updateCard(cardId, { code });
      bumpSeq(codePrefix(code), codeNumber(code) ?? 0);

      // 本来就是未编号的卡片：没有旧引用要处理
      if (!previous) return { ok: true, replaced: 0 };

      const replace = get().autoReplaceCodeRefs
        ? await askConfirm({
            message: `编号已从 ${previous} 改为 ${code}。\n\n`
              + `是否把文稿和卡片正文里所有 [[${previous}]] 的引用，自动替换为 [[${code}]]？`,
            confirmText: '替换引用',
            cancelText: `保留 ${previous} 为别名`,
          })
        : false;

      if (!replace) {
        addAlias(cardId, previous);
        get().toast(`旧编号 ${previous} 已保留为别名，旧引用仍然能跳转`, 'info');
        return { ok: true, replaced: 0 };
      }
      const replaced = replaceEverywhere(previous, code);
      get().toast(
        replaced > 0
          ? `已把 ${replaced} 处 [[${previous}]] 替换为 [[${code}]]`
          : `正文里没有 [[${previous}]] 的引用，未做替换`,
        replaced > 0 ? 'success' : 'info',
      );
      return { ok: true, replaced };
    },

    fillMissingCodes: () => {
      const missing = get().cards
        .filter((c) => !codeOf(c))
        .sort((a, b) => a.created_at - b.created_at);
      missing.forEach((card) => {
        get().updateCard(card.id, { code: issue(card.type), code_aliases: aliasesOf(card) });
      });
      return missing.length;
    },
  };
};
