import fs from 'node:fs';
import path from 'node:path';
export function connectedAutoDevKey(): string | undefined {
  if (process.env.AUTO_DEV_API_KEY) return process.env.AUTO_DEV_API_KEY;
  const filename=path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(filename)) return undefined;
  const line=fs.readFileSync(filename,'utf8').match(/^AUTO_DEV_API_KEY=([^\r\n]*)/m);
  return line?.[1].trim() || undefined;
}
export function saveAutoDevKey(key: string): void {
  if (!/^[A-Za-z0-9._~+/=-]{8,512}$/.test(key)) throw new Error('Invalid API key format.');
  const filename=path.join(process.cwd(), '.env.local');
  const existing=fs.existsSync(filename) ? fs.readFileSync(filename,'utf8') : '';
  const lines=existing.split(/\r?\n/).filter(line=>!/^\s*AUTO_DEV_API_KEY=/.test(line));
  fs.writeFileSync(filename, [...lines, `AUTO_DEV_API_KEY=${key}`, ''].join('\n'), {mode:0o600});
  process.env.AUTO_DEV_API_KEY=key;
}
