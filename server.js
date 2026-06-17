const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const MODELS = [
  "nex-agi/nex-n2-pro:free",
  "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free"
];

app.get("/", (req, res) => {
  res.send("Backend do Escritor Baiano online ✅");
});

app.post("/generate", async (req, res) => {
  const { prompt, system, model } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt vazio." });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY não configurada no servidor." });
  }

  const selectedModels = model
    ? [model, ...MODELS.filter(m => m !== model)]
    : MODELS;

  const errors = [];

  for (let i = 0; i < selectedModels.length; i++) {
    const currentModel = selectedModels[i];

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://escritor-baiano-backend",
          "X-Title": "Escritor Baiano"
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            {
              role: "system",
              content: system || "Escreva em português brasileiro, de forma natural, sem markdown e sem pular linhas duplas."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 6000
        })
      });

      const data = await response.json();

      if (!response.ok) {
        errors.push(`${currentModel}: ${data?.error?.message || "erro desconhecido"}`);
        continue;
      }

      const text = data?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        errors.push(`${currentModel}: resposta vazia`);
        continue;
      }

      return res.json({
        text: text
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .replace(/\n{2,}/g, "\n")
          .trim(),
        modelUsed: currentModel,
        fallbackUsed: i > 0,
        failedModels: errors
      });

    } catch (err) {
      errors.push(`${currentModel}: ${err.message}`);
    }
  }

  return res.status(500).json({
    error: "Todos os modelos falharam.",
    failedModels: errors
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend online na porta ${PORT}`);
});