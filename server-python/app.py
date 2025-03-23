from flask import Flask, request, Response, stream_with_context, jsonify
from flask_cors import CORS
import os
import google.generativeai as genai
from dotenv import load_dotenv
import requests
import json
from datetime import datetime
import pytz
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure the Gemini API with your API key
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = Flask(__name__)
# Enable CORS for all routes with specific settings for better mobile compatibility
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "https://finwise.rerecreation.us", "http://finwise.rerecreation.us"]}})

# First, get a detailed response
DETAILED_PROMPT = """
You are an ethical financial advisor specializing in Indian markets. Your name is FinWise.
Provide clear, direct financial advice based on real financial data and best practices.

IMPORTANT RULES:
1. Keep your response to a maximum of 200 words
2. Write in a conversational, easy-to-understand style
3. Focus on actionable advice
4. End with a brief one-line disclaimer in italics
5. Add 3 natural follow-up questions with emojis on new lines

Focus on:
- Long-term investment strategies aligned with the client's goals
- Ethical investment considerations
- Risk management and diversification
- Indian tax implications and regulations
- Market trends in BSE/NSE
"""

# Cache for financial data to avoid excessive API calls
market_data_cache = {
    "timestamp": None,
    "data": None,
    "cache_expiry_seconds": 300  # Cache expires after 5 minutes
}

def get_indian_market_data():
    """Fetch live data from Indian stock markets (NSE/BSE)"""
    current_time = datetime.now(pytz.timezone('Asia/Kolkata'))
    
    # Check if cache is valid
    if (market_data_cache["timestamp"] and
        (current_time - market_data_cache["timestamp"]).total_seconds() < market_data_cache["cache_expiry_seconds"]):
        return market_data_cache["data"]
    
    # For real implementation, replace with actual API calls to NSE/BSE data providers
    # This is a placeholder using a public API for demo purposes
    try:
        # Fetch major Indian indices
        nse_response = requests.get("https://api.polygon.io/v2/aggs/ticker/NSEI/prev?adjusted=true&apiKey=" + os.getenv("POLYGON_API_KEY", ""))
        bse_response = requests.get("https://api.polygon.io/v2/aggs/ticker/SENSEX/prev?adjusted=true&apiKey=" + os.getenv("POLYGON_API_KEY", ""))
        
        # Fetch top gainers/losers - In a real app, you'd use appropriate APIs
        # For demo, we'll simulate this data
        top_gainers = [
            {"symbol": "RELIANCE.NS", "change_percent": 2.45},
            {"symbol": "TCS.NS", "change_percent": 1.78},
            {"symbol": "HDFCBANK.NS", "change_percent": 1.65}
        ]
        
        top_losers = [
            {"symbol": "INFY.NS", "change_percent": -1.23},
            {"symbol": "ICICIBANK.NS", "change_percent": -0.89},
            {"symbol": "AXISBANK.NS", "change_percent": -0.72}
        ]
        
        # Get currency rates
        usd_inr = requests.get("https://open.er-api.com/v6/latest/USD")
        
        market_data = {
            "indices": {
                "nifty50": nse_response.json() if nse_response.status_code == 200 else {"c": 22000, "percent_change": 0.67},
                "sensex": bse_response.json() if bse_response.status_code == 200 else {"c": 72500, "percent_change": 0.58}
            },
            "top_gainers": top_gainers,
            "top_losers": top_losers,
            "forex": {
                "usd_inr": usd_inr.json()["rates"]["INR"] if usd_inr.status_code == 200 else 83.2
            },
            "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S IST")
        }
        
        # Update cache
        market_data_cache["timestamp"] = current_time
        market_data_cache["data"] = market_data
        
        return market_data
        
    except Exception as e:
        print(f"Error fetching market data: {str(e)}")
        # Return fallback data if API calls fail
        return {
            "indices": {
                "nifty50": {"c": 22000, "percent_change": 0.67},
                "sensex": {"c": 72500, "percent_change": 0.58}
            },
            "top_gainers": top_gainers,
            "top_losers": top_losers,
            "forex": {
                "usd_inr": 83.2
            },
            "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S IST")
        }

@app.route('/market-data', methods=['GET'])
def market_data():
    """API endpoint to get current market data"""
    return get_indian_market_data()

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests and return responses with financial context"""
    try:
        # Log client information
        user_agent = request.headers.get('User-Agent', 'Unknown')
        origin = request.headers.get('Origin', 'Unknown')
        content_type = request.headers.get('Content-Type', 'Unknown')
        logger.info(f"Chat request received - UA: {user_agent}, Origin: {origin}, Content-Type: {content_type}")
        
        data = request.json
        msg = data.get('chat', '')
        history = data.get('history', [])
        
        logger.info(f"Processing message: '{msg[:30]}...' with {len(history)} history items")

        # Convert history to the format expected by the API
        chat_history = []
        for item in history:
            chat_history.append({
                "role": item["role"],
                "parts": [{"text": item["parts"][0]["text"]}]
            })

        # Get market data
        market_data = get_indian_market_data()

        # Create context message with market data
        market_context = f"""
Current Indian Market Data ({market_data['timestamp']}):
- Nifty 50: {market_data['indices']['nifty50']['c']} ({market_data['indices']['nifty50']['percent_change']}%)
- Sensex: {market_data['indices']['sensex']['c']} ({market_data['indices']['sensex']['percent_change']}%)
- USD/INR: {market_data['forex']['usd_inr']}

Top Gainers:
{', '.join([f"{g['symbol']}: +{g['change_percent']}%" for g in market_data['top_gainers']])}

Top Losers:
{', '.join([f"{l['symbol']}: {l['change_percent']}%" for l in market_data['top_losers']])}
"""

        # First, get detailed response
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        logger.info("Generating content with Gemini...")
        detailed_response = model.generate_content(
            f"{DETAILED_PROMPT}\n\n{market_context}\n\nQuery: {msg}"
        ).text
        logger.info(f"Generated response (first 30 chars): {detailed_response[:30]}...")

        resp = jsonify({"text": detailed_response})
        # Add explicit CORS headers for standard responses
        resp.headers['Access-Control-Allow-Origin'] = '*'
        logger.info("Returning JSON response")
        return resp

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        resp = jsonify({"error": str(e)})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

@app.route('/stream', methods=['POST', 'OPTIONS'])
def stream():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = Response()
        response.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600',
            'Access-Control-Allow-Credentials': 'false'
        })
        return response

    request_id = datetime.now().strftime('%Y%m%d-%H%M%S-') + str(id(request))[:8]
    try:
        # Log complete request details
        logger.info(f"[{request_id}] New stream request received")
        logger.info(f"[{request_id}] Headers: {dict(request.headers)}")
        logger.info(f"[{request_id}] Client IP: {request.remote_addr}")
        logger.info(f"[{request_id}] Method: {request.method}")
        
        data = request.json
        msg = data.get('chat', '')
        history = data.get('history', [])
        
        logger.info(f"[{request_id}] Message length: {len(msg)}")
        logger.info(f"[{request_id}] History items: {len(history)}")

        # Get market data
        logger.info(f"[{request_id}] Fetching market data...")
        market_data = get_indian_market_data()
        logger.info(f"[{request_id}] Market data fetched successfully")

        # Create context message with market data
        market_context = f"""
Current Indian Market Data ({market_data['timestamp']}):
- Nifty 50: {market_data['indices']['nifty50']['c']} ({market_data['indices']['nifty50']['percent_change']}%)
- Sensex: {market_data['indices']['sensex']['c']} ({market_data['indices']['sensex']['percent_change']}%)
- USD/INR: {market_data['forex']['usd_inr']}

Top Gainers:
{', '.join([f"{g['symbol']}: +{g['change_percent']}%" for g in market_data['top_gainers']])}

Top Losers:
{', '.join([f"{l['symbol']}: {l['change_percent']}%" for l in market_data['top_losers']])}
"""
        logger.info(f"[{request_id}] Market context prepared")

        # Generate response
        logger.info(f"[{request_id}] Initializing Gemini model...")
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        
        logger.info(f"[{request_id}] Generating content with Gemini...")
        try:
            detailed_response = model.generate_content(
                f"{DETAILED_PROMPT}\n\n{market_context}\n\nQuery: {msg}"
            ).text
            logger.info(f"[{request_id}] Generated response length: {len(detailed_response)}")
            logger.info(f"[{request_id}] First 100 chars: {detailed_response[:100]}")
        except Exception as model_error:
            logger.error(f"[{request_id}] Model generation error: {str(model_error)}", exc_info=True)
            raise

        def generate():
            try:
                # Send the response in smaller chunks for better mobile compatibility
                chunk_size = 50  # Reduced chunk size for mobile
                total_chunks = len(detailed_response) // chunk_size + (1 if len(detailed_response) % chunk_size else 0)
                chunks_sent = 0
                
                logger.info(f"[{request_id}] Starting stream with {total_chunks} chunks")
                
                for i in range(0, len(detailed_response), chunk_size):
                    chunk = detailed_response[i:i + chunk_size]
                    chunks_sent += 1
                    logger.info(f"[{request_id}] Sending chunk {chunks_sent}/{total_chunks}, size: {len(chunk)}")
                    yield chunk
                
                logger.info(f"[{request_id}] Stream completed successfully")
            except Exception as stream_error:
                logger.error(f"[{request_id}] Error during streaming: {str(stream_error)}", exc_info=True)
                raise
                
        logger.info(f"[{request_id}] Setting up response stream...")
        resp = Response(
            stream_with_context(generate()),
            mimetype='text/plain'
        )
        
        # Add comprehensive CORS and caching headers
        resp.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'false',
            'Access-Control-Expose-Headers': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Accel-Buffering': 'no',
            'Transfer-Encoding': 'chunked'
        })
        
        logger.info(f"[{request_id}] Response headers set: {dict(resp.headers)}")
        return resp

    except Exception as e:
        logger.error(f"[{request_id}] Error in stream endpoint: {str(e)}", exc_info=True)
        error_resp = Response(
            json.dumps({
                "error": str(e),
                "request_id": request_id
            }),
            status=500,
            mimetype='application/json'
        )
        error_resp.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'false',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        })
        logger.error(f"[{request_id}] Returning error response: {str(e)}")
        return error_resp

@app.route('/ping', methods=['GET'])
def ping():
    """Simple endpoint to check if server is running"""
    logger.info(f"Ping request received from {request.remote_addr}")
    resp = jsonify({"status": "ok", "message": "Server is running"})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

if __name__ == '__main__':
    port = int(os.getenv("PORT", 9000))
    logger.info(f"Starting server on port {port}")
    app.run(debug=True, host='0.0.0.0', port=port) 