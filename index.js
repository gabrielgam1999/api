import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper: Generate slug
function makeSlug(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// Scraper with Puppeteer
async function scrapeWithPuppeteer(url, siteName) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Navigate and wait for network to be idle
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait a bit more for dynamic content
        await page.waitForTimeout(3000);
        
        // Try multiple selectors
        const iframeSrc = await page.evaluate(() => {
            // Try different iframe selectors
            const selectors = [
                'iframe[src*="http"]',
                'iframe#playerframe',
                'iframe.player',
                '#player iframe',
                '.player-container iframe',
                'iframe'
            ];
            
            for (const selector of selectors) {
                const iframe = document.querySelector(selector);
                if (iframe && iframe.src && iframe.src.startsWith('http')) {
                    return iframe.src;
                }
            }
            
            // If no iframe found, try to find in all iframes
            const allIframes = document.querySelectorAll('iframe');
            for (const iframe of allIframes) {
                if (iframe.src && iframe.src.startsWith('http')) {
                    return iframe.src;
                }
            }
            
            return null;
        });
        
        await browser.close();
        return iframeSrc;
        
    } catch (e) {
        console.error(`${siteName} error:`, e.message);
        if (browser) await browser.close();
        return null;
    }
}

// Scraper for Cuevana
async function scrapeCuevana(type, title, season, episode) {
    const slug = makeSlug(title);
    const url = type === 'movie' 
        ? `https://cuevana.bi/pelicula/${slug}`
        : `https://cuevana.bi/serie/${slug}/temporada-${season}/episodio-${episode}`;
    
    return await scrapeWithPuppeteer(url, 'Cuevana');
}

// Scraper for PelisPlus
async function scrapePelisPlus(type, title, season, episode) {
    const slug = makeSlug(title);
    const url = type === 'movie'
        ? `https://pelisplus.lat/pelicula/${slug}`
        : `https://pelisplus.lat/serie/${slug}/temporada-${season}/episodio-${episode}`;
    
    return await scrapeWithPuppeteer(url, 'PelisPlus');
}

// Scraper for RePelis
async function scrapeRepelis(type, title, season, episode) {
    const slug = makeSlug(title);
    const url = type === 'movie'
        ? `https://repelishd.city/pelicula/${slug}`
        : `https://repelishd.city/serie/${slug}-temporada-${season}-episodio-${episode}`;
    
    return await scrapeWithPuppeteer(url, 'RePelis');
}

// API Route
app.get('/api/sources', async (req, res) => {
    const { type, title, season, episode } = req.query;
    
    if (!type || !title) {
        return res.status(400).json({ error: 'Missing type or title' });
    }
    
    try {
        console.log(`Scraping: ${title} (${type})`);
        
        // Try sites one by one (not parallel to save resources)
        const sources = [];
        
        const cuevana = await scrapeCuevana(type, title, season, episode);
        if (cuevana) {
            sources.push({ name: 'Cuevana', url: cuevana, lang: 'LAT' });
        }
        
        // Only try next if first failed
        if (sources.length === 0) {
            const pelisplus = await scrapePelisPlus(type, title, season, episode);
            if (pelisplus) {
                sources.push({ name: 'PelisPlus', url: pelisplus, lang: 'LAT' });
            }
        }
        
        // Only try last if both failed
        if (sources.length === 0) {
            const repelis = await scrapeRepelis(type, title, season, episode);
            if (repelis) {
                sources.push({ name: 'RePelis', url: repelis, lang: 'LAT' });
            }
        }
        
        console.log(`Found ${sources.length} sources`);
        return res.json({ sources });
        
    } catch (e) {
        console.error('API error:', e);
        return res.status(500).json({ error: 'Scraping failed', details: e.message });
    }
});

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Scraper API with Puppeteer - Use /api/sources' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
