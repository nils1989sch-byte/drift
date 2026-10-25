// HTML-Overlay: Timer, Punkte, Spieler-Status, Popups, Lebensbalken über Möbeln.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export class HUD {
  constructor(camera) {
    this.camera = camera;
    this.timer = $('timer');
    this.score = $('score');
    this.count = $('count');
    this.msg = $('msg');
    this.layer = $('labels');
    this.players = [$('p1'), $('p2')];
    this.labels = new Map();
    this.msgT = 0;
  }

  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, vis: _v.z < 1 };
  }

  setTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    this.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timer.classList.toggle('urgent', sec <= 15 && sec > 0);
  }
  setScore(v) { this.score.textContent = `${Math.round(v).toLocaleString('de-DE')} €`; }
  setCount(n, total) { this.count.textContent = `${n} / ${total}`; }

  setPlayer(i, text, mood = '') {
    const el = this.players[i].querySelector('.status');
    if (el.textContent !== text) el.textContent = text;
    this.players[i].dataset.mood = mood;
  }

  message(text, dur = 1.6, cls = '') {
    this.msg.innerHTML = text;
    this.msg.className = `show ${cls}`;
    this.msgT = dur;
  }

  popup(x, y, z, text, cls = '') {
    const p = this.project(x, y, z);
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  updateLabels(items, players) {
    for (const it of items) {
      let el = this.labels.get(it);
      const show = it.state !== 'broken' && (it.highlight || it.carriers.length || it.hp < 99.5);
      if (!show) { if (el) el.style.display = 'none'; continue; }
      if (!el) {
        el = document.createElement('div');
        el.className = 'ilabel';
        el.innerHTML = `<div class="name"></div><div class="bar"><i></i></div>`;
        this.layer.appendChild(el);
        this.labels.set(it, el);
      }
      el.style.display = '';
      const p = this.project(it.x, it.y + it.def.h + 0.5, it.z);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      const need = it.def.heavy ? ` 👥 ${Math.max(it.carriers.length, 0)}/2` : '';
      const name = it.highlight || it.carriers.length ? `${it.def.label}${need} · ${it.def.value}€` : '';
      const nameEl = el.firstChild;
      if (nameEl.textContent !== name) nameEl.textContent = name;
      const bar = el.lastChild.firstChild;
      bar.style.width = `${it.hp}%`;
      bar.style.background = it.hp > 60 ? '#5bd46a' : it.hp > 30 ? '#ffc93c' : '#ff4d4d';
      el.classList.toggle('hl', !!it.highlight);
      el.style.setProperty('--hl', it.highlightColor || '#fff');
    }
    void players;
  }

  clearLabels() {
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.layer.querySelectorAll('.popup').forEach((e) => e.remove());
  }

  update(dt) {
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) this.msg.className = '';
    }
  }
}
