import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../api/api';
import './Orders.css';
import './CategoryFilters.css';

const OTHER_CATEGORY = 'Other';

export default function CategoryOrders() {
  const { category } = useParams();
  const categoryLabel = decodeURIComponent(category || '');
  const isOther = categoryLabel === OTHER_CATEGORY;

  const [parts, setParts] = useState([]);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter panel state. Nothing is shown until the customer opens the panel.
  const [filterTypes, setFilterTypes] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [openTypes, setOpenTypes] = useState({});
  const [selected, setSelected] = useState([]); // selected option ids

  const loadParts = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (!isOther) params.category = categoryLabel;
      if (selected.length) params.filters = selected.join(',');

      const { data } = await api.get('/inventory', { params });
      const list = data?.data || data || [];
      setParts(isOther ? list.filter((p) => !p.category || !p.category.trim()) : list);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load parts.');
    }
  };

  // When the category changes: reset everything and load that category's filters.
  useEffect(() => {
    setCart({});
    setSearch('');
    setSelected([]);
    setOpenTypes({});
    setShowFilters(false);

    if (isOther) {
      setFilterTypes([]);
      return;
    }

    api
      .get('/inventory/filters', { params: { category: categoryLabel } })
      .then(({ data }) => setFilterTypes(data?.data || []))
      .catch(() => setFilterTypes([]));
  }, [categoryLabel]);

  // Reload parts whenever the category, search text or selected filters change.
  useEffect(() => {
    const timer = setTimeout(loadParts, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryLabel, search, selected]);

  const toggleType = (id) => setOpenTypes((cur) => ({ ...cur, [id]: !cur[id] }));

  const toggleOption = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const selectedChips = useMemo(() => {
    const chips = [];
    filterTypes.forEach((t) =>
      t.options.forEach((o) => {
        if (selected.includes(o.id)) chips.push({ id: o.id, label: `${t.name}: ${o.value}` });
      })
    );
    return chips;
  }, [filterTypes, selected]);

  const selectedInType = (type) => type.options.filter((o) => selected.includes(o.id)).length;

  const setQty = (partId, qty, max) => {
    const value = Math.max(0, Math.min(Number(qty) || 0, max));

    setCart((current) => {
      const next = { ...current };
      if (value === 0) {
        delete next[partId];
      } else {
        next[partId] = value;
      }
      return next;
    });
  };

  const cartCount = Object.keys(cart).length;

  const submitOrder = async () => {
    const items = Object.entries(cart)
      .map(([partId, quantity]) => ({
        part_id: Number(partId),
        quantity: Number(quantity),
      }))
      .filter((item) => item.quantity > 0);

    if (!items.length) {
      setError('Please select at least one part.');
      return;
    }

    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      await api.post('/orders', { items });
      setMessage('Order submitted successfully.');
      setCart({});
      await loadParts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <Link to="/customer/orders" className="clear-filter-button" style={{ marginBottom: 10, display: 'inline-block' }}>
            &larr; All categories
          </Link>
          <h1>{categoryLabel}</h1>
          <p>Pick the exact part and quantity you need, then submit your order.</p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="catalog-section">
        <div className="section-header">
          <div>
            <h2>{categoryLabel}</h2>
            <p>Select the parts and quantities you need.</p>
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="filter-search"
            type="text"
            placeholder={`Search ${categoryLabel} by name, SKU, serial number or brand...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filterTypes.length > 0 && (
            <button
              type="button"
              className={`filters-toggle ${showFilters ? 'is-open' : ''}`}
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              Filters{selected.length > 0 ? ` (${selected.length})` : ''}
            </button>
          )}

          {(search || selected.length > 0) && (
            <button
              type="button"
              className="clear-filter-button"
              onClick={() => {
                setSearch('');
                setSelected([]);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="filters-panel">
            {filterTypes.map((type) => {
              const isOpen = !!openTypes[type.id];
              const count = selectedInType(type);

              return (
                <div className="filter-group" key={type.id}>
                  <button
                    type="button"
                    className="filter-group-head"
                    aria-expanded={isOpen}
                    onClick={() => toggleType(type.id)}
                  >
                    <span>
                      {type.name}
                      {count > 0 && <em className="filter-group-count">{count}</em>}
                    </span>
                    <span className={`filter-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
                  </button>

                  {isOpen && (
                    <div className="filter-options">
                      {type.options.length === 0 ? (
                        <p className="filter-empty">No options added yet.</p>
                      ) : (
                        type.options.map((opt) => (
                          <label className="filter-option" key={opt.id}>
                            <input
                              type="checkbox"
                              checked={selected.includes(opt.id)}
                              onChange={() => toggleOption(opt.id)}
                            />
                            <span>{opt.value}</span>
                            <small>{opt.part_count}</small>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedChips.length > 0 && (
          <div className="filter-chips">
            {selectedChips.map((chip) => (
              <button
                type="button"
                key={chip.id}
                className="filter-chip"
                onClick={() => toggleOption(chip.id)}
                title="Remove filter"
              >
                {chip.label} &times;
              </button>
            ))}
          </div>
        )}

        <div className="parts-table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Part</th>
                <th>Price</th>
                <th>Available</th>
                <th>Quantity</th>
              </tr>
            </thead>

            <tbody>
              {parts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    {search || selected.length
                      ? 'No parts match your search or filters. Try removing a filter.'
                      : `No parts found in ${categoryLabel}.`}
                  </td>
                </tr>
              ) : (
                parts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="part-image" />
                      ) : (
                        <div className="part-image-placeholder">No image</div>
                      )}
                    </td>

                    <td>
                      <div className="part-name">{p.name}</div>
                      <div className="part-sku">
                        SKU: {p.sku}
                        {p.serial_number ? ` | Serial: ${p.serial_number}` : ''}
                        {p.brand ? ` | ${p.brand}` : ''}
                      </div>
                      {p.description && (
                        <div className="part-description">{p.description}</div>
                      )}
                    </td>

                    <td>MK {Number(p.unit_price).toLocaleString()}</td>

                    <td>
                      {Number(p.quantity) > 0 ? (
                        p.quantity
                      ) : (
                        <span className="out-of-stock">Out of stock</span>
                      )}
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        max={Number(p.quantity)}
                        value={cart[p.id] || ''}
                        disabled={Number(p.quantity) <= 0}
                        onChange={(e) => setQty(p.id, e.target.value, Number(p.quantity))}
                        className="quantity-input"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="order-actions">
          <button
            type="button"
            className="submit-order-button"
            disabled={submitting || cartCount === 0}
            onClick={submitOrder}
          >
            {submitting ? 'Submitting...' : `Submit Order${cartCount ? ` (${cartCount})` : ''}`}
          </button>
        </div>
      </section>
    </div>
  );
}