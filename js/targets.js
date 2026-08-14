function isAncestorVisible(object3D) {
  let node = object3D;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

let autoId = 0;

function register() {
  AFRAME.registerComponent('target-manager', {
    init() {
      this.targets = new Map();
      this.worldPos = new THREE.Vector3();
    },
    add({ id, el, type, radius }) {
      this.targets.set(id, { id, el, type, radius });
    },
    remove(id) {
      this.targets.delete(id);
    },
    active() {
      const out = [];
      for (const t of this.targets.values()) {
        if (!t.el.object3D || !isAncestorVisible(t.el.object3D)) continue;
        t.el.object3D.getWorldPosition(this.worldPos);
        out.push({
          id: t.id,
          pos: { x: this.worldPos.x, y: this.worldPos.y, z: this.worldPos.z },
          radius: t.radius,
          type: t.type,
          el: t.el,
        });
      }
      return out;
    },
  });

  AFRAME.registerComponent('hit-target', {
    schema: {
      type: { type: 'string', default: '' },
      radius: { type: 'number', default: 0.5 },
    },
    play() {
      this.targetId = this.el.id || `target-${++autoId}`;
      const manager = this.el.sceneEl.components['target-manager'];
      if (manager) {
        manager.add({ id: this.targetId, el: this.el, type: this.data.type, radius: this.data.radius });
      }
    },
    remove() {
      const manager = this.el.sceneEl && this.el.sceneEl.components['target-manager'];
      if (manager && this.targetId) manager.remove(this.targetId);
    },
  });

  AFRAME.registerComponent('core-flash', {
    init() {
      this.onHit = this.onHit.bind(this);
      this.el.sceneEl.addEventListener('targethit', this.onHit);
    },
    remove() {
      this.el.sceneEl.removeEventListener('targethit', this.onHit);
    },
    onHit(evt) {
      if (evt.detail.type !== 'core') return;
      this.el.removeAttribute('animation__flash');
      this.el.setAttribute('animation__flash', {
        property: 'scale',
        from: '1 1 1',
        to: '1.3 1.3 1.3',
        dur: 150,
        dir: 'alternate',
        easing: 'easeOutQuad',
      });
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
