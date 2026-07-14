const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3000;

app.get('/extract', async (req, res) => {
    const imdbId = req.query.imdb;
    if (!imdbId) {
        return res.status(400).json({ error: 'Missing imdb parameter' });
    }

    const url = `https://vidsrc.pm/embed/movie/${imdbId}`;
    console.log(`[${new Date().toISOString()}] Extracting M3U8 for: ${url}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        let m3u8Url = null;

        page.on('response', async (response) => {
            const responseUrl = response.url();
            if (responseUrl.includes('.m3u8')) {
                console.log(`[${new Date().toISOString()}] Found M3U8: ${responseUrl}`);
                m3u8Url = responseUrl;
            }
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();

        if (m3u8Url) {
            res.json({ success: true, m3u8: m3u8Url });
        } else {
            res.status(404).json({ success: false, error: 'M3U8 not found' });
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        if (browser) await browser.close();
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'M3U8 Proxy is running. Use /extract?imdb=tt0110357' });
});

app.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Proxy running on port ${port}`);
});
