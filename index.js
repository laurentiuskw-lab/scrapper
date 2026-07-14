const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Funcție mai avansată pentru a extrage M3U8
function extractM3U8FromHTML(html) {
    // Caută în mai multe formate
    const patterns = [
        // video src
        /<video[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i,
        // source src
        /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i,
        // JavaScript variabile
        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
        // URL simplu
        /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

app.get('/extract', async (req, res) => {
    const imdbId = req.query.imdb;
    if (!imdbId) {
        return res.status(400).json({ error: 'Missing imdb parameter' });
    }

    try {
        // Încearcă direct un API (dacă există)
        const apiUrl = `https://vidsrc.pm/api/movie/${imdbId}`;
        try {
            const apiResponse = await fetch(apiUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (apiResponse.ok) {
                const data = await apiResponse.json();
                if (data.source || data.hls_url || data.url) {
                    return res.json({ 
                        success: true, 
                        m3u8: data.source || data.hls_url || data.url 
                    });
                }
            }
        } catch(e) {}

        // Dacă API-ul nu funcționează, încearcă scraping
        const pageUrl = `https://vidsrc.pm/embed/movie/${imdbId}`;
        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            }
        });
        const html = await response.text();
        
        // Caută direct
        let m3u8 = extractM3U8FromHTML(html);
        if (m3u8) {
            return res.json({ success: true, m3u8: m3u8 });
        }

        // Caută în scripturi
        const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatch) {
            for (const script of scriptMatch) {
                const found = extractM3U8FromHTML(script);
                if (found) {
                    return res.json({ success: true, m3u8: found });
                }
            }
        }

        return res.status(404).json({ 
            success: false, 
            error: 'M3U8 not found. Try using TMDB ID.' 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'Scraper running. Use /extract?imdb=tt0110357' });
});

app.listen(port, () => {
    console.log(`Scraper running on port ${port}`);
});
