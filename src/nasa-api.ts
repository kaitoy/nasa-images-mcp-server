import axios from 'axios';
import { NASASearchResponse, NASAImageItem } from './types.js';

const NASA_API_BASE = 'https://images-api.nasa.gov';

export async function searchNASAImages(
  query: string,
  apiKey: string = 'DEMO_KEY'
): Promise<NASAImageItem[]> {
  try {
    const response = await axios.get<NASASearchResponse>(
      `${NASA_API_BASE}/search`,
      {
        params: {
          q: query,
          media_type: 'image',
          page_size: 20
        }
      }
    );

    const items = response.data.collection.items;
    const imageItems: NASAImageItem[] = [];

    for (const item of items) {
      if (!item.data || item.data.length === 0) continue;

      const data = item.data[0];

      // サムネイルURLを取得
      let imageUrl = '';
      if (item.links && item.links.length > 0) {
        imageUrl = item.links[0].href;
      }

      // 中サイズ画像を取得する場合、asset manifestから取得
      // 簡略化のため、サムネイルを使用
      if (!imageUrl) continue;

      imageItems.push({
        nasaId: data.nasa_id,
        title: data.title || 'Untitled',
        description: data.description || 'No description available',
        imageUrl: imageUrl,
        dateCreated: data.date_created || '',
        center: data.center || 'NASA'
      });
    }

    return imageItems;
  } catch (error) {
    console.error('NASA API error:', error);
    throw new Error('Failed to search NASA images');
  }
}
