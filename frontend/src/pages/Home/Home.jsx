import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/api';
import PublicNavbar from '../../components/PublicNavbar/PublicNavbar';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/services').catch(() => ({ data: { data: [] } })),
      api.get('/inventory').catch(() => ({ data: { data: [] } })),
    ]).then(([servicesRes, partsRes]) => {
      const servicesData = Array.isArray(servicesRes.data?.data)
        ? servicesRes.data.data
        : Array.isArray(servicesRes.data)
          ? servicesRes.data
          : [];

      const partsData = Array.isArray(partsRes.data?.data)
        ? partsRes.data.data
        : Array.isArray(partsRes.data)
          ? partsRes.data
          : [];

      setServices(servicesData);
      setParts(partsData.slice(0, 8)); // show a preview, not the full catalog
      setLoading(false);
    });
  }, []);

  /** Guests get redirected to login with a friendly reason; logged-in users go straight in. */
  function requireAccount(reason) {
    navigate('/login', { state: { message: reason } });
  }

  return (
    <div className="home-page">
      <PublicNavbar />

      <section className="hero">
        <div className="hero-inner">
          <h1>Reliable auto care, booked in minutes.</h1>
          <p>
            Browse our services and spare parts below. Create a free account
            to book an appointment, track your vehicle's service status, and
            order parts online.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">Create Free Account</Link>
            <Link to="/login" className="btn btn-outline hero-outline">I already have an account</Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-inner">
          <h2>Our Services</h2>
          <p className="section-sub">Popular services our mechanics handle every day.</p>

          {loading ? (
            <p className="muted-text">Loading services…</p>
          ) : services.length === 0 ? (
            <p className="muted-text">Services will appear here soon.</p>
          ) : (
            <div className="catalog-grid">
              {services.map((s) => (
                <div key={s.id} className="catalog-card">
                  {s.image_url ? (
                    <img className="catalog-img" src={s.image_url} alt={s.name} />
                  ) : (
                    <div className="catalog-img catalog-img-placeholder" />
                  )}
                  <h3>{s.name}</h3>
                  {s.description && <p className="catalog-desc">{s.description}</p>}
                  {s.estimated_price && (
                    <div className="catalog-price">From MK {Number(s.estimated_price).toLocaleString()}</div>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => requireAccount('Create a free account to book this service.')}
                  >
                    Book This Service
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-section-alt">
        <div className="home-section-inner">
          <h2>Shop Spare Parts</h2>
          <p className="section-sub">A preview of parts available in our inventory.</p>

          {loading ? (
            <p className="muted-text">Loading parts…</p>
          ) : parts.length === 0 ? (
            <p className="muted-text">Parts will appear here soon.</p>
          ) : (
            <div className="catalog-grid">
              {parts.map((p) => (
                <div key={p.id} className="catalog-card">
                  {p.image_url ? (
                    <img className="catalog-img" src={p.image_url} alt={p.name} />
                  ) : (
                    <div className="catalog-img catalog-img-placeholder" />
                  )}
                  <h3>{p.name}</h3>
                  <div className="catalog-price">MK {Number(p.unit_price).toLocaleString()}</div>
                  <span className={`badge ${p.quantity > 0 ? 'badge-success' : 'badge-danger'}`}>
                    {p.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => requireAccount('Create a free account to order this part.')}
                    disabled={p.quantity === 0}
                    style={{ marginTop: 10 }}
                  >
                    Order This Part
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="see-more-wrap">
            <button
              className="btn btn-outline"
              onClick={() => requireAccount('Create a free account to browse our full parts catalog.')}
            >
              See Full Catalog
            </button>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} Uptown Garage. All rights reserved.</p>
      </footer>
    </div>
  );
}