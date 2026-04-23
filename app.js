// Data Models and Storage
const STATE = {
    prenotazioni: JSON.parse(localStorage.getItem('prenotazioni')) || [],
    rifornimenti: JSON.parse(localStorage.getItem('rifornimenti')) || [],
    spesa: JSON.parse(localStorage.getItem('spesa')) || []
};

function saveData() {
    localStorage.setItem('prenotazioni', JSON.stringify(STATE.prenotazioni));
    localStorage.setItem('rifornimenti', JSON.stringify(STATE.rifornimenti));
    localStorage.setItem('spesa', JSON.stringify(STATE.spesa));
    renderAll();
}

// Navigation & Tabs
document.getElementById('nav-macchina').addEventListener('click', () => switchSection('sec-macchina', 'nav-macchina'));
document.getElementById('nav-spesa').addEventListener('click', () => switchSection('sec-spesa', 'nav-spesa'));

function switchSection(secId, navId) {
    document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(secId).classList.add('active');
    document.getElementById(navId).classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsk0ZR933_QMWj2JnO31m1gfH91_c4Tyo_GfFZUCJzrn3eQlKfXziUls50uBvuIaJr/exec";

document.getElementById('form-prenotazione').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Salvataggio in corso...';
    btnSubmit.disabled = true;

    const utente = document.getElementById('prenotazione-utente').value;
    const dataInizio = document.getElementById('prenotazione-data-inizio').value;
    const dataFine = document.getElementById('prenotazione-data-fine').value;
    const oraInizio = document.getElementById('prenotazione-inizio').value;
    const oraFine = document.getElementById('prenotazione-fine').value;
    const km = parseInt(document.getElementById('prenotazione-km').value);
    const motivo = document.getElementById('prenotazione-motivo').value;
    
    if (!km || km < 1) {
        alert("Inserisci un numero di Km valido.");
        return;
    }
    
    const obj = {
        id: Date.now(),
        action: 'create', // Nuova proprietà per Apps Script
        utente,
        dataInizio,
        dataFine,
        inizio: oraInizio,
        fine: oraFine,
        km,
        motivo,
        timestamp: new Date().toLocaleString(),
        status: 'attiva'
    };
    
    // Salva localmente per reattività immediata
    STATE.prenotazioni.push(obj);
    saveData();
    e.target.reset();
    
    // Invia al server Google
    try {
        if (APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                // Apps Script gestisce meglio le POST semplici senza preflight se usiamo text/plain
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(obj)
            });
            const result = await response.json();
            if(result.status === 'success') {
                alert("Prenotazione salvata e sincronizzata sul calendario!");
            } else {
                alert("Errore remoto: " + result.message);
            }
        } else {
            alert("Prenotazione salvata localmente! (Ricordati di inserire l'URL di Apps Script)");
        }
    } catch (err) {
        console.error(err);
        alert("Errore di rete. Prenotazione salvata solo localmente.");
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

async function cancellaPrenotazione(id) {
    const p = STATE.prenotazioni.find(x => x.id === id);
    if(p) {
        if (!confirm("Sei sicuro di voler cancellare la prenotazione? Questa azione modificherà anche il calendario.")) {
            return;
        }

        p.status = 'cancellata';
        // In un'app reale qui avremmo il nome dell'utente loggato, per ora lo impostiamo genericamente
        p.deletedBy = "Utente corrente";
        p.deletedAt = new Date().toLocaleString();
        saveData();

        // Invia cancellazione a Apps Script
        if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
            try {
                await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'delete', id: id, timestamp: p.deletedAt, utente: p.deletedBy })
                });
            } catch(e) {
                console.error("Errore cancellazione remota:", e);
            }
        }
    }
}

// Macchina: Rifornimenti
document.getElementById('form-rifornimento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Salvataggio in corso...';
    btnSubmit.disabled = true;

    const utente = document.getElementById('rifornimento-utente').value;
    const data = document.getElementById('rifornimento-data').value;
    const importo = parseFloat(document.getElementById('rifornimento-importo').value);
    const costoL = parseFloat(document.getElementById('rifornimento-costo').value);
    
    const litri = parseFloat((importo / costoL).toFixed(2));
    const timestamp = new Date().toLocaleString();
    
    const obj = { id: Date.now(), utente, data, importo, costoL, litri, timestamp };
    STATE.rifornimenti.push(obj);
    saveData();
    e.target.reset();
    
    try {
        if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'create_rifornimento', ...obj })
            });
        }
        alert("Rifornimento inserito con successo!");
    } catch(err) {
        console.error(err);
        alert("Rifornimento salvato localmente (errore di rete).");
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

// Spesa
document.getElementById('form-spesa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Aggiunta...';
    btnSubmit.disabled = true;

    const utente = document.getElementById('spesa-utente').value;
    const prodotto = document.getElementById('spesa-prodotto').value;
    const timestamp = new Date().toLocaleString();
    
    const obj = { id: Date.now(), prodotto, utente, timestamp, status: 'attiva' };
    STATE.spesa.push(obj);
    saveData();
    e.target.reset();

    try {
        if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'create_spesa', ...obj })
            });
        }
    } catch(err) {
        console.error(err);
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

// Resa globale nello scope window
window.rimuoviSpesa = async function(id) {
    if(!confirm("Vuoi davvero eliminare questo prodotto dalla lista della spesa?")) return;

    const s = STATE.spesa.find(x => x.id === id);
    if(s) {
        s.status = 'cancellata';
        saveData();
        
        if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
            try {
                await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'delete_spesa', id: id })
                });
            } catch(e) {
                console.error("Errore cancellazione spesa:", e);
            }
        }
    }
};

window.cancellaPrenotazione = cancellaPrenotazione;

// Render UI
function renderRegistro() {
    const list = document.getElementById('lista-registro');
    list.innerHTML = '';
    
    const sorted = [...STATE.prenotazioni].sort((a,b) => b.id - a.id);
    sorted.forEach(p => {
        const li = document.createElement('li');
        li.className = 'list-item';
        
        let contentHTML = `<div class="list-item-content">
            <span class="list-item-title">${p.utente} - ${p.km} Km previsti ${p.motivo ? `(Motivo: ${p.motivo})` : ''}</span>
            <span class="list-item-meta">Dal: ${p.dataInizio || p.data || ''} ore ${p.inizio} - Al: ${p.dataFine || p.data || ''} ore ${p.fine} (Creata il ${p.timestamp})</span>`;
            
        if(p.status === 'cancellata') {
            contentHTML += `<span class="list-item-meta" style="color:var(--danger)">Cancellata il ${p.deletedAt} da ${p.deletedBy}</span>`;
        }
        contentHTML += `</div>`;
        
        li.innerHTML = contentHTML;
        
        if(p.status === 'attiva') {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = 'Annulla';
            delBtn.onclick = () => window.cancellaPrenotazione(p.id);
            li.appendChild(delBtn);
        }
        
        list.appendChild(li);
    });
}

function renderSpesa() {
    const list = document.getElementById('lista-spesa');
    list.innerHTML = '';
    
    // Mostriamo in cima i più recenti, solo quelli attivi
    const sortedSpesa = STATE.spesa.filter(s => s.status !== 'cancellata').sort((a,b) => b.id - a.id);
    sortedSpesa.forEach(s => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <div class="list-item-content">
                <span class="list-item-title">${s.prodotto}</span>
                <span class="list-item-meta">Aggiunto da ${s.utente || 'Ignoto'} il ${s.timestamp || s.data}</span>
            </div>
            <button class="delete-btn" onclick="window.rimuoviSpesa(${s.id})">Rimuovi</button>
        `;
        list.appendChild(li);
    });
}

// Dashboard Charts
let charts = {};
function renderDashboard() {
    const utenti = ['Mamma', 'Papà', 'Mary', 'Gio', 'Betty'];
    
    // Aggregate Data
    const dataKm = utenti.map(u => STATE.prenotazioni.filter(p => p.utente === u && p.status === 'attiva').reduce((sum, p) => sum + p.km, 0));
    const dataSpese = utenti.map(u => STATE.rifornimenti.filter(r => r.utente === u).reduce((sum, r) => sum + r.importo, 0));
    const dataLitri = utenti.map(u => STATE.rifornimenti.filter(r => r.utente === u).reduce((sum, r) => sum + (r.litri || 0), 0));
    const dataPren = utenti.map(u => STATE.prenotazioni.filter(p => p.utente === u && p.status === 'attiva').length);
    
    const totalKm = dataKm.reduce((a,b) => a+b, 0);
    const totalSpese = dataSpese.reduce((a,b) => a+b, 0);
    const totalLitri = dataLitri.reduce((a,b) => a+b, 0);
    
    const statKmEl = document.getElementById('stat-km');
    if(statKmEl) statKmEl.textContent = totalKm;
    
    const statFuelEl = document.getElementById('stat-fuel');
    if(statFuelEl) statFuelEl.textContent = totalSpese.toFixed(2) + ' €';
    
    const statLitriEl = document.getElementById('stat-litri');
    if(statLitriEl) statLitriEl.textContent = totalLitri.toFixed(2) + ' L';

    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.font.family = 'Outfit';

    if(charts.km) charts.km.destroy();
    charts.km = new Chart(document.getElementById('chart-km'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'Km Previsti', data: dataKm, backgroundColor: '#3b82f6' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Chilometri per Utente' } } }
    });

    if(charts.spese) charts.spese.destroy();
    charts.spese = new Chart(document.getElementById('chart-spese'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'Spese Rifornimenti (€)', data: dataSpese, backgroundColor: '#ef4444' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Spese Carburante' } } }
    });

    if(charts.litri) charts.litri.destroy();
    charts.litri = new Chart(document.getElementById('chart-litri'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'Litri Versati (L)', data: dataLitri, backgroundColor: '#10b981' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Quantità Benzina (Litri)' } } }
    });

    if(charts.pren) charts.pren.destroy();
    charts.pren = new Chart(document.getElementById('chart-prenotazioni'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'N. Prenotazioni attive', data: dataPren, backgroundColor: '#8b5cf6' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Numero di Prenotazioni Attive' } } }
    });
}

function renderAll() {
    renderRegistro();
    renderSpesa();
    renderDashboard();
}

// Init
renderAll();

async function syncWithCloud() {
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
        try {
            // Eseguiamo una GET all'URL dello script per ottenere tutti i dati aggiornati
            const response = await fetch(APPS_SCRIPT_URL);
            const data = await response.json();
            
            // Sovrascriviamo lo stato locale con quello che arriva da Google Sheets (la fonte della verità)
            if (data.prenotazioni) {
                STATE.prenotazioni = data.prenotazioni;
            }
            if (data.rifornimenti) {
                STATE.rifornimenti = data.rifornimenti;
            }
            if (data.spesa) {
                STATE.spesa = data.spesa;
            }
            
            // Salviamo e aggiorniamo l'interfaccia
            saveData();
            console.log("Sincronizzazione completata: dati aggiornati dal Cloud.");
        } catch(e) {
            console.error("Impossibile sincronizzare dal Cloud. Vengono usati i dati locali.", e);
        }
    }
}

// Avviamo la sincronizzazione in background all'apertura dell'app
syncWithCloud();
