# Final-year project implementation notes

## Alignment with the proposed project
This MVP implements the meeting interface, speech captioning baseline, STEM term normalization, personalized caption display controls, and student-to-teacher text/drawing communication.

## Current baseline vs future research work
- Speech recognition: browser Web Speech API. A later experiment can compare Whisper/faster-whisper on a curated STEM audio set.
- Context handling: transparent dictionary corrections. This is a baseline to compare with a transformer or retrieval-augmented STEM glossary.
- Personalization: caption font size and high-contrast setting are local UI preferences.
- Student communication: text chat and drawing canvas are implemented. The sign bridge UI supports camera preview and manual gloss delivery for testing; automatic sign recognition and teacher-to-student sign output remain future modules requiring a scoped language, dataset, and model.
- Video: LiveKit Cloud manages room media. The browser app requests a backend-issued JWT.

## Suggested experiments
1. Build a benchmark of at least 100 STEM utterances with reference transcripts.
2. Compare raw and context-processed transcript WER/CER.
3. Measure caption latency from final browser transcript to display.
4. Evaluate technical-term accuracy on a predefined glossary.
5. Ask volunteer users to rate readability, contrast, and ease of asking questions, with consent and an approved process.
6. Report measured results, limitations, and browser/device conditions. Do not invent accuracy improvements.
