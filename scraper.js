require('dotenv').config();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeInterviews(url) {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {width: 1920, height: 1080},
        // slowMo: 50
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    let hasNextPage = true;
    const allPosts = [];

    while (hasNextPage) {
        await handleLoginOverlay(page);

        const content = await page.content();
        const $ = cheerio.load(content);

        $('div[data-test="InterviewList"] > div').each((index, element) => {
            let interview = '';
            let interviewQuestions = '';

            $(element).find('strong').each((i, el) => {
                if ($(el).text().trim() === 'Interview') {
                    interview = $(el).next('p').text().trim();
                } else if ($(el).text().trim() === 'Interview Questions') {
                    interviewQuestions = $(el).next('ul').find('li > span').text().trim();
                }
            });

            if (interview || interviewQuestions) {
                allPosts.push({interview, interviewQuestions});
            }
        });

        const nextPageButton = await page.$('div.pageContainer > button[aria-label="Next"]');
        if (nextPageButton) {
            const isDisabled = await page.evaluate(button => button.hasAttribute('disabled'), nextPageButton);
            if (!isDisabled) {
                await nextPageButton.click();
                await page.waitForTimeout(3000);
            } else {
                hasNextPage = false;
            }
        } else {
            hasNextPage = false;
        }
    }

    await browser.close();
    return allPosts;
}

async function handleLoginOverlay(page) {
    await page.evaluate(() => {
        const overlay = document.getElementById('HardsellOverlay');
        if (overlay) {
            overlay.remove();
        }
        const body = document.querySelector('body');
        if (body) {
            body.style.overflow = '';
            body.style.position = '';
        }
    });
}

scrapeInterviews(process.env.SCRAPING_URL)
    .then(posts => {
        const filePath = `${process.env.FILE_PATH}\\${process.env.FILE_NAME}.json`;
        fs.writeFile(filePath, JSON.stringify(posts), err => {
            if (err) {
                console.error('Error writing file:', err);
            } else {
                console.log('File successfully written to', filePath);
            }
        });
    })
    .catch(console.error);
