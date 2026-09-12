/**
 * 动态字段表单
 * ------------------------------------------------------------------
 * 由 CardTypeDef.fields（+ 插件追加字段）驱动渲染：
 * 角色有出生刻度、地点有人口/农业/矿产、参考有作者/链接…
 * 新增字段只需改 types/card-types.ts 或由插件注册，无需改动本文件。
 */
import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AutoInput, AutoNumber, AutoTextarea } from '@/components/common/AutoField';
import { Icon } from '@/components/Icon';
import { getFieldsFor } from '@/lib/plugin/registry';
import type { Card, FieldDef, FieldValue } from '@/types';
import { useStore } from '@/store';

/** 单个字段控件 */
function FieldControl({
  field,
  value,
  onChange,
  unit,
}: {
  field: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  unit: string;
}) {
  const stringValue = value === undefined || value === null ? '' : String(value);
  switch (field.kind) {
    case 'textarea':
      return <AutoTextarea value={stringValue} onCommit={onChange} placeholder={field.placeholder} minHeight={60} />;
    case 'number':
      return <AutoNumber value={value === '' || value === undefined || value === null ? null : Number(value)} onCommit={onChange} placeholder={field.placeholder} />;
    case 'time':
      return (
        <div className="relative">
          <AutoNumber
            value={value === '' || value === undefined || value === null ? null : Number(value)}
            onCommit={onChange}
            placeholder="数值刻度，可为负"
            className="pr-10"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {unit}
          </span>
        </div>
      );
    case 'boolean':
      return <Switch checked={value === 1 || value === true || value === 'true'} onCheckedChange={(v) => onChange(v ? 1 : 0)} />;
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={stringValue || '#888888'}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
          />
          <Input value={stringValue} onChange={(e) => onChange(e.target.value)} className="h-7 font-mono text-xs" />
        </div>
      );
    case 'select': {
      const options = field.options ?? [];
      return (
        <Select value={stringValue || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder={field.placeholder ?? '请选择'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">（未设置）</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'list':
      return (
        <AutoInput
          value={Array.isArray(value) ? value.join(', ') : stringValue}
          onCommit={(v) => onChange(v.split(/[,，]/).map((s) => s.trim()).filter(Boolean))}
          placeholder="用逗号分隔"
        />
      );
    default:
      return <AutoInput value={stringValue} onCommit={onChange} placeholder={field.placeholder} />;
  }
}

/** 卡片字段编辑区（自动保存） */
export function CardFields({ card, compact = false }: { card: Card; compact?: boolean }) {
  const updateCard = useStore((s) => s.updateCard);
  const worldId = useStore((s) => s.currentWorldId);
  const unit = useStore((s) => s.worlds.find((w) => w.id === s.currentWorldId)?.meta?.time?.unit ?? '年');

  /** 按组聚合字段，保持声明顺序 */
  const groups = useMemo(() => {
    const fields = getFieldsFor(card.type);
    // 角色的时间类字段需要提示单位，这里顺带过滤掉不该出现的字段
    const map = new Map<string, FieldDef[]>();
    fields.forEach((f) => {
      const key = f.group ?? '属性';
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    });
    return [...map.entries()];
  }, [card.type]);

  if (groups.length === 0) {
    return <div className="px-3 py-2 text-[11px] text-muted-foreground">该类型没有额外字段，直接写正文即可。</div>;
  }
  void worldId;

  return (
    <div className="space-y-3">
      {groups.map(([group, fields]) => (
        <div key={group} className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">{group}</div>
          {fields.map((field) => (
            <div key={field.key} className={compact ? 'space-y-0.5' : 'grid grid-cols-[6.5rem_1fr] items-start gap-2'}>
              <Label className="flex items-center gap-1 pt-1.5" title={field.hint}>
                {field.label}
                {field.fromPlugin && <Icon name="Puzzle" className="size-2.5 text-primary/70" />}
              </Label>
              <div>
                <FieldControl
                  field={field}
                  unit={unit}
                  value={card.fields?.[field.key]}
                  onChange={(v) => updateCard(card.id, { fields: { ...card.fields, [field.key]: v } })}
                />
                {field.hint && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{field.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 把字段渲染成只读的「键 → 值」列表 */
export function CardFieldSummary({ card, limit }: { card: Card; limit?: number }) {
  const fields = getFieldsFor(card.type);
  const rows = fields
    .map((f) => ({ field: f, value: card.fields?.[f.key] }))
    .filter((r) => r.value !== undefined && r.value !== null && r.value !== '' && !(Array.isArray(r.value) && r.value.length === 0))
    .slice(0, limit ?? fields.length);
  if (rows.length === 0) return <div className="text-[11px] text-muted-foreground">暂无结构化字段</div>;
  return (
    <div className="space-y-0.5">
      {rows.map(({ field, value }) => (
        <div key={field.key} className="grid grid-cols-[5.5rem_1fr] gap-2 text-[11px]">
          <span className="truncate text-muted-foreground">{field.label}</span>
          <span className="break-words">
            {field.kind === 'select'
              ? (field.options?.find((o) => o.value === value)?.label ?? String(value))
              : Array.isArray(value)
                ? value.join('、')
                : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
