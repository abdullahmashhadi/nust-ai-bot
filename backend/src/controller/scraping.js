
const { startScraping } = require("../services/bgService");
const { DocumentService } = require("../services/DocumentService");
const { VectorStore } = require("../services/vectoreStore");
const { createClient } = require("@deepgram/sdk");
const fs = require("fs");

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
const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log('Received audio file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    const audioBuffer = fs.readFileSync(req.file.path);
    
    console.log('Audio buffer size:', audioBuffer.length);
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
      }
    );
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    if (error) {
      console.error('Deepgram error:', error);
      throw error;
    }
    
    if (!result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      return res.status(400).json({ error: 'No transcript generated' });
    }
    
    const transcript = result.results.channels[0].alternatives[0].transcript;
    console.log('Transcription successful:', transcript);
    
    res.json({ text: transcript });
  } catch (error) {
    console.error('Transcription error:', error);
    
    // Clean up file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Transcription failed',
      details: error.message 
    });
  }
};
module.exports = {
  scrapWebsite,
  uploadEmbeddings,
  processPDF,
  transcribeAudio
}