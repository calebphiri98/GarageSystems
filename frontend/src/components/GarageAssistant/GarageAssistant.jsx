import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import './GarageAssistant.css';

const PHONE_DISPLAY = '0995727978';
const PHONE_LINK = 'tel:+265995727978';
const LOCATION = 'Paul Kagame Road, Blantyre, Malawi';
const HOURS = 'Monday to Saturday, 7:30 AM to 5:30 PM. Closed Sunday.';
const GREETING = 'Welcome to Uptown Garage! Ask me about our services, location, opening hours, or how to contact the owner.';
const SUGGESTIONS = ['What services do you offer?', 'Where are you located?', 'What are your opening hours?', 'How can I contact the owner?'];
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const matches = (text, expressions) => expressions.some((expression) => expression.test(text));
const fallback = `I can help with services, opening hours, location, and contact information. For anything else, please contact the garage owner at ${PHONE_DISPLAY}.`;

function answerQuestion(question, services, serviceError) {
  const text = normalize(question);
  if (!text) return 'Please enter a question.';
  if (matches(text, [/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/])) return GREETING;
  if (matches(text, [/\b(where|location|located|address|directions|find you)\b/])) return `You can find Uptown Garage at ${LOCATION}. For directions or assistance, call ${PHONE_DISPLAY}.`;
  if (matches(text, [/\b(hour|hours|open|opening|closing|close|weekend|sunday|saturday|time)\b/])) return `Our advertised opening hours are ${HOURS} Please call ${PHONE_DISPLAY} to confirm holiday hours.`;
  if (matches(text, [/\b(contact|phone|number|call|whatsapp|owner|speak|human|person|help desk)\b/])) return `You can contact the Uptown Garage owner at ${PHONE_DISPLAY}.`;
  if (matches(text, [/\b(book|booking|appointment|register|account|sign up|sign in|login)\b/])) return `To book online, create an account using the Register link or sign in to your existing account. For assistance, call ${PHONE_DISPLAY}.`;
  if (matches(text, [/\b(price|prices|cost|charge|charges|how much|quotation|quote|estimate|fee)\b/])) {
    const priced = services.filter((s) => s.estimated_price !== null && s.estimated_price !== undefined && Number.isFinite(Number(s.estimated_price)));
    if (!priced.length) return `For an accurate quotation, please contact the owner at ${PHONE_DISPLAY}.`;
    const prices = priced.slice(0, 6).map((s) => `${s.name}: advertised estimate MK ${Number(s.estimated_price).toLocaleString()}`).join('; ');
    return `${prices}. These are estimates, not final quotes. For an exact price, contact ${PHONE_DISPLAY}.`;
  }
  if (matches(text, [/\b(service|services|repair|repairs|maintenance|fix|diagnostic|inspection|oil|engine|suspension|brake|parts|offer|available|do you do|can you)\b/])) {
    if (serviceError) return `I cannot retrieve the current service list right now. Please contact ${PHONE_DISPLAY} for confirmation.`;
    if (!services.length) return `There are no services listed at the moment. Please contact ${PHONE_DISPLAY}.`;
    const keyed = services.filter((s) => {
      const name = normalize(s.name);
      const words = name.split(' ').filter((w) => w.length > 3 && !['service', 'services', 'repair', 'maintenance', 'general', 'work'].includes(w));
      return words.some((word) => text.includes(word));
    });
    if (keyed.length) return `Our listed services include ${keyed.slice(0, 5).map((s) => s.name).join(', ')}. For a diagnosis or to confirm suitability, contact ${PHONE_DISPLAY}.`;
    return `Our currently listed services are ${services.slice(0, 10).map((s) => s.name).join(', ')}${services.length > 10 ? ', and more' : ''}. Ask about a specific service or contact ${PHONE_DISPLAY}.`;
  }
  return fallback;
}

export default function GarageAssistant() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ id: 1, from: 'bot', text: GREETING }]);
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const bottomRef = useRef(null);
  const nextId = useRef(2);
  const isGuestPage = ['/', '/login', '/register'].includes(location.pathname);
  const visible = isGuestPage || (user?.role === 'customer' && location.pathname.startsWith('/customer'));

  useEffect(() => {
    if (!open || catalogLoaded) return;
    let active = true;
    api.get('/services').then((response) => {
      if (!active) return;
      setServices(Array.isArray(response.data?.data) ? response.data.data.filter((s) => s.is_active !== false) : []);
      setCatalogLoaded(true);
    }).catch(() => {
      if (!active) return;
      setServiceError(true);
      setCatalogLoaded(true);
    });
    return () => { active = false; };
  }, [open, catalogLoaded]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const question = { id: nextId.current++, from: 'user', text: trimmed };
    const reply = { id: nextId.current++, from: 'bot', text: answerQuestion(trimmed, services, serviceError) };
    setMessages((previous) => [...previous, question, reply]);
    setInput('');
  }

  if (!visible) return null;

  return (
    <div className="garage-assistant">
      {open && (
        <section className="garage-assistant-panel" role="dialog" aria-label="Uptown Garage customer assistant">
          <div className="garage-assistant-header">
            <div><strong>Uptown Garage Assistant</strong><span>Service and visitor enquiries</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>
          <div className="garage-assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => <p key={message.id} className={`garage-assistant-message ${message.from}`}>{message.text}</p>)}
            <div ref={bottomRef} />
          </div>
          <div className="garage-assistant-suggestions">
            {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)}>{suggestion}</button>)}
          </div>
          <form className="garage-assistant-form" onSubmit={(event) => { event.preventDefault(); send(input); }}>
            <input aria-label="Ask the garage assistant" placeholder="Ask a question..." maxLength={300} value={input} onChange={(event) => setInput(event.target.value)} />
            <button type="submit" disabled={!input.trim()}>Send</button>
          </form>
          <div className="garage-assistant-footer">Need personal assistance? <a href={PHONE_LINK}>Call {PHONE_DISPLAY}</a></div>
        </section>
      )}
      <button type="button" className="garage-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close customer assistant' : 'Chat with Uptown Garage'} aria-expanded={open}>
        <span aria-hidden="true">{open ? '×' : '💬'}</span><span>{open ? 'Close' : 'Ask us'}</span>
      </button>
    </div>
  );
}
