import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('.site-client', 'dist/assets', { recursive: true });

await writeFile(
  'dist/server/index.js',
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, request));
  }
};
`,
);

await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await rm('.site-client', { recursive: true, force: true });
