/** Compare the browser Origin with the actual Host header, not Next's rewritten URL. */
export function isLocalConnectionRequest(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const browser = new URL(origin);
    const server = new URL(`http://${host}`);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return browser.protocol === 'http:' && loopback.has(browser.hostname)
      && loopback.has(server.hostname) && browser.port === server.port
      && browser.username === '' && browser.password === ''
      && browser.pathname === '/' && browser.search === '' && browser.hash === '';
  } catch { return false; }
}
