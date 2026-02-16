import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'NASA Images Viewer', version: '1.0.0' });

app.ontoolinput = async (_) => {
  await loadCurrentImage();
}

async function loadCurrentImage() {
  try {
    // Get the current image URL using the tool
    const result = await app.callServerTool({
      name: 'get_current_image',
      arguments: {}
    });

    console.log('Get current image result:', result);

    // Extract the image URL from the tool result
    const textContent = result.content?.find((c) => c.type === 'text');
    const imageUrl = textContent && textContent.type === 'text' ? textContent.text : null;

    if (imageUrl) {
      updateImage(imageUrl);
    }
  } catch (error) {
    console.error('Error loading image:', error);
    const container = document.getElementById('imageContainer');
    if (container) {
      container.innerHTML = '<p class="error">Error loading image. Please try searching again.</p>';
    }
  }
}

function updateImage(imageUrl: string) {
  if (!imageUrl) {
    const container = document.getElementById('imageContainer');
    if (container) {
      container.innerHTML = '<p class="error">No image available</p>';
    }
    return;
  }

  const container = document.getElementById('imageContainer');
  const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

  if (container) {
    container.innerHTML = `
      <img src="${imageUrl}" alt="NASA Image" onload="console.log('Image loaded successfully')">
      <div class="image-info">
        <div class="image-title">NASA Image</div>
        <div class="image-description">Image from NASA's collection</div>
      </div>
    `;
  }

  if (nextBtn) {
    nextBtn.disabled = false;
  }
}

async function searchImages() {
  const queryInput = document.getElementById('searchQuery') as HTMLInputElement;
  const query = queryInput?.value.trim();

  if (!query) {
    alert('Please enter a search query');
    return;
  }

  const container = document.getElementById('imageContainer');
  const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

  if (container) {
    container.innerHTML = '<p class="loading">Searching...</p>';
  }
  if (nextBtn) {
    nextBtn.disabled = true;
  }

  try {
    await app.callServerTool({
      name: 'search_nasa_images',
      arguments: { query: query }
    });
    await loadCurrentImage();
  } catch (error) {
    console.error('Search error:', error);
    if (container) {
      container.innerHTML = `<p class="error">Search failed: ${(error as Error).message}</p>`;
    }
  }
}

async function nextImage() {
  const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

  if (nextBtn) {
    nextBtn.disabled = true;
  }

  try {
    await app.callServerTool({
      name: 'get_next_image',
      arguments: {}
    });
    await loadCurrentImage();
  } catch (error) {
    console.error('Next image error:', error);
    const container = document.getElementById('imageContainer');
    if (container) {
      container.innerHTML = `<p class="error">Failed to load next image: ${(error as Error).message}</p>`;
    }
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const nextBtn = document.getElementById('nextBtn');
  const searchQuery = document.getElementById('searchQuery') as HTMLInputElement;

  if (searchBtn) {
    searchBtn.addEventListener('click', searchImages);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', nextImage);
  }

  // Allow search on Enter key
  if (searchQuery) {
    searchQuery.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchImages();
      }
    });
  }
});

// Establish communication with the host
app.connect();
