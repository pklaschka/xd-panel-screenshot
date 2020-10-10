/* Copyright 2020 by Pablo Klaschka <xdplugins@pabloklaschka.de> */

const ch = require('chalk');
const {Logger, ChalkLogger} = require('@fliegwerk/logsemts');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');

const panelColor = 0xF5F5F5FF;
const borderColor = 0xDDDDDDFF;

const myLogger = new Logger({
    loggers: [ChalkLogger(ch)]
})

const applicationLogger = myLogger.getComponentLogger('Application');
applicationLogger.info('Generating screenshot.')
applicationLogger.info('Please focus the Adobe XD window')

const interval = setInterval(() => {
    const win = require('active-win').sync()
    if (win.title.endsWith('Adobe XD')) {
        clearInterval(interval);
        myLogger.getComponentLogger('Active Window Detection').debug('Window Bounds', win.bounds)
        takeScreenshot(win.bounds);
    }
}, 500);

function takeScreenshot(bounds) {
    const screenshotLogger = myLogger.getComponentLogger('Screenshot');
    screenshotLogger.info('Detected XD Window, taking screenshot');
    screenshot({filename: `xd-screenshot-${Date.now()}.png`}).then(imgPath => {
        screenshotLogger.success('Screenshot was taken', imgPath);
        screenshotLogger.info('Cropping screenshot...')

        Jimp.read(imgPath, (err, img) => {
            try {
                // Crop the image to the window bounds (may include shadows around the window!)
                img.crop(
                    Math.max(0, bounds.x),
                    Math.max(0, bounds.y),
                    Math.min(img.bitmap.width, bounds.width),
                    Math.min(img.bitmap.width, bounds.height)
                );

                // Crop left border to panel
                for (let i = 0; i < img.bitmap.width; i++) {
                    if (img.getPixelColor(i, 640) === 0xE4E4E4FF) {
                        screenshotLogger.info('Left border:', i);
                        img.crop(i + 2, 0, img.bitmap.width - i - 2, img.bitmap.height)
                        break;
                    }
                }

                // Crop bottom border to panel
                for (let y = img.bitmap.height - 1; y >= 0; y--) {
                    if (img.getPixelColor(4, y) === panelColor) {
                        screenshotLogger.info('Bottom border:', y);
                        img.crop(0, 0, img.bitmap.width, y);
                        break;
                    }
                }

                // Crop top border to panel
                for (let y = 1; y < img.bitmap.height - 1; y++) {
                    if (
                        img.getPixelColor(0, y - 1) === panelColor
                        && img.getPixelColor(0, y) === borderColor
                        && img.getPixelColor(0, y + 1) === panelColor
                    ) {
                        screenshotLogger.info('Top border:', y + 1);
                        img.crop(0, y + 1, img.bitmap.width, img.bitmap.height - y - 1);
                        break;
                    }
                }

                // Crop right border to panel
                for (let x = 0; x < img.bitmap.width; x++) {
                    if (img.getPixelColor(x, img.bitmap.height - 1) !== panelColor) {
                        screenshotLogger.info('Right border:', x - 1);
                        img.crop(0, 0, x - 1, img.bitmap.height);
                        break;
                    }
                }

                screenshotLogger.success('Cropped screenshot')
                screenshotLogger.info('Saving image...')

                img.write(imgPath, (err) => {
                    if (err) {
                        screenshotLogger.error('Error saving image', err.message);
                    } else {
                        screenshotLogger.success('Image saved successfully at', imgPath);
                    }
                });
            } catch (e) {
                screenshotLogger.error('An unexpected error has occurred:', e.message);
            }
        })
    });
}
