/* Capa de datos del Panel de Proyectos FJcloud.
   Hoy: localStorage. Mañana: mismo contrato, Supabase (auth + RLS) —
   cambiar SOLO la implementación interna de estas funciones.
   Ningún consumidor (panel.js) debe tocar localStorage directamente. */
(function () {
  'use strict';

  var KEY = 'fjcloud_panel_proyectos_v1';
  var PIN_KEY = 'fjcloud_panel_pin';
  var DEFAULT_PIN = 'fjcloud';
  var ESTADOS = ['pendiente', 'proceso', 'revision', 'entregado'];
  var MAX_LEN = { cliente: 80, proyecto: 80, notas: 400 };

  function readRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeRaw(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      return false;
    }
  }

  function norm(v, max) {
    var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    return s.slice(0, max);
  }

  function sanitize(it) {
    var estado = ESTADOS.indexOf(it.estado) >= 0 ? it.estado : 'pendiente';
    var prog = parseInt(it.progreso, 10);
    if (isNaN(prog)) prog = 0;
    prog = Math.min(100, Math.max(0, prog));
    var entrega = /^\d{4}-\d{2}-\d{2}$/.test(String(it.entrega || '')) ? it.entrega : '';
    return {
      id: String(it.id || ''),
      cliente: norm(it.cliente, MAX_LEN.cliente),
      proyecto: norm(it.proyecto, MAX_LEN.proyecto),
      estado: estado,
      progreso: prog,
      entrega: entrega,
      notas: norm(it.notas, MAX_LEN.notas),
      creado: String(it.creado || ''),
      actualizado: String(it.actualizado || '')
    };
  }

  function nuevoId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  }

  window.ProyectosStore = {
    estados: ESTADOS,
    defaultPin: DEFAULT_PIN,

    list: function () {
      var items = readRaw().map(sanitize).filter(function (it) {
        return it.id && it.cliente && it.proyecto;
      });
      return Promise.resolve(items);
    },

    save: function (item) {
      return new Promise(function (resolve) {
        var clean = sanitize(item || {});
        if (!clean.cliente || !clean.proyecto) {
          resolve(null);
          return;
        }
        var arr = readRaw();
        var now = new Date().toISOString();
        clean.actualizado = now;
        if (!clean.id) {
          clean.id = nuevoId();
          clean.creado = now;
          arr.push(clean);
        } else {
          var i = -1;
          for (var k = 0; k < arr.length; k++) {
            if (String(arr[k].id) === clean.id) { i = k; break; }
          }
          if (i < 0) {
            clean.creado = clean.creado || now;
            arr.push(clean);
          } else {
            clean.creado = arr[i].creado || now;
            arr[i] = clean;
          }
        }
        resolve(writeRaw(arr) ? sanitize(clean) : null);
      });
    },

    remove: function (id) {
      return new Promise(function (resolve) {
        var arr = readRaw().filter(function (it) {
          return String(it.id) !== String(id);
        });
        resolve(writeRaw(arr));
      });
    },

    /* Gate de acceso: disuasorio de navegadores/curiosos.
       NO es autenticación real — la real (Supabase Auth, cookies httpOnly) llega después. */
    checkPin: function (pin) {
      var guardado = null;
      try {
        guardado = localStorage.getItem(PIN_KEY);
      } catch (e) {
        guardado = null;
      }
      return String(pin || '') === String(guardado || DEFAULT_PIN);
    },

    exportJSON: function () {
      return JSON.stringify(readRaw(), null, 2);
    }
  };
})();
