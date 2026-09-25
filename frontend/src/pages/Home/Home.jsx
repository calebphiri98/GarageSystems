import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/api';
import PublicNavbar from '../../components/PublicNavbar/PublicNavbar';
import './Home.css';
import garageHero from '../../assets/garage-hero.jpg';

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
      setParts(partsData.slice(0, 8));
      setLoading(false);
    });
  }, []);

  function requireAccount(reason) {
    navigate('/login', {
      state: { message: reason },
    });
  }

  return (
    <div className="home-page">

      <PublicNavbar />

    
      <section
        className="hero"
        style={{ '--hero-image': `url("${garageHero}")` }}
      >
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-content">

            <div className="hero-label">
              <span className="hero-label-line" />
              UPTOWN GARAGE
            </div>

            <h1>
              Professional Auto Care
              <span>You Can Trust.</span>
            </h1>

            <p className="hero-description">
              Vehicle servicing, diagnostics, repairs and genuine spare
              parts all in one place.
            </p>

            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary">
                Book a Service
                <span>→</span>
              </Link>

              <a
                href="#services"
                className="btn btn-outline hero-outline"
              >
                View Services
              </a>
            </div>

            <div className="hero-trust">

              <div className="trust-item">
                <strong>01</strong>
                <span>
                  Certified
                  <br />
                  Mechanics
                </span>
              </div>

              <div className="trust-divider" />

              <div className="trust-item">
                <strong>02</strong>
                <span>
                  Quality
                  <br />
                  Workmanship
                </span>
              </div>

              <div className="trust-divider" />

              <div className="trust-item">
                <strong>03</strong>
                <span>
                  Genuine
                  <br />
                  Parts
                </span>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =====================================================
          QUICK SERVICE STRIP
      ====================================================== */}
      <section className="service-strip">
        <div className="service-strip-inner">

          <div className="strip-item">
            <span className="strip-icon">⚙</span>

            <div>
              <strong>Vehicle Diagnostics</strong>
              <span>Accurate fault detection</span>
            </div>
          </div>

          <div className="strip-item">
            <span className="strip-icon">🔧</span>

            <div>
              <strong>Expert Repairs</strong>
              <span>Professional workmanship</span>
            </div>
          </div>

          <div className="strip-item">
            <span className="strip-icon">🚗</span>

            <div>
              <strong>Vehicle Servicing</strong>
              <span>Keep your car road-ready</span>
            </div>
          </div>

          <div className="strip-item">
            <span className="strip-icon">▣</span>

            <div>
              <strong>Genuine Parts</strong>
              <span>Quality parts in stock</span>
            </div>
          </div>

        </div>
      </section>

      {/* =====================================================
          SERVICES
      ====================================================== */}
      <section className="home-section" id="services">

        <div className="home-section-inner">

          <div className="section-heading">

            <div>
              <span className="section-eyebrow">
                WHAT WE DO
              </span>

              <h2>Our Services</h2>
            </div>

            <p>
              Professional automotive services delivered by experienced
              mechanics using quality equipment and reliable parts.
            </p>

          </div>

          {loading ? (
            <p className="muted-text">
              Loading services…
            </p>
          ) : services.length === 0 ? (
            <div className="empty-state">
              <span>⚙</span>
              <p>Services will appear here soon.</p>
            </div>
          ) : (
            <div className="catalog-grid">

              {services.map((s) => (

                <div
                  key={s.id}
                  className="catalog-card"
                >

                  {s.image_url ? (
                    <img
                      className="catalog-img"
                      src={s.image_url}
                      alt={s.name}
                    />
                  ) : (
                    <div className="catalog-img catalog-img-placeholder">
                      <span>⚙</span>
                    </div>
                  )}

                  <div className="card-content">

                    <span className="card-number">
                      {String(s.id).padStart(2, '0')}
                    </span>

                    <h3>{s.name}</h3>

                    {s.description && (
                      <p className="catalog-desc">
                        {s.description}
                      </p>
                    )}

                    {s.estimated_price !== null &&
                      s.estimated_price !== undefined &&
                      s.estimated_price !== '' && (
                        <div className="catalog-price">
                          From MK{' '}
                          {Number(
                            s.estimated_price
                          ).toLocaleString()}
                        </div>
                      )}

                    <button
                      type="button"
                      className="card-link"
                      onClick={() =>
                        requireAccount(
                          'Create a free account to book this service.'
                        )
                      }
                    >
                      Book Service
                      <span>→</span>
                    </button>

                  </div>

                </div>

              ))}

            </div>
          )}

        </div>

      </section>

      {/* =====================================================
          WHY CHOOSE US
      ====================================================== */}
      <section className="why-section">

        <div className="why-inner">

          <div
            className="why-image"
            style={{
              '--why-image': `url("${garageHero}")`,
            }}
          >

            <div className="why-image-overlay">
              <span>UPTOWN</span>
              <strong>GARAGE</strong>
            </div>

          </div>

          <div className="why-content">

            <span className="section-eyebrow">
              WHY UPTOWN GARAGE
            </span>

            <h2>
              We take care of your car
              <span>like it matters.</span>
            </h2>

            <p>
              Your vehicle deserves more than a quick fix. At Uptown
              Garage, we combine experienced technicians, proper
              diagnostics and quality parts to provide dependable
              automotive care.
            </p>

            <div className="why-list">

              <div className="why-item">

                <span className="why-check">✓</span>

                <div>
                  <strong>Experienced Technicians</strong>

                  <p>
                    Skilled mechanics focused on quality workmanship.
                  </p>
                </div>

              </div>

              <div className="why-item">

                <span className="why-check">✓</span>

                <div>
                  <strong>Transparent Service</strong>

                  <p>
                    Clear job information and approvals before work begins.
                  </p>
                </div>

              </div>

              <div className="why-item">

                <span className="why-check">✓</span>

                <div>
                  <strong>Digital Service History</strong>

                  <p>
                    Keep track of your vehicle's maintenance history online.
                  </p>
                </div>

              </div>

            </div>

            <Link
              to="/register"
              className="btn btn-dark"
            >
              Get Started
              <span>→</span>
            </Link>

          </div>

        </div>

      </section>

      {/* =====================================================
          PARTS
      ====================================================== */}
      <section
        className="home-section parts-section"
        id="parts"
      >

        <div className="home-section-inner">

          <div className="section-heading">

            <div>
              <span className="section-eyebrow">
                PARTS & ACCESSORIES
              </span>

              <h2>Genuine Spare Parts</h2>
            </div>

            <p>
              Find quality replacement parts for your vehicle from
              our available inventory.
            </p>

          </div>

          {loading ? (
            <p className="muted-text">
              Loading parts…
            </p>
          ) : parts.length === 0 ? (
            <div className="empty-state">
              <span>▣</span>
              <p>Parts will appear here soon.</p>
            </div>
          ) : (
            <div className="catalog-grid parts-grid">

              {parts.map((p) => (

                <div
                  key={p.id}
                  className="catalog-card part-card"
                >

                  {p.image_url ? (
                    <img
                      className="catalog-img"
                      src={p.image_url}
                      alt={p.name}
                    />
                  ) : (
                    <div className="catalog-img catalog-img-placeholder">
                      <span>▣</span>
                    </div>
                  )}

                  <div className="card-content">

                    <h3>{p.name}</h3>

                    <div className="catalog-price">
                      MK{' '}
                      {Number(
                        p.unit_price
                      ).toLocaleString()}
                    </div>

                    <span
                      className={`stock-badge ${
                        Number(p.quantity) > 0
                          ? 'stock-in'
                          : 'stock-out'
                      }`}
                    >
                      {Number(p.quantity) > 0
                        ? '● In Stock'
                        : '● Out of Stock'}
                    </span>

                    <button
                      type="button"
                      className="card-link"
                      onClick={() =>
                        requireAccount(
                          'Create a free account to order this part.'
                        )
                      }
                      disabled={Number(p.quantity) === 0}
                    >
                      Order Part
                      <span>→</span>
                    </button>

                  </div>

                </div>

              ))}

            </div>
          )}

          <div className="see-more-wrap">

            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() =>
                requireAccount(
                  'Create a free account to browse our full parts catalog.'
                )
              }
            >
              View Full Parts Catalog
              <span>→</span>
            </button>

          </div>

        </div>

      </section>

   
      <section className="cta-section">

        <div className="cta-inner">

          <div>

            <span className="section-eyebrow">
              READY TO GET STARTED?
            </span>

            <h2>
              Put your vehicle in good hands.
            </h2>

            <p>
              Book your next service with Uptown Garage and
              experience professional automotive care.
            </p>

          </div>

          <Link
            to="/register"
            className="btn cta-button"
          >
            Book an Appointment
            <span>→</span>
          </Link>

        </div>

      </section>

   
      <footer className="home-footer">

        <div className="home-footer-inner">

          <div className="footer-col footer-brand-col">

            <div className="footer-brand">

              <span className="footer-brand-mark">
                ⚙
              </span>

              <span>
                UPTOWN GARAGE
              </span>

            </div>

            <p className="footer-about">
              A full-service automotive workshop and spare parts
              store focused on honest diagnostics, quality
              workmanship and dependable vehicle care.
            </p>

          </div>

          <div className="footer-col">

            <h4>Services</h4>

            <ul className="footer-list">
              <li>Vehicle Diagnostics</li>
              <li>General Servicing</li>
              <li>Engine Repairs</li>
              <li>Brake &amp; Suspension</li>
            </ul>

          </div>

          <div className="footer-col">

            <h4>Workshop</h4>

            <address className="footer-address">
              Uptown Garage Workshop
              <br />
              Paul Kagame Road,
              <br />
              Blantyre, Malawi
            </address>

            <p className="footer-hours">
              Mon – Sat: 7:30am – 5:30pm
              <br />
              Sun: Closed
            </p>

          </div>

          <div className="footer-col">

            <h4>Contact</h4>

            <ul className="footer-list">
              <li>📞 +265 999 000 000</li>
              <li>✉ info@uptowngarage.example</li>
              <li>💬 WhatsApp bookings</li>
            </ul>

          </div>

        </div>

        <div className="home-footer-bottom">

          <p>
            © {new Date().getFullYear()} Uptown Garage.
            All rights reserved.
          </p>

          <p>
            Professional Auto Care • Blantyre, Malawi
          </p>

        </div>

      </footer>

    </div>
  );
}