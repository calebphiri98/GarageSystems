import { useCallback, useEffect, useRef, useState } from 'react';
import { GREETING, answerQuestion } from '../lib/garageAssistant';

const SYNC_EVENT = 'garage-assistant-conversation-updated';

const storageKey = (userId) => `uptown_garage_assistant_conversation_${userId}`;

function initialMessages() {
  return [{ id: 1, from: 'bot', text: GREETING, ts: Date.now() }];
}

function nextMessageId(messages) {
  return messages.reduce((max, message) => Math.max(max, Number(message.id) || 0), 0) + 1;
}

function readConversation(userId) {
  if (!userId) return initialMessages();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return initialMessages();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return initialMessages();
    const valid = parsed.filter(
      (message) => message && (message.from === 'bot' || message.from === 'user') && typeof message.text === 'string'
    );
    return valid.length ? valid : initialMessages();
  } catch {
    return initialMessages();
  }
}

function persistConversation(userId, messages) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(messages));
  } catch {
    // Storage may be unavailable (private mode / quota). Keep the chat working in memory.
  }
}

function broadcast(userId) {
  if (!userId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { userId } }));
}

/**
 * Chat conversation shared by the floating assistant and the Live Chat page.
 * Messages are persisted per customer so each customer keeps their own thread.
 */
export default function useGarageConversation(user, services, serviceError) {
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState(() => readConversation(userId));
  const messagesRef = useRef(messages);
  const nextId = useRef(nextMessageId(messages));
  const currentUserId = useRef(userId);

  function applyConversation(conversation) {
    messagesRef.current = conversation;
    nextId.current = nextMessageId(conversation);
    setMessages(conversation);
  }

  useEffect(() => {
    if (currentUserId.current === userId) return;
    currentUserId.current = userId;
    applyConversation(readConversation(userId));
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdate = (event) => {
      if (!userId || event.detail?.userId !== userId) return;
      applyConversation(readConversation(userId));
    };
    window.addEventListener(SYNC_EVENT, onUpdate);
    return () => window.removeEventListener(SYNC_EVENT, onUpdate);
  }, [userId]);

  const send = useCallback((text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const now = Date.now();
    const question = { id: nextId.current++, from: 'user', text: trimmed, ts: now };
    const reply = { id: nextId.current++, from: 'bot', text: answerQuestion(trimmed, services, serviceError), ts: now };
    const updated = [...messagesRef.current, question, reply];
    applyConversation(updated);
    persistConversation(userId, updated);
    broadcast(userId);
  }, [services, serviceError, userId]);

  const reset = useCallback(() => {
    applyConversation(initialMessages());
    if (userId) {
      try {
        localStorage.removeItem(storageKey(userId));
      } catch {
        // Ignore storage failures.
      }
    }
    broadcast(userId);
  }, [userId]);

  return { messages, send, reset };
}
