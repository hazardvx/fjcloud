/* Panel de Proyectos FJcloud — UI. Datos vía ProyectosStore (js/proyectos-store.js).
   Reglas: nada de innerHTML con datos del usuario (textContent/DOM seguro),
   animación solo como feedback (crear/guardar), sin animación en filtros/búsqueda. */
(function () {
  'use strict';

  var Store = window.ProyectosStore;
  if (!Store) return;

  var ESTADOS_LABEL = {
    pendiente: 'Pendiente',
    proceso: 'En proceso',
    revision: 'Revisión',
    entregado: 'Entregado'
  };

  var proyectos = [];
  var filtro = 'todos';
  var busqueda = '';
  var editId = null;
  var nuevoIdAnimado = null;
  var lastFocus = null;
  var toastTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var gate = $('gate'),
      gatePin = $('gate-pin'),
      gateErr = $('gate-err'),
      gateEnter = $('gate-enter'),
      btnLogout = $('btn-logout'),
      btnNuevo = $('btn-nuevo'),
      btnExport = $('btn-export'),
      q = $('q'),
      list = $('list'),
      empty = $('empty'),
      emptyTitle = $('empty-title'),
      emptyText = $('empty-text'),
      modal = $('modal'),
      modalTitle = $('modal-title'),
      modalClose = $('modal-close'),
      form = $('proj-form'),
      btnCancelar = $('btn-cancelar'),
      fCliente = $('f-cliente'),
      fProyecto = $('f-proyecto'),
      fEstado = $('f-estado'),
      fEntrega = $('f-entrega'),
      fProgreso = $('f-progreso'),
      outProgreso = $('out-progreso'),
      fNotas = $('f-notas'),
      fldCliente = $('fld-cliente'),
      fldProyecto = $('fld-proyecto'),
      toast = $('toast');

  /* ---------- sesión (gate) ---------- */
  function sesionOK() {
    try { return sessionStorage.getItem('fjcloud_panel_acceso') === '1'; } catch (e) { return false; }
  }
  function setSesion(v) {
    try {
      if (v) sessionStorage.setItem('fjcloud_panel_acceso', '1');
      else sessionStorage.removeItem('fjcloud_panel_acceso');
    } catch (e) { /* sin storage: se queda cerrado */ }
  }
  function renderGate() {
    var ok = sesionOK();
    gate.hidden = ok;
    if (!ok) {
      gatePin.value = '';
      gatePin.classList.remove('bad');
      gateErr.classList.remove('show');
      window.setTimeout(function () { gatePin.focus(); }, 60);
    }
  }
  function intentarEntrar() {
    if (Store.checkPin(gatePin.value)) {
      setSesion(true);
      renderGate();
      cargar();
    } else {
      gatePin.classList.add('bad');
      gateErr.classList.add('show');
      gatePin.select();
    }
  }
  gateEnter.addEventListener('click', intentarEntrar);
  gatePin.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); intentarEntrar(); }
  });
  gatePin.addEventListener('input', function () {
    gatePin.classList.remove('bad');
    gateErr.classList.remove('show');
  });
  btnLogout.addEventListener('click', function () {
    setSesion(false);
    renderGate();
  });

  /* ---------- datos ---------- */
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function atrasado(p) {
    return !!p.entrega && p.entrega < hoyISO() && p.estado !== 'entregado';
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function visibles() {
    var b = norm(busqueda);
    return proyectos.filter(function (p) {
      if (filtro !== 'todos' && p.estado !== filtro) return false;
      if (b && norm(p.cliente + ' ' + p.proyecto).indexOf(b) < 0) return false;
      return true;
    });
  }

  function render() {
    /* KPIs */
    var proceso = 0, entregados = 0, atrasados = 0;
    proyectos.forEach(function (p) {
      if (p.estado === 'proceso' || p.estado === 'revision') proceso++;
      if (p.estado === 'entregado') entregados++;
      if (atrasado(p)) atrasados++;
    });
    $('kpi-total').textContent = proyectos.length;
    $('kpi-proceso').textContent = proceso;
    $('kpi-entregados').textContent = entregados;
    $('kpi-atrasados').textContent = atrasados;

    /* filas */
    var vis = visibles();
    list.replaceChildren();
    vis.forEach(function (p) {
      list.appendChild(fila(p));
    });

    empty.classList.toggle('show', vis.length === 0);
    if (vis.length === 0) {
      if (proyectos.length === 0) {
        emptyTitle.textContent = 'Aún no hay proyectos';
        emptyText.textContent = 'Crea el primero con el botón “Nuevo proyecto”.';
      } else {
        emptyTitle.textContent = 'Sin resultados';
        emptyText.textContent = 'Ningún proyecto coincide con la búsqueda o el filtro.';
      }
    }
    if (nuevoIdAnimado) nuevoIdAnimado = null;
  }

  function fila(p) {
    var li = document.createElement('li');
    li.className = 'row' + (p.id === nuevoIdAnimado ? ' row--new' : '');
    li.dataset.id = p.id;

    /* nombre */
    var name = document.createElement('div');
    name.className = 'r-name';
    var proj = document.createElement('span');
    proj.className = 'r-proj';
    proj.textContent = p.proyecto;
    var cli = document.createElement('span');
    cli.className = 'r-cli';
    cli.textContent = p.cliente;
    name.appendChild(proj);
    name.appendChild(cli);
    li.appendChild(name);

    /* estado */
    var state = document.createElement('div');
    state.className = 'r-state';
    var pill = document.createElement('span');
    pill.className = 'pill pill-' + p.estado;
    pill.textContent = ESTADOS_LABEL[p.estado];
    state.appendChild(pill);
    li.appendChild(state);

    /* avance */
    var prog = document.createElement('div');
    prog.className = 'r-prog';
    var bar = document.createElement('span');
    bar.className = 'bar' + (p.progreso === 100 ? ' bar--done' : '');
    var fill = document.createElement('i');
    fill.style.width = p.progreso + '%';
    bar.appendChild(fill);
    var pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = p.progreso + '%';
    prog.appendChild(bar);
    prog.appendChild(pct);
    li.appendChild(prog);

    /* entrega */
    var date = document.createElement('div');
    date.className = 'r-date' + (atrasado(p) ? ' r-date--late' : '');
    if (p.entrega) {
      var partes = p.entrega.split('-');
      date.textContent = partes[2] + '/' + partes[1] + '/' + partes[0];
      if (atrasado(p)) date.textContent += ' · atrasado';
    } else {
      date.textContent = '—';
    }
    li.appendChild(date);

    /* acciones */
    var acts = document.createElement('div');
    acts.className = 'r-acts';
    var bEdit = document.createElement('button');
    bEdit.type = 'button';
    bEdit.className = 'icon-btn';
    bEdit.setAttribute('aria-label', 'Editar ' + p.proyecto);
    bEdit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-pencil"/></svg>';
    bEdit.addEventListener('click', function () { abrirModal(p); });
    var bDel = document.createElement('button');
    bDel.type = 'button';
    bDel.className = 'icon-btn icon-btn--del';
    bDel.setAttribute('aria-label', 'Eliminar ' + p.proyecto);
    bDel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg>';
    bDel.addEventListener('click', function () { eliminar(p); });
    acts.appendChild(bEdit);
    acts.appendChild(bDel);
    li.appendChild(acts);

    return li;
  }

  function cargar() {
    return Store.list().then(function (items) {
      proyectos = items;
      render();
    });
  }

  /* ---------- toolbar ---------- */
  q.addEventListener('input', function () {
    busqueda = q.value;
    render();
  });
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
    chip.addEventListener('click', function () {
      filtro = chip.dataset.estado;
      Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
      });
      render();
    });
  });
  btnExport.addEventListener('click', function () {
    try {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'proyectos-fjcloud.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast('Copia de seguridad descargada.');
    } catch (e) {
      showToast('No se pudo exportar en este navegador.');
    }
  });

  /* ---------- modal ---------- */
  function focusables() {
    return Array.prototype.filter.call(
      modal.querySelectorAll('button,[href],input,select,textarea'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
  }
  function abrirModal(p) {
    editId = p ? p.id : null;
    lastFocus = document.activeElement;
    modalTitle.textContent = p ? 'Editar proyecto' : 'Nuevo proyecto';
    fCliente.value = p ? p.cliente : '';
    fProyecto.value = p ? p.proyecto : '';
    fEstado.value = p ? p.estado : 'pendiente';
    fEntrega.value = p && p.entrega ? p.entrega : '';
    fProgreso.value = p ? p.progreso : 0;
    outProgreso.textContent = (p ? p.progreso : 0) + '%';
    fNotas.value = p ? p.notas : '';
    fldCliente.classList.remove('invalid');
    fldProyecto.classList.remove('invalid');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () { fCliente.focus(); }, 40);
  }
  function cerrarModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btnNuevo.addEventListener('click', function () { abrirModal(null); });
  modalClose.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);
  modal.addEventListener('mousedown', function (e) {
    if (e.target === modal) cerrarModal();
  });
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrarModal(); return; }
    if (e.key === 'Tab') {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  fProgreso.addEventListener('input', function () {
    outProgreso.textContent = fProgreso.value + '%';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var cliOk = fCliente.value.trim().length > 0;
    var proOk = fProyecto.value.trim().length > 0;
    fldCliente.classList.toggle('invalid', !cliOk);
    fldProyecto.classList.toggle('invalid', !proOk);
    if (!cliOk) { fCliente.focus(); return; }
    if (!proOk) { fProyecto.focus(); return; }

    Store.save({
      id: editId || '',
      cliente: fCliente.value,
      proyecto: fProyecto.value,
      estado: fEstado.value,
      progreso: fProgreso.value,
      entrega: fEntrega.value,
      notas: fNotas.value
    }).then(function (guardado) {
      if (!guardado) { showToast('No se pudo guardar (almacén lleno o bloqueado).'); return; }
      nuevoIdAnimado = guardado.id;
      cerrarModal();
      cargar().then(function () {
        showToast(editId ? 'Proyecto actualizado.' : 'Proyecto creado.');
        editId = null;
      });
    });
  });

  function eliminar(p) {
    var ok = window.confirm('¿Eliminar el proyecto “' + p.proyecto + '” de ' + p.cliente + '?');
    if (!ok) return;
    Store.remove(p.id).then(function () {
      cargar().then(function () { showToast('Proyecto eliminado.'); });
    });
  }

  /* ---------- toast ---------- */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('show');
    }, 2600);
  }

  /* ---------- arranque ---------- */
  renderGate();
  if (sesionOK()) cargar();
})();
