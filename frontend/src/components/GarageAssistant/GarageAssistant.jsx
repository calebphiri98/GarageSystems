import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import useGarageConversation from '../../hooks/useGarageConversation';
import { SUGGESTIONS, PHONE_DISPLAY, PHONE_LINK } from '../../lib/garageAssistant';
import './GarageAssistant.css';

export default function GarageAssistant() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const bottomRef = useRef(null);
  const { messages, send } = useGarageConversation(user, services, serviceError);
  const isGuestPage = ['/', '/login', '/register'].includes(location.pathname);
  const isLiveChatPage = location.pathname === '/customer/live-chat';
  const visible = !isLiveChatPage && (isGuestPage || (user?.role === 'customer' && location.pathname.startsWith('/customer')));

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

  function submit(text) {
    send(text);
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
            {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => submit(suggestion)}>{suggestion}</button>)}
          </div>
          <form className="garage-assistant-form" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
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
