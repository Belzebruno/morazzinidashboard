import backend from '../server.cjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    const url = new URL(req.url, 'https://morazzinidashboard.vercel.app');
    const html = await backend.readProduct(url.searchParams.get('url'));
    return res.status(200).json({ html });
  } catch {
    return res.status(422).json({ error: 'Não foi possível ler a loja. Preencha os dados manualmente.' });
  }
}
