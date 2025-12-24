# WasteSense AI

A React + Firebase application for intelligent waste management with real-time risk assessment, SLA monitoring, and overflow prediction.

## Architecture

This project uses a **hybrid architecture**:
- **Frontend**: React application (client-side UI and data visualization)
- **Backend**: Firebase Cloud Functions (authoritative calculations and scheduled jobs)

### Backend Functions

The `functions/` directory contains serverless backend logic:

- **Risk Engine** (`engines/riskEngine.js`): Authoritative risk score calculation
  - Triggers on `bins` and `reports` collection writes
  - Calculates risk based on overflow history, time since collection, SLA status, weather, and crowd data
  
- **SLA Engine** (`engines/slaEngine.js`): SLA monitoring and breach detection
  - Scheduled job runs every 12 minutes
  - Monitors all bins for SLA compliance
  - Detects and tracks breaches
  
- **Prediction Engine** (`engines/predictionEngine.js`): Overflow prediction
  - Scheduled job runs every hour
  - Analyzes trends and predicts overflow likelihood

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Firebase account
- Firebase CLI installed globally: `npm install -g firebase-tools`

### Initial Setup

1. **Login to Firebase**:
   ```powershell
   firebase login
   ```
   This will open a browser for authentication.

2. **Create a Firebase Project** (if you don't have one):
   - Go to https://console.firebase.google.com/
   - Click "Add project" or "Create a project"
   - Enter a project name (e.g., "wastesense-ai")
   - Follow the setup wizard
   - **Important**: Enable Firestore Database when prompted

3. **Set Your Firebase Project**:
   ```powershell
   firebase use --add
   ```
   Select your project from the list.

   Or if you know your project ID:
   ```powershell
   firebase use YOUR_PROJECT_ID
   ```

4. **Install Frontend Dependencies**:
   ```powershell
   npm install
   ```

5. **Install Functions Dependencies**:
   ```powershell
   cd functions
   npm install
   cd ..
   ```

### Deployment

**Deploy Cloud Functions**:
```powershell
cd functions
firebase deploy --only functions
```

Or use the helper script:
```powershell
.\deploy-functions.ps1 -ProjectId YOUR_PROJECT_ID
```

### Development

**Run Frontend**:
```powershell
npm run dev
```

**Test Functions Locally** (optional):
```powershell
cd functions
npm run serve
```

## Project Structure

```
TechSprint/
├── functions/              # Firebase Cloud Functions
│   ├── index.js           # Function triggers and schedules
│   ├── engines/           # Business logic engines
│   │   ├── riskEngine.js
│   │   ├── slaEngine.js
│   │   └── predictionEngine.js
│   ├── services/          # Service layer
│   │   └── firestore.js
│   └── package.json
├── src/                   # React frontend
│   ├── components/
│   ├── pages/
│   └── services/
├── firebase.json          # Firebase configuration
└── package.json
```

## How It Works

1. **Risk Calculation**: When a bin or report is created/updated, a Cloud Function automatically recalculates the risk score and writes it back to the bin document.

2. **SLA Monitoring**: Every 12 minutes, a scheduled function checks all bins for SLA compliance and updates their status.

3. **Overflow Prediction**: Every hour, a scheduled function analyzes trends and predicts which bins are likely to overflow.

4. **Frontend**: The React app reads the computed values (riskScore, slaStatus, overflowPrediction) from Firestore and displays them in real-time.

## Notes

- The backend is the **authoritative source** for risk scores, SLA status, and predictions
- Frontend calculations are for display purposes only
- All backend logic is centralized in the `functions/` directory
- No business logic in `index.js` - it only wires triggers and schedules
