const fs = require("fs");
const pdf = require("pdf-parse");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const { VectorStore } = require("./vectoreStore.js");

class DocumentService {
  vectorStore;
  constructor() {
    this.vectorStore = VectorStore;
  }

  async processPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      const chunks = this.splitIntoChunks(pdfData.text, 1000, 200);
      const documentsWithMetadata = chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          source: filePath,
          type: "pdf",
          chunk_index: index,
          total_chunks: chunks.length,
        },
      }));
      fs.unlinkSync(filePath);
      // write to a file
      const outputFilePath = `data/processed_pdf_${Date.now()}.json`;
      fs.writeFileSync(outputFilePath, JSON.stringify(documentsWithMetadata, null, 2));
      console.log(`Processed PDF saved to ${outputFilePath}`);
      console.log(`Total chunks created: ${documentsWithMetadata.length}`);
      return documentsWithMetadata;
    } catch (error) {
      console.error("PDF processing error:", error);
      throw error;
    }
  }

  async scrapeWebsite(url, maxPages = 15, usePuppeteer = true) {
    try {
      const visitedUrls = new Set();
      const allDocuments = [];
      const urlsToVisit = [url];
      
      if (usePuppeteer) {
        console.log("Using Puppeteer for scraping (Cloudflare bypass)...");
        return await this.scrapeWithPuppeteer(url, maxPages);
      }
      
      while (urlsToVisit.length > 0 && allDocuments.length < maxPages) {
        const currentUrl = urlsToVisit.shift();
        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);
        
        console.log(`Scraping: ${currentUrl}`);
        
        try {
          const content = await this.fetchWithRetry(currentUrl);
          if (!content) continue;
          
          const $ = cheerio.load(content);
          
          $("script, style, noscript, iframe, object, embed").remove();
          $("nav, footer, header, .nav, .footer, .header").remove();
          $(".aspNetHidden, .hidden, [style*='display:none'], [style*='display: none']").remove();

          const title = $("title").text().trim();
          
          const extractedContent = this.extractStructuredContent($);
          
          if (extractedContent.length > 100) {
            const chunks = this.splitIntoChunks(extractedContent, 1000, 200);

            const documentsWithMetadata = chunks.map((chunk, index) => ({
              content: chunk,
              metadata: {
                source: currentUrl,
                title: title,
                type: "webpage",
                chunk_index: index,
                total_chunks: chunks.length,
                scraped_at: new Date().toISOString(),
              },
            }));

            allDocuments.push(...documentsWithMetadata);
          }

          try {
            const baseUrl = new URL(currentUrl);
            $("a[href]").each((_, element) => {
              const href = $(element).attr("href");
              if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                  const fullUrl = new URL(href, currentUrl).toString();
                  const linkUrl = new URL(fullUrl);

                  if (
                    linkUrl.hostname === baseUrl.hostname &&
                    !visitedUrls.has(fullUrl) &&
                    urlsToVisit.length < maxPages * 3 &&
                    !urlsToVisit.includes(fullUrl)
                  ) {
                    const excludePatterns = [
                      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg)$/i,
                      /mailto:/,
                      /tel:/,
                      /javascript:/,
                      /#/
                    ];
                    
                    if (!excludePatterns.some(pattern => pattern.test(fullUrl))) {
                      urlsToVisit.push(fullUrl);
                    }
                  }
                } catch (error) {
                  console.warn(`Skipping invalid URL: ${href}`);
                }
              }
            });
          } catch (linkError) {
            console.error(`Error processing links from ${currentUrl}:`, linkError.message);
          }

        } catch (error) {
          console.error(`Error scraping ${currentUrl}:`, error.message);
          
          // If we get 403, try with Puppeteer
          if (error.response && error.response.status === 403) {
            console.log("Got 403, falling back to Puppeteer...");
            return await this.scrapeWithPuppeteer(url, maxPages);
          }
        }
        
        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));
      }

      if (allDocuments.length > 0) {
        const outputFilePath = `scraped_documents_${Date.now()}.json`;
        fs.writeFileSync(outputFilePath, JSON.stringify(allDocuments, null, 2));
        console.log(`Scraped documents saved to ${outputFilePath}`);
        console.log(`Total documents created: ${allDocuments.length}`);
      }

      return allDocuments;
    } catch (error) {
      console.error("Website scraping error:", error);
      throw error;
    }
  }

  async scrapeWithPuppeteer(url, maxPages = 10) {
    let browser;
    const allDocuments = [];
    const visitedUrls = new Set();
    const urlsToVisit = [url];

    try {
      browser = await puppeteer.launch({
        headless: "false",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      while (urlsToVisit.length > 0 && allDocuments.length < maxPages) {
        const currentUrl = urlsToVisit.shift();
        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);

        console.log(`Puppeteer scraping: ${currentUrl}`);

        try {
          await page.goto(currentUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          });

          // Wait for potential Cloudflare challenge
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Check if we're still on a Cloudflare challenge page
          const title = await page.title();
          if (title.includes('Just a moment') || title.includes('Checking your browser')) {
            console.log("Waiting for Cloudflare challenge to complete...");
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          // Get page content
          const content = await page.content();
          const $ = cheerio.load(content);

          // Remove unwanted elements
          $("script, style, noscript, iframe, object, embed").remove();
          $("nav, footer, header, .nav, .footer, .header").remove();
          $(".aspNetHidden, .hidden, [style*='display:none'], [style*='display: none']").remove();

          const pageTitle = await page.title();
          
          // Extract content
          const extractedContent = this.extractStructuredContent($);
          
          if (extractedContent.length > 100) {
            const chunks = this.splitIntoChunks(extractedContent, 1000, 200);

            const documentsWithMetadata = chunks.map((chunk, index) => ({
              content: chunk,
              metadata: {
                source: currentUrl,
                title: pageTitle,
                type: "webpage",
                chunk_index: index,
                total_chunks: chunks.length,
                scraped_at: new Date().toISOString(),
                method: "puppeteer"
              },
            }));

            allDocuments.push(...documentsWithMetadata);
          }

          // Get links for further crawling
          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors.map(a => a.href).filter(href => 
              href && !href.startsWith('#') && !href.startsWith('javascript:')
            );
          });

          const baseUrl = new URL(currentUrl);
          for (const link of links) {
            try {
              const linkUrl = new URL(link);
              if (
                linkUrl.hostname === baseUrl.hostname &&
                !visitedUrls.has(link) &&
                urlsToVisit.length < maxPages * 2 &&
                !urlsToVisit.includes(link)
              ) {
                const excludePatterns = [
                  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg)$/i,
                  /mailto:/,
                  /tel:/
                ];
                
                if (!excludePatterns.some(pattern => pattern.test(link))) {
                  urlsToVisit.push(link);
                }
              }
            } catch (error) {
              // Skip invalid URLs
            }
          }

        } catch (error) {
          console.error(`Error scraping ${currentUrl} with Puppeteer:`, error.message);
        }

        // Rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      }

    } finally {
      if (browser) {
        await browser.close();
      }
    }

    if (allDocuments.length > 0) {
      const outputFilePath = `scraped_documents_puppeteer_${Date.now()}.json`;
      fs.writeFileSync(outputFilePath, JSON.stringify(allDocuments, null, 2));
      console.log(`Puppeteer scraped documents saved to ${outputFilePath}`);
      console.log(`Total documents created: ${allDocuments.length}`);
    }

    return allDocuments;
  }

  async fetchWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 20000,
          headers: {
            "User-Agent": this.getRandomUserAgent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0"
          },
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        });

        return response.data;
      } catch (error) {
        console.log(`Attempt ${attempt} failed for ${url}: ${error.message}`);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  extractStructuredContent($) {
    let content = "";
    
    // Extract main content areas
    const contentSelectors = [
      'main',
      '.main-content',
      '.content',
      '#content',
      '#main',
      '.body-contents-left',
      '.notice-box',
      '.body-login'
    ];
    
    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 0) {
        mainContent = element;
        break;
      }
    }
    
    // If no main content found, use body
    if (!mainContent || mainContent.length === 0) {
      mainContent = $('body');
    }
    
    // Extract headings with structure
    mainContent.find('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        content += `\n\n=== ${text} ===\n`;
      }
    });
    
    // Extract tables with proper formatting
    mainContent.find('table').each((_, table) => {
      content += "\n\n[TABLE START]\n";
      
      $(table).find('tr').each((_, row) => {
        const cells = [];
        $(row).find('th, td').each((_, cell) => {
          const cellText = $(cell).text().trim().replace(/\s+/g, ' ');
          if (cellText) {
            cells.push(cellText);
          }
        });
        if (cells.length > 0) {
          content += cells.join(' | ') + '\n';
        }
      });
      
      content += "[TABLE END]\n\n";
    });
    
    // Extract lists
    mainContent.find('ul, ol').each((_, list) => {
      content += "\n";
      $(list).find('li').each((_, item) => {
        const text = $(item).text().trim().replace(/\s+/g, ' ');
        if (text) {
          content += `• ${text}\n`;
        }
      });
      content += "\n";
    });
    
    // Extract important notices and announcements
    mainContent.find('.notice, .announcement, .important, .alert, .warning').each((_, element) => {
      const text = $(element).text().trim().replace(/\s+/g, ' ');
      if (text) {
        content += `\n[IMPORTANT] ${text}\n`;
      }
    });
    
    // Extract forms and input information
    mainContent.find('form').each((_, form) => {
      content += "\n[FORM INFORMATION]\n";
      $(form).find('label, .form-label, .field-label').each((_, label) => {
        const text = $(label).text().trim();
        if (text) {
          content += `Form Field: ${text}\n`;
        }
      });
      content += "[END FORM]\n\n";
    });
    
    // Extract remaining paragraph content
    mainContent.find('p, div').each((_, element) => {
      // Skip if this element contains tables, lists, or other structural elements
      if ($(element).find('table, ul, ol, form').length === 0) {
        const text = $(element).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 20) {
          content += `${text}\n\n`;
        }
      }
    });
    
    // Clean up the content
    content = content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
    
    return content;
  }

  splitIntoChunks(text, chunkSize = 1000, overlap = 200) {
    if (!text || text.length === 0) {
      return [];
    }
    
    const chunks = [];
    const sections = text.split(/\n\n+/);
    let currentChunk = "";
    
    for (const section of sections) {
      const sectionText = section.trim();
      if (!sectionText) continue;
      
      if (currentChunk.length + sectionText.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 10));
        currentChunk = overlapWords.join(' ') + '\n\n' + sectionText;
      } else {
        if (currentChunk) {
          currentChunk += '\n\n' + sectionText;
        } else {
          currentChunk = sectionText;
        }
      }
      
      if (currentChunk.length > chunkSize * 1.5) {
        const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [currentChunk];
        let tempChunk = "";
        
        for (const sentence of sentences) {
          if (tempChunk.length + sentence.length > chunkSize && tempChunk.length > 0) {
            chunks.push(tempChunk.trim());
            tempChunk = sentence;
          } else {
            tempChunk += sentence;
          }
        }
        currentChunk = tempChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter((chunk) => chunk.length > 50);
  }
}

module.exports = { DocumentService };