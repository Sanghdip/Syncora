import express from 'express';

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { q = '', limit = 24, offset = 0 } = req.query;
    const apiKey = process.env.GIPHY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GIPHY_API_KEY not set' });
    }

    const url = new URL('https://api.giphy.com/v1/gifs/search');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('q', q || 'trending');
    url.searchParams.set('limit', limit);
    url.searchParams.set('offset', offset);
    url.searchParams.set('rating', 'pg-13');
    url.searchParams.set('lang', 'en');

    const r = await fetch(url);
    if (!r.ok) {
      console.error('Giphy status:', r.status);
      return res.status(r.status).json({ error: 'Giphy error' });
    }

    const data = await r.json();
    res.json({
      results: data.data.map(gif => ({
        id: gif.id,
        url: gif.images.fixed_height.url,
        preview: gif.images.fixed_height_small.url,
        mp4: gif.images.fixed_height.mp4,
        title: gif.title,
      })),
    });
  } catch (err) {
    console.error('Giphy search error:', err);
    res.status(500).json({ error: 'Failed to fetch GIFs' });
  }
});

export default router;
