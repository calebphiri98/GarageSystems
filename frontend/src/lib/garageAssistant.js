export const PHONE_DISPLAY = '0995727978';
export const PHONE_LINK = 'tel:+265995727978';
export const LOCATION = 'Paul Kagame Road, Blantyre, Malawi';
export const HOURS = 'Monday to Saturday, 7:30 AM to 5:30 PM. Closed Sunday.';
export const GREETING = 'Welcome to Uptown Garage! Ask me about our services, location, opening hours, or how to contact the owner.';
export const SUGGESTIONS = [
  'What services do you offer?',
  'Where are you located?',
  'What are your opening hours?',
  'How can I contact the owner?',
];

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const matches = (text, expressions) => expressions.some((expression) => expression.test(text));
const fallback = `I can help with services, opening hours, location, and contact information. For anything else, please contact the garage owner at ${PHONE_DISPLAY}.`;

export function answerQuestion(question, services, serviceError) {
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
