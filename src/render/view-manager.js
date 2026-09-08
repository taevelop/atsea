/** Owns presentation only. The caller owns the ocean, clock, records and input. */
export class ViewManager {
  constructor({ ascii, create3d, onChange = () => {}, onStatus = () => {}, onError = () => {} }) {
    this.ascii = ascii;
    this.active = ascii;
    this.create3d = create3d;
    this.onChange = onChange;
    this.onStatus = onStatus;
    this.onError = onError;
    this.mode = this.requestedMode = '2d';
    this.status = 'idle';
    this.revision = this.generation = 0;
    this.disposed = false;
    ascii.init();
  }

  resize(layout) {
    this.layout = layout;
    this.ascii.resize(layout);
    this.three?.resize(layout);
  }

  activate(mode) {
    this.mode = mode;
    this.active = mode === '2d' ? this.ascii : this.three;
    this.onChange(mode);
  }

  async setMode(mode) {
    if (mode !== '2d' && mode !== '3d') throw new RangeError('Unknown sea view');
    if (this.disposed) return false;
    const revision = ++this.revision;
    this.requestedMode = mode;
    if (mode === '2d') {
      this.activate('2d');
      this.onStatus(this.status);
      return true;
    }
    this.onStatus(this.status);
    const renderer = await this.ensure3d();
    if (!renderer || this.disposed || revision !== this.revision) return false;
    this.activate('3d');
    this.onStatus(this.status);
    return true;
  }

  ensure3d() {
    if (this.three) return Promise.resolve(this.three);
    if (this.loading) return this.loading;
    const generation = ++this.generation;
    this.status = 'loading';
    this.onStatus(this.status);
    this.loading = (async () => {
      let candidate;
      try {
        candidate = await this.create3d();
        if (this.disposed || generation !== this.generation) { candidate.dispose(); return null; }
        await candidate.init(progress => {
          if (!this.disposed && generation === this.generation) this.onStatus('loading', progress);
        });
        if (this.disposed || generation !== this.generation) { candidate.dispose(); return null; }
        if (this.layout) candidate.resize(this.layout);
        this.three = candidate;
        this.status = 'ready';
        this.onStatus(this.status);
        return candidate;
      } catch (error) {
        candidate?.dispose();
        if (!this.disposed && generation === this.generation) this.fail3d(error);
        return null;
      } finally {
        if (generation === this.generation) this.loading = null;
      }
    })();
    return this.loading;
  }

  fail3d(error) {
    if (this.disposed) return;
    this.generation++;
    this.loading = null;
    this.three?.dispose();
    this.three = null;
    this.status = 'error';
    this.activate('2d');
    this.onStatus(this.status);
    this.onError(error);
  }

  render(state) {
    try { this.active.render(state); }
    catch (error) {
      if (this.mode !== '3d') throw error;
      this.fail3d(error);
      this.ascii.render(state);
    }
  }

  getThumbnail(id, options) { return this.three?.getThumbnail(id, options); }
  getStats() { return { ...this.active.getStats(), mode: this.mode, status: this.status }; }

  dispose() {
    this.disposed = true;
    this.revision++;
    this.generation++;
    this.three?.dispose();
    this.three = null;
    this.ascii.dispose();
    this.loading = null;
  }
}
