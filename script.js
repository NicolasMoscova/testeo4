
/* script.js - versión corregida para: 
   - admin (Sergio) no puede reservar ni tener turnos
   - admin puede anular turnos con motivo y enviar notificación al usuario
   - registro requiere Usuario, Contraseña, Teléfono y Mail
   - los turnos se muestran como lista en pantalla (no descarga necesaria)
   - no se usan bases de datos externas; se mantiene el uso de localStorage
*/

/* ---------- Almacenamiento ---------- */
function saveUsuarios(u){ localStorage.setItem('usuarios', JSON.stringify(u)); }
function loadUsuarios(){ return JSON.parse(localStorage.getItem('usuarios')||'[]'); }
function saveTurnos(t){ localStorage.setItem('turnos', JSON.stringify(t)); }
function loadTurnos(){ return JSON.parse(localStorage.getItem('turnos')||'[]'); }
function saveMensajes(m){ localStorage.setItem('mensajes', JSON.stringify(m)); }
function loadMensajes(){ return JSON.parse(localStorage.getItem('mensajes')||'[]'); }

function currentUser(){ return JSON.parse(localStorage.getItem('peluqueria_user')||'null'); }
function setCurrentUser(u){ if(u) localStorage.setItem('peluqueria_user', JSON.stringify(u)); else localStorage.removeItem('peluqueria_user'); }

/* ---------- Utilitarios ---------- */
function ensureAdminExists(){
  try{
    let usuarios = loadUsuarios();
    const exists = usuarios.some(u => (u.usuario==='Sergio' || u.username==='Sergio'));
    if(!exists){
      usuarios.unshift({usuario:'Sergio', clave:'peluqueria', role:'admin'});
      saveUsuarios(usuarios);
      console.log("Admin Sergio agregado a usuarios");
    }
  }catch(e){
    saveUsuarios([{usuario:'Sergio', clave:'peluqueria', role:'admin'}]);
  }
}

async function loadInitialUsers(){
  // Si ya hay usuarios en localStorage, respetarlos
  if(localStorage.getItem('usuarios')) { ensureAdminExists(); return; }
  try{
    const resp = await fetch('./data.json', {cache: "no-store"});
    if(resp.ok){
      const arr = await resp.json();
      saveUsuarios(arr);
      ensureAdminExists();
      return;
    }
  }catch(e){
    // ignore
  }
  ensureAdminExists();
}

/* ---------- Mensajes / Notificaciones ---------- */
function sendMessage(to, message){
  const m = loadMensajes();
  m.push({to, message, date: new Date().toISOString(), read: false});
  saveMensajes(m);
}
function getUserMessages(username){
  return loadMensajes().filter(m => m.to === username);
}
function markMessagesRead(username){
  const list = loadMensajes();
  let changed = false;
  for(const m of list){ if(m.to===username && !m.read){ m.read = true; changed = true; } }
  if(changed) saveMensajes(list);
}

/* ---------- Inicialización DOM ---------- */
document.addEventListener('DOMContentLoaded', async function(){
  await loadInitialUsers();
  ensureAdminExists();
  // Quitar turnos asignados al admin 'Sergio' (si existieran)
  removeAdminTurnos();

  // Handlers: login
  const formLogin = document.getElementById('formLogin');
  if(formLogin){
    formLogin.addEventListener('submit', function(e){
      e.preventDefault();
      const usuario = document.getElementById('usuario').value.trim();
      const clave = document.getElementById('clave').value;
      const usuarios = loadUsuarios();
      const me = usuarios.find(x=> (x.usuario===usuario || x.username===usuario) && (x.clave===clave || x.password===clave));
      if(me){
        const username = me.usuario || me.username;
        const role = me.role || 'user';
        setCurrentUser({username, role});
        window.location.href = 'agenda.html';
      } else {
        alert('Usuario o contraseña incorrectos');
      }
    });
  }

  // Registro
  const formRegister = document.getElementById('formRegister');
  if(formRegister){
    formRegister.addEventListener('submit', function(e){
      e.preventDefault();
      const usuario = document.getElementById('regUsuario').value.trim();
      const clave = document.getElementById('regClave').value;
      const telefono = document.getElementById('regTelefono')?.value.trim();
      const mail = document.getElementById('regMail')?.value.trim();
      if(!usuario || !clave || !telefono || !mail){ alert('Completá Usuario, Contraseña, Teléfono y Mail.'); return; }
      let usuarios = loadUsuarios();
      if(usuarios.find(x=> (x.usuario===usuario || x.username===usuario) )){ alert('El usuario ya existe'); return; }
      const nuevo = {usuario:usuario, clave:clave, telefono:telefono, mail:mail, role:'user'};
      usuarios.push(nuevo);
      saveUsuarios(usuarios);
      alert('Registro OK. Ya podés iniciar sesión.');
      window.location.href = 'login.html';
    });
  }

  // Agenda page setups
  if(window.location.pathname.endsWith('agenda.html') || window.location.pathname.endsWith('/')){
    setupAgendaPage();
  }
});

/* ---------- Funciones de agenda ---------- */
function removeAdminTurnos(){
  const all = loadTurnos();
  const filtered = all.filter(t => (t.username !== 'Sergio' && t.username !== 'sergio'));
  if(filtered.length !== all.length) saveTurnos(filtered);
}

function setupAgendaPage(){
  applyTitles();
  const logoutBtn = document.getElementById('btnLogout');
  if(logoutBtn){
    logoutBtn.addEventListener('click', ()=>{ setCurrentUser(null); window.location.href='index.html'; });
  }

  renderUserTurnos();
  renderAllTurnos();
  renderNotifications();

  // Si el usuario es admin: ocultar formulario de reserva y la sección 'Mis Turnos'
  const userNow = currentUser();
  const reservaForm = document.getElementById('reservaForm');
  const misTurnosEl = document.getElementById('misTurnos');
  const panelAdminEl = document.getElementById('panelAdmin');
  if(userNow && userNow.role === 'admin'){
    if(reservaForm){ reservaForm.style.display = 'none'; /* oculta el form */ }
    if(misTurnosEl){ misTurnosEl.style.display = 'none'; }
    if(panelAdminEl){ panelAdminEl.style.display = 'block'; }
  } else {
    // usuarios normales: asegurarse que el panel admin esté oculto
    if(panelAdminEl) panelAdminEl.style.display = 'none';
  }

  // Reserva: evitar que el admin pueda reservar
  const reservaForm = document.getElementById('reservaForm');
  if(reservaForm){
    reservaForm.addEventListener('submit', function(e){
      e.preventDefault();
      const user = currentUser();
      if(!user){ alert('Tenés que iniciar sesión para reservar.'); return; }
      if(user.role === 'admin'){ alert('Los administradores no pueden reservar turnos.'); return; }
      const fecha = document.getElementById('resFecha').value;
      const hora = document.getElementById('resHora').value;
      const dur = parseInt(document.getElementById('resDur')?.value || '30',10);
      if(!fecha || !hora){ alert('Completá fecha y hora'); return; }
      const reserva = {username: user.username, date: fecha, time: hora, durationMin: dur, id: generateId()};
      if(!canCreateReserva(reserva)) return;
      const t = loadTurnos(); t.push(reserva); saveTurnos(t);
      alert('Turno reservado correctamente.');
      renderUserTurnos();
      renderAllTurnos();
    });
  }

  // Admin control: export y borrar todos
  const btnExport = document.getElementById('btnExport');
  const btnClear = document.getElementById('btnClear');
  if(btnExport){
    btnExport.addEventListener('click', ()=>{
      const a = document.createElement('a');
      a.href = 'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(loadTurnos()));
      a.download = 'turnos.json'; a.click();
    });
  }
  if(btnClear){
    btnClear.addEventListener('click', ()=>{
      if(!confirm('Confirmás borrar todos los turnos?')) return;
      saveTurnos([]);
      renderUserTurnos();
      renderAllTurnos();
    });
  }
}

/* ---------- Renderers ---------- */
function renderUserTurnos(){
  const cont = document.getElementById('misTurnos');
  if(!cont) return;
  const user = currentUser();
  cont.innerHTML = '';
  if(!user){ cont.innerHTML = '<p>Iniciá sesión para ver tus turnos.</p>'; return; }
  const all = loadTurnos();
  const mine = all.filter(t => t.username === user.username);
  if(mine.length===0){ cont.innerHTML = '<p>No tenés turnos reservados.</p>'; return; }
  const ul = document.createElement('ul');
  ul.className = 'list';
  for(const t of mine){
    const li = document.createElement('li');
    li.textContent = `${t.date} ${t.time} (${t.durationMin || 30} min)`;
    ul.appendChild(li);
  }
  cont.appendChild(ul);
}

/* Renderiza todos los turnos en lista; si el usuario es admin agrega botón Anular */
function renderAllTurnos(){
  const cont = document.getElementById('todosTurnos');
  if(!cont) return;
  const user = currentUser();
  const all = loadTurnos();
  cont.innerHTML = '';
  if(all.length===0){ cont.innerHTML = '<li>No hay turnos</li>'; return; }
  const ul = document.createElement('ul');
  ul.className = 'list';
  for(const t of all){
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${t.date} ${t.time} - ${t.username}`;
    li.appendChild(span);
    if(user && user.role==='admin'){
      const btn = document.createElement('button');
      btn.className = 'btn small outline';
      btn.textContent = 'Anular';
      btn.dataset.id = t.id || '';
      btn.addEventListener('click', ()=> adminAnularTurno(t.id || '', t));
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }
  cont.appendChild(ul);
}

/* ---------- Admin: anular turno ---------- */
function adminAnularTurno(id, turno){
  if(!confirm(`Vas a anular el turno de ${turno.username} el ${turno.date} ${turno.time}. Continuar?`)) return;
  const motivo = prompt('Ingresá el motivo de la anulación (se enviará al usuario):','Por favor reprogramar');
  if(motivo===null) return; // cancelado
  // eliminar turno
  const all = loadTurnos();
  const filtered = all.filter(t => (t.id || '') !== (id || '') || t.username === 'Sergio' && false);
  saveTurnos(filtered);
  // enviar notificación
  sendMessage(turno.username, `Su turno del ${turno.date} ${turno.time} fue anulado. Motivo: ${motivo}`);
  alert('Turno anulado y el usuario ha sido notificado.');
  renderAllTurnos();
  renderUserTurnos();
}

/* ---------- Notificaciones ---------- */
function renderNotifications(){
  const cont = document.getElementById('notificaciones');
  if(!cont) return;
  const user = currentUser();
  cont.innerHTML = '';
  if(!user){ cont.innerHTML = '<p>No estás identificado.</p>'; return; }
  const msgs = getUserMessages(user.username);
  if(msgs.length===0){ cont.innerHTML = '<p>No tenés notificaciones.</p>'; return; }
  const ul = document.createElement('ul'); ul.className='list';
  for(const m of msgs){
    const li = document.createElement('li');
    const when = new Date(m.date).toLocaleString();
    li.innerHTML = `<strong>${when}</strong> - ${m.message}` + (m.read ? '' : ' <em>(nuevo)</em>');
    ul.appendChild(li);
  }
  cont.appendChild(ul);
  // marcar como leídas
  markMessagesRead(user.username);
}

/* ---------- Reglas de reserva (ejemplo simple) ---------- */
function canCreateReserva(reserva){
  // evitar duplicados exactos
  const all = loadTurnos();
  if(all.some(t => t.date===reserva.date && t.time===reserva.time)){
    alert('Esa fecha y hora ya están reservadas.');
    return false;
  }
  return true;
}

/* ---------- Helpers ---------- */
function generateId(){
  return 'id_' + Math.random().toString(36).slice(2,10);
}

/* ---------- Titles y UI dinámico ---------- */
function applyTitles(){
  const user = currentUser();
  const titleEl = document.getElementById('main-title');
  if(titleEl){
    if(user) titleEl.textContent = `Agenda — ${user.username}`;
    else titleEl.textContent = 'Agenda Virtual';
  }
  const panelAdmin = document.getElementById('panelAdmin');
  if(panelAdmin){
    if(user && user.role==='admin') panelAdmin.style.display = 'block';
    else panelAdmin.style.display = 'none';
  }
}

/* Fin script.js */
