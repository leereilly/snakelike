const DREAMLO_BASE = 'https://dreamlo.com/lb';

export default async function handler(req, res) {
  const privateKey = process.env.DREAMLO_PRIVATE_KEY;
  const publicKey = process.env.DREAMLO_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    return res.status(500).json({ error: 'Leaderboard not configured' });
  }

  if (req.method === 'GET') {
    try {
      const resp = await fetch(`${DREAMLO_BASE}/${publicKey}/json`);
      const data = await resp.json();
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({ error: 'Failed to fetch leaderboard' });
    }
  }

  if (req.method === 'POST') {
    const { name, score } = req.body || {};

    if (!name || typeof score !== 'number') {
      return res.status(400).json({ error: 'name (string) and score (number) are required' });
    }

    const safeName = encodeURIComponent(`${name}_${Date.now()}`);

    try {
      await fetch(`${DREAMLO_BASE}/${privateKey}/add/${safeName}/${score}`);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(502).json({ error: 'Failed to submit score' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
