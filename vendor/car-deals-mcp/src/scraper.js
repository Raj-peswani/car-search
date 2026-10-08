const puppeteer = require('puppeteer');

/**
 * Car listing data structure
 */
class CarListing {
    constructor(data) {
        this.title = data.title || null;
        this.price = data.price || null;
        this.mileage = data.mileage || null;
        this.dealerName = data.dealerName || null;
        this.location = data.location || null;
        this.dealRating = data.dealRating || null;
        this.url = data.url || null;
        this.imageUrl = data.imageUrl || null;
        this.source = data.source || null;
        // CarFax badges
        this.isOneOwner = data.isOneOwner || false;
        this.noAccidents = data.noAccidents || false;
        this.personalUse = data.personalUse || false;
    }

    format() {
        let result = `${this.title || 'Unknown Vehicle'}`;
        if (this.price) result += `\n  Price: ${this.price}`;
        if (this.mileage) result += `\n  Mileage: ${this.mileage}`;
        if (this.dealRating) result += `\n  Deal Rating: ${this.dealRating}`;

        // CarFax badges
        const badges = [];
        if (this.isOneOwner) badges.push('1-Owner');
        if (this.noAccidents) badges.push('No Accidents');
        if (this.personalUse) badges.push('Personal Use');
        if (badges.length > 0) result += `\n  CarFax: ${badges.join(' | ')}`;

        if (this.dealerName) result += `\n  Dealer: ${this.dealerName}`;
        if (this.location) result += `\n  Location: ${this.location}`;
        if (this.source) result += `\n  Source: ${this.source}`;
        if (this.url) result += `\n  ${this.url}`;
        return result;
    }
}

/**
 * Launch a standard browser; no evasion or security overrides
 */
async function launchBrowser() {
    return puppeteer.launch({headless: true});
}

/**
 * Scrape Cars.com for car listings
 */
async function scrapeCarscom(params, maxResults = 20) {
    const listings = [];
    let browser;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Build URL
        let url = 'https://www.cars.com/shopping/results/?';
        const urlParams = new URLSearchParams();
        urlParams.append('stock_type', 'used');
        if (params.make) urlParams.append('makes[]', params.make.toLowerCase());
        if (params.model) urlParams.append('models[]', `${params.make.toLowerCase()}-${params.model.toLowerCase()}`);
        if (params.zip) urlParams.append('zip', params.zip);
        // Default to 150 mile radius if not specified
        urlParams.append('maximum_distance', params.radius || '150');
        if (params.yearMin) urlParams.append('year_min', params.yearMin);
        if (params.yearMax) urlParams.append('year_max', params.yearMax);
        if (params.priceMax) urlParams.append('list_price_max', params.priceMax);
        if (params.mileageMax) urlParams.append('mileage_max', params.mileageMax);

        // CarFax history filters
        if (params.oneOwner) urlParams.append('one_owner', 'true');
        if (params.noAccidents) urlParams.append('no_accidents', 'true');
        if (params.personalUse) urlParams.append('personal_use', 'true');

        url += urlParams.toString();

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        // Wait for vehicle cards to render (up to 10s), fall back to timeout
        await page.waitForSelector('.vehicle-card', { timeout: 10000 }).catch(() => {
            console.error('[Cars.com] No .vehicle-card found after 10s, trying alternate selectors...');
        });
        // Extra buffer for lazy-loaded content
        await new Promise(r => setTimeout(r, 2000));

        // Extract listings from .vehicle-card elements
        const rawListings = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('.vehicle-card');

            cards.forEach(card => {
                const text = card.innerText;
                const lines = text.split('\n').filter(l => l.trim());

                let title = null;
                let price = null;
                let mileage = null;
                let dealRating = null;
                let dealerName = null;
                let location = null;

                for (const line of lines) {
                    const trimmed = line.trim();

                    // Title: Year Make Model (e.g., "2020 Toyota Camry XSE")
                    if (/^(19|20)\d{2}\s+\w+/.test(trimmed) && !title) {
                        title = trimmed;
                        continue;
                    }

                    // Price: "$XX,XXX" (may have "price drop" suffix)
                    const priceMatch = trimmed.match(/^\$[\d,]+/);
                    if (priceMatch && !price) {
                        price = priceMatch[0];
                        continue;
                    }

                    // Mileage: "XX,XXX mi."
                    if (/^[\d,]+\s*mi\.?$/i.test(trimmed) && !mileage) {
                        mileage = trimmed;
                        continue;
                    }

                    // Deal rating: "Good Deal", "Great Deal", etc.
                    if (/^(great|good|fair|high|no price)/i.test(trimmed) && !dealRating) {
                        dealRating = trimmed.split('|')[0].trim();
                        continue;
                    }

                    // Location: "City, ST (XX mi.)"
                    if (/^[A-Z][a-z]+.*,\s*[A-Z]{2}\s*\(/i.test(trimmed) && !location) {
                        location = trimmed;
                        continue;
                    }
                }

                // Get dealer name - usually after reviews count
                const dealerMatch = card.querySelector('.dealer-name');
                if (dealerMatch) {
                    dealerName = dealerMatch.innerText.trim();
                } else {
                    // Fallback: look for line before reviews
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('reviews') && i > 0) {
                            dealerName = lines[i - 1].trim();
                            break;
                        }
                    }
                }

                // Get URL from the card link
                const linkEl = card.querySelector('a.vehicle-card-link');
                const href = linkEl ? linkEl.getAttribute('href') : null;

                // Check for CarFax badges
                const fullText = text.toLowerCase();
                const isOneOwner = fullText.includes('1-owner') || fullText.includes('one owner');
                const noAccidents = fullText.includes('no accident') || fullText.includes('clean');
                const personalUse = fullText.includes('personal use');

                if (title) {
                    results.push({ title, price, mileage, dealRating, dealerName, location, href, isOneOwner, noAccidents, personalUse });
                }
            });

            return results;
        });

        for (const item of rawListings.slice(0, maxResults)) {
            listings.push(new CarListing({
                title: item.title,
                price: item.price,
                mileage: item.mileage,
                dealerName: item.dealerName,
                dealRating: item.dealRating,
                url: item.href ? `https://www.cars.com${item.href}` : null,
                source: 'Cars.com',
                isOneOwner: item.isOneOwner,
                noAccidents: item.noAccidents,
                personalUse: item.personalUse
            }));
        }

        await browser.close();
    } catch (err) {
        if (browser) await browser.close();
        throw new Error(`Cars.com scraping failed: ${err.message}`);
    }

    return listings;
}

/**
 * Scrape Autotrader for car listings
 */
async function scrapeAutotrader(params, maxResults = 20) {
    const listings = [];
    let browser;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Build URL using Autotrader's search endpoint
        const make = params.make ? params.make.toLowerCase() : '';
        const model = params.model ? params.model.toLowerCase() : '';
        const zip = params.zip || '90210';
        const radius = params.radius || '150';

        const urlParams = new URLSearchParams();
        urlParams.append('searchRadius', radius);
        urlParams.append('zip', zip);
        urlParams.append('isNewSearch', 'true');
        urlParams.append('marketExtension', 'include');
        urlParams.append('showAccelerateBanner', 'false');
        urlParams.append('sortBy', 'relevance');
        urlParams.append('numRecords', String(maxResults));
        if (make) urlParams.append('makeCodeList', make.toUpperCase().slice(0, 3));
        if (params.yearMin) urlParams.append('startYear', params.yearMin);
        if (params.yearMax) urlParams.append('endYear', params.yearMax);
        if (params.priceMax) urlParams.append('maxPrice', params.priceMax);
        if (params.mileageMax) urlParams.append('maxMileage', params.mileageMax);

        let url = `https://www.autotrader.com/cars-for-sale/used-cars/${make}/${model}?${urlParams.toString()}`;

        console.error(`[Autotrader] URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(r => setTimeout(r, 5000));

        // Generic extraction: find all listing-like links with vehicle data
        const rawListings = await page.evaluate(() => {
            const results = [];
            const seen = new Set();

            // Strategy 1: Look for links to vehicle detail pages
            const links = document.querySelectorAll('a[href*="/cars-for-sale/vehicledetails"]');
            for (const link of links) {
                const href = link.getAttribute('href');
                if (!href || seen.has(href)) continue;
                seen.add(href);

                // Walk up to find the card container
                let card = link.closest('[data-cmp="inventoryListing"]')
                    || link.closest('[class*="inventory-listing"]')
                    || link.closest('div[class]');
                if (!card) continue;

                const text = card.innerText || '';
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                let title = null, price = null, mileage = null, dealerName = null, location = null;

                for (const line of lines) {
                    // Title: starts with year
                    if (/^(19|20)\d{2}\s+\w+/.test(line) && !title) {
                        title = line;
                        continue;
                    }
                    // Price: "$XX,XXX" anywhere in the line
                    const priceMatch = line.match(/\$[\d,]+/);
                    if (priceMatch && !price) {
                        const num = parseInt(priceMatch[0].replace(/[$,]/g, ''), 10);
                        if (num > 500 && num < 200000) {
                            price = priceMatch[0];
                            continue;
                        }
                    }
                    // Mileage: various formats
                    const mileMatch = line.match(/([\d,]+)\s*(?:miles?|mi\.?)/i);
                    if (mileMatch && !mileage) {
                        mileage = mileMatch[0];
                        continue;
                    }
                    // Also catch "XXK miles" or just "XX,XXX mi"
                    if (/^\d+K?\s*mi/i.test(line) && !mileage) {
                        mileage = line;
                        continue;
                    }
                    // Location: "City, ST" or "City, ST XX mi away"
                    if (/[A-Z][a-z]+.*,\s*[A-Z]{2}/.test(line) && !location) {
                        const locMatch = line.match(/([A-Z][a-z]+.*?,\s*[A-Z]{2})/);
                        if (locMatch) location = locMatch[1];
                        continue;
                    }
                }

                // Try getting price from specific elements if text parsing missed it
                if (!price) {
                    const priceEl = card.querySelector('[data-cmp="firstPrice"]')
                        || card.querySelector('[class*="first-price"]')
                        || card.querySelector('[class*="price"]');
                    if (priceEl) {
                        const priceText = priceEl.innerText.trim();
                        const pm = priceText.match(/\$[\d,]+/);
                        if (pm) price = pm[0];
                    }
                }

                // Try getting mileage from specific elements
                if (!mileage) {
                    const mileEls = card.querySelectorAll('span, div, p');
                    for (const el of mileEls) {
                        const t = el.innerText.trim();
                        const mm = t.match(/([\d,]+)\s*(?:miles?|mi\.?)/i);
                        if (mm) { mileage = mm[0]; break; }
                    }
                }

                // Get image
                const imgEl = card.querySelector('img[src*="http"]') || card.querySelector('img');
                const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

                // Get dealer from specific element or text
                const dealerEl = card.querySelector('[data-cmp="dealerName"]')
                    || card.querySelector('.dealer-name');
                if (dealerEl && !dealerName) dealerName = dealerEl.innerText.trim();

                if (title || price) {
                    results.push({ title, price, mileage, dealerName, location, href, imageUrl });
                }
            }

            // Strategy 2: Fallback - look for any card-like elements with year patterns
            if (results.length === 0) {
                const allCards = document.querySelectorAll('[data-cmp="inventoryListing"], [class*="inventory-listing"], [class*="result-item"]');
                allCards.forEach(card => {
                    const text = card.innerText || '';
                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    let title = null, price = null, mileage = null;

                    for (const line of lines) {
                        if (/^(19|20)\d{2}\s+\w+/.test(line) && !title) { title = line; continue; }
                        if (/^\$[\d,]+$/.test(line) && !price) { price = line; continue; }
                        if (/[\d,]+\s*miles?/i.test(line) && !mileage) {
                            const match = line.match(/([\d,]+)\s*miles?/i);
                            if (match) mileage = match[0];
                            continue;
                        }
                    }

                    const linkEl = card.querySelector('a[href*="/cars-for-sale/"]');
                    const imgEl = card.querySelector('img[src*="http"]') || card.querySelector('img');

                    if (title) {
                        results.push({
                            title, price, mileage,
                            dealerName: null,
                            location: null,
                            href: linkEl ? linkEl.getAttribute('href') : null,
                            imageUrl: imgEl ? imgEl.getAttribute('src') : null
                        });
                    }
                });
            }

            return results;
        });

        console.error(`[Autotrader] Extracted ${rawListings.length} raw listings`);

        for (const item of rawListings.slice(0, maxResults)) {
            listings.push(new CarListing({
                title: item.title,
                price: item.price,
                mileage: item.mileage,
                dealerName: item.dealerName,
                location: item.location,
                imageUrl: item.imageUrl,
                url: item.href ? (item.href.startsWith('http') ? item.href : `https://www.autotrader.com${item.href}`) : null,
                source: 'Autotrader'
            }));
        }

        await browser.close();
    } catch (err) {
        if (browser) await browser.close();
        throw new Error(`Autotrader scraping failed: ${err.message}`);
    }

    return listings;
}

/**
 * Scrape KBB for car listings
 */
async function scrapeKBB(params, maxResults = 20) {
    const listings = [];
    let browser;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Build URL
        const make = params.make ? params.make.toLowerCase() : '';
        const model = params.model ? params.model.toLowerCase() : '';
        const zip = params.zip || '90210';

        let url = `https://www.kbb.com/cars-for-sale/all`;
        if (make) url += `/${make}`;
        if (model) url += `/${model}`;
        url += `/?zip=${zip}`;

        // Add filters
        if (params.yearMin) url += `&startYear=${params.yearMin}`;
        if (params.yearMax) url += `&endYear=${params.yearMax}`;
        if (params.priceMax) url += `&maxPrice=${params.priceMax}`;
        if (params.mileageMax) url += `&maxMileage=${params.mileageMax}`;

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('[data-cmp="inventoryListing"]', { timeout: 10000 }).catch(() => {
            console.error('[KBB] No listing cards found after 10s');
        });
        await new Promise(r => setTimeout(r, 2000));

        // Extract listings - KBB uses inventoryListing data-cmp
        const rawListings = await page.evaluate(() => {
            const results = [];

            const cards = document.querySelectorAll('[data-cmp="inventoryListing"]');

            cards.forEach(card => {
                const text = card.innerText;
                if (!text || text.length < 20) return;

                const lines = text.split('\n').filter(l => l.trim());

                let title = null;
                let trim = null;
                let price = null;
                let mileage = null;
                let dealRating = null;

                for (const line of lines) {
                    const trimmed = line.trim();

                    // Title: Year Make Model
                    if (/^(19|20)\d{2}\s+\w+/.test(trimmed) && !title) {
                        title = trimmed;
                        continue;
                    }

                    // Trim (usually follows title, like "XSE" or "LE")
                    if (title && !trim && /^[A-Z]{1,4}$/.test(trimmed)) {
                        trim = trimmed;
                        continue;
                    }

                    // Price: "$XX,XXX" or just "XX,XXX" (KBB sometimes omits $)
                    const priceMatch = trimmed.match(/^\$?([\d,]+)$/);
                    if (priceMatch && !price && parseInt(priceMatch[1].replace(/,/g, '')) > 1000) {
                        price = trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
                        continue;
                    }

                    // Mileage: "XXK mi" or "XX,XXX mi"
                    if (/^\d+K?\s*mi$/i.test(trimmed) && !mileage) {
                        mileage = trimmed;
                        continue;
                    }

                    // Deal rating: "Good Price", "Great Price", "Fair Price"
                    if (/^(good|great|fair|high)\s*(price|deal)/i.test(trimmed) && !dealRating) {
                        dealRating = trimmed;
                        continue;
                    }
                }

                // Get URL from the card link
                const linkEl = card.querySelector('a[href*="/cars-for-sale/"]') || card.querySelector('a[href]');
                const href = linkEl ? linkEl.getAttribute('href') : null;

                // Get dealer/location info
                let location = null;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (/^[A-Z][a-z]+.*,\s*[A-Z]{2}$/i.test(trimmed) && !location) {
                        location = trimmed;
                    }
                }

                // Get image URL
                const imgEl = card.querySelector('img[src*="http"]') || card.querySelector('img');
                const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

                if (title) {
                    if (trim) title = `${title} ${trim}`;
                    results.push({ title, price, mileage, dealRating, href, location, imageUrl });
                }
            });

            return results;
        });

        for (const item of rawListings.slice(0, maxResults)) {
            listings.push(new CarListing({
                title: item.title,
                price: item.price,
                mileage: item.mileage,
                dealRating: item.dealRating,
                location: item.location,
                imageUrl: item.imageUrl,
                url: item.href ? (item.href.startsWith('http') ? item.href : `https://www.kbb.com${item.href}`) : null,
                source: 'KBB'
            }));
        }

        await browser.close();
    } catch (err) {
        if (browser) await browser.close();
        throw new Error(`KBB scraping failed: ${err.message}`);
    }

    return listings;
}

/**
 * Search all sources and combine results
 */
async function searchAllSources(params, maxResultsPerSource = 10) {
    const results = {
        listings: [],
        errors: []
    };

    // Run scrapers in parallel
    const scrapers = [
        { name: 'Cars.com', fn: () => scrapeCarscom(params, maxResultsPerSource) },
        { name: 'Autotrader', fn: () => scrapeAutotrader(params, maxResultsPerSource) },
        { name: 'KBB', fn: () => scrapeKBB(params, maxResultsPerSource) }
    ];

    const promises = scrapers.map(async scraper => {
        try {
            const listings = await scraper.fn();
            return { name: scraper.name, listings, error: null };
        } catch (err) {
            return { name: scraper.name, listings: [], error: err.message };
        }
    });

    const outcomes = await Promise.all(promises);

    for (const outcome of outcomes) {
        results.listings.push(...outcome.listings);
        if (outcome.error) {
            results.errors.push({ source: outcome.name, error: outcome.error });
        }
    }

    return results;
}

module.exports = {
    CarListing,
    scrapeCarscom,
    scrapeAutotrader,
    scrapeKBB,
    searchAllSources
};
