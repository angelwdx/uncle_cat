import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isSingleFile = env.VITE_SINGLE_FILE === 'true';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      isSingleFile && viteSingleFile()
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: isSingleFile ? 'dist-single' : 'dist',
      assetsInlineLimit: isSingleFile ? 100000000 : 4096, // 标准模式下不强制内联所有资源
      rollupOptions: {
        output: {
          manualChunks: isSingleFile ? undefined : {
            'vendor-react': ['react', 'react-dom'],
            'vendor-markdown': ['react-markdown', 'remark-gfm']
          }
        }
      }
    },
    define: {
      // 定义环境变量，用于控制是否显示提示词管理功能
      __HIDE_PROMPT_MANAGEMENT__: env.VITE_HIDE_PROMPT_MANAGEMENT === 'true',
    }
  };
});
