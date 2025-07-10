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

// Main endpoint for resume analysis
app.post('/api/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const { sex, desiredCompensation, locationsWillingToWork, visaSponsorshipRequired } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Parse PDF to text
    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    const resumeText = pdfData.text;

    // Construct the prompt
    const prompt = `You are an advanced AI resume screener for a career coaching company. Your job is to evaluate each candidate for acceptance into our Full-Service Bundle program using a structured scoring system, with all output in strict JSON format.

INPUT FIELDS
The following information will be provided for each candidate:

Resume: ${resumeText}

Sex: ${sex}

Desired compensation (annual, USD): ${desiredCompensation}

Willing to work in (cities/regions): ${locationsWillingToWork}

Visa sponsorship required: ${visaSponsorshipRequired}

All other fields (employment status, education, department, job title, years of experience, companies, current location) must be extracted directly from the resume text. Do NOT assume these fields are provided.

YOUR TASKS:

Extract the following fields from the resume:

Employment Status: "Employed" if the most recent position's end date is "present", "now", or similar (e.g., "2022–Present"); "Unemployed" if all positions have explicit end dates.

Highest Education Level: None, Associate, Bachelor, Master, PhD (select the highest found).

Department: Infer based on current or most recent job title/description. Use ONLY one of the following departments:

Engineering
Product Management
Sales
Customer Success
Marketing
Design
Data Science / Analytics
Operations
Finance
Customer Support

Current (Most Recent) Job Title: Extract the title of the most recent position.

Years of Experience: If possible, extract directly from the resume summary. Otherwise, calculate as the number of years between the earliest listed job's start date and the most recent job's end date or "present".

Current Company: Name of the company associated with the most recent position.

Previous Companies: List ALL previous companies in work history (not just well-known). For each, include the company name and a score (see below).

Current Location: Extract the candidate's current city/region from the resume, if possible.

If a feature cannot be found, record its value as null and add a note in the output.

Score Each Field (total possible = 100):

Field | Score Range | Criteria
Employment Status | 0 or 10 | Employed = 10; Unemployed = 6
Highest Education Level | 0 or 10 | None/Associate = 0; Bachelor/Master/PhD = 10
Department | 0, 6, or 10 | High-supply (Sales, Customer Success, Engineering, Data Science/Analytics) = 10; Product Management, Marketing, Design = 6; Operations, Finance, Customer Support = 0
Current Job Title | 0, 4, or 10 | Senior leadership (VP, Chief, Head, Founder, Project/Program Manager, Operations Manager) = 0; Supervisor/Lead = 4; Standard/IC roles = 10
Years of Experience | 0, 2, or 10 | 3–15 years = 10; 0–2 years = 2; 16+ years = 0; <0 = 0
Current Company Score | 0–6 | Research the company name. Consider company size (number of employees), fame, and recruiter reputation. Score 0–6 and show the score next to the company name. (E.g., Google = 6, regional company = 2, unknown = 0)
Previous Companies Score | 0–4 | For each previous company, research and score 0–4 (based on size, fame, recruiter reputation). Show the score next to each company. (E.g., Amazon = 4, regional = 1, unknown = 0). Make the final score be the maximum of the scores of all previous companies.
Visa Sponsorship Required | 0 or 10 | Yes = 0; No = 10
Desired Compensation | 0, 8, or 10 | <100k = 0; 100–150k = 8; >150k = 10, higher desired compensation is better. 
Current Location Score | 1–5 | Evaluate the job opportunity in the candidate's current city/region (1–5). 
Willing to Work In Score | 1–5 | For each city/region the candidate is willing to work in, evaluate job opportunity (1–5). Sum the scores for all cities/regions, but if the total exceeds 5, cap the total at 5. Show the score for each city/region. (E.g., willing to work in NYC, SF, and LA = high score; only remote or small cities = lower score; total cannot exceed 5)
Sex | 8 or 10 | Female/Other = 10; Male = 8

Maximum possible score: 100

IMPORTANT: The value of total_score must be the sum of all the individual field scores in the scoring object. Do not add or subtract anything else. Only sum the values in the scoring object.


Missing Data Handling:
For any feature that is missing, set its value as null, score as 0, and add its name to a "missing_fields" array.

Pros and Cons:
List the top strengths as bullet points in "pros".
The "pros" should NOT include information about sex being female. 
List key weaknesses as bullet points in "cons".
The "cons" should NOT include information about sex being male or pervious/current companies not being well known. 
If there are no "pros" or "cons" to write about directly from the features that scored low, leave them empty. 


Final Recommendation:
"Accept for Full-Service Bundle" if the total score is 75 or higher and no critical fields are missing (employment status, education, department, job title, years of experience, current company).
"Recommend Individual Services Only" if the score is less than 75 or any of the above critical fields are missing.

Output the following JSON structure:
{
  "extracted_fields": {
    "employment_status": "...",
    "highest_education_level": "...",
    "department": "...",
    "current_job_title": "...",
    "years_of_experience": ...,
    "current_company": { "name": "...", "score": ... },
    "previous_companies": [ { "name": "...", "score": ... }, ... ],
    "visa_sponsorship_required": "...",
    "sex": "...",
    "desired_compensation": ...,
    "current_location": { "name": "...", "score": ... },
    "willing_to_work_in": [ { "name": "...", "score": ... }, ... ]
  },
  "scoring": {
    "employment_status_score": ...,
    "highest_education_level_score": ...,
    "department_score": ...,
    "current_job_title_score": ...,
    "years_of_experience_score": ...,
    "current_company_score": ...,
    "previous_companies_score": ...,
    "visa_sponsorship_score": ...,
    "desired_compensation_score": ...,
    "current_location_score": ...,
    "willing_to_work_in_score": ...,
    "sex_score": ...
  },
  "missing_fields": [ /* List any field(s) that could not be extracted */ ],
  "pros": [ /* Bullet points of top strengths */ ],
  "cons": [ /* Bullet points of key weaknesses */ ],
  "total_score": ...,
  "recommendation": "Accept for Full-Service Bundle" | "Recommend Individual Services Only",
  "explanation": "Concise summary of the decision, highlighting the main factors."
}

Special instructions:

- Always extract fields from the resume unless provided as explicit input.
- Be consistent and follow scoring rules exactly.
- For company recognition, state the company name and score in the output.
- For missing/ambiguous fields, add them to the "missing_fields" array.
- For multiple locations, score each and show all in the output. The total 'Willing to Work In' score must not exceed 10, even if the sum of individual city/region scores is higher.
- If a feature can't be found, set its value as null and its score as 0.
- Respond ONLY in the JSON format as described above.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a resume screening AI that outputs only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
    });

    const response = completion.choices[0].message.content;
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON:', error);
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        rawResponse: response 
      });
    }

    res.json(parsedResponse);

  } catch (error) {
    console.error('Error processing resume:', error);
    res.status(500).json({ 
      error: 'Failed to process resume',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 