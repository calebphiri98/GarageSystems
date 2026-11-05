import { useEffect, useRef, useState } from 'react';
import api from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import useGarageConversation from '../../../hooks/useGarageConversation';
import { SUGGESTIONS, PHONE_DISPLAY, PHONE_LINK } from '../../../lib/garageAssistant';
import logo from '../../../assets/logo.jpeg';
import './LiveChat.css';

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function LiveChat() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState(false);
  const bottomRef = useRef(null);
  const { messages, send, reset } = useGarageConversation(user, services, serviceError);

  useEffect(() => {
    let active = true;
    api.get('/services').then((response) => {
      if (!active) return;
      setServices(Array.isArray(response.data?.data) ? response.data.data.filter((s) => s.is_active !== false) : []);
    }).catch(() => {
      if (!active) return;
      setServiceError(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function submit(text) {
    send(text);
    setInput('');
  }

  return (
    <div className="page live-chat-page">
      <div className="live-chat-shell">
        <div className="page-header live-chat-page-header">
          <div>
            <h1>Live Chat</h1>
            <p>Talk to the Uptown Garage assistant about services, location, hours and contact details.</p>
          </div>
        </div>

        <div className="live-chat-card">
          <header className="live-chat-header">
            <div className="live-chat-identity">
              <span className="live-chat-avatar">
                <img src={logo} alt="" />
                <span className="live-chat-status" aria-hidden="true" />
              </span>
              <div className="live-chat-identity-text">
                <strong>Uptown Garage Assistant</strong>
                <span><i className="live-chat-dot" aria-hidden="true" />Online · replies instantly</span>
              </div>
            </div>
            <button type="button" className="live-chat-new" onClick={reset}>New chat</button>
          </header>

          <div className="live-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <div key={message.id} className={`live-chat-row ${message.from}`}>
                {message.from === 'bot' && (
                  <span className="live-chat-bubble-avatar" aria-hidden="true">
                    <img src={logo} alt="" />
                  </span>
                )}
                <div className="live-chat-bubble-group">
                  <div className={`live-chat-message ${message.from}`}>{message.text}</div>
                  {formatTime(message.ts) && (
                    <span className="live-chat-time">{formatTime(message.ts)}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="live-chat-suggestions">
            <span className="live-chat-suggestions-label">Quick questions</span>
            <div className="live-chat-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => submit(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>

          <form className="live-chat-form" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
            <input
              aria-label="Ask the garage assistant"
              placeholder="Type your message..."
              maxLength={300}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="live-chat-send" aria-label="Send message" disabled={!input.trim()}>
              <SendIcon />
            </button>
          </form>

          <div className="live-chat-footer">
            Need personal assistance? <a href={PHONE_LINK}>Call {PHONE_DISPLAY}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
