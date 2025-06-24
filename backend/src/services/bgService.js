const { DocumentService } = require("./DocumentService");

const documentService = new DocumentService();

const startScraping = async (url,maxPages,usePuppeteer) => {
    const result = await documentService.scrapeWebsite(url,maxPages, usePuppeteer);
    console.log(`Website scraped successfully: ${result.length} chunks`);

}
module.exports = {
  startScraping,
};