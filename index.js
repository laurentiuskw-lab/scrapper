const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Funcție pentru a extrage URL-ul .m3u8 dintr-un răspuns HTML
function extractM3U8FromHTML(html) {
    // Caută în elemente <source> sau <video>
    const patterns = [
        /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i,
        /<video[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i,
        /"src":"([^"]+\.m3u8[^"]*)"/i,
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

// Funcție pentru a extrage iframe-ul din HTML
function extractIframeSrc(html) {
    // Caută iframe-ul care conține playerul
    const match = html.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (match && match[1]) {
        // Construiește URL-ul absolut dacă e relativ
        let src = match[1];
        if (src.startsWith('//')) {
            src = 'https:' + src;
        } else if (src.startsWith('/')) {
            src = 'https://vidsrc.pm' + src;
        }
        return src;
    }
    return null;
}

app.get('/extract', async (req, res) => {
    const imdbId = req.query.imdb;
    if (!imdbId) {
        return res.status(400).json({ error: 'Missing imdb parameter' });
    }

    console.log(`[${new Date().toISOString()}] Extracting for: ${imdbId}`);

    try {
        // Pasul 1: Accesează pagina principală vidsrc.pm
        const pageUrl = `https://vidsrc.pm/embed/movie/${imdbId}`;
        const pageResponse = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const pageHtml = await pageResponse.text();

        // Pasul 2: Extrage iframe-ul
        const iframeSrc = extractIframeSrc(pageHtml);
        if (!iframeSrc) {
            // Dacă nu găsim iframe, poate e direct un M3U8 în pagină
            const directM3U8 = extractM3U8FromHTML(pageHtml);
            if (directM3U8) {
                return res.json({ success: true, m3u8: directM3U8 });
            }
            return res.status(404).json({ success: false, error: 'No iframe or M3U8 found' });
        }

        console.log(`[${new Date().toISOString()}] Iframe found: ${iframeSrc}`);

        // Pasul 3: Accesează iframe-ul
        const iframeResponse = await fetch(iframeSrc, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': pageUrl
            }
        });
        const iframeHtml = await iframeResponse.text();

        // Pasul 4: Extrage M3U8 din iframe
        const m3u8Url = extractM3U8FromHTML(iframeHtml);
        if (m3u8Url) {
            return res.json({ success: true, m3u8: m3u8Url });
        }

        // Dacă nu găsim în HTML, poate e încărcat prin JavaScript - încercăm să căutăm în script-uri
        // (opțional, poți extinde logica aici)

        return res.status(404).json({ success: false, error: 'M3U8 not found' });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint pentru rădăcină
app.get('/', (req, res) => {
    res.json({ 
        message: 'M3U8 Proxy is running. Use /extract?imdb=tt0110357' 
    });
});

app.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Proxy running on port ${port}`);
});
