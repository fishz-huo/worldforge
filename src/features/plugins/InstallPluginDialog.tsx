/**
 * 载入插件对话框
 * ------------------------------------------------------------------
 * 两种方式：粘贴单文件 ES 模块源码，或从本地 .js 文件载入。
 * 载入前做静态预检（必须导出 activate），但真正的安全边界是
 * 「只载入你自己写的或信任来源的插件」——v0.1 无沙箱。
 */
import { useRef, useState } from 'react';
import { Code2, FileCode2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { validatePluginCode } from '@/lib/plugin/host';
import { readFileText } from '@/lib/utils';
import { useStore } from '@/store';

/** 示例源码：帮助用户理解插件长什么样 */
const SAMPLE = `export const manifest = { id: 'my.plugin', name: '我的插件' };

export function activate(api) {
  api.registerCommand({
    id: 'hello',
    title: '打个招呼',
    run: () => api.toast('你好，世界观！', 'success'),
  });
}`;

export function InstallPluginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const installPlugin = useStore((s) => s.installPlugin);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const check = validatePluginCode(code);

  const close = () => {
    setCode('');
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>载入插件</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste" className="gap-1">
              <Code2 className="size-3" /> 粘贴代码
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-1">
              <FileCode2 className="size-3" /> 从文件载入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2">
            <div className="space-y-1">
              <Label>插件名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="我的插件"
                className="h-7 text-xs"
              />
            </div>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SAMPLE}
              spellCheck={false}
              className="min-h-[220px] font-mono text-[11px]"
            />
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setCode(SAMPLE)}>
              填入示例代码
            </Button>
          </TabsContent>

          <TabsContent value="file">
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <input
                ref={inputRef}
                type="file"
                accept=".js,.mjs,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCode(await readFileText(file));
                  setName(file.name.replace(/\.(js|mjs|txt)$/i, ''));
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm" className="gap-1" onClick={() => inputRef.current?.click()}>
                <Upload className="size-3.5" /> 选择插件文件（.js）
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                插件是单个 ES 模块文件，必须导出 <code className="rounded bg-muted px-1">activate(api)</code> 函数。
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {code && !check.ok && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
            {check.reason}
          </div>
        )}

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-200">
          安全提示：v0.1 的插件与主程序运行在同一环境，能读写你的全部设定数据。
          请只载入你自己编写的或完全信任来源的插件。
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>
            取消
          </Button>
          <Button
            size="sm"
            disabled={!check.ok}
            onClick={async () => {
              const ok = await installPlugin(code, { name: name.trim() || '未命名插件' });
              if (ok) close();
            }}
          >
            载入并启用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
