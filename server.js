const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ফোল্ডার এবং ফাইল পাথ ঠিক করা
const binDir = path.join(__dirname, 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp');

// সার্ভার চালু হওয়ার সময় স্বয়ংক্রিয়ভাবে yt-dlp ডাউনলোড করার ফাংশন
function downloadYtDlp() {
    if (!fs.existsSync(binDir)){
        fs.mkdirSync(binDir, { recursive: true });
    }

    if (!fs.existsSync(ytDlpPath)) {
        console.log("Downloading yt-dlp...");
        const file = fs.createWriteStream(ytDlpPath);
        // সর্বাধুনিক লিনাক্স রিলিজ ডাউনলোড করা হচ্ছে
        https.get("https://github.com", response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("yt-dlp downloaded successfully.");
                // ফাইলটিকে এক্সিকিউটেবল পারমিশন দেওয়া (+x)
                fs.chmodSync(ytDlpPath, '755');
            });
        }).on('error', err => {
            fs.unlink(ytDlpPath, () => {});
            console.error(`Download error: ${err.message}`);
        });
    } else {
        console.log("yt-dlp already exists.");
        fs.chmodSync(ytDlpPath, '755');
    }
}

// ফাংশনটি কল করা
downloadYtDlp();

app.post('/api/fetch', (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'URL is required' });

    // স্বয়ংক্রিয়ভাবে তৈরি হওয়া পাথ ব্যবহার করে কমান্ড রান করা
    const command = `"${ytDlpPath}" -j --no-warnings "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec Error: ${stderr}`);
            return res.status(500).json({ error: 'Could not extract video. Platform might be blocked or link is invalid.' });
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
