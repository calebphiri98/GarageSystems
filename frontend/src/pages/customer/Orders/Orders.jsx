import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Orders.css';

const STATUS_BADGE = {
  Pending: 'badge-warning',
  Confirmed: 'badge-info',
  Rejected: 'badge-danger',
  Cancelled: 'badge-neutral',
  'Ready for Collection': 'badge-success',
  Completed: 'badge-neutral',
};

export default function Orders() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  const loadParts = async () => {
    try {
      const params = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (category) {
        params.category = category;
      }

      if (minPrice !== '') {
        params.min_price = minPrice;
      }

      if (maxPrice !== '') {
        params.max_price = maxPrice;
      }

      const { data } = await api.get('/inventory', { params });
      setParts(data?.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load parts.');
    }
  };

  const loadOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data?.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load orders.');
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadParts();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, category, minPrice, maxPrice]);

  const categories = [...new Set(
    parts
      .map((part) => part.category?.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

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

    try {
      await api.post('/orders', { items });
      setMessage('Order submitted successfully.');
      setCart({});
      await loadOrders();
      await loadParts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit order.');
    }
  };

  const cancelOrder = async (id) => {
    setCancellingId(id);
    setMessage('');
    setError('');

    try {
      await api.post(`/orders/${id}/cancel`);
      setMessage('Order cancelled successfully.');
      await loadOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setShowPriceFilter(false);
  };

  const hasFilters =
    search ||
    category ||
    minPrice !== '' ||
    maxPrice !== '';

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1>Parts & Orders</h1>
          <p>Browse available parts and place an order.</p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="catalog-section">
        <div className="section-header">
          <div>
            <h2>Available Parts</h2>
            <p>Select the parts and quantities you need.</p>
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="filter-search"
            type="text"
            placeholder="Search parts by name, SKU or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {categories.length > 0 && (
            <select
              className="filter-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}

          <div className="price-filter-wrapper">
            <button
              type="button"
              className={`price-filter-button ${
                minPrice !== '' || maxPrice !== '' ? 'active' : ''
              }`}
              onClick={() => setShowPriceFilter((current) => !current)}
            >
              Price
              {(minPrice !== '' || maxPrice !== '') && ' • Filtered'}
              <span>▾</span>
            </button>

            {showPriceFilter && (
              <div className="price-filter-dropdown">
                <div className="price-filter-title">Price range</div>

                <div className="price-inputs">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min price"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />

                  <input
                    type="number"
                    min="0"
                    placeholder="Max price"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="price-apply-button"
                  onClick={() => setShowPriceFilter(false)}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {hasFilters && (
            <button
              type="button"
              className="clear-filter-button"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>

        <div className="parts-table-wrapper">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Part</th>
                <th>Category</th>
                <th>Price</th>
                <th>Available</th>
                <th>Quantity</th>
              </tr>
            </thead>

            <tbody>
              {parts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No parts found.
                  </td>
                </tr>
              ) : (
                parts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="part-image"
                        />
                      ) : (
                        <div className="part-image-placeholder">No image</div>
                      )}
                    </td>

                    <td>
                      <div className="part-name">{p.name}</div>
                      <div className="part-sku">{p.sku}</div>
                      {p.description && (
                        <div className="part-description">
                          {p.description}
                        </div>
                      )}
                    </td>

                    <td>
                      {p.category || 'Uncategorized'}
                    </td>

                    <td>
                      MK {Number(p.unit_price).toLocaleString()}
                    </td>

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
                        onChange={(e) =>
                          setQty(
                            p.id,
                            e.target.value,
                            Number(p.quantity)
                          )
                        }
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
            onClick={submitOrder}
          >
            Submit Order
          </button>
        </div>
      </section>

      <section className="orders-section">
        <div className="section-header">
          <div>
            <h2>My Orders</h2>
            <p>View and manage your submitted orders.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="empty-orders">
            You have not placed any orders yet.
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <strong>Order #{order.id}</strong>
                    <span>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString()
                        : ''}
                    </span>
                  </div>

                  <span
                    className={`status-badge ${
                      STATUS_BADGE[order.status] || 'badge-neutral'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div className="order-item" key={item.id || index}>
                        <span>
                          {item.part_name || item.name}
                        </span>

                        <span>
                          {item.quantity} × MK{' '}
                          {Number(
                            item.unit_price || item.price || 0
                          ).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="order-card-footer">
                  {order.total_amount !== undefined && (
                    <strong>
                      Total: MK{' '}
                      {Number(order.total_amount).toLocaleString()}
                    </strong>
                  )}

                  {(order.status === 'Pending' ||
                    order.status === 'Confirmed') && (
                    <button
                      type="button"
                      className="cancel-order-button"
                      disabled={cancellingId === order.id}
                      onClick={() => cancelOrder(order.id)}
                    >
                      {cancellingId === order.id
                        ? 'Cancelling...'
                        : 'Cancel Order'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}