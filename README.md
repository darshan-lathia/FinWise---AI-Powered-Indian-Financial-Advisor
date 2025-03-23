# FinWise - AI-Powered Indian Financial Advisor

FinWise is an AI-powered financial advisor application specializing in Indian markets. It provides real-time market insights, personalized financial advice, and interactive chat functionality using Google's Gemini 1.5 Flash model.

![FinWise Screenshot](screenshots/finwise.png)

## Features

- 🤖 AI-powered financial advice using Gemini 1.5 Flash
- 📈 Real-time Indian market data integration
- 💬 Interactive chat interface with streaming responses
- 🌓 Dark/Light mode support
- 📱 Fully responsive design (desktop & mobile)
- 🔄 Infinite scrolling suggestions
- 🎯 Focused on Indian market context

## Tech Stack

- Frontend:
  - React (TypeScript)
  - Material-UI
  - React Markdown
  - CSS3 with modern features

- Backend:
  - Python
  - Flask
  - Google Generative AI
  - Polygon.io API (for market data)

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8+
- Google API Key (Gemini)
- Polygon.io API Key (optional, for real market data)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/finwise.git
cd finwise
```

### 2. Backend Setup

```bash
cd server-python

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `.env` file and add your API keys:
```
GOOGLE_API_KEY=your_gemini_api_key_here
POLYGON_API_KEY=your_polygon_api_key_here
```

### 3. Frontend Setup

```bash
cd client-react

# Install dependencies
npm install

# Create .env file (if needed)
cp .env.example .env
```

### 4. Running the Application

1. Start the Backend Server:
```bash
cd server-python
python app.py
# Server will start on http://localhost:9000
```

2. Start the Frontend Development Server:
```bash
cd client-react
npm start
# App will open on http://localhost:3000
```

## Environment Variables

### Backend (.env)
- `GOOGLE_API_KEY`: Required for Gemini AI model
- `POLYGON_API_KEY`: Optional for real market data (uses mock data if not provided)
- `PORT`: Optional, defaults to 9000

### Frontend (.env)
- No required environment variables for basic setup
- API URL configurations are handled automatically

## Deployment

The application can be deployed using various methods:

1. Traditional Server:
   - Build the React app: `npm run build`
   - Serve the static files and API using Nginx/Apache

2. Cloud Platforms:
   - Frontend: Vercel, Netlify, or GitHub Pages
   - Backend: Heroku, DigitalOcean, or AWS

## API Endpoints

- `/chat`: POST - Non-streaming chat endpoint
- `/stream`: POST - Streaming chat endpoint
- `/market-data`: GET - Current market data
- `/ping`: GET - Server health check

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini API for AI capabilities
- Polygon.io for market data
- Material-UI for components
- All contributors and supporters 