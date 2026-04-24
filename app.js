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
    
    if (secId === 'sec-macchina') {
        document.body.className = 'theme-macchina';
    } else if (secId === 'sec-spesa') {
        document.body.className = 'theme-spesa';
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!e.target.dataset.target) return; // Ignora i bottoni dei sub-tab (Singolo/Famiglia)
        
        document.querySelectorAll('.tab-btn[data-target]').forEach(el => el.classList.remove('active'));
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
    
    // Controlli di validità su Data e Ora
    const startDateTime = new Date(`${dataInizio}T${oraInizio}`);
    const endDateTime = new Date(`${dataFine}T${oraFine}`);

    if (endDateTime <= startDateTime) {
        alert("Errore: La data e l'ora di fine devono essere successive a quelle di inizio. Non puoi prenotare nel passato!");
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
        return;
    }

    const minInizio = parseInt(oraInizio.split(':')[1]);
    const minFine = parseInt(oraFine.split(':')[1]);

    if (minInizio % 5 !== 0 || minFine % 5 !== 0) {
        alert("Errore: I minuti dell'orario devono essere multipli di 5 (es. 00, 05, 10, 15...). Usa i controlli del menu a tendina.");
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
        return;
    }
    
    if (!km || km < 1) {
        alert("Inserisci un numero di Km valido.");
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
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

window.switchDash = function(type) {
    document.getElementById('btn-dash-singolo').classList.remove('active');
    document.getElementById('btn-dash-collettivo').classList.remove('active');
    document.getElementById(`btn-dash-${type}`).classList.add('active');
    
    document.getElementById('dash-singolo').style.display = 'none';
    document.getElementById('dash-collettivo').style.display = 'none';
    document.getElementById(`dash-${type}`).style.display = 'block';
};

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
    if(statKmEl) statKmEl.textContent = totalKm + ' Km';
    
    const statFuelEl = document.getElementById('stat-fuel');
    if(statFuelEl) statFuelEl.textContent = totalSpese.toFixed(2) + ' €';
    
    const statLitriEl = document.getElementById('stat-litri');
    if(statLitriEl) statLitriEl.textContent = totalLitri.toFixed(2) + ' L';

    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.font.family = 'Outfit';

    if(charts.km) charts.km.destroy();
    charts.km = new Chart(document.getElementById('chart-km'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'Km Totali', data: dataKm, backgroundColor: '#3b82f6' }] },
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

    // --- NUOVO GRAFICO: BILANCIO CARBURANTE ---
    // Consumo macchina medio: 5.8 L/100km
    const consumoMedioKm_L = 100 / 5.8; // ~17.24 Km/L
    
    // Calcoliamo il costo medio della benzina al litro inserita fino ad oggi
    let costoMedioLitro = 1.8; // default
    if (totalLitri > 0) {
        costoMedioLitro = totalSpese / totalLitri;
    }
    const costoMedioKm = costoMedioLitro / consumoMedioKm_L; // Costo per singolo chilometro (es. ~0.104 €/km)
    
    // Calcoliamo il bilancio per ogni utente
    const dataBilancioKm = [];
    const tableHeader = document.getElementById('table-header-utenti');
    const tableRowKm = document.getElementById('table-row-km');
    const tableRowEuro = document.getElementById('table-row-euro');
    const tableRowScostamento = document.getElementById('table-row-scostamento');
    
    // Resettiamo le righe
    tableHeader.innerHTML = '<th>Dato</th>';
    tableRowKm.innerHTML = '<td style="text-align: left; font-weight: 600;">Km Percorsi</td>';
    tableRowEuro.innerHTML = '<td style="text-align: left; font-weight: 600;">€ Versati</td>';
    tableRowScostamento.innerHTML = '<td style="text-align: left; font-weight: 600;">Bilancio (€)</td>';

    utenti.forEach(u => {
        const kmGuidati = STATE.prenotazioni.filter(p => p.utente === u && p.status === 'attiva').reduce((sum, p) => sum + p.km, 0);
        const litriComprati = STATE.rifornimenti.filter(r => r.utente === u).reduce((sum, r) => sum + (r.litri || 0), 0);
        const euroVersati = STATE.rifornimenti.filter(r => r.utente === u).reduce((sum, r) => sum + r.importo, 0);
        
        // Il credito in Km guadagnato grazie ai litri versati
        const creditoKm = litriComprati * consumoMedioKm_L;
        const bilancioKm = creditoKm - kmGuidati;
        dataBilancioKm.push(parseFloat(bilancioKm.toFixed(1)));
        
        // Calcolo monetario per la tabella
        // Quanto avrebbe dovuto pagare per i km guidati
        const debitoEuro = kmGuidati * costoMedioKm;
        // Scostamento = quanto ha versato - quanto avrebbe dovuto versare
        const bilancioEuro = euroVersati - debitoEuro;
        
        // Popoliamo la tabella
        tableHeader.innerHTML += `<th>${u}</th>`;
        tableRowKm.innerHTML += `<td>${kmGuidati}</td>`;
        tableRowEuro.innerHTML += `<td>${euroVersati.toFixed(2)} €</td>`;
        
        let colorClass = '';
        let sign = '';
        if (bilancioEuro > 0.5) { // margine
            colorClass = 'text-green';
            sign = '+';
        } else if (bilancioEuro < -0.5) {
            colorClass = 'text-red';
        }
        
        tableRowScostamento.innerHTML += `<td class="${colorClass}">${sign}${bilancioEuro.toFixed(2)} €</td>`;
    });

    // Assegnazione colori condizionale per grafico
    const coloriBilancio = dataBilancioKm.map(b => {
        if (b < 0) return 'rgba(239, 68, 68, 0.9)'; // Rosso
        if (b > 0) return 'rgba(16, 185, 129, 0.9)'; // Verde
        return 'rgba(234, 179, 8, 0.9)'; // Giallo
    });

    if(charts.bilancio) charts.bilancio.destroy();
    charts.bilancio = new Chart(document.getElementById('chart-bilancio'), {
        type: 'bar',
        data: {
            labels: utenti,
            datasets: [{
                data: dataBilancioKm,
                backgroundColor: coloriBilancio,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'Bilancio Carburante (Consumo stimato: 5.8 L/100Km)',
                    font: { size: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            return `Scostamento: ${val > 0 ? '+' : ''}${val} Km`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    title: { display: true, text: 'Scostamento in Km' }
                }
            }
        }
    });

    // --- GRAFICI COLLETTIVI (ANDAMENTO MENSILE) ---
    const monthKeys = [];
    STATE.prenotazioni.filter(p => p.status === 'attiva').forEach(p => {
        if(p.dataInizio || p.data) monthKeys.push((p.dataInizio || p.data).substring(0, 7)); // YYYY-MM
    });
    STATE.rifornimenti.forEach(r => {
        if(r.data) monthKeys.push(r.data.substring(0, 7));
    });
    
    const uniqueMonths = [...new Set(monthKeys)].sort(); // Ordinamento cronologico
    const labelsColl = uniqueMonths.map(ym => {
        const [y, m] = ym.split('-');
        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return `${months[parseInt(m)-1]} ${y}`;
    });

    const dataCollKm = uniqueMonths.map(ym => STATE.prenotazioni.filter(p => p.status === 'attiva' && (p.dataInizio || p.data || '').startsWith(ym)).reduce((sum, p) => sum + p.km, 0));
    const dataCollSpese = uniqueMonths.map(ym => STATE.rifornimenti.filter(r => (r.data || '').startsWith(ym)).reduce((sum, r) => sum + r.importo, 0));
    const dataCollLitri = uniqueMonths.map(ym => STATE.rifornimenti.filter(r => (r.data || '').startsWith(ym)).reduce((sum, r) => sum + (r.litri || 0), 0));
    const dataCollPren = uniqueMonths.map(ym => STATE.prenotazioni.filter(p => p.status === 'attiva' && (p.dataInizio || p.data || '').startsWith(ym)).length);

    if(charts.collKm) charts.collKm.destroy();
    charts.collKm = new Chart(document.getElementById('chart-coll-km'), {
        type: 'line',
        data: { labels: labelsColl, datasets: [{ label: 'Km Totali', data: dataCollKm, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Chilometri' } } }
    });

    if(charts.collSpese) charts.collSpese.destroy();
    charts.collSpese = new Chart(document.getElementById('chart-coll-spese'), {
        type: 'line',
        data: { labels: labelsColl, datasets: [{ label: 'Spese Rifornimenti (€)', data: dataCollSpese, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Spese Carburante' } } }
    });

    if(charts.collLitri) charts.collLitri.destroy();
    charts.collLitri = new Chart(document.getElementById('chart-coll-litri'), {
        type: 'line',
        data: { labels: labelsColl, datasets: [{ label: 'Litri Versati (L)', data: dataCollLitri, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Litri' } } }
    });

    if(charts.collPren) charts.collPren.destroy();
    charts.collPren = new Chart(document.getElementById('chart-coll-prenotazioni'), {
        type: 'line',
        data: { labels: labelsColl, datasets: [{ label: 'N. Prenotazioni', data: dataCollPren, borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Prenotazioni' } } }
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
