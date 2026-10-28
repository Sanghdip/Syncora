import { useState, useEffect, useRef } from 'react';
import './GifPicker.css';
export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim() || 'trending';
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(q)}&limit=24`);
        const data = await res.json();
        setGifs(data.results || []);
      } catch (e) {
        console.error('GIF fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Giphy…"
        />
        <button onClick={onClose}>✕</button>
      </div>

      <div className="gif-grid">
        {loading && <div className="gif-loading">Loading…</div>}
        {!loading && gifs.map(gif => (
          <img
            key={gif.id}
            src={gif.preview}
            alt={gif.title}
            onClick={() => onSelect(gif)}
          />
        ))}
      </div>

      <div className="gif-attribution">Powered by GIPHY</div>
    </div>
  );
}