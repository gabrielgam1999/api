// /api/sources.js - Vercel Serverless Function
import * as cheerio from 'cheerio';

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

// Scraper for Cuevana
async function scrapeCuevana(type, title, season, episode) {
    try {
        const slug = makeSlug(title);
        const url = type === 'movie' 
            ? `https://cuevana.bi/pelicula/${slug}`
            : `https://cuevana.bi/serie/${slug}/temporada-${season}/episodio-${episode}`;
        
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Find iframe sources
        const iframes = [];
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.includes('http')) iframes.push(src);
        });
        
        return iframes.length > 0 ? iframes[0] : null;
    } catch (e) {
        console.error('Cuevana error:', e);
        return null;
    }
}

// Scraper for PelisPlus
async function scrapePelisPlus(type, title, season, episode) {
    try {
        const slug = makeSlug(title);
        const url = type === 'movie'
            ? `https://pelisplus.lat/pelicula/${slug}`
            : `https://pelisplus.lat/serie/${slug}/temporada-${season}/episodio-${episode}`;
        
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const iframes = [];
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.includes('http')) iframes.push(src);
        });
        
        return iframes.length > 0 ? iframes[0] : null;
    } catch (e) {
        console.error('PelisPlus error:', e);
        return null;
    }
}

// Scraper for RePelis
async function scrapeRepelis(type, title, season, episode) {
    try {
        const slug = makeSlug(title);
        const url = type === 'movie'
            ? `https://repelishd.city/pelicula/${slug}`
            : `https://repelishd.city/serie/${slug}-temporada-${season}-episodio-${episode}`;
        
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const iframes = [];
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.includes('http')) iframes.push(src);
        });
        
        return iframes.length > 0 ? iframes[0] : null;
    } catch (e) {
        console.error('RePelis error:', e);
        return null;
    }
}

// Main handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { type, title, season, episode } = req.query;
    
    if (!type || !title) {
        return res.status(400).json({ error: 'Missing type or title' });
    }
    
    try {
        // Scrape all sources in parallel
        const [cuevana, pelisplus, repelis] = await Promise.all([
            scrapeCuevana(type, title, season, episode),
            scrapePelisPlus(type, title, season, episode),
            scrapeRepelis(type, title, season, episode)
        ]);
        
        const sources = [];
        
        if (cuevana) sources.push({ name: 'Cuevana', url: cuevana, lang: 'LAT' });
        if (pelisplus) sources.push({ name: 'PelisPlus', url: pelisplus, lang: 'LAT' });
        if (repelis) sources.push({ name: 'RePelis', url: repelis, lang: 'LAT' });
        
        return res.status(200).json({ sources });
    } catch (e) {
        console.error('API error:', e);
        return res.status(500).json({ error: 'Scraping failed' });
    }
}