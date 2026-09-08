const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const binDir = path.join(__dirname, 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp');

// Download latest yt-dlp binary automatically at runtime
function downloadYtDlp() {
    if (!fs.existsSync(binDir)){
        fs.mkdirSync(binDir, { recursive: true });
    }

    if (!fs.existsSync(ytDlpPath)) {
        console.log("Downloading latest yt-dlp...");
        const file = fs.createWriteStream(ytDlpPath);
        https.get("https://github.com", response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("yt-dlp download complete.");
                fs.chmodSync(ytDlpPath, '755');
            });
        }).on('error', err => {
            fs.unlink(ytDlpPath, () => {});
            console.error(`Download fail: ${err.message}`);
        });
    } else {
        fs.chmodSync(ytDlpPath, '755');
    }
}

downloadYtDlp();

app.post('/api/fetch', (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'URL is required' });

    // Added common User-Agent string to bypass bot detection blocks
    const command = `"${ytDlpPath}" -j --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec Error: ${stderr}`);
            return res.status(500).json({ error: 'Could not extract video. The link might be invalid, private, or the platform blocked our request.' });
        }
        try {
            const videoData = JSON.parse(stdout);
            let downloadLink = videoData.url;
            if (!downloadLink && videoData.formats) {
                const bestCombined = videoData.formats.reverse().find(f => f.vcodec !== 'none' && f.acodec !== 'none');
                if (bestCombined) downloadLink = bestCombined.url;
            }
            res.json({
                title: videoData.title || 'Untitled Video',
                thumbnail: videoData.thumbnail || '',
                duration: videoData.duration_string || `${videoData.duration || 0}s`,
                source: videoData.extractor_key || 'Video',
                downloadUrl: downloadLink
            });
        } catch (e) {
            res.status(500).json({ error: 'Failed to process video metadata structure.' });
        }
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
