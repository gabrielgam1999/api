import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const CONSUMET_BASE = 'https://api-consumet-org-wg40.onrender.com';

async function getFlixHQSources(title, type, season, episode) {
    try {
        const searchUrl = `${CONSUMET_BASE}/movies/flixhq/${encodeURIComponent(title)}`;
        console.log('Searching:', searchUrl);
        
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        console.log(`Found ${searchData.results?.length || 0} results`);
        
        if (!searchData.results || searchData.results.length === 0) {
            return [];
        }
        
        const firstResult = searchData.results[0];
        const mediaId = firstResult.id;  // ← Guardamos esto
        console.log('Using:', firstResult.title, '(' + mediaId + ')');
        
        const infoUrl = `${CONSUMET_BASE}/movies/flixhq/info?id=${mediaId}`;
        console.log('Getting info:', infoUrl);
        
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();
        
        if (!infoData.episodes || infoData.episodes.length === 0) {
            console.log('No episodes found');
            return [];
        }
        
        console.log(`Found ${infoData.episodes.length} episodes`);
        
        let episodeId;
        if (type === 'tv' && season && episode) {
            const targetEp = infoData.episodes.find(e => 
                e.season === parseInt(season) && e.number === parseInt(episode)
            );
            episodeId = targetEp ? targetEp.id : infoData.episodes[0].id;
        } else {
            episodeId = infoData.episodes[0].id;
        }
        
        console.log('Episode ID:', episodeId);
        
        // CORREGIDO: agregar mediaId
        const watchUrl = `${CONSUMET_BASE}/movies/flixhq/watch?episodeId=${episodeId}&mediaId=${mediaId}`;
        console.log('Getting streams:', watchUrl);
        
        const watchRes = await fetch(watchUrl);
        const watchData = await watchRes.json();
        
        console.log('Watch data:', JSON.stringify(watchData, null, 2));
        
        const sources = [];
        if (watchData.sources && watchData.sources.length > 0) {
            watchData.sources.forEach((source, idx) => {
                sources.push({
                    name: `FlixHQ ${idx + 1}`,
                    url: source.url,
                    lang: 'LAT',
                    quality: source.quality || 'auto'
                });
            });
        }
        
        return sources;
        
    } catch (e) {
        console.error('FlixHQ error:', e.message);
        return [];
    }
}

app.get('/api/sources', async (req, res) => {
    const { type, title, season, episode } = req.query;
    
    if (!type || !title) {
        return res.status(400).json({ error: 'Missing type or title' });
    }
    
    try {
        console.log(`\n=== Getting sources for: ${title} (${type}) ===`);
        
        const sources = await getFlixHQSources(title, type, season, episode);
        
        console.log(`Found ${sources.length} sources\n`);
        return res.json({ sources });
        
    } catch (e) {
        console.error('API error:', e);
        return res.status(500).json({ error: 'Failed to get sources' });
    }
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Scraper API using Consumet',
        consumet: CONSUMET_BASE
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
