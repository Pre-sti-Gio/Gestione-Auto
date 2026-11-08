// Data Models and Storage
const STATE = {
    prenotazioni: JSON.parse(localStorage.getItem('prenotazioni')) || [],
    rifornimenti: JSON.parse(localStorage.getItem('rifornimenti')) || []
};

// Pulizia dati della vecchia sezione "Spesa" (rimossa)
localStorage.removeItem('spesa');

// Google Sheets restituisce le date come istante UTC (es. "2026-04-23T22:00:00.000Z"
// = mezzanotte del 24/04 in Italia). Le riconvertiamo nel giorno locale "YYYY-MM-DD".
function toLocalYMD(value) {
    if (typeof value !== 'string' || !value.includes('T')) return value;
    const d = new Date(value);
    if (isNaN(d)) return value;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function normalizzaRifornimenti(lista) {
    return lista.map(r => ({ ...r, data: toLocalYMD(r.data) }));
}

STATE.rifornimenti = normalizzaRifornimenti(STATE.rifornimenti);

// I km percorsi si ricavano SEMPRE da Km Fine − Km Inizio: la colonna "Km" del foglio
// può restare vecchia se qualcuno corregge a mano solo inizio o fine.
function normalizzaPrenotazioni(lista) {
    return lista.map(p => {
        const kmInizio = parseInt(p.kmInizio) || 0;
        const kmFine = parseInt(p.kmFine) || 0;
        const km = (kmInizio > 0 && kmFine >= kmInizio) ? kmFine - kmInizio : 0;
        return { ...p, kmInizio, kmFine, km };
    });
}

STATE.prenotazioni = normalizzaPrenotazioni(STATE.prenotazioni);

function saveData() {
    localStorage.setItem('prenotazioni', JSON.stringify(STATE.prenotazioni));
    localStorage.setItem('rifornimenti', JSON.stringify(STATE.rifornimenti));
    renderAll();
}

// --- CUSTOM MODALS LOGIC ---
function showCustomModal({ title = 'Avviso', message = '', type = 'alert', defaultValue = '', inputType = 'text' }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('custom-modal-title');
        const messageEl = document.getElementById('custom-modal-message');
        const inputGroup = document.getElementById('custom-modal-input-group');
        const inputEl = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const confirmBtn = document.getElementById('custom-modal-confirm');

        titleEl.textContent = title;
        messageEl.textContent = message;

        // Reset state
        inputGroup.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        inputEl.value = '';

        if (type === 'prompt') {
            inputEl.type = inputType === 'decimal' ? 'number' : inputType;
            if (inputType === 'number') {
                inputEl.setAttribute('inputmode', 'numeric');
                inputEl.setAttribute('pattern', '[0-9]*');
                inputEl.removeAttribute('step');
            } else if (inputType === 'decimal') {
                inputEl.setAttribute('inputmode', 'decimal');
                inputEl.removeAttribute('pattern');
                inputEl.setAttribute('step', 'any');
            } else {
                inputEl.removeAttribute('inputmode');
                inputEl.removeAttribute('pattern');
                inputEl.removeAttribute('step');
            }
            
            inputGroup.classList.remove('hidden');
            inputEl.value = defaultValue;
            cancelBtn.classList.remove('hidden');
        } else if (type === 'confirm') {
            cancelBtn.classList.remove('hidden');
        }

        overlay.classList.remove('hidden');
        
        if (type === 'prompt') {
            // setTimeout needed to ensure modal is visible before focusing
            setTimeout(() => inputEl.focus(), 100);
        }

        const cleanup = () => {
            overlay.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            cleanup();
            if (type === 'prompt') resolve(inputEl.value);
            else resolve(true);
        };

        const onCancel = () => {
            cleanup();
            if (type === 'prompt') resolve(null);
            else resolve(false);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

window.CustomAlert = (message, title = 'Avviso') => showCustomModal({ title, message, type: 'alert' });
window.CustomConfirm = (message, title = 'Conferma') => showCustomModal({ title, message, type: 'confirm' });
window.CustomPrompt = (message, defaultValue = '', title = 'Inserisci dato', inputType = 'text') => showCustomModal({ title, message, type: 'prompt', defaultValue, inputType });


// Tabs
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
    const kmInizio = parseInt(document.getElementById('prenotazione-km-inizio').value) || 0;
    const kmFine = parseInt(document.getElementById('prenotazione-km-fine').value) || 0;
    const km = (kmFine >= kmInizio && kmInizio > 0) ? kmFine - kmInizio : 0;
    const motivo = document.getElementById('prenotazione-motivo').value;
    
    // Controlli di validità su Data e Ora
    const startDateTime = new Date(`${dataInizio}T${oraInizio}`);
    const endDateTime = new Date(`${dataFine}T${oraFine}`);

    if (endDateTime <= startDateTime) {
        await window.CustomAlert("La data e l'ora di fine devono essere successive a quelle di inizio. Non puoi prenotare nel passato!", "Errore Data");
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
        return;
    }

    const minInizio = parseInt(oraInizio.split(':')[1]);
    const minFine = parseInt(oraFine.split(':')[1]);

    if (minInizio % 5 !== 0 || minFine % 5 !== 0) {
        await window.CustomAlert("I minuti dell'orario devono essere multipli di 5 (es. 00, 05, 10, 15...). Usa i controlli del menu a tendina.", "Errore Orario");
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
        return;
    }

    if (!(await confermaSovrapposizione(kmInizio, kmFine))) {
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
        kmInizio,
        kmFine,
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
                await window.CustomAlert("Prenotazione salvata e sincronizzata sul calendario!", "Successo");
            } else {
                await window.CustomAlert("Errore remoto: " + result.message, "Errore di Sincronizzazione");
            }
        } else {
            await window.CustomAlert("Prenotazione salvata localmente! (Ricordati di inserire l'URL di Apps Script)", "Salvata");
        }
    } catch (err) {
        console.error(err);
        await window.CustomAlert("Errore di rete. Prenotazione salvata solo localmente.", "Attenzione");
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

async function cancellaPrenotazione(id) {
    const p = STATE.prenotazioni.find(x => x.id === id);
    if(p) {
        const confermato = await window.CustomConfirm("Sei sicuro di voler cancellare la prenotazione? Questa azione modificherà anche il calendario.", "Cancella Prenotazione");
        if (!confermato) {
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
    
    const autonomia = parseInt(document.getElementById('rifornimento-autonomia').value) || 0;

    const litri = parseFloat((importo / costoL).toFixed(2));
    const timestamp = new Date().toLocaleString();

    const obj = { id: Date.now(), utente, data, importo, costoL, litri, autonomia, timestamp };
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
        await window.CustomAlert("Rifornimento inserito con successo!", "Successo");
    } catch(err) {
        console.error(err);
        await window.CustomAlert("Rifornimento salvato localmente (errore di rete).", "Attenzione");
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

window.cancellaPrenotazione = cancellaPrenotazione;

window.modificaPrenotazione = async function(id) {
    const p = STATE.prenotazioni.find(x => x.id === id);
    if(!p) return;
    const newInizio = await window.CustomPrompt("Inserisci il Conteggio Iniziale (km):", p.kmInizio || "", "Modifica Km Iniziali", "number", true);
    if (newInizio === null) return;
    const newFine = await window.CustomPrompt("Inserisci il Conteggio Finale (km):", p.kmFine || "", "Modifica Km Finali", "number", true);
    if (newFine === null) return;

    if (!(await confermaSovrapposizione(parseInt(newInizio) || 0, parseInt(newFine) || 0, p.id))) return;

    p.kmInizio = parseInt(newInizio) || 0;
    p.kmFine = parseInt(newFine) || 0;
    p.km = (p.kmFine >= p.kmInizio && p.kmFine > 0) ? p.kmFine - p.kmInizio : 0;
    
    saveData();
    await window.CustomAlert("Modifica avvenuta con successo!", "Completato");
    
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'update', id: id, kmInizio: p.kmInizio, kmFine: p.kmFine, km: p.km })
            });
        } catch(e) {
            console.error("Errore aggiornamento:", e);
        }
    }
};

window.modificaRifornimento = async function(id) {
    const r = STATE.rifornimenti.find(x => x.id === id);
    if(!r) return;
    const newImporto = await window.CustomPrompt("Inserisci il nuovo Importo (€):", r.importo, "Modifica Importo", "decimal");
    if (newImporto === null) return;
    const newCosto = await window.CustomPrompt("Inserisci il nuovo Costo al Litro (€/L):", r.costoL, "Modifica Costo", "decimal");
    if (newCosto === null) return;
    
    r.importo = parseFloat(newImporto.replace(',','.')) || r.importo;
    r.costoL = parseFloat(newCosto.replace(',','.')) || r.costoL;
    r.litri = parseFloat((r.importo / r.costoL).toFixed(2));
    
    saveData();
    await window.CustomAlert("Modifica avvenuta con successo!", "Completato");
    
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'update_rifornimento', id: id, importo: r.importo, costoL: r.costoL, litri: r.litri })
            });
        } catch(e) {
            console.error("Errore aggiornamento:", e);
        }
    }
};

window.switchDash = function(type) {
    document.getElementById('btn-dash-singolo').classList.remove('active');
    document.getElementById('btn-dash-collettivo').classList.remove('active');
    document.getElementById(`btn-dash-${type}`).classList.add('active');
    
    document.getElementById('dash-singolo').style.display = 'none';
    document.getElementById('dash-collettivo').style.display = 'none';
    document.getElementById(`dash-${type}`).style.display = 'block';
};

// --- Preferenze del Registro (ricordate su questo telefono) ---
const REGISTRO_PREFS = (() => {
    const def = { ordina: 'viaggio', soloMancanti: false, mostraAnnullate: false };
    try { return { ...def, ...JSON.parse(localStorage.getItem('registroPrefs') || '{}') }; } catch (e) { return def; }
})();
function salvaPrefsRegistro() {
    try { localStorage.setItem('registroPrefs', JSON.stringify(REGISTRO_PREFS)); } catch (e) { /* ignora */ }
}

// Istante di inizio/fine di un viaggio (per ordinare e per capire se è già avvenuto)
function inizioViaggio(p) {
    const t = new Date(`${p.dataInizio || p.data}T${p.inizio || '00:00'}`).getTime();
    return isNaN(t) ? 0 : t;
}
function fineViaggio(p) {
    const t = new Date(`${p.dataFine || p.dataInizio || p.data}T${p.fine || '23:59'}`).getTime();
    return isNaN(t) ? 0 : t;
}
function kmMancanti(p) {
    return p.status === 'attiva' && (!p.kmInizio || !p.kmFine);
}

// Render UI
function renderRegistro() {
    const list = document.getElementById('lista-registro');
    list.innerHTML = '';

    const filterSelect = document.getElementById('filtro-utente-registro');
    const selectedUser = filterSelect ? filterSelect.value : 'Tutti';

    let filtered = [...STATE.prenotazioni];
    if (selectedUser && selectedUser !== 'Tutti') {
        filtered = filtered.filter(p => p.utente === selectedUser);
    }

    const numAnnullate = filtered.filter(p => p.status === 'cancellata').length;
    if (!REGISTRO_PREFS.mostraAnnullate) {
        filtered = filtered.filter(p => p.status !== 'cancellata');
    }

    if (REGISTRO_PREFS.soloMancanti) {
        filtered = filtered.filter(kmMancanti);
    }

    // Aggiorna lo stato visivo dei controlli
    document.querySelectorAll('.seg-btn[data-ordina]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ordina === REGISTRO_PREFS.ordina)));
    const chipMancanti = document.getElementById('chip-mancanti');
    if (chipMancanti) chipMancanti.setAttribute('aria-pressed', String(REGISTRO_PREFS.soloMancanti));
    const chipAnnullate = document.getElementById('chip-annullate');
    if (chipAnnullate) {
        chipAnnullate.setAttribute('aria-pressed', String(REGISTRO_PREFS.mostraAnnullate));
        chipAnnullate.textContent = `Annullate (${numAnnullate})`;
    }
    const conteggio = document.getElementById('registro-conteggio');
    if (conteggio) conteggio.textContent = `${filtered.length} ${filtered.length === 1 ? 'viaggio' : 'viaggi'}`;

    const ora = Date.now();
    const sorted = REGISTRO_PREFS.ordina === 'viaggio'
        ? filtered.sort((a, b) => inizioViaggio(b) - inizioViaggio(a) || b.id - a.id)
        : filtered.sort((a, b) => b.id - a.id);

    if (!sorted.length) {
        list.innerHTML = '<li class="registro-vuoto">Nessun viaggio da mostrare con questi filtri.</li>';
    }

    sorted.forEach(p => {
        const li = document.createElement('li');
        li.className = 'list-item';
        
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        
        let contentHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; min-width: 0;">
                    <span style="font-weight: 700; color: #fff; font-size: 1.1rem;">${p.utente}</span>
                    <span style="background: #f59e0b; color: #ffffff; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem; white-space: nowrap;">${p.km} Km</span>
                    ${p.status === 'attiva' && inizioViaggio(p) > ora ? '<span class="badge-futuro">In programma</span>' : ''}
                </div>`;
                
        if(p.status === 'attiva') {
            contentHTML += `
                <div style="display: flex; align-items: center; flex-shrink: 0;">
                    <button title="Modifica" style="background:none; border:none; font-size:1.2rem; cursor:pointer; margin-right:0.5rem; padding:0;" onclick="window.modificaPrenotazione(${p.id})">✏️</button>
                    <button class="delete-btn" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="window.cancellaPrenotazione(${p.id})">Annulla</button>
                </div>`;
        }
        
        contentHTML += `</div>`;
        contentHTML += `<div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem;">`;
            
        if (p.motivo) {
            contentHTML += `<div style="color: #cbd5e1; font-weight: 500; font-size: 0.95rem; display: flex; align-items: flex-start; gap: 0.4rem;">
                <span>🎯</span> <span>${p.motivo}</span>
            </div>`;
        }
        
        contentHTML += `
            <div style="color: #cbd5e1; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>🟢</span> <span>Inizio: ${p.dataInizio || p.data || ''} alle ${p.inizio}</span>
            </div>
            <div style="color: #cbd5e1; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>🔴</span> <span>Fine: ${p.dataFine || p.data || ''} alle ${p.fine}</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>🚗</span> <span>Km: <strong style="color: #cbd5e1;">${p.kmInizio || 0}</strong> ➔ <strong style="color: #cbd5e1;">${p.kmFine || 0}</strong></span>
            </div>
        </div>`;

        if(p.status === 'cancellata') {
            contentHTML += `<div style="color:var(--danger); font-size: 0.8rem; margin-top: 0.25rem;">❌ Cancellata il ${p.deletedAt} da ${p.deletedBy}</div>`;
        } else {
            contentHTML += `<div style="color: #ffffff; font-weight: 500; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">Inserita il ${p.timestamp}</div>`;
        }
        
        li.innerHTML = contentHTML;
        
        list.appendChild(li);
    });
}

// --- CALCOLI CARBURANTE E CHILOMETRI ---
const CAPACITA_SERBATOIO_L = 37;      // Fiat Panda 2012
const CONSUMO_DEFAULT_L100 = 5.8;     // usato solo se i dati non bastano per calcolare quello reale
// L'autonomia del cruscotto è prudente: per ogni litro aggiunto mostra circa l'80% dei km reali
// (calibrato sulle foto: 272 km il 01/11 a 103.903 → 524 km il 06/11 a 104.000 dopo 25 L).
const FATTORE_PRUDENZA_AUTONOMIA = 0.8;

// Letture reali del cruscotto per "agganciare" la stima del serbatoio.
// Formato: { data: 'YYYY-MM-DD', ora: 'HH:MM', km: <contachilometri>, autonomia: <km "Auton." sul cruscotto> }
const CALIBRAZIONI_SERBATOIO = [
    { data: '2026-11-06', ora: '18:35', km: 104018, autonomia: 566 }, // foto cruscotto del 06/11
    { data: '2026-11-08', ora: '15:17', km: 104172, autonomia: 429 }, // foto cruscotto del 08/11
    { data: '2026-11-08', ora: '19:11', km: 104229, autonomia: 384 }  // foto cruscotto del 08/11 (la più recente)
];

function prenotazioniValide(prenotazioni) {
    return prenotazioni.filter(p => p.status === 'attiva');
}

// Unisce i tratti [kmInizio, kmFine] dei viaggi: così i km sovrapposti vengono contati una sola volta.
function analizzaChilometri(prenotazioni) {
    const tratti = prenotazioniValide(prenotazioni)
        .filter(p => p.kmInizio > 0 && p.kmFine > p.kmInizio)
        .sort((a, b) => a.kmInizio - b.kmInizio || a.kmFine - b.kmFine);

    let minKm = Infinity, maxKm = 0;
    prenotazioniValide(prenotazioni).forEach(p => {
        [p.kmInizio, p.kmFine].forEach(k => {
            if (k > 0) { minKm = Math.min(minKm, k); maxKm = Math.max(maxKm, k); }
        });
    });
    if (minKm === Infinity) minKm = 0;

    let coperti = 0, fineCorrente = -Infinity, inizioCorrente = 0, owner = null;
    const sovrapposizioni = [];
    tratti.forEach(t => {
        if (t.kmInizio < fineCorrente) {
            sovrapposizioni.push({ a: owner, b: t, km: Math.min(t.kmFine, fineCorrente) - t.kmInizio });
            if (t.kmFine > fineCorrente) { fineCorrente = t.kmFine; owner = t; }
        } else {
            if (fineCorrente > -Infinity) coperti += fineCorrente - inizioCorrente;
            inizioCorrente = t.kmInizio; fineCorrente = t.kmFine; owner = t;
        }
    });
    if (fineCorrente > -Infinity) coperti += fineCorrente - inizioCorrente;

    const totali = maxKm > minKm ? maxKm - minKm : 0;
    return {
        minKm, maxKm, totali,
        registrati: coperti,
        fantasma: Math.max(0, totali - coperti),
        sovrapposizioni,
        kmDoppi: sovrapposizioni.reduce((s, x) => s + x.km, 0)
    };
}

// Letture del contachilometri nel tempo (inizio e fine di ogni viaggio).
// Il contachilometri può solo crescere: se un viaggio ha date o km incoerenti con gli altri
// (es. data sbagliata), le sue letture vengono scartate tenendo la sequenza crescente più lunga.
function analizzaLetture(prenotazioni) {
    const punti = [];
    prenotazioniValide(prenotazioni).forEach(p => {
        const dI = p.dataInizio || p.data, dF = p.dataFine || p.data;
        if (p.kmInizio > 0 && dI) punti.push({ t: new Date(`${dI}T${p.inizio || '12:00'}`).getTime(), km: p.kmInizio, p });
        if (p.kmFine > 0 && dF) punti.push({ t: new Date(`${dF}T${p.fine || '12:00'}`).getTime(), km: p.kmFine, p });
    });
    const ordinati = punti.filter(x => !isNaN(x.t)).sort((a, b) => a.t - b.t || a.km - b.km);

    // Sequenza non decrescente più lunga (O(n²), i viaggi sono poche centinaia)
    const n = ordinati.length, len = new Array(n).fill(1), prev = new Array(n).fill(-1);
    let best = -1;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            if (ordinati[j].km <= ordinati[i].km && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
        }
        if (best < 0 || len[i] >= len[best]) best = i;
    }
    const tenuti = new Set();
    for (let i = best; i >= 0; i = prev[i]) tenuti.add(i);

    const letture = ordinati.filter((_, i) => tenuti.has(i)).map(x => ({ t: x.t, km: x.km }));
    const incoerenti = [...new Set(ordinati.filter((_, i) => !tenuti.has(i)).map(x => x.p))];
    return { letture, incoerenti };
}

function lettureContachilometri(prenotazioni) {
    return analizzaLetture(prenotazioni).letture;
}

// Stima i km segnati dal contachilometri in un certo istante (interpolazione tra due letture).
function kmAllaData(punti, t) {
    if (!punti.length) return 0;
    if (t <= punti[0].t) return punti[0].km;
    const last = punti[punti.length - 1];
    if (t >= last.t) return last.km;
    for (let i = 1; i < punti.length; i++) {
        if (t <= punti[i].t) {
            const a = punti[i - 1], b = punti[i];
            return b.t === a.t ? b.km : a.km + (b.km - a.km) * (t - a.t) / (b.t - a.t);
        }
    }
    return last.km;
}

function istanteRifornimento(r) {
    return new Date(`${toLocalYMD(r.data)}T12:00`).getTime();
}

// Consumo reale: litri versati tra il primo e l'ultimo rifornimento / km percorsi nello stesso periodo.
// L'ultimo rifornimento è escluso perché quella benzina è ancora (in buona parte) nel serbatoio.
function calcolaConsumo(prenotazioni, rifornimenti) {
    const punti = lettureContachilometri(prenotazioni);
    const rif = rifornimenti.filter(r => r.litri > 0 && r.data).sort((a, b) => istanteRifornimento(a) - istanteRifornimento(b));
    const fallback = { l100: CONSUMO_DEFAULT_L100, kmPerL: 100 / CONSUMO_DEFAULT_L100, reale: false };
    if (rif.length < 3 || punti.length < 2) return fallback;

    const tUltimo = istanteRifornimento(rif[rif.length - 1]);
    const litri = rif.filter(r => istanteRifornimento(r) < tUltimo).reduce((s, r) => s + r.litri, 0);
    const km = kmAllaData(punti, tUltimo) - kmAllaData(punti, istanteRifornimento(rif[0]));
    if (km < 1000 || litri <= 0) return fallback;

    const l100 = litri / km * 100;
    if (l100 < 3.5 || l100 > 9) return fallback; // valore non plausibile: dati sporchi
    return { l100, kmPerL: km / litri, reale: true, km, litri };
}

// Stima dell'autonomia residua, a partire dall'ultima lettura reale del cruscotto ("Auton." in km):
//   autonomia = lettura − km percorsi da allora + litri riforniti dopo la lettura × km/l reali
// Le letture arrivano da CALIBRAZIONI_SERBATOIO o dal campo facoltativo del modulo Rifornimento.
function stimaAutonomia(prenotazioni, rifornimenti, consumo) {
    const punti = lettureContachilometri(prenotazioni);
    if (!punti.length) return null;

    const letture = [
        ...CALIBRAZIONI_SERBATOIO.map(c => ({
            t: new Date(`${c.data}T${c.ora || '12:00'}`).getTime(), km: c.km, autonomia: c.autonomia, rif: null
        })),
        ...rifornimenti.filter(r => r.autonomia > 0 && r.data).map(r => ({
            t: istanteRifornimento(r), km: kmAllaData(punti, istanteRifornimento(r)), autonomia: r.autonomia, rif: r
        }))
    ].filter(l => l.km > 0 && l.autonomia > 0 && !isNaN(l.t));
    if (!letture.length) return null;

    const base = letture.sort((a, b) => a.t - b.t || a.km - b.km)[letture.length - 1];
    const ultimaLettura = punti[punti.length - 1];
    const kmAttuali = Math.max(ultimaLettura.km, base.km);
    // Quando è stato inserito l'ultimo valore del contachilometri (viaggio o lettura del cruscotto)
    const tContachilometri = Math.min(Date.now(),
        base.km >= ultimaLettura.km ? Math.max(base.t, ultimaLettura.t) : ultimaLettura.t);
    const kmDaAllora = kmAttuali - base.km;
    const rifDopo = rifornimenti.filter(r => r !== base.rif && r.litri > 0 && r.data && istanteRifornimento(r) > base.t);
    const litriDopo = rifDopo.reduce((s, r) => s + r.litri, 0);

    const massima = CAPACITA_SERBATOIO_L * consumo.kmPerL;
    const autonomiaKm = Math.min(massima, Math.max(0, base.autonomia - kmDaAllora + litriDopo * consumo.kmPerL * FATTORE_PRUDENZA_AUTONOMIA));
    return {
        autonomiaKm,
        litri: autonomiaKm / consumo.kmPerL,
        percentuale: autonomiaKm / massima * 100,
        base, kmAttuali, kmDaAllora, litriDopo, tContachilometri,
        giorniDaContachilometri: Math.floor((Date.now() - tContachilometri) / 86400000),
        giorniDaLettura: Math.floor((Date.now() - base.t) / 86400000)
    };
}

function renderIndicatoreBenzina(consumo) {
    const box = document.getElementById('fuel-indicator');
    if (!box) return;
    const s = stimaAutonomia(STATE.prenotazioni, STATE.rifornimenti, consumo);
    box.classList.remove('hidden');

    if (!s) {
        box.dataset.livello = 'medio';
        document.getElementById('fuel-km').textContent = '--';
        document.getElementById('fuel-bar-fill').style.width = '0%';
        document.getElementById('fuel-litri').textContent = '';
        document.getElementById('fuel-note').textContent =
            'Nessuna lettura disponibile: al prossimo rifornimento inserisci l\'autonomia indicata dal cruscotto.';
        return;
    }

    box.dataset.livello = s.autonomiaKm < 100 ? 'basso' : s.autonomiaKm < 250 ? 'medio' : 'alto';
    document.getElementById('fuel-km').textContent = `~${(Math.round(s.autonomiaKm / 10) * 10).toLocaleString('it-IT')} km`;
    document.getElementById('fuel-bar-fill').style.width = `${Math.max(3, s.percentuale).toFixed(0)}%`;
    document.getElementById('fuel-litri').textContent = `≈ ${s.litri.toFixed(0)} L su ${CAPACITA_SERBATOIO_L}`;

    document.getElementById('fuel-note').textContent =
        `Consumo ${consumo.reale ? 'reale' : 'stimato'} ${consumo.l100.toFixed(1).replace('.', ',')} L/100 km`;
}

function renderSovrapposizioni(analisi) {
    const box = document.getElementById('overlap-warning');
    if (!box) return;

    // Viaggi con data incoerente: i loro km sono lontani da quelli segnati dal contachilometri in quel giorno
    const { letture, incoerenti } = analizzaLetture(STATE.prenotazioni);
    const dateSbagliate = incoerenti.filter(p => {
        const t = new Date(`${p.dataInizio || p.data}T${p.inizio || '12:00'}`).getTime();
        return Math.abs(kmAllaData(letture, t) - (p.kmInizio || p.kmFine)) > 300;
    });

    if (!analisi.sovrapposizioni.length && !dateSbagliate.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const fmt = p => `${p.utente} ${(p.dataInizio || p.data || '').split('-').reverse().slice(0, 2).join('/')} (${p.kmInizio}→${p.kmFine})`;
    let html = '';
    if (analisi.sovrapposizioni.length) {
        html += `<strong>⚠️ ${analisi.kmDoppi} km inseriti due volte</strong> in ${analisi.sovrapposizioni.length} viaggi sovrapposti. Correggili dal Registro (✏️):` +
            '<ul>' + analisi.sovrapposizioni.map(s => `<li>${fmt(s.b)} si sovrappone a ${fmt(s.a)}</li>`).join('') + '</ul>';
    }
    if (dateSbagliate.length) {
        html += `<strong style="display:block; margin-top:0.6rem;">📅 Viaggi con data probabilmente sbagliata</strong> (i km non corrispondono al periodo):` +
            '<ul>' + dateSbagliate.map(p => `<li>${fmt(p)}</li>`).join('') + '</ul>';
    }
    box.innerHTML = html;
}

// Controlla se un nuovo tratto di km si sovrappone a viaggi già registrati
function trovaSovrapposti(kmInizio, kmFine, escludiId) {
    if (!(kmInizio > 0 && kmFine > kmInizio)) return [];
    return prenotazioniValide(STATE.prenotazioni).filter(p =>
        p.id !== escludiId && p.kmInizio > 0 && p.kmFine > p.kmInizio &&
        kmInizio < p.kmFine && kmFine > p.kmInizio);
}

async function confermaSovrapposizione(kmInizio, kmFine, escludiId) {
    const sovr = trovaSovrapposti(kmInizio, kmFine, escludiId);
    if (!sovr.length) return true;
    const elenco = sovr.map(p => `• ${p.utente} il ${p.dataInizio || p.data}: ${p.kmInizio} → ${p.kmFine}`).join('\n');
    return window.CustomConfirm(`I km ${kmInizio} → ${kmFine} si sovrappongono a:\n\n${elenco}\n\nControlla il cruscotto. Vuoi salvare comunque?`, 'Km sovrapposti');
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
    
    // Km registrati / fantasma calcolati unendo i tratti: i km sovrapposti contano una volta sola
    const analisiKm = analizzaChilometri(STATE.prenotazioni);
    const consumo = calcolaConsumo(STATE.prenotazioni, STATE.rifornimenti);
    renderIndicatoreBenzina(consumo);
    renderSovrapposizioni(analisiKm);

    const statKmEl = document.getElementById('stat-km');
    if(statKmEl) statKmEl.textContent = analisiKm.registrati.toLocaleString('it-IT');

    const statFuelEl = document.getElementById('stat-fuel');
    if(statFuelEl) statFuelEl.textContent = totalSpese.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    
    const statLitriEl = document.getElementById('stat-litri');
    if(statLitriEl) statLitriEl.textContent = totalLitri.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
    
    // Km Fantasma: km del contachilometri non coperti da nessun viaggio registrato
    const kmFantasma = analisiKm.fantasma;

    const statKmFantasmaEl = document.getElementById('stat-km-fantasma');
    if(statKmFantasmaEl) statKmFantasmaEl.textContent = kmFantasma.toLocaleString('it-IT');
    
    // Odometro Logic: trova minKm (Km In) e maxKm (Km Fin)
    let maxKm = 0;
    let minKm = Infinity;
    let maxKmData = "--/--/----";
    let minKmData = "--/--/----";
    
    STATE.prenotazioni.forEach(p => {
        if (p.status === 'attiva') {
            const currentMax = p.kmFine || p.kmInizio || 0;
            if (currentMax > maxKm) {
                maxKm = currentMax;
                maxKmData = p.dataFine || p.data || p.timestamp || "--/--/----";
            }
            
            const currentMin = p.kmInizio || p.kmFine || 0;
            if (currentMin > 0 && currentMin < minKm) {
                minKm = currentMin;
                minKmData = p.dataInizio || p.data || p.timestamp || "--/--/----";
            }
        }
    });
    
    if (minKm === Infinity) minKm = 0;
    const veriKmTotali = maxKm > minKm ? maxKm - minKm : 0;

    const statKmInEl = document.getElementById('stat-km-in');
    if(statKmInEl) statKmInEl.textContent = minKm.toLocaleString('it-IT');
    const statKmInDataEl = document.getElementById('stat-km-in-data');
    if(statKmInDataEl) statKmInDataEl.textContent = minKmData;
    
    const statKmFinEl = document.getElementById('stat-km-fin');
    if(statKmFinEl) statKmFinEl.textContent = maxKm.toLocaleString('it-IT');
    const statKmFinDataEl = document.getElementById('stat-km-fin-data');
    if(statKmFinDataEl) statKmFinDataEl.textContent = maxKmData;

    const statKmTotaliVeriEl = document.getElementById('stat-km-totali-veri');
    if(statKmTotaliVeriEl) statKmTotaliVeriEl.textContent = veriKmTotali.toLocaleString('it-IT');

    // Percentuali
    const percRegistrati = veriKmTotali > 0 ? ((analisiKm.registrati / veriKmTotali) * 100).toFixed(1) : 0;
    const percFantasma = veriKmTotali > 0 ? ((kmFantasma / veriKmTotali) * 100).toFixed(1) : 0;
    
    const statKmPercEl = document.getElementById('stat-km-perc');
    if(statKmPercEl) statKmPercEl.textContent = `(${percRegistrati}%)`;
    
    const statKmFantasmaPercEl = document.getElementById('stat-km-fantasma-perc');
    if(statKmFantasmaPercEl) statKmFantasmaPercEl.textContent = `(${percFantasma}%)`;


    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.font.family = 'Outfit';

    if(charts.km) charts.km.destroy();
    charts.km = new Chart(document.getElementById('chart-km'), {
        type: 'bar',
        data: { labels: utenti, datasets: [{ label: 'Km Registrati', data: dataKm, backgroundColor: '#3b82f6' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Km Registrati' } } }
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
    // Consumo reale calcolato dai rifornimenti e dal contachilometri (fallback 5.8 L/100km)
    const consumoMedioKm_L = consumo.kmPerL;
    
    // Calcoliamo il costo medio della benzina al litro inserita fino ad oggi
    let costoMedioLitro = 1.8; // default
    if (totalLitri > 0) {
        costoMedioLitro = totalSpese / totalLitri;
    }
    const costoMedioKm = costoMedioLitro / consumoMedioKm_L; // Costo per singolo chilometro (es. ~0.104 €/km)
    
    // Calcoliamo il bilancio per ogni utente
    const dataBilancioKm = [];
    const tableBody = document.getElementById('table-body-utenti');
    
    // Resettiamo le righe
    if (tableBody) tableBody.innerHTML = '';

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
        
        let colorClass = '';
        let sign = '';
        if (bilancioEuro > 0.01) {
            colorClass = 'text-green';
            sign = '+';
        } else if (bilancioEuro < -0.01) {
            colorClass = 'text-red';
        }
        
        // Popoliamo la tabella in verticale
        if (tableBody) {
            tableBody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="font-weight: 700; color: #fff;">${u}</td>
                    <td>${kmGuidati}</td>
                    <td>${euroVersati.toFixed(2)} €</td>
                    <td class="${colorClass}" style="font-weight: 700;">${sign}${bilancioEuro.toFixed(2)} €</td>
                </tr>
            `;
        }
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
                    text: `Bilancio Carburante (Consumo ${consumo.reale ? 'reale' : 'stimato'}: ${consumo.l100.toFixed(1)} L/100Km)`,
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
        data: { labels: labelsColl, datasets: [{ label: 'Km Registrati', data: dataCollKm, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Andamento Km Registrati' } } }
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

function renderRegistroRifornimenti() {
    const list = document.getElementById('lista-rifornimenti');
    if (!list) return;
    list.innerHTML = '';
    
    const filterSelect = document.getElementById('filtro-utente-rifornimenti');
    const selectedUser = filterSelect ? filterSelect.value : 'Tutti';
    
    let filtered = [...STATE.rifornimenti];
    if (selectedUser && selectedUser !== 'Tutti') {
        filtered = filtered.filter(r => r.utente === selectedUser);
    }
    
    const sorted = filtered.sort((a,b) => b.id - a.id);
    sorted.forEach(r => {
        const li = document.createElement('li');
        li.className = 'list-item';
        
        li.style.flexDirection = 'column';
        li.style.alignItems = 'stretch';
        
        let dataFornita = r.data || '';
        if (dataFornita.includes('T')) {
            dataFornita = dataFornita.split('T')[0];
        }

        let contentHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 700; color: #fff; font-size: 1.1rem;">${r.utente}</span>
                    <span style="background: #10b981; color: #ffffff; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">${r.importo} €</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <button title="Modifica" style="background:none; border:none; font-size:1.2rem; cursor:pointer; margin-right:0.5rem; padding:0;" onclick="window.modificaRifornimento(${r.id})">✏️</button>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div style="color: #cbd5e1; font-weight: 500; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>⛽</span> <span>${r.litri} L a ${r.costoL} €/L</span>
                </div>
                <div style="color: #94a3b8; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>📅</span> <span>Data: ${dataFornita}</span>
                </div>
            </div>
            
            <div style="color: #ffffff; font-weight: 500; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                Inserita il ${r.timestamp}
            </div>
        `;
        
        li.innerHTML = contentHTML;
        list.appendChild(li);
    });
}

function renderAll() {
    renderRegistro();
    renderRegistroRifornimenti();
    renderDashboard();
}

// Init
const initFiltri = () => {
    const utentiList = ['Mamma', 'Papà', 'Mary', 'Gio', 'Betty'];
    
    const filtroReg = document.getElementById('filtro-utente-registro');
    if (filtroReg) {
        filtroReg.innerHTML = '<option value="Tutti">Tutti</option>';
        utentiList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            opt.textContent = u;
            filtroReg.appendChild(opt);
        });
        filtroReg.addEventListener('change', renderRegistro);
    }
    
    document.querySelectorAll('.seg-btn[data-ordina]').forEach(btn => {
        btn.addEventListener('click', () => {
            REGISTRO_PREFS.ordina = btn.dataset.ordina;
            salvaPrefsRegistro();
            renderRegistro();
        });
    });

    const chipMancanti = document.getElementById('chip-mancanti');
    if (chipMancanti) {
        chipMancanti.addEventListener('click', () => {
            REGISTRO_PREFS.soloMancanti = !REGISTRO_PREFS.soloMancanti;
            salvaPrefsRegistro();
            renderRegistro();
        });
    }

    const chipAnnullate = document.getElementById('chip-annullate');
    if (chipAnnullate) {
        chipAnnullate.addEventListener('click', () => {
            REGISTRO_PREFS.mostraAnnullate = !REGISTRO_PREFS.mostraAnnullate;
            salvaPrefsRegistro();
            renderRegistro();
        });
    }
    
    const filtroRif = document.getElementById('filtro-utente-rifornimenti');
    if (filtroRif) {
        filtroRif.innerHTML = '<option value="Tutti">Tutti</option>';
        utentiList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            opt.textContent = u;
            filtroRif.appendChild(opt);
        });
        filtroRif.addEventListener('change', renderRegistroRifornimenti);
    }
};
initFiltri();

renderAll();

async function syncWithCloud() {
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "INSERISCI_QUI_IL_TUO_URL_DELLA_WEB_APP") {
        try {
            // Eseguiamo una GET all'URL dello script per ottenere tutti i dati aggiornati
            const response = await fetch(APPS_SCRIPT_URL);
            const data = await response.json();
            
            // Sovrascriviamo lo stato locale con quello che arriva da Google Sheets (la fonte della verità)
            if (data.prenotazioni) {
                STATE.prenotazioni = normalizzaPrenotazioni(data.prenotazioni);
            }
            if (data.rifornimenti) {
                STATE.rifornimenti = normalizzaRifornimenti(data.rifornimenti);
            }
            
            // Salviamo e aggiorniamo l'interfaccia
            saveData();
            console.log("Sincronizzazione completata: dati aggiornati dal Cloud.");
        } catch(e) {
            console.error("Impossibile sincronizzare dal Cloud. Vengono usati i dati locali.", e);
        } finally {
            document.getElementById('loading-overlay').classList.add('hidden');
        }
    } else {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
}

// Avviamo la sincronizzazione in background all'apertura dell'app
syncWithCloud().then(() => {
    // Promemoria km mancanti: solo viaggi GIÀ CONCLUSI negli ultimi 7 giorni (massimo 7, i più recenti).
    // I viaggi futuri non hanno ancora km; quelli più vecchi restano nel Registro (filtro "Senza Km").
    const ora = Date.now();
    const SETTE_GIORNI = 7 * 24 * 60 * 60 * 1000;
    const MAX_PROMEMORIA = 7;

    const conclusiSenzaKm = STATE.prenotazioni
        .filter(p => kmMancanti(p) && fineViaggio(p) <= ora)
        .sort((a, b) => fineViaggio(b) - fineViaggio(a));
    const recenti = conclusiSenzaKm.filter(p => ora - fineViaggio(p) <= SETTE_GIORNI).slice(0, MAX_PROMEMORIA);
    const altri = conclusiSenzaKm.length - recenti.length;

    if (recenti.length > 0) {
        const giorno = p => (p.dataInizio || p.data || '').split('-').reverse().slice(0, 2).join('/');
        const dettagli = recenti.map(p => `• ${giorno(p)} ${p.utente}: "${(p.motivo || 'Senza motivo').trim()}"`).join('\n');
        const coda = altri > 0 ? `\n\n(+${altri} più vecchi: li trovi nel Registro con il filtro "Senza Km")` : '';

        setTimeout(() => {
            window.CustomAlert(`Mancano i km di inizio o fine per questi viaggi degli ultimi 7 giorni:\n\n${dettagli}${coda}`, "Promemoria Km Mancanti");
        }, 500);
    }
});

// --- FIX PER ORA INIZIO/FINE (Arrotondamento a 5 minuti) ---
// I browser su Android ignorano spesso l'attributo step="300".
// Questo script forza l'orario al multiplo di 5 più vicino appena l'utente lo inserisce.
function arrotondaA5Minuti(inputElement) {
    if (!inputElement.value) return;
    let [hours, minutes] = inputElement.value.split(':');
    if (!minutes) return;
    
    minutes = Math.round(parseInt(minutes) / 5) * 5;
    if (minutes === 60) {
        minutes = 0;
        hours = String(parseInt(hours) + 1).padStart(2, '0');
        if (hours === '24') hours = '00';
    }
    inputElement.value = `${hours}:${String(minutes).padStart(2, '0')}`;
}

const inputInizio = document.getElementById('prenotazione-inizio');
const inputFine = document.getElementById('prenotazione-fine');
if (inputInizio) inputInizio.addEventListener('change', function() { arrotondaA5Minuti(this); });
if (inputFine) inputFine.addEventListener('change', function() { arrotondaA5Minuti(this); });

// --- EXPORT CSV LOGIC ---
const btnExportCsv = document.getElementById('btn-export-csv');
if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
        let csvContent = "";
        
        // Prenotazioni
        csvContent += "--- PRENOTAZIONI ---\n";
        csvContent += "ID,Utente,Motivo,Data Inizio,Ora Inizio,Data Fine,Ora Fine,Km Inizio,Km Fine,Km Percorsi,Status\n";
        STATE.prenotazioni.forEach(p => {
            let row = [p.id, p.utente, `"${p.motivo || ''}"`, p.dataInizio||p.data||'', p.inizio||'', p.dataFine||p.data||'', p.fine||'', p.kmInizio||0, p.kmFine||0, p.km||0, p.status||''].join(",");
            csvContent += row + "\n";
        });

        // Rifornimenti
        csvContent += "\n--- RIFORNIMENTI ---\n";
        csvContent += "ID,Utente,Data,Importo,Costo al Litro,Litri\n";
        STATE.rifornimenti.forEach(r => {
            let row = [r.id, r.utente, r.data||'', r.importo||0, r.costoL||0, r.litri||0].join(",");
            csvContent += row + "\n";
        });

        // Generiamo il nome del file con data e ora correnti
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const filename = `BroDrive_Export_${yyyy}-${mm}-${dd}_${hh}-${min}.csv`;

        // Aggiungiamo il BOM per garantire la corretta lettura in Excel
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
}


// --- PULSANTE AUTO: km iniziali = km finali del viaggio precedente ---
// Il viaggio "precedente" è quello che inizia subito prima, in ordine di data e ora,
// rispetto al viaggio che si sta inserendo (non il km più alto del registro).
function trovaViaggioPrecedente(istante) {
    return prenotazioniValide(STATE.prenotazioni)
        .filter(p => inizioViaggio(p) > 0 && inizioViaggio(p) < istante)
        .sort((a, b) => inizioViaggio(b) - inizioViaggio(a))[0] || null;
}

function istanteNuovoViaggio() {
    const data = document.getElementById('prenotazione-data-inizio').value;
    const ora = document.getElementById('prenotazione-inizio').value || '00:00';
    if (!data) return Date.now();
    const t = new Date(`${data}T${ora}`).getTime();
    return isNaN(t) ? Date.now() : t;
}

const btnAutoKm = document.getElementById('btn-auto-km-inizio');
const inputKmInizio = document.getElementById('prenotazione-km-inizio');
const fonteAutoKm = document.getElementById('auto-km-fonte');

function impostaFonteAuto(testo, tipo) {
    if (!fonteAutoKm) return;
    fonteAutoKm.textContent = testo || '';
    fonteAutoKm.dataset.tipo = tipo || '';
}

if (btnAutoKm && inputKmInizio) {
    btnAutoKm.addEventListener('click', () => {
        if (btnAutoKm.classList.contains('active')) {
            btnAutoKm.classList.remove('active');
            inputKmInizio.value = '';
            impostaFonteAuto('');
            return;
        }

        const prec = trovaViaggioPrecedente(istanteNuovoViaggio());
        if (!prec) {
            window.CustomAlert("Non c'è nessun viaggio precedente a questa data: leggi i km dal cruscotto.", 'AUTO');
            return;
        }
        const quando = `${(prec.dataInizio || prec.data || '').split('-').reverse().slice(0, 2).join('/')}`;
        const motivo = (prec.motivo || '').trim();

        if (!(prec.kmFine > 0)) {
            impostaFonteAuto(`⚠️ ${prec.utente} (${quando}) non ha inserito i km finali: leggili dal cruscotto.`, 'avviso');
            window.CustomAlert(
                `Il viaggio precedente è di ${prec.utente} del ${quando}${motivo ? ` ("${motivo}")` : ''}, ma non ha i km finali.\n\n` +
                'Per non creare errori, AUTO non inserisce nulla: leggi i km dal cruscotto.',
                'Km precedenti mancanti');
            return;
        }

        inputKmInizio.value = prec.kmFine;
        btnAutoKm.classList.add('active');
        impostaFonteAuto(`Da: fine viaggio di ${prec.utente} del ${quando} (${prec.kmFine.toLocaleString('it-IT')} km). Controlla che coincida col cruscotto.`, 'ok');
    });
    
// Se l'utente modifica a mano il valore, spegniamo il bottone
    inputKmInizio.addEventListener('input', () => {
        if (btnAutoKm.classList.contains('active')) {
            btnAutoKm.classList.remove('active');
        }
        impostaFonteAuto('');
    });

    // Dopo l'invio del modulo (reset) togliamo stato e indicazione di AUTO
    document.getElementById('form-prenotazione').addEventListener('reset', () => {
        btnAutoKm.classList.remove('active');
        impostaFonteAuto('');
    });
}
