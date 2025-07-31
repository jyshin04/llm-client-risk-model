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
// Import jsPDF
import { jsPDF } from 'jspdf';

// We'll create a simple table without jspdf-autotable
// since there seems to be an issue with the plugin

const steps = ['Upload Resume', 'Additional Info'];
const locationSuggestions = [
  'New York, NY', 'San Francisco, CA', 'Los Angeles, CA', 'Seattle, WA',
  'Boston, MA', 'Austin, TX', 'Dallas, TX', 'Houston, TX', 'Chicago, IL', 'Remote'
];

function ScoreCircle({ value, threshold = 65 }) {
  // value: 0-80
  // threshold: e.g. 65
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  // Cap score at 80
  const cappedValue = Math.max(0, Math.min(80, value));
  const pct = (cappedValue / 80) * 100;
  const offset = circ - (pct / 100) * circ;
  const thresholdAngle = (threshold / 80) * 360;
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
      <text x="50%" y="54%" textAnchor="middle" fontSize="2.1rem" fontWeight="800" fill="#18181B">{Math.max(0, Math.min(80, value))}</text>
      <text x="50%" y="68%" textAnchor="middle" fontSize="1.2rem" fontWeight="600" fill="#7C3AED">/80</text>
    </svg>
  );
}

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
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
    
    formDataToSend.append('desiredCompensation', formData.desiredCompensation);
    formDataToSend.append('locationsWillingToWork', formData.locationsWillingToWork.join(','));
    formDataToSend.append('visaSponsorshipRequired', formData.visaSponsorshipRequired);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050';
      const response = await fetch(`${API_URL}/api/analyze-resume`, {
        method: 'POST',
        body: formDataToSend,
      });
      let data;
      let rawResponse = await response.text();
      console.log('--- Raw server response ---');
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.log('Raw body:', rawResponse);
      console.log('--- End of raw response ---');
      
      try {
        data = JSON.parse(rawResponse);
        console.log('Parsed JSON data:', data);
      } catch (jsonErr) {
        console.error('Failed to parse JSON:', jsonErr);
        throw new Error('Failed to parse server response. ' + rawResponse);
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
    try {
      if (!result) {
        console.error('No result data available for PDF export');
        return;
      }

      const doc = new jsPDF();
      let y = 16;
      
      // Add logo
      try {
        const img = new Image();
        img.src = interroomLogo;
        doc.addImage(img, 'PNG', 10, y, 28, 28);
      } catch (e) {
        console.warn('Failed to add logo to PDF:', e);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('AI Resume Screener', 45, y + 12);
      y += 32;
      
      // Safely access result properties with fallbacks
      const extractedFields = result.extracted_fields || {};
      const scoring = result.scoring || {};
      
      // Add more vertical spacing after logo
      y += 15;
      
      // Add applicant name with nice styling
      const fullName = result.extracted_fields?.full_name || 'Applicant';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(91, 33, 182);
      doc.text(fullName, 10, y);
      y += 12;
      
      // Add a subtle divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(10, y, 200, y);
      y += 15;
      
      // Add result description with conditional message
      const score = result.total_score || 0;
      const threshold = 65;
      const difference = score - threshold;
      let resultText = '';
      
      if (difference > 0) {
        resultText = `This client scored ${difference} point${difference === 1 ? '' : 's'} above the threshold (${threshold}) and is recommended for the bundle.`;
      } else if (difference < 0) {
        resultText = `This client scored ${Math.abs(difference)} point${difference === -1 ? '' : 's'} below the threshold (${threshold}) and is not recommended for the bundle.`;
      } else {
        resultText = `This client scored exactly at the threshold (${threshold}).`;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Split text into multiple lines if needed
      const splitText = doc.splitTextToSize(resultText, 190);
      doc.text(splitText, 10, y);
      y += splitText.length * 6 + 15;
      
      // Add total score with better styling
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(91, 33, 182);
      doc.text('Total Score', 10, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(`${score}/80`, 100, y);
      y += 25;
      
      // Add section header with more spacing
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(91, 33, 182);
      doc.text('Candidate Details', 10, y);
      y += 10;
      
      // Add a subtle divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(10, y, 200, y);
      y += 15;
      
      // Helper function to safely format company data
      const formatCompany = (company) => {
        if (!company) return '—';
        if (typeof company === 'object' && company !== null) {
          return `${company.name || 'N/A'} (${company.score || 'N/A'}/6)`;
        }
        return String(company);
      };
      
      // Helper function to safely format location data
      const formatLocation = (location) => {
        if (!location) return '—';
        if (Array.isArray(location)) {
          return location.map(loc => 
            loc && typeof loc === 'object' 
              ? `${loc.name || 'N/A'} (${loc.score || 'N/A'}/5)`
              : String(loc)
          ).filter(Boolean).join(', ') || '—';
        }
        if (typeof location === 'object') {
          return `${location.name || 'N/A'} (${location.score || 'N/A'}/5)`;
        }
        return String(location);
      };
      
      // Helper function to safely format compensation
      const formatCompensation = (amount) => {
        if (amount === undefined || amount === null) return '—';
        try {
          return `$${parseInt(amount).toLocaleString()}`;
        } catch (e) {
          return String(amount);
        }
      };
      
      // Create table data with safe property access
      const tableData = [
        ['Employment Status', extractedFields.employment_status || '—', scoring.employment_status_score || '—'],
        ['Highest Education Level', extractedFields.highest_education_level || '—', scoring.highest_education_level_score || '—'],
        ['Current Job Title', extractedFields.current_job_title || '—', scoring.current_job_title_score || '—'],
        ['Years of Experience', extractedFields.years_of_experience || '—', scoring.years_of_experience_score || '—'],
        ['Current Company', formatCompany(extractedFields.current_company), scoring.current_company_score || '—'],
        ['Previous Companies', formatLocation(extractedFields.previous_companies), scoring.previous_companies_score || '—'],
        ['Visa Sponsorship Required', extractedFields.visa_sponsorship_required || '—', scoring.visa_sponsorship_score || '—'],
        ['Desired Compensation', formatCompensation(extractedFields.desired_compensation), scoring.desired_compensation_score || '—'],
        ['Current Location', formatLocation(extractedFields.current_location), scoring.current_location_score || '—'],
        ['Willing to Work In', formatLocation(extractedFields.willing_to_work_in), scoring.willing_to_work_in_score || '—'],
      ];
      
      // Draw table header with better styling
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(70, 30, 150);  // Slightly darker purple for better contrast
      
      // Draw header with padding and rounded corners effect
      const headerHeight = 12;
      doc.roundedRect(10, y - 2, 190, headerHeight, 2, 2, 'F');
      
      // Add text with better spacing
      doc.text('FEATURE', 15, y + 7);
      doc.text('EXTRACTED VALUE', 80, y + 7);
      doc.text('SCORE', 180, y + 7, { align: 'right' });
      
      // Add subtle shadow/divider
      doc.setFillColor(220, 220, 220);
      doc.rect(10, y + headerHeight - 1, 190, 1, 'F');
      
      y += headerHeight + 5;  // Add more space after header
      
      // Draw table rows with better styling
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const rowHeight = 12;  // Slightly taller rows for better readability
      const rowPadding = 6;  // Padding on top of text
      const col1X = 15;
      const col2X = 80;
      const col3X = 170;
      const maxWidth = 180;
      
      tableData.forEach((row, index) => {
        // Check if we need a new page (leave room for at least 2 rows)
        if (y > 250) {
          doc.addPage();
          y = 30;
        }
        
        // Calculate row height based on content (in case of text wrapping)
        const textLines = doc.splitTextToSize(String(row[1] || '—'), maxWidth - col2X + col1X);
        const rowContentHeight = Math.max(rowHeight, textLines.length * 5 + 2);
        
        // Alternate row colors with better contrast
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 255);  // Very light blue
        } else {
          doc.setFillColor(255, 255, 255);  // White
        }
        
        // Draw row background
        doc.rect(10, y - rowPadding/2, 190, rowContentHeight + rowPadding/2, 'F');
        
        // Draw row content with better typography
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(70, 30, 150);  // Dark purple for labels
        doc.text(row[0], col1X, y + 2);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);  // Dark gray for values
        
        // Handle multi-line text for the value column
        doc.text(textLines, col2X, y + 2);
        
        // Draw score with a subtle background
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(col3X - 15, y - 2, 30, rowContentHeight - 2, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(70, 30, 150);
        doc.text(String(row[2] || '—'), col3X, y + 2, { align: 'center' });
        
        // Add subtle bottom border
        doc.setDrawColor(230, 230, 230);
        doc.line(10, y + rowContentHeight + rowPadding/2 - 1, 200, y + rowContentHeight + rowPadding/2 - 1);
        
        y += rowContentHeight + rowPadding/2;
      });
      
      // Add page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10
        );
      }
      
      // Save the PDF
      doc.save(`resume-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 65) return 'success';
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
          <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, background: '#fff', mt: 2, mb: 4 }}>
            {/* Candidate Name and Resume View Button - Centered */}
            <Box display="flex" alignItems="center" justifyContent="center" sx={{ mb: 3, gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', textAlign: 'center' }}>
                {result.extracted_fields.full_name ? result.extracted_fields.full_name : 'Candidate Name Not Found'}
              </Typography>
              {resumeFile && (
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => {
                    const fileURL = URL.createObjectURL(resumeFile);
                    window.open(fileURL, '_blank', 'noopener,noreferrer');
                  }}
                  sx={{ ml: 2, fontWeight: 700, borderColor: 'primary.main', color: 'primary.main', minWidth: 170 }}
                >
                  View Resume PDF
                </Button>
              )}
            </Box>
            {/* Results Header: Circular bar (left) + recommendation (right) */}
            <Box className="results-header-row">
              <div className="score-circle-outer">
                <ScoreCircle value={result.total_score} threshold={65} />
              </div>
              <div className="recommendation-badge-outer">
                <div className="recommendation-pill">
                  <div className="rec-title">{result.recommendation}</div>
                  <div className="rec-desc">
                    {result.total_score >= 65
                      ? `This client scored ${result.total_score - 65} points above the threshold (65) and is recommended for the bundle.`
                      : `This client scored ${65 - result.total_score} points below the threshold (65) and is not recommended for the bundle.`}
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
                  {(result.summary?.pros && result.summary.pros.length > 0) ? (
                    result.summary.pros.map((pro, idx) => (
                      <li key={idx}>{pro}</li>
                    ))
                  ) : (
                    <li>No strengths identified.</li>
                  )}
                </ul>
              </div>
              <div className={result.recommendation === 'Accept for Full-Service Bundle' ? 'cons-col' : 'strengths-col'}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Areas of Concern
                </Typography>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {(result.summary?.cons && result.summary.cons.length > 0) ? (
                    result.summary.cons.map((con, idx) => (
                      <li key={idx}>{con}</li>
                    ))
                  ) : (
                    <li>No concerns identified.</li>
                  )}
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

                  { label: 'Current Job Title', value: result.extracted_fields.current_job_title, score: result.scoring.current_job_title_score, max: 10 },
                  { label: 'Years of Experience', value: result.extracted_fields.years_of_experience, score: result.scoring.years_of_experience_score, max: 10 },
                  { label: 'Current Company', value: result.extracted_fields.current_company && typeof result.extracted_fields.current_company === 'object' ? `${result.extracted_fields.current_company.name} (${result.extracted_fields.current_company.score}/6)` : (result.extracted_fields.current_company || '—'), score: result.scoring.current_company_score, max: 6 },
                  { label: 'Previous Companies', value: (Array.isArray(result.extracted_fields.previous_companies) ? result.extracted_fields.previous_companies : []).map(c => `${c.name} (${c.score}/4)`).join(', ') || '—', score: result.scoring.previous_companies_score, max: 4 },
                  { label: 'Visa Sponsorship Required', value: result.extracted_fields.visa_sponsorship_required || '—', score: result.scoring.visa_sponsorship_score, max: 10 },
                  { label: 'Desired Compensation', value: result.extracted_fields.desired_compensation !== undefined && result.extracted_fields.desired_compensation !== null ? `$${result.extracted_fields.desired_compensation.toLocaleString()}` : '—', score: result.scoring.desired_compensation_score, max: 10 },
                  { label: 'Current Location', value: result.extracted_fields.current_location && typeof result.extracted_fields.current_location === 'object' ? `${result.extracted_fields.current_location.name} (${result.extracted_fields.current_location.score}/5)` : (result.extracted_fields.current_location || '—'), score: result.scoring.current_location_score, max: 5 },
                  { label: 'Willing to Work In', value: Array.isArray(result.extracted_fields.willing_to_work_in) ? (Array.isArray(result.extracted_fields.willing_to_work_in) ? result.extracted_fields.willing_to_work_in : []).map(loc => `${loc.name} (${loc.score}/5)`).join(', ') : (result.extracted_fields.willing_to_work_in || '—'), score: result.scoring.willing_to_work_in_score, max: 5 },
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
                  <td>{Math.max(0, Math.min(80, result.total_score))}/80</td>
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
          </Paper>
        )}
    </div>
    </Container>
  );
}

export default App;
