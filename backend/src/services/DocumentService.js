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

  async processPDF(filePath, options = {}) {
    try {
      const { keepFile = false, sourceUrl = null } = options;
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      const chunks = this.splitIntoChunks(pdfData.text, 1000, 200);
      
      // Extract filename for better metadata
      const fileName = filePath.split('/').pop();
      
      const documentsWithMetadata = chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          source: filePath,
          title: fileName,
          type: "pdf",
          chunk_index: index,
          total_chunks: chunks.length,
          source_url: sourceUrl || `pdf:${fileName}`,
        },
        source_url: sourceUrl || `pdf:${fileName}`,
      }));
      
      // Only delete if not keeping file
      if (!keepFile) {
        fs.unlinkSync(filePath);
      }
      
      await this.vectorStore.addDocuments(documentsWithMetadata);
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
          $(
            ".aspNetHidden, .hidden, [style*='display:none'], [style*='display: none']",
          ).remove();

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
              if (
                href &&
                !href.startsWith("#") &&
                !href.startsWith("javascript:")
              ) {
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
                      /#/,
                    ];

                    if (
                      !excludePatterns.some((pattern) => pattern.test(fullUrl))
                    ) {
                      urlsToVisit.push(fullUrl);
                    }
                  }
                } catch (error) {
                  console.warn(`Skipping invalid URL: ${href}`);
                }
              }
            });
          } catch (linkError) {
            console.error(
              `Error processing links from ${currentUrl}:`,
              linkError.message,
            );
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
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 + Math.random() * 3000),
        );
      }

      if (allDocuments.length > 0) {
        // const outputFilePath = `scraped_documents_${Date.now()}.json`;
        // fs.writeFileSync(outputFilePath, JSON.stringify(allDocuments, null, 2));
        // console.log(`Scraped documents saved to ${outputFilePath}`);
        // console.log(`Total documents created: ${allDocuments.length}`);
        this.vectorStore.addDocuments(allDocuments);
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
    const contentHashes = new Set(); // Track content hashes to prevent duplicates
    const urlsToVisit = [url];
    await this.vectorStore.deleteDocumentsBySource(url);

    console.log(`\n🚀 Starting Puppeteer scrape:`);
    console.log(`   URL: ${url}`);
    console.log(`   Max Pages: ${maxPages}`);
    console.log(`   Will follow links to same domain/subdomains\n`);

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      });

      while (
        urlsToVisit.length > 0 &&
        Array.from(visitedUrls).length < maxPages
      ) {
        const currentUrl = urlsToVisit.shift();
        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);

        console.log(`Puppeteer scraping: ${currentUrl}`);

        // Create a fresh page for each URL to avoid detached frame issues
        let page;
        try {
          page = await browser.newPage();

          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          );
          await page.setViewport({ width: 1920, height: 1080 });

          await page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          });

          await page.goto(currentUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          // Wait for potential Cloudflare challenge
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Check if we're still on a Cloudflare challenge page
          const title = await page.title();
          if (
            title.includes("Just a moment") ||
            title.includes("Checking your browser")
          ) {
            console.log("Waiting for Cloudflare challenge to complete...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          // Get page content
          const content = await page.content();
          const $ = cheerio.load(content);

          // Remove unwanted elements (but preserve important notices and links in headers/footer)
          $("script, style, noscript, iframe, object, embed").remove();
          // Don't remove nav/footer completely - they contain important links
          // Only remove truly hidden elements
          $(
            ".aspNetHidden, .hidden, [style*='display:none'], [style*='display: none']",
          ).remove();

          const pageTitle = await page.title();

          // Extract content
          const extractedContent = this.extractStructuredContent($);

          console.log(
            `Extracted ${extractedContent.length} characters from ${currentUrl}`,
          );

          // Check if important keywords are present
          const hasNET2026 =
            extractedContent.includes("NET-2026") ||
            extractedContent.includes("NET 2026");
          const hasMathsCourse =
            extractedContent.includes("Maths Course") ||
            extractedContent.includes("Mathematics course");
          const hasResult =
            extractedContent.includes("Result") ||
            extractedContent.includes("result");

          if (currentUrl.includes("ugadmissions.nust.edu.pk")) {
            console.log(
              `📋 Content check - NET-2026: ${hasNET2026}, Maths Course: ${hasMathsCourse}, Result: ${hasResult}`,
            );

            // Debug: Save first page content to file
            if (
              currentUrl.endsWith(".pk/") ||
              currentUrl.endsWith("Default.aspx")
            ) {
              const fs = require("fs");
              fs.writeFileSync("debug_extracted_content.txt", extractedContent);
              console.log(
                "💾 Saved extracted content to debug_extracted_content.txt",
              );
            }
          }

          if (extractedContent.length < 500) {
            console.log(
              "Preview of extracted content:",
              extractedContent.substring(0, 200),
            );
          }

          // Reduced threshold from 100 to 50 to capture important short notices
          if (extractedContent.length > 50) {
            // Check if we've seen this content before (dedup by content hash)
            const contentHash = this.hashContent(extractedContent);
            if (contentHashes.has(contentHash)) {
              console.log(`⏭️  Skipping duplicate content from ${currentUrl}`);
            } else {
              contentHashes.add(contentHash);

              const chunks = this.splitIntoChunks(extractedContent, 1000, 200);

              console.log(`Created ${chunks.length} chunks from ${currentUrl}`);

              const documentsWithMetadata = chunks.map((chunk, index) => ({
                content: chunk,
                metadata: {
                  source: currentUrl,
                  title: pageTitle,
                  type: "webpage",
                  chunk_index: index,
                  total_chunks: chunks.length,
                  scraped_at: new Date().toISOString(),
                  method: "puppeteer",
                },
                source_url: url || "",
              }));

              allDocuments.push(...documentsWithMetadata);
            }
          }

          // Get links for further crawling
          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll("a[href]"));
            return anchors
              .map((a) => a.href)
              .filter(
                (href) =>
                  href &&
                  !href.startsWith("#") &&
                  !href.startsWith("javascript:") &&
                  !href.includes("#") &&
                  !href.includes("download") &&
                  !href.includes("mailto:"),
              );
          });
          // console.log("links found:", links);
          const baseUrl = new URL(currentUrl);

          for (const link of links) {
            try {
              const linkUrl = new URL(link);

              // Restrictive domain and path filtering
              const isUgAdmissions =
                linkUrl.hostname === "ugadmissions.nust.edu.pk";
              const isMainAdmissions =
                (linkUrl.hostname === "www.nust.edu.pk" ||
                  linkUrl.hostname === "nust.edu.pk") &&
                linkUrl.pathname.startsWith("/admissions");

              // Only follow ugadmissions or nust.edu.pk/admissions paths
              if (
                (isUgAdmissions || isMainAdmissions) &&
                !visitedUrls.has(link) &&
                urlsToVisit.length < maxPages * 2 &&
                !urlsToVisit.includes(link)
              ) {
                const excludePatterns = [
                  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg|jpg|jpeg|png|gif|svg|ico|webp|bmp)$/i,
                  /mailto:/,
                  /tel:/,
                  /\/PublishingImages\//i, // Skip image directories
                  /\/Stylelibrary\//i, // Skip style/asset directories
                ];

                if (!excludePatterns.some((pattern) => pattern.test(link))) {
                  urlsToVisit.push(link);
                  console.log(`  ➕ Added to queue: ${link}`);
                }
              }
            } catch (error) {
              // Skip invalid URLs
            }
          }
        } catch (error) {
          console.error(
            `Error scraping ${currentUrl} with Puppeteer:`,
            error.message,
          );
        } finally {
          // Close the page after each URL to prevent frame detachment
          if (page) {
            await page.close();
          }
        }

        // Rate limiting between requests
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 + Math.random() * 3000),
        );
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    if (allDocuments.length > 0) {
      // const outputFilePath = `scraped_documents_puppeteer_${Date.now()}.json`;
      // fs.writeFileSync(outputFilePath, JSON.stringify(allDocuments, null, 2));
      // console.log(`Puppeteer scraped documents saved to ${outputFilePath}`);
      // console.log(`Total documents created: ${allDocuments.length}`);
      this.vectorStore.addDocuments(allDocuments);
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
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
          },
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          },
        });

        return response.data;
      } catch (error) {
        console.log(`Attempt ${attempt} failed for ${url}: ${error.message}`);

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        );
      }
    }
  }

  getRandomUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  extractStructuredContent($) {
    let content = "";

    // PRIORITY 1: Extract important notices from ANYWHERE on page FIRST (before other content)
    // These are critical announcements that should be at the top
    const noticeSelectors = [
      ".notice",
      ".notice-box",
      ".important-notice",
      ".announcement",
      ".announcements",
      ".alert",
      ".alert-info",
      ".alert-warning",
      ".alert-success",
      ".notification",
      ".notifications",
      ".important",
      ".highlight",
      '[class*="notice"]',
      '[class*="announcement"]',
      '[class*="alert"]',
      ".card-body",
      ".info-box",
      ".message-box",
      // ASP.NET and ugadmissions specific selectors
      'a[href*="netform"]', // Links to important announcements
      "td > a[href]", // Table cells with links (often notices)
    ];

    // First pass: Extract from specific notice elements
    const noticeTexts = new Set();
    noticeSelectors.forEach((selector) => {
      $(selector).each((_, element) => {
        const $elem = $(element);
        const text = $elem.text().trim().replace(/\s+/g, " ");

        // For links, get both the link text and parent context
        if ($elem.is("a")) {
          const parentText = $elem.parent().text().trim().replace(/\s+/g, " ");
          if (
            parentText &&
            parentText.length > 30 &&
            parentText.length < 1000
          ) {
            noticeTexts.add(parentText);
          }
        }

        if (text && text.length > 30 && text.length < 2000) {
          noticeTexts.add(text);
        }
      });
    });

    // Second pass: Look for important headings and their following content
    $("h1, h2, h3, h4, h5, strong, b").each((_, element) => {
      const $elem = $(element);
      const headingText = $elem.text().trim();

      // Check if this looks like an important notice heading
      if (
        headingText &&
        (headingText.toLowerCase().includes("notice") ||
          headingText.toLowerCase().includes("important") ||
          headingText.toLowerCase().includes("result") ||
          headingText.toLowerCase().includes("announcement"))
      ) {
        // Get the heading and following siblings/content
        const heading = headingText;
        let fullNotice = heading + "\\n";

        // Get next sibling elements until we hit another heading or end
        let next = $elem.next();
        let count = 0;
        while (next.length > 0 && count < 5) {
          const nextTag = next.prop("tagName");
          if (
            nextTag &&
            ["H1", "H2", "H3", "H4", "H5", "H6"].includes(nextTag)
          ) {
            break;
          }
          const nextText = next.text().trim().replace(/\\s+/g, " ");
          if (nextText && nextText.length > 20) {
            fullNotice += nextText + "\\n";
          }
          next = next.next();
          count++;
        }

        if (fullNotice.length > 50) {
          noticeTexts.add(fullNotice);
        }
      }
    });

    // Add all notices to content
    noticeTexts.forEach((notice) => {
      content += `\\n\\n[IMPORTANT NOTICE]\\n${notice}\\n[END NOTICE]\\n`;
    });

    // Extract main content areas
    const contentSelectors = [
      "main",
      ".main-content",
      ".content",
      "#content",
      "#main",
      ".body-contents-left",
      ".body-contents-right",
      ".notice-box",
      ".body-login",
      ".container",
      ".page-content",
      "article",
      "#ctl00_PlaceHolderMain", // ASP.NET content placeholder
      ".ms-rtestate-field", // SharePoint/ASP.NET rich text
      "body > form > table", // ASP.NET table-based layout
      "body > form", // Fallback for ASP.NET forms
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
      mainContent = $("body");
    }

    // Extract headings with structure
    mainContent.find("h1, h2, h3, h4, h5, h6").each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        content += `\n\n=== ${text} ===\n`;
      }
    });

    // Extract tables with proper formatting to preserve relationships
    const extractedNetTable = new Set(); // Track if we already extracted NET table

    mainContent.find("table").each((_, table) => {
      const $table = $(table);

      // Check if this is the NET schedule table (special handling)
      const tableText = $table.text();
      if (
        tableText.includes("NET-2026") &&
        tableText.includes("Series") &&
        (tableText.includes("Islamabad") || tableText.includes("Karachi"))
      ) {
        // Skip if we already extracted a NET table
        if (extractedNetTable.size > 0) {
          console.log("⏭️  Skipping duplicate NET table");
          return;
        }

        extractedNetTable.add("extracted");

        content += "\n\n[NET TEST SCHEDULE TABLE]\n";

        // Extract all rows
        $table.find("tr").each((rowIdx, row) => {
          const cells = [];
          $(row)
            .find("th, td")
            .each((_, cell) => {
              cells.push($(cell).text().trim().replace(/\s+/g, " "));
            });

          // Skip empty rows
          if (cells.filter((c) => c).length === 0) return;

          // If first cell looks like a series identifier
          if (cells[0] && cells[0].toLowerCase().includes("series")) {
            const seriesName = cells[0];
            const registration = cells[1] || "";

            // Dates for cities start at index 2 (after series name and registration)
            const cityDates = cells.slice(2).filter((c) => c && c !== "-");

            // Cities are: Islamabad, Karachi, Quetta, Gilgit
            const cities = ["Islamabad", "Karachi", "Quetta", "Gilgit"];

            if (registration) {
              content += `${seriesName} Registration: ${registration}\n`;
            }

            // Map dates to cities
            if (cityDates.length === 1) {
              // One date for all cities
              cities.forEach((city) => {
                content += `${seriesName} - ${city}: ${cityDates[0]}\n`;
              });
            } else if (cityDates.length === 2) {
              // First date for Islamabad, second for Karachi/Quetta/Gilgit
              content += `${seriesName} - Islamabad: ${cityDates[0]}\n`;
              ["Karachi", "Quetta", "Gilgit"].forEach((city) => {
                content += `${seriesName} - ${city}: ${cityDates[1]}\n`;
              });
            } else if (cityDates.length === 3) {
              // Three dates: Islamabad, Karachi, Quetta (Gilgit empty)
              content += `${seriesName} - Islamabad: ${cityDates[0]}\n`;
              content += `${seriesName} - Karachi: ${cityDates[1]}\n`;
              content += `${seriesName} - Quetta: ${cityDates[2]}\n`;
            } else if (cityDates.length >= 4) {
              // All four cities have dates
              cityDates.slice(0, 4).forEach((date, idx) => {
                content += `${seriesName} - ${cities[idx]}: ${date}\n`;
              });
            }
          }
        });

        content += "[END NET TABLE]\n\n";
        return; // Skip normal table processing for this table
      }

      // Normal table processing for other tables
      const headers = [];
      const rows = [];

      // Extract headers
      $table
        .find("tr")
        .first()
        .find("th, td")
        .each((_, cell) => {
          const cellText = $(cell).text().trim().replace(/\s+/g, " ");
          headers.push(cellText);
        });

      // Extract data rows
      $table
        .find("tr")
        .slice(1)
        .each((_, row) => {
          const cells = [];
          $(row)
            .find("th, td")
            .each((_, cell) => {
              const cellText = $(cell).text().trim().replace(/\s+/g, " ");
              cells.push(cellText);
            });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

      // Format as structured text
      if (headers.length > 0 && rows.length > 0) {
        content += "\n\n[TABLE]\n";
        content += "Columns: " + headers.join(" | ") + "\n\n";

        rows.forEach((row) => {
          const rowText = [];
          row.forEach((cell, idx) => {
            if (cell && headers[idx]) {
              rowText.push(`${headers[idx]}: ${cell}`);
            }
          });
          content += "Row: " + rowText.join(", ") + "\n";
        });

        content += "[END TABLE]\n\n";
      }
    });

    // Extract lists
    mainContent.find("ul, ol").each((_, list) => {
      content += "\n";
      $(list)
        .find("li")
        .each((_, item) => {
          const text = $(item).text().trim().replace(/\s+/g, " ");
          if (text) {
            content += `• ${text}\n`;
          }
        });
      content += "\n";
    });

    // Extract any remaining notices from main content (in case they weren't caught earlier)
    mainContent
      .find(
        ".notice, .announcement, .important, .alert, .warning, .info, .card",
      )
      .each((_, element) => {
        const text = $(element).text().trim().replace(/\s+/g, " ");
        if (
          text &&
          text.length > 30 &&
          !content.includes(text.substring(0, 50))
        ) {
          content += `\n[IMPORTANT] ${text}\n`;
        }
      });

    // Extract forms and input information
    mainContent.find("form").each((_, form) => {
      content += "\n[FORM INFORMATION]\n";
      $(form)
        .find("label, .form-label, .field-label")
        .each((_, label) => {
          const text = $(label).text().trim();
          if (text) {
            content += `Form Field: ${text}\n`;
          }
        });
      content += "[END FORM]\n\n";
    });

    // Extract remaining paragraph content
    mainContent
      .find("p, div.text, div.content, div.description, section")
      .each((_, element) => {
        // Skip if this element contains tables, lists, or other structural elements
        if ($(element).find("table, ul, ol, form").length === 0) {
          const text = $(element).text().trim().replace(/\s+/g, " ");
          // Reduced minimum length from 20 to 15 to catch shorter important notices
          if (
            text &&
            text.length > 15 &&
            !content.includes(text.substring(0, 30))
          ) {
            content += `${text}\n\n`;
          }
        }
      });

    // Extract any standalone text nodes that might contain important info
    mainContent.find("span, strong, b, em, a").each((_, element) => {
      const text = $(element).text().trim().replace(/\s+/g, " ");
      const parent = $(element).parent();
      // Only add if parent is small (to avoid duplicating whole sections)
      if (
        text &&
        text.length > 30 &&
        parent.text().trim().length < 300 &&
        !content.includes(text.substring(0, 30))
      ) {
        content += `${text}\n`;
      }
    });

    // Extract any direct text content that might be in table cells or divs
    mainContent.find("td, th, dt, dd").each((_, element) => {
      const text = $(element).text().trim().replace(/\s+/g, " ");
      // Get direct text without nested elements to avoid duplication
      if (
        text &&
        text.length > 20 &&
        !content.includes(text.substring(0, 30))
      ) {
        content += `${text}\n`;
      }
    });

    // If we still have very little content, extract all visible text as fallback
    if (content.length < 500) {
      console.log("⚠️  Low content extraction, using fallback text extraction");
      const fallbackText = mainContent.text().trim().replace(/\s+/g, " ");
      if (fallbackText.length > content.length) {
        content = fallbackText;
      }
    }

    // Clean up the content
    content = content
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim();

    return content;
  }

  hashContent(text) {
    // Simple hash function for content deduplication
    let hash = 0;
    const normalized = text.trim().substring(0, 1000); // Use first 1000 chars for hash
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
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

      // Preserve important notices as standalone chunks if they're long enough
      if (
        sectionText.includes("[IMPORTANT NOTICE]") &&
        sectionText.length > 100 &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        chunks.push(sectionText);
        currentChunk = "";
        continue;
      }

      if (
        currentChunk.length + sectionText.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());

        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 10));
        currentChunk = overlapWords.join(" ") + "\n\n" + sectionText;
      } else {
        if (currentChunk) {
          currentChunk += "\n\n" + sectionText;
        } else {
          currentChunk = sectionText;
        }
      }

      if (currentChunk.length > chunkSize * 1.5) {
        const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [
          currentChunk,
        ];
        let tempChunk = "";

        for (const sentence of sentences) {
          if (
            tempChunk.length + sentence.length > chunkSize &&
            tempChunk.length > 0
          ) {
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

    // Reduced minimum chunk size from 50 to 30 to preserve short important notices
    return chunks.filter((chunk) => chunk.length > 30);
  }
}

module.exports = { DocumentService };
