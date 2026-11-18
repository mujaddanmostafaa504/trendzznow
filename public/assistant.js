(() => {
  const root = document.getElementById('tnAssistant');
  if (!root) return;
  const button = root.querySelector('[data-assistant-toggle]');
  const panel = root.querySelector('[data-assistant-panel]');
  const close = root.querySelector('[data-assistant-close]');
  const form = root.querySelector('form');
  const input = root.querySelector('input[name="message"]');
  const list = root.querySelector('[data-assistant-messages]');
  const send = root.querySelector('button[type="submit"]');
  const whatsapp = String(root.dataset.whatsapp || '').replace(/\D/g, '').replace(/^0/, '88');
  const handoff = root.dataset.handoff || 'For more help, contact our support team.';
  const messages = [];
  let busy = false;

  function addMessage(role, text) {
    const item = document.createElement('div');
    item.className = `tn-assistant-message ${role}`;
    item.textContent = text;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }
  function openPanel() {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  close.addEventListener('click', closePanel);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;
    busy = true;
    send.disabled = true;
    input.value = '';
    addMessage('user', message);
    messages.push({ role: 'user', content: message });
    const typing = document.createElement('div');
    typing.className = 'tn-assistant-message assistant typing';
    typing.textContent = 'Typing…';
    list.appendChild(typing);
    list.scrollTop = list.scrollHeight;
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-8) })
      });
      const data = await response.json();
      typing.remove();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to answer right now.');
      addMessage('assistant', data.answer);
      messages.push({ role: 'assistant', content: data.answer });
      if (messages.length > 8) messages.splice(0, messages.length - 8);
    } catch (error) {
      typing.remove();
      addMessage('assistant', error.message || 'The assistant is temporarily unavailable.');
      if (whatsapp) {
        const link = document.createElement('a');
        link.className = 'tn-assistant-handoff';
        link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(handoff)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Contact support on WhatsApp';
        list.appendChild(link);
      }
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
      list.scrollTop = list.scrollHeight;
    }
  });
  addMessage('assistant', root.dataset.welcome || 'Hello! How can I help you today?');
})();
