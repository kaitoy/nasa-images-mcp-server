import { SearchSession, SessionStore, NASAImageItem } from './types.js';
import { searchNASAImages } from './nasa-api.js';

export class SessionManager {
  private sessions: SessionStore = {};

  async search(sessionId: string, query: string): Promise<void> {
    const images = await searchNASAImages(query);

    this.sessions[sessionId] = {
      query,
      images,
      currentIndex: 0,
      totalResults: images.length
    };
  }

  getCurrentImage(sessionId: string): NASAImageItem | null {
    const session = this.sessions[sessionId];
    if (!session || session.images.length === 0) {
      return null;
    }
    return session.images[session.currentIndex];
  }

  nextImage(sessionId: string): NASAImageItem | null {
    const session = this.sessions[sessionId];
    if (!session) return null;

    session.currentIndex = (session.currentIndex + 1) % session.images.length;
    return this.getCurrentImage(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions[sessionId] !== undefined;
  }

  getSession(sessionId: string): SearchSession | null {
    return this.sessions[sessionId] || null;
  }
}
