
const { startScraping } = require("../services/bgService");
const { DocumentService } = require("../services/DocumentService");
const { VectorStore } = require("../services/vectoreStore");
const axios = require("axios");
const documentService = new DocumentService();

const scrapWebsite = async (req, res, next) => {
  try {
    const { url, maxPages = 500, usePuppeteer = true } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      startScraping(url, maxPages, usePuppeteer)
     res.status(200).json({
        message: "Website scraping started",
        url,
        maxPages,
        usePuppeteer
      });
    } catch (error) {
      console.error("Website scraping error:", error);
      next(error);
    }
};

const uploadEmbeddings = async (req, res, next) => {
  try {
    const content = req.body.content;
    if (!content || !Array.isArray(content) || content.length === 0) {
      return res.status(400).json({ error: "Content is required and must be a non-empty array" });
    }
    await VectorStore.addDocuments(content);
    res.status(200).json({ message: "Embeddings uploaded successfully" });
  } catch (error) {
    
  }
}

const processPDF = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }
  
      const result = await documentService.processPDF(req.file.path);
      res.json({
        message: "PDF processed successfully",
        chunks: result.length,
        data: result,
      });
    } catch (error) {
      console.error("PDF upload error:", error);
      res.status(500).json({ error: "Failed to process PDF" });
    }
}
module.exports = {
  scrapWebsite,
  uploadEmbeddings,
  processPDF
};