const STEM_TERMS = {
  "newton's second law": ["newtons second law", "newton second law"],
  "photosynthesis": ["photo synthesis", "photosyn thesis"],
  "mitochondria": ["mito chondria", "mytochondria"],
  "derivative": ["the derivative", "derivitive"],
  "integral": ["intergral"],
  "eigenvalue": ["eigen value", "eigen-value"],
  "algorithm": ["algorhythm"],
  "quadratic equation": ["quadratic equasion"],
  "Ohm's law": ["ohms law", "ohm law"],
  "SQL": ["sequel"],
  "neural network": ["neuronal network"],
  "kinetic energy": ["kinetic enargy", "kinetic energee"],
  "gravitational force": ["gravitational forces"],
  "cell membrane": ["sell membrane"],
  "machine learning": ["machine-learning"],
  "artificial intelligence": ["artificial inteligence"],
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ detail: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ detail: 'Invalid JSON payload' }) };
  }

  const rawText = (body.text || '').replace(/\s+/g, ' ').trim();
  let processed = rawText;
  const changes = [];

  for (const [preferred, variants] of Object.entries(STEM_TERMS)) {
    for (const variant of variants) {
      const regex = new RegExp(escapeRegex(variant), 'gi');
      if (regex.test(processed)) {
        processed = processed.replace(regex, preferred);
        changes.push({ matched: variant, replacement: preferred });
      }
    }
  }

  processed = processed.replace(/\s+([,.;:!?])/g, '$1');
  processed = processed.replace(/([.!?])(?=[A-Za-z])/g, '$1 ');

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      original: rawText,
      caption: processed,
      subject: body.subject || 'general',
      changes,
      method: 'editable STEM lexicon (baseline)'
    })
  };
};
