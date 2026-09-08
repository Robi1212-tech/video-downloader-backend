const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/fetch', (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'URL is required' });

    // Render-এর জন্য আমাদের কাস্টম yt-dlp পাথ
    const ytDlpPath = './bin/yt-dlp';
    const command = `${ytDlpPath} -j --no-warnings "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'Could not extract video. Link may be private or unsupported.' });
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
            res.status(500).json({ error: 'Failed to process video data.' });
        }
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
