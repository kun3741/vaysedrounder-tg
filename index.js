require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const express = require("express");  

const app = express();
const port = process.env.PORT || 3000;
const token = `${process.env.TOKEN}`;
const bot = new TelegramBot(token, {
    polling: {
        interval: 300,
        autoStart: true
    }
});
bot.on("polling_error", (err) => {
    console.error(err);
    if (err && err.data && err.data.error && err.data.error.message) {
      console.log(err.data.error.message);
    }
});

bot.onText(/\/start/, async (msg) => {
    console.log(`[LOG] /start - id ${msg.chat.id}, @${msg.from.username}`)
    await bot.sendMessage(msg.chat.id, `✌️ · Hello, ${msg.from.first_name}!
I can convert your videos into round video messages or audios in voice messages.
Send me your video or audio and I will do my job.`);


});

bot.on('video', (msg) => {
    const chatId = msg.chat.id;
    const videoFileId = msg.video.file_id;

    bot.sendMessage(msg.chat.id, `Got it! Let me try...`);
    bot.sendChatAction(chatId, 'record_video_note');
    bot.getFile(videoFileId).then((file) => {
        const outputFilePath = path.join(__dirname, 'output.mp4');

        bot.downloadFile(videoFileId, __dirname).then((downloadedFilePath) => {
            ffmpeg.ffprobe(downloadedFilePath, (err, metadata) => {
                if (err) {
                    console.error('Error probing video:', err);
                    return;
                }
                const { width, height } = metadata.streams[0];
                const size = Math.min(width, height);
                ffmpeg(downloadedFilePath)
                    .videoFilters([
                        {
                            filter: 'crop',
                            options: {
                                out_w: size,
                                out_h: size,
                                x: (width - size) / 2,
                                y: (height - size) / 2,
                            },
                        },
                    ])
                    .videoCodec('libx264')
                    .size('640x640')
                    .outputOptions(['-pix_fmt yuv420p'])
                    .save(outputFilePath)
                    .on('end', () => {
                        bot.sendChatAction(chatId, 'upload_video_note');
                        bot.sendVideoNote(chatId, outputFilePath).then(() => {
                            fs.unlinkSync(downloadedFilePath);
                            fs.unlinkSync(outputFilePath);
                        }).catch((error) => {
                            console.error('Error sending video note:', error);
                        });
                    })
                    .on('error', (err) => {
                        console.error('Error processing video:', err);
                    });
            });
        }).catch((error) => {
            console.error('Error downloading video:', error);
        });
    }).catch((error) => {
        console.error('Error getting file info:', error);
    });
});


bot.on('audio', (msg) => {
    const chatId = msg.chat.id;
    const audioFileId = msg.audio.file_id;
    
    bot.sendMessage(msg.chat.id, `Got it! Let me try...`);
    bot.sendChatAction(chatId, 'record_audio');

    bot.getFile(audioFileId).then((file) => {
        const filePath = file.file_path;
        const tempFilePath = path.join(__dirname, 'temp.ogg');
        const outputFilePath = path.join(__dirname, 'output.ogg');

        bot.downloadFile(audioFileId, __dirname).then((downloadedFilePath) => {
            ffmpeg(downloadedFilePath)
                .audioCodec('libopus')
                .toFormat('ogg')
                .save(outputFilePath)
                .on('end', () => {
                    ffmpeg.ffprobe(outputFilePath, (err, metadata) => {
                        if (err) {
                            console.error('Error probing audio:', err);
                            return;
                        }
                        const duration = Math.ceil(metadata.format.duration);

                        bot.sendVoice(chatId, outputFilePath, {}, {duration: duration}).then(() => {
                            fs.unlinkSync(downloadedFilePath);
                            fs.unlinkSync(outputFilePath);
                        }).catch((error) => {
                            console.error('Error sending voice message:', error);
                        });
                    });
                })
                .on('error', (err) => {
                    console.error('Error processing audio:', err);
                });
        }).catch((error) => {
            console.error('Error downloading audio message:', error);
        });
    }).catch((error) => {
        console.error('Error getting file info:', error);
    });
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
  });
  
  app.listen(port, () => {
    console.log(port);
  });

console.log('Bot started');
