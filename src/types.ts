// NASA API型
export interface NASAImageItem {
  nasaId: string;
  title: string;
  description: string;
  imageUrl: string;      // 中サイズ画像のURL
  dateCreated: string;
  center: string;
}

export interface NASASearchResponse {
  collection: {
    items: Array<{
      href: string;
      data: Array<{
        nasa_id: string;
        title: string;
        description: string;
        date_created: string;
        center: string;
        media_type: string;
      }>;
      links?: Array<{
        href: string;
        rel: string;
        render?: string;
      }>;
    }>;
    metadata: {
      total_hits: number;
    };
  };
}

// セッション型
export interface SearchSession {
  query: string;
  images: NASAImageItem[];
  currentIndex: number;
  totalResults: number;
}

export interface SessionStore {
  [sessionId: string]: SearchSession;
}
