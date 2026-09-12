import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite 配置
 * - base: './'  相对路径产物，Tauri 打包后用 file:// 协议也能正确加载资源
 * - sql.js 的 wasm 通过 `?url` 导入，Vite 会自动把 wasm 作为资源发射到 dist
 * - manualChunks 做体积切分，避免单个 chunk 过大（首屏只加载 react 核心）
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // sql.js 是 UMD 包，交给 Vite 预打包；wasm 由 ?url 单独处理后无需再排除
  optimizeDeps: {
    include: ['sql.js'],
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * 只把「大而稳定」的三类依赖单独切块，其余交给 Rollup 自动分配。
         * 早期版本还给所有 node_modules 兜底了一个 vendor 块，
         * 结果出现 vendor → vendor-react → vendor 的循环依赖警告，故移除。
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('sql.js')) return 'vendor-sqljs';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    /**
     * 端口必须固定：Tauri 的 devUrl 写死了 http://localhost:5173，
     * 若 Vite 因端口占用自动切换到 5174，桌面窗口会加载到一个空地址。
     * strictPort 让冲突直接报错，比「白屏但不知为何」好排查得多。
     */
    strictPort: true,
    // 监听 0.0.0.0，方便 Tauri 移动端（安卓 / iOS）通过局域网访问开发服务器
    host: true,
    watch: {
      /**
       * 必须排除 src-tauri：Rust 的构建产物（target/ 下几千个文件）会被 cargo 独占锁定，
       * 文件监听器一旦尝试 watch 被锁定的 .exe 就会抛 EBUSY 并让整个 dev server 崩溃，
       * 表现为 `tauri dev` 报 "beforeDevCommand terminated with a non-zero status code"。
       * 顺带也把 dist 排除掉，避免构建产物触发无意义的热更新。
       *
       * 后半段是同类问题的通用防护：很多编辑器与工具用「原子写」保存文件
       * （先写临时文件，再改名覆盖），临时文件在被监听到的那一刻仍是锁定的，
       * chokidar 一样会抛 EBUSY 并拖垮整个 dev server。
       * 实测：向 src/ 写入文件时会产生 .<文件名>.<pid>.<uuid>.tmpdir/ 目录，
       * 不忽略就会复现同样的崩溃。
       */
      ignored: [
        '**/src-tauri/**',
        '**/dist/**',
        '**/.git/**',
        '**/*.tmpdir/**',
        '**/*.tmp',
        '**/*.swp',
        '**/*.swx',
        '**/*~',
        '**/.goutputstream-*',
      ],
    },
  },
  /**
   * 不清屏：Rust/Cargo 的编译错误会与 Vite 输出共用同一个终端，
   * 清屏会把编译报错冲掉，导致只看到一句 "non-zero status code"。
   */
  clearScreen: false,
});
