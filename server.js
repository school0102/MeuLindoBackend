const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

app.get("/", (req, res) => {
  res.send("Backend do Escritor Baiano online ✅");
});

app.post("/generate", async (req, res) => {
  const { prompt, system, model } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      error: "Prompt vazio."
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY não configurada."
    });
  }

  const selectedModels = model
    ? [model, ...MODELS.filter(m => m !== model)]
    : MODELS;

  const errors = [];

  for (let i = 0; i < selectedModels.length; i++) {
    const currentModel = selectedModels[i];

    try {

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    system ||
                    "Escreva em português brasileiro, de forma natural, sem markdown e sem pular linhas duplas."
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 6000,
              topP: 0.95,
              topK: 40
            }
          })
        }
      );

      const data = await response.json();
      console.log("Status:", response.status);
console.log(JSON.stringify(data, null, 2));

      if (!response.ok) {
        errors.push(
          `${currentModel}: ${
            data?.error?.message || "erro desconhecido"
          }`
        );
        continue;
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text)
          .join("")
          ?.trim();

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
