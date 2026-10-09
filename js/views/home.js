export default {
  id: '',
  title: 'Home',
  render(el, { views }) {
    el.innerHTML = `
      <section class="card hero">
        <h1>ARMONIA</h1>
        <p class="muted" style="max-width:560px">Il tuo riferimento musicale tascabile: accordi, scale, intervalli, armonia e strumenti utili. Tocca qualsiasi tasto, diagramma o pulsante ▶ per ascoltare.</p>
        <div class="eq" aria-hidden="true">${'<span></span>'.repeat(18)}</div>
      </section>
      <div class="home-grid">
        ${views.map((v) => `<a class="card home-card" href="#/${v.id}"><div class="ico">${v.icon}</div><h3>${v.title}</h3><p class="muted small">${v.desc}</p></a>`).join('')}
      </div>
      <div class="info small">
        <b>Installa su Android:</b> apri il sito in Chrome → menu ⋮ → <i>Aggiungi a schermata Home</i> / <i>Installa app</i>. Funziona anche offline.<br>
        <b>Su PC:</b> usala nel browser, oppure clicca l’icona “Installa” nella barra degli indirizzi di Chrome/Edge.
      </div>`;
  },
};
