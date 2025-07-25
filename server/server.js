const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper for OpenAI field extraction
async function extractField(openai, field, resumeText) {
  const prompts = {
    full_name: `Return the candidate's full name from the following resume text. Return only the name or null if not found.\n\nResume:\n${resumeText}`,
    employment_status: `Is the candidate currently employed? If the most recent position's end date is "present" (e.g. 2022-Present), the person is "Employed". Otherwise, "Unemployed". Return only "Employed", "Unemployed", or null.\n\nResume:\n${resumeText}`,
    highest_education_level: `Return the highest education level (None, Associate, Bachelor, Master, PhD) from the following resume text. Return only the value or null.\n\nResume:\n${resumeText}`,
    current_job_title: `Return the most recent job title from the following resume text. Return only the title or null.\n\nResume:\n${resumeText}`,
    years_of_experience: `What is the candidate's total years of professional experience? If possible, extract directly from the resume summary. Otherwise, calculate as the number of years between the earliest listed job's start date and the most recent job's end date or "present".Return only a number or null.\n\nResume:\n${resumeText}`,
    current_company: `Return the name of the most recent company from the resume. Return only the name or null.\n\nResume:\n${resumeText}`,
    previous_companies: `Return the list of all companies (excluding the most recent company) that this person worked at. Return as a JSON array of strings (company names) or [] if no previous companies are found.\n\nResume:\n${resumeText}`,
    current_location: `Return the candidate's current city/region from the resume. Return only the location or null.\n\nResume:\n${resumeText}`
  };
  const prompt = prompts[field];
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: 0.0,
    max_tokens: 100
  });
  return completion.choices[0].message.content.trim();
}

// Main endpoint for resume analysis
app.post('/api/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const { desiredCompensation, locationsWillingToWork, visaSponsorshipRequired } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    // Parse PDF to text
    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    const resumeText = pdfData.text;

    // --- Extraction Phase ---
    const extractionFields = [
      "full_name", "employment_status", "highest_education_level", "current_job_title", "years_of_experience", "current_company", "previous_companies", "current_location"
    ];
    const extracted = {};
    for (const field of extractionFields) {
      console.log(`[Extraction] Extracting field: ${field}`);
      let value;
      try {
        value = await extractField(openai, field, resumeText);
        console.log(`[Extraction] ${field}:`, value);
      } catch (err) {
        console.error(`[Extraction][ERROR] Failed to extract ${field}:`, err);
        value = null;
      }
      if (field === "years_of_experience") {
        value = value && !isNaN(Number(value)) ? Number(value) : null;
      }
      if (field === "previous_companies") {
        try { value = JSON.parse(value); } catch { value = []; }
      }
      extracted[field] = value === "null" ? null : value;
    }
    // Add user input fields
    extracted["desired_compensation"] = desiredCompensation ? Number(desiredCompensation) : null;
    extracted["willing_to_work_in"] = locationsWillingToWork ? locationsWillingToWork.split(",").map(s => s.trim()).filter(Boolean) : [];
    extracted["visa_sponsorship_required"] = visaSponsorshipRequired || null;

    // --- Scoring Phase: deterministic fields ---
    function scoreEmploymentStatus(status) {
      console.log(`[EmploymentStatus] Scoring employment status: ${status}`);
      if (!status) return 0;
      if (status === "Employed") return 10;
      if (status === "Unemployed") return 6;
      return 0;
    }
    function scoreEducation(level) {
      console.log(`[Education] Scoring education level: ${level}`);
      if (!level) return 0;
      if (typeof level === 'string') {
        const lc = level.toLowerCase();
        if (lc.includes('phd') || lc.includes('doctor')) return 10;
        if (lc.includes('master')) return 10;
        if (lc.includes('bachelor')) return 9;
      }
      return 0;
    }

    async function scoreJobTitle(title) {
  if (!title) return 0;
  console.log(`[JobTitle] Scoring job title: ${title}`);
  const prompt = `You are an expert HR classifier. Given a job title, classify it as HIGH, MID, or LOW based on these rules:\n\nHIGH =\n- Customer Success Manager / Account Manager\n- Analytics\n- Product Manager\n- Software Engineer\n- Account Executive\n- Sales Development Representative\n- Business Development Representative\n- Sales Engineer\n- Solutions Engineer\n- Product Design\n- Data Science\n- Product Marketing\n\nMID =\n- Project Manager\n- Program Manager\n- Business Operations\n- Strategy\n- IT\n- Sales Manager\n- Sales Enablement\n- Sales or Rev Ops\n- UX Design or any other design\n- Finance\n- Security\n- Customer Support\n- Accounting\n- People Operations\n- Product Ops\n- Business Analyst\n- HR\n- Partnerships\n- Professional Services\n- Any other Marketing aside from Product Marketing\n\nLOW =\n-Director and above (Director, VP, Chief etc.)\n\nClassify the following job title. If you are unsure, use your best judgment based on the above lists. Return only one of: HIGH, MID, or LOW.\n\nJob Title: ${title}`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8,
      temperature: 0.0
    });
    let classification = completion.choices[0].message.content;
    console.log(`[JobTitle] Result for ${title}: ${classification}`);
    if (typeof classification === 'object') {
      // Defensive: handle rare OpenAI bugs
      classification = String(classification);
    }
    classification = String(classification).trim().toUpperCase();
    if (classification === "HIGH") return 10;
    if (classification === "MID") return 5;
    if (classification === "LOW") return 0;
    // Defensive: fallback for unexpected output
    return 0;
  } catch (e) {
    console.error("[JobTitleScore][ERROR] Failed to score job title", e);
    return 0;
  }
}

    function scoreYoE(yoe) {
      console.log(`[YoE] Scoring years of experience: ${yoe}`);
      if (yoe == null) return 0;
      if (yoe >= 3 && yoe <= 15) return 10;
      if (yoe >= 0 && yoe <= 2) return 2;
      if (yoe > 15) return 0;
      return 0;
    }
    function scoreVisa(val) {
      console.log(`[Visa] Scoring visa sponsorship: ${val}`);
      if (!val) return 0;
      if (val === "No") return 10;
      if (val === "Yes") return 0;
      return 0;
    }
    function scoreComp(val) {
      console.log(`[Comp] Scoring compensation: ${val}`);
      if (val == null) return 0;
      if (val < 100000) return 0;
      if (val <= 140000) return 8;
      if (val > 140000) return 10;
      return 0;
    }
    // --- Company/Location scoring via OpenAI ---
    async function scoreCurrentCompany(name) {
      if (!name) return { name: null, score: 0 };
      console.log(`[CompanyScore] Scoring current company: ${name}`);
      const prompt = `Score the company "${name}" from 0-6 based on size, fame, and recruiter reputation. Return only a JSON: {\"name\": \"${name}\", \"score\": <number>}`;
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.0,
          max_tokens: 50
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        console.log(`[CompanyScore] Result for ${name}:`, parsed);
        return parsed;
      } catch (err) {
        console.error(`[CompanyScore][ERROR] Failed to score company ${name}:`, err);
        return { name, score: 0 };
      }
    }
    async function scorePreviousCompanies(names) {
      if (!Array.isArray(names) || names.length === 0) return [];
      const scores = [];
      for (const name of names) {
        console.log(`[PrevCompaniesScore] Scoring previous company: ${name}`);
        const prompt = `Score the company "${name}" from 0-4 based on size, fame, and recruiter reputation. Return only a JSON: {\"name\": \"${name}\", \"score\": <number>}`;
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: 0.0,
            max_tokens: 50
          });
          const raw = completion.choices[0].message.content;
          console.log(`[PrevCompaniesScore][RAW OUTPUT]`, raw);
          let cleaned = raw
            .replace(/^\s*```json\s*/i, '')
            .replace(/^\s*```\s*/i, '')
            .replace(/```\s*$/i, '')
            .replace(/^`+|`+$/g, '')
            .trim();
          if (!cleaned || cleaned.length < 5) throw new Error("Empty or too short previous company score output from OpenAI");
          const parsed = JSON.parse(cleaned);
          console.log(`[PrevCompaniesScore] Result for ${name}:`, parsed);
          scores.push(parsed);
        } catch (err) {
          console.error(`[PrevCompaniesScore][ERROR] Failed to score previous company ${name}:`, err);
          scores.push({ name, score: 0 });
        }
      }
      return scores;
    }
    async function scoreCurrentLocation(loc) {
      if (!loc) return { name: null, score: 0 };
      console.log(`[LocationScore] Scoring current location: ${loc}`);
      const prompt = `Score the city/region "${loc}" from 1-5 for job opportunity (5=best, 1=worst). Only give 5 to New York or San Francisco. Return only a JSON: {\"name\": \"${loc}\", \"score\": <number>}`;
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.0,
          max_tokens: 50
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        console.log(`[LocationScore] Result for ${loc}:`, parsed);
        return parsed;
      } catch (err) {
        console.error(`[LocationScore][ERROR] Failed to score location ${loc}:`, err);
        return { name: loc, score: 1 };
      }
    }
    async function scoreWillingToWorkIn(locs) {
      if (!Array.isArray(locs) || locs.length === 0) return [];
      const scores = [];
      for (const loc of locs) {
        console.log(`[WillingToWorkInScore] Scoring willing location: ${loc}`);
        const prompt = `Score the city/region "${loc}" from 1-5 for job opportunity (5=best, 1=worst). Only give 5 to New York or San Francisco. Return only a JSON: {\"name\": \"${loc}\", \"score\": <number>}`;
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: 0.0,
            max_tokens: 50
          });
          const parsed = JSON.parse(completion.choices[0].message.content);
          console.log(`[WillingToWorkInScore] Result for ${loc}:`, parsed);
          scores.push(parsed);
        } catch (err) {
          console.error(`[WillingLocationScore][ERROR] Failed to score willing location ${loc}:`, err);
          scores.push({ name: loc, score: 1 });
        }
      }
      return scores;
    }

    // --- Run all company/location scoring ---
    const currentCompany = await scoreCurrentCompany(extracted.current_company);
    const previousCompanies = await scorePreviousCompanies(extracted.previous_companies);
    const currentLocation = await scoreCurrentLocation(extracted.current_location);
    const willingToWorkIn = await scoreWillingToWorkIn(extracted.willing_to_work_in);

    // --- Aggregate scoring ---
    const scoring = {
      employment_status_score: scoreEmploymentStatus(extracted.employment_status),
      highest_education_level_score: scoreEducation(extracted.highest_education_level),
      current_job_title_score: await scoreJobTitle(extracted.current_job_title),
      years_of_experience_score: scoreYoE(extracted.years_of_experience),
      current_company_score: currentCompany.score,
      previous_companies_score: previousCompanies.length ? Math.min(4, Math.max(...previousCompanies.map(c => c.score))) : 0,
      visa_sponsorship_score: scoreVisa(extracted.visa_sponsorship_required),
      desired_compensation_score: scoreComp(extracted.desired_compensation),
      current_location_score: currentLocation.score,
      willing_to_work_in_score: willingToWorkIn.length ? Math.min(5, Math.max(...willingToWorkIn.map(loc => typeof loc.score === 'number' ? loc.score : 0))) : 0,
    };
    // --- Total score and missing fields ---
    const totalScore = Object.values(scoring).reduce((a, b) => a + b, 0);
    const missingFields = Object.entries(extracted).filter(([k, v]) => v === null || (Array.isArray(v) && v.length === 0)).map(([k]) => k);

    // --- Final OpenAI call for pros/cons/recommendation/explanation ---
    const summaryPrompt = `Given the following extracted fields and scores, return a JSON object with four keys: "pros" (array of strings, less than 4), "cons" (array of strings, less than 4), "recommendation" (string: \"Accept\" or \"Reject\"), and "explanation" (string, 2 sentences). Return ONLY valid JSON. Do NOT include any markdown, code block, backticks, or explanation. The response must be a single valid JSON object and nothing else. Extracted: ${JSON.stringify(extracted)} Scores: ${JSON.stringify(scoring)} Total Score: ${totalScore} Missing Fields: ${JSON.stringify(missingFields)}`;
    let summary = { pros: [], cons: [], recommendation: "Reject", explanation: "No summary generated." };
    try {
      console.log(`[Summary] Generating summary and recommendation...`);
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "user", content: summaryPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      });
      const raw = completion.choices[0].message.content;
      console.log("[Summary][RAW OUTPUT]", raw);
      // Defensive: Remove code block markers/backticks and trim
      let cleaned = raw
        .replace(/^\s*```json\s*/i, '')
        .replace(/^\s*```\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/^`+|`+$/g, '')
        .trim();
      if (!cleaned || cleaned.length < 5) throw new Error("Empty or too short summary output from OpenAI");
      summary = JSON.parse(cleaned);
      console.log(`[Summary] Summary result:`, summary);
    } catch (e) {
      console.error(`[Summary][ERROR] Failed to generate summary:`, e);
      summary.explanation = "Failed to generate summary: " + (e.message || "unknown error");
    }

    res.json({
      extracted_fields: {
        ...extracted,
        current_company: currentCompany,
        previous_companies: previousCompanies,
        current_location: currentLocation,
        willing_to_work_in: willingToWorkIn
      },
      scoring,
      total_score: totalScore,
      missing_fields: missingFields,
      summary
    });
  } catch (error) {
    console.error('Error processing resume:', error);
    res.status(500).json({ error: 'Failed to process resume', details: error.message });
  }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 