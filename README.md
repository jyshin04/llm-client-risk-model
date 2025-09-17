# InterRoom AI Resume Screener

A resume screener that uses custom scoring criteria and OpenAI API to evaluate candidates for full-service bundle opportunities. The application extracts key information from resumes, scores candidates based on multiple criteria, and provides detailed recommendations for hiring decisions.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │   OpenAI API    │
│   (Vercel)      │◄──►│   (Railway)     │◄──►│   (GPT Models)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   PDF Upload    │    │  OCR Processing │
│   & Validation  │    │  (Python/Tesseract) │
└─────────────────┘    └─────────────────┘
```

## Technology Stack

### Frontend (React)

- **React 19.1.0**: Latest React with modern features
- **Material-UI (MUI) 7.2.0**: Professional UI components
- **jsPDF 3.0.1**: Client-side PDF generation
- **React Scripts 5.0.1**: Build and development tools

### Backend (Node.js)

- **Express 4.21.2**: Web framework
- **Multer 1.4.5**: File upload handling
- **pdf-parse 1.1.1**: PDF text extraction
- **OpenAI 4.29.0**: AI model integration
- **CORS 2.8.5**: Cross-origin resource sharing

### AI & Processing

- **OpenAI GPT-3.5-turbo**: Text extraction and classification
- **OpenAI GPT-4**: Advanced analysis and recommendations
- **Python OCR**: Tesseract + pdf2image for image-based PDFs
- **Custom Scoring Algorithms**: Deterministic and AI-powered scoring

### Deployment

- **Vercel**: Frontend hosting with automatic deployments
- **Railway**: Backend hosting with environment management
- **Environment Variables**: Secure API key management

## Installation

### Prerequisites

- Node.js 16+ and npm
- Python 3.7+ (for OCR functionality)
- OpenAI API key

### Backend Setup

```bash
cd server
npm install
cp env.example .env
# Edit .env with your OpenAI API key
npm start
```

### Frontend Setup

```bash
cd client
npm install
npm start
```

### OCR Dependencies (Optional)

```bash
# Install Python dependencies for OCR fallback
pip install pytesseract pdf2image
# Install system dependencies (varies by OS)
# Ubuntu/Debian: sudo apt-get install tesseract-ocr poppler-utils
# macOS: brew install tesseract poppler
```

## Configuration

### Environment Variables

#### Backend (.env)

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=5000
```

#### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5000
# For production, set to your Railway backend URL
```

## Usage

### 1. Upload Resume

- Navigate to the application
- Upload a PDF resume (max 10MB)
- Click "Next" to proceed

### 2. Additional Information

- Set desired compensation using the slider
- Add locations willing to work (comma-separated)
- Select visa sponsorship requirement
- Click "Analyze Resume"

### 3. Review Results

- View comprehensive scoring breakdown
- Read AI-generated pros and cons
- See hiring recommendation
- Export results as PDF

## Scoring System

### Scoring Criteria (Total: 80 points)

| Category           | Max Score | Description                                   |
| ------------------ | --------- | --------------------------------------------- |
| Employment Status  | 10        | Currently employed (10) vs unemployed (6)     |
| Education Level    | 10        | PhD/Master (10), Bachelor (9), Others (0)     |
| Job Title          | 10        | HIGH roles (10), MID roles (5), LOW roles (0) |
| Experience         | 10        | 3-15 years (10), 0-2 years (2), 15+ years (0) |
| Current Company    | 6         | Company reputation scoring (0-6)              |
| Previous Companies | 4         | Best previous company score (0-4)             |
| Visa Sponsorship   | 10        | No sponsorship needed (10), Required (0)      |
| Compensation       | 10        | $100k-$140k (8), $140k+ (10), <$100k (0)      |
| Current Location   | 5         | Geographic opportunity score (1-5)            |
| Willing Locations  | 5         | Best willing location score (1-5)             |

### Recommendation Threshold

- **Accept**: Score ≥ 65 points
- **Reject**: Score < 65 points

## File Structure

```
llm-client-risk-model/
├── client/                     # React frontend
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── App.js            # Main application component
│   │   ├── App.css           # Application styles
│   │   ├── index.js          # React entry point
│   │   └── interroom-logo.png # Company logo
│   ├── package.json          # Frontend dependencies
│   └── build/                # Production build
├── server/                    # Express backend
│   ├── server.js             # Main server file
│   ├── temp/                 # Temporary file storage
│   │   └── ocr_script.py     # Python OCR script
│   ├── package.json          # Backend dependencies
│   └── env.example           # Environment variables template
└── README.md                 # This file
```

## Deployment

### Frontend (Vercel)

1. Connect GitHub repository to Vercel
2. Set build command: `cd client && npm run build`
3. Set output directory: `client/build`
4. Configure environment variables:
   - `REACT_APP_API_URL`: Railway backend URL

### Backend (Railway)

1. Connect GitHub repository to Railway
2. Set start command: `cd server && npm start`
3. Configure environment variables:
   - `OPENAI_API_KEY`: OpenAI API key
   - `PORT`: Railway will set this automatically

### Running Locally

```bash
# Terminal 1: Backend
cd server
npm run dev  # Uses nodemon for auto-restart

# Terminal 2: Frontend
cd client
npm start    # Runs on http://localhost:3000
```
