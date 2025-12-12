//@ts-ignore
import { ReversoWrapper } from "./reverso-wrapper";
import { appendFileSync, readFileSync, existsSync } from "node:fs";

const DECK_NAME = "My english deck";
const LANGUAGE_FROM = "english";
const LANGUAGE_TO = "spanish";

const reverso = new ReversoWrapper();

(async () => {
  if (!existsSync("output.txt")) {
    const input = readFileSync("input.txt", "utf-8");

    const inputLines = input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    console.log(inputLines);

    try {
      for (const word of inputLines) {
        const response = await reverso.getContext(
          word,
          LANGUAGE_FROM,
          LANGUAGE_TO
        );

        if (!response.ok) {
          throw new Error((response as any).message);
        }

        for (const example of response.examples.slice(0, 3)) {
          await appendFileSync(
            "output.txt",
            example.source + "\n" + example.target + "\n\n",
            "utf-8"
          );
        }
      }

      await reverso.close();
    } catch (error: any) {
      console.error("Error:", error.message);
      await reverso.close();
      process.exit(1);
    }
  }

  const output = readFileSync("output.txt", "utf-8");

  const outputLines = output
    .split("\n\n") // Split by double newline (blank line separator)
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0) // Remove empty entries
    .map((pair) => {
      const [face, back] = pair.split("\n");
      return {
        face: face?.trim() || "",
        back: back?.trim() || "",
      };
    })
    .filter((card) => card.face && card.back); // Only keep valid pairs

  console.log("\nParsed output:");
  console.log(JSON.stringify(outputLines, null, 2));

  // Add cards to Anki
  const ankiConnectUrl = "http://localhost:8765";

  console.log("\nAdding cards to Anki...");
  let successCount = 0;
  let errorCount = 0;

  for (const card of outputLines) {
    const noteData = {
      action: "addNote",
      version: 6,
      params: {
        note: {
          deckName: DECK_NAME,
          modelName: "Basic",
          fields: {
            Front: card.face,
            Back: card.back,
          },
          tags: ["reverso", "auto-generated"],
        },
      },
    };

    try {
      const response = await fetch(ankiConnectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: any = await response.json();

      if (result.error) {
        console.error(`Error adding card: ${result.error}`);
        errorCount++;
      } else {
        successCount++;
        console.log(`✓ Added card ${successCount}/${outputLines.length}`);
      }
    } catch (error: any) {
      console.error(`Error connecting to AnkiConnect: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n✨ Done! Successfully added ${successCount} cards.`);
  if (errorCount > 0) {
    console.log(`⚠️  Failed to add ${errorCount} cards.`);
  }
})();
