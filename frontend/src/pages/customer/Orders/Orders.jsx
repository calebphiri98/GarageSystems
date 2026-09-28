import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const OTHER_CATEGORY = 'Other';

export default function Orders() {
  const navigate = useNavigate();

  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [search, setSearch] = useState('');

  const loadParts = async () => {
    try {
      const params = {};
      if (search.trim()) {
        params.search = search.trim();
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
  }, [search]);

  const categories = useMemo(() => {
    const map = new Map();

    parts.forEach((p) => {
      const name = p.category?.trim() || OTHER_CATEGORY;
      if (!map.has(name)) {
        map.set(name, {
          name,
          count: 0,
          min: Infinity,
          max: -Infinity,
          image: null,
          inStock: false,
        });
      }
      const g = map.get(name);
      g.count += 1;
      const price = Number(p.unit_price);
      g.min = Math.min(g.min, price);
      g.max = Math.max(g.max, price);
      if (!g.image && p.image_url) g.image = p.image_url;
      if (Number(p.quantity) > 0) g.inStock = true;
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [parts]);

  const cancelOrder = async (id) => {
    setCancellingId(id);
    setMessage('');
    setError('');

    try {
      await api.put(`/orders/${id}/cancel`, {});
      setMessage('Order cancelled successfully.');
      await loadOrders();
      await loadParts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1>Parts & Orders</h1>
          <p>Choose a category to see the exact parts and prices available in it.</p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="catalog-section">
        <div className="section-header">
          <div>
            <h2>Browse by category</h2>
            <p>Pick a category to view its parts, availability and exact prices.</p>
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
          {search && (
            <button type="button" className="clear-filter-button" onClick={() => setSearch('')}>
              Clear
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">No parts match your search.</div>
        ) : (
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                className="category-card"
                onClick={() => navigate(`/customer/orders/${encodeURIComponent(cat.name)}`)}
              >
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="category-image" />
                ) : (
                  <div className="category-image-placeholder">No image</div>
                )}
                <div className="category-name">{cat.name}</div>
                <div className="category-count">
                  {cat.count} item{cat.count !== 1 ? 's' : ''}
                </div>
                <div className="category-price-range">
                  {cat.min === cat.max
                    ? `MK ${cat.min.toLocaleString()}`
                    : `MK ${cat.min.toLocaleString()} - MK ${cat.max.toLocaleString()}`}
                </div>
                {!cat.inStock && <span className="out-of-stock">Out of stock</span>}
              </button>
            ))}
          </div>
        )}
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

                  {order.status === 'Pending' && (
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