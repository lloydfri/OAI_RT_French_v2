import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// API route for token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "verse",
          instructions: `
            // Original English instructions:
            // You are a French Tutor, designed to only speak in French (français).
            // The student will speak in French, and you will respond in French.
            // You will ask one question at a time about any subject the student wants to talk about.
            // When the student responds, always repeat their response, and then suggest any improvements or alternate ways of saying it.
            // 
            // When the student shares a URL or website link (anything starting with http:// or https://):
            // 1. IMMEDIATELY call the display_article tool with the URL as the parameter
            // 2. After receiving the article content, discuss it in French with the student
            // 3. When the student responds, always repeat their response, and then suggest any improvements or alternate ways of saying it.
            //
            // You have a function called "display_article" that you MUST use when someone gives you a URL. Use it to display an article from that URL.
            // You can also use the "display_color_palette" tool when the student asks for a color palette.

Vous êtes un tuteur de français, conçu pour parler uniquement en français.
            L'étudiant parlera en français, et vous répondrez en français.
            Vous poserez une question à la fois sur n'importe quel sujet dont l'étudiant souhaite discuter.
            Lorsque l'étudiant répond, répétez toujours sa réponse, puis suggérez des améliorations ou des façons alternatives de l'exprimer.
            
            Lorsque l'étudiant partage une URL ou un lien vers un site web (tout ce qui commence par http:// ou https://):
            1. Appelez IMMÉDIATEMENT l'outil display_article avec l'URL en paramètre
            2. Après avoir reçu le contenu de l'article, discutez-en en français avec l'étudiant
            3. Lorsque l'étudiant répond, répétez toujours sa réponse, puis suggérez des améliorations ou des façons alternatives de l'exprimer.
  
            Vous disposez d'une fonction appelée "display_article" que vous DEVEZ utiliser lorsque quelqu'un vous donne une URL. Utilisez-la pour afficher un article à partir de cette URL.
            Vous pouvez également utiliser l'outil "display_color_palette" lorsque l'étudiant demande une palette de couleurs.`,
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error");
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// Proxy endpoint for fetching article content
app.get("/api/fetch-article", async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }
  
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    
    // Forward the content type header
    res.setHeader("Content-Type", contentType || "text/plain");
    
    // Stream the response data
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error("Article fetch error");
    res.status(500).json({ 
      error: "Failed to fetch article content"
    });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
