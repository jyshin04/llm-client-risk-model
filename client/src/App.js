import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  RadioGroup,
  Radio,
  FormControlLabel,
  Slider,
  Autocomplete,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Star as StarIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import './App.css';
import interroomLogo from './interroom-logo.png';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const steps = ['Upload Resume', 'Additional Info'];
const locationSuggestions = [
  'New York, NY', 'San Francisco, CA', 'Los Angeles, CA', 'Seattle, WA',
  'Boston, MA', 'Austin, TX', 'Dallas, TX', 'Houston, TX', 'Chicago, IL', 'Remote'
];

function ScoreCircle({ value, threshold }) {
  // value: 0-100
  // threshold: e.g. 75
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circ - (pct / 100) * circ;
  const thresholdAngle = (threshold / 100) * 360;
  // Calculate dot position for threshold
  const angleRad = ((thresholdAngle - 90) * Math.PI) / 180;
  const dotX = size / 2 + radius * Math.cos(angleRad);
  const dotY = size / 2 + radius * Math.sin(angleRad);
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E0D7FF"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#score-gradient)"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,2,.6,1)' }}
      />
      <defs>
        <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#815EFF" />
          <stop offset="100%" stopColor="#6F77FF" />
        </linearGradient>
      </defs>
      {/* Threshold marker as a dot */}
      <circle cx={dotX} cy={dotY} r={8} fill="#7C3AED" stroke="#fff" strokeWidth={3} />
      {/* Score text */}
      <text x="50%" y="54%" textAnchor="middle" fontSize="2.1rem" fontWeight="800" fill="#18181B">{value}</text>
      <text x="50%" y="68%" textAnchor="middle" fontSize="1.2rem" fontWeight="600" fill="#7C3AED">/100</text>
    </svg>
  );
}

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    sex: '',
    desiredCompensation: 150000,
    locationsWillingToWork: [],
    visaSponsorshipRequired: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [visaError, setVisaError] = useState('');

  // Validation logic
  const validateStep = () => {
    if (activeStep === 0) {
      return !!resumeFile;
    }
    if (activeStep === 1) {
      return (
        formData.sex !== '' &&
        formData.desiredCompensation > 0 &&
        formData.locationsWillingToWork.length > 0 &&
        formData.visaSponsorshipRequired !== '' &&
        formData.visaSponsorshipRequired !== 'Yes'
      );
    }
    return true;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'visaSponsorshipRequired') {
      if (value === 'Yes') {
        setVisaError('InterRoom does not accept any candidates who require international visa for now.');
      } else {
        setVisaError('');
      }
    }
  };

  const handleSliderChange = (e, value) => {
    setFormData(prev => ({ ...prev, desiredCompensation: value }));
  };

  const handleLocationChange = (event, value) => {
    setFormData(prev => ({ ...prev, locationsWillingToWork: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setResumeFileName(file.name);
      setError('');
    } else {
      setError('Please upload a PDF file');
      setResumeFile(null);
      setResumeFileName('');
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
      setError('');
    } else {
      setError('Please complete all required fields.');
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) {
      setError('Please complete all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    const formDataToSend = new FormData();
    formDataToSend.append('resume', resumeFile);
    formDataToSend.append('sex', formData.sex);
    formDataToSend.append('desiredCompensation', formData.desiredCompensation);
    formDataToSend.append('locationsWillingToWork', formData.locationsWillingToWork.join(','));
    formDataToSend.append('visaSponsorshipRequired', formData.visaSponsorshipRequired);
    try {
      const response = await fetch('http://localhost:5050/api/analyze-resume', {
        method: 'POST',
        body: formDataToSend,
      });
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('Failed to parse server response. ' + (await response.text()));
      }
      if (!response.ok) {
        throw new Error(data.error ? `${data.error}: ${data.details || ''} ${data.rawResponse || ''}` : 'Failed to analyze resume');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing the resume');
      if (err.stack) {
        setError(prev => prev + '\n' + err.stack);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 16;
    // Add logo
    const img = new Image();
    img.src = interroomLogo;
    doc.addImage(img, 'PNG', 10, y, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('AI Resume Screener', 45, y + 12);
    y += 32;
    // Rating and score
    doc.setFontSize(16);
    doc.setTextColor(91, 33, 182);
    doc.text(`Result: ${result.recommendation}`, 10, y);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Score: ${result.total_score}/100`, 10, y + 10);
    y += 20;
    // Strengths and Concerns
    doc.setFontSize(13);
    doc.setTextColor(91, 33, 182);
    doc.text('Strengths:', 10, y);
    doc.setTextColor(107, 114, 128);
    doc.text('Areas of Concern:', 110, y);
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(91, 33, 182);
    result.pros.forEach((pro, i) => {
      doc.text(`- ${pro}`, 10, y + i * 6);
    });
    doc.setTextColor(107, 114, 128);
    result.cons.forEach((con, i) => {
      doc.text(`- ${con}`, 110, y + i * 6);
    });
    y += Math.max(result.pros.length, result.cons.length) * 6 + 8;
    // Feature table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.text('Extracted Features & Scores', 10, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Feature', 'Extracted Value', 'Score']],
      body: [
        ['Employment Status', result.extracted_fields.employment_status || '—', result.scoring.employment_status_score],
        ['Highest Education Level', result.extracted_fields.highest_education_level || '—', result.scoring.highest_education_level_score],
        ['Department', result.extracted_fields.department || '—', result.scoring.department_score],
        ['Current Job Title', result.extracted_fields.current_job_title || '—', result.scoring.current_job_title_score],
        ['Years of Experience', result.extracted_fields.years_of_experience || '—', result.scoring.years_of_experience_score],
        ['Current Company', result.extracted_fields.current_company && typeof result.extracted_fields.current_company === 'object' ? `${result.extracted_fields.current_company.name} (${result.extracted_fields.current_company.score}/6)` : (result.extracted_fields.current_company || '—'), result.scoring.current_company_score],
        ['Previous Companies', Array.isArray(result.extracted_fields.previous_companies) ? result.extracted_fields.previous_companies.map(c => `${c.name} (${c.score}/4)`).join(', ') : (result.extracted_fields.previous_companies || '—'), result.scoring.previous_companies_score],
        ['Current Location', result.extracted_fields.current_location && typeof result.extracted_fields.current_location === 'object' ? `${result.extracted_fields.current_location.name} (${result.extracted_fields.current_location.score}/5)` : (result.extracted_fields.current_location || '—'), result.scoring.current_location_score],
        ['Willing to Work In', Array.isArray(result.extracted_fields.willing_to_work_in) ? result.extracted_fields.willing_to_work_in.map(loc => `${loc.name} (${loc.score}/5)`).join(', ') : (result.extracted_fields.willing_to_work_in || '—'), result.scoring.willing_to_work_in_score],
        ['Sex', result.extracted_fields.sex || '—', result.scoring.sex_score],
      ],
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [91, 33, 182], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      margin: { left: 10, right: 10 },
      tableWidth: 190,
    });
    doc.save('resume-analysis.pdf');
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getRecommendationColor = (recommendation) => {
    return recommendation === 'Accept for Full-Service Bundle' ? 'success' : 'warning';
  };

  const renderScoreCard = (title, score, maxScore = 10) => (
    <Box sx={{ height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h4" color={getScoreColor(score)}>
          {score}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          /{maxScore}
        </Typography>
      </Box>
    </Box>
  );

  // Multi-step form content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box textAlign="center" sx={{ pb: 6 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 4, border: '2px dashed', borderColor: 'primary.main', fontSize: 18, mb: 4 }}
            >
              {resumeFileName ? resumeFileName : 'Drag & drop or click to upload Resume (PDF)'}
              <input
                type="file"
                hidden
                accept=".pdf"
                onChange={handleFileChange}
              />
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Only PDF files are accepted. Max size: 10MB.
            </Typography>
            <Box display="flex" justifyContent="flex-end" mt={6}>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                disabled={loading || !validateStep()}
                sx={{ minWidth: 120 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box component="div" sx={{ width: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
              Additional Info
            </Typography>
            <Box sx={{ mb: 4 }}>
              <FormControl component="fieldset" fullWidth sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Sex
                </Typography>
                <RadioGroup
                  row
                  name="sex"
                  value={formData.sex}
                  onChange={handleInputChange}
                >
                  <FormControlLabel value="Male" control={<Radio color="primary" />} label={<span style={{ fontWeight: 600 }}>Male</span>} />
                  <FormControlLabel value="Female" control={<Radio color="primary" />} label={<span style={{ fontWeight: 600 }}>Female</span>} />
                  <FormControlLabel value="Other" control={<Radio color="primary" />} label={<span style={{ fontWeight: 600 }}>Other</span>} />
                </RadioGroup>
              </FormControl>
              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom className="desired-comp-label" sx={{ fontWeight: 700 }}>Desired Compensation (USD)</Typography>
                <Slider
                  value={formData.desiredCompensation}
                  min={30000}
                  max={300000}
                  step={5000}
                  marks={[{ value: 100000, label: '100k' }, { value: 150000, label: '150k' }, { value: 200000, label: '200k' }]}
                  onChange={handleSliderChange}
                  valueLabelDisplay="on"
                  sx={{ mx: 2 }}
                />
              </Box>
              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
                  Locations Willing to Work
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Type a city, state, then press <b>Enter</b> to add it. Repeat for multiple locations. Example: <span style={{ color: '#815EFF', fontWeight: 600 }} >"San Diego, CA"</span>
                </Typography>
                <Autocomplete
                  multiple
                  options={locationSuggestions}
                  value={formData.locationsWillingToWork}
                  onChange={handleLocationChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="e.g. New York, NY, Remote, San Diego, CA"
                    />
                  )}
                  freeSolo
                />
              </Box>
              <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Visa Sponsorship Required?
                </Typography>
                <RadioGroup
                  row
                  name="visaSponsorshipRequired"
                  value={formData.visaSponsorshipRequired}
                  onChange={handleInputChange}
                >
                  <FormControlLabel
                    value="No"
                    control={<Radio color="primary" />}
                    label={<span style={{ fontWeight: 600 }}>No</span>}
                  />
                  <FormControlLabel
                    value="Yes"
                    control={<Radio color="primary" />}
                    label={<span style={{ fontWeight: 600 }}>Yes</span>}
                  />
                </RadioGroup>
                {visaError && (
                  <Alert severity="error" sx={{ mt: 2 }}>{visaError}</Alert>
                )}
              </FormControl>
            </Box>
            <Box display="flex" justifyContent="space-between" mt={4}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                disabled={loading}
                sx={{ minWidth: 120 }}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                endIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                disabled={loading || !validateStep()}
                sx={{ minWidth: 120 }}
              >
                {loading ? 'Analyzing...' : 'Analyze Resume'}
              </Button>
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box className="header-logo-only">
        <img src={interroomLogo} alt="InterRoom Logo" style={{ height: 48 }} />
      </Box>
      <div className="main-content">
        <Typography variant="h3" component="h1" gutterBottom align="center" color="primary" sx={{ fontWeight: 800 }}>
          InterRoom AI Resume Screener
        </Typography>
        <Typography variant="h6" gutterBottom align="center" color="text.secondary" sx={{ mb: 4, fontWeight: 600 }}>
          Full-Service Bundle Evaluation
        </Typography>
        {!result ? (
          <Paper elevation={3} sx={{ p: 4 }}>
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            <form onSubmit={handleSubmit}>
              {getStepContent(activeStep)}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
              )}
            </form>
          </Paper>
        ) : (
          <Box>
            {/* Results Header: Circular bar (left) + recommendation (right) */}
            <Box className="results-header-row">
              <div className="score-circle-outer">
                <ScoreCircle value={result.total_score} threshold={75} />
              </div>
              <div className="recommendation-badge-outer">
                <div className="recommendation-pill">
                  <div className="rec-title">{result.recommendation}</div>
                  <div className="rec-desc">
                    {result.total_score >= 75
                      ? `This client scored ${result.total_score - 75} points above the threshold (75) and is recommended for the bundle.`
                      : `This client scored ${75 - result.total_score} points below the threshold (75) and is not recommended for the bundle.`}
                  </div>
                </div>
              </div>
            </Box>
            {/* Strengths/Concerns highlight logic */}
            <div className="strengths-cons-row">
              <div className={result.recommendation === 'Accept for Full-Service Bundle' ? 'strengths-col' : 'cons-col'}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Strengths
                </Typography>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {result.pros.map((pro, idx) => (
                    <li key={idx}>{pro}</li>
                  ))}
                </ul>
              </div>
              <div className={result.recommendation === 'Accept for Full-Service Bundle' ? 'cons-col' : 'strengths-col'}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Areas of Concern
                </Typography>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {result.cons.map((con, idx) => (
                    <li key={idx}>{con}</li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Merged Extracted Info and Score Table */}
            <table className="feature-score-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Extracted Value</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Employment Status', value: result.extracted_fields.employment_status, score: result.scoring.employment_status_score, max: 10 },
                  { label: 'Highest Education Level', value: result.extracted_fields.highest_education_level, score: result.scoring.highest_education_level_score, max: 10 },
                  { label: 'Department', value: result.extracted_fields.department, score: result.scoring.department_score, max: 10 },
                  { label: 'Current Job Title', value: result.extracted_fields.current_job_title, score: result.scoring.current_job_title_score, max: 10 },
                  { label: 'Years of Experience', value: result.extracted_fields.years_of_experience, score: result.scoring.years_of_experience_score, max: 10 },
                  { label: 'Current Company', value: result.extracted_fields.current_company && typeof result.extracted_fields.current_company === 'object' ? `${result.extracted_fields.current_company.name} (${result.extracted_fields.current_company.score}/6)` : (result.extracted_fields.current_company || '—'), score: result.scoring.current_company_score, max: 6 },
                  { label: 'Previous Companies', value: Array.isArray(result.extracted_fields.previous_companies) ? result.extracted_fields.previous_companies.map(c => `${c.name} (${c.score}/4)`).join(', ') : (result.extracted_fields.previous_companies || '—'), score: result.scoring.previous_companies_score, max: 4 },
                  { label: 'Current Location', value: result.extracted_fields.current_location && typeof result.extracted_fields.current_location === 'object' ? `${result.extracted_fields.current_location.name} (${result.extracted_fields.current_location.score}/5)` : (result.extracted_fields.current_location || '—'), score: result.scoring.current_location_score, max: 5 },
                  { label: 'Willing to Work In', value: Array.isArray(result.extracted_fields.willing_to_work_in) ? result.extracted_fields.willing_to_work_in.map(loc => `${loc.name} (${loc.score}/5)`).join(', ') : (result.extracted_fields.willing_to_work_in || '—'), score: result.scoring.willing_to_work_in_score, max: 5 },
                  { label: 'Sex', value: result.extracted_fields.sex || '—', score: result.scoring.sex_score, max: 10 },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.label}</td>
                    <td>{row.value || '—'}</td>
                    <td>{row.score !== undefined ? `${row.score}/${row.max}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total Score</td>
                  <td>{result.total_score}/100</td>
                </tr>
              </tfoot>
            </table>
            {/* Bottom Buttons */}
            <div className="bottom-buttons">
              <Button
                variant="outlined"
                onClick={() => {
                  setResult(null);
                  setFormData({
                    sex: '',
                    desiredCompensation: 150000,
                    locationsWillingToWork: [],
                    visaSponsorshipRequired: '',
                  });
                  setResumeFile(null);
                  setResumeFileName('');
                  setError('');
                  setActiveStep(0);
                }}
                sx={{ minWidth: 180, fontWeight: 700 }}
              >
                Analyze Another Resume
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportPDF}
                sx={{ minWidth: 180, fontWeight: 700 }}
              >
                Export as PDF
              </Button>
            </div>
          </Box>
        )}
    </div>
    </Container>
  );
}

export default App;
