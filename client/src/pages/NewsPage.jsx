import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import './NewsPage.css';

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('.')[0];
}

function NewsCard({ article }) {
  const handleClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="news-card" onClick={handleClick}>
      {article.image_url && (
        <div className="news-card__image">
          <img src={article.image_url} alt={article.title} loading="lazy" />
        </div>
      )}
      <div className="news-card__content">
        <div className="news-card__meta">
          <span className="news-card__source">{article.source}</span>
          <span className="news-card__dot">·</span>
          <span className="news-card__time">{formatDate(article.published_at)}</span>
        </div>
        <h3 className="news-card__title">{article.title}</h3>
        <p className="news-card__description">{article.description}</p>
        {article.entities && article.entities.length > 0 && (
          <div className="news-card__tags">
            {article.entities.slice(0, 3).map((entity, idx) => (
              <span key={idx} className="news-card__tag">{entity.symbol}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);
  
  // Filter states with default values
  const [filters, setFilters] = useState({
    countries: 'in',
    filter_entities: 'true',
    limit: '10',
    published_after: getYesterdayISO(),
    language: 'en',
  });

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const params = new URLSearchParams(filters);
        const { data } = await apiClient.get(`/news?${params.toString()}`);
        setNews(data.news || []);
        setCached(data.cached || false);
        setError('');
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.response?.data?.message || 'Could not load news.');
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [navigate, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="news-page">
      <div className="news-page__header">
        <div>
          <h1>Market News</h1>
          <p className="news-page__sub">
            Latest financial news from Marketaux
            {cached && <span className="news-page__cached"> (cached)</span>}
          </p>
        </div>
      </div>

      <div className="news-filters">
        <div className="news-filter">
          <label>Country</label>
          <select value={filters.countries} onChange={(e) => handleFilterChange('countries', e.target.value)}>
            <option value="ar">Argentina</option>
            <option value="au">Australia</option>
            <option value="be">Belgium</option>
            <option value="br">Brazil</option>
            <option value="ca">Canada</option>
            <option value="ch">Switzerland</option>
            <option value="cl">Chile</option>
            <option value="cn">China</option>
            <option value="cz">Czech Republic</option>
            <option value="de">Germany</option>
            <option value="eg">Egypt</option>
            <option value="es">Spain</option>
            <option value="eu">European Union</option>
            <option value="fr">France</option>
            <option value="gb">United Kingdom</option>
            <option value="global">Global</option>
            <option value="gr">Greece</option>
            <option value="hk">Hong Kong</option>
            <option value="hu">Hungary</option>
            <option value="id">Indonesia</option>
            <option value="ie">Ireland</option>
            <option value="il">Israel</option>
            <option value="in">India</option>
            <option value="it">Italy</option>
            <option value="jp">Japan</option>
            <option value="kr">Korea</option>
            <option value="lk">Sri Lanka</option>
            <option value="mx">Mexico</option>
            <option value="my">Malaysia</option>
            <option value="nl">Netherlands</option>
            <option value="no">Norway</option>
            <option value="nz">New Zealand</option>
            <option value="ph">Philippines</option>
            <option value="pt">Portugal</option>
            <option value="qa">Qatar</option>
            <option value="ru">Russian Federation</option>
            <option value="sa">Saudi Arabia</option>
            <option value="tr">Turkey</option>
            <option value="tw">Taiwan</option>
            <option value="us">United States</option>
            <option value="ve">Venezuela</option>
            <option value="za">South Africa</option>
          </select>
        </div>

        <div className="news-filter">
          <label>Filter Entities</label>
          <select value={filters.filter_entities} onChange={(e) => handleFilterChange('filter_entities', e.target.value)}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="news-filter">
          <label>Limit</label>
          <select value={filters.limit} onChange={(e) => handleFilterChange('limit', e.target.value)}>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>

        <div className="news-filter">
          <label>Published After</label>
          <input
            type="datetime-local"
            value={filters.published_after.slice(0, 16)}
            onChange={(e) => handleFilterChange('published_after', e.target.value + ':00')}
          />
        </div>

        <div className="news-filter">
          <label>Language</label>
          <select value={filters.language} onChange={(e) => handleFilterChange('language', e.target.value)}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
      </div>

      {error && <div className="news-page__error">{error}</div>}

      {loading && news.length === 0 ? (
        <div className="news-page__loading">Loading news...</div>
      ) : (
        <div className="news-grid">
          {news.map((article) => (
            <NewsCard key={article.uuid} article={article} />
          ))}
          {news.length === 0 && !loading && (
            <div className="news-page__empty">No news articles available.</div>
          )}
        </div>
      )}
    </div>
  );
}

// Made with Bob
